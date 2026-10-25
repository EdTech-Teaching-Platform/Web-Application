// "Add teacher" (single and bulk), D8. Flow per row:
//   1. create_educator_invites (as the calling admin): validates rows, skips
//      emails that already have a profile or an open invite, queues invites.
//   2. auth.admin.inviteUserByEmail (service role): creates the auth user and
//      sends the invite email. No trigger exists on auth.users (F3), so:
//   3. register_educator (service role) inserts profiles (role 'educator'),
//      educator_profiles (phone from input or '', location 'Not provided',
//      verification_status 'pending', total_students 0, total_courses 0) and
//      educator_admin_state. 'under_review' is never written to
//      educator_profiles.verification_status (D7).
//   If step 3 fails, the auth user from step 2 is deleted again.
// Returns { created, skipped, results: [{ email, status: sent|skipped|failed, user_id?, error? }] }.
import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";

type InviteRow = { id: string; name: string; email: string; phone: string | null; qualification: string | null; years_experience: number | null; subjects: string[] | null };

const message = (error: unknown) => (error instanceof Error ? error.message : typeof error === "object" && error && "message" in error ? String((error as { message: unknown }).message) : String(error));

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const { userClient, admin } = clients(req);
    const actor = await requireAdmin(req, userClient);
    const input = await req.json();
    const rows = Array.isArray(input) ? input : input?.rows;
    if (!Array.isArray(rows) || rows.length === 0) throw new Error("rows must be a non-empty array");
    if (rows.length > 500) throw new Error("At most 500 invites per request");

    const { data: queued, error } = await userClient.rpc("create_educator_invites", { p_rows: rows });
    if (error) throw error;
    const results: Array<Record<string, unknown>> = (queued?.skipped ?? []).map((s: { email: string; reason: string }) => ({ email: s.email, status: "skipped", error: s.reason }));

    const emails = [...new Set(rows.map((row) => String(row?.email ?? "").trim().toLowerCase()).filter(Boolean))];
    const { data: pending, error: pendingError } = await admin.from("educator_invites")
      .select("id,name,email,phone,qualification,years_experience,subjects")
      .eq("status", "pending").eq("invited_by", actor.id).in("email", emails);
    if (pendingError) throw pendingError;

    const redirectTo = Deno.env.get("EDUCATOR_INVITE_REDIRECT_URL") || undefined;
    for (const invite of (pending ?? []) as InviteRow[]) {
      let userId: string | null = null;
      try {
        const { data, error: inviteError } = await admin.auth.admin.inviteUserByEmail(invite.email, {
          data: { full_name: invite.name, role: "educator" }, redirectTo,
        });
        if (inviteError) {
          const duplicate = /already|registered|exists/i.test(inviteError.message);
          throw new Error(duplicate ? "An account with this email already exists in Auth." : inviteError.message);
        }
        userId = data.user.id;
        const [firstName, ...rest] = invite.name.trim().split(/\s+/);
        const { error: registerError } = await admin.rpc("register_educator", {
          p_user_id: userId,
          p: {
            firstName, lastName: rest.join(" "), email: invite.email, phone: invite.phone ?? "",
            qualification: invite.qualification, yearsExperience: invite.years_experience,
            subjects: invite.subjects ?? [], bulk: rows.length > 1,
          },
        });
        if (registerError) throw registerError;
        await admin.from("educator_invites").update({ status: "sent", user_id: userId, sent_at: new Date().toISOString(), error: null }).eq("id", invite.id);
        results.push({ email: invite.email, status: "sent", user_id: userId });
      } catch (rowError) {
        if (userId) await admin.auth.admin.deleteUser(userId).catch(() => undefined);   // no auth user without a profile
        await admin.from("educator_invites").update({ status: "failed", error: message(rowError) }).eq("id", invite.id);
        results.push({ email: invite.email, status: "failed", error: message(rowError) });
      }
    }
    return json({
      created: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      failed: results.filter((r) => r.status === "failed").length,
      results,
    });
  } catch (error) { return fail(error); }
});
