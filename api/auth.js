// /api/auth/<action>: sign-in for the HttpOnly-cookie session (VITE_AUTH_MODE=cookie).
// vercel.json rewrites /api/auth/:action to /api/auth?__action=:action.
//   POST login    {email, password}               -> {user, expires_at} + cookies
//   POST signup   {email, password, data, next}   -> {user, session|null}
//   POST logout   {scope: local|global|others}    -> {ok} and the cookies are cleared
//   GET  session                                  -> {user|null, expires_at, state}
//   POST recover  {email, next}                   -> {ok} (the same whether or not the email exists)
//   POST user     {password?, data?}              -> {user}
//   GET  oauth    ?provider=google&next=/path     -> 302 to Google (PKCE)
//   GET  callback ?code=..&next=/path&type=..     -> exchanges the code, sets cookies, 302 to next
// Tokens never appear in a response body. POSTs need our client header and a
// same-site Origin (http.js sameOriginProblem).
import {
  PKCE_COOKIE, clearCookie, isSecureRequest, json, parseCookies, redirect, safePath, sameOriginProblem, serializeCookie, siteOrigin,
} from "./_lib/http.js";
import {
  authEnv, authError, authRequest, challengeFor, clearSessionCookies, ensureSession, newVerifier, publicSession, sessionCookies,
} from "./_lib/gotrue.js";

const PROVIDERS = new Set(["google"]);
const EMAIL_LINK_AGE = 24 * 60 * 60;   // confirmation / reset links are valid for a day
const OAUTH_AGE = 10 * 60;

function actionOf(request) {
  const url = new URL(request.url);
  return url.searchParams.get("__action") || url.pathname.replace(/\/+$/, "").split("/").pop();
}

async function readJson(request) {
  try { return await request.json(); } catch { return {}; }
}

function fail(res) {
  return json({ error: authError(res.status, res.data) }, res.status >= 400 && res.status < 600 ? res.status : 400);
}

function callbackUrl(request, next, type) {
  const u = new URL("/api/auth/callback", siteOrigin(request));
  u.searchParams.set("next", safePath(next, "/"));
  if (type) u.searchParams.set("type", type);
  return u.toString();
}

async function pkcePair(request, maxAge) {
  const verifier = newVerifier();
  return {
    challenge: await challengeFor(verifier),
    cookie: serializeCookie(PKCE_COOKIE, verifier, { maxAge, path: "/api/auth", secure: isSecureRequest(request) }),
  };
}

function withQuery(path, params) {
  const u = new URL(path, "http://x");
  for (const [k, v] of Object.entries(params)) if (v != null && v !== "") u.searchParams.set(k, v);
  return `${u.pathname}${u.search}`;
}

export async function handleAuth(request, { env, fetchImpl } = {}) {
  const action = actionOf(request);
  const opts = { request, env, fetchImpl };
  const csrf = sameOriginProblem(request);
  if (csrf) return json({ error: { message: csrf, status: 403 } }, 403);

  if (action === "login" && request.method === "POST") {
    const { email, password } = await readJson(request);
    if (!email || !password) return json({ error: { message: "Enter your email and password.", status: 400 } }, 400);
    const res = await authRequest("/token?grant_type=password", { ...opts, method: "POST", body: { email: String(email).trim(), password: String(password) } });
    if (!res.ok || !res.data?.access_token) return fail(res);
    return json(publicSession(res.data), 200, { cookies: sessionCookies(res.data, request) });
  }

  if (action === "signup" && request.method === "POST") {
    const { email, password, data, next } = await readJson(request);
    if (!email || !password) return json({ error: { message: "Enter your email and a password.", status: 400 } }, 400);
    const pkce = await pkcePair(request, EMAIL_LINK_AGE);
    const res = await authRequest(`/signup?redirect_to=${encodeURIComponent(callbackUrl(request, next || "/auth/callback", "signup"))}`, {
      ...opts, method: "POST",
      body: { email: String(email).trim(), password: String(password), data: data && typeof data === "object" ? data : {},
              code_challenge: pkce.challenge, code_challenge_method: "s256" },
    });
    if (!res.ok) return fail(res);
    if (res.data?.access_token) {   // email confirmation off: signed in now
      return json({ user: res.data.user, session: publicSession(res.data) }, 200, { cookies: sessionCookies(res.data, request) });
    }
    return json({ user: res.data?.user ?? res.data, session: null }, 200, { cookies: [pkce.cookie] });
  }

  if (action === "logout" && request.method === "POST") {
    const { scope } = await readJson(request);
    const s = await ensureSession(request, opts);
    if (s.accessToken) {
      const sc = ["global", "others"].includes(scope) ? scope : "local";
      const res = await authRequest(`/logout?scope=${sc}`, { ...opts, method: "POST", accessToken: s.accessToken });
      if (!res.ok && res.status !== 401 && sc !== "local") return fail(res);
    }
    return json({ ok: true }, 200, { cookies: [...clearSessionCookies(request), clearCookie(PKCE_COOKIE, { path: "/api/auth", secure: isSecureRequest(request) })] });
  }

  if (action === "session" && request.method === "GET") {
    const s = await ensureSession(request, opts);
    if (!s.accessToken) return json({ user: null, expires_at: null, state: s.state }, 200, { cookies: s.cookies });
    const res = await authRequest("/user", { ...opts, accessToken: s.accessToken });
    if (res.status === 401 || res.status === 403) {
      return json({ user: null, expires_at: null, state: "expired" }, 200, { cookies: clearSessionCookies(request) });
    }
    if (!res.ok) return json({ error: authError(res.status, res.data) }, 503, { cookies: s.cookies });
    const expiresAt = s.tokens ? publicSession(s.tokens).expires_at : publicSession({ access_token: s.accessToken }).expires_at;
    return json({ user: res.data, expires_at: expiresAt, state: s.state }, 200, { cookies: s.cookies });
  }

  if (action === "recover" && request.method === "POST") {
    const { email, next } = await readJson(request);
    if (!email) return json({ error: { message: "Enter your email address.", status: 400 } }, 400);
    const pkce = await pkcePair(request, EMAIL_LINK_AGE);
    const res = await authRequest(`/recover?redirect_to=${encodeURIComponent(callbackUrl(request, next || "/reset-password", "recovery"))}`, {
      ...opts, method: "POST", body: { email: String(email).trim(), code_challenge: pkce.challenge, code_challenge_method: "s256" },
    });
    if (!res.ok) return fail(res);
    return json({ ok: true }, 200, { cookies: [pkce.cookie] });
  }

  if (action === "user" && request.method === "POST") {
    const { password, data } = await readJson(request);
    const s = await ensureSession(request, opts);
    if (!s.accessToken) return json({ error: { message: "Your session has expired. Please sign in again.", status: 401 } }, 401, { cookies: s.cookies });
    const body = {};
    if (password) body.password = String(password);
    if (data && typeof data === "object") body.data = data;
    const res = await authRequest("/user", { ...opts, method: "PUT", body, accessToken: s.accessToken });
    if (!res.ok) return fail(res);
    return json({ user: res.data }, 200, { cookies: s.cookies });
  }

  if (action === "oauth" && request.method === "GET") {
    const url = new URL(request.url);
    const provider = url.searchParams.get("provider");
    if (!PROVIDERS.has(provider)) return json({ error: { message: "Unsupported provider.", status: 400 } }, 400);
    const pkce = await pkcePair(request, OAUTH_AGE);
    const { url: base } = authEnv(env);
    const target = new URL(`${base}/auth/v1/authorize`);
    target.searchParams.set("provider", provider);
    target.searchParams.set("redirect_to", callbackUrl(request, url.searchParams.get("next") || "/auth/callback"));
    target.searchParams.set("code_challenge", pkce.challenge);
    target.searchParams.set("code_challenge_method", "s256");
    return redirect(target.toString(), { cookies: [pkce.cookie] });
  }

  if (action === "callback" && request.method === "GET") {
    const url = new URL(request.url);
    const type = url.searchParams.get("type") || "";
    const next = safePath(url.searchParams.get("next"), type === "recovery" ? "/reset-password" : "/auth/callback");
    const clearPkce = clearCookie(PKCE_COOKIE, { path: "/api/auth", secure: isSecureRequest(request) });
    const err = url.searchParams.get("error_description") || url.searchParams.get("error");
    if (err) {
      return redirect(withQuery(next, { error: url.searchParams.get("error") || "access_denied", error_code: url.searchParams.get("error_code"), error_description: err }), { cookies: [clearPkce] });
    }
    const code = url.searchParams.get("code");
    const verifier = parseCookies(request.headers.get("cookie"))[PKCE_COOKIE];
    if (!code || !verifier) {
      // Opened on another device / browser: the email is confirmed by Supabase, but no session here.
      return redirect(type === "signup" ? "/login?notice=email_confirmed"
        : withQuery(next, { error: "invalid_request", error_description: "This link must be opened in the browser where you asked for it. Please request a new one." }), { cookies: [clearPkce] });
    }
    const res = await authRequest("/token?grant_type=pkce", { ...opts, method: "POST", body: { auth_code: code, code_verifier: verifier } });
    if (!res.ok || !res.data?.access_token) {
      const e = authError(res.status, res.data);
      return redirect(withQuery(next, { error: "invalid_grant", error_code: e.code, error_description: e.message }), { cookies: [clearPkce] });
    }
    const dest = type === "recovery" ? withQuery(next, { ul_recovery: "1" }) : next;
    return redirect(dest, { cookies: [...sessionCookies(res.data, request), clearPkce] });
  }

  return json({ error: { message: "Not found.", status: 404 } }, 404);
}

export async function GET(request) { return handleAuth(request); }
export async function POST(request) { return handleAuth(request); }
