// StudentEngagementAnalytics — Analytics hub Part 3: engagement funnel,
// activity heatmap, lesson-level drop-off and the at-risk trend, reusing
// studentDirectory.js's exact at-risk definition rather than a new one.
import { useMemo, useState } from "react";
import TrendChart from "./TrendChart";
import { AlertTriangleIcon, ClockIcon } from "../../../components/ui/icons";
import { engagementFunnel, activityHeatmap, lessonDropoffByCourse, atRiskTrend } from "../data/analyticsData";
import Select from "../../../components/ui/Select";

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-5 sm:p-6 ${className} shadow-soft`}>
      <h2 className="text-base font-bold text-text">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function EngagementFunnelChart({ stages }) {
  if (!stages.length || stages[0].count === 0) {
    return <p className="py-10 text-center text-sm text-muted">Not enough enrollment data yet</p>;
  }
  const max = stages[0].count || 1;
  return (
    <div className="flex flex-col gap-4">
      {stages.map((s, i) => (
        <div key={s.key} className="motion-safe:animate-[rise-in_0.3s_ease-out_both]" style={{ animationDelay: `${i * 60}ms` }}>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-text">{s.label}</span>
            <span className="text-muted">
              {s.count.toLocaleString()} <span className="text-muted">({s.pctOfStart}%)</span>
            </span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-bg">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${Math.max(2, (s.count / max) * 100)}%` }}
            />
          </div>
          {i > 0 && s.dropoffFromPrev > 0 && (
            <div className="mt-1 text-right text-[11px] font-semibold text-danger">−{s.dropoffFromPrev}% drop-off from previous stage</div>
          )}
        </div>
      ))}
    </div>
  );
}

function heatColor(value) {
  if (value >= 70) return "bg-primary";
  if (value >= 50) return "bg-primary/70";
  if (value >= 30) return "bg-primary/45";
  if (value >= 12) return "bg-primary/25";
  return "bg-primary/10";
}

function ActivityHeatmap({ grid }) {
  const [hovered, setHovered] = useState(null);
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[520px]">
        <div className="grid grid-cols-[48px_repeat(6,1fr)] gap-1.5 pl-0 text-[10px] text-muted">
          <span />
          {grid[0].cells.map((c) => (
            <span key={c.hour} className="text-center">{c.hour}</span>
          ))}
        </div>
        <div className="mt-1.5 flex flex-col gap-1.5">
          {grid.map((row) => (
            <div key={row.day} className="grid grid-cols-[48px_repeat(6,1fr)] items-center gap-1.5">
              <span className="text-xs font-medium text-muted">{row.day}</span>
              {row.cells.map((cell, i) => {
                const key = `${row.day}-${i}`;
                return (
                  <div
                    key={key}
                    onMouseEnter={() => setHovered(key)}
                    onMouseLeave={() => setHovered((h) => (h === key ? null : h))}
                    className={`relative h-7 rounded-md transition-transform duration-150 ${heatColor(cell.value)} ${hovered === key ? "scale-110" : ""}`}
                  >
                    {hovered === key && (
                      <div className="pointer-events-none absolute -top-8 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-text px-2 py-1 text-[10px] font-medium text-white shadow-lg">
                        {row.day}, {cell.hour}: {cell.value}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <p className="mt-3 text-[11px] text-muted">
        Approximated from real activity dates (last-active, submission timestamps) — not a literal per-minute activity log.
      </p>
    </div>
  );
}

function BarList({ items, valueKey = "pct", labelKey = "label" }) {
  if (!items || items.length === 0) return <p className="py-6 text-center text-sm text-muted">Not enough data yet</p>;
  return (
    <div className="flex flex-col gap-3">
      {items.map((item) => (
        <div key={item[labelKey]} className="flex items-center gap-3 text-sm">
          <span className="w-40 shrink-0 truncate text-muted">{item[labelKey]}</span>
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-bg">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                item[valueKey] >= 70 ? "bg-success" : item[valueKey] >= 40 ? "bg-warning" : "bg-danger"
              }`}
              style={{ width: `${item[valueKey]}%` }}
            />
          </div>
          <span className="w-10 shrink-0 text-right font-semibold text-text">{item[valueKey]}%</span>
        </div>
      ))}
    </div>
  );
}

export default function StudentEngagementAnalytics({ courses, range }) {
  const funnel = useMemo(() => engagementFunnel(courses), [courses]);
  const heatmap = useMemo(() => activityHeatmap(courses), [courses]);
  const dropoffByCourse = useMemo(() => lessonDropoffByCourse(courses), [courses]);
  const months = range === "30D" ? 2 : range === "3M" ? 3 : 6;
  const riskTrend = useMemo(() => atRiskTrend(courses, months), [courses, months]);
  const [dropoffCourseId, setDropoffCourseId] = useState(dropoffByCourse[0]?.id);
  const activeDropoff = dropoffByCourse.find((c) => c.id === dropoffCourseId) || dropoffByCourse[0];

  const currentAtRisk = riskTrend[riskTrend.length - 1]?.count ?? 0;

  return (
    <div className="flex flex-col gap-5">
      <Panel title="Engagement funnel" subtitle="Enrolled → started → 50% complete → completed, across every course">
        <EngagementFunnelChart stages={funnel} />
      </Panel>

      <Panel title="Activity heatmap" subtitle="When students are most active, by day and time of day">
        <ActivityHeatmap grid={heatmap} />
      </Panel>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel
          title="Lesson-by-lesson drop-off"
          subtitle="Same funnel Course Management's Analytics tab shows, by course"
        >
          {dropoffByCourse.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted">Not enough data yet</p>
          ) : (
            <>
              <Select
                wrapperClassName="mb-4 block w-full"
                value={dropoffCourseId}
                onChange={(e) => setDropoffCourseId(e.target.value)}
                className="w-full rounded-full border border-text/15 bg-white px-4 py-2 pr-9 text-sm font-medium text-text outline-none focus:border-primary/40"
              >
                {dropoffByCourse.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </Select>
              <BarList items={activeDropoff?.funnel || []} />
            </>
          )}
        </Panel>

        <Panel
          title="At-risk students over time"
          subtitle={`${currentAtRisk} student${currentAtRisk === 1 ? "" : "s"} currently at risk (14+ days inactive, not completed)`}
        >
          <div className="mb-3 flex items-center gap-2 rounded-xl bg-danger/[0.06] px-3.5 py-2.5 text-xs text-danger">
            <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0" />
            Reuses the exact at-risk definition from Student Management — never a separate threshold.
          </div>
          <TrendChart data={riskTrend.map((p) => ({ label: p.label, count: p.count }))} size="lg" />
          <p className="mt-2 flex items-center gap-1.5 text-[11px] text-muted">
            <ClockIcon className="h-3 w-3" />
            Earlier months are approximated by replaying the real at-risk rule against each student's actual dates as of that month.
          </p>
        </Panel>
      </div>
    </div>
  );
}
