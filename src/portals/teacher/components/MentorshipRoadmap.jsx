import { useEffect, useRef, useState } from "react";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { milestoneStatus } from "../data/mentorshipData";
import { formatDateLabel } from "../data/teacherAvailability";
import { CheckIcon, ClockIcon, GripIcon, PencilIcon, PlusIcon, TrashIcon, AlertTriangleIcon } from "../../../components/ui/icons";

const NODE_STYLES = {
  completed: { dot: "bg-success text-white", ring: "ring-success/30", line: "bg-success" },
  in_progress: { dot: "bg-primary text-white", ring: "ring-primary/30", line: "bg-primary/30" },
  overdue: { dot: "bg-danger text-white", ring: "ring-danger/30", line: "bg-danger/30" },
  upcoming: { dot: "bg-white text-muted ring-1 ring-text/15", ring: "ring-transparent", line: "bg-text/[0.08]" },
};

function MilestoneEditorModal({ open, milestone, onClose, onSave, onDelete }) {
  const [title, setTitle] = useState("");
  const [targetDate, setTargetDate] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(milestone?.title || "");
    setTargetDate(milestone?.targetDate || "");
    setDescription(milestone?.description || "");
  }, [open, milestone]);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={milestone?.id ? "Edit milestone" : "Add milestone"}
      footer={
        <>
          <Button fullWidth={false} className="px-6" disabled={!title.trim()} onClick={() => onSave({ title: title.trim(), targetDate, description: description.trim() })}>
            Save
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
          {milestone?.id && (
            <Button
              variant="secondary"
              fullWidth={false}
              className="border-danger text-danger hover:bg-danger/5"
              onClick={() => onDelete(milestone.id)}
            >
              Delete
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Target date</span>
          <input
            type="date"
            value={targetDate}
            onChange={(e) => setTargetDate(e.target.value)}
            className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Description</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            className="w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
      </div>
    </Modal>
  );
}

function CompleteMilestoneRow({ milestone, onComplete }) {
  const [reflection, setReflection] = useState("");
  const [celebrating, setCelebrating] = useState(false);

  function handleComplete() {
    setCelebrating(true);
    window.setTimeout(() => onComplete(milestone.id, reflection.trim()), 420);
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5 rounded-xl bg-primary/[0.05] p-3.5">
      <textarea
        value={reflection}
        onChange={(e) => setReflection(e.target.value)}
        rows={2}
        placeholder="Optional reflection — what happened in this milestone? (visible to you, added to the reflection log)"
        className="w-full resize-none rounded-lg border border-text/15 bg-white px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
      />
      <Button
        fullWidth={false}
        className={`flex w-fit items-center gap-1.5 px-4 py-2 text-xs transition-transform duration-300 ${celebrating ? "scale-110" : "scale-100"}`}
        onClick={handleComplete}
      >
        <CheckIcon className="h-3.5 w-3.5" />
        Mark milestone complete
      </Button>
    </div>
  );
}

// MentorshipRoadmap — horizontal stepper on desktop (sm:+), collapsing to
// a vertical stepper on mobile. Drag-to-reorder mirrors ModuleCard.jsx's
// exact mechanism (draggable + onDragOver/preventDefault + onDrop/splice).
// A completed node gets a brief scale "pop" (opacity/transform only, no
// bounce/confetti) — the app's existing motion language, not a new one.
export default function MentorshipRoadmap({ mentorship, onAdd, onUpdate, onRemove, onReorder, onComplete }) {
  const [editing, setEditing] = useState(null); // milestone object, or {} for "add"
  const [expandedId, setExpandedId] = useState(null);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);
  const [justCompleted, setJustCompleted] = useState(null);
  const prevCompletedIds = useRef(new Set(mentorship.milestones.filter((m) => m.completedAt).map((m) => m.id)));

  useEffect(() => {
    const nowCompleted = mentorship.milestones.filter((m) => m.completedAt).map((m) => m.id);
    const newlyDone = nowCompleted.find((id) => !prevCompletedIds.current.has(id));
    if (newlyDone) {
      setJustCompleted(newlyDone);
      window.setTimeout(() => setJustCompleted(null), 650);
    }
    prevCompletedIds.current = new Set(nowCompleted);
  }, [mentorship.milestones]);

  const milestones = mentorship.milestones;

  function handleDrop() {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    const next = [...milestones];
    const [moved] = next.splice(dragIndex, 1);
    next.splice(overIndex, 0, moved);
    onReorder(next);
    setDragIndex(null);
    setOverIndex(null);
  }

  function saveEditing(patch) {
    if (editing?.id) onUpdate(editing.id, patch);
    else onAdd(patch);
    setEditing(null);
  }

  if (milestones.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-14 text-center shadow-soft">
        <p className="text-sm font-medium text-muted">No milestones yet — add the first step of this mentee's roadmap.</p>
        <Button fullWidth={false} className="mt-1 flex items-center gap-1.5 px-5" onClick={() => setEditing({})}>
          <PlusIcon className="h-4 w-4" />
          Add milestone
        </Button>
        <MilestoneEditorModal open={Boolean(editing)} milestone={editing} onClose={() => setEditing(null)} onSave={saveEditing} onDelete={onRemove} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Desktop: horizontal stepper */}
      <div className="hidden sm:block">
        <div className="relative flex items-start gap-0">
          {milestones.map((m, i) => {
            const status = milestoneStatus(m);
            const style = NODE_STYLES[status];
            const isLast = i === milestones.length - 1;
            return (
              <div
                key={m.id}
                draggable
                onDragStart={() => setDragIndex(i)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOverIndex(i);
                }}
                onDrop={handleDrop}
                onDragEnd={() => {
                  setDragIndex(null);
                  setOverIndex(null);
                }}
                className={`relative flex flex-1 flex-col items-center transition-opacity duration-200 ${dragIndex === i ? "opacity-40" : ""}`}
              >
                <div className="flex w-full items-center">
                  <div className={`h-0.5 flex-1 ${i === 0 ? "opacity-0" : NODE_STYLES[milestoneStatus(milestones[i - 1])].line}`} />
                  <button
                    type="button"
                    onClick={() => setExpandedId(expandedId === m.id ? null : m.id)}
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-4 transition-transform duration-300 ${style.dot} ${style.ring} ${
                      justCompleted === m.id ? "scale-125" : "scale-100"
                    } ${overIndex === i && dragIndex !== i ? "outline outline-2 outline-primary/40" : ""} ${status === "in_progress" ? "shadow-[0_0_0_6px_rgba(74,14,14,0.08)]" : ""}`}
                    title={m.title}
                  >
                    {status === "completed" ? <CheckIcon className="h-4 w-4" /> : status === "overdue" ? <AlertTriangleIcon className="h-4 w-4" /> : <span className="text-xs font-bold">{i + 1}</span>}
                  </button>
                  <div className={`h-0.5 flex-1 ${isLast ? "opacity-0" : style.line}`} />
                </div>
                <div className="mt-2.5 flex max-w-[140px] cursor-grab flex-col items-center text-center active:cursor-grabbing">
                  <p className="truncate text-xs font-semibold text-text">{m.title}</p>
                  <p className="mt-0.5 text-[11px] text-muted">{formatDateLabel(m.targetDate, { month: "short", day: "numeric" })}</p>
                  {status === "in_progress" && <span className="mt-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">Current</span>}
                  {status === "overdue" && <span className="mt-1 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">Overdue</span>}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Mobile: vertical stepper */}
      <div className="flex flex-col sm:hidden">
        {milestones.map((m, i) => {
          const status = milestoneStatus(m);
          const style = NODE_STYLES[status];
          const isLast = i === milestones.length - 1;
          return (
            <div key={m.id} className="flex gap-3">
              <div className="flex flex-col items-center">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4 ${style.dot} ${style.ring} ${justCompleted === m.id ? "scale-125" : "scale-100"} transition-transform duration-300`}>
                  {status === "completed" ? <CheckIcon className="h-3.5 w-3.5" /> : status === "overdue" ? <AlertTriangleIcon className="h-3.5 w-3.5" /> : <span className="text-[11px] font-bold">{i + 1}</span>}
                </span>
                {!isLast && <div className={`w-0.5 flex-1 ${style.line}`} style={{ minHeight: 24 }} />}
              </div>
              <button type="button" onClick={() => setExpandedId(expandedId === m.id ? null : m.id)} className="min-w-0 flex-1 pb-5 text-left">
                <p className="truncate text-sm font-semibold text-text">{m.title}</p>
                <p className="mt-0.5 text-xs text-muted">{formatDateLabel(m.targetDate, { month: "short", day: "numeric" })}</p>
              </button>
            </div>
          );
        })}
      </div>

      {/* Detail panel for the expanded milestone */}
      {expandedId &&
        milestones
          .filter((m) => m.id === expandedId)
          .map((m) => {
            const status = milestoneStatus(m);
            return (
              <div key={m.id} className="rounded-3xl bg-white p-4 shadow-soft">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-text">{m.title}</p>
                    <p className="mt-1 text-sm text-muted">{m.description || "No description."}</p>
                  </div>
                  <button type="button" onClick={() => setEditing(m)} aria-label="Edit milestone" className="shrink-0 rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </div>
                {m.completedAt ? (
                  <div className="mt-3 rounded-xl bg-success/[0.06] p-3.5 text-sm">
                    <p className="flex items-center gap-1.5 font-semibold text-success">
                      <CheckIcon className="h-3.5 w-3.5" /> Completed {formatDateLabel(m.completedAt, { month: "short", day: "numeric" })}
                    </p>
                    {m.reflection && <p className="mt-1.5 text-muted">{m.reflection}</p>}
                  </div>
                ) : (
                  <CompleteMilestoneRow milestone={m} onComplete={onComplete} />
                )}
              </div>
            );
          })}

      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <ClockIcon className="h-3.5 w-3.5" />
          Drag a step to reorder the roadmap
        </p>
        <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => setEditing({})}>
          <PlusIcon className="h-3.5 w-3.5" />
          Add milestone
        </Button>
      </div>

      <MilestoneEditorModal
        open={Boolean(editing)}
        milestone={editing}
        onClose={() => setEditing(null)}
        onSave={saveEditing}
        onDelete={(id) => {
          onRemove(id);
          setEditing(null);
          if (expandedId === id) setExpandedId(null);
        }}
      />
    </div>
  );
}
