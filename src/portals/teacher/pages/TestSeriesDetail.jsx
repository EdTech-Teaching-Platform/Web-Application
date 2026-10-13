// Series detail view at /teacher/testseries/:seriesId/detail. Tabs:
//   Overview    -- status, deadlines timeline, structure, admin brief
//   Performance -- PART 7 SLOT (TestSeriesPerformanceTab), currently the
//                  existing simple performance content
//   Leaderboard -- overall + per-test student rankings (SeriesLeaderboard),
//                  built from the same attempt data as Performance
// Gated by TestSeriesGuard (routes.jsx).
import { useState } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import { QuizIcon, ArrowLeftIcon, EyeIcon, PencilIcon, BookIcon, LockIcon } from "../../../components/ui/icons";
import { DeadlineChip, LifecycleStepper, OriginTags, OverdueBanner, SeriesStatusBadge } from "../components/TestSeriesStatus";
import DeadlineTimeline from "../components/DeadlineTimeline";
import TestSeriesPerformanceTab from "../components/TestSeriesPerformanceTab";
import SeriesLeaderboard from "../components/SeriesLeaderboard";
import { ExtensionRequestModal } from "../components/AssignedSeriesActions";
import { formatDate, isStructureLocked, primaryAction, seriesPoints, seriesQuestionCount, seriesTestCount, visibilityNote } from "../data/testSeriesData";
import { timeAgo } from "../data/testSeriesDeadlines";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "performance", label: "Performance" },
  { key: "leaderboard", label: "Leaderboard" },
];

export default function TestSeriesDetail() {
  const { seriesId } = useParams();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const { series: all, currentTeacher, requestExtension } = useTestSeries();
  const { courses } = useTeacherCourses();
  const [extOpen, setExtOpen] = useState(false);
  const series = all.find((s) => s.id === seriesId && s.teacherId === currentTeacher?.id) || null;
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "overview";

  if (!series) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState icon={QuizIcon} heading="Test series not found" message="It may have been deleted, or it belongs to another educator." action={<NavLink to="/teacher/testseries" className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft">Back to Test Series</NavLink>} />
      </div>
    );
  }

  const course = courses.find((c) => c.id === series.courseId);
  const act = primaryAction(series);
  const locked = isStructureLocked(series);
  const a = series.assignment;

  return (
    <div className="pb-16">
      <button type="button" onClick={() => navigate(series.origin === "assigned" ? "/teacher/testseries/assigned" : "/teacher/testseries")} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-text">
        <ArrowLeftIcon className="h-4 w-4" />
        {series.origin === "assigned" ? "Assigned to me" : "Test Series"}
      </button>

      <div className="flex flex-col gap-5 rounded-3xl bg-surface p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-xl font-semibold tracking-tight text-text sm:text-2xl">{series.title || "Untitled test series"}</h1>
              <SeriesStatusBadge series={series} />
            </div>
            <OriginTags series={series} className="mt-2" />
            <p className="mt-2 text-sm text-muted">
              {visibilityNote(series)} · {series.lastSavedAt ? `Saved ${timeAgo(series.lastSavedAt)}` : "Not started"}
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" onClick={() => navigate(`/teacher/testseries/${series.id}/preview`)}>
              <EyeIcon className="h-3.5 w-3.5" />
              Preview as Student
            </Button>
            <Button fullWidth={false} className="px-5 py-2 text-xs" onClick={() => navigate(act.key === "view" ? `/teacher/testseries/${series.id}?step=review` : act.to)}>
              {locked ? <LockIcon className="h-3.5 w-3.5" /> : <PencilIcon className="h-3.5 w-3.5" />}
              {act.key === "view" ? (locked ? "Open (locked)" : "Open builder") : act.label}
            </Button>
          </div>
        </div>
        <div className="-mx-1 flex gap-1 overflow-x-auto border-t border-text/[0.07] px-1 pt-3" role="tablist">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              onClick={() => setParams(t.key === "overview" ? {} : { tab: t.key }, { replace: true })}
              className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-150 ${tab === t.key ? "bg-primary text-white" : "text-muted hover:bg-primary/[0.06] hover:text-text"}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        {tab === "performance" ? (
          <TestSeriesPerformanceTab series={series} />
        ) : tab === "leaderboard" ? (
          <SeriesLeaderboard series={series} />
        ) : (
          <div className="flex flex-col gap-6">
            <OverdueBanner series={series} onRequest={() => setExtOpen(true)} />
            <section className="rounded-3xl bg-surface p-6 shadow-soft">
              <span className="eyebrow mb-3 block">Series status</span>
              <LifecycleStepper series={series} />
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <DeadlineChip series={series} />
                {series.extensionRequest && <span className="text-xs text-muted">Extension {series.extensionRequest.status}: {formatDate(series.extensionRequest.newDate)}</span>}
                {a && !series.declined && ["assigned", "drafting", "ready"].includes(series.status) && !series.extensionRequest && (
                  <button type="button" onClick={() => setExtOpen(true)} className="text-xs font-bold text-primary underline">Request deadline extension</button>
                )}
              </div>
            </section>
            <div className="grid gap-6 lg:grid-cols-2">
              <section className="rounded-3xl bg-surface p-6 shadow-soft">
                <h2 className="text-base font-bold text-text">Timeline</h2>
                <div className="mt-4"><DeadlineTimeline series={series} /></div>
              </section>
              <section className="rounded-3xl bg-surface p-6 shadow-soft">
                <h2 className="text-base font-bold text-text">Structure</h2>
                <dl className="mt-4 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
                  {[["Sections", series.sections.length], ["Tests", seriesTestCount(series)], ["Questions", seriesQuestionCount(series)], ["Marks", seriesPoints(series)]].map(([l, v]) => (
                    <div key={l} className="rounded-2xl bg-bg px-3 py-3">
                      <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{l}</dt>
                      <dd className="text-lg font-bold text-text">{v}</dd>
                    </div>
                  ))}
                </dl>
                {series.scope === "course" && (
                  <p className="mt-4 flex items-center gap-2 text-sm text-muted">
                    <BookIcon className="h-4 w-4 shrink-0" />
                    {course ? <NavLink to={`/teacher/coursemanagement/${course.id}`} className="font-semibold text-primary hover:underline">{course.title}</NavLink> : "Linked course not found"}
                  </p>
                )}
              </section>
            </div>
            {a && (
              <section className="rounded-3xl bg-surface p-6 shadow-soft">
                <h2 className="text-base font-bold text-text">Admin brief</h2>
                <p className="mt-1 text-xs text-muted">Assigned by {a.assignedBy.name} on {formatDate(a.assignedOn)}. Read-only.</p>
                <p className="mt-3 whitespace-pre-line text-sm text-muted">{a.adminBrief}</p>
                {a.adminNotes && <p className="mt-3 rounded-2xl bg-bg px-4 py-3 text-sm text-muted"><span className="font-semibold text-text">Notes: </span>{a.adminNotes}</p>}
              </section>
            )}
          </div>
        )}
      </div>

      <ExtensionRequestModal key={`ext-${extOpen}`} open={extOpen} series={series} onClose={() => setExtOpen(false)} onSubmit={(p) => requestExtension(series.id, p)} />
    </div>
  );
}
