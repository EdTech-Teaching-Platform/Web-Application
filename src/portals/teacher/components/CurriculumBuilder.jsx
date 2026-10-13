import { useState } from "react";
import ModuleCard from "./ModuleCard";
import LessonPanel from "./LessonPanel";
import { PlusIcon, SparkleIcon } from "../../../components/ui/icons";

function totalMinutes(modules) {
  return modules.reduce(
    (sum, m) =>
      sum +
      m.lessons.reduce((s, l) => {
        const [mm, ss] = String(l.duration || "0:00").split(":").map(Number);
        return s + (mm || 0) + (ss || 0) / 60;
      }, 0),
    0
  );
}

function formatTotal(total) {
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  return `${h}h ${m}m`;
}

// CurriculumBuilder — Part 2 of Course Builder: the module/lesson tree,
// drag-reorderable at both levels, plus the lesson-editing side panel. All
// state lives here and is lifted up via `onChange` (curriculum is part of
// the same autosaved course draft as Course Details).
export default function CurriculumBuilder({ modules, onChange }) {
  const [expandedId, setExpandedId] = useState(modules[0]?.id ?? null);
  const [activeLesson, setActiveLesson] = useState(null);
  const [dragModuleIndex, setDragModuleIndex] = useState(null);
  const [overModuleIndex, setOverModuleIndex] = useState(null);

  const totalLessons = modules.reduce((s, m) => s + m.lessons.length, 0);
  const lessonsWithContent = modules.reduce((s, m) => s + m.lessons.filter((l) => l.hasContent).length, 0);

  function updateModule(id, patch) {
    onChange(modules.map((m) => (m.id === id ? { ...m, ...patch } : m)));
  }

  function addModule() {
    const newModule = { id: crypto.randomUUID(), title: `Module ${modules.length + 1}`, lessons: [] };
    onChange([...modules, newModule]);
    setExpandedId(newModule.id);
  }

  function duplicateModule(mod) {
    const copy = {
      ...mod,
      id: crypto.randomUUID(),
      title: `${mod.title} (copy)`,
      lessons: mod.lessons.map((l) => ({ ...l, id: crypto.randomUUID() })),
    };
    const idx = modules.findIndex((m) => m.id === mod.id);
    const next = [...modules];
    next.splice(idx + 1, 0, copy);
    onChange(next);
  }

  function deleteModule(id) {
    onChange(modules.filter((m) => m.id !== id));
  }

  function addLesson(mod, type) {
    const lesson = { id: crypto.randomUUID(), type, title: "", duration: "", hasContent: false, preview: false };
    updateModule(mod.id, { lessons: [...mod.lessons, lesson] });
    setActiveLesson(lesson);
  }

  function duplicateLesson(mod, lesson) {
    const copy = { ...lesson, id: crypto.randomUUID(), title: `${lesson.title || "Untitled lesson"} (copy)` };
    const idx = mod.lessons.findIndex((l) => l.id === lesson.id);
    const next = [...mod.lessons];
    next.splice(idx + 1, 0, copy);
    updateModule(mod.id, { lessons: next });
  }

  function deleteLesson(mod, lessonId) {
    updateModule(mod.id, { lessons: mod.lessons.filter((l) => l.id !== lessonId) });
    if (activeLesson?.id === lessonId) setActiveLesson(null);
  }

  function changeLesson(mod, updated) {
    updateModule(mod.id, { lessons: mod.lessons.map((l) => (l.id === updated.id ? updated : l)) });
    setActiveLesson(updated);
  }

  function handleModuleDrop() {
    if (dragModuleIndex === null || overModuleIndex === null || dragModuleIndex === overModuleIndex) {
      setDragModuleIndex(null);
      setOverModuleIndex(null);
      return;
    }
    const next = [...modules];
    const [moved] = next.splice(dragModuleIndex, 1);
    next.splice(overModuleIndex, 0, moved);
    onChange(next);
    setDragModuleIndex(null);
    setOverModuleIndex(null);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Sticky summary */}
      <div className="sticky top-0 z-10 -mx-1 flex flex-wrap items-center gap-x-8 gap-y-2 rounded-2xl bg-white/90 px-5 py-4 ring-1 ring-text/[0.06] backdrop-blur">
        <Stat label="Modules" value={modules.length} />
        <Stat label="Lessons" value={totalLessons} />
        <Stat label="Total duration" value={formatTotal(totalMinutes(modules))} />
        <Stat
          label="Content complete"
          value={totalLessons ? `${lessonsWithContent}/${totalLessons}` : "—"}
        />
        <div className="ml-auto h-2 w-full max-w-[160px] overflow-hidden rounded-full bg-text/[0.06] sm:w-auto">
          <div
            className="h-full rounded-full bg-success transition-all duration-300"
            style={{ width: `${totalLessons ? (lessonsWithContent / totalLessons) * 100 : 0}%` }}
          />
        </div>
      </div>

      {modules.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
            <SparkleIcon />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-text">Start building your curriculum</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Break your course into modules, then add lessons inside each one — videos, articles, quizzes and more.
          </p>
          <button
            type="button"
            onClick={addModule}
            className="mt-6 flex items-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-soft"
          >
            <PlusIcon className="h-4 w-4" />
            Add your first module
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {modules.map((mod, i) => (
            <div
              key={mod.id}
              draggable
              onDragStart={() => setDragModuleIndex(i)}
              onDragOver={(e) => {
                e.preventDefault();
                setOverModuleIndex(i);
              }}
              onDrop={handleModuleDrop}
              onDragEnd={() => {
                setDragModuleIndex(null);
                setOverModuleIndex(null);
              }}
            >
              <ModuleCard
                module={mod}
                index={i}
                expanded={expandedId === mod.id}
                onToggle={() => setExpandedId(expandedId === mod.id ? null : mod.id)}
                onRename={(title) => updateModule(mod.id, { title })}
                onDeleteModule={() => deleteModule(mod.id)}
                onDuplicateModule={() => duplicateModule(mod)}
                onAddLesson={(type) => addLesson(mod, type)}
                onSelectLesson={(lesson) => setActiveLesson(lesson)}
                onDuplicateLesson={(lesson) => duplicateLesson(mod, lesson)}
                onDeleteLesson={(lessonId) => deleteLesson(mod, lessonId)}
                onReorderLessons={(lessons) => updateModule(mod.id, { lessons })}
                activeLessonId={activeLesson?.id}
                isDraggingModule={dragModuleIndex === i}
                moduleDragOver={overModuleIndex === i && dragModuleIndex !== i}
                dragHandleProps={{}}
              />
            </div>
          ))}

          <button
            type="button"
            onClick={addModule}
            className="flex items-center justify-center gap-2 rounded-full border-2 border-dashed border-text/15 py-5 text-sm font-semibold text-muted transition-colors duration-150 hover:border-primary hover:bg-primary/[0.03] hover:text-primary"
          >
            <PlusIcon className="h-4 w-4" />
            Add Module
          </button>
        </div>
      )}

      <LessonPanel
        lesson={activeLesson}
        onClose={() => setActiveLesson(null)}
        onChange={(updated) => {
          const mod = modules.find((m) => m.lessons.some((l) => l.id === updated.id));
          if (mod) changeLesson(mod, updated);
        }}
        onDelete={() => {
          const mod = modules.find((m) => m.lessons.some((l) => l.id === activeLesson.id));
          if (mod) deleteLesson(mod, activeLesson.id);
        }}
      />
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="text-lg font-semibold text-text">{value}</span>
      <span className="text-xs text-muted">{label}</span>
    </div>
  );
}
