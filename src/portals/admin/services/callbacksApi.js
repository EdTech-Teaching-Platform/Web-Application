import { callRpc, listResult } from "./adminApi";

export const callbacksApi = {
  stats: () => callRpc("get_callback_stats"),
  filters: () => callRpc("get_callback_filter_options"),
  list: async ({ search = "", status = "all", source = "all", page = 1, size = 8 }) =>
    listResult(await callRpc("list_callback_requests", {
      p_search: search || null, p_status: status, p_source: source,
      p_sort: "newest", p_page: page, p_size: size,
    })),
  detail: (id) => callRpc("get_callback_request", { p_id: id }),
  setStatus: (id, status, note) => callRpc("set_callback_status", { p_id: id, p_status: status, p_note: note || null }),
  addNote: (id, note) => callRpc("add_callback_note", { p_id: id, p_note: note }),
  export: ({ search = "", status = "all", source = "all" }) =>
    callRpc("export_callback_report", { p_search: search || null, p_status: status, p_source: source }),
};
