import { useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import DateTimeAvailabilityPicker from "./DateTimeAvailabilityPicker";
import {
  resolveBookingTarget,
  addMinutesToTime,
  formatTime12,
  formatDateLabel,
  minutesUntilSlot,
  SHORT_NOTICE_BUFFER_MIN,
  RESCHEDULE_REASONS,
  isoDate,
} from "../data/teacherAvailability";
import { TODAY } from "../data/teacherCourses";
import { AlertTriangleIcon, InfoIcon, UsersIcon } from "../../../components/ui/icons";

function diffMinutes(a, b) {
  const [ah, am] = a.split(":").map(Number);
  const [bh, bm] = b.split(":").map(Number);
  return bh * 60 + bm - (ah * 60 + am);
}

// RescheduleBookingPanel — Reschedule (educator side). Reuses the exact
// same DateTimeAvailabilityPicker as Scheduled Call Booking, with the
// original time shown as a clearly labeled "was:" so the change is
// transparent rather than looking like the session just silently moved.
export default function RescheduleBookingPanel({ open, slot, slots, onClose, onReschedule, onViewBooking }) {
  const [date, setDate] = useState(slot?.date || "");
  const [start, setStart] = useState(slot?.start || "");
  const [duration, setDuration] = useState(slot ? Math.max(15, diffMinutes(slot.start, slot.end)) : 30);
  const [reasonTag, setReasonTag] = useState(null);
  const [reason, setReason] = useState("");
  const [step, setStep] = useState("form");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [resultSlot, setResultSlot] = useState(null);

  if (!slot) return null;

  const end = addMinutesToTime(start, duration);
  const student = slot.bookings?.[0];
  const mins = minutesUntilSlot(slot);
  const shortNotice = mins >= 0 && mins < SHORT_NOTICE_BUFFER_MIN;

  const suggestedSlots = useMemo(
    () =>
      slots
        .filter((s) => s.status === "open")
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        .slice(0, 6),
    [slots]
  );

  const { exactOpenSlot, conflict } = useMemo(
    () => (date && start ? resolveBookingTarget(slots, { date, start, end }, slot.id) : { exactOpenSlot: null, conflict: null }),
    [slots, date, start, end, slot.id]
  );
  const isAdHoc = Boolean(date && start && !exactOpenSlot && !conflict);
  const unchanged = date === slot.date && start === slot.start && end === slot.end;

  function handleClose() {
    setStep("form");
    setReasonTag(null);
    setReason("");
    setErrorMsg(null);
    onClose();
  }

  function handleSubmit() {
    setSubmitting(true);
    setErrorMsg(null);
    window.setTimeout(() => {
      const result = onReschedule(slot.id, { date, start, end, reasonTag, reason });
      setSubmitting(false);
      if (!result.ok) {
        setErrorMsg(
          result.conflict
            ? `Overlaps ${result.conflict.existing.sessionType} at ${formatTime12(result.conflict.existing.start)} on ${formatDateLabel(result.conflict.existing.date)}.`
            : "Couldn't reschedule to this time."
        );
        return;
      }
      setResultSlot(result.slot);
      setStep("success");
    }, 500);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "success" ? "Rescheduled" : "Reschedule call"}
      size="lg"
      footer={
        step === "success" ? (
          <>
            <Button
              fullWidth={false}
              className="px-6"
              onClick={() => {
                onViewBooking?.(resultSlot);
                handleClose();
              }}
            >
              View Booking
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={handleClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth={false} className="px-6" disabled={submitting || unchanged || Boolean(conflict)} onClick={handleSubmit}>
              {submitting ? "Rescheduling…" : "Confirm New Time"}
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={handleClose}>
              Cancel
            </Button>
          </>
        )
      }
    >
      {step === "success" ? (
        <ConfirmationCard
          state="success"
          heading="The student has been notified"
          message={`Moved to ${formatDateLabel(resultSlot.date, { weekday: "long", month: "long", day: "numeric" })} · ${formatTime12(resultSlot.start)}–${formatTime12(
            resultSlot.end
          )}. Their booking, payment and entitlement all carried over unchanged.`}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          <div className="flex items-center gap-2.5 rounded-xl bg-bg px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              <UsersIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{student?.studentName}</p>
              <p className="truncate text-xs text-muted">
                {slot.sessionType} · {student?.courseTitle}
              </p>
            </div>
          </div>

          {shortNotice && (
            <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              This session starts soon — a short-notice change may be disruptive for {student?.studentName?.split(" ")[0] || "the student"}.
            </div>
          )}

          <DateTimeAvailabilityPicker
            date={date}
            start={start}
            duration={duration}
            onChangeDate={setDate}
            onChangeStart={setStart}
            onChangeDuration={setDuration}
            suggestedSlots={suggestedSlots}
            isAdHoc={isAdHoc}
            conflict={conflict}
            originalLabel={`${formatDateLabel(slot.date)} · ${formatTime12(slot.start)}`}
            minDate={isoDate(TODAY)}
          />

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Reason (optional, but helps the student)</span>
            <div className="flex flex-wrap gap-2">
              {RESCHEDULE_REASONS.map((r) => (
                <Chip key={r} active={reasonTag === r} onClick={() => setReasonTag(reasonTag === r ? null : r)} className="px-3.5 py-1.5 text-xs">
                  {r}
                </Chip>
              ))}
            </div>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={2}
              placeholder="Add a short note (optional)…"
              className="mt-2 w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-primary/[0.06] px-4 py-3 text-sm text-primary">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
            The student keeps their booking — this just moves the time. Their payment and entitlement carry over automatically.
          </div>
        </div>
      )}
    </Modal>
  );
}
