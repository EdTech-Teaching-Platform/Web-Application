import { createClient } from "@supabase/supabase-js";
import { cookieFetch, createCookieAuth } from "./cookieAuth";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error("VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are required.");
}

// VITE_AUTH_MODE=cookie: the session lives in HttpOnly cookies set by our
// server (api/auth.js) and every call goes through our proxy (api/sb.js),
// which adds the token. supabase.auth is replaced by createCookieAuth (same
// methods). Anything else: the standard browser session (localStorage), as
// before. Flip the variable to switch; no code change needed.
export const COOKIE_AUTH = import.meta.env.VITE_AUTH_MODE === "cookie" && typeof window !== "undefined";

function createCookieModeClient() {
  const auth = createCookieAuth();
  const client = createClient(`${window.location.origin}/api/sb/`, supabaseAnonKey, {
    accessToken: async () => null,   // the proxy adds the user's token; supabase-js's own auth is off
    global: { fetch: cookieFetch(auth) },
  });
  client.auth = auth;
  return client;
}

export const supabase = COOKIE_AUTH
  ? createCookieModeClient()
  : createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
