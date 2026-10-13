import { useState } from "react";
import { Panel } from "./perfUi";

const W = 640, H = 250;
const PAD = { top: 16, right: 18, bottom: 34, left: 36 };
const LINES = [
  { key: "top10", label: "Top 10%", stroke: "stroke-chart-3", fill: "fill-chart-3", swatch: "bg-chart-3" },
  { key: "avg", label: "Cohort average", stroke: "stroke-primary", fill: "fill-primary", swatch: "bg-primary" },
  { key: "bottom10", label: "Bottom 10%", stroke: "stroke-chart-6", fill: "fill-chart-6", swatch: "bg-chart-6" },
];

// Score trend across tests: cohort average vs top 10% vs bottom 10%.
export default function PerformanceTrendChart({ perTest }) {
  const [hover, setHover] = useState(null);
  const usable = perTest.filter((t) => t.n > 0);
  const n = usable.length;
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const slot = plotW / Math.max(1, n);
  const xAt = (i) => PAD.left + slot * i + slot / 2;
  const yAt = (v) => PAD.top + plotH - (v / 100) * plotH;
  const active = hover !== null ? usable[hover] : null;
  return (
    <Panel eyebrow="Trend" title="Score trend across tests" subtitle={n < 2 ? "Only one test has results so far, so there is no trend line yet." : "Cohort average against the top and bottom 10% of scorers on each test."}>
      <div className="mb-2 flex flex-wrap items-center gap-4 text-xs font-medium text-muted">
        {LINES.map((l) => <span key={l.key} className="inline-flex items-center gap-1.5"><span className={`h-0.5 w-3 rounded-full ${l.swatch}`} /> {l.label}</span>)}
      </div>
      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`} className="w-full touch-none" role="img"
          aria-label={`Score trend. ${usable.map((t) => `${t.title}: average ${t.avg}%, top 10% ${t.top10}%, bottom 10% ${t.bottom10}%`).join("; ")}`}
          onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); const x = ((e.clientX - r.left) / r.width) * W; setHover(Math.min(n - 1, Math.max(0, Math.floor((x - PAD.left) / slot)))); }}
          onMouseLeave={() => setHover(null)}
        >
          {[0, 25, 50, 75, 100].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="currentColor" className="text-text/[0.06]" />
              <text x={PAD.left - 8} y={yAt(t) + 3} textAnchor="end" className="fill-muted text-[9px]">{t}%</text>
            </g>
          ))}
          {LINES.map((l) => (
            <g key={l.key}>
              {n > 1 && <path d={usable.map((t, i) => `${i ? "L" : "M"} ${xAt(i)} ${yAt(t[l.key])}`).join(" ")} fill="none" className={l.stroke} strokeWidth={l.key === "avg" ? 3 : 2} strokeLinecap="round" strokeLinejoin="round" />}
              {usable.map((t, i) => <circle key={t.id} cx={xAt(i)} cy={yAt(t[l.key])} r={hover === i ? 5 : 3.5} className={l.fill} />)}
            </g>
          ))}
          {hover !== null && <line x1={xAt(hover)} x2={xAt(hover)} y1={PAD.top} y2={PAD.top + plotH} className="stroke-text/15" strokeDasharray="3 3" />}
          {usable.map((t, i) => (
            <g key={t.id} tabIndex={0} onFocus={() => setHover(i)} onBlur={() => setHover(null)} className="outline-none">
              <title>{`${t.title}: average ${t.avg}%, top 10% ${t.top10}%, bottom 10% ${t.bottom10}%`}</title>
              <rect x={xAt(i) - slot / 2} y={PAD.top} width={slot} height={plotH + 20} fill="transparent" />
              <text x={xAt(i)} y={H - 12} textAnchor="middle" className={`text-[10px] ${hover === i ? "fill-text font-semibold" : "fill-muted"}`}>{`T${i + 1}`}</text>
            </g>
          ))}
        </svg>
        {active && (
          <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-2xl bg-text px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${(xAt(hover) / W) * 100}%` }}>
            <div className="max-w-[12rem] truncate font-semibold">{active.title}</div>
            <div className="text-white/75">Top 10%: {active.top10}%</div>
            <div className="text-white/75">Average: {active.avg}%</div>
            <div className="text-white/75">Bottom 10%: {active.bottom10}%</div>
          </div>
        )}
      </div>
    </Panel>
  );
}
