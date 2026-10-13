// Test Series slice of Analytics (Assessment & Quizzes tab): enrolments,
// attempts and grading load, filterable by where the series came from
// (assigned / own) and what it's attached to (course-wise / standalone).
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { OriginTags, SeriesStatusBadge } from "./TestSeriesStatus";
import Chip from "../../../components/ui/Chip";
import StatCard from "../../../components/ui/StatCard";
import { UsersIcon, QuizIcon, AssignmentIcon } from "../../../components/ui/icons";
import { seriesPerformanceSummary } from "../data/testSeriesData";

const TYPES = [
  { key: "all", label: "All series", test: () => true },
  { key: "assigned", label: "Assigned", test: (s) => s.origin === "assigned" },
  { key: "own", label: "Own", test: (s) => s.origin === "own" },
  { key: "course", label: "Course-wise", test: (s) => s.scope === "course" },
  { key: "standalone", label: "Standalone", test: (s) => s.scope === "standalone" },
];

export default function TestSeriesAnalyticsPanel() {
  const { series, submissions, currentTeacher, hasAccess } = useTestSeries();
  const [type, setType] = useState("all");
  const mine = useMemo(() => series.filter((s) => s.teacherId === currentTeacher?.id && !s.declined && s.status !== "assigned"), [series, currentTeacher]);
  const rows = useMemo(() => {
    const test = TYPES.find((t) => t.key === type).test;
    return mine.filter(test).map((s) => ({ s, perf: seriesPerformanceSummary(s, submissions) }));
  }, [mine, type, submissions]);
  if (!hasAccess) return null;
  const sum = (k) => rows.reduce((n, r) => n + r.perf[k], 0);

  return (
    <section className="mt-6 rounded-3xl bg-surface p-5 shadow-soft sm:p-6" aria-labelledby="ts-analytics-h">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <span className="eyebrow">Test Series</span>
          <h2 id="ts-analytics-h" className="mt-1 text-base font-bold text-text">Test series performance</h2>
        </div>
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter test series">
          {TYPES.map((t) => (
            <Chip key={t.key} active={type === t.key} onClick={() => setType(t.key)} className="px-3.5 py-1 text-xs">{t.label}</Chip>
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={UsersIcon} tone="blue" label="Enrolled students" value={sum("enrolled").toLocaleString()} />
        <StatCard icon={QuizIcon} tone="lavender" label="Attempts" value={sum("attempts").toLocaleString()} />
        <StatCard icon={AssignmentIcon} tone="orange" label="Answers to grade" value={sum("pendingGrading")} />
      </div>

      {rows.length === 0 ? (
        <p className="mt-4 rounded-2xl bg-bg px-4 py-6 text-center text-sm text-muted">No test series match this filter yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-text/[0.06]">
          {rows.map(({ s, perf }) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <NavLink to={`/teacher/testseries/${s.id}/detail?tab=performance`} className="block truncate text-sm font-semibold text-text hover:text-primary">{s.title}</NavLink>
                <OriginTags series={s} className="mt-1" />
              </div>
              <SeriesStatusBadge series={s} size="sm" />
              <span className="text-xs text-muted">{perf.enrolled.toLocaleString()} enrolled · {perf.attempts.toLocaleString()} attempts · {perf.pendingGrading} to grade</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
