// Tiny trend line for KPI cards. Pure SVG, token stroke; accessible summary text.
export default function Sparkline({ values, label, className = "" }) {
  const v = (values || []).filter((x) => typeof x === "number" && Number.isFinite(x));
  if (v.length < 2) return <p className="text-[11px] text-muted">{v.length ? "Single test so far" : "No data yet"}</p>;
  const W = 120, H = 32, P = 3;
  const lo = Math.min(...v), hi = Math.max(...v);
  const span = hi - lo || 1;
  const pts = v.map((y, i) => [P + (i / (v.length - 1)) * (W - 2 * P), H - P - ((y - lo) / span) * (H - 2 * P)]);
  const d = pts.map((p, i) => `${i ? "L" : "M"}${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(" ");
  const last = pts[pts.length - 1];
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={`h-8 w-full max-w-[9rem] ${className}`} role="img" aria-label={`${label} across ${v.length} tests: ${v.join(", ")}`}>
      <title>{`${label}: ${v.join(", ")}`}</title>
      <path d={d} fill="none" className="stroke-primary" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last[0]} cy={last[1]} r={2.8} className="fill-secondary" />
    </svg>
  );
}
