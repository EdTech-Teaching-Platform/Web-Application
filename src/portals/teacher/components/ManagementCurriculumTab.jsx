import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LESSON_TYPE_META } from "./LessonRow";
import { editableSections } from "./contentData";
import { lessonCompletionPct } from "../data/teacherCourses";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import Button from "../../../components/ui/Button";
import HomeworkUploadPanel from "./HomeworkUploadPanel";
import {
  ChevronDownIcon,
  LockIcon,
  PencilIcon,
  UploadIcon,
  DownloadFileIcon,
  TrashIcon,
  FileGenericIcon,
  ClockIcon,
} from "../../../components/ui/icons";

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>
  );
}

function LockTip({ text }) {
  return (
    <span className="group relative inline-flex">
      <LockIcon className="h-3.5 w-3.5 cursor-help text-muted" />
      <span className="pointer-events-none absolute left-1/2 top-5 z-10 w-48 -translate-x-1/2 rounded-xl bg-text px-3 py-2 text-[11px] leading-relaxed text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100">
        {text}
      </span>
    </span>
  );
}

function LessonManagementRow({ lesson, index, locked, lockReason, onShareHomework }) {
  const meta = LESSON_TYPE_META[lesson.type];
  const pct = lessonCompletionPct(index);
  return (
    <div className="group flex items-center gap-3 rounded-xl px-3 py-2.5 transition-colors duration-150 hover:bg-bg">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-text/[0.05] text-muted">
        <meta.Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-text">{lesson.title || "Untitled lesson"}</span>
          {locked && <LockTip text={lockReason} />}
          {lesson.preview && (
            <span className="shrink-0 rounded-full bg-rotation-3/20 px-1.5 py-0.5 text-[10px] font-semibold text-muted">Preview</span>
          )}
        </div>
        <span className="text-xs text-muted">
          {meta.label}
          {lesson.duration ? ` · ${lesson.duration}` : ""}
        </span>
      </div>
      <button
        type="button"
        onClick={() => onShareHomework(lesson.id)}
        className="shrink-0 rounded-full p-1.5 text-text/0 transition-colors duration-150 hover:bg-primary/10 hover:text-primary group-hover:text-text/35"
        title="Share Homework / Notes for this lesson"
        aria-label="Share Homework / Notes for this lesson"
      >
        <UploadIcon className="h-3.5 w-3.5" />
      </button>
      <span
        className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
          pct >= 70 ? "bg-success/12 text-success" : pct >= 35 ? "bg-warning/12 text-warning" : "bg-danger/12 text-danger"
        }`}
      >
        {pct}% completion
      </span>
    </div>
  );
}

function ModuleManagementCard({ module, index, defaultOpen, locked, lockReason, onShareHomework }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex w-full items-center gap-3 px-4 py-3.5 text-left">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-text">{module.title}</span>
        <span className="shrink-0 text-xs text-muted">{module.lessons.length} lessons</span>
        <ChevronDownIcon className={`h-4 w-4 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="flex flex-col gap-0.5 border-t border-text/[0.06] px-3 pb-3 pt-2">
          {module.lessons.length === 0 ? (
            <p className="px-2 py-3 text-sm text-muted">No lessons in this module yet.</p>
          ) : (
            module.lessons.map((lesson, i) => (
              <LessonManagementRow key={lesson.id} lesson={lesson} index={i} locked={locked} lockReason={lockReason} onShareHomework={onShareHomework} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

const ATTACH_LABEL = { course: "Course-wide", module: "Module", lesson: "Lesson" };

function findModuleForLesson(course, lessonId) {
  return course.modules.find((m) => m.lessons.some((l) => l.id === lessonId));
}

function SharedMaterialsSection({ course, onOpenPanel, onRemove }) {
  const items = course.homeworkItems || [];
  return (
    <section>
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-base font-bold text-text">Shared materials</h2>
        <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-sm" onClick={() => onOpenPanel(null)}>
          <UploadIcon className="h-3.5 w-3.5" />
          Share Homework / Notes
        </Button>
      </div>
      {items.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-12 text-center shadow-soft">
          <span className="flex h-12 w-12 items-center justify-center rounded-full bg-text/[0.06] text-muted">
            <FileGenericIcon className="h-5 w-5" />
          </span>
          <p className="mt-3 text-sm font-medium text-text">No homework or notes shared yet</p>
          <Button variant="secondary" fullWidth={false} className="mt-3 px-4 py-2 text-xs" onClick={() => onOpenPanel(null)}>
            Share Homework / Notes
          </Button>
        </div>
      ) : (
        <div className="flex flex-col divide-y divide-text/[0.06] rounded-3xl bg-white shadow-soft">
          {items.map((h) => {
            let context = ATTACH_LABEL.course;
            if (h.attachTo.level === "lesson") {
              const mod = course.modules.find((m) => m.id === h.attachTo.moduleId);
              const lesson = mod?.lessons.find((l) => l.id === h.attachTo.lessonId);
              context = lesson?.title || ATTACH_LABEL.lesson;
            } else if (h.attachTo.level === "module") {
              const mod = course.modules.find((m) => m.id === h.attachTo.moduleId);
              context = mod?.title || ATTACH_LABEL.module;
            }
            const isScheduled = h.availability === "scheduled";
            return (
              <div key={h.id} className="flex items-center gap-3 px-4 py-3.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
                  <FileGenericIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{h.title}</p>
                  <p className="truncate text-xs text-muted">
                    {context} · {h.files.length} file{h.files.length === 1 ? "" : "s"} · Shared {h.sharedAt}
                  </p>
                </div>
                <span
                  className={`shrink-0 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                    isScheduled ? "bg-warning/12 text-warning" : "bg-success/12 text-success"
                  }`}
                >
                  {isScheduled && <ClockIcon className="h-3 w-3" />}
                  {isScheduled ? "Scheduled" : "Live"}
                </span>
                <button type="button" title="Download" className="shrink-0 rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
                  <DownloadFileIcon className="h-4 w-4" />
                </button>
                <button type="button" title="Remove" onClick={() => onRemove(h.id)} className="shrink-0 rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}

// ManagementCurriculumTab — a read/manage mirror of CurriculumBuilder's
// module/lesson tree (same collapsible cards, same lesson type icons) but
// with management-oriented info layered in instead of edit controls:
// per-lesson completion badges and a lock indicator once the doc's
// "curriculum locks after enrollment on a published course" rule applies.
// Structural changes still only happen in the real builder, reached via
// Edit Curriculum below.
export default function ManagementCurriculumTab({ course }) {
  const navigate = useNavigate();
  const { shareHomework, removeHomework } = useTeacherCourses();
  const [homeworkPanel, setHomeworkPanel] = useState(null); // { moduleId, lessonId } | null when closed; {} when open with no preset
  const [toast, setToast] = useState("");
  const sections = editableSections(course.status);

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  function openHomeworkPanel(lessonId) {
    if (!lessonId) {
      setHomeworkPanel({});
      return;
    }
    const mod = findModuleForLesson(course, lessonId);
    setHomeworkPanel({ moduleId: mod?.id, lessonId });
  }
  const hasEnrollments = course.students.length > 0;
  const locked = !sections.curriculum || (course.status === "published" && hasEnrollments);
  const lockReason =
    course.status === "pending_review"
      ? "Curriculum can't be edited while this course is under review."
      : course.status === "archived"
      ? "This course is archived and read-only."
      : hasEnrollments
      ? "Curriculum is locked once a published course has enrollments."
      : "Curriculum is locked once a course is published.";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-3xl bg-white p-4 sm:p-5 shadow-soft">
        <div className="flex items-center gap-2 text-sm text-muted">
          {locked ? (
            <>
              <LockIcon className="h-4 w-4 text-muted" />
              <span>{lockReason}</span>
            </>
          ) : (
            <span>Structural changes (add/remove/reorder) happen in the full builder.</span>
          )}
        </div>
        <Button
          variant="secondary"
          fullWidth={false}
          className="flex shrink-0 items-center gap-2 px-4 py-2 text-sm"
          onClick={() => navigate(`/teacher/coursebuilder/${course.id}`)}
        >
          <PencilIcon className="h-3.5 w-3.5" />
          Edit Curriculum
        </Button>
      </div>

      <div className="flex flex-col gap-3">
        {course.modules.map((m, i) => (
          <ModuleManagementCard key={m.id} module={m} index={i} defaultOpen={i === 0} locked={locked} lockReason={lockReason} onShareHomework={openHomeworkPanel} />
        ))}
      </div>

      <SharedMaterialsSection
        course={course}
        onOpenPanel={openHomeworkPanel}
        onRemove={(id) => {
          removeHomework(course.id, id);
          flash("Material removed.");
        }}
      />

      <HomeworkUploadPanel
        open={Boolean(homeworkPanel)}
        course={course}
        presetAttach={homeworkPanel}
        onClose={() => setHomeworkPanel(null)}
        onShare={(item) => {
          shareHomework(course.id, item);
          setHomeworkPanel(null);
          flash("Shared with students.");
        }}
      />
      <Toast message={toast} />
    </div>
  );
}
