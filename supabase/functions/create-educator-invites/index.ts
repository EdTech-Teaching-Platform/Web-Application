import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";
const opt = (req: Request) => options(req);
Deno.serve(async (req) => {
  const preflight = opt(req); if (preflight) return preflight;
  try {
    const { userClient, admin } = clients(req);
    const actor = await requireAdmin(req, userClient);
    const input = await req.json();
    const rows = Array.isArray(input) ? input : input.rows;
    if (!Array.isArray(rows)) throw new Error("rows must be an array");
    const { data: created, error } = await userClient.rpc("create_educator_invites", { p_rows: rows });
    if (error) throw error;
    const emails = rows.map((row) => String(row.email ?? "").trim().toLowerCase()).filter(Boolean);
    const { data: pending, error: pendingError } = await admin.from("educator_invites").select("*").eq("status", "pending").eq("invited_by", actor.id).in("email", emails);
    if (pendingError) throw pendingError;
    const results = [];
    for (const invite of pending ?? []) {
      try {
        const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(invite.email, { data: { full_name: invite.name, role: "educator" } });
        if (inviteError) throw inviteError;
        const [firstName, ...rest] = invite.name.trim().split(/\s+/);
        const { error: registerError } = await admin.rpc("register_educator", {
          p_user_id: data.user.id,
          p: { firstName, lastName: rest.join(" ") || firstName, email: invite.email, phone: invite.phone, subjects: [], bulk: true },
        });
        if (registerError) throw registerError;
        await admin.from("educator_invites").update({ status: "sent", user_id: data.user.id, sent_at: new Date().toISOString(), error: null }).eq("id", invite.id);
        results.push({ id: invite.id, email: invite.email, status: "sent" });
      } catch (error) {
        await admin.from("educator_invites").update({ status: "failed", error: String(error instanceof Error ? error.message : error) }).eq("id", invite.id);
        results.push({ id: invite.id, email: invite.email, status: "failed", error: String(error) });
      }
    }
    return json({ ...created, sent: results });
  } catch (error) { return fail(error); }
});
