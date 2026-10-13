import { useState } from "react";
import { Panel, MiniChip, fmtDate } from "./perfUi";
import { AlertTriangleIcon, ClockIcon } from "../../../../components/ui/icons";

const W = 640, H = 200;
const PAD = { top: 14, right: 12, bottom: 28, left: 30 };

function DailyChart({ daily }) {
  const [hover, setHover] = useState(null);
  if (!daily.length) return <p className="text-sm text-muted">No attempts in this date range.</p>;
  const max = Math.max(3, ...daily.map((d) => d.count));
  const slot = (W - PAD.left - PAD.right) / daily.length;
  const barW = Math.min(18, slot * 0.7);
  const plotH = H - PAD.top - PAD.bottom;
  const yAt = (v) => PAD.top + plotH - (v / max) * plotH;
  const every = Math.ceil(daily.length / 10);
  const a = hover !== null ? daily[hover] : null;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Attempts per ${daily[0].from === daily[0].to ? "day" : "week"}. ${daily.map((d) => `${d.title}: ${d.count}`).join("; ")}`} onMouseLeave={() => setHover(null)}>
        {[0, 0.5, 1].map((f) => <g key={f}><line x1={PAD.left} x2={W - PAD.right} y1={yAt(max * f)} y2={yAt(max * f)} stroke="currentColor" className="text-text/[0.06]" /><text x={PAD.left - 6} y={yAt(max * f) + 3} textAnchor="end" className="fill-muted text-[9px]">{Math.round(max * f)}</text></g>)}
        {daily.map((d, i) => {
          const x = PAD.left + slot * i + (slot - barW) / 2;
          return (
            <g key={d.from}>
              <rect x={x} y={yAt(d.count)} width={barW} height={Math.max(PAD.top + plotH - yAt(d.count), d.count ? 2 : 0)} rx={4} tabIndex={0} aria-label={`${d.title}: ${d.count} attempts`} className={`outline-none fill-chart-2 transition-opacity duration-150 focus-visible:stroke-primary ${hover === i ? "opacity-100" : "opacity-70"}`} strokeWidth={2} onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} onBlur={() => setHover(null)}><title>{`${d.title}: ${d.count} attempts`}</title></rect>
              {i % every === 0 && <text x={x + barW / 2} y={H - 10} textAnchor="middle" className="fill-muted text-[9px]">{d.label}</text>}
            </g>
          );
        })}
      </svg>
      {a && <div className="pointer-events-none absolute top-0 -translate-x-1/2 rounded-2xl bg-text px-3 py-2 text-xs text-white shadow-lg" style={{ left: `${((PAD.left + slot * hover + slot / 2) / W) * 100}%` }}>{a.title}: {a.count}</div>}
    </div>
  );
}

function Funnel({ funnel }) {
  return (
    <ul className="flex flex-col gap-4">
      {funnel.map((f, i) => {
        const steps = [["Enrolled", f.enrolled, "bg-chart-2/60"], ["Started", f.started, "bg-chart-5"], ["Finished", f.finished, "bg-chart-3"]];
        const drop = f.started ? Math.round(((f.started - f.finished) / f.started) * 100) : 0;
        return (
          <li key={f.id} role="group" aria-label={`${f.title} funnel`}>
            <div className="mb-1.5 flex items-center justify-between gap-2 text-xs">
              <span className="truncate font-semibold text-text">T{i + 1} · {f.title}</span>
              <span className="shrink-0 text-muted">{drop}% drop-off after starting</span>
            </div>
            <div className="flex flex-col gap-1">
              {steps.map(([label, n, tone]) => (
                <div key={label} className="grid grid-cols-[4.2rem_1fr_2rem] items-center gap-2 text-[11px]" title={`${label}: ${n} of ${f.enrolled}`}>
                  <span className="text-muted">{label}</span>
                  <span className="h-2.5 rounded-full bg-primary/[0.06]"><span className={`block h-full rounded-full ${tone}`} style={{ width: `${f.enrolled ? (n / f.enrolled) * 100 : 0}%` }} /></span>
                  <span className="text-right font-semibold tabular-nums text-text">{n}</span>
                </div>
              ))}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function FlagList({ title, icon: Icon, items, empty, render, tone }) {
  return (
    <div>
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-text">
        <Icon className={`h-4 w-4 ${tone}`} /> {title} <span className="text-xs font-medium text-muted">({items.length})</span>
      </h3>
      {items.length === 0 ? <p className="text-xs text-muted">{empty}</p> : (
        <ul className="flex max-h-56 flex-col divide-y divide-text/[0.06] overflow-y-auto">{items.slice(0, 12).map(render)}</ul>
      )}
    </div>
  );
}

export default function EngagementIntegrity({ eng, onOpen }) {
  return (
    <Panel id="perf-engagement" eyebrow="Engagement and integrity" title="How students are working through the series">
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <div>
          <h3 className="mb-2 text-sm font-bold text-text">Attempts per {eng.daily[0] && eng.daily[0].from !== eng.daily[0].to ? "week" : "day"}</h3>
          <DailyChart daily={eng.daily} />
          <div className="mt-4 grid grid-cols-3 gap-3 text-center">
            {[["Avg time to complete", `${eng.avgCompleteMin} min`], ["Late submissions", eng.late.length], ["Retakes", eng.retakes]].map(([k, v]) => <div key={k} className="rounded-2xl bg-bg p-3"><div className="text-lg font-bold text-text">{v}</div><div className="text-[11px] text-muted">{k}</div></div>)}
          </div>
        </div>
        <div>
          <h3 className="mb-3 text-sm font-bold text-text">Drop-off funnel by test</h3>
          {eng.funnel.length ? <Funnel funnel={eng.funnel} /> : <p className="text-sm text-muted">No tests in this view.</p>}
        </div>
        <FlagList title="Late submissions" icon={ClockIcon} tone="text-danger" items={eng.late} empty="No late submissions in this view." render={(x) => (
          <li key={x.id}><button type="button" onClick={() => onOpen(x.key)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-xs hover:text-primary"><span className="min-w-0"><span className="block truncate font-semibold text-text">{x.student}</span><span className="block truncate text-muted">{x.test}</span></span><MiniChip tone="bg-pastel-pink text-pastel-pink-ink">{fmtDate(x.date)}</MiniChip></button></li>
        )} />
        <FlagList title="Unusually fast completions" icon={AlertTriangleIcon} tone="text-warning" items={eng.fast} empty="No unusually fast completions." render={(x) => (
          <li key={x.id}><button type="button" onClick={() => onOpen(x.key)} className="flex w-full items-center justify-between gap-3 py-2 text-left text-xs hover:text-primary"><span className="min-w-0"><span className="block truncate font-semibold text-text">{x.student}</span><span className="block truncate text-muted">{x.test} · {x.pct}%</span></span><MiniChip tone="bg-pastel-orange text-pastel-orange-ink">{x.timeMin} of ~{x.expectedMin} min</MiniChip></button></li>
        )} />
      </div>
    </Panel>
  );
}
