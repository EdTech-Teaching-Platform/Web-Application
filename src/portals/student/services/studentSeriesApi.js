import { callRpc } from "./studentRpc";

// Test series RPCs (docs/STUDENT_RPC_CONTRACT.md). publicList / publicGet are
// the only ones anon may call (landing page, public series pages).
export const studentSeriesApi = {
  publicList: (limit = 6) => callRpc("public_list_series", { p_limit: limit }),
  publicGet: (seriesId) => callRpc("public_get_series", { p_series_id: seriesId }),
  list: ({ search = null, category = null, page = 1, size = 12 } = {}) =>
    callRpc("student_list_series", {
      p_search: search || null,
      p_category: category || null,
      p_page: page,
      p_size: size,
    }),
  get: (seriesId) => callRpc("student_get_series", { p_series_id: seriesId }),
  enroll: (seriesId) => callRpc("student_enroll", { p_series_id: seriesId }),
  mySeries: () => callRpc("student_my_series"),
  history: ({ page = 1, size = 20 } = {}) => callRpc("student_my_history", { p_page: page, p_size: size }),
  stats: () => callRpc("student_get_stats"),
  dashboard: () => callRpc("student_dashboard"),
};

export default studentSeriesApi;
