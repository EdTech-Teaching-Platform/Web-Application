// TrendChart — a small line/area chart for a single trending metric
// (enrollment, in this portal). Not one of design.md's named components
// yet, but the same "build a focused primitive rather than fork a
// one-off SVG per screen" precedent RevenueChart/DonutChart already set —
// used at two sizes: compact (Overview tab's glanceable sparkline, no
// axis) and full (Analytics tab's deep-dive, with gridlines + labels),
// so Analytics reads as a richer version of Overview instead of an
// unrelated chart.
const WIDTH = 560;
const HEIGHT_SM = 90;
const HEIGHT_LG = 220;
const PAD_LG = { top: 12, right: 12, bottom: 24, left: 34 };

export default function TrendChart({ data, size = "sm", className = "" }) {
  if (!data || data.length === 0) {
    return (
      <div className={`flex h-24 items-center justify-center rounded-xl bg-bg text-xs text-muted ${className}`}>
        Not enough data yet
      </div>
    );
  }

  const height = size === "lg" ? HEIGHT_LG : HEIGHT_SM;
  const pad = size === "lg" ? PAD_LG : { top: 6, right: 4, bottom: 6, left: 4 };
  const plotW = WIDTH - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const values = data.map((d) => d.count);
  const max = Math.max(...values) * 1.15 || 1;
  const min = size === "lg" ? Math.min(...values) * 0.85 : 0;
  const n = data.length;
  const slot = plotW / Math.max(n - 1, 1);

  const xAt = (i) => pad.left + slot * i;
  const yAt = (v) => pad.top + plotH - ((v - min) / (max - min || 1)) * plotH;

  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(d.count)}`).join(" ");
  const areaPath = `${linePath} L ${xAt(n - 1)} ${pad.top + plotH} L ${xAt(0)} ${pad.top + plotH} Z`;

  const yTicks = size === "lg" ? [0, 0.5, 1].map((f) => Math.round(min + (max - min) * f)) : [];

  return (
    <div className={className}>
      <svg viewBox={`0 0 ${WIDTH} ${height}`} className="w-full" role="img" aria-label="Enrollment trend">
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
            <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((t, i) => (
          <g key={i}>
            <line x1={pad.left} x2={WIDTH - pad.right} y1={yAt(t)} y2={yAt(t)} stroke="currentColor" className="text-text/[0.06]" />
            <text x={pad.left - 8} y={yAt(t) + 3} textAnchor="end" className="fill-muted text-[9px]">
              {t}
            </text>
          </g>
        ))}

        <path d={areaPath} className="fill-primary" style={{ color: "var(--color-primary)" }} fill="url(#trendFill)" />
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle key={d.label} cx={xAt(i)} cy={yAt(d.count)} r={size === "lg" ? 3 : 2} className="fill-primary" />
        ))}

        {size === "lg" &&
          data.map((d, i) => (
            <text key={d.label} x={xAt(i)} y={height - 6} textAnchor="middle" className="fill-muted text-[10px]">
              {d.label}
            </text>
          ))}
      </svg>
    </div>
  );
}
