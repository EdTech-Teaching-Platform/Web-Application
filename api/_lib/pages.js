// Server HTML for the public pages (QA audit WEB-03): the landing page, the
// test-series list and each series page get real content and their own
// title / description / link-preview tags in the first response, so search
// engines and link previews see them without running JavaScript. React then
// mounts as usual (createRoot replaces everything between the app markers).
// No personal data: the same HTML for every visitor (CDN-cacheable).
import { escapeHtml } from "./http.js";

export const SITE_NAME = "Universal Learning";
export const DEFAULT_DESCRIPTION = "Practice tests with a timer, instant scoring and a detailed report after every attempt. Expert-built online test series for school and competitive exams.";
const APP_START = "<!--app-html-->";
const APP_END = "<!--/app-html-->";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// "/" | "/test-series" | "/test-series/<uuid>" -> {kind, id?}; anything else null.
export function matchPublicRoute(path) {
  const p = String(path || "/").replace(/\/+$/, "") || "/";
  if (p === "/") return { kind: "home" };
  if (p === "/test-series") return { kind: "list" };
  const m = p.match(/^\/test-series\/([^/]+)$/);
  if (m) return UUID.test(m[1]) ? { kind: "series", id: m[1].toLowerCase() } : { kind: "missing" };
  return null;
}

// Rich text (the wizard's HTML) to plain text for descriptions.
export function plainText(html, max = 0) {
  const text = String(html ?? "")
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>|<\/(p|div|li|h[1-6])>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
  return max && text.length > max ? `${text.slice(0, max - 1).trimEnd()}…` : text;
}

export function priceText(s) {
  return s?.is_free || s?.pricing === "free" || !Number(s?.price_inr) ? "Free" : `₹${Number(s.price_inr).toLocaleString("en-IN")}`;
}

function coverUrl(supabaseUrl, path) {
  if (!path || !/^[0-9a-f-]{36}\/(banner|question_image)\/[0-9a-f-]{36}\.(jpg|png|webp)$/.test(path)) return null;
  return `${supabaseUrl}/storage/v1/object/public/test-assets/${path.split("/").map(encodeURIComponent).join("/")}`;
}

function jsonLd(data) {
  return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, "\\u003c")}</script>`;
}

function seriesCard(s) {
  const meta = [s.exam, s.subject, s.level].filter(Boolean).join(" · ");
  const facts = [`${s.tests_count ?? 0} test${s.tests_count === 1 ? "" : "s"}`, s.questions_count ? `${s.questions_count} questions` : "", priceText(s)].filter(Boolean).join(" · ");
  return `<li class="ul-ssr-card"><a href="/test-series/${escapeHtml(s.id)}"><h3>${escapeHtml(s.title)}</h3></a>`
    + (meta ? `<p class="ul-ssr-meta">${escapeHtml(meta)}</p>` : "")
    + (s.description ? `<p>${escapeHtml(plainText(s.description, 180))}</p>` : "")
    + `<p class="ul-ssr-meta">${escapeHtml(facts)}</p></li>`;
}

const NAV = `<nav class="ul-ssr-nav" aria-label="Main"><a href="/">${SITE_NAME}</a><a href="/test-series">Test series</a><a href="/login">Log in</a><a href="/register">Sign up free</a></nav>`;
const FOOTER = `<footer class="ul-ssr-foot"><a href="/terms">Terms of Service</a> · <a href="/privacy">Privacy Policy</a></footer>`;

// -> {status, title, description, canonical, image, body, ld}
export function renderPage(route, { origin, supabaseUrl, list = [], series = null } = {}) {
  const canonical = (path) => `${origin}${path}`;
  if (route.kind === "home") {
    return {
      status: 200,
      title: `${SITE_NAME} | Online test series and mock exams`,
      description: DEFAULT_DESCRIPTION,
      canonical: canonical("/"),
      body: `${NAV}<main><h1>Test series that move you forward.</h1>`
        + `<p>${escapeHtml(DEFAULT_DESCRIPTION)}</p>`
        + `<p><a href="/test-series">Browse test series</a> · <a href="/register">Create a free account</a></p>`
        + (list.length ? `<section><h2>Featured test series</h2><ul>${list.slice(0, 6).map(seriesCard).join("")}</ul></section>` : "")
        + `<section><h2>How it works</h2><ol><li>Pick a test series for your exam.</li><li>Take timed tests in full-screen mode.</li><li>Get your score, rank and a topic-by-topic report.</li></ol></section>`
        + `</main>${FOOTER}`,
      ld: { "@context": "https://schema.org", "@type": "Organization", name: SITE_NAME, url: canonical("/") },
    };
  }
  if (route.kind === "list") {
    return {
      status: 200,
      title: `Test series | ${SITE_NAME}`,
      description: "Browse expert-built online test series and mock exams with instant scoring and detailed reports.",
      canonical: canonical("/test-series"),
      body: `${NAV}<main><h1>Test series</h1><p>Timed practice tests with instant scoring and a detailed report after every attempt.</p>`
        + (list.length ? `<ul>${list.map(seriesCard).join("")}</ul>` : `<p>New test series are coming soon.</p>`)
        + `</main>${FOOTER}`,
      ld: list.length ? { "@context": "https://schema.org", "@type": "ItemList",
        itemListElement: list.map((s, i) => ({ "@type": "ListItem", position: i + 1, url: canonical(`/test-series/${s.id}`), name: s.title })) } : null,
    };
  }
  if (route.kind === "series" && series) {
    const desc = plainText(series.description, 300) || `${series.title}: an online test series on ${SITE_NAME}.`;
    const tests = Array.isArray(series.tests) ? series.tests : [];
    return {
      status: 200,
      title: `${series.title} | ${SITE_NAME}`,
      description: plainText(series.description, 160) || desc,
      canonical: canonical(`/test-series/${series.id}`),
      image: coverUrl(supabaseUrl, series.cover_path),
      body: `${NAV}<main><p class="ul-ssr-meta">${escapeHtml([series.exam, series.subject, series.level].filter(Boolean).join(" · ") || "Test series")}</p>`
        + `<h1>${escapeHtml(series.title)}</h1><p>${escapeHtml(desc)}</p>`
        + `<p class="ul-ssr-meta">${escapeHtml([`${series.tests_count ?? tests.length} tests`, series.questions_count ? `${series.questions_count} questions` : "", priceText(series)].filter(Boolean).join(" · "))}</p>`
        + (series.who_for ? `<section><h2>Who it's for</h2><p>${escapeHtml(plainText(series.who_for, 600))}</p></section>` : "")
        + (series.syllabus ? `<section><h2>Syllabus</h2><p>${escapeHtml(plainText(series.syllabus, 1200))}</p></section>` : "")
        + (tests.length ? `<section><h2>Tests in this series</h2><ol>${tests.map((t) => `<li>${escapeHtml(t.title)}${t.questions_count ? ` (${escapeHtml(t.questions_count)} questions)` : ""}</li>`).join("")}</ol></section>` : "")
        + `<p><a href="/register">Sign up free to start</a></p></main>${FOOTER}`,
      ld: { "@context": "https://schema.org", "@type": "Course", name: series.title, description: desc,
        url: canonical(`/test-series/${series.id}`), provider: { "@type": "Organization", name: SITE_NAME, url: canonical("/") },
        offers: { "@type": "Offer", price: series.is_free ? 0 : Number(series.price_inr || 0), priceCurrency: "INR", category: series.is_free ? "Free" : "Paid" } },
    };
  }
  return {
    status: 404,
    title: `Page not found | ${SITE_NAME}`,
    description: "This test series isn't available.",
    canonical: null,
    noindex: true,
    body: `${NAV}<main><h1>Test series not found</h1><p>It may have been removed. <a href="/test-series">Browse all test series</a>.</p></main>${FOOTER}`,
  };
}

const SSR_STYLE = `<style>.ul-ssr{max-width:960px;margin:0 auto;padding:24px 16px;font-family:system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:#1d2433;line-height:1.55}`
  + `.ul-ssr a{color:#2f55d4}.ul-ssr h1{font-size:2rem;line-height:1.15;margin:.5em 0}.ul-ssr h2{font-size:1.2rem;margin:1.4em 0 .4em}`
  + `.ul-ssr ul{list-style:none;padding:0;display:grid;gap:12px}.ul-ssr-card{padding:14px 16px;border:1px solid #e3e8f4;border-radius:14px}`
  + `.ul-ssr-card h3{margin:0;font-size:1.05rem}.ul-ssr-meta{color:#5b6475;font-size:.9rem}.ul-ssr-nav{display:flex;flex-wrap:wrap;gap:16px;font-weight:600}`
  + `.ul-ssr-foot{margin-top:32px;font-size:.85rem;color:#5b6475}</style>`;

const META_PATTERNS = [
  /<title>[\s\S]*?<\/title>/i,
  /<meta\s+name="description"[^>]*>/i,
  /<meta\s+property="og:(title|description|url|image|image:width|image:height|image:alt|type)"[^>]*>/gi,
  /<meta\s+name="twitter:(card|title|description|image)"[^>]*>/gi,
];

// The SPA shell (app.html) with this page's head tags and body content.
export function injectPage(template, page, { defaultImage } = {}) {
  let html = template;
  for (const re of META_PATTERNS) html = html.replace(re, "");
  const image = page.image || defaultImage;
  const head = [
    `<title>${escapeHtml(page.title)}</title>`,
    `<meta name="description" content="${escapeHtml(page.description)}" />`,
    page.noindex ? `<meta name="robots" content="noindex" />` : "",
    page.canonical ? `<link rel="canonical" href="${escapeHtml(page.canonical)}" />` : "",
    `<meta property="og:type" content="website" />`,
    `<meta property="og:title" content="${escapeHtml(page.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(page.description)}" />`,
    page.canonical ? `<meta property="og:url" content="${escapeHtml(page.canonical)}" />` : "",
    image ? `<meta property="og:image" content="${escapeHtml(image)}" />` : "",
    `<meta name="twitter:card" content="${page.image ? "summary_large_image" : "summary"}" />`,
    `<meta name="twitter:title" content="${escapeHtml(page.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(page.description)}" />`,
    image ? `<meta name="twitter:image" content="${escapeHtml(image)}" />` : "",
    page.ld ? jsonLd(page.ld) : "",
    SSR_STYLE,
  ].filter(Boolean).join("\n    ");
  html = html.replace("</head>", `    ${head}\n  </head>`);
  const start = html.indexOf(APP_START);
  const end = html.indexOf(APP_END);
  if (start >= 0 && end > start) {
    html = `${html.slice(0, start + APP_START.length)}<div class="ul-ssr">${page.body}</div>${html.slice(end)}`;
  }
  return html;
}
