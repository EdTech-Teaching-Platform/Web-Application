// Sends queued campaign emails (D10) through Resend, then records results with
// record_email_results(). Server-to-server only: call with the service-role
// key as the bearer token (cron / scheduler), or with x-cron-secret.
// Re-checks the lead's notification_preferences.email at send time: users who
// opted out since the campaign was published are marked not_requested.
// Env: RESEND_API_KEY, EMAIL_FROM (e.g. "Universal Learning <noreply@example.com>"),
//      optional EMAIL_CRON_SECRET, EMAIL_BATCH_SIZE (default 100).
import { clients, fail, json, options, requireServiceRole } from "../_shared/auth.ts";

type Row = {
  id: string; user_id: string; campaign_id: string;
  profiles: { email: string | null } | null;
  notification_campaigns: { title: string; body: string; category: string } | null;
};

const leadCategory = (category: string) => (category === "announcement" ? "announcement" : "system");

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const cronSecret = Deno.env.get("EMAIL_CRON_SECRET");
    if (!(cronSecret && req.headers.get("x-cron-secret") === cronSecret)) requireServiceRole(req);
    const apiKey = Deno.env.get("RESEND_API_KEY");
    const from = Deno.env.get("EMAIL_FROM");
    if (!apiKey || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured");
    const { admin } = clients(req);

    const { data, error } = await admin.from("notification_recipients")
      .select("id,user_id,campaign_id,profiles(email),notification_campaigns(title,body,category)")
      .eq("email_status", "queued")
      .limit(Number(Deno.env.get("EMAIL_BATCH_SIZE") ?? 100));
    if (error) throw error;
    const rows = (data ?? []) as unknown as Row[];

    // Email preference (missing row = default true).
    const { data: prefs, error: prefError } = rows.length
      ? await admin.from("notification_preferences").select("user_id,category,email")
          .in("user_id", [...new Set(rows.map((r) => r.user_id))]).eq("email", false)
      : { data: [], error: null };
    if (prefError) throw prefError;
    const optedOut = new Set((prefs ?? []).map((p) => `${p.user_id}:${p.category}`));

    const byCampaign = new Map<string, Array<{ user_id: string; ok: boolean; error: string | null }>>();
    let sent = 0;
    let skipped = 0;
    for (const row of rows) {
      const campaign = row.notification_campaigns;
      if (!campaign) continue;
      if (optedOut.has(`${row.user_id}:${leadCategory(campaign.category)}`) || !row.profiles?.email) {
        await admin.from("notification_recipients")
          .update({ email_status: "not_requested", email_error: row.profiles?.email ? "Opted out of email" : "No email address" })
          .eq("id", row.id);
        skipped++;
        continue;
      }
      let result: { user_id: string; ok: boolean; error: string | null };
      try {
        const response = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
          body: JSON.stringify({ from, to: [row.profiles.email], subject: campaign.title, text: campaign.body }),
        });
        if (!response.ok) throw new Error(`Resend returned ${response.status}: ${await response.text()}`);
        result = { user_id: row.user_id, ok: true, error: null };
        sent++;
      } catch (sendError) {
        result = { user_id: row.user_id, ok: false, error: String(sendError instanceof Error ? sendError.message : sendError).slice(0, 500) };
      }
      byCampaign.set(row.campaign_id, [...(byCampaign.get(row.campaign_id) ?? []), result]);
    }

    for (const [campaignId, results] of byCampaign) {
      const { error: recordError } = await admin.rpc("record_email_results", { p_notification_id: campaignId, p_results: results });
      if (recordError) throw recordError;
    }
    return json({ processed: rows.length, sent, skipped, failed: rows.length - sent - skipped });
  } catch (error) { return fail(error); }
});
