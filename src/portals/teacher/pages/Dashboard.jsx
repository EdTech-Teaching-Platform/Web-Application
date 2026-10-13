// Educator dashboard (home)
// Jira: Day 3 — Educator dashboard (home)
// Doc reference: Sec 15
//
// Landing screen after an educator logs in. Mirrors the reference mockups
// Ansh supplied component-for-component: a revenue trend chart, a month
// calendar, a course-engagement donut, a weekly sales table, a top-student-
// location breakdown and an earnings/withdraw summary — laid out around
// this educator's courses so there's a single place to see "what needs
// attention today" before drilling into a sidebar section.
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
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import StatusBadge from "../../../components/ui/StatusBadge";
import Button from "../../../components/ui/Button";
import Calendar from "../../../components/ui/Calendar";
import RevenueChart from "../../../components/ui/RevenueChart";
import DonutChart from "../../../components/ui/DonutChart";
import DecorAccents from "../../../components/ui/Decor";
import RecentBroadcastsWidget from "../components/RecentBroadcastsWidget";
import {
  UsersIcon,
  BookIcon,
  WalletIcon,
  StarIcon,
  ChevronRightIcon,
} from "../../../components/ui/icons";

const STATS = [
  { icon: UsersIcon, tone: "blue", label: "Total Students", value: "2,408", trend: { direction: "up", label: "+12%" } },
  { icon: BookIcon, tone: "sage", label: "Active Courses", value: "6", trend: { direction: "up", label: "+1" } },
  { icon: StarIcon, tone: "orange", ring: 96, label: "Average Rating", value: "4.8 / 5", trend: { direction: "up", label: "+0.2" }, actionTo: "/teacher/reviews", actionLabel: "View Reviews" },
  { icon: WalletIcon, tone: "maroon", label: "Total Revenue", value: "₹61,76,270", trend: { direction: "up", label: "+12.5%" } },
];

const COURSES = [
  {
    eyebrow: "Design",
    title: "Advanced UI Principles & Color Theory",
    status: "Published",
    students: "1,240",
    rating: "4.9",
    revenue: "₹6.3L",
  },
  {
    eyebrow: "Development",
    title: "Modern React Patterns for Production",
    status: "Published",
    students: "864",
    rating: "4.7",
    revenue: "₹68k",
  },
  {
    eyebrow: "Career",
    title: "Portfolio Reviews for Junior Designers",
    status: "Draft",
    students: "—",
    rating: "—",
    revenue: "—",
  },
];

const REVENUE_TREND = [
  { label: "Jan", sales: 28, revenue: 66300 },
  { label: "Feb", sales: 32, revenue: 72800 },
  { label: "Mar", sales: 30, revenue: 76000 },
  { label: "Apr", sales: 38, revenue: 88800 },
  { label: "May", sales: 41, revenue: 101100 },
  { label: "Jun", sales: 52, revenue: 132700 },
];

const WEEKLY_SALES = [
  { course: "Advanced UI Principles & Color Theory", rotation: 0, sales: 32, earnings: "₹1,02,374" },
  { course: "Modern React Patterns for Production", rotation: 1, sales: 19, earnings: "₹37,985" },
  { course: "Portfolio Reviews for Junior Designers", rotation: 2, sales: 6, earnings: "₹47,995" },
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
      <div className="relative motion-safe:animate-[rise-in_0.5s_ease-out_both] flex flex-col gap-4 overflow-hidden rounded-3xl bg-surface px-7 py-7 shadow-soft sm:flex-row sm:items-end sm:justify-between">
        <DecorAccents />
        <div className="relative">
          <div className="eyebrow">Educator overview</div>
          <h1 className="mt-1.5 text-3xl font-bold tracking-tight text-text sm:text-4xl">
            Welcome back, {firstName}
          </h1>
          <p className="mt-1.5 text-sm text-muted">Here's what's happening across your courses today.</p>
        </div>
        <div className="relative flex gap-3">
          <NavLink to="/teacher/liveclasses">
            <Button variant="secondary" fullWidth={false} className="px-5">
              Schedule Live Class
            </Button>
          </NavLink>
          <NavLink to="/teacher/coursebuilder">
            <Button variant="primary" fullWidth={false} className="px-5">
              Create Course
            </Button>
          </NavLink>
        </div>
      </div>

      {/* Stat row */}
      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STATS.map((s, i) => (
          <div
            key={s.label}
            style={{ animationDelay: `${i * 40 + 40}ms` }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both]"
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
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-3xl bg-white p-5 shadow-soft"
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

          {/* My Courses */}
          <section style={{ animationDelay: "200ms" }} className="motion-safe:animate-[rise-in_0.5s_ease-out_both]">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <div className="eyebrow-muted">Catalog</div>
                <h2 className="text-xl font-bold text-text">My Courses</h2>
              </div>
              <NavLink
                to="/teacher/mycourses"
                className="inline-flex items-center gap-1 text-sm font-semibold text-primary transition-opacity hover:opacity-70"
              >
                View all
                <ChevronRightIcon className="h-4 w-4" />
              </NavLink>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {COURSES.map((c, i) => (
                <ColorBlockCard
                  key={c.title}
                  rotation={i}
                  eyebrow={c.eyebrow}
                  title={c.title}
                  status={
                    <StatusBadge status={c.status === "Published" ? "success" : "warning"} showIcon={false}>
                      {c.status}
                    </StatusBadge>
                  }
                  metaRow={[
                    { label: "Students", value: c.students },
                    { label: "Rating", value: c.rating },
                    { label: "Revenue", value: c.revenue },
                  ]}
                />
              ))}
            </div>
          </section>

          {/* Weekly sales stats */}
          <section
            style={{ animationDelay: "240ms" }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-3xl bg-white p-5 shadow-soft"
          >
            <div className="eyebrow-muted">This week</div>
            <h2 className="mb-3 text-xl font-bold text-text">Weekly Sales Stats</h2>
            <div className="-mx-5 overflow-x-auto px-5">
              <table className="w-full min-w-[360px] border-collapse text-left">
              <thead>
                <tr className="border-b border-text/[0.07]">
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Course</th>
                  <th className="pb-2 text-xs font-semibold uppercase tracking-wide text-muted">Sales</th>
                  <th className="pb-2 text-right text-xs font-semibold uppercase tracking-wide text-muted">
                    Earnings
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text/[0.06]">
                {WEEKLY_SALES.map((row) => (
                  <tr key={row.course}>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <span
                          className={`h-9 w-9 shrink-0 rounded-full ${
                            ["bg-pastel-orange", "bg-pastel-blue", "bg-pastel-sage"][row.rotation]
                          }`}
                        />
                        <span className="text-sm font-medium text-text">{row.course}</span>
                      </div>
                    </td>
                    <td className="py-3 text-sm text-muted">{row.sales}</td>
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
          {/* Calendar */}
          <section
            style={{ animationDelay: "180ms" }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-3xl bg-white p-5 shadow-soft"
          >
            <Calendar eventDays={[12, 13, 15]} />
            <NavLink to="/teacher/reviewsavailability" className="mt-4 block">
              <Button variant="secondary" className="text-sm">
                Manage Availability
              </Button>
            </NavLink>
          </section>

          <RecentBroadcastsWidget />

          {/* Course engagement donut */}
          <section
            style={{ animationDelay: "220ms" }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-3xl bg-white p-5 shadow-soft"
          >
            <div className="eyebrow-muted">Engagement</div>
            <h2 className="mb-2 text-xl font-bold text-text">Course Stat</h2>
            <DonutChart
              centerLabel="70%"
              centerSub="Engagement"
              segments={[
                { label: "Course Sale", value: 40, colorClass: "stroke-rotation-1" },
                { label: "Course Watched", value: 30, colorClass: "stroke-rotation-2" },
              ]}
            />
          </section>

          {/* Top student locations */}
          <section
            style={{ animationDelay: "260ms" }}
            className="motion-safe:animate-[rise-in_0.5s_ease-out_both] rounded-3xl bg-white p-5 shadow-soft"
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
