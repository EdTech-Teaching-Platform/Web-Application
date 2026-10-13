import { useState } from "react";
import { LESSON_TYPE_META } from "./LessonRow";
import IconBadge from "../../../components/ui/IconBadge";
import { lessonStatus } from "./contentData";
import { AlertTriangleIcon, ArrowRightIcon, CheckIcon, ChevronDownIcon, XIcon } from "../../../components/ui/icons";

// Status dot: kept inside design.md's success/warning/neutral palette
// (never a rotation color for status) — "added" and "ready" share the
// success hue and are told apart by outline-vs-filled check instead of a
// fourth hue, same rule contentData.lessonStatus documents.
const STATUS_DOT = {
  empty: "border border-text/25 bg-transparent",
  "in-progress": "bg-warning",
  added: "border border-success bg-transparent",
  ready: "bg-success",
};

const STATUS_LABEL = {
  empty: "Empty",
  "in-progress": "In progress",
  added: "Content added",
  ready: "Ready",
};

function StatusDot({ status }) {
  return (
    <span
      title={STATUS_LABEL[status]}
      className={`h-2.5 w-2.5 shrink-0 rounded-full transition-colors duration-150 ${STATUS_DOT[status]}`}
    />
  );
}

function SummaryStrip({ modules, onJumpEmpty, hasEmpty }) {
  const total = modules.reduce((s, m) => s + m.lessons.length, 0);
  const withContent = modules.reduce((s, m) => s + m.lessons.filter((l) => lessonStatus(l, false) !== "empty").length, 0);
  const empty = total - withContent;
  const pct = total ? Math.round((withContent / total) * 100) : 0;

  return (
    <div className="border-b border-text/[0.07] px-4 py-4">
      <div className="flex items-baseline justify-between gap-3">
        <div className="flex items-baseline gap-4 text-sm">
          <span className="font-semibold text-text">{total} lessons</span>
          <span className="text-success">{withContent} added</span>
          <span className="text-muted">{empty} empty</span>
        </div>
      </div>
      <div className="mt-2.5 h-1.5 w-full overflow-hidden rounded-full bg-text/[0.07]">
        <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: `${pct}%` }} />
      </div>
      {hasEmpty && (
        <button
          type="button"
          onClick={onJumpEmpty}
          className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border border-dashed border-primary/40 py-2 text-xs font-semibold text-primary transition-colors duration-150 hover:bg-primary/[0.05]"
        >
          Jump to next empty lesson
          <ArrowRightIcon className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}

function LessonLeaf({ lesson, active, onSelect }) {
  const meta = LESSON_TYPE_META[lesson.type];
  const status = lessonStatus(lesson, active);
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left transition-colors duration-150 ${
        active ? "bg-primary/[0.08] ring-1 ring-primary/25" : "hover:bg-bg"
      }`}
    >
      <StatusDot status={status} />
      <IconBadge tone={meta.tone} size="xs" className="!h-6 !w-6">
        <meta.Icon className="h-3.5 w-3.5" />
      </IconBadge>
      <span className="min-w-0 flex-1 truncate text-sm text-text">{lesson.title || "Untitled lesson"}</span>
    </button>
  );
}

function ModuleGroup({ module, activeLessonId, onSelect, defaultOpen }) {
  const [open, setOpen] = useState(defaultOpen);
  const noneHaveContent = module.lessons.length > 0 && module.lessons.every((l) => lessonStatus(l, l.id === activeLessonId) === "empty");

  return (
    <div className="mb-1.5">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left"
      >
        <ChevronDownIcon className={`h-3.5 w-3.5 shrink-0 text-muted transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
        <span className="min-w-0 flex-1 truncate text-xs font-semibold uppercase tracking-wide text-muted">{module.title}</span>
        <span className="shrink-0 text-[11px] text-muted">{module.lessons.length}</span>
      </button>

      {noneHaveContent && (
        <div className="mx-2 mb-1.5 flex items-center gap-1.5 rounded-lg bg-warning/10 px-2.5 py-1.5 text-[11px] font-medium text-warning">
          <AlertTriangleIcon className="h-3 w-3 shrink-0" />
          No content added yet in this module
        </div>
      )}

      {open && (
        <div className="flex flex-col gap-0.5 pl-1">
          {module.lessons.map((lesson) => (
            <LessonLeaf
              key={lesson.id}
              lesson={lesson}
              active={activeLessonId === lesson.id}
              onSelect={() => onSelect(lesson, module.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ContentLessonTree — the curriculum mirror on the left (nav rail on
// desktop, a slide-in drawer on smaller viewports since there's no room for
// a fixed rail once the editor panel needs its own width). All content
// lives in `modules`; this component only navigates it via onSelect.
export default function ContentLessonTree({ modules, activeLessonId, onSelect, mobileOpen, onCloseMobile }) {
  const flat = modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleId: m.id })));
  const firstEmpty = flat.find((l) => lessonStatus(l, l.id === activeLessonId) === "empty");

  function jumpToEmpty() {
    if (!firstEmpty) return;
    onSelect(firstEmpty, firstEmpty.moduleId);
  }

  const body = (
    <div className="flex h-full flex-col">
      <SummaryStrip modules={modules} onJumpEmpty={jumpToEmpty} hasEmpty={Boolean(firstEmpty)} />
      <div className="flex-1 overflow-y-auto px-2 py-3">
        {modules.map((m, i) => (
          <ModuleGroup key={m.id} module={m} activeLessonId={activeLessonId} onSelect={onSelect} defaultOpen={i === 0} />
        ))}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop rail */}
      <div className="hidden w-72 shrink-0 rounded-3xl bg-white lg:block lg:sticky lg:top-4 lg:h-[calc(100vh-6rem)] shadow-soft">
        {body}
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 flex lg:hidden">
          <button type="button" aria-label="Close curriculum" onClick={onCloseMobile} className="absolute inset-0 bg-text/40" />
          <div className="relative flex h-full w-[85%] max-w-xs flex-col bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-text/[0.07] px-4 py-3">
              <span className="text-sm font-semibold text-text">Curriculum</span>
              <button type="button" onClick={onCloseMobile} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-bg">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            <div className="flex-1 overflow-hidden">{body}</div>
          </div>
        </div>
      )}
    </>
  );
}

export { STATUS_DOT, STATUS_LABEL };
