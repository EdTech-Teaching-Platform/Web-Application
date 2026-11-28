// Self-service account deletion (QA 18 Nov): students and educators delete
// their own account, no admin approval.
// Body: { confirm: "DELETE", password?: string, reason?: string }   (validate.ts)
//   1. The caller is the signed-in user (JWT). Accounts with a password must
//      send it; it is re-checked here with Supabase Auth (a throwaway client,
//      no session kept). Google-only accounts confirm with DELETE.
//   2. adm_account_delete_self (service role only, 20261118090000): records the
//      deletion, closes a pending request, blocks a student / suspends an
//      educator and ends their sessions, so every RPC refuses at once.
//      Admin accounts are refused there, before anything is deleted.
//   3. The Auth email is replaced by deleted+<id>@deleted.invalid (so the address
//      can be used again), then auth.admin.deleteUser(id, true): soft delete. The user
//      can't sign in again and the email is released; rows in the lead's
//      tables are kept for the retention job. If that call fails the account
//      is banned instead (it is already blocked in SQL).
// Returns { deleted: true, role, authDeleted }. Errors: { error, field? } with
// 400 / 403 / 405 / 500.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { clients, fail, json, options, requireUser } from "../_shared/auth.ts";
import { BAN_DURATION, DeleteRequestError, hasPasswordIdentity, tombstoneEmail, validateDeleteRequest } from "./validate.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const { userClient, admin } = clients(req);
    const user = await requireUser(req, userClient);

    let body: unknown;
    try { body = await req.json(); } catch { body = null; }
    const request = validateDeleteRequest(body);

    if (hasPasswordIdentity(user)) {
      if (!request.password) throw new DeleteRequestError("Enter your password.", 400, "password");
      const check = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await check.auth.signInWithPassword({ email: user.email ?? "", password: request.password });
      if (error || data.user?.id !== user.id) throw new DeleteRequestError("That password isn't right.", 400, "password");
    }

    const { data: record, error: rpcError } = await admin.rpc("adm_account_delete_self", {
      p_user: user.id, p_reason: request.reason,
    });
    if (rpcError) {
      if (rpcError.code === "42501") throw new DeleteRequestError(rpcError.message, 403);
      throw new Error(rpcError.message);
    }

    // QA 22 Nov: a soft-deleted user keeps its email, so the person couldn't
    // sign up again. Release it first: the Auth user gets a tombstone address
    // (our records keep the request, the profile row is unchanged).
    const { error: emailError } = await admin.auth.admin.updateUserById(user.id, {
      email: tombstoneEmail(user.id), email_confirm: true, user_metadata: { ...(user.user_metadata || {}), deleted: true },
    });
    if (emailError) console.error("delete-account: could not release the email", emailError.message);

    const { error: deleteError } = await admin.auth.admin.deleteUser(user.id, true);
    if (deleteError) {
      const { error: banError } = await admin.auth.admin.updateUserById(user.id, { ban_duration: BAN_DURATION });
      if (banError) {
        console.error("delete-account: auth delete and ban failed", deleteError.message, banError.message);
        return json({ error: "Your account was closed, but sign-in could not be removed. Please contact support." }, 500);
      }
    }
    return json({ deleted: true, role: (record as { role?: string } | null)?.role ?? null, authDeleted: !deleteError });
  } catch (error) {
    if (error instanceof DeleteRequestError) return json({ error: error.message, field: error.field }, error.status);
    return fail(error);
  }
});
