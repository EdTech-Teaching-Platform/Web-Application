// AnalyticsOverviewSection — Analytics hub's landing view (Part 1 of the
// spec): hero stat row, a combined trend chart, and auto-surfaced insight
// cards that route straight into the deeper section that explains them.
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/ui/StatCard";
import {
  UsersIcon,
  CertificateIcon,
  ChartIcon,
  StarIcon,
  WalletIcon,
  SparkleIcon,
  ChevronRightIcon,
} from "../../../components/ui/icons";
import { heroStats, combinedTrendSeries, portfolioInsights } from "../data/analyticsData";
import { formatMoney, formatCompactMoney } from "../../../utils/formatMoney";

// Small counting-up number — no shared count-up primitive exists yet in
// src/components/ui, so this is a local, single-purpose animator rather
// than a new shared component forked for one screen.
function AnimatedNumber({ value, format }) {
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    let raf;
    const start = performance.now();
    const from = 0;
    const duration = 700;
    function tick(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <>{format ? format(display) : Math.round(display).toLocaleString()}</>;
}

const METRICS = [
  { key: "enrollments", label: "Enrollments" },
  { key: "completions", label: "Completions" },
  { key: "revenue", label: "Revenue" },
];

// Combined multi-metric trend chart — same visual language as
// EarningsTrendChart/TrendChart (area + line, gridlines, peak label,
// month axis) with a metric toggle instead of Earnings' gross/net toggle,
// so Overview reads as "the same chart system", not a new one.
function PortfolioTrendChart({ data, metric }) {
  const WIDTH = 640;
  const HEIGHT = 240;
  const PAD = { top: 16, right: 16, bottom: 26, left: 46 };

  if (!data || data.length < 2) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl bg-bg text-xs text-muted">
        Not enough data yet for this range
      </div>
    );
  }

  const plotW = WIDTH - PAD.left - PAD.right;
  const plotH = HEIGHT - PAD.top - PAD.bottom;
  const values = data.map((d) => d[metric]);
  const max = Math.max(...values, 1) * 1.15;
  const min = 0;
  const n = data.length;
  const slot = plotW / Math.max(n - 1, 1);
  const xAt = (i) => PAD.left + slot * i;
  const yAt = (v) => PAD.top + plotH - ((v - min) / (max - min || 1)) * plotH;
  const linePath = data.map((d, i) => `${i === 0 ? "M" : "L"} ${xAt(i)} ${yAt(d[metric])}`).join(" ");
  const areaPath = `${linePath} L ${xAt(n - 1)} ${PAD.top + plotH} L ${xAt(0)} ${PAD.top + plotH} Z`;
  const peakIdx = values.indexOf(Math.max(...values));
  const yTicks = [0, 0.5, 1].map((f) => Math.round(min + (max - min) * f));
  const fmt = (v) => (metric === "revenue" ? formatCompactMoney(v) : `${v}`);

  return (
    <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full text-primary" role="img" aria-label={`${metric} trend`}>
      <defs>
        <linearGradient id="portfolioTrendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.22" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
        </linearGradient>
      </defs>
      {yTicks.map((t, i) => (
        <g key={i}>
          <line x1={PAD.left} x2={WIDTH - PAD.right} y1={yAt(t)} y2={yAt(t)} stroke="currentColor" className="text-text/[0.06]" />
          <text x={PAD.left - 8} y={yAt(t) + 3} textAnchor="end" className="fill-muted text-[9px]">
            {fmt(t)}
          </text>
        </g>
      ))}
      <path d={areaPath} className="fill-primary" fill="url(#portfolioTrendFill)" />
      <path d={linePath} fill="none" className="stroke-primary" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {data.map((d, i) => (
        <circle key={d.label} cx={xAt(i)} cy={yAt(d[metric])} r={i === peakIdx ? 3.5 : 2.5} className="fill-primary" />
      ))}
      {peakIdx >= 0 && (
        <text x={xAt(peakIdx)} y={yAt(data[peakIdx][metric]) - 10} textAnchor="middle" className="fill-primary text-[10px] font-semibold">
          {metric === "revenue" ? formatMoney(data[peakIdx][metric]) : fmt(data[peakIdx][metric])}
        </text>
      )}
      {data.map((d, i) => (
        <text key={d.label} x={xAt(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-muted text-[10px]">
          {d.label}
        </text>
      ))}
    </svg>
  );
}

const TONE_STYLES = {
  success: "bg-success/[0.07] ring-success/15",
  warning: "bg-warning/[0.07] ring-warning/15",
};

export default function AnalyticsOverviewSection({ courses, range, onNavigateTab }) {
  const navigate = useNavigate();
  const [metric, setMetric] = useState("enrollments");

  const stats = useMemo(() => heroStats(courses, range), [courses, range]);
  const trend = useMemo(() => combinedTrendSeries(courses, range), [courses, range]);
  const insights = useMemo(() => portfolioInsights(courses), [courses]);

  function trendFor(pct) {
    if (pct === 0) return undefined;
    return { direction: pct < 0 ? "down" : "up", label: `${pct > 0 ? "+" : ""}${pct}% vs. prior period` };
  }

  function handleInsightClick(to) {
    const match = to.match(/^\/teacher\/analytics\?tab=(\w+)$/);
    if (match) onNavigateTab?.(match[1]);
    else navigate(to);
  }

  const hasAnyData = courses.some((c) => c.students.length > 0);

  return (
    <div className="flex flex-col gap-5">
      <div className="relative grid grid-cols-1 gap-4 overflow-hidden rounded-2xl sm:grid-cols-2 lg:grid-cols-5">
        <div aria-hidden="true" className="decor-circle decor-circle-sand -right-14 -top-14 h-48 w-48" />
        <StatCard
          icon={UsersIcon} tone="blue"
          label="Total students reached"
          value={<AnimatedNumber value={stats.totalStudents} />}
          trend={trendFor(stats.totalStudentsTrend)}
        />
        <StatCard
          icon={CertificateIcon} tone="lavender"
          label="Total completions"
          value={<AnimatedNumber value={stats.totalCompletions} />}
          trend={trendFor(stats.totalCompletionsTrend)}
        />
        <StatCard
          icon={ChartIcon} tone="blue"
          label="Overall completion rate"
          value={<AnimatedNumber value={stats.completionRate} format={(v) => `${v.toFixed(1)}%`} />}
          ring={stats.completionRate}
        />
        <StatCard
          icon={StarIcon} tone="orange"
          label="Average rating"
          value={<AnimatedNumber value={stats.avgRating} format={(v) => v.toFixed(1)} />}
          trend={trendFor(stats.avgRatingTrend)}
        />
        <StatCard
          icon={WalletIcon} tone="maroon"
          label={`Revenue (${range})`}
          value={<AnimatedNumber value={stats.totalRevenue} format={(v) => formatMoney(Math.round(v))} />}
          trend={trendFor(stats.totalRevenueTrend)}
          hero
          className="relative"
        />
      </div>

      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-text">Portfolio trend</h2>
            <p className="mt-0.5 text-xs text-muted">Enrollments, completions and revenue across every course, {range}</p>
          </div>
          <div className="flex rounded-full bg-bg p-1 text-xs font-semibold">
            {METRICS.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setMetric(m.key)}
                className={`rounded-full px-3 py-1.5 transition-all duration-150 ${
                  metric === m.key ? "bg-primary text-white" : "text-muted hover:text-text"
                } hover:-translate-y-0.5 hover:shadow-soft`}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div className="mt-4">
          {hasAnyData ? <PortfolioTrendChart data={trend} metric={metric} /> : (
            <div className="flex h-40 items-center justify-center rounded-xl bg-bg text-xs text-muted">
              Not enough data yet — trends appear once students start enrolling.
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div className="mb-4 flex items-center gap-2">
          <SparkleIcon className="h-4 w-4 text-primary" />
          <h2 className="text-base font-bold text-text">At a glance</h2>
        </div>
        {insights.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Not enough activity yet to surface insights.</p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {insights.map((ins) => (
              <button
                key={ins.id}
                type="button"
                onClick={() => handleInsightClick(ins.to)}
                className={`flex items-start justify-between gap-3 rounded-xl p-4 text-left ring-1 transition-transform duration-150 hover:-translate-y-0.5 ${TONE_STYLES[ins.tone] || TONE_STYLES.success}`}
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-text">{ins.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted">{ins.detail}</p>
                </div>
                <ChevronRightIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
