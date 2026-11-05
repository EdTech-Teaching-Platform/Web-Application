// Auth-level ban for a blocked account (QA triage P2). Admin only.
// Body: { userId, ban: true | false, reason? }   (validate.ts)
//   ban: true   -> auth.admin.updateUserById(userId, { ban_duration: "876000h" }):
//                  sign-in and token refresh are refused by Supabase Auth.
//   ban: false  -> { ban_duration: "none" }: the ban is lifted.
// Order: the admin UI calls block_student / unblock_student first, then this
// function. It bans only when the SQL block is in place and lifts the ban
// only after the SQL unblock (adm_user_ban_check), never bans an admin
// account, and refuses banning yourself. Existing access tokens expire on
// their own; the student RPCs already refuse a blocked account
// (20261102090000), so the block is effective immediately either way.
// Every call is audited (adm_record_user_ban: user.auth_ban / user.auth_unban).
// Returns { userId, banned, ban_duration }. Errors: { error, field? } with
// 400 / 401 / 403 / 404 / 409.
import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";
import { BanRequestError, decideBan, validateBanRequest } from "./validate.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const { userClient, admin } = clients(req);
    await requireAdmin(req, userClient);

    let body: unknown;
    try { body = await req.json(); } catch { body = null; }
    const request = validateBanRequest(body);

    const { data: target, error: checkError } = await userClient.rpc("adm_user_ban_check", { p_user: request.userId });
    if (checkError) throw new Error(checkError.message);
    const change = decideBan(request, target);

    const { error } = await admin.auth.admin.updateUserById(request.userId, change);
    await userClient.rpc("adm_record_user_ban", {
      p_user: request.userId, p_banned: request.ban, p_ok: !error, p_note: error ? error.message : request.reason,
    });
    if (error) throw new Error(`Auth could not ${request.ban ? "ban" : "unban"} the user: ${error.message}`);
    return json({ userId: request.userId, banned: request.ban, ban_duration: change.ban_duration });
  } catch (error) {
    if (error instanceof BanRequestError) return json({ error: error.message, field: error.field }, error.status);
    return fail(error);
  }
});
