import { supabase } from "../../../services/supabaseClient";

// Same normalization as src/portals/admin/services/adminApi.js: every
// rejection is an Error with the server message plus `code` (SQLSTATE) and
// `details`. The PostgREST builder is awaited, never chained with .catch
// (it is only thenable). Codes: docs/STUDENT_RPC_CONTRACT.md "Errors".
export function normalizeRpcError(error) {
  const offline = /failed to fetch|network|load failed/i.test(error?.message ?? "");
  const normalized = new Error(
    offline ? "Can't reach the server. Check your connection and try again." : error?.message || "The request failed."
  );
  normalized.code = offline ? "network" : error?.code;
  normalized.details = error?.details;
  return normalized;
}

export async function callRpc(name, params = {}) {
  let result;
  try {
    result = await supabase.rpc(name, params);
  } catch (error) {
    throw normalizeRpcError(error);
  }
  if (result.error) throw normalizeRpcError(result.error);
  return result.data;
}

export const isAuthError = (error) => error?.code === "42501";
export const isNotFound = (error) => error?.code === "P0002";
export const isRuleError = (error) => error?.code === "P0001";
export const isNotAvailable = (error) => error?.code === "0A000";
