import { callRpc } from "./adminApi";
export const financialApi = {
  summary: (range = "last_30_days", from, to) => callRpc("get_financial_summary", { p_range: range, p_from: from || null, p_to: to || null }),
  trend: (range = "last_30_days", from, to, granularity = "auto") => callRpc("get_revenue_trend", { p_range: range, p_from: from || null, p_to: to || null, p_granularity: granularity }),
  analytics: (range = "last_30_days", from, to) => callRpc("get_financial_analytics", { p_range: range, p_from: from || null, p_to: to || null }),
  ranges: () => callRpc("get_financial_range_options"),
};
