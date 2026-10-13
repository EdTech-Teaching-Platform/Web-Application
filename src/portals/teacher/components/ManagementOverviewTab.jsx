import TrendChart from "./TrendChart";
import ProgressRing from "../../../components/ui/ProgressRing";
import ListRow from "../../../components/ui/ListRow";
import { courseAnalytics, courseMonthlyRevenue, starDistribution } from "../data/teacherCourses";
import { PLATFORM_COMMISSION_RATE, computeEducatorEarnings } from "./contentData";
import { formatMoney } from "../../../utils/formatMoney";
import StatusBadge from "../../../components/ui/StatusBadge";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { bundlePricing, bundleDisplayStatus, bundleWarnings } from "../data/bundleData";
import { UsersIcon, StarIcon, SendIcon, AssignmentIcon, ChartIcon, InfoIcon } from "../../../components/ui/icons";

function Panel({ title, action, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-5 sm:p-6 ${className} shadow-soft`}>
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-bold text-text">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function buildActivity(course) {
  const items = [];
  course.students.slice(0, 4).forEach((s) =>
    items.push({ id: `enr-${s.id}`, date: s.enrolledAt, Icon: UsersIcon, text: `${s.name} enrolled` })
  );
  course.reviews.slice(0, 3).forEach((r) =>
    items.push({ id: `rev-${r.id}`, date: r.date, Icon: StarIcon, text: `${r.studentName} left a ${r.rating}-star review` })
  );
  course.submissions.slice(0, 3).forEach((s) =>
    items.push({
      id: `sub-${s.id}`,
      date: s.submittedAt,
      Icon: AssignmentIcon,
      text: `${s.studentName} submitted "${s.lessonId ? s.moduleTitle : "an assignment"}"`,
    })
  );
  return items.sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6);
}

export default function ManagementOverviewTab({ course }) {
  const { courses, bundles } = useTeacherCourses();
  const coursesById = Object.fromEntries(courses.map((c) => [c.id, c]));
  const courseBundles = bundles.filter((b) => b.enabled && b.courseIds.includes(course.id));
  const analytics = courseAnalytics(course.id);
  const distribution = starDistribution(course);
  const activity = buildActivity(course);
  const { commission, earnings } = computeEducatorEarnings(course.price * (course.salesThisMonth || 0));
  const revenue = courseMonthlyRevenue(course);
  const completionRate = analytics.dropoffFunnel.length
    ? analytics.dropoffFunnel[analytics.dropoffFunnel.length - 1].pct
    : null;

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="flex flex-col gap-5 lg:col-span-2">
        <Panel title="Enrollment trend" action={<span className="text-xs font-medium text-muted">Last 6 months</span>}>
          <TrendChart data={analytics.enrollmentTrend} size="sm" className="text-primary" />
          <div className="mt-4 flex flex-wrap gap-6 border-t border-text/[0.07] pt-4">
            <div>
              <div className="text-xl font-bold text-text">{course.students.length}</div>
              <div className="text-xs text-muted">Enrolled students</div>
            </div>
            <div className="flex items-center gap-3">
              {completionRate != null && <ProgressRing value={completionRate} size={56} stroke={6} />}
              <div>
                {completionRate == null && <div className="text-xl font-bold text-text">—</div>}
                <div className="eyebrow-muted">Completion rate</div>
              </div>
            </div>
          </div>
        </Panel>

        <Panel title="Rating breakdown">
          <div className="flex items-center gap-4">
            <div className="shrink-0 text-center">
              <div className="text-3xl font-bold text-text">{course.ratingCount ? course.rating.toFixed(1) : "—"}</div>
              <div className="mt-1 flex items-center justify-center gap-0.5 text-warning">
                {[1, 2, 3, 4, 5].map((s) => (
                  <StarIcon key={s} className={`h-3.5 w-3.5 ${s <= Math.round(course.rating) ? "" : "opacity-25"}`} />
                ))}
              </div>
              <div className="mt-1 text-xs text-muted">{course.ratingCount} reviews</div>
            </div>
            <div className="flex flex-1 flex-col gap-1.5">
              {distribution.map((d) => (
                <div key={d.star} className="flex items-center gap-2 text-xs">
                  <span className="w-8 shrink-0 text-muted">{d.star}★</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-warning transition-all duration-300" style={{ width: `${d.pct}%` }} />
                  </div>
                  <span className="w-8 shrink-0 text-right text-muted">{d.count}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="Recent activity">
          {activity.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted">Nothing to show yet.</p>
          ) : (
            <div className="flex flex-col divide-y divide-text/[0.06]">
              {activity.map((a) => (
                <ListRow
                  key={a.id}
                  leading={
                    <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
                      <a.Icon className="h-4 w-4" />
                    </span>
                  }
                  title={a.text}
                  subtitle={new Date(a.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      <div className="flex flex-col gap-5">
        <Panel title="Revenue summary">
          <div className="rounded-2xl border border-dashed border-text/15 bg-bg p-5">
            <div className="mb-4 flex items-center justify-between">
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-muted">
                <ChartIcon className="h-3.5 w-3.5" />
                This month
              </span>
              <span className="group relative">
                <InfoIcon className="h-3.5 w-3.5 cursor-help text-muted" />
                <span className="pointer-events-none absolute right-0 top-6 z-10 w-52 rounded-xl bg-text px-3 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
                  Same commission logic as the Pricing step — captured at time of sale.
                </span>
              </span>
            </div>
            <dl className="flex flex-col gap-2.5 text-sm">
              <div className="flex items-center justify-between">
                <dt className="text-muted">Sales this month</dt>
                <dd className="font-medium text-text">{course.salesThisMonth || 0}</dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Gross</dt>
                <dd className="font-medium text-text">
                  {formatMoney(commission + earnings, course.currency)}
                </dd>
              </div>
              <div className="flex items-center justify-between">
                <dt className="text-muted">Platform commission ({Math.round(PLATFORM_COMMISSION_RATE * 100)}%)</dt>
                <dd className="font-medium text-danger">
                  −{formatMoney(commission, course.currency)}
                </dd>
              </div>
              <div className="my-1 border-t border-dashed border-text/15" />
              <div className="flex items-center justify-between">
                <dt className="font-semibold text-text">Your earnings</dt>
                <dd className="text-lg font-bold text-success">
                  {formatMoney(revenue, course.currency)}
                </dd>
              </div>
            </dl>
          </div>
        </Panel>

        <Panel title="Bundles">
          {courseBundles.length === 0 ? (
            <p className="text-sm text-muted">This course isn't part of any bundle. Add one from the Pricing step of the course builder.</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {courseBundles.map((b) => {
                const pr = bundlePricing(b, coursesById);
                const st = bundleDisplayStatus(b, coursesById);
                const warn = bundleWarnings(b, coursesById);
                return (
                  <li key={b.id} className="rounded-2xl bg-bg p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="min-w-0 text-sm font-semibold text-text">{b.name}</span>
                      <StatusBadge status={st.status} size="sm">{st.label}</StatusBadge>
                    </div>
                    <p className="mt-1 text-xs text-muted">
                      {b.courseIds.length} courses · {formatMoney(pr.final)}
                      {pr.valid && pr.savings > 0 ? ` · ${pr.savingsPct}% off` : ""}
                    </p>
                    {warn.length > 0 && <p className="mt-1 text-xs font-medium text-pastel-orange-ink">Includes archived: {warn.map((w) => w.title).join(", ")}</p>}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>

        <Panel title="Quick facts">
          <dl className="flex flex-col gap-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-muted">Level</dt>
              <dd className="font-medium text-text">{course.level}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Language</dt>
              <dd className="font-medium text-text">{course.language}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Certificate</dt>
              <dd className="font-medium text-text">{course.certificate ? "Included" : "Not offered"}</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-muted">Created</dt>
              <dd className="font-medium text-text">{new Date(course.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}</dd>
            </div>
          </dl>
        </Panel>

        <Panel title="Resubmit action" className={course.status === "changes_requested" ? "" : "hidden"}>
          <p className="flex items-center gap-2 text-sm text-danger">
            <SendIcon className="h-4 w-4" />
            Changes requested — head to Edit Course to make the fix and resubmit.
          </p>
        </Panel>
      </div>
    </div>
  );
}
