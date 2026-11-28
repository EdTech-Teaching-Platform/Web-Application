// An admin deletes a student's account (QA 28 Nov, Bug 4). Admin only.
// Body: { userId, confirm: "DELETE", reason? }   (validate.ts)
//   1. The caller must be a platform admin (requireAdmin, the caller's JWT).
//   2. adm_account_delete_by_admin (service role only, 20261129090000): checks
//      the admin again, refuses non-students, admins and yourself, records the
//      deletion (decided by the admin), blocks the student, ends their
//      sessions and audits account.deleted_by_admin.
//   3. As delete-account: the Auth email becomes deleted+<id>@deleted.invalid
//      (so the address can sign up again), then auth.admin.deleteUser(id, true)
//      (soft delete; rows in the lead's tables stay for the retention job). If
//      that fails the user is banned instead (already blocked in SQL).
// Returns { deleted: true, userId, authDeleted }. Errors: { error, field? } with
// 400 / 403 / 404 / 405 / 500.
import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";
import { BAN_DURATION, tombstoneEmail } from "../delete-account/validate.ts";
import { AdminDeleteError, statusForCode, validateAdminDeleteRequest } from "./validate.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const { userClient, admin } = clients(req);
    const caller = await requireAdmin(req, userClient);

    let body: unknown;
    try { body = await req.json(); } catch { body = null; }
    const request = validateAdminDeleteRequest(body);

    const { error: rpcError } = await admin.rpc("adm_account_delete_by_admin", {
      p_admin: caller.id, p_user: request.userId, p_reason: request.reason,
    });
    if (rpcError) throw new AdminDeleteError(rpcError.message, statusForCode(rpcError.code));

    const { data: target } = await admin.auth.admin.getUserById(request.userId);
    const { error: emailError } = await admin.auth.admin.updateUserById(request.userId, {
      email: tombstoneEmail(request.userId), email_confirm: true,
      user_metadata: { ...(target?.user?.user_metadata || {}), deleted: true },
    });
    if (emailError) console.error("admin-delete-student: could not release the email", emailError.message);

    const { error: deleteError } = await admin.auth.admin.deleteUser(request.userId, true);
    if (deleteError) {
      const { error: banError } = await admin.auth.admin.updateUserById(request.userId, { ban_duration: BAN_DURATION });
      if (banError) {
        console.error("admin-delete-student: auth delete and ban failed", deleteError.message, banError.message);
        return json({ error: "The account is blocked, but its sign-in could not be removed. Try again." }, 500);
      }
    }
    return json({ deleted: true, userId: request.userId, authDeleted: !deleteError });
  } catch (error) {
    if (error instanceof AdminDeleteError) return json({ error: error.message, field: error.field }, error.status);
    return fail(error);
  }
});
