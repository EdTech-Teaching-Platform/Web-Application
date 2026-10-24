import { supabase } from "../../../services/supabaseClient";
import { callRpc, listResult, normalizeRpcError } from "./adminApi";

export const securityApi = {
  sessions: async () => {
    const { data, error } = await supabase.from("user_sessions")
      .select("session_id,user_id,role,user_agent,started_at,last_seen_at,ended_at,end_reason")
      .is("ended_at", null).order("last_seen_at", { ascending: false });
    if (error) throw normalizeRpcError(error);
    return data || [];
  },
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
