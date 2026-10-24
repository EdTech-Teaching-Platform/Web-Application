import { callRpc, listResult } from "./adminApi";

const args = (f = {}) => ({
  p_search: f.search || null, p_from: f.from || null, p_to: f.to || null,
  p_educator_id: f.educatorId || null, p_series_id: f.seriesId || null,
  p_min_amount: f.minAmount ?? null, p_max_amount: f.maxAmount ?? null,
  p_method: f.method && f.method !== "all" ? f.method : null,
});
export const transactionsApi = {
  list: async (f = {}) => listResult(await callRpc("list_transactions", { ...args(f), p_sort: f.sort || "newest", p_page: f.page || 1, p_size: f.size || 10 })),
  stats: (f = {}) => callRpc("get_transaction_stats", args(f)),
  filters: () => callRpc("get_transaction_filter_options"),
  get: (id) => callRpc("get_transaction", { p_id: id }),
  export: (f = {}) => callRpc("export_transactions", { ...args(f), p_sort: f.sort || "newest" }),
  markPaid: (id, gateway) => callRpc("mark_payment_paid", { p_payment_id: id, p_gateway_payment_id: gateway || null }),
  markRefunded: (id, amount, reason) => callRpc("mark_payment_refunded", { p_payment_id: id, p_amount: amount ?? null, p_reason: reason || null }),
};
