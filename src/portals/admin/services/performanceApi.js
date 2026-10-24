import { callRpc } from "./adminApi";

const params = (filters) => ({
  p_series: filters.series === "all" ? null : filters.series || null,
  p_subject: filters.subject === "all" ? null : filters.subject || null,
  p_test: filters.test === "all" ? null : filters.test || null,
  p_educator: filters.educator === "all" ? null : filters.educator || null,
  p_from: filters.from || null,
  p_to: filters.to || null,
});

export const performanceApi = {
  filterOptions: (series) => callRpc("get_tpa_filter_options", { p_series: series === "all" ? null : series || null }),
  summary: (filters) => callRpc("get_tpa_summary", params(filters)),
  subjectScores: (filters) => callRpc("get_tpa_subject_scores", params(filters)),
  engagement: (filters) => callRpc("get_tpa_series_engagement", params(filters)),
  comparison: (filters) => callRpc("get_tpa_test_comparison", params(filters)),
  leaderboard: (series, from, to) => callRpc("get_tpa_leaderboard", {
    p_series: series === "all" ? null : series || null,
    p_from: from || null,
    p_to: to || null,
    p_limit: 10,
  }),
  exportRows: (filters) => callRpc("export_tpa_rows", params(filters)),
  logExport: (filters, rows) => callRpc("log_export", { p_page: "test-performance-analytics", p_filters: filters, p_rows: rows }),
};
