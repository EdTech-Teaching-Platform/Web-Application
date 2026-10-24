import { supabase } from "../../../services/supabaseClient";

export function normalizeRpcError(error) {
  const normalized = new Error(error?.message || "The admin request failed.");
  normalized.code = error?.code;
  normalized.details = error?.details;
  return normalized;
}

export async function callRpc(name, params = {}) {
  const { data, error } = await supabase.rpc(name, params);
  if (error) throw normalizeRpcError(error);
  return data;
}

export function listResult(data) {
  const rows = Array.isArray(data) ? data : [];
  return { rows: rows.map((row) => row.row_data), total: rows[0]?.total_count ?? 0 };
}

export const dashboardApi = {
  getDashboard: () => callRpc("get_admin_dashboard"),
  getNavigation: () => callRpc("get_admin_nav"),
  search: (query, limit = 5) => callRpc("global_search", { p_q: query, p_limit: limit }),
  listNotes: () => callRpc("list_my_notes"),
  addNote: (text) => callRpc("add_admin_note", { p_text: text }),
  toggleNote: (id, isDone) => callRpc("toggle_admin_note", { p_id: id, p_done: isDone }),
  updateNote: (id, text) => callRpc("update_admin_note", { p_id: id, p_text: text }),
  deleteNote: (id) => callRpc("delete_admin_note", { p_id: id }),
  clearDoneNotes: () => callRpc("clear_done_notes"),
};

export const studentsApi = {
  byRegion: (limit) => callRpc("get_students_by_region", { p_limit: limit }),
};

export const educatorsApi = {
  list: async (params) => listResult(await callRpc("list_educators", params)),
  detail: (id) => callRpc("get_educator_detail", { p_educator_id: id }),
  setVerification: (id, status, note) =>
    callRpc("set_educator_verification", { p_educator_id: id, p_status: status, p_note: note }),
  setAccountStatus: (id, status) =>
    callRpc("set_educator_account_status", { p_educator_id: id, p_status: status }),
  delete: (id) => callRpc("delete_educator", { p_educator_id: id }),
};
