// Pure security helpers for the Edge Functions (no imports, so they can be
// unit-tested outside Deno: tests/security.test.jsx). Security audit 2026-11-18.

// The Access-Control-Allow-Origin value for a request (SEC-07). An empty
// allow-list keeps the previous behaviour ("*"); otherwise only listed
// origins are echoed (others get the first listed origin, so the browser
// refuses the response).
export function allowedOriginFor(origin: string, allowList: string | undefined) {
  const list = String(allowList ?? "").split(",").map((o) => o.trim()).filter(Boolean);
  if (!list.length) return "*";
  return list.includes(origin) ? origin : list[0];
}

// Constant-time string comparison (SEC-06: secrets and signatures).
export function safeEqual(a: string, b: string) {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  let diff = x.length ^ y.length;
  for (let i = 0; i < Math.max(x.length, y.length); i += 1) diff |= (x[i] ?? 0) ^ (y[i] ?? 0);
  return diff === 0;
}
