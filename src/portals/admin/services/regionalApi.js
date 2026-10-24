import { callRpc, listResult } from "./adminApi";

const range = (filters) => ({
  p_range: filters.range || "last_30_days",
  p_from: filters.from || null,
  p_to: filters.to || null,
});

export const regionalApi = {
  summary: (filters) => callRpc("get_regional_summary", range(filters)),
  trend: (filters) => callRpc("get_regional_trend", { ...range(filters), p_state_code: filters.state || null }),
  byRegion: (filters, limit = 10) => callRpc("get_revenue_by_region", { ...range(filters), p_limit: limit }),
  comparison: async (filters) => listResult(await callRpc("list_region_comparison", {
    ...range(filters), p_search: filters.search || null, p_sort: filters.sort || "revenue_desc",
    p_page: filters.page || 1, p_size: filters.size || 8,
  })),
  filterOptions: () => callRpc("get_regional_filter_options"),
};
