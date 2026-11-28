/** @vitest-environment jsdom */
// Security audit (2026-11-18): regression tests for the fixes and guards.
//   SEC-01 stored XSS: the sanitizer, and no raw-HTML render without it
//   SEC-02 security headers (vercel.json)
//   SEC-06 / SEC-07 Edge Function helpers (constant-time compare, CORS)
//   open redirects, secrets in the frontend, AI grading clamps (see also
//   tests/ai-evaluation.test.jsx) and the database sweep
//   (supabase/tests/security_rbac_sweep.sql).
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeRichHtml, richTextToPlain } from "../src/utils/richText";
import { safeRedirect } from "../src/auth/utils/validators";
import { allowedOriginFor, safeEqual } from "../supabase/functions/_shared/security.ts";

const ROOT = path.resolve(__dirname, "..");
function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else if (/\.(jsx?|tsx?)$/.test(e.name)) out.push(p);
  }
  return out;
}
const SRC_FILES = walk(path.join(ROOT, "src"));

describe("SEC-01 stored XSS: sanitizeRichHtml", () => {
  const cases = [
    ['<img src=x onerror="alert(1)">', /onerror|<img/i],
    ["<script>alert(1)</script><p>ok</p>", /<script|alert/i],
    ['<a href="javascript:alert(1)">x</a>', /javascript:/i],
    ['<p onclick="steal()">hi</p>', /onclick/i],
    ['<iframe src="https://evil.example"></iframe>', /<iframe/i],
    ['<svg><script>alert(1)</script></svg>', /<svg|<script/i],
    ['<a href="data:text/html,<script>alert(1)</script>">x</a>', /data:/i],
    ['<style>body{display:none}</style>', /<style/i],
    ['<p style="background:url(javascript:alert(1))">x</p>', /style=/i],
    ['<form action="https://evil.example"><input name=p></form>', /<form|<input/i],
  ];
  for (const [input, bad] of cases) {
    it(`removes: ${input.slice(0, 40)}`, () => {
      expect(sanitizeRichHtml(input)).not.toMatch(bad);
    });
  }

  it("keeps formatting and safe links (opened safely)", () => {
    const out = sanitizeRichHtml('<p><strong>Bold</strong> <em>i</em> <a href="https://example.com" onclick="x()">link</a></p><ul><li>one</li></ul><h3>H</h3><code>x</code>');
    expect(out).toContain("<strong>Bold</strong>");
    expect(out).toContain("<li>one</li>");
    expect(out).toContain('href="https://example.com"');
    expect(out).toContain('rel="noopener noreferrer nofollow"');
    expect(out).toContain('target="_blank"');
    expect(out).not.toContain("onclick");
  });

  it("plain-text conversion never yields markup", () => {
    expect(richTextToPlain("<p>Hi <script>x</script>there</p>")).toBe("Hi there");   // script contents dropped
  });

  it("every dangerouslySetInnerHTML / innerHTML write in src goes through a sanitizer", () => {
    const offenders = [];
    for (const f of SRC_FILES) {
      const text = fs.readFileSync(f, "utf8");
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      for (const m of text.matchAll(/dangerouslySetInnerHTML=\{\{ __html: ([^\n]+)/g)) {
        if (!/^(sanitizeRichHtml|sanitizeHtml)\(|^html \}\}/.test(m[1])) offenders.push(`${rel}: ${m[1].slice(0, 60)}`);
      }
      for (const m of text.matchAll(/\.innerHTML\s*=\s*([^\n;]+)/g)) {
        if (!/^(sanitizeRichHtml|sanitizeHtml)\(/.test(m[1].trim())) offenders.push(`${rel}: innerHTML = ${m[1].slice(0, 60)}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});

describe("open redirects", () => {
  it("only same-site paths are followed after sign-in", () => {
    for (const bad of ["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)", "evil.example", "", null, undefined]) {
      expect(safeRedirect(bad)).toBe("");
    }
    expect(safeRedirect("/student/dashboard?x=1")).toBe("/student/dashboard?x=1");
  });
});

describe("secrets in the frontend", () => {
  it("src never references the service-role key or contains key-shaped secrets", () => {
    const hits = [];
    for (const f of SRC_FILES) {
      const text = fs.readFileSync(f, "utf8");
      const rel = path.relative(ROOT, f).replace(/\\/g, "/");
      if (/SERVICE_ROLE|service_role_key|SUPABASE_SECRET/i.test(text)) hits.push(`${rel}: service role reference`);
      if (/\bsk-[A-Za-z0-9_-]{20,}|sb_secret_[A-Za-z0-9]{10,}|eyJhbGciOi[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{20,}/.test(text)) hits.push(`${rel}: key-shaped string`);
    }
    expect(hits).toEqual([]);
  });

  it("only VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY (public by design) and non-secret flags reach the bundle", () => {
    const vars = new Set();
    for (const f of SRC_FILES) for (const m of fs.readFileSync(f, "utf8").matchAll(/import\.meta\.env\.(VITE_[A-Z_]+)/g)) vars.add(m[1]);
    for (const v of vars) expect(v).not.toMatch(/SECRET|SERVICE|PRIVATE|OPENAI|PASSWORD/);
  });

  it(".env files are ignored by git", () => {
    expect(fs.readFileSync(path.join(ROOT, ".gitignore"), "utf8")).toMatch(/^\.env$/m);
  });
});

describe("SEC-02 security headers (vercel.json)", () => {
  const cfg = JSON.parse(fs.readFileSync(path.join(ROOT, "vercel.json"), "utf8"));
  const all = Object.fromEntries((cfg.headers.find((h) => h.source === "/(.*)")?.headers || []).map((h) => [h.key, h.value]));
  it("sets the baseline headers on every page", () => {
    expect(all["X-Content-Type-Options"]).toBe("nosniff");
    expect(all["X-Frame-Options"]).toBe("DENY");
    expect(all["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
    expect(all["Strict-Transport-Security"]).toMatch(/max-age=\d{7,}/);
    expect(all["Content-Security-Policy"]).toMatch(/frame-ancestors 'none'/);
    expect(all["Permissions-Policy"]).toContain("camera=(self)");   // the answer-sheet camera, this site only (QA 22 Nov)
    expect(all["Permissions-Policy"]).toContain("microphone=()");
    expect(all["Content-Security-Policy-Report-Only"]).toMatch(/default-src 'self'/);
  });
  it("routes: the auth / proxy functions, server-rendered public pages, then the SPA shell for the rest", () => {
    expect(cfg.rewrites).toEqual([
      { source: "/api/auth/:action", destination: "/api/auth?__action=:action" },
      { source: "/api/sb/:path*", destination: "/api/sb?__path=:path*" },
      { source: "/", destination: "/api/page?__path=/" },
      { source: "/test-series", destination: "/api/page?__path=/test-series" },
      { source: "/test-series/:id", destination: "/api/page?__path=/test-series/:id" },
      { source: "/((?!api/).*)", destination: "/app.html" },
    ]);
  });
});

describe("SEC-06 / SEC-07 Edge Function helpers", () => {
  it("safeEqual compares exactly, whatever the lengths", () => {
    expect(safeEqual("abc", "abc")).toBe(true);
    expect(safeEqual("abc", "abd")).toBe(false);
    expect(safeEqual("abc", "abcd")).toBe(false);
    expect(safeEqual("", "x")).toBe(false);
  });
  it("CORS: open by default (as before); with ALLOWED_ORIGINS only listed origins are echoed", () => {
    expect(allowedOriginFor("https://evil.example", undefined)).toBe("*");
    expect(allowedOriginFor("https://app.example", "https://app.example, https://www.example")).toBe("https://app.example");
    expect(allowedOriginFor("https://evil.example", "https://app.example")).toBe("https://app.example");
  });
});
