// Grading queue — one cross-source list for everything an educator has to
// mark: COURSE assignment/quiz submissions (from TeacherCoursesContext) and
// TEST SERIES written answers (from TestSeriesContext). Test series have no
// course, so instead of forcing them into per-course data the two sources
// are merged here at the page level into one uniform item shape; every row
// carries a visible source tag, and both flow into the SAME GradingPanel +
// rubric scoring workflow. Graded state is written back to whichever store
// owns the submission, so a graded item moves out of the pending queue.
// (The per-course Grading tab inside Course Management is unchanged.)
import { useMemo, useState } from "react";
import GradingPanel from "../components/GradingPanel";
import GradeSummaryCard from "../components/GradeSummaryCard";
import Chip from "../../../components/ui/Chip";
import StatusBadge from "../../../components/ui/StatusBadge";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { daysAgo, submissionUrgency } from "../data/teacherCourses";
import { AssignmentIcon, QuizIcon, CheckIcon } from "../../../components/ui/icons";

// Test Series items can be narrowed by what kind of series they came from.
const SERIES_TYPES = [
  { key: "all", label: "All series" },
  { key: "assigned", label: "Assigned", test: (m) => m.origin === "assigned" },
  { key: "own", label: "Own", test: (m) => m.origin === "own" },
  { key: "course", label: "Course-wise", test: (m) => m.scope === "course" },
  { key: "standalone", label: "Standalone", test: (m) => m.scope === "standalone" },
];

const FILTERS = [
  { key: "all", label: "All" },
  { key: "course", label: "Course" },
  { key: "test_series", label: "Test Series" },
  { key: "graded", label: "Graded" },
];

function findLesson(course, lessonId) {
  for (const m of course.modules) {
    const l = m.lessons.find((les) => les.id === lessonId);
    if (l) return l;
  }
  return null;
}

function SourceTag({ item }) {
  if (item.source === "test_series") {
    return <span className="shrink-0 rounded-full bg-pastel-lavender px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pastel-lavender-ink">Test Series</span>;
  }
  return <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Course</span>;
}

function SeriesMetaTags({ meta }) {
  return (
    <>
      <span className="hidden shrink-0 rounded-full bg-secondary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pastel-orange-ink sm:inline">{meta.origin === "assigned" ? "Assigned" : "Own"}</span>
      <span className="hidden shrink-0 rounded-full bg-pastel-blue px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pastel-blue-ink sm:inline">{meta.scope === "course" ? "Course-wise" : "Standalone"}</span>
    </>
  );
}

function UrgencyBadge({ days, late }) {
  const tone = submissionUrgency(days);
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <StatusBadge status={tone} size="sm" showIcon={false}>
        {days === 0 ? "Today" : `${days}d pending`}
        {tone === "danger" ? " · overdue" : ""}
      </StatusBadge>
      {late && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">Late</span>}
    </div>
  );
}

export default function Grading() {
  const { courses, gradeSubmission, saveDraftGrade, requestResubmission } = useTeacherCourses();
  const { series, submissions, currentTeacher, gradeTsSubmission, saveDraftTsGrade, requestTsResubmission } = useTestSeries();
  const [filter, setFilter] = useState("all");
  const [activeKey, setActiveKey] = useState(null);
  const [seriesType, setSeriesType] = useState("all");

  const items = useMemo(() => {
    const mySeriesIds = new Set(series.filter((s) => s.teacherId === currentTeacher?.id).map((s) => s.id));
    const seriesById = new Map(series.map((s) => [s.id, s]));
    const courseItems = courses.flatMap((c) =>
      c.submissions.map((s) => ({
        key: `course:${c.id}:${s.id}`,
        source: "course",
        courseId: c.id,
        label: c.title,
        sub: { ...s, source: "course" },
        lesson: findLesson(c, s.lessonId),
        daysPending: daysAgo(s.submittedAt),
      }))
    );
    const tsItems = submissions
      .filter((s) => mySeriesIds.has(s.seriesId))
      .map((s) => ({
        key: `ts:${s.id}`,
        source: "test_series",
        label: s.seriesTitle,
        seriesMeta: { origin: seriesById.get(s.seriesId)?.origin || "own", scope: seriesById.get(s.seriesId)?.scope || "standalone" },
        sub: s,
        // Pseudo-"lesson" so GradingPanel's brief + rubric workflow runs unchanged.
        lesson: { title: s.testTitle, instructions: s.questionText, image: s.questionImage || null, rubric: s.rubric, maxScore: s.manualMaxScore, noDueDate: true, allowResubmission: false },
        daysPending: daysAgo(s.submittedAt),
      }));
    return [...courseItems, ...tsItems];
  }, [courses, series, submissions, currentTeacher]);

  const pending = useMemo(() => items.filter((i) => i.sub.status !== "graded").sort((a, b) => b.daysPending - a.daysPending), [items]);
  const graded = items.filter((i) => i.sub.status === "graded");

  const rows = useMemo(() => {
    const typeTest = SERIES_TYPES.find((t) => t.key === seriesType)?.test;
    // A series-type filter only makes sense for Test Series items, so it hides course items.
    const byType = (list) => (typeTest ? list.filter((i) => i.source === "test_series" && typeTest(i.seriesMeta)) : list);
    if (filter === "graded") return byType(graded);
    if (filter === "course") return byType(pending.filter((i) => i.source === "course"));
    if (filter === "test_series") return byType(pending.filter((i) => i.source === "test_series"));
    return byType(pending);
  }, [filter, seriesType, pending, graded]);

  const active = items.find((i) => i.key === activeKey) || null;
  const activeIdx = pending.findIndex((i) => i.key === activeKey);
  const hasNext = activeIdx !== -1 && activeIdx < pending.length - 1;

  function dispatch(kind, patch) {
    if (!active) return;
    if (active.source === "test_series") {
      if (kind === "grade") gradeTsSubmission(active.sub.id, patch);
      else if (kind === "draft") saveDraftTsGrade(active.sub.id, patch);
      else requestTsResubmission(active.sub.id, patch);
    } else if (kind === "grade") gradeSubmission(active.courseId, active.sub.id, patch);
    else if (kind === "draft") saveDraftGrade(active.courseId, active.sub.id, patch);
    else requestResubmission(active.courseId, active.sub.id, patch);
  }
  function openNext() {
    setActiveKey(hasNext ? pending[activeIdx + 1].key : null);
  }

  const maxFor = (i) => (i.sub.type === "quiz" ? i.sub.manualMaxScore ?? 10 : i.lesson?.maxScore ?? 100);

  return (
    <div className="pb-16">
      <div className="flex flex-col gap-3 border-b border-text/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Review</div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Grading</h1>
          <p className="mt-1.5 text-sm text-muted">Course assignments and Test Series written answers, in one queue.</p>
        </div>
        <span className="self-start rounded-full bg-warning/12 px-3 py-1 text-xs font-semibold text-warning sm:self-auto">{pending.length} pending</span>
      </div>

      <div className="mt-6 flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} className="px-4 py-1.5 text-xs">
            {f.label}
          </Chip>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2" role="group" aria-label="Filter test series by type">
        <span className="eyebrow-muted mr-1">Series type</span>
        {SERIES_TYPES.map((t) => (
          <Chip key={t.key} active={seriesType === t.key} onClick={() => setSeriesType(t.key)} className="px-3.5 py-1 text-xs">
            {t.label}
          </Chip>
        ))}
      </div>

      <div className="mt-5">
        {filter === "graded" ? (
          rows.length === 0 ? (
            <p className="rounded-3xl bg-white px-6 py-10 text-center text-sm text-muted shadow-soft">{seriesType === "all" ? "Nothing graded yet." : "Nothing graded for this kind of series yet."}</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {rows.map((i) => (
                <button key={i.key} type="button" onClick={() => setActiveKey(i.key)} className="text-left">
                  <GradeSummaryCard title={`${i.sub.studentName} · ${i.lesson?.title || i.sub.moduleTitle}${i.source === "test_series" ? " (Test Series)" : ""}`} score={i.sub.score} maxScore={maxFor(i)} feedback={i.sub.feedback} gradedAt={i.sub.gradedAt} gradedBy={i.sub.gradedBy} />
                </button>
              ))}
            </div>
          )
        ) : rows.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-14 text-center shadow-soft">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/12 text-success">
              <CheckIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-text">You're all caught up! No submissions waiting to be graded.</p>
            <p className="mt-1 text-xs text-muted">New assignment, quiz and test series submissions will show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-text/[0.06] rounded-3xl bg-white shadow-soft">
            {rows.map((i) => {
              const s = i.sub;
              const isTs = i.source === "test_series";
              return (
                <button key={i.key} type="button" onClick={() => setActiveKey(i.key)} className="flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-bg">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isTs || s.type === "quiz" ? "bg-rotation-3/20 text-muted" : "bg-primary/[0.08] text-primary"}`}>
                    {isTs || s.type === "quiz" ? <QuizIcon className="h-4 w-4" /> : <AssignmentIcon className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 text-sm font-semibold text-text">
                      <span className="truncate">{s.studentName}</span>
                      <SourceTag item={i} />
                      {isTs && <SeriesMetaTags meta={i.seriesMeta} />}
                    </p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                      {isTs ? `${s.seriesTitle} · ${s.testTitle}` : `${i.lesson?.title || s.moduleTitle} · ${i.label}`} · Submitted {s.submittedAt}
                      {s.status === "draft" && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Draft saved</span>}
                      {s.status === "resubmission_requested" && <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">Resubmission requested</span>}
                    </p>
                  </div>
                  <UrgencyBadge days={i.daysPending} late={s.late} />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {active && (
        <GradingPanel
          submission={active.sub}
          lesson={active.lesson}
          queuePosition={activeIdx + 1}
          queueTotal={pending.length}
          hasNext={hasNext}
          onClose={() => setActiveKey(null)}
          onSave={(patch) => {
            dispatch("grade", patch);
            setActiveKey(null);
          }}
          onSaveNext={(patch) => {
            dispatch("grade", patch);
            openNext();
          }}
          onSaveDraft={(patch) => {
            dispatch("draft", patch);
            setActiveKey(null);
          }}
          onRequestResubmission={(patch) => {
            dispatch("resub", patch);
            setActiveKey(null);
          }}
        />
      )}
    </div>
  );
}
