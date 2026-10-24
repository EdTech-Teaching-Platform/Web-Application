import { clients, fail, json, options } from "../_shared/auth.ts";
const emailUrl = () => Deno.env.get("EMAIL_PROVIDER_URL");
Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const expected = Deno.env.get("EMAIL_CRON_SECRET");
    if (!expected || req.headers.get("x-cron-secret") !== expected) return json({ error: "Unauthorized" }, 401);
    const { admin } = clients(req);
    const { data: rows, error } = await admin.from("notification_recipients").select("id,user_id,notification_id,profiles(email),notifications(title,body)").eq("email_status", "queued").limit(100);
    if (error) throw error;
    const sent = [];
    for (const row of rows ?? []) {
      try {
        if (!emailUrl()) throw new Error("EMAIL_PROVIDER_URL is not configured");
        const response = await fetch(emailUrl()!, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("EMAIL_PROVIDER_KEY") ?? ""}` }, body: JSON.stringify({ to: row.profiles?.email, subject: row.notifications?.title, text: row.notifications?.body }) });
        if (!response.ok) throw new Error(`Email provider returned ${response.status}`);
        await admin.from("notification_recipients").update({ email_status: "sent", email_sent_at: new Date().toISOString(), email_error: null }).eq("id", row.id);
        sent.push(row.id);
      } catch (error) {
        await admin.from("notification_recipients").update({ email_status: "failed", email_error: String(error) }).eq("id", row.id);
      }
    }
    return json({ processed: rows?.length ?? 0, sent: sent.length });
  } catch (error) { return fail(error); }
});
