import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { GripIcon, PlusIcon, TrashIcon } from "../../../components/ui/icons";

function newLocalId() {
  return `draft-${Math.random().toString(36).slice(2, 9)}`;
}

function blankMilestone() {
  return { localId: newLocalId(), title: "", targetDate: "", description: "" };
}

// MentorshipPlanSetupModal — opened from an application's "Accept" action.
// Builds the initial program shape (focus area, cadence, duration, and a
// reorderable milestone list) that acceptApplication() turns into a real
// mentorship. Milestone reordering uses the exact same draggable +
// onDragOver/preventDefault + onDrop/splice mechanism ModuleCard.jsx uses
// for lesson reordering, applied to this local draft list.
export default function MentorshipPlanSetupModal({ open, application, defaultCadence, defaultDuration, onClose, onConfirm }) {
  const [focusArea, setFocusArea] = useState("");
  const [cadence, setCadence] = useState(defaultCadence || "Weekly");
  const [duration, setDuration] = useState(defaultDuration || "8 weeks");
  const [milestones, setMilestones] = useState([blankMilestone()]);
  const [dragIndex, setDragIndex] = useState(null);
  const [overIndex, setOverIndex] = useState(null);

  useEffect(() => {
    if (!open) return;
    setFocusArea(application?.focusAreas?.[0] || "");
    setCadence(application?.cadence || defaultCadence || "Weekly");
    setDuration(application?.proposedDuration || defaultDuration || "8 weeks");
    setMilestones([blankMilestone()]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, application?.id]);

  if (!application) return null;

  function updateMilestone(localId, patch) {
    setMilestones((prev) => prev.map((m) => (m.localId === localId ? { ...m, ...patch } : m)));
  }
  function addMilestoneRow() {
    setMilestones((prev) => [...prev, blankMilestone()]);
  }
  function removeMilestoneRow(localId) {
    setMilestones((prev) => (prev.length > 1 ? prev.filter((m) => m.localId !== localId) : prev));
  }
  function handleDrop() {
    if (dragIndex === null || overIndex === null || dragIndex === overIndex) {
      setDragIndex(null);
      setOverIndex(null);
      return;
    }
    setMilestones((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(overIndex, 0, moved);
      return next;
    });
    setDragIndex(null);
    setOverIndex(null);
  }

  const validMilestones = milestones.filter((m) => m.title.trim());
  const canSubmit = Boolean(focusArea.trim() && cadence.trim() && duration.trim() && validMilestones.length > 0);

  function submit() {
    if (!canSubmit) return;
    onConfirm(application.id, {
      focusArea: focusArea.trim(),
      cadence: cadence.trim(),
      duration: duration.trim(),
      milestones: validMilestones.map((m) => ({ title: m.title.trim(), targetDate: m.targetDate, description: m.description.trim() })),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Set up a mentorship plan for ${application.studentName.split(" ")[0]}`}
      size="xl"
      footer={
        <>
          <Button fullWidth={false} className="px-6" disabled={!canSubmit} onClick={submit}>
            Accept &amp; Start Mentorship
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Focus area</span>
          <input
            type="text"
            value={focusArea}
            onChange={(e) => setFocusArea(e.target.value)}
            placeholder="e.g. Portfolio Development"
            className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Cadence</span>
            <input
              type="text"
              value={cadence}
              onChange={(e) => setCadence(e.target.value)}
              placeholder="e.g. Weekly"
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Duration</span>
            <input
              type="text"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="e.g. 8 weeks"
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-medium text-text">Roadmap milestones</span>
            <span className="text-xs text-muted">Drag to reorder</span>
          </div>
          <div className="flex flex-col gap-2">
            {milestones.map((m, i) => (
              <div
                key={m.localId}
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
                className={`flex flex-col gap-2 rounded-xl bg-bg p-3 transition-all duration-150 sm:flex-row sm:items-start ${
                  dragIndex === i ? "opacity-40" : ""
                } ${overIndex === i && dragIndex !== i ? "ring-2 ring-primary/40" : ""}`}
              >
                <span className="mt-2 hidden shrink-0 cursor-grab text-text/25 hover:text-text/50 active:cursor-grabbing sm:block">
                  <GripIcon />
                </span>
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">
                  {i + 1}
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row">
                  <input
                    type="text"
                    value={m.title}
                    onChange={(e) => updateMilestone(m.localId, { title: e.target.value })}
                    placeholder="Milestone title"
                    className="flex-1 rounded-lg border border-text/15 bg-white px-3 py-2 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                  />
                  <input
                    type="date"
                    value={m.targetDate}
                    onChange={(e) => updateMilestone(m.localId, { targetDate: e.target.value })}
                    className="rounded-lg border border-text/15 bg-white px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 sm:w-40"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => removeMilestoneRow(m.localId)}
                  aria-label="Remove milestone"
                  className="shrink-0 self-start rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addMilestoneRow}
            className="mt-2 flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold text-primary transition-colors duration-150 hover:bg-primary/[0.06]"
          >
            <PlusIcon className="h-4 w-4" />
            Add milestone
          </button>
        </div>
      </div>
    </Modal>
  );
}
