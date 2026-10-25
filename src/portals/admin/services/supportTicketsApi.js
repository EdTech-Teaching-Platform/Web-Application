import { callRpc, listResult } from "./adminApi";

// Lead support_tickets (D11). No page uses this yet: /admin/supporttickets
// shows callback requests; a tickets tab is listed in docs/ADMIN_BACKEND_TODO.md.
export const supportTicketsApi = {
  stats: () => callRpc("get_support_ticket_stats"),
  list: async (f = {}) => listResult(await callRpc("list_support_tickets", {
    p_search: f.search || null, p_status: f.status && f.status !== "all" ? f.status : null,
    p_category: f.category && f.category !== "all" ? f.category : null,
    p_priority: f.priority && f.priority !== "all" ? f.priority : null,
    p_assigned_to: f.assignedTo || null, p_sort: f.sort || "newest", p_page: f.page || 1, p_size: f.size || 10,
  })),
  get: (id) => callRpc("get_support_ticket", { p_id: id }),
  setStatus: (id, status, note) => callRpc("set_support_ticket_status", { p_id: id, p_status: status, p_note: note || null }),
  setPriority: (id, priority) => callRpc("set_support_ticket_priority", { p_id: id, p_priority: priority }),
  assign: (id, adminId) => callRpc("assign_support_ticket", { p_id: id, p_admin_id: adminId || null }),
  reply: (id, content, internal = false) => callRpc("reply_support_ticket", { p_id: id, p_content: content, p_internal: internal }),
};
