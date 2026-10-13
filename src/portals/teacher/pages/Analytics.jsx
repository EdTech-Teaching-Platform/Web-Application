// Analytics — the portfolio-wide Analytics hub. Aggregates performance
// across every course, student, session and rupee this educator has,
// going deeper than the scattered stats already shown in My Courses /
// Course Management's Analytics tab / Earnings / Student Management.
// Every number on this page is derived from the exact same shared mock
// data those screens already read (see data/analyticsData.js) so nothing
// here can drift from them.
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { ANALYTICS_RANGES } from "../data/analyticsData";
import AnalyticsOverviewSection from "../components/AnalyticsOverviewSection";
import CoursePerformanceComparison from "../components/CoursePerformanceComparison";
import StudentEngagementAnalytics from "../components/StudentEngagementAnalytics";
import AssessmentAnalytics from "../components/AssessmentAnalytics";
import TestSeriesAnalyticsPanel from "../components/TestSeriesAnalyticsPanel";
import RevenueInsightsSection from "../components/RevenueInsightsSection";
import ReportGenerator from "../components/ReportGenerator";
import DecorAccents from "../../../components/ui/Decor";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "courses", label: "Course Performance" },
  { key: "engagement", label: "Student Engagement" },
  { key: "assessment", label: "Assessment & Quizzes" },
  { key: "revenue", label: "Revenue Insights" },
  { key: "reports", label: "Reports" },
];

export default function Analytics() {
  const { courses } = useTeacherCourses();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = TABS.some((t) => t.key === searchParams.get("tab")) ? searchParams.get("tab") : "overview";
  const [tab, setTab] = useState(initialTab);
  const [range, setRange] = useState("6M");

  function changeTab(key) {
    setTab(key);
    setSearchParams(key === "overview" ? {} : { tab: key }, { replace: true });
  }

  const publishedCount = useMemo(() => courses.filter((c) => c.status === "published").length, [courses]);

  return (
    <div className="pb-16">
      <div className="relative mb-5 flex flex-col gap-4 overflow-hidden rounded-3xl bg-white p-5 sm:p-7 shadow-soft [&>:not([data-decor])]:relative">
        <DecorAccents />
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="eyebrow mb-1.5">Insights</div>
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Analytics</h1>
            <p className="mt-1 text-sm text-muted">
              One place to see how all {publishedCount} of your published courses are really doing — students, engagement, assessments and revenue, together.
            </p>
          </div>
          <div className="flex shrink-0 rounded-full bg-bg p-1 text-xs font-semibold">
            {ANALYTICS_RANGES.map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={`rounded-full px-3.5 py-2 transition-all duration-150 ${
                  range === r ? "bg-primary text-white" : "text-muted hover:text-text"
                } hover:-translate-y-0.5 hover:shadow-soft`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>

        <div className="-mx-1 flex gap-1 overflow-x-auto border-t border-text/[0.07] px-1 pt-3">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => changeTab(t.key)}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ${
                tab === t.key ? "bg-primary text-white" : "text-muted hover:bg-primary/[0.06] hover:text-text"
              } hover:-translate-y-0.5 hover:shadow-soft`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === "overview" && <AnalyticsOverviewSection courses={courses} range={range} onNavigateTab={changeTab} />}
      {tab === "courses" && <CoursePerformanceComparison courses={courses} />}
      {tab === "engagement" && <StudentEngagementAnalytics courses={courses} range={range} />}
      {tab === "assessment" && (
        <>
          <AssessmentAnalytics courses={courses} range={range} />
          <TestSeriesAnalyticsPanel />
        </>
      )}
      {tab === "revenue" && <RevenueInsightsSection courses={courses} range={range} />}
      {tab === "reports" && <ReportGenerator courses={courses} range={range} />}
    </div>
  );
}
