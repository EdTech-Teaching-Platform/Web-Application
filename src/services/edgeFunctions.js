import { supabase } from "./supabaseClient";

// supabase.functions.invoke, with the function's own error surfaced. On a
// non-2xx answer supabase-js only says "Edge Function returned a non-2xx
// status code"; the real reason ({ error } in the body) is read here, with the
// HTTP status (404 = no such document, or the function isn't deployed;
// 401 / 403 = not allowed).
export async function invokeFunction(name, body, client = supabase) {
  const { data, error } = await client.functions.invoke(name, { body });
  if (!error) return data;
  let payload = null;
  try { payload = await error.context?.json?.(); } catch { payload = null; }
  const status = error.context?.status;
  let message = payload?.error || error.message || "The request failed.";
  if (!payload?.error && status === 404) message = `The ${name} function isn't available (not deployed?).`;
  if (error.name === "FunctionsFetchError") message = "Can't reach the server. Check your connection and try again.";
  const wrapped = new Error(message);
  wrapped.status = status;
  wrapped.code = payload?.code;
  wrapped.field = payload?.field;
  wrapped.retryAfterSeconds = payload?.retryAfterSeconds;
  throw wrapped;
}
