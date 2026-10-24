import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const { userClient } = clients(req); await requireAdmin(req, userClient);
    const { userId, reason = "admin_action" } = await req.json();
    if (!userId) throw new Error("userId is required");
    const { data, error } = await userClient.rpc("revoke_user_sessions", { p_user_id: userId, p_reason: reason });
    if (error) throw error;
    return json({ revoked: data });
  } catch (error) { return fail(error); }
});
