import { supabase } from "../../../services/supabaseClient";
import { callRpc, listResult, normalizeRpcError } from "./adminApi";
export const refundsApi = {
  pending: async (page = 1, size = 20) => listResult(await callRpc("list_pending_refunds", { p_page: page, p_size: size })),
  history: async (f = {}) => listResult(await callRpc("list_refund_history", { p_status: f.status || null, p_from: f.from || null, p_to: f.to || null, p_page: f.page || 1, p_size: f.size || 10 })),
  stats: () => callRpc("get_refund_stats"),
  export: (f = {}) => callRpc("export_refunds", { p_status: f.status || null, p_from: f.from || null, p_to: f.to || null }),
  request: (paymentId, reasonCode, reasonText, amount) => callRpc("request_refund", { p_payment_id: paymentId, p_reason_code: reasonCode, p_reason_text: reasonText || null, p_amount: amount ?? null }),
  approve: (id, note) => callRpc("approve_refund", { p_id: id, p_note: note || null }),
  process: async (id) => {
    const { data, error } = await supabase.functions.invoke("process-refund", { body: { refundId: id } });
    if (error) throw normalizeRpcError(error);
    return data;
  },
  reject: (id, note) => callRpc("reject_refund", { p_id: id, p_note: note }),
};
