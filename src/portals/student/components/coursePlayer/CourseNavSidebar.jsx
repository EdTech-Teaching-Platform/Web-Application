import { useState } from "react";
import { CheckIcon, ChevronDownIcon, CircleIcon, PlayIcon, VideoIcon } from "../../../../components/ui/icons";
import { LESSON_TYPE_ICON } from "./lessonContent";

// Left-hand Course Navigation rail (spec Section 1). Not the FilterPill-
// style Accordion component — that one is fixed to a plain
// question/answer text pattern (see design.md/Accordion.jsx), and this
// needs custom per-lesson rows (icon + duration + state), so it's its own
// small collapsible list, same "new, portal-local, single consumer today"
// pattern as GoalRing/StreakRow from the Dashboard restyle.
function LessonRow({ lesson, state, active, onSelect, isRecording }) {
  const TypeIcon = LESSON_TYPE_ICON[lesson.type] ?? CircleIcon;
  const isCompleted = state.status === "completed";
  const isInProgress = state.status === "in-progress";

  // Live-session recording lessons get their own distinct card treatment
  // (not just a highlight color) so they don't blend in as "just another
  // lesson" — see CoursePlayer's Recorded Live Session summary card above.
  if (isRecording) {
    return (
      <button
        type="button"
        onClick={onSelect}
        aria-current={active ? "true" : undefined}
        className={`flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors duration-150 ${
          active
            ? "border-primary bg-primary text-white"
            : "border-primary/20 bg-primary/5 text-text hover:bg-primary/10"
        }`}
      >
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${active ? "bg-white/20" : "bg-primary/15"}`}>
          <VideoIcon className={`h-3.5 w-3.5 ${active ? "text-white" : "text-primary"}`} />
        </span>
        <span className="min-w-0 flex-1">
          <span className={`block truncate text-sm ${active ? "font-semibold" : "font-medium"}`}>{lesson.title}</span>
          <span className={`block text-[10px] font-bold uppercase tracking-wide ${active ? "text-white/70" : "text-primary/70"}`}>
            Recorded live session
          </span>
        </span>
        <span className={`shrink-0 text-xs ${active ? "text-white/70" : "text-text/40"}`}>{lesson.duration}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={active ? "true" : undefined}
      className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
        active ? "bg-primary text-white" : "text-text hover:bg-text/5"
      }`}
    >
      <span className="shrink-0">
        {isCompleted ? (
          <CheckIcon className={`h-4 w-4 ${active ? "text-white" : "text-success"}`} />
        ) : active ? (
          <PlayIcon className="h-4 w-4 text-white" />
        ) : isInProgress ? (
          <span className={`block h-2.5 w-2.5 rounded-full ${active ? "bg-white" : "bg-warning"}`} aria-hidden="true" />
        ) : (
          <CircleIcon className={active ? "text-white" : "text-text/25"} />
        )}
      </span>
      <TypeIcon className={`h-4 w-4 shrink-0 ${active ? "text-white/80" : "text-text/35"}`} />
      <span className={`min-w-0 flex-1 truncate text-sm ${isCompleted && !active ? "text-text/60" : ""} ${active ? "font-semibold" : ""}`}>
        {lesson.title}
      </span>
      <span className={`shrink-0 text-xs ${active ? "text-white/70" : "text-text/40"}`}>{lesson.duration}</span>
    </button>
  );
}

function ModuleSection({ module, lessons, getLessonState, currentLessonId, onSelectLesson, defaultOpen, recordingLessonId }) {
  const [open, setOpen] = useState(defaultOpen);
  const completedCount = lessons.filter((l) => getLessonState(l.id).status === "completed").length;
  const modulePercent = lessons.length ? Math.round((completedCount / lessons.length) * 100) : 0;

  return (
    <div className="border-b border-text/10 pb-2 pt-3 first:pt-0">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-2 px-1 py-1.5 text-left"
      >
        <span className="min-w-0">
          <span className="block truncate font-display text-sm font-semibold text-text">{module.title}</span>
          <span className="text-xs text-text/45">
            {completedCount}/{lessons.length} complete
          </span>
        </span>
        <ChevronDownIcon
          className={`h-4 w-4 shrink-0 text-text/40 transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`}
        />
      </button>
      <div
        className="overflow-hidden transition-[max-height,opacity] duration-250 ease-out"
        style={{ maxHeight: open ? `${lessons.length * 56 + 16}px` : "0px", opacity: open ? 1 : 0 }}
      >
        <div className="mt-1 space-y-0.5 pb-1">
          {lessons.map((lesson) => (
            <LessonRow
              key={lesson.id}
              lesson={lesson}
              state={getLessonState(lesson.id)}
              active={lesson.id === currentLessonId}
              onSelect={() => onSelectLesson(lesson.id)}
              isRecording={lesson.id === recordingLessonId}
            />
          ))}
        </div>
        {/* fine mustard sliver showing this module's own completion, echoing the course-level bar above without a second numeric readout */}
        <div className="mx-1 mb-2 h-1 overflow-hidden rounded-full bg-text/10">
          <div className="h-full rounded-full bg-primary/50 transition-[width] duration-300 ease-out" style={{ width: `${modulePercent}%` }} />
        </div>
      </div>
    </div>
  );
}

export default function CourseNavSidebar({
  course,
  curriculum,
  getLessonState,
  currentLessonId,
  courseProgressPercent,
  onSelectLesson,
  recordingLessonId = null,
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 border-b border-text/10 p-4">
        <h2 className="font-display text-base font-bold leading-snug text-text">{course.title}</h2>
        <div className="mt-3">
          <div className="flex items-baseline justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-text/45">Course Progress</span>
            <span className="text-sm font-bold text-primary">{courseProgressPercent}% Complete</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-text/10">
            <div
              className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out"
              style={{ width: `${courseProgressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Independently scrollable module/lesson list — spec: "Keep the
          navigation scrollable independently if the lesson list becomes
          long." */}
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-1">
        {curriculum.map((module, i) => (
          <ModuleSection
            key={module.id}
            module={module}
            lessons={module.lessons}
            getLessonState={getLessonState}
            currentLessonId={currentLessonId}
            onSelectLesson={onSelectLesson}
            defaultOpen={module.lessons.some((l) => l.id === currentLessonId) || i === 0}
            recordingLessonId={recordingLessonId}
          />
        ))}
      </div>
    </div>
  );
}
