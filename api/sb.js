// /api/sb/<path>: the browser's only way to Supabase in cookie mode
// (VITE_AUTH_MODE=cookie). vercel.json rewrites /api/sb/:path* here with
// ?__path=:path*. It forwards database (rest/v1), Edge Function
// (functions/v1) and storage (storage/v1) calls with the anon key and the
// signed-in user's access token from the HttpOnly cookie, refreshing it when
// it has expired. Auth calls never pass through here (api/auth.js does them).
// Whatever the browser sends as Authorization / apikey is ignored.
import { json, parseCookies, sameOriginProblem } from "./_lib/http.js";
import { authEnv, ensureSession } from "./_lib/gotrue.js";

const ALLOWED = /^(rest\/v1|functions\/v1|storage\/v1)(\/|$)/;
const REQUEST_HEADERS = ["accept", "accept-profile", "content-profile", "content-type", "prefer", "range",
  "x-client-info", "x-supabase-api-version", "x-upsert", "x-region"];
const RESPONSE_HEADERS = ["content-type", "content-range", "preference-applied", "content-disposition", "etag", "last-modified",
  "sb-request-id", "x-relay-error"];

export function proxyPath(request) {
  const url = new URL(request.url);
  const raw = url.searchParams.get("__path") ?? url.pathname.replace(/^\/api\/sb\/?/, "");
  const path = raw.replace(/^\/+/, "");
  if (path.includes("..") || /[\\\0]/.test(path) || !ALLOWED.test(path)) return null;
  url.searchParams.delete("__path");
  return { path, search: url.search };
}

export async function handleProxy(request, { env, fetchImpl = fetch } = {}) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204 });   // same-origin only: no CORS headers
  const target = proxyPath(request);
  if (!target) return json({ message: "Not found." }, 404);
  const csrf = sameOriginProblem(request);
  if (csrf) return json({ message: csrf }, 403);

  const { url, anonKey } = authEnv(env);
  const session = await ensureSession(request, { env, fetchImpl });
  const headers = new Headers();
  for (const name of REQUEST_HEADERS) {
    const v = request.headers.get(name);
    if (v) headers.set(name, v);
  }
  headers.set("apikey", anonKey);
  const bearer = session.accessToken || (/^eyJ/.test(anonKey) ? anonKey : null);
  if (bearer) headers.set("Authorization", `Bearer ${bearer}`);

  const init = { method: request.method, headers, redirect: "manual" };
  if (!["GET", "HEAD"].includes(request.method)) init.body = await request.arrayBuffer();

  let upstream;
  try {
    upstream = await fetchImpl(`${url}/${target.path}${target.search}`, init);
  } catch {
    return json({ message: "Can't reach the server. Check your connection and try again." }, 502, { cookies: session.cookies });
  }
  const out = new Headers({ "Cache-Control": "no-store" });
  for (const name of RESPONSE_HEADERS) {
    const v = upstream.headers.get(name);
    if (v) out.set(name, v);
  }
  for (const c of session.cookies) out.append("Set-Cookie", c);
  if (session.state === "expired") out.set("x-ul-session", "expired");
  return new Response(request.method === "HEAD" ? null : upstream.body, { status: upstream.status, headers: out });
}

// Exposed for tests: whether a request carried a session cookie at all.
export function hasSessionCookie(request) {
  const jar = parseCookies(request.headers.get("cookie"));
  return Boolean(jar.ul_at || jar.ul_rt);
}

const handler = (request) => handleProxy(request);
export { handler as GET, handler as POST, handler as PATCH, handler as PUT, handler as DELETE, handler as HEAD, handler as OPTIONS };
