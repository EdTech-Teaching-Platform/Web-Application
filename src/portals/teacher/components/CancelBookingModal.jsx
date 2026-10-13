import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import { formatTime12, formatDateLabel, minutesUntilSlot, SHORT_NOTICE_BUFFER_MIN, CANCEL_REASONS } from "../data/teacherAvailability";
import { AlertTriangleIcon, InfoIcon, UsersIcon } from "../../../components/ui/icons";

// CancelBookingModal — Cancel (educator side). A deliberate, distinct
// confirmation (never a browser confirm()) since this affects a student —
// asks for a reason (matters for the platform's cancellation policy),
// states the refund/entitlement consequence in generic terms, and offers
// the single-vs-series choice only when there are actually future
// occurrences in the same recurring series to fold in.
export default function CancelBookingModal({ open, slot, seriesFutureCount = 0, onClose, onCancelBooking, onDone }) {
  const [reasonTag, setReasonTag] = useState(null);
  const [reason, setReason] = useState("");
  const [scope, setScope] = useState("single");
  const [step, setStep] = useState("form");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);

  if (!slot) return null;

  const student = slot.bookings?.[0];
  const mins = minutesUntilSlot(slot);
  const shortNotice = mins >= 0 && mins < SHORT_NOTICE_BUFFER_MIN;

  function handleClose() {
    setStep("form");
    setReasonTag(null);
    setReason("");
    setScope("single");
    onClose();
  }

  function handleConfirm() {
    setSubmitting(true);
    window.setTimeout(() => {
      const res = onCancelBooking(slot.id, { reasonTag, reason, scope });
      setSubmitting(false);
      setResult(res);
      setStep("success");
    }, 450);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "success" ? "Booking cancelled" : "Cancel this booking?"}
      size="md"
      footer={
        step === "success" ? (
          <Button
            fullWidth={false}
            className="px-6"
            onClick={() => {
              onDone?.();
              handleClose();
            }}
          >
            Done
          </Button>
        ) : (
          <>
            <Button
              fullWidth={false}
              className="border-danger bg-danger px-6 text-white hover:bg-danger/90"
              disabled={submitting}
              onClick={handleConfirm}
            >
              {submitting ? "Cancelling…" : scope === "series" ? `Cancel ${1 + seriesFutureCount} sessions` : "Yes, cancel booking"}
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={handleClose}>
              Go back
            </Button>
          </>
        )
      }
    >
      {step === "success" ? (
        <ConfirmationCard
          state="success"
          heading={`${result?.count > 1 ? `${result.count} sessions cancelled` : "Session cancelled"}`}
          message={`${student?.studentName || "The student"} has been notified, and — per policy — their payment will be refunded or credited back to their account.`}
        />
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2.5 rounded-xl bg-bg px-4 py-3">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
              <UsersIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-text">{student?.studentName}</p>
              <p className="truncate text-xs text-muted">
                {slot.sessionType} · {formatDateLabel(slot.date)} · {formatTime12(slot.start)}
              </p>
            </div>
          </div>

          {shortNotice && (
            <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              This session starts soon — cancelling now gives {student?.studentName?.split(" ")[0] || "the student"} very short notice.
            </div>
          )}

          {seriesFutureCount > 0 && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">This is part of a recurring series</span>
              <div className="flex flex-col gap-2">
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition-colors ${scope === "single" ? "border-primary bg-primary/[0.05]" : "border-text/12"}`}>
                  <input type="radio" checked={scope === "single"} onChange={() => setScope("single")} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span>
                    <span className="block font-semibold text-text">Cancel this session only</span>
                    <span className="block text-xs text-muted">Future sessions in this series stay on the calendar.</span>
                  </span>
                </label>
                <label className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm transition-colors ${scope === "series" ? "border-primary bg-primary/[0.05]" : "border-text/12"}`}>
                  <input type="radio" checked={scope === "series"} onChange={() => setScope("series")} className="mt-0.5 h-4 w-4 accent-primary" />
                  <span>
                    <span className="block font-semibold text-text">Cancel this and all future sessions in this series</span>
                    <span className="block text-xs text-muted">{seriesFutureCount} more upcoming session{seriesFutureCount === 1 ? "" : "s"} with {student?.studentName} will be cancelled too.</span>
                  </span>
                </label>
              </div>
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Reason for cancelling</span>
            <div className="flex flex-wrap gap-2">
              {CANCEL_REASONS.map((r) => (
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

          <div className="flex items-start gap-2.5 rounded-xl bg-danger/[0.06] px-4 py-3 text-sm text-danger">
            <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
            Since you're cancelling, {student?.studentName?.split(" ")[0] || "the student"}'s payment for this session will be refunded or credited back per policy — they won't be left without recourse.
          </div>
        </div>
      )}
    </Modal>
  );
}
