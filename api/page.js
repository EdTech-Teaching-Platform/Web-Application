// Public pages rendered on the server (QA audit WEB-03). vercel.json rewrites
// "/", "/test-series" and "/test-series/:id" here (?__path=...). The page is
// the built SPA shell (app.html) with real content and per-page head tags;
// React mounts on top as usual. Data comes from the public catalogue RPCs
// with the anon key only. Cached at the CDN for 5 minutes.
import fs from "node:fs/promises";
import path from "node:path";
import { siteOrigin } from "./_lib/http.js";
import { authEnv } from "./_lib/gotrue.js";
import { injectPage, matchPublicRoute, renderPage } from "./_lib/pages.js";

const DATA_TIMEOUT_MS = 2500;
let cachedTemplate = null;

// The shell: from the deployment's files (vercel.json includeFiles), else
// fetched from this deployment (preview protection bypass when configured).
export async function loadTemplate(request, { readFile = fs.readFile, fetchImpl = fetch, env = process.env } = {}) {
  if (cachedTemplate) return cachedTemplate;
  for (const file of [path.join(process.cwd(), "dist", "app.html"), path.join(process.cwd(), "app.html")]) {
    try {
      const html = await readFile(file, "utf8");
      if (html.includes("<!--app-html-->")) return (cachedTemplate = html);
    } catch { /* next */ }
  }
  const headers = env.VERCEL_AUTOMATION_BYPASS_SECRET ? { "x-vercel-protection-bypass": env.VERCEL_AUTOMATION_BYPASS_SECRET } : {};
  const res = await fetchImpl(new URL("/app.html", siteOrigin(request)).toString(), { headers });
  if (!res.ok) throw new Error(`app.html: ${res.status}`);
  const html = await res.text();
  return (cachedTemplate = html);
}

export function resetTemplateCache() { cachedTemplate = null; }

async function rpc(name, params, { env, fetchImpl = fetch } = {}) {
  const { url, anonKey } = authEnv(env);
  const headers = { apikey: anonKey, "Content-Type": "application/json" };
  if (/^eyJ/.test(anonKey)) headers.Authorization = `Bearer ${anonKey}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), DATA_TIMEOUT_MS);
  try {
    const res = await fetchImpl(`${url}/rest/v1/rpc/${name}`, { method: "POST", headers, body: JSON.stringify(params), signal: controller.signal });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: await res.json() };
  } catch {
    return { ok: false, status: 504, data: null };
  } finally {
    clearTimeout(timer);
  }
}

export async function handlePage(request, deps = {}) {
  const url = new URL(request.url);
  const route = matchPublicRoute(url.searchParams.get("__path") ?? url.pathname);
  const origin = (deps.env || process.env).PUBLIC_SITE_URL?.replace(/\/+$/, "") || siteOrigin(request);
  const { url: supabaseUrl } = authEnv(deps.env);
  let list = [];
  let series = null;
  if (route?.kind === "home" || route?.kind === "list") {
    const res = await rpc("public_list_series", { p_limit: route.kind === "home" ? 6 : 50 }, deps);
    if (res.ok && Array.isArray(res.data)) list = res.data;
  } else if (route?.kind === "series") {
    const res = await rpc("public_get_series", { p_series_id: route.id }, deps);
    if (res.ok && res.data) series = res.data;
  }
  const page = renderPage(route || { kind: "missing" }, { origin, supabaseUrl, list, series });

  let template;
  try {
    template = await loadTemplate(request, deps);
  } catch {
    // No shell (rare): still serve the readable content and its links.
    template = `<!doctype html><html lang="en"><head><meta charset="UTF-8" /><meta name="viewport" content="width=device-width, initial-scale=1.0" /></head>`
      + `<body><div id="root"><!--app-html--><!--/app-html--></div></body></html>`;
  }
  const html = injectPage(template, page, { defaultImage: `${origin}/icon-512.png` });
  return new Response(html, {
    status: page.status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      // Same HTML for everyone; the CDN keeps it 5 minutes and serves it stale while refreshing.
      "Cache-Control": page.status === 200 ? "public, max-age=0, s-maxage=300, stale-while-revalidate=600" : "public, max-age=0, s-maxage=60",
    },
  });
}

export async function GET(request) { return handlePage(request); }
