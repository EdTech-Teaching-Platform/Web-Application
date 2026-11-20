// Small HTTP helpers for the Vercel functions (api/*.js). Web-standard
// Request / Response only, so they run on Vercel and in vitest alike.
// Files under api/_lib are not deployed as functions (leading underscore).

export const ACCESS_COOKIE = "ul_at";
export const REFRESH_COOKIE = "ul_rt";
export const PKCE_COOKIE = "ul_pkce";
export const CLIENT_HEADER = "x-ul-client";
export const REFRESH_MAX_AGE = 30 * 24 * 60 * 60;   // 30 days (Supabase revokes it on logout or reuse)

export function parseCookies(header) {
  const out = {};
  for (const part of String(header || "").split(";")) {
    const i = part.indexOf("=");
    if (i < 1) continue;
    const name = part.slice(0, i).trim();
    const value = part.slice(i + 1).trim();
    try { out[name] = decodeURIComponent(value); } catch { out[name] = value; }
  }
  return out;
}

// HttpOnly + SameSite=Lax always; Secure except on plain-http localhost (dev).
export function serializeCookie(name, value, { maxAge, path = "/api", secure = true } = {}) {
  const parts = [`${name}=${encodeURIComponent(value ?? "")}`, `Path=${path}`, "HttpOnly", "SameSite=Lax"];
  if (secure) parts.push("Secure");
  if (maxAge !== undefined) parts.push(`Max-Age=${Math.max(0, Math.floor(maxAge))}`);
  return parts.join("; ");
}

export function clearCookie(name, { path = "/api", secure = true } = {}) {
  return serializeCookie(name, "", { maxAge: 0, path, secure });
}

export function isSecureRequest(request) {
  const url = new URL(request.url);
  const proto = request.headers.get("x-forwarded-proto") || url.protocol.replace(":", "");
  return !(proto === "http" && /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(url.host));
}

// The user's IP as Vercel sees it (Vercel sets x-real-ip / x-forwarded-for
// itself; a client can't override them at the edge).
export function clientIp(request) {
  const real = request.headers.get("x-real-ip");
  if (real) return real.trim();
  const fwd = request.headers.get("x-forwarded-for");
  return fwd ? fwd.split(",")[0].trim() : "";
}

export function requestHost(request) {
  return request.headers.get("x-forwarded-host") || request.headers.get("host") || new URL(request.url).host;
}

export function siteOrigin(request) {
  const proto = isSecureRequest(request) ? "https" : "http";
  return `${proto}://${requestHost(request)}`;
}

// CSRF: a state-changing request must come from our own pages: same Origin
// (or Referer) host, and our custom header, which a cross-site form can't
// send and a cross-site fetch can't send without a CORS preflight we never
// allow. SameSite=Lax cookies are the second layer.
export function sameOriginProblem(request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return null;
  if (request.headers.get(CLIENT_HEADER) !== "web") return "Missing client header.";
  const source = request.headers.get("origin") || request.headers.get("referer");
  if (!source) return "Missing origin.";
  let host;
  try { host = new URL(source).host; } catch { return "Bad origin."; }
  return host === requestHost(request) ? null : "Cross-site request refused.";
}

export function json(data, status = 200, { cookies = [], headers = {} } = {}) {
  const h = new Headers({ "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", ...headers });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(JSON.stringify(data), { status, headers: h });
}

export function redirect(location, { cookies = [], status = 302 } = {}) {
  const h = new Headers({ Location: location, "Cache-Control": "no-store" });
  for (const c of cookies) h.append("Set-Cookie", c);
  return new Response(null, { status, headers: h });
}

// Only a same-site path ("/..." but not "//..."), else the fallback.
export function safePath(value, fallback = "/") {
  const v = typeof value === "string" ? value : "";
  return /^\/(?!\/)[^\s\\]*$/.test(v) ? v : fallback;
}

export function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}
