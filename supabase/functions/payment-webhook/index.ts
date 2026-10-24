import { clients, fail, hmacValid, json, options } from "../_shared/auth.ts";
Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const body = await req.text();
    if (!(await hmacValid(req, body, "PAYMENT_WEBHOOK_SECRET"))) return json({ error: "Invalid signature" }, 401);
    const event = JSON.parse(body); const payment = event.payment ?? event.payload?.payment ?? event;
    const { admin } = clients(req);
    const paymentId = payment.payment_id ?? payment.id; const gatewayPaymentId = payment.gateway_payment_id ?? payment.entity?.id;
    if (!paymentId) throw new Error("payment_id is required");
    if (event.type?.includes("refund")) {
      const { error } = await admin.rpc("mark_payment_refunded", { p_payment_id: paymentId, p_amount: payment.amount, p_reason: event.type });
      if (error) throw error;
    } else if (event.type?.includes("captur") || event.status === "paid") {
      const { error } = await admin.rpc("mark_payment_paid", { p_payment_id: paymentId, p_gateway_payment_id: gatewayPaymentId, p_paid_at: new Date().toISOString(), p_method: payment.method ?? "online", p_platform_fee_inr: payment.platform_fee_inr ?? 0 });
      if (error) throw error;
    }
    return json({ received: true });
  } catch (error) { return fail(error); }
});
