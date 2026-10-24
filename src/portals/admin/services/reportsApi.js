import { callRpc } from "./adminApi";

export const reportsApi = {
  options: () => callRpc("get_report_builder_options"),
  filters: (type) => callRpc("get_report_filter_options", { p_type: type || null }),
  generate: (type, range, filters, preview = 100) => callRpc("generate_report", {
    p_type: type, p_range: range, p_filters: filters || {}, p_preview: preview,
  }),
  run: (id, page = 1, size = 50) => callRpc("get_report_run", { p_run_id: id, p_page: page, p_size: size }),
  exportCsv: (id) => callRpc("export_report_csv", { p_run_id: id }),
};
