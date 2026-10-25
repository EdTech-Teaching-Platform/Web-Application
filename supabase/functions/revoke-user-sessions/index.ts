// Security Center "Revoke sessions" (D6). Two parts:
//   1. revoke_user_sessions RPC (as the calling admin): ends the user's
//      app-level user_sessions rows and records admin_auth_events.
//   2. Supabase Admin API signOut, the only token revocation used here; no
//      SQL touches the auth schema. signOut(jwt, scope) works on an access
//      token, so tokens are revoked when the admin revokes their own sessions
//      (scope "others" = sign out other devices, "global" = everywhere). For
//      another user there is no Admin API signOut by user id: the response
//      says tokens_revoked: false and the user's refresh tokens stay valid
//      until they expire. Blocked / suspended accounts are refused at
//      record_login.
// Body: { userId, reason?, scope?: "global" | "others" }.
import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const { userClient, admin, auth } = clients(req);
    const actor = await requireAdmin(req, userClient);
    const { userId, reason = "admin_action", scope = "global" } = await req.json();
    if (!userId) throw new Error("userId is required");
    if (!["global", "others"].includes(scope)) throw new Error("scope must be global or others");

    const { data: ended, error } = await userClient.rpc("revoke_user_sessions", { p_user_id: userId, p_reason: reason });
    if (error) throw error;

    let tokensRevoked = false;
    let note: string | null = null;
    if (userId === actor.id) {
      const token = auth.replace(/^Bearer\s+/i, "");
      const { error: signOutError } = await admin.auth.admin.signOut(token, scope);
      if (signOutError) throw signOutError;
      tokensRevoked = true;
    } else {
      note = "The Admin API can only sign out with the user's own access token. App sessions were ended; the user's refresh tokens expire on their own.";
    }
    return json({ revoked: ended, tokens_revoked: tokensRevoked, note });
  } catch (error) { return fail(error); }
});
