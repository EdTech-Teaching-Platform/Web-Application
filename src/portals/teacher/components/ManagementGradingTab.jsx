import { useMemo, useState } from "react";
import GradingPanel from "./GradingPanel";
import GradeSummaryCard from "./GradeSummaryCard";
import Chip from "../../../components/ui/Chip";
import StatusBadge from "../../../components/ui/StatusBadge";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { daysAgo, submissionUrgency } from "../data/teacherCourses";
import { AssignmentIcon, QuizIcon, CheckIcon, ArticleIcon, LinkIcon, FileGenericIcon, ChevronDownIcon } from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

function findLesson(course, lessonId) {
  for (const m of course.modules) {
    const l = m.lessons.find((les) => les.id === lessonId);
    if (l) return l;
  }
  return null;
}

const TYPE_ICON = { file: FileGenericIcon, link: LinkIcon, text: ArticleIcon };

const FILTERS = [
  { key: "all", label: "All" },
  { key: "assignment", label: "Assignments" },
  { key: "quiz", label: "Quizzes" },
  { key: "overdue", label: "Overdue" },
  { key: "graded", label: "Graded" },
];

const SORTS = [
  { key: "oldest", label: "Oldest Submitted First" },
  { key: "overdue", label: "Most Overdue" },
  { key: "student", label: "Student Name" },
  { key: "course", label: "Course" },
];

function UrgencyBadge({ days, late }) {
  const tone = submissionUrgency(days);
  return (
    <div className="flex shrink-0 flex-col items-end gap-1">
      <StatusBadge status={tone === "neutral" ? "neutral" : tone} size="sm" showIcon={false}>
        {days === 0 ? "Today" : `${days}d pending`}
        {tone === "danger" ? " · overdue" : ""}
      </StatusBadge>
      {late && <span className="rounded-full bg-danger/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-danger">Late</span>}
    </div>
  );
}

export default function ManagementGradingTab({ course }) {
  const { gradeSubmission, saveDraftGrade, requestResubmission } = useTeacherCourses();
  const [activeId, setActiveId] = useState(null);
  const [filter, setFilter] = useState("all");
  const [sort, setSort] = useState("oldest");

  const enriched = useMemo(() => course.submissions.map((s) => ({ ...s, daysPending: daysAgo(s.submittedAt) })), [course.submissions]);

  const filtered = useMemo(() => {
    let list = enriched.filter((s) => s.status !== "graded");
    if (filter === "assignment") list = list.filter((s) => s.type === "assignment");
    else if (filter === "quiz") list = list.filter((s) => s.type === "quiz");
    else if (filter === "overdue") list = list.filter((s) => submissionUrgency(s.daysPending) === "danger");
    else if (filter === "graded") list = enriched.filter((s) => s.status === "graded");

    const sorted = [...list];
    if (sort === "oldest") sorted.sort((a, b) => b.daysPending - a.daysPending);
    else if (sort === "overdue") sorted.sort((a, b) => submissionUrgency(b.daysPending).localeCompare(submissionUrgency(a.daysPending)) || b.daysPending - a.daysPending);
    else if (sort === "student") sorted.sort((a, b) => a.studentName.localeCompare(b.studentName));
    else if (sort === "course") sorted.sort((a, b) => a.moduleTitle.localeCompare(b.moduleTitle));
    return sorted;
  }, [enriched, filter, sort]);

  const pendingQueue = useMemo(
    () => enriched.filter((s) => s.status !== "graded").sort((a, b) => b.daysPending - a.daysPending),
    [enriched]
  );
  const graded = enriched.filter((s) => s.status === "graded");

  const active = course.submissions.find((s) => s.id === activeId) || null;
  const activeLesson = active ? findLesson(course, active.lessonId) : null;
  const activeIndexInQueue = pendingQueue.findIndex((s) => s.id === activeId);
  const hasNext = activeIndexInQueue !== -1 && activeIndexInQueue < pendingQueue.length - 1;

  function openNext() {
    if (hasNext) setActiveId(pendingQueue[activeIndexInQueue + 1].id);
    else setActiveId(null);
  }

  const rowsToShow = filter === "graded" ? [] : filtered;
  const showGradedList = filter === "graded";

  return (
    <div className="flex flex-col gap-6">
      <section>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-base font-bold text-text">Grading queue</h2>
          <span className="rounded-full bg-warning/12 px-3 py-1 text-xs font-semibold text-warning">{pendingQueue.length} pending</span>
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTERS.map((f) => (
              <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} className="px-4 py-1.5 text-xs">
                {f.label}
              </Chip>
            ))}
          </div>
          <div className="relative">
            <Select
              value={sort}
              onChange={(e) => setSort(e.target.value)}
              className="rounded-full border border-text/15 bg-white py-2 pl-4 pr-9 text-xs font-semibold text-muted outline-none focus:border-primary"
            >
              {SORTS.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.label}
                </option>
              ))}
            </Select>
          </div>
        </div>

        {showGradedList ? (
          graded.length === 0 ? (
            <p className="rounded-3xl bg-white px-6 py-10 text-center text-sm text-muted shadow-soft">Nothing graded yet.</p>
          ) : (
            <div className="flex flex-col gap-2.5">
              {graded.map((s) => {
                const lesson = findLesson(course, s.lessonId);
                const maxScore = s.type === "quiz" ? s.manualMaxScore ?? 10 : lesson?.maxScore ?? 100;
                return (
                  <button key={s.id} type="button" onClick={() => setActiveId(s.id)} className="text-left">
                    <GradeSummaryCard title={`${s.studentName} · ${lesson?.title || s.moduleTitle}`} score={s.score} maxScore={maxScore} feedback={s.feedback} gradedAt={s.gradedAt} gradedBy={s.gradedBy} />
                  </button>
                );
              })}
            </div>
          )
        ) : rowsToShow.length === 0 ? (
          <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-14 text-center shadow-soft">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-success/12 text-success">
              <CheckIcon className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm font-medium text-text">You're all caught up! No submissions waiting to be graded.</p>
            <p className="mt-1 text-xs text-muted">New assignment and quiz submissions will show up here.</p>
          </div>
        ) : (
          <div className="flex flex-col divide-y divide-text/[0.06] rounded-3xl bg-white shadow-soft">
            {rowsToShow.map((s) => {
              const lesson = findLesson(course, s.lessonId);
              const TypeIcon = TYPE_ICON[s.content?.kind] || FileGenericIcon;
              const isQuiz = s.type === "quiz";
              const isDraft = s.status === "draft";
              const isResubmission = s.status === "resubmission_requested";
              return (
                <button key={s.id} type="button" onClick={() => setActiveId(s.id)} className="flex items-center gap-3 px-4 py-3.5 text-left transition-colors duration-150 hover:bg-bg">
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${isQuiz ? "bg-rotation-3/20 text-muted" : "bg-primary/[0.08] text-primary"}`}>
                    {isQuiz ? <QuizIcon className="h-4 w-4" /> : <AssignmentIcon className="h-4 w-4" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-text">{s.studentName}</p>
                    <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                      <TypeIcon className="h-3 w-3 shrink-0" />
                      {lesson?.title || s.moduleTitle} · Submitted {s.submittedAt}
                      {isDraft && <span className="shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-semibold text-primary">Draft saved</span>}
                      {isResubmission && <span className="shrink-0 rounded-full bg-warning/15 px-1.5 py-0.5 text-[10px] font-semibold text-warning">Resubmission requested</span>}
                    </p>
                  </div>
                  <UrgencyBadge days={s.daysPending} late={s.late} />
                </button>
              );
            })}
          </div>
        )}
      </section>

      {!showGradedList && graded.length > 0 && (
        <section>
          <h2 className="mb-3 text-base font-bold text-muted">Recently graded</h2>
          <div className="flex flex-col gap-2.5 opacity-90">
            {graded.map((s) => {
              const lesson = findLesson(course, s.lessonId);
              const maxScore = s.type === "quiz" ? s.manualMaxScore ?? 10 : lesson?.maxScore ?? 100;
              return (
                <button key={s.id} type="button" onClick={() => setActiveId(s.id)} className="text-left">
                  <GradeSummaryCard title={`${s.studentName} · ${lesson?.title || s.moduleTitle}`} score={s.score} maxScore={maxScore} feedback={s.feedback} gradedAt={s.gradedAt} gradedBy={s.gradedBy} />
                </button>
              );
            })}
          </div>
        </section>
      )}

      {active && (
        <GradingPanel
          submission={active}
          lesson={activeLesson}
          queuePosition={activeIndexInQueue + 1}
          queueTotal={pendingQueue.length}
          hasNext={hasNext}
          onClose={() => setActiveId(null)}
          onSave={(patch) => {
            gradeSubmission(course.id, active.id, patch);
            setActiveId(null);
          }}
          onSaveNext={(patch) => {
            gradeSubmission(course.id, active.id, patch);
            openNext();
          }}
          onSaveDraft={(patch) => {
            saveDraftGrade(course.id, active.id, patch);
            setActiveId(null);
          }}
          onRequestResubmission={(patch) => {
            requestResubmission(course.id, active.id, patch);
            setActiveId(null);
          }}
        />
      )}
    </div>
  );
}
