// Educator dashboard (home)
// Jira: Day 3 — Educator dashboard (home)
// Doc reference: Sec 15
//
// Landing screen after an educator logs in. Mirrors the reference mockups
// Ansh supplied component-for-component: a revenue trend chart, a month
// calendar, a course-engagement donut, a weekly sales table, a top-student-
// location breakdown and an earnings/withdraw summary — laid out around
// this educator's courses so there's a single place to see "what needs
// attention today" before drilling into a sidebar section. (Test-series
// product: the stats, catalog and sales table are about test series.)
//
// Screen-local pieces only (per portal README) except the chart/calendar
// primitives (RevenueChart, DonutChart, Calendar), which are shared
// components since Admin's analytics screens will need the same shapes.
import { NavLink } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { useMemo } from "react";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { seedEarnings, computeBalances, formatMoney } from "../data/earningsData";
import StatCard from "../../../components/ui/StatCard";
import Button from "../../../components/ui/Button";
import RevenueChart from "../../../components/ui/RevenueChart";
import {
  UsersIcon,
  FileTextIcon,
  WalletIcon,
  ChevronRightIcon,
} from "../../../components/ui/icons";

const STATS = [
  { icon: UsersIcon, tone: "blue", label: "Total Students", value: "2,408", trend: { direction: "up", label: "+12%" } },
  { icon: FileTextIcon, tone: "sage", label: "Active Test Series", value: "6", trend: { direction: "up", label: "+1" } },
  { icon: WalletIcon, tone: "maroon", label: "Total Revenue", value: "₹61,76,270", trend: { direction: "up", label: "+12.5%" } },
];

// Dummy test series (no backend yet), same shape the catalog cards read.
const TEST_SERIES = [
  {
    eyebrow: "Competitive Exams",
    title: "JEE Main Mathematics Full-Length Mocks",
    status: "Published",
    students: "1,240",
    tests: "12",
    revenue: "₹6.3L",
    progress: 78,
  },
  {
    eyebrow: "Board Exams",
    title: "Class 10 Science Chapter-wise Tests",
    status: "Published",
    students: "864",
    tests: "18",
    revenue: "₹68k",
    progress: 64,
  },
  {
    eyebrow: "Entrance Exams",
    title: "NEET Physics Topic Tests",
    status: "Draft",
    students: "—",
    tests: "—",
    revenue: "—",
    progress: 35,
  },
];

const SERIES_THEMES = [
  { bg: "bg-(--lp-blue-deep)", blob: "bg-(--lp-blue)/60" },
  { bg: "bg-(--lp-ink)", blob: "bg-(--lp-blue)/40" },
  { bg: "bg-(--lp-blue)", blob: "bg-(--lp-yellow)/45" },
];

const REVENUE_TREND = [
  { label: "Jan", sales: 28, revenue: 66300 },
  { label: "Feb", sales: 32, revenue: 72800 },
  { label: "Mar", sales: 30, revenue: 76000 },
  { label: "Apr", sales: 38, revenue: 88800 },
  { label: "May", sales: 41, revenue: 101100 },
  { label: "Jun", sales: 52, revenue: 132700 },
];

const SERIES_STATS = [
  { series: "JEE Main Mathematics Full-Length Mocks", rotation: 0, enrolled: "1,240", earnings: "₹6,30,500" },
  { series: "Class 10 Science Chapter-wise Tests", rotation: 1, enrolled: "864", earnings: "₹68,400" },
  { series: "NEET Physics Topic Tests", rotation: 2, enrolled: "312", earnings: "₹1,84,200" },
];

const STUDENT_LOCATIONS = [
  { flag: "🇮🇳", country: "India", count: "3,551", pct: 42 },
  { flag: "🇻🇳", country: "Vietnam", count: "1,240", pct: 24 },
  { flag: "🇺🇸", country: "United States", count: "980", pct: 18 },
];

export default function Dashboard() {
  const { user } = useAuth();
  const { courses } = useTeacherCourses();
  const earningsSeed = useMemo(() => seedEarnings(courses), [courses]);
  const earningsBalances = useMemo(
    () => computeBalances(earningsSeed.ledger, earningsSeed.payouts),
    [earningsSeed]
  );
  const todayNet = useMemo(
    () =>
      Math.round(
        earningsSeed.ledger
          .filter((e) => e.date === earningsSeed.ledger[0]?.date && (e.type === "sale" || e.type === "clawback"))
          .reduce((sum, e) => sum + e.amount, 0) * 100
      ) / 100,
    [earningsSeed]
  );
  const firstName = (user?.name || "there").split(" ")[0];

  return (
    <div className="pb-10">
      {/* Header — soft decorative gradient blobs behind the hero row, low
          opacity and purely decorative (aria-hidden), per the 2026
          elevation pass. */}
      <div className="relative flex flex-col gap-5 overflow-hidden rounded-[2rem] bg-(--lp-ink) px-6 py-7 text-white shadow-[0_24px_50px_-28px_rgba(15,17,21,0.6)] motion-safe:animate-[rise-in_0.5s_ease-out_both] sm:flex-row sm:items-end sm:justify-between sm:px-8 sm:py-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-(--lp-blue)/40 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-1/3 h-40 w-40 rounded-full bg-(--lp-yellow)/25 blur-2xl" />
        <div className="relative">
          <span className="inline-flex items-center rounded-full bg-(--lp-yellow) px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-ink)">Educator overview</span>
          <h1 className="mt-3 font-(family-name:--lp-font) text-3xl font-bold tracking-tight sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-white/70">Here's what's happening across your test series today.</p>
        </div>
      </div>

      {/* Stat row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-3">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            style={{ animationDelay: `${i * 40 + 40}ms` }}
            className={`motion-safe:animate-[rise-in_0.5s_ease-out_both] ${i === STATS.length - 1 ? "col-span-2 lg:col-span-1" : ""}`}
          >
            <StatCard
              icon={s.icon}
              label={s.label}
              value={s.value}
              trend={s.trend}
              tone={s.tone}
              ring={s.ring}
              hero={s.label === "Total Revenue"}
              action={
                s.actionTo && (
                  <NavLink to={s.actionTo}>
                    <Button variant="secondary" className="text-xs py-2.5">
                      {s.actionLabel}
                    </Button>
                  </NavLink>
                )
              }
            />
          </div>
        ))}
      </div>

      {/* Main grid */}
      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Left column */}
        <div className="flex flex-col gap-6 lg:col-span-2">
          {/* Revenue chart */}
          <section
            style={{ animationDelay: "160ms" }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-[1.75rem] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(15,17,21,0.25)] ring-1 ring-(--lp-line)"
          >
            <div className="mb-1 flex items-center justify-between">
              <div>
                <div className="eyebrow-muted">Performance</div>
                <h2 className="text-xl font-bold text-text">Revenue</h2>
              </div>
              <span className="text-xs font-medium text-muted">Last 6 months</span>
            </div>
            <RevenueChart data={REVENUE_TREND} />
          </section>

          {/* My Test Series */}
          <section style={{ animationDelay: "200ms" }} className="motion-safe:animate-[rise-in_0.5s_ease-out_both]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="eyebrow-muted">Catalog</div>
                <h2 className="text-xl font-bold text-text">My Test Series</h2>
              </div>
              <NavLink
                to="/teacher/testseries"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-opacity hover:opacity-70"
              >
                View all
                <ChevronRightIcon className="h-4 w-4" />
              </NavLink>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {TEST_SERIES.map((c, i) => {
                const live = c.status === "Published";
                const theme = SERIES_THEMES[i % SERIES_THEMES.length];
                return (
                  <NavLink
                    key={c.title}
                    to="/teacher/testseries"
                    className="group flex flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_18px_40px_-28px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line) transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_24px_46px_-26px_rgba(15,17,21,0.4)]"
                  >
                    <div className={`relative flex h-28 flex-col justify-between overflow-hidden p-4 ${theme.bg}`}>
                      <span aria-hidden="true" className={`absolute -right-6 -top-8 h-28 w-28 rounded-full ${theme.blob}`} />
                      <span aria-hidden="true" className="absolute -bottom-10 left-10 h-24 w-24 rounded-full bg-white/10" />
                      <div className="relative flex items-start justify-between">
                        <span className="grid h-10 w-10 place-items-center rounded-2xl bg-white/90 text-(--lp-ink) shadow-sm">
                          <FileTextIcon className="h-5 w-5" />
                        </span>
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider ${live ? "bg-white text-(--lp-ink)" : "bg-(--lp-yellow) text-(--lp-ink)"}`}>
                          {c.status}
                        </span>
                      </div>
                      <span className="relative text-[11px] font-bold uppercase tracking-[0.14em] text-white/85">{c.eyebrow}</span>
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <h3 className="line-clamp-2 min-h-[2.75rem] font-(family-name:--lp-font) text-base font-bold leading-snug tracking-tight text-(--lp-ink)">{c.title}</h3>
                      <dl className="mt-3 grid grid-cols-3 divide-x divide-(--lp-line) rounded-2xl bg-(--lp-grey) py-2.5 text-center">
                        {[["Students", c.students], ["Tests", c.tests], ["Revenue", c.revenue]].map(([k, v]) => (
                          <div key={k} className="px-1">
                            <dt className="text-[10px] font-semibold uppercase tracking-wide text-(--lp-muted)">{k}</dt>
                            <dd className="mt-0.5 truncate text-sm font-bold text-(--lp-ink)">{v}</dd>
                          </div>
                        ))}
                      </dl>
                      <div className="mt-3">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-(--lp-muted)">{live ? "Avg. completion" : "Build progress"}</span>
                          <span className="font-bold text-(--lp-blue-deep)">{c.progress}%</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--lp-blue-soft)">
                          <div className="h-full rounded-full bg-(--lp-blue)" style={{ width: `${c.progress}%` }} />
                        </div>
                      </div>
                      <span className="mt-4 inline-flex items-center gap-1 text-xs font-semibold text-(--lp-blue-deep)">
                        {live ? "Manage series" : "Continue building"}
                        <ChevronRightIcon className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
                      </span>
                    </div>
                  </NavLink>
                );
              })}
            </div>
          </section>

          {/* Test series stats */}
          <section
            style={{ animationDelay: "240ms" }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-[1.75rem] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(15,17,21,0.25)] ring-1 ring-(--lp-line)"
          >
            <div className="eyebrow-muted">Overview</div>
            <h2 className="mb-3 text-xl font-bold text-text">Test Series Stats</h2>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[360px] border-collapse text-left">
              <thead>
                <tr className="border-b border-text/[0.07]">
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Test Series</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Students Enrolled</th>
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Earnings
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text/[0.06]">
                {SERIES_STATS.map((row) => (
                  <tr key={row.series}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-9 w-9 shrink-0 rounded-full ${
                            ["bg-pastel-orange", "bg-pastel-blue", "bg-pastel-sage"][row.rotation]
                          }`}
                        />
                        <span className="text-sm font-medium text-text">{row.series}</span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-muted">{row.enrolled}</td>
                    <td className="py-3 text-right text-sm font-semibold text-text">{row.earnings}</td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-6">
          {/* Top student locations */}
          <section
            style={{ animationDelay: "260ms" }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-[1.75rem] bg-white p-5 shadow-[0_18px_40px_-28px_rgba(15,17,21,0.25)] ring-1 ring-(--lp-line)"
          >
            <div className="eyebrow-muted">Audience</div>
            <h2 className="mb-3 text-xl font-bold text-text">Top Student Location</h2>
            <div className="flex flex-col gap-3">
              {STUDENT_LOCATIONS.map((loc) => (
                <div key={loc.country} className="flex items-center gap-3">
                  <span className="text-lg leading-none">{loc.flag}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium text-text">{loc.country}</span>
                      <span className="text-muted">{loc.count}</span>
                    </div>
                    <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-bg">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${loc.pct}%` }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Earnings summary */}
          <section
            style={{ animationDelay: "300ms" }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-3xl bg-primary p-6 text-white shadow-card"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-white/60">Your Earnings</span>
            <div className="mt-3 grid grid-cols-3 gap-2 border-b border-white/15 pb-4 text-center">
              <div>
                <div className="text-sm font-semibold">{formatMoney(todayNet, "INR")}</div>
                <div className="text-[11px] text-white/55">Today</div>
              </div>
              <div>
                <div className="text-sm font-semibold">{formatMoney(earningsBalances.pendingBalance, "INR")}</div>
                <div className="text-[11px] text-white/55">Pending</div>
              </div>
              <div>
                <div className="text-sm font-semibold">{formatMoney(earningsBalances.reserved, "INR")}</div>
                <div className="text-[11px] text-white/55">In Review</div>
              </div>
            </div>
            <div className="mt-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-white/55">Available</div>
                <div className="text-xl font-semibold">{formatMoney(earningsBalances.availableBalance, "INR")}</div>
              </div>
              <NavLink to="/teacher/earnings">
                <button className="rounded-full bg-white px-5 py-2.5 text-sm font-semibold text-primary transition-opacity hover:opacity-90">
                  Withdraw
                </button>
              </NavLink>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
