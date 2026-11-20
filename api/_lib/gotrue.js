// Supabase Auth (GoTrue) from the server, for the HttpOnly-cookie session.
// The browser never sees an access or refresh token: api/auth.js keeps them
// in HttpOnly cookies and api/sb.js adds the access token to every call.
//
// Environment (Vercel project settings):
//   SUPABASE_URL / SUPABASE_ANON_KEY   (fall back to VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY)
//   SUPABASE_SECRET_KEY                optional, a NEW-style secret key (sb_secret_...).
//       With it, Auth requests carry the user's IP in sb-forwarded-for, so
//       Supabase's per-IP rate limits apply per user, not to Vercel's IPs.
//       Needs security_sb_forwarded_for_enabled on the project. Only used for
//       /auth/v1 calls; database calls always use the anon key + user token.
import {
  ACCESS_COOKIE, REFRESH_COOKIE, REFRESH_MAX_AGE, clearCookie, clientIp, isSecureRequest, parseCookies, serializeCookie,
} from "./http.js";

export function authEnv(env = process.env) {
  const url = String(env.SUPABASE_URL || env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
  const anonKey = env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
  const secret = env.SUPABASE_SECRET_KEY || "";
  // Never a legacy service_role JWT here: it bypasses RLS and can't forward IPs anyway.
  const secretKey = secret.startsWith("sb_secret_") ? secret : "";
  if (!url || !anonKey) throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY must be set for the server.");
  return { url, anonKey, secretKey };
}

const isJwt = (key) => /^eyJ/.test(key);

// One call to /auth/v1. Returns {ok, status, data}.
export async function authRequest(path, { method = "GET", body, accessToken, request, env, fetchImpl = fetch } = {}) {
  const { url, anonKey, secretKey } = authEnv(env);
  const key = secretKey || anonKey;
  const headers = { apikey: key, "Content-Type": "application/json", "X-Client-Info": "ul-server/1" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  else if (isJwt(key)) headers.Authorization = `Bearer ${key}`;   // legacy anon key; new keys never go as a bearer
  if (secretKey && request) {
    const ip = clientIp(request);
    if (ip) headers["sb-forwarded-for"] = ip;
  }
  let res;
  try {
    res = await fetchImpl(`${url}/auth/v1${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    return { ok: false, status: 503, data: { msg: "Can't reach the sign-in service." } };
  }
  let data = null;
  try { data = await res.json(); } catch { data = null; }
  return { ok: res.ok, status: res.status, data };
}

// GoTrue error bodies vary ({msg}, {message}, {error_description}); one shape for the browser.
export function authError(status, data) {
  const message = data?.msg || data?.message || data?.error_description || data?.error || "Something went wrong. Please try again.";
  return { message: String(message), code: data?.error_code || data?.code || null, status: status || 500 };
}

export function jwtExp(token) {
  try {
    const payload = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = JSON.parse(Buffer.from(payload, "base64").toString("utf8"));
    return typeof json.exp === "number" ? json.exp : 0;
  } catch {
    return 0;
  }
}

export function sessionCookies(tokens, request) {
  const secure = isSecureRequest(request);
  const accessAge = Number(tokens.expires_in) > 0 ? Number(tokens.expires_in) : 3600;
  return [
    serializeCookie(ACCESS_COOKIE, tokens.access_token, { maxAge: accessAge, secure }),
    serializeCookie(REFRESH_COOKIE, tokens.refresh_token, { maxAge: REFRESH_MAX_AGE, secure }),
  ];
}

export function clearSessionCookies(request) {
  const secure = isSecureRequest(request);
  return [clearCookie(ACCESS_COOKIE, { secure }), clearCookie(REFRESH_COOKIE, { secure })];
}

// What the browser may know about the session: the user and when the access
// token expires. No tokens.
export function publicSession(tokens) {
  return { user: tokens.user ?? null, expires_at: tokens.expires_at ?? (jwtExp(tokens.access_token) || null) };
}

// The access token for this request, refreshed when it has (nearly) expired.
//   state: "active" | "refreshed" | "expired" (refresh refused: cookies cleared)
//          | "none" (signed out) | "unavailable" (Auth unreachable: cookies kept)
export async function ensureSession(request, { env, fetchImpl, now = () => Date.now() } = {}) {
  const jar = parseCookies(request.headers.get("cookie"));
  const at = jar[ACCESS_COOKIE];
  const rt = jar[REFRESH_COOKIE];
  if (at && jwtExp(at) - 30 > now() / 1000) return { state: "active", accessToken: at, cookies: [] };
  if (!rt) return at ? { state: "expired", accessToken: null, cookies: clearSessionCookies(request) } : { state: "none", accessToken: null, cookies: [] };
  const res = await authRequest("/token?grant_type=refresh_token", { method: "POST", body: { refresh_token: rt }, request, env, fetchImpl });
  if (res.ok && res.data?.access_token) {
    return { state: "refreshed", accessToken: res.data.access_token, cookies: sessionCookies(res.data, request), tokens: res.data };
  }
  if (res.status >= 500) return { state: "unavailable", accessToken: null, cookies: [] };
  return { state: "expired", accessToken: null, cookies: clearSessionCookies(request) };
}

// ---- PKCE (Google sign-in, email confirmation and password-reset links)
function base64url(bytes) {
  return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export function newVerifier() {
  const bytes = new Uint8Array(48);
  globalThis.crypto.getRandomValues(bytes);
  return base64url(bytes);
}

export async function challengeFor(verifier) {
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}
