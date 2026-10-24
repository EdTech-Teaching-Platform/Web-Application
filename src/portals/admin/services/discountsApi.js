import { callRpc, listResult } from "./adminApi";

export const discountsApi = {
  list: async (filters = {}) => listResult(await callRpc("list_discounts", {
    p_search: filters.search || null, p_status: filters.status === "all" ? null : filters.status || null,
    p_offer_type: filters.offerType === "all" ? null : filters.offerType || null,
    p_value_min: filters.valueMin ?? null, p_value_max: filters.valueMax ?? null,
    p_sort: filters.sort || "created_desc", p_page: filters.page || 1, p_size: filters.size || 8,
  })),
  stats: () => callRpc("get_discount_stats"),
  get: (id) => callRpc("get_discount", { p_id: id }),
  analytics: (from, to) => callRpc("get_discount_analytics", { p_from: from, p_to: to }),
  create: (p) => callRpc("create_discount", {
    p_name: p.name, p_coupon_code: p.couponCode, p_offer_type: p.offerType, p_value: p.value,
    p_max_discount_inr: p.maxDiscount ?? null, p_min_purchase_inr: p.minPurchase ?? 0,
    p_usage_limit: p.usageLimit ?? null, p_per_user_limit: p.perUserLimit ?? 1,
    p_starts_at: p.startsAt || null, p_expires_at: p.expiresAt || null, p_scope: p.scope || "all_test_series",
    p_series_ids: p.seriesIds || [], p_description: p.description || null, p_activate: p.activate !== false,
  }),
  update: (id, patch) => callRpc("update_discount", { p_id: id, p_patch: patch }),
  status: (id, action, note) => callRpc("set_discount_status", { p_id: id, p_action: action, p_note: note || null }),
  history: async (filters = {}) => listResult(await callRpc("list_discount_history", {
    p_search: filters.search || null, p_event_type: filters.eventType || null, p_discount_id: filters.discountId || null,
    p_from: filters.from || null, p_to: filters.to || null, p_page: filters.page || 1, p_size: filters.size || 10,
  })),
  exportRedemptions: (from, to) => callRpc("export_discount_redemptions", { p_from: from || null, p_to: to || null }),
};
