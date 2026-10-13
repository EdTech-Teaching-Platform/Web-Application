import TrendChart from "./TrendChart";
import RevenueChart from "../../../components/ui/RevenueChart";
import DonutChart from "../../../components/ui/DonutChart";
import { courseAnalytics, courseTotalRevenue } from "../data/teacherCourses";
import { formatMoney } from "../../../utils/formatMoney";

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-5 sm:p-6 ${className} shadow-soft`}>
      <h2 className="text-base font-bold text-text">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function BarList({ items, valueKey = "pct", labelKey = "label" }) {
  if (!items || items.length === 0) return <p className="py-6 text-center text-sm text-muted">Not enough data yet</p>;
  return (
    <div className="flex flex-col gap-3">
      {items.map((item, i) => (
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

// ManagementAnalyticsTab — the deep-dive counterpart to Overview: same
// underlying course data, richer cuts (full trend axes, revenue-over-time,
// a lesson-level drop-off funnel and quiz question performance) instead of
// Overview's single glanceable snapshot, per the spec's "richer version,
// not a duplicate" requirement.
export default function ManagementAnalyticsTab({ course }) {
  const analytics = courseAnalytics(course.id);
  const totalRevenue = courseTotalRevenue(course);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Enrollment over time" subtitle="Cumulative enrolled students, last 6 months">
          <TrendChart data={analytics.enrollmentTrend} size="lg" className="text-primary" />
        </Panel>

        <Panel title="Revenue over time" subtitle={`All-time earnings so far: ${formatMoney(totalRevenue, course.currency)}`}>
          {analytics.revenueTrend.length ? (
            <RevenueChart data={analytics.revenueTrend} currency={course.currency} />
          ) : (
            <p className="py-10 text-center text-sm text-muted">Not enough data yet</p>
          )}
        </Panel>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Panel title="Lesson-by-lesson completion funnel" subtitle="Where students drop off through the course">
          <BarList items={analytics.dropoffFunnel} />
        </Panel>

        <Panel title="Quiz question performance" subtitle="Which questions students miss most often">
          <BarList items={analytics.quizPerformance} valueKey="correctPct" labelKey="question" />
        </Panel>
      </div>

      <Panel title="Device & traffic breakdown" subtitle="Placeholder — not yet backed by real analytics events">
        {analytics.deviceBreakdown.length ? (
          <div className="flex justify-center">
            <DonutChart segments={analytics.deviceBreakdown} centerLabel={`${analytics.deviceBreakdown[0]?.value ?? 0}%`} centerSub="Desktop" />
          </div>
        ) : (
          <p className="py-10 text-center text-sm text-muted">Not enough data yet</p>
        )}
      </Panel>
    </div>
  );
}
