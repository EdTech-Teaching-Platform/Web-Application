import { callRpc, listResult } from "./adminApi";
import { invokeFunction } from "../../../services/edgeFunctions";
import { mapDeletionRequest } from "../../../services/accountDeletionApi";

// Admin side of delete-account requests (QA #21, 20261111090000).
export const accountDeletionsApi = {
  list: async ({ status = "pending", search = "", page = 1, size = 8 } = {}) => {
    const result = listResult(await callRpc("list_account_deletion_requests", {
      p_status: status, p_search: search.trim() || null, p_page: page, p_size: size,
    }));
    return { ...result, rows: result.rows.map(mapDeletionRequest) };
  },
  // Approving blocks the account in SQL; the Auth-level ban follows (set-user-ban).
  resolve: async (id, decision, note) => mapDeletionRequest(await callRpc("resolve_account_deletion_request", {
    p_id: id, p_decision: decision, p_note: note?.trim() || null,
  })),
  ban: (userId, reason) => invokeFunction("set-user-ban", { userId, ban: true, reason: reason || null }),
};

export default accountDeletionsApi;
