import { supabase } from "../../../services/supabaseClient";
import { callRpc, listResult, normalizeRpcError } from "./adminApi";

export const securityApi = {
  sessions: () => callRpc("list_active_sessions"),
  revoke: async (id) => {
    const { data, error } = await supabase.functions.invoke("revoke-user-sessions", { body: { userId: id, reason: "admin_action" } });
    if (error) throw normalizeRpcError(error);
    return data;
  },
  signOutOtherDevices: () => callRpc("sign_out_other_devices"),
  events: async ({ userId = null, event = "all", page = 1, size = 20 }) =>
    listResult(await callRpc("list_auth_events", { p_user_id: userId, p_event: event, p_page: page, p_size: size })),
  updatePassword: async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw normalizeRpcError(error);
  },
};
