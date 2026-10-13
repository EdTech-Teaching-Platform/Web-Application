import { useEffect, useState } from "react";
import { LESSON_TYPE_META } from "./LessonRow";
import GradeSummaryCard from "./GradeSummaryCard";
import { CheckIcon, XIcon, CertificateIcon } from "../../../components/ui/icons";

function findLesson(course, lessonId) {
  for (const m of course.modules) {
    const l = m.lessons.find((les) => les.id === lessonId);
    if (l) return l;
  }
  return null;
}

// StudentProgressDrawer — the slide-over panel Students tab's "View
// Progress Detail" row action opens. A right-edge drawer rather than the
// shared Modal (which centers) since this needs to feel like drilling into
// one row, not a separate dialog — same fade+slide entrance timing as
// Modal (200ms ease-out) per design.md's shared shell motion rule.
export default function StudentProgressDrawer({ student, course, onClose }) {
  const [entered, setEntered] = useState(false);
  const open = Boolean(student);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const flat = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const completeCount = Math.round((student.progress / 100) * flat.length);
  const gradedSubmissions = (course.submissions || []).filter((s) => s.status === "graded" && (s.studentId === student.id || s.studentName === student.name));

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-text/50 transition-opacity duration-200 ease-out ${entered ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex h-full w-full max-w-md flex-col overflow-hidden rounded-l-3xl bg-bg shadow-elevated transition-transform duration-200 ease-out ${
          entered ? "translate-x-0" : "translate-x-4 opacity-0"
        }`}
      >
        <div className="flex items-center justify-between border-b border-text/[0.07] bg-white px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-text">{student.name}</p>
            <p className="text-xs text-muted">{student.progress}% complete · {completeCount}/{flat.length} lessons</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-text">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4">
          <div className="mb-4 h-2 w-full overflow-hidden rounded-full bg-white ring-1 ring-text/[0.06]">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${student.progress}%` }} />
          </div>

          {gradedSubmissions.length > 0 && (
            <div className="mb-5">
              <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <CertificateIcon className="h-3.5 w-3.5" />
                Grades
              </p>
              <div className="flex flex-col gap-2">
                {gradedSubmissions.map((s) => {
                  const lesson = findLesson(course, s.lessonId);
                  const maxScore = s.type === "quiz" ? s.manualMaxScore ?? 10 : lesson?.maxScore ?? 100;
                  return (
                    <GradeSummaryCard key={s.id} title={lesson?.title || s.moduleTitle} score={s.score} maxScore={maxScore} feedback={s.feedback} gradedAt={s.gradedAt} gradedBy={s.gradedBy} />
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1">
            {flat.map((lesson, i) => {
              const done = i < completeCount;
              const meta = LESSON_TYPE_META[lesson.type];
              return (
                <div key={lesson.id} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 shadow-soft">
                  <span
                    className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                      done ? "bg-success/15 text-success" : "bg-text/[0.06] text-muted"
                    }`}
                  >
                    {done ? <CheckIcon className="h-3.5 w-3.5" /> : <meta.Icon className="h-3 w-3" />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm text-text">{lesson.title || "Untitled lesson"}</p>
                    <p className="truncate text-xs text-muted">{lesson.moduleTitle}</p>
                  </div>
                  {!done && <span className="shrink-0 text-[11px] font-medium text-muted">Not started</span>}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
