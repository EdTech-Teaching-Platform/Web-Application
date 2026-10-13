import { useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Switch from "../../../components/ui/Switch";
import { generateSlots, WEEKDAY_LABELS } from "../data/teacherAvailability";
import { AlertTriangleIcon, InfoIcon, PlusIcon, TrashIcon } from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

const SLOT_LENGTHS = [15, 30, 45, 60];
const BUFFERS = [0, 5, 10, 15];

function FieldLabel({ children }) {
  return <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">{children}</span>;
}

function DayToggle({ days, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAY_LABELS.map((label, i) => {
        const active = days.includes(i);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? days.filter((d) => d !== i) : [...days, i])}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-150 ${
              active ? "bg-primary text-white" : "bg-surface text-muted shadow-soft hover:bg-primary/10 hover:text-primary"
            } hover:-translate-y-0.5 hover:shadow-soft`}
          >
            {label[0]}
          </button>
        );
      })}
    </div>
  );
}

// AvailabilityPanel — the create/edit modal for one availability block.
// Create mode builds the full recurrence-rule + auto-split shape;
// editing an existing slot only touches that one occurrence (time/type/
// capacity), never the whole series, so the panel hides the recurrence
// builder once a slot already exists.
export default function AvailabilityPanel({ open, mode, initial, existingSlot, sessionTypes, onAddSessionType, onSave, onDelete, onClose, presetRecurs = false, title }) {
  const [date, setDate] = useState(initial?.date || "");
  const [startTime, setStartTime] = useState(initial?.startTime || "09:00");
  const [endTime, setEndTime] = useState(initial?.endTime || "10:00");
  const [sessionType, setSessionType] = useState(existingSlot?.sessionType || sessionTypes[0]);
  const [newType, setNewType] = useState("");
  const [showAddType, setShowAddType] = useState(false);
  const [slotLengthMin, setSlotLengthMin] = useState(existingSlot ? diffMinutes(existingSlot.start, existingSlot.end) : 30);
  const [bufferMin, setBufferMin] = useState(existingSlot?.bufferMin ?? 10);
  const [maxBookings, setMaxBookings] = useState(existingSlot?.maxBookings ?? 1);
  const [recurs, setRecurs] = useState(presetRecurs);
  const [days, setDays] = useState(initial?.date ? [new Date(initial.date).getDay()] : []);
  const [noEndDate, setNoEndDate] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [error, setError] = useState(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const isEdit = mode === "edit";

  const preview = useMemo(() => {
    if (isEdit) return 1;
    const { slots } = generateSlots({
      date,
      startTime,
      endTime,
      slotLengthMin,
      bufferMin,
      sessionType,
      maxBookings,
      recurrence: recurs ? { type: "weekly", days: days.length ? days : [new Date(date || Date.now()).getDay()], endDate: noEndDate ? null : endDate || null } : { type: "none" },
    });
    return slots.length;
  }, [isEdit, date, startTime, endTime, slotLengthMin, bufferMin, sessionType, maxBookings, recurs, days, noEndDate, endDate]);

  function handleSave() {
    setError(null);
    if (isEdit) {
      const result = onSave({ id: existingSlot.id, patch: { start: startTime, end: endTime, sessionType, maxBookings: Number(maxBookings), bufferMin: Number(bufferMin) } });
      if (!result.ok) setError(result.conflict ? `Overlaps an existing ${result.conflict.existing.sessionType} slot at ${result.conflict.existing.start}.` : "Couldn't save this change.");
      else onClose();
      return;
    }
    const result = onSave({
      date,
      startTime,
      endTime,
      slotLengthMin: Number(slotLengthMin),
      bufferMin: Number(bufferMin),
      sessionType,
      maxBookings: Number(maxBookings),
      recurrence: recurs ? { type: "weekly", days: days.length ? days : [new Date(date).getDay()], endDate: noEndDate ? null : endDate || null } : { type: "none" },
    });
    if (!result.ok) {
      setError(
        result.conflict
          ? `Overlaps an existing ${result.conflict.existing.sessionType} slot on ${result.conflict.existing.date} at ${result.conflict.existing.start}.`
          : "Choose a valid time range first."
      );
    } else {
      onClose();
    }
  }

  const hasBookings = isEdit && (existingSlot.bookings?.length || 0) > 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title || (isEdit ? "Edit availability" : "New availability")}
      size="xl"
      footer={
        <>
          <Button variant="primary" fullWidth={false} className="px-6" onClick={handleSave}>
            {isEdit ? "Save changes" : "Publish availability"}
          </Button>
          {isEdit && (
            <Button
              variant="secondary"
              fullWidth={false}
              className="flex items-center gap-1.5 border-danger text-danger hover:bg-danger/5"
              onClick={() => (hasBookings ? setConfirmDelete(true) : onDelete(existingSlot))}
            >
              <TrashIcon className="h-4 w-4" />
              Delete
            </Button>
          )}
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      {confirmDelete ? (
        <div className="flex flex-col gap-4">
          <div className="flex items-start gap-3 rounded-2xl bg-danger/10 px-4 py-3.5 text-sm text-danger">
            <AlertTriangleIcon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
            <div>
              <p className="font-semibold">This slot has {existingSlot.bookings.length} active booking{existingSlot.bookings.length === 1 ? "" : "s"}.</p>
              <p className="mt-1 text-danger/80">
                Deleting it will cancel {existingSlot.bookings.length === 1 ? "that student's" : "those students'"} session — they'll need to be
                notified and rescheduled. This can't be undone.
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-1.5 rounded-xl bg-bg px-4 py-3">
            {existingSlot.bookings.map((b) => (
              <span key={b.id} className="text-sm text-muted">
                {b.studentName} · {b.courseTitle}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <Button variant="primary" fullWidth={false} className="flex-1 border-danger bg-danger hover:bg-danger/90" onClick={() => onDelete(existingSlot)}>
              Yes, cancel and delete
            </Button>
            <Button variant="secondary" fullWidth={false} className="flex-1" onClick={() => setConfirmDelete(false)}>
              Go back
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel>Date</FieldLabel>
              <input
                type="date"
                value={date}
                disabled={isEdit}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none disabled:opacity-60 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div>
              <FieldLabel>Start time</FieldLabel>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div>
              <FieldLabel>End time</FieldLabel>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>

          {!isEdit && (
            <div>
              <FieldLabel>Recurrence</FieldLabel>
              <div className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
                <Switch checked={recurs} onChange={setRecurs} label="Repeats weekly" description="Publish this same time range on chosen weekdays, going forward" />
                {recurs && (
                  <div className="flex flex-col gap-3 border-t border-text/[0.07] pt-3 motion-safe:animate-[rise-in_0.25s_ease-out_both]">
                    <div>
                      <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">On these days</span>
                      <DayToggle days={days} onChange={setDays} />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-text">
                      <input type="checkbox" checked={noEndDate} onChange={(e) => setNoEndDate(e.target.checked)} className="h-4 w-4 accent-primary" />
                      No end date
                    </label>
                    {!noEndDate && (
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full max-w-[180px] rounded-xl border border-text/15 bg-white px-3.5 py-2 text-sm text-text outline-none focus:border-primary/40"
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <FieldLabel>Slot length</FieldLabel>
              <Select
                wrapperClassName="block w-full"
                value={slotLengthMin}
                disabled={isEdit}
                onChange={(e) => setSlotLengthMin(Number(e.target.value))}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none disabled:opacity-60 focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                {SLOT_LENGTHS.map((m) => (
                  <option key={m} value={m}>
                    {m} min
                  </option>
                ))}
              </Select>
              {!isEdit && <span className="mt-1.5 block text-xs text-muted">Auto-splits the range</span>}
            </div>
            <div>
              <FieldLabel>Buffer time</FieldLabel>
              <Select
                wrapperClassName="block w-full"
                value={bufferMin}
                onChange={(e) => setBufferMin(Number(e.target.value))}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                {BUFFERS.map((m) => (
                  <option key={m} value={m}>
                    {m === 0 ? "None" : `${m} min`}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <FieldLabel>Max bookings / slot</FieldLabel>
              <input
                type="number"
                min={1}
                value={maxBookings}
                onChange={(e) => setMaxBookings(e.target.value)}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
          </div>
          <p className="-mt-3 flex items-center gap-1.5 text-xs text-muted">
            <InfoIcon className="h-3.5 w-3.5 shrink-0" />
            Buffer time avoids back-to-back sessions running over — a gap is held after every slot before the next one can start.
          </p>

          <div>
            <FieldLabel>Session type</FieldLabel>
            <div className="flex flex-wrap items-center gap-2">
              <Select
                wrapperClassName="block flex-1"
                value={sessionType}
                onChange={(e) => setSessionType(e.target.value)}
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              >
                {sessionTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => setShowAddType((v) => !v)}
                className="flex shrink-0 items-center gap-1.5 rounded-full border border-dashed border-text/20 px-3 py-2.5 text-xs font-semibold text-muted hover:border-primary hover:text-primary"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                New type
              </button>
            </div>
            {showAddType && (
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  value={newType}
                  onChange={(e) => setNewType(e.target.value)}
                  placeholder="e.g. Portfolio Review"
                  className="flex-1 rounded-xl border border-text/15 bg-bg px-3.5 py-2 text-sm text-text outline-none focus:border-primary/40"
                />
                <Button
                  variant="secondary"
                  fullWidth={false}
                  className="px-4 py-2 text-xs"
                  onClick={() => {
                    onAddSessionType(newType);
                    setSessionType(newType.trim());
                    setNewType("");
                    setShowAddType(false);
                  }}
                >
                  Add
                </Button>
              </div>
            )}
          </div>

          {!isEdit && (
            <div className="rounded-xl bg-primary/[0.06] px-4 py-3 text-sm font-semibold text-primary">
              {preview > 0
                ? `This creates ${preview} bookable slot${preview === 1 ? "" : "s"} total${recurs ? " (across every matching week)" : ""}.`
                : "Choose a valid time range to preview bookable slots."}
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}

function diffMinutes(a, b) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}
