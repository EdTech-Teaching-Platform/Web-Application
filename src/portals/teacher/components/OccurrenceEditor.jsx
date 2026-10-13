import { useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import { AlertTriangleIcon } from "../../../components/ui/icons";
import { formatTime12 } from "../data/teacherAvailability";
import { getNow, parseLocalDateTime, dayKey } from "../data/liveJoin";
import { computeEndTime, durationMinutes } from "../data/liveSessions";
import MeetingDetailsFields from "./MeetingDetailsFields";
import { emptyMeeting, isMeetingValid, cleanMeeting } from "../data/meetingProviders";

const DURATION_CHOICES = [30, 45, 60, 75, 90, 120];

// OccurrenceEditor — the "edit just this occurrence" form (date, time,
// duration) shared by Manage Schedule's occurrence rows and the Live
// Classes Edit modal, so there is exactly one implementation of the
// validation + save/retry behaviour. It only ever calls the context's
// `updateLiveClassOccurrence` (via `onSave`), so the series rule and every
// other occurrence stay untouched and the shared slot record — and with it
// the Availability calendar — updates in place.
//   onSave(slotId, { date, start, end }) -> { ok, conflict? } (may throw)
//   onDone(slot) is called after a successful save.
export default function OccurrenceEditor({ slot, onSave, onDone, onCancel, className = "" }) {
  const [date, setDate] = useState(slot.date);
  const [time, setTime] = useState(slot.start);
  const [duration, setDuration] = useState(durationMinutes(slot));
  const hasMeeting = Boolean(slot.liveClass);
  const originalMeeting = useMemo(() => ({ ...emptyMeeting(), ...(slot.liveClass?.meeting || {}) }), [slot]);
  const [meeting, setMeeting] = useState(originalMeeting);
  const [error, setError] = useState(null);
  const [saving, setSaving] = useState(false);

  const original = useMemo(() => ({ date: slot.date, time: slot.start, duration: durationMinutes(slot) }), [slot]);
  const durationOptions = useMemo(
    () => [...new Set([...DURATION_CHOICES, original.duration])].sort((a, b) => a - b),
    [original.duration]
  );

  const timeChanged = date !== original.date || time !== original.time;
  const meetingChanged = hasMeeting && JSON.stringify(cleanMeeting(meeting)) !== JSON.stringify(cleanMeeting(originalMeeting));
  const changed = timeChanged || duration !== original.duration || meetingChanged;
  const end = time ? computeEndTime(time, duration) : null;

  // Field-level validation (inline under the field, like every other form).
  let fieldError = null;
  if (!date || !time) fieldError = "Pick a date and time.";
  else if (!end) fieldError = "The session has to finish by 11:59 PM — shorten it or start earlier.";
  else if (timeChanged && parseLocalDateTime(date, time) < getNow()) fieldError = "Choose a date and time that haven't passed yet.";

  const meetingInvalid = hasMeeting && !isMeetingValid(meeting);

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const res = await onSave(slot.id, { date, start: time, end, ...(hasMeeting ? { meeting: cleanMeeting(meeting) } : {}) });
      if (!res || !res.ok) {
        setError(
          res?.conflict
            ? `Overlaps something already on the calendar at ${formatTime12(res.conflict.existing.start)}.`
            : "Couldn't save this change."
        );
        return;
      }
      onDone?.(slot);
    } catch {
      setError("Something went wrong while saving.");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "rounded-lg border border-text/15 bg-surface px-3 py-2 text-xs text-text outline-none focus:border-primary/40";
  return (
    <div className={`flex flex-col gap-2.5 rounded-xl bg-bg p-3 ${className}`}>
      <div className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
          Date
          <input type="date" min={dayKey(getNow())} value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
          Start time
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className={inputCls} />
        </label>
        <label className="flex flex-col gap-1 text-[11px] font-semibold text-muted">
          Duration
          <select value={duration} onChange={(e) => setDuration(Number(e.target.value))} className={inputCls}>
            {durationOptions.map((d) => (
              <option key={d} value={d}>
                {d} min
              </option>
            ))}
          </select>
        </label>
      </div>
      {hasMeeting && <MeetingDetailsFields meeting={meeting} onChange={setMeeting} />}
      {fieldError && changed && <p className="text-xs font-medium text-danger">{fieldError}</p>}
      {error && (
        <div role="alert" className="flex items-start gap-2 rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <span className="flex-1">{error}</span>
          <button type="button" onClick={handleSave} className="shrink-0 font-semibold underline">
            Retry
          </button>
        </div>
      )}
      <div className="flex items-center gap-2">
        <Button fullWidth={false} className="px-4 py-2 text-xs" disabled={!changed || Boolean(fieldError) || meetingInvalid || saving} onClick={handleSave}>
          {saving ? "Saving…" : "Save"}
        </Button>
        {onCancel && (
          <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" onClick={onCancel}>
            Cancel
          </Button>
        )}
      </div>
    </div>
  );
}
