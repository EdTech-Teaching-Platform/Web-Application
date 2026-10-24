import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const { userClient, admin } = clients(req); await requireAdmin(req, userClient);
    const { refundId } = await req.json(); if (!refundId) throw new Error("refundId is required");
    const { data: refund, error } = await admin.from("refund_requests").select("id,amount_inr,payment_id,gateway_refund_id").eq("id", refundId).eq("status", "approved").single();
    if (error) throw error;
    const providerUrl = Deno.env.get("PAYMENT_REFUND_URL");
    if (!providerUrl) throw new Error("PAYMENT_REFUND_URL is not configured");
    const response = await fetch(providerUrl, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${Deno.env.get("PAYMENT_PROVIDER_KEY") ?? ""}` }, body: JSON.stringify({ payment_id: refund.payment_id, amount: refund.amount_inr }) });
    const result = await response.json().catch(() => ({}));
    const ok = response.ok;
    const { error: recordError } = await admin.rpc("record_refund_gateway_result", { p_id: refund.id, p_ok: ok, p_gateway_refund_id: result.id ?? result.refund_id ?? null, p_error: ok ? null : result.error ?? `Provider returned ${response.status}` });
    if (recordError) throw recordError;
    return json({ processed: ok, gateway: result });
  } catch (error) { return fail(error); }
});
