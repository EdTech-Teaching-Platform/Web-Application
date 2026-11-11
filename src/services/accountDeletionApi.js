import { supabase } from "./supabaseClient";

// Delete-account requests (QA #21, 20261111090000). A student or educator asks
// for deletion; an admin approves (the account is blocked, then the data is
// removed by hand) or rejects it. See docs/QA_BUG_TRIAGE_AND_FIXES.md (P9).

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
  mine: async () => mapDeletionRequest(await rpc("account_get_deletion_request")),
  request: async (reason) => mapDeletionRequest(await rpc("account_request_deletion", { p_reason: reason?.trim() || null })),
  cancel: async () => mapDeletionRequest(await rpc("account_cancel_deletion_request")),
};

export default accountDeletionApi;
