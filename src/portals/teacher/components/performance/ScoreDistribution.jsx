import { useState } from "react";
import SegmentedControl from "../../../../components/ui/SegmentedControl";
import { Panel } from "./perfUi";

const W = 640, H = 250;
const PAD = { top: 18, right: 16, bottom: 34, left: 34 };

// Histogram of average scores in 10-point bands with the pass-mark line, plus a
// percentile view (score reached at each percentile). Inline SVG, token fills.
export default function ScoreDistribution({ bins, curve, passPct, total }) {
  const [view, setView] = useState("Score bands");
  const [hover, setHover] = useState(null);
  const percentile = view === "Percentile view";
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;
  const items = percentile
    ? curve.map((c) => ({ key: `p${c.p}`, label: `P${c.p}`, value: c.score, title: `${c.p}th percentile: ${c.score}% score` }))
    : bins.map((b) => ({ key: b.label, label: b.label, value: b.count, title: `${b.label}%: ${b.count} student${b.count === 1 ? "" : "s"}` }));
  const max = percentile ? 100 : Math.max(4, ...items.map((i) => i.value)) + 1;
  const slot = plotW / items.length;
  const barW = Math.min(40, slot * 0.7);
  const yAt = (v) => PAD.top + plotH - (v / max) * plotH;
  const ticks = percentile ? [0, 25, 50, 75, 100] : [0, 1, 2, 3, 4].map((i) => Math.round((max / 4) * i));
  const passX = PAD.left + (passPct / 100) * plotW;
  const active = hover !== null ? items[hover] : null;

  return (
    <Panel
      eyebrow="Distribution"
      title="Score distribution"
      subtitle={percentile ? "Average score a student reaches at each percentile." : `${total} students by average score, in 10-point bands.`}
      action={<SegmentedControl options={["Score bands", "Percentile view"]} value={view} onChange={(v) => { setView(v); setHover(null); }} />}
    >
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`${percentile ? "Percentile view" : "Score distribution"} chart. Pass mark ${passPct}%. ${items.map((i) => i.title).join("; ")}`} onMouseLeave={() => setHover(null)}>
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="currentColor" className="text-text/[0.06]" />
              <text x={PAD.left - 8} y={yAt(t) + 3} textAnchor="end" className="fill-muted text-[9px]">{percentile ? `${t}%` : t}</text>
            </g>
          ))}
          {items.map((it, i) => {
            const x = PAD.left + slot * i + (slot - barW) / 2;
            const y = yAt(it.value);
            const isHover = hover === i;
            const pass = percentile ? it.value >= passPct : bins[i].to >= passPct;
            return (
              <g key={it.key}>
                <rect
                  x={x} y={y} width={barW} height={Math.max(PAD.top + plotH - y, it.value ? 2 : 0)} rx={5} tabIndex={0}
                  aria-label={it.title}
                  className={`outline-none transition-opacity duration-150 ${pass ? "fill-chart-3" : "fill-chart-6"} ${isHover ? "opacity-100" : "opacity-75"} focus-visible:stroke-primary`}
                  strokeWidth={2}
                  onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}
                >
                  <title>{it.title}</title>
                </rect>
                {!percentile && it.value > 0 && <text x={x + barW / 2} y={y - 5} textAnchor="middle" className="fill-text text-[10px] font-semibold">{it.value}</text>}
                <text x={x + barW / 2} y={H - 14} textAnchor="middle" className={`text-[9px] ${isHover ? "fill-text font-semibold" : "fill-muted"}`}>{it.label}</text>
              </g>
            );
          })}
          {percentile ? (
            <g>
              <line x1={PAD.left} x2={W - PAD.right} y1={yAt(passPct)} y2={yAt(passPct)} className="stroke-secondary" strokeWidth={2} strokeDasharray="5 4" />
              <text x={W - PAD.right} y={yAt(passPct) - 5} textAnchor="end" className="fill-secondary text-[10px] font-bold">Pass mark {passPct}%</text>
            </g>
          ) : (
            <g>
              <line x1={passX} x2={passX} y1={PAD.top - 4} y2={PAD.top + plotH} className="stroke-secondary" strokeWidth={2} strokeDasharray="5 4" />
              <text x={passX + 5} y={PAD.top + 6} className="fill-secondary text-[10px] font-bold">Pass mark {passPct}%</text>
            </g>
          )}
        </svg>
        {active && (
          <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-2xl bg-text px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}>
            {active.title}
          </div>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-chart-3" /> At or above pass band</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-chart-6" /> Below pass band</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-secondary" /> Pass mark</span>
      </div>
    </Panel>
  );
}
