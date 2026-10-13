import { useRef, useState } from "react";
import LessonRow, { LESSON_TYPE_META } from "./LessonRow";
import IconBadge from "../../../components/ui/IconBadge";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { GripIcon, ChevronDownIcon, PlusIcon, TrashIcon, DuplicateIcon } from "../../../components/ui/icons";

function totalMinutes(lessons) {
  return lessons.reduce((sum, l) => {
    const [m, s] = String(l.duration || "0:00").split(":").map(Number);
    return sum + (m || 0) + (s || 0) / 60;
  }, 0);
}

function formatMinutes(total) {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

// ModuleCard — one collapsible module in the Curriculum list. Owns
// lesson-level drag reordering locally (swap-on-hover, commit on drop) and
// reports the new order up via onReorderLessons; module-level dragging
// (reordering whole modules) is driven by the handle props CurriculumBuilder
// passes in, since that reorder has to happen across cards, not within one.
export default function ModuleCard({
  module,
  index,
  expanded,
  onToggle,
  onRename,
  onDeleteModule,
  onDuplicateModule,
  onAddLesson,
  onSelectLesson,
  onDuplicateLesson,
  onDeleteLesson,
  onReorderLessons,
  activeLessonId,
  dragHandleProps,
  isDraggingModule,
  moduleDragOver,
}) {
  const [editingTitle, setEditingTitle] = useState(false);
  const [draftTitle, setDraftTitle] = useState(module.title);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);
  const [dragLessonIndex, setDragLessonIndex] = useState(null);
  const [overLessonIndex, setOverLessonIndex] = useState(null);

  useOnClickOutside(menuRef, () => setMenuOpen(false));

  const lessonsWithContent = module.lessons.filter((l) => l.hasContent).length;
  const durationLabel = module.lessons.length ? formatMinutes(totalMinutes(module.lessons)) : "0m";

  function commitTitle() {
    setEditingTitle(false);
    onRename(draftTitle.trim() || `Module ${index + 1}`);
  }

  function handleLessonDrop() {
    if (dragLessonIndex === null || overLessonIndex === null || dragLessonIndex === overLessonIndex) {
      setDragLessonIndex(null);
      setOverLessonIndex(null);
      return;
    }
    const next = [...module.lessons];
    const [moved] = next.splice(dragLessonIndex, 1);
    next.splice(overLessonIndex, 0, moved);
    onReorderLessons(next);
    setDragLessonIndex(null);
    setOverLessonIndex(null);
  }

  return (
    <div
      className={`rounded-3xl bg-white ring-1 transition-all duration-200 ${
        isDraggingModule ? "opacity-40 shadow-none" : "shadow-sm ring-text/[0.06]"
      } ${moduleDragOver ? "ring-2 ring-primary/40" : ""}`}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5">
        <span {...dragHandleProps} className="cursor-grab text-text/25 transition-colors active:cursor-grabbing hover:text-text/50">
          <GripIcon />
        </span>

        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
          {index + 1}
        </span>

        <div className="min-w-0 flex-1">
          {editingTitle ? (
            <input
              autoFocus
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => e.key === "Enter" && commitTitle()}
              className="w-full rounded-lg border border-primary/40 bg-bg px-2 py-1 text-sm font-semibold text-text outline-none"
            />
          ) : (
            <button
              type="button"
              onClick={() => setEditingTitle(true)}
              className="truncate text-left text-sm font-semibold text-text hover:text-primary"
              title="Click to rename"
            >
              {module.title}
            </button>
          )}
          <div className="mt-0.5 flex items-center gap-2 text-xs text-muted">
            <span>{module.lessons.length} lessons</span>
            <span aria-hidden="true">·</span>
            <span>{durationLabel}</span>
            {module.lessons.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className={lessonsWithContent === module.lessons.length ? "text-success" : ""}>
                  {lessonsWithContent}/{module.lessons.length} have content
                </span>
              </>
            )}
          </div>
        </div>

        <div className="relative flex shrink-0 items-center gap-1" ref={menuRef}>
          <button
            type="button"
            onClick={onDuplicateModule}
            aria-label="Duplicate module"
            className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary"
          >
            <DuplicateIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onDeleteModule}
            aria-label="Delete module"
            className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? "Collapse module" : "Expand module"}
            className="rounded-full p-1.5 text-muted hover:bg-bg"
          >
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
          </button>
        </div>
      </div>

      {/* Body */}
      {expanded && (
        <div className="border-t border-text/[0.06] px-3 pb-3.5 pt-2">
          {module.lessons.length === 0 && (
            <p className="px-2 py-3 text-sm text-muted">No lessons yet — add your first one below.</p>
          )}

          <div className="flex flex-col gap-0.5">
            {module.lessons.map((lesson, i) => (
              <div
                key={lesson.id}
                draggable
                onDragStart={() => setDragLessonIndex(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverLessonIndex(i);
                }}
                onDrop={handleLessonDrop}
                onDragEnd={() => {
                  setDragLessonIndex(null);
                  setOverLessonIndex(null);
                }}
              >
                <LessonRow
                  lesson={lesson}
                  active={activeLessonId === lesson.id}
                  dragging={dragLessonIndex === i}
                  dragOver={overLessonIndex === i && dragLessonIndex !== i}
                  onSelect={() => onSelectLesson(lesson)}
                  onDuplicate={() => onDuplicateLesson(lesson)}
                  onDelete={() => onDeleteLesson(lesson.id)}
                />
              </div>
            ))}
          </div>

          <div className="relative mt-2">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              className="flex w-full items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/[0.06]"
            >
              <PlusIcon className="h-4 w-4" />
              Add lesson
            </button>

            {menuOpen && (
              <div className="absolute left-0 top-full z-10 mt-1 w-48 overflow-hidden rounded-2xl bg-white py-1 shadow-lg">
                {Object.entries(LESSON_TYPE_META).map(([type, { label, Icon, tone }]) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      onAddLesson(type);
                      setMenuOpen(false);
                    }}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-text transition-colors duration-150 hover:bg-bg"
                  >
                    <IconBadge tone={tone} size="xs"><Icon className="h-3.5 w-3.5" /></IconBadge>
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
