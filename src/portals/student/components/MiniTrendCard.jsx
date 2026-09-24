// MiniTrendCard — new component, MINUTO-reference-inspired stat card with
// a small sparkline beneath the number (their "sparkline mini-chart stat
// cards"). Reuses StatCard's numeral styling conventions (font-display,
// text-text) rather than inventing a new numeral style, just adds a trend
// line and a card surface. `trend` is an array of raw numbers (any scale —
// normalized internally); purely decorative/illustrative until real daily
// history exists. Sparkline uses --color-primary only.
export default function MiniTrendCard({ value, suffix = "", label, trend = [] }) {
  const points = trend.length > 1 ? trend : [0, 0];
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 100;
  const h = 28;
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * w;
      const y = h - ((p - min) / range) * h;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-5">
      <span className="text-xs uppercase tracking-wide text-text/50">{label}</span>
      <div className="flex items-end justify-between gap-3">
        <span className="font-display text-2xl font-bold text-text">
          {value}
          {suffix}
        </span>
        <svg viewBox={`0 0 ${w} ${h}`} width="80" height="24" preserveAspectRatio="none" className="text-primary">
          <path d={path} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </div>
    </div>
  );
}
