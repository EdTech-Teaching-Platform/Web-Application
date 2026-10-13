import { useMemo, useState } from "react";
import { formatMoney } from "../../utils/formatMoney";

// RevenueChart — combo bar + line chart for a portal's earnings trend
// (design.md doesn't name a chart component yet; built to spec here so
// Admin's Financial Analytics and Student's Progress views can reuse it
// rather than each hand-rolling their own SVG chart).
//
// Deliberately draws ONE labeled axis (Course Sales, a count) per
// design.md's chart rule — a second y-axis with its own tick scale is the
// #1 charting anti-pattern (two implicit scales invite misreading). The
// Revenue line is an indexed overlay on the same plot: no axis ticks of
// its own, its real rupee value is only ever shown via direct labels on
// key points and the hover tooltip, never implied by a second axis.
//
// Usage:
//   <RevenueChart data={[{ label: "Jan", sales: 40, revenue: 6200 }, ...]} />
const WIDTH = 640;
const HEIGHT = 260;
const PAD = { top: 16, right: 16, bottom: 28, left: 36 };

export default function RevenueChart({ data, currency = "INR", className = "" }) {
  const [hoverIndex, setHoverIndex] = useState(null);

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const n = data.length;
  const slot = plotW / n;
  const barW = Math.min(22, slot * 0.42);

  const salesMax = useMemo(() => Math.max(...data.map((d) => d.sales)) * 1.2, [data]);
  const revenueMax = useMemo(() => Math.max(...data.map((d) => d.revenue)) * 1.15, [data]);
  const revenueMin = useMemo(() => Math.min(...data.map((d) => d.revenue)) * 0.85, [data]);

  const xAt = (i) => PAD.left + slot * i + slot / 2;
  const barYAt = (v) => PAD.top + plotH - (v / salesMax) * plotH;
  const lineYAt = (v) => PAD.top + plotH - ((v - revenueMin) / (revenueMax - revenueMin)) * plotH;

  const linePath = data
    .map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${lineYAt(d.revenue)}`)
    .join(" ");

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(salesMax * f));
  const peakIndex = data.reduce((best, d, i) => (d.revenue > data[best].revenue ? i : best), 0);

  const active = hoverIndex != null ? data[hoverIndex] : null;

  return (
    <div className={`relative ${className}`}>
      <div className="mb-3 flex items-center gap-5 text-xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-chart-5" /> Course Sales
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-0.5 w-3 rounded-full bg-primary" /> Revenue
        </span>
      </div>

      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full touch-none"
        role="img"
        aria-label="Monthly course sales and revenue trend"
        onMouseMove={(e) => {
          const rect = e.currentTarget.getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * WIDTH;
          const i = Math.min(n - 1, Math.max(0, Math.floor((x - PAD.left) / slot)));
          setHoverIndex(i);
        }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        {/* Recessive gridlines */}
        {yTicks.map((t, i) => {
          const y = barYAt(t);
          return (
            <g key={i}>
              <line x1={PAD.left} x2={WIDTH - PAD.right} y1={y} y2={y} stroke="currentColor" className="text-text/[0.06]" />
              <text x={PAD.left - 8} y={y + 3} textAnchor="end" className="fill-muted text-[9px]">
                {t}
              </text>
            </g>
          );
        })}

        {/* Bars — Course Sales, rounded data-end per mark spec */}
        {data.map((d, i) => {
          const x = xAt(i) - barW / 2;
          const y = barYAt(d.sales);
          const h = PAD.top + plotH - y;
          const isHover = hoverIndex === i;
          return (
            <rect
              key={d.label}
              x={x}
              y={y}
              width={barW}
              height={Math.max(h, 2)}
              rx={4}
              className={`transition-opacity duration-150 ${isHover ? "fill-chart-5" : "fill-chart-5/60"}`}
            />
          );
        })}

        {/* Revenue line overlay */}
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        {data.map((d, i) => (
          <circle
            key={d.label}
            cx={xAt(i)}
            cy={lineYAt(d.revenue)}
            r={hoverIndex === i ? 4.5 : 3}
            className="fill-primary"
          />
        ))}

        {/* Selective direct label on the peak point only */}
        <text
          x={xAt(peakIndex)}
          y={lineYAt(data[peakIndex].revenue) - 10}
          textAnchor="middle"
          className="fill-primary text-[10px] font-semibold"
        >
          {formatMoney(data[peakIndex].revenue, currency)}
        </text>

        {/* Crosshair */}
        {hoverIndex != null && (
          <line
            x1={xAt(hoverIndex)}
            x2={xAt(hoverIndex)}
            y1={PAD.top}
            y2={PAD.top + plotH}
            className="stroke-text/15"
            strokeDasharray="3 3"
          />
        )}

        {/* X axis labels */}
        {data.map((d, i) => (
          <text
            key={d.label}
            x={xAt(i)}
            y={HEIGHT - 8}
            textAnchor="middle"
            className={`text-[10px] ${hoverIndex === i ? "fill-text font-semibold" : "fill-muted"}`}
          >
            {d.label}
          </text>
        ))}
      </svg>

      {active && (
        <div
          className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-2xl bg-text px-3 py-2 text-xs text-white shadow-lg"
          style={{ left: `${((xAt(hoverIndex) - 20) / WIDTH) * 100}%` }}
        >
          <div className="font-semibold">{active.label}</div>
          <div className="mt-0.5 text-white/75">Sales: {active.sales}</div>
          <div className="text-white/75">Revenue: {formatMoney(active.revenue, currency)}</div>
        </div>
      )}
    </div>
  );
}
