import { supabase } from "./supabaseClient";
import { invokeFunction } from "./edgeFunctions";

// Delete account. Since QA 18 Nov a student or educator deletes their own
// account directly (deleteAccount -> the delete-account Edge Function, which
// re-checks the password, blocks the account and soft-deletes the Auth user;
// 20261118090000). The older request RPCs (QA #21, 20261111090000) stay for
// requests sent before; admins still see them in Support -> Deletion requests.

async function rpc(name, params) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) {
    const err = new Error(error.message || "Something went wrong. Please try again.");
    err.code = error.code;
    throw err;
  }
  return data ?? null;
}

export function mapDeletionRequest(r) {
  if (!r) return null;
  return {
    id: r.id, status: r.status, role: r.role, reason: r.reason || "",
    createdAt: r.created_at || null, decidedAt: r.decided_at || null, decisionNote: r.decision_note || "",
    userId: r.user_id, name: r.name || "", email: r.email || "", decidedByName: r.decided_by_name || "",
    selfService: Boolean(r.self_service),   // deleted by the user themselves (20261118090000)
  };
}

// The account signs in with a password (an "email" identity), so deleting it
// asks for that password again. Google-only accounts confirm by typing DELETE.
export async function hasPasswordSignIn() {
  try {
    const { data } = await supabase.auth.getUser();
    const identities = data?.user?.identities || [];
    const providers = data?.user?.app_metadata?.providers || [];
    return identities.some((i) => i.provider === "email") || providers.includes("email");
  } catch {
    return true;
  }
}

// Re-checks the password without changing who is signed in (same user).
export async function verifyPassword(email, password) {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    const err = new Error(/invalid login credentials/i.test(error.message || "") ? "That password isn't right." : error.message);
    err.code = "wrong_password";
    throw err;
  }
}

export const accountDeletionApi = {
  // Deletes the signed-in account now. Throws with .field = "password" on a wrong password.
  deleteAccount: ({ password, reason }) => invokeFunction("delete-account", {
    confirm: "DELETE", password: password || undefined, reason: reason?.trim() || undefined,
  }),
  // After the deletion: drop the local session (the server ended the others).
  signOut: () => supabase.auth.signOut({ scope: "local" }).catch(() => {}),
  mine: async () => mapDeletionRequest(await rpc("account_get_deletion_request")),
  request: async (reason) => mapDeletionRequest(await rpc("account_request_deletion", { p_reason: reason?.trim() || null })),
  cancel: async () => mapDeletionRequest(await rpc("account_cancel_deletion_request")),
};

export default accountDeletionApi;
