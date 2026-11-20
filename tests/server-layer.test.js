// Server layer (Vercel functions): HttpOnly-cookie sessions (api/auth.js),
// the Supabase proxy (api/sb.js) and server-rendered public pages
// (api/page.js, QA audit WEB-03). Runs the handlers with Web Request /
// Response and a fake Supabase; nothing goes over the network.
import { describe, expect, it, vi } from "vitest";
import { handleAuth } from "../api/auth.js";
import { handleProxy, proxyPath } from "../api/sb.js";
import { handlePage, resetTemplateCache } from "../api/page.js";
import { clientIp, parseCookies, safePath, sameOriginProblem, serializeCookie } from "../api/_lib/http.js";
import { authRequest, challengeFor, ensureSession, jwtExp } from "../api/_lib/gotrue.js";
import { injectPage, matchPublicRoute, plainText, renderPage } from "../api/_lib/pages.js";
import { cookieFetch, createCookieAuth, pathOf } from "../src/services/cookieAuth.js";

const SITE = "https://app.example.com";
const ENV = { SUPABASE_URL: "https://proj.supabase.co", SUPABASE_ANON_KEY: "sb_publishable_abc" };
const ENV_SECRET = { ...ENV, SUPABASE_SECRET_KEY: "sb_secret_xyz" };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString("base64url");
const jwt = (exp) => `${b64({ alg: "HS256" })}.${b64({ sub: "u1", exp })}.sig`;
const nowSec = () => Math.floor(Date.now() / 1000);
const USER = { id: "u1", email: "riya@example.com", identities: [{ provider: "email" }] };
const TOKENS = { access_token: jwt(nowSec() + 3600), refresh_token: "rt-1", expires_in: 3600, expires_at: nowSec() + 3600, user: USER };

function req(path, { method = "GET", body, cookies = {}, headers = {}, origin = SITE } = {}) {
  const h = new Headers({ host: "app.example.com", "x-forwarded-proto": "https", "x-real-ip": "203.0.113.7", ...headers });
  if (method !== "GET") { h.set("x-ul-client", "web"); h.set("origin", origin); }
  const jar = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
  if (jar) h.set("cookie", jar);
  if (body !== undefined) h.set("content-type", "application/json");
  return new Request(`${SITE}${path}`, { method, headers: h, body: body === undefined ? undefined : JSON.stringify(body) });
}

// A fake Supabase: routes by path, records calls.
function fakeSupabase(routes) {
  const calls = [];
  const fetchImpl = vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method || "GET"} ${u.pathname}${u.search}`;
    calls.push({ key, url, init, headers: new Headers(init.headers) });
    const hit = Object.entries(routes).find(([pattern]) => key.startsWith(pattern));
    if (!hit) return new Response(JSON.stringify({ msg: "no route" }), { status: 404 });
    const [status, body, headers] = typeof hit[1] === "function" ? hit[1](init, u) : hit[1];
    const payload = status === 204 || status === 304 ? null : typeof body === "string" ? body : JSON.stringify(body);
    return new Response(payload, { status, headers: headers || { "content-type": "application/json" } });
  });
  return { fetchImpl, calls };
}

const setCookies = (res) => res.headers.getSetCookie();

describe("http helpers", () => {
  it("cookies are HttpOnly, SameSite=Lax, Secure, scoped to /api", () => {
    const c = serializeCookie("ul_at", "tok", { maxAge: 60 });
    expect(c).toBe("ul_at=tok; Path=/api; HttpOnly; SameSite=Lax; Secure; Max-Age=60");
    expect(parseCookies("a=1; ul_at=x%3Dy")).toEqual({ a: "1", ul_at: "x=y" });
  });
  it("state-changing requests need our header and a same-site origin", () => {
    expect(sameOriginProblem(req("/api/auth/login", { method: "POST" }))).toBeNull();
    expect(sameOriginProblem(req("/api/auth/login", { method: "POST", origin: "https://evil.example" }))).toMatch(/Cross-site/);
    const noHeader = new Request(`${SITE}/api/auth/login`, { method: "POST", headers: { host: "app.example.com", origin: SITE } });
    expect(sameOriginProblem(noHeader)).toMatch(/client header/);
    expect(sameOriginProblem(req("/api/auth/session"))).toBeNull();
  });
  it("safe paths and the client IP", () => {
    expect(safePath("/student/x?y=1")).toBe("/student/x?y=1");
    expect(safePath("//evil.com")).toBe("/");
    expect(safePath("https://evil.com")).toBe("/");
    expect(clientIp(req("/"))).toBe("203.0.113.7");
  });
});

describe("Supabase Auth from the server", () => {
  it("with a secret key, sends the user's IP in sb-forwarded-for (per-user rate limits)", async () => {
    const { fetchImpl, calls } = fakeSupabase({ "GET /auth/v1/user": [200, USER] });
    await authRequest("/user", { accessToken: "t", request: req("/"), env: ENV_SECRET, fetchImpl });
    expect(calls[0].headers.get("sb-forwarded-for")).toBe("203.0.113.7");
    expect(calls[0].headers.get("apikey")).toBe("sb_secret_xyz");
    expect(calls[0].headers.get("authorization")).toBe("Bearer t");
  });
  it("without one, no forwarding; a legacy service_role key is never used", async () => {
    const { fetchImpl, calls } = fakeSupabase({ "GET /auth/v1/user": [200, USER] });
    await authRequest("/user", { request: req("/"), env: { ...ENV, SUPABASE_SECRET_KEY: "eyJservice" }, fetchImpl });
    expect(calls[0].headers.get("sb-forwarded-for")).toBeNull();
    expect(calls[0].headers.get("apikey")).toBe("sb_publishable_abc");
    expect(calls[0].headers.get("authorization")).toBeNull();   // new-style keys never go as a bearer
  });
  it("ensureSession: valid token, refresh, refused refresh, Auth down", async () => {
    let r = await ensureSession(req("/", { cookies: { ul_at: TOKENS.access_token } }), { env: ENV });
    expect(r.state).toBe("active");
    const ok = fakeSupabase({ "POST /auth/v1/token?grant_type=refresh_token": [200, TOKENS] });
    r = await ensureSession(req("/", { cookies: { ul_at: jwt(nowSec() - 10), ul_rt: "rt-0" } }), { env: ENV, fetchImpl: ok.fetchImpl });
    expect(r.state).toBe("refreshed");
    expect(r.cookies.join("|")).toMatch(/ul_at=.*HttpOnly/);
    expect(JSON.parse(ok.calls[0].init.body)).toEqual({ refresh_token: "rt-0" });
    const refused = fakeSupabase({ "POST /auth/v1/token": [400, { msg: "Invalid Refresh Token" }] });
    r = await ensureSession(req("/", { cookies: { ul_rt: "bad" } }), { env: ENV, fetchImpl: refused.fetchImpl });
    expect(r.state).toBe("expired");
    expect(r.cookies.every((c) => c.includes("Max-Age=0"))).toBe(true);
    const down = fakeSupabase({ "POST /auth/v1/token": [503, {}] });
    r = await ensureSession(req("/", { cookies: { ul_rt: "rt" } }), { env: ENV, fetchImpl: down.fetchImpl });
    expect(r.state).toBe("unavailable");
    expect(r.cookies).toEqual([]);
  });
  it("PKCE challenge is base64url SHA-256", async () => {
    expect(await challengeFor("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk")).toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
    expect(jwtExp(jwt(123))).toBe(123);
  });
});

describe("api/auth", () => {
  it("login: tokens go into HttpOnly cookies, never into the response body", async () => {
    const { fetchImpl, calls } = fakeSupabase({ "POST /auth/v1/token?grant_type=password": [200, TOKENS] });
    const res = await handleAuth(req("/api/auth/login", { method: "POST", body: { email: " riya@example.com ", password: "pw" } }), { env: ENV, fetchImpl });
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).not.toContain(TOKENS.access_token);
    expect(text).not.toContain("rt-1");
    expect(JSON.parse(text).user.id).toBe("u1");
    const cookies = setCookies(res);
    expect(cookies.find((c) => c.startsWith("ul_at="))).toMatch(/HttpOnly; SameSite=Lax; Secure; Max-Age=3600/);
    expect(cookies.find((c) => c.startsWith("ul_rt="))).toMatch(/HttpOnly/);
    expect(JSON.parse(calls[0].init.body)).toEqual({ email: "riya@example.com", password: "pw" });
  });
  it("login: Supabase's error message and code come through; cross-site POSTs are refused", async () => {
    const { fetchImpl } = fakeSupabase({ "POST /auth/v1/token": [400, { code: 400, error_code: "invalid_credentials", msg: "Invalid login credentials" }] });
    const res = await handleAuth(req("/api/auth/login", { method: "POST", body: { email: "a@b.c", password: "x" } }), { env: ENV, fetchImpl });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toEqual({ message: "Invalid login credentials", code: "invalid_credentials", status: 400 });
    const evil = await handleAuth(req("/api/auth/login", { method: "POST", body: {}, origin: "https://evil.example" }), { env: ENV, fetchImpl });
    expect(evil.status).toBe(403);
  });
  it("session: the user (refreshing if needed), or null", async () => {
    const { fetchImpl } = fakeSupabase({ "POST /auth/v1/token?grant_type=refresh_token": [200, TOKENS], "GET /auth/v1/user": [200, USER] });
    const res = await handleAuth(req("/api/auth/session", { cookies: { ul_rt: "rt-0" } }), { env: ENV, fetchImpl });
    const body = await res.json();
    expect(body.user.email).toBe("riya@example.com");
    expect(body.state).toBe("refreshed");
    expect(setCookies(res).some((c) => c.startsWith("ul_at="))).toBe(true);
    const none = await handleAuth(req("/api/auth/session"), { env: ENV, fetchImpl });
    expect((await none.json()).user).toBeNull();
  });
  it("logout: Supabase is told and the cookies are cleared", async () => {
    const { fetchImpl, calls } = fakeSupabase({ "POST /auth/v1/logout?scope=global": [204, ""] });
    const res = await handleAuth(req("/api/auth/logout", { method: "POST", body: { scope: "global" }, cookies: { ul_at: TOKENS.access_token, ul_rt: "rt-1" } }), { env: ENV, fetchImpl });
    expect(res.status).toBe(200);
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${TOKENS.access_token}`);
    expect(setCookies(res).filter((c) => /^ul_(at|rt)=;/.test(c) && c.includes("Max-Age=0"))).toHaveLength(2);
  });
  it("Google: PKCE verifier in an HttpOnly cookie, then the code is exchanged in the callback", async () => {
    const res = await handleAuth(req("/api/auth/oauth?provider=google&next=%2Fauth%2Fcallback%3Fredirect%3D%2Fstudent"), { env: ENV });
    expect(res.status).toBe(302);
    const loc = new URL(res.headers.get("location"));
    expect(loc.origin + loc.pathname).toBe("https://proj.supabase.co/auth/v1/authorize");
    expect(loc.searchParams.get("code_challenge_method")).toBe("s256");
    expect(loc.searchParams.get("redirect_to")).toBe(`${SITE}/api/auth/callback?next=%2Fauth%2Fcallback%3Fredirect%3D%2Fstudent`);
    const pkce = setCookies(res).find((c) => c.startsWith("ul_pkce="));
    expect(pkce).toMatch(/Path=\/api\/auth; HttpOnly/);
    const verifier = decodeURIComponent(pkce.split(";")[0].split("=")[1]);

    const { fetchImpl, calls } = fakeSupabase({ "POST /auth/v1/token?grant_type=pkce": [200, TOKENS] });
    const cb = await handleAuth(req("/api/auth/callback?code=abc&next=%2Fauth%2Fcallback%3Fredirect%3D%2Fstudent", { cookies: { ul_pkce: verifier } }), { env: ENV, fetchImpl });
    expect(cb.status).toBe(302);
    expect(cb.headers.get("location")).toBe("/auth/callback?redirect=/student");
    expect(JSON.parse(calls[0].init.body)).toEqual({ auth_code: "abc", code_verifier: verifier });
    expect(setCookies(cb).some((c) => c.startsWith("ul_at=") && !c.includes("Max-Age=0"))).toBe(true);
    const bad = await handleAuth(req("/api/auth/oauth?provider=github"), { env: ENV });
    expect(bad.status).toBe(400);
  });
  it("callback: errors go back to the page; a link opened elsewhere asks to log in; next can't leave the site", async () => {
    let r = await handleAuth(req("/api/auth/callback?next=%2Fauth%2Fcallback&error=access_denied&error_description=Denied"), { env: ENV });
    expect(r.headers.get("location")).toBe("/auth/callback?error=access_denied&error_description=Denied");
    r = await handleAuth(req("/api/auth/callback?code=x&type=signup&next=%2Fauth%2Fcallback"), { env: ENV });
    expect(r.headers.get("location")).toBe("/login?notice=email_confirmed");
    r = await handleAuth(req("/api/auth/callback?error=x&next=https%3A%2F%2Fevil.com"), { env: ENV });
    expect(r.headers.get("location").startsWith("/auth/callback")).toBe(true);
  });
  it("password reset: the link lands on /reset-password with the recovery flag", async () => {
    const sb = fakeSupabase({ "POST /auth/v1/recover": [200, {}] });
    const res = await handleAuth(req("/api/auth/recover", { method: "POST", body: { email: "a@b.c" } }), { env: ENV, fetchImpl: sb.fetchImpl });
    expect(res.status).toBe(200);
    const redirectTo = new URL(new URL(sb.calls[0].url).searchParams.get("redirect_to"));
    expect(redirectTo.origin + redirectTo.pathname).toBe(`${SITE}/api/auth/callback`);
    expect(redirectTo.searchParams.get("next")).toBe("/reset-password");
    expect(redirectTo.searchParams.get("type")).toBe("recovery");
    const verifier = decodeURIComponent(setCookies(res)[0].split(";")[0].split("=")[1]);
    const ex = fakeSupabase({ "POST /auth/v1/token?grant_type=pkce": [200, TOKENS] });
    const cb = await handleAuth(req("/api/auth/callback?code=c&type=recovery&next=%2Freset-password", { cookies: { ul_pkce: verifier } }), { env: ENV, fetchImpl: ex.fetchImpl });
    expect(cb.headers.get("location")).toBe("/reset-password?ul_recovery=1");
  });
  it("update user needs a session", async () => {
    const res = await handleAuth(req("/api/auth/user", { method: "POST", body: { password: "new-pass-1" } }), { env: ENV });
    expect(res.status).toBe(401);
    const sb = fakeSupabase({ "PUT /auth/v1/user": [200, USER] });
    const ok = await handleAuth(req("/api/auth/user", { method: "POST", body: { password: "new-pass-1" }, cookies: { ul_at: TOKENS.access_token } }), { env: ENV, fetchImpl: sb.fetchImpl });
    expect(ok.status).toBe(200);
    expect(JSON.parse(sb.calls[0].init.body)).toEqual({ password: "new-pass-1" });
  });
});

describe("api/sb proxy", () => {
  it("only database, function and storage paths; never auth", () => {
    expect(proxyPath(req("/api/sb?__path=rest/v1/rpc/student_dashboard")).path).toBe("rest/v1/rpc/student_dashboard");
    expect(proxyPath(req("/api/sb/functions/v1/answer-uploads")).path).toBe("functions/v1/answer-uploads");
    expect(proxyPath(req("/api/sb?__path=auth/v1/token"))).toBeNull();
    expect(proxyPath(req("/api/sb?__path=rest/v1/../auth/v1/user"))).toBeNull();
  });
  it("adds the user's token from the cookie and ignores the browser's Authorization", async () => {
    const { fetchImpl, calls } = fakeSupabase({ "POST /rest/v1/rpc/student_dashboard": [200, { ok: true }] });
    const res = await handleProxy(req("/api/sb?__path=rest/v1/rpc/student_dashboard&select=*", {
      method: "POST", body: {}, cookies: { ul_at: TOKENS.access_token }, headers: { authorization: "Bearer attacker", apikey: "x", prefer: "return=representation" },
    }), { env: ENV, fetchImpl });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(calls[0].url).toBe("https://proj.supabase.co/rest/v1/rpc/student_dashboard?select=*");
    expect(calls[0].headers.get("authorization")).toBe(`Bearer ${TOKENS.access_token}`);
    expect(calls[0].headers.get("apikey")).toBe("sb_publishable_abc");
    expect(calls[0].headers.get("prefer")).toBe("return=representation");
    expect(calls[0].headers.get("cookie")).toBeNull();
  });
  it("signed out: anon key only; an expired session is cleared and flagged", async () => {
    const { fetchImpl, calls } = fakeSupabase({ "POST /rest/v1/rpc/public_list_series": [200, []], "POST /auth/v1/token": [400, { msg: "bad" }] });
    await handleProxy(req("/api/sb?__path=rest/v1/rpc/public_list_series", { method: "POST", body: {} }), { env: ENV, fetchImpl });
    expect(calls[0].headers.get("authorization")).toBeNull();
    const res = await handleProxy(req("/api/sb?__path=rest/v1/rpc/public_list_series", { method: "POST", body: {}, cookies: { ul_rt: "dead" } }), { env: ENV, fetchImpl });
    expect(res.headers.get("x-ul-session")).toBe("expired");
    expect(setCookies(res).every((c) => c.includes("Max-Age=0"))).toBe(true);
  });
  it("a cross-site write is refused", async () => {
    const res = await handleProxy(req("/api/sb?__path=rest/v1/rpc/grading_save", { method: "POST", body: {}, origin: "https://evil.example", cookies: { ul_at: TOKENS.access_token } }), { env: ENV, fetchImpl: vi.fn() });
    expect(res.status).toBe(403);
  });
});

describe("server-rendered public pages (WEB-03)", () => {
  const TEMPLATE = `<!doctype html><html><head><title>Old</title><meta name="description" content="old" /><meta property="og:title" content="old" /><meta name="twitter:card" content="summary" /></head><body><div id="root"><!--app-html--><div class="ul-boot">Loading</div><!--/app-html--></div><script type="module" src="/assets/index-abc.js"></script></body></html>`;
  const SERIES = { id: "8f1c2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f", title: "JEE <Physics>", description: "<p>Complete <b>JEE</b> practice.</p><script>x()</script>",
    who_for: "Class 12", syllabus: "Mechanics", exam: "JEE", subject: "Physics", is_free: true, tests_count: 3, questions_count: 90,
    tests: [{ title: "Mock 1", questions_count: 30 }] };

  it("matches only the public routes", () => {
    expect(matchPublicRoute("/")).toEqual({ kind: "home" });
    expect(matchPublicRoute("/test-series/")).toEqual({ kind: "list" });
    expect(matchPublicRoute(`/test-series/${SERIES.id}`)).toEqual({ kind: "series", id: SERIES.id });
    expect(matchPublicRoute("/test-series/nope")).toEqual({ kind: "missing" });
    expect(matchPublicRoute("/student/dashboard")).toBeNull();
  });
  it("renders escaped content and per-page head tags into the shell", () => {
    const page = renderPage({ kind: "series", id: SERIES.id }, { origin: SITE, supabaseUrl: ENV.SUPABASE_URL, series: SERIES });
    const html = injectPage(TEMPLATE, page, { defaultImage: `${SITE}/icon-512.png` });
    expect(html).toContain("<title>JEE &lt;Physics&gt; | Universal Learning</title>");
    expect(html).not.toContain("<title>Old</title>");
    expect(html).toContain(`<link rel="canonical" href="${SITE}/test-series/${SERIES.id}" />`);
    expect(html).toContain('<meta property="og:description" content="Complete JEE practice." />');
    expect(html).toContain("<h1>JEE &lt;Physics&gt;</h1>");
    expect(html).toContain("<h2>Syllabus</h2>");
    expect(html).not.toContain("x()");
    expect(html).not.toContain("Loading");
    expect(html).toContain('<script type="module" src="/assets/index-abc.js"></script>');
    expect(html).toContain('"@type":"Course"');
    expect(plainText("<p>a&nbsp;<b>b</b></p>")).toBe("a b");
  });
  it("handlePage: data from the public RPC, CDN-cacheable, 404 for an unknown series", async () => {
    resetTemplateCache();
    const { fetchImpl, calls } = fakeSupabase({
      "POST /rest/v1/rpc/public_list_series": [200, [SERIES]],
      "POST /rest/v1/rpc/public_get_series": [404, { message: "Test series not found." }],
    });
    const readFile = vi.fn(async () => TEMPLATE);
    const res = await handlePage(req("/api/page?__path=/test-series"), { env: ENV, fetchImpl, readFile });
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toContain("s-maxage=300");
    const html = await res.text();
    expect(html).toContain(`<a href="/test-series/${SERIES.id}"><h3>JEE &lt;Physics&gt;</h3></a>`);
    expect(calls[0].headers.get("authorization")).toBeNull();   // anon key only, never a user token
    const missing = await handlePage(req(`/api/page?__path=/test-series/${SERIES.id}`), { env: ENV, fetchImpl, readFile });
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('<meta name="robots" content="noindex" />');
  });
  it("the shell is fetched from the deployment when it isn't on disk", async () => {
    resetTemplateCache();
    const { fetchImpl } = fakeSupabase({ "POST /rest/v1/rpc/public_list_series": [200, []] });
    const both = vi.fn(async (url, init) => (String(url).endsWith("/app.html") ? new Response(TEMPLATE) : fetchImpl(url, init)));
    const res = await handlePage(req("/api/page?__path=/"), { env: ENV, fetchImpl: both, readFile: async () => { throw new Error("ENOENT"); } });
    expect(await res.text()).toContain("<h1>Test series that move you forward.</h1>");
    expect(both).toHaveBeenCalledWith(`${SITE}/app.html`, expect.anything());
  });
});

describe("browser: cookie-mode auth", () => {
  function fakeServer(routes) {
    return vi.fn(async (url, init = {}) => {
      const r = routes[`${init.method || "GET"} ${url}`];
      if (!r) return new Response("{}", { status: 404 });
      const [status, body] = typeof r === "function" ? r(init) : r;
      return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
    });
  }
  it("sign in / session / sign out, with events and no tokens", async () => {
    const fetchImpl = fakeServer({
      "GET /api/auth/session": [200, { user: null }],
      "POST /api/auth/login": [200, { user: USER, expires_at: 9 }],
      "POST /api/auth/logout": [200, { ok: true }],
    });
    const auth = createCookieAuth({ fetchImpl, win: null });
    const events = [];
    auth.onAuthStateChange((e, s) => events.push([e, s?.user?.id ?? null]));
    await new Promise((r) => setTimeout(r, 0));
    const { data, error } = await auth.signInWithPassword({ email: "riya@example.com", password: "pw" });
    expect(error).toBeNull();
    expect(data.session.access_token).toBeUndefined();
    expect((await auth.getSession()).data.session.user.id).toBe("u1");
    await auth.signOut();
    expect(events).toEqual([["INITIAL_SESSION", null], ["SIGNED_IN", "u1"], ["SIGNED_OUT", null]]);
    const loginCall = fetchImpl.mock.calls.find(([u]) => u === "/api/auth/login");
    expect(loginCall[1].headers["x-ul-client"]).toBe("web");
  });
  it("a refused login returns the server's error like supabase-js", async () => {
    const auth = createCookieAuth({ win: null, fetchImpl: fakeServer({ "POST /api/auth/login": [400, { error: { message: "Invalid login credentials", status: 400, code: "invalid_credentials" } }] }) });
    const { error } = await auth.signInWithPassword({ email: "a", password: "b" });
    expect(error.message).toBe("Invalid login credentials");
    expect(error.status).toBe(400);
  });
  it("Google sign-in goes through the server; redirect URLs become same-site paths", async () => {
    const auth = createCookieAuth({ win: null, fetchImpl: vi.fn() });
    const { data } = await auth.signInWithOAuth({ provider: "google", options: { redirectTo: "https://app.example.com/auth/callback?redirect=%2Fstudent", skipBrowserRedirect: true } });
    expect(data.url).toBe("/api/auth/oauth?provider=google&next=%2Fauth%2Fcallback%3Fredirect%3D%252Fstudent");
    expect(pathOf("https://evil.com/x?y")).toBe("/x?y");
  });
  it("the data fetch drops Authorization, sends our header, and signs out on an expired session", async () => {
    const auth = { notifySessionExpired: vi.fn() };
    const inner = vi.fn(async () => new Response("{}", { headers: { "x-ul-session": "expired" } }));
    await cookieFetch(auth, inner)("/api/sb/rest/v1/rpc/x", { method: "POST", headers: { Authorization: "Bearer anon", apikey: "k" } });
    const sent = inner.mock.calls[0][1];
    expect(sent.headers.get("authorization")).toBeNull();
    expect(sent.headers.get("x-ul-client")).toBe("web");
    expect(sent.credentials).toBe("same-origin");
    expect(auth.notifySessionExpired).toHaveBeenCalled();
  });
});
