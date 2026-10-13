import { useEffect, useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import Select from "../../../components/ui/Select";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import StructuredResponseForm from "./StructuredResponseForm";
import DateTimeAvailabilityPicker from "./DateTimeAvailabilityPicker";
import { REQUEST_STATUS_META, initials, DECLINE_REASONS, NEW_TIME_REASONS, joinReasonNote } from "../data/sessionRequestsData";
import { findConflict, formatDateLabel, formatTime12, addMinutesToTime, toMinutes, isoDate } from "../data/teacherAvailability";
import { TODAY } from "../data/teacherCourses";
import {
  XIcon,
  AlertTriangleIcon,
  CheckIcon,
  CalendarIcon,
  ClockIcon,
  BookIcon,
} from "../../../components/ui/icons";

// SessionRequestDetail — the slide-over decision panel for one request,
// same right-edge drawer shell/motion as StudentProfileSheet and
// MentorshipApplicationDetail (full-width on mobile, capped at max-w-xl on
// larger screens — no separate mobile layout needed).
//
// Three sub-modes off the main "view":
//   - "decline" is a structured response (required reason + optional note)
//     that updates the request's status and records the reason on it.
//   - "offerNewTime" is reached once a conflict is detected against the
//     live slot list — shows the conflict banner (same styling
//     DateTimeAvailabilityPicker/ScheduleCallModal already use), lets the
//     educator pick a nearby open slot or a custom time, and records a
//     structured reason + optional note on the request. No chat is created.
//   - the "Needs New Time" *resolution* (the student picking one of the
//     offered times) is simulated with a manual "Simulate: student picked
//     this time" action per offered chip, documented at the call site,
//     since there's no live backend to actually receive a student's reply.
export default function SessionRequestDetail({ request, slots, onClose, onAccept, onDecline, onOfferNewTime, onResolveNeedsNewTime }) {
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState("view"); // view | decline | offerNewTime
  const [offerReason, setOfferReason] = useState("");
  const [offerNote, setOfferNote] = useState("");
  const [offerTouched, setOfferTouched] = useState(false);
  const [offerDone, setOfferDone] = useState(false);
  const [offerDate, setOfferDate] = useState("");
  const [offerStart, setOfferStart] = useState("10:00");
  const [offerDuration, setOfferDuration] = useState(30);
  const [submitting, setSubmitting] = useState(false);

  const open = Boolean(request);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setMode("view");
    setOfferReason("");
    setOfferNote("");
    setOfferTouched(false);
    setOfferDone(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open, request?.id]);

  useEffect(() => {
    if (!request) return;
    if (mode === "offerNewTime") {
      setOfferDate(request.requestedDate);
      setOfferStart(request.requestedStart);
      const dur = toMinutes(request.requestedEnd) - toMinutes(request.requestedStart);
      setOfferDuration(dur > 0 ? dur : 30);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, request?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  const conflict = useMemo(() => {
    if (!request || request.status !== "pending") return null;
    return findConflict(slots, [{ date: request.requestedDate, start: request.requestedStart, end: request.requestedEnd }]);
  }, [request, slots]);

  const nearbySuggestions = useMemo(() => {
    if (!request) return [];
    const todayIso = isoDate(TODAY);
    return slots
      .filter((s) => s.status === "open" && s.date >= todayIso)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      .slice(0, 6);
  }, [request, slots]);

  const offerEnd = addMinutesToTime(offerStart, offerDuration);
  const offerConflict = useMemo(() => {
    if (mode !== "offerNewTime" || !offerDate || !offerStart) return null;
    return findConflict(slots, [{ date: offerDate, start: offerStart, end: offerEnd }]);
  }, [mode, slots, offerDate, offerStart, offerEnd]);

  if (!open) return null;

  const meta = REQUEST_STATUS_META[request.status] ?? REQUEST_STATUS_META.pending;
  const requestedLabel = `${formatDateLabel(request.requestedDate, { weekday: "long", month: "long", day: "numeric" })} · ${formatTime12(request.requestedStart)}–${formatTime12(request.requestedEnd)}`;

  function handleAccept() {
    setSubmitting(true);
    window.setTimeout(() => {
      const result = onAccept(request);
      setSubmitting(false);
      if (!result?.ok) return; // conflict appeared between render and click — banner already shows it
    }, 400);
  }

  function handleSendOfferNewTime() {
    setOfferTouched(true);
    if (!offerReason || offerConflict) return;
    onOfferNewTime(request, {
      offeredSlots: [{ date: offerDate, start: offerStart, end: offerEnd }],
      reasonTag: offerReason,
      resolutionMessage: joinReasonNote(offerReason, offerNote.trim()),
    });
    setOfferDone(true);
  }

  function handleSimulateStudentPicked(offered) {
    onResolveNeedsNewTime(request, offered);
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-text/50 transition-opacity duration-200 ease-out ${entered ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-3xl bg-bg shadow-elevated transition-transform duration-200 ease-out ${
          entered ? "translate-x-0" : "translate-x-4 opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-text/[0.07] bg-white px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              {initials(request.studentName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-text">{request.studentName}</p>
              <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                <BookIcon className="h-3 w-3 shrink-0" />
                {request.courseTitle}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={meta.badge} size="sm" showIcon={false}>
              {meta.label}
            </StatusBadge>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-text">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {mode === "view" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-3.5 shadow-soft">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Requested time
                  </p>
                  <p className="mt-1 text-sm font-medium text-text">{request.flexible ? "Flexible — see note" : requestedLabel}</p>
                </div>
                <div className="rounded-2xl bg-white p-3.5 shadow-soft">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Session type
                  </p>
                  <p className="mt-1 text-sm font-medium text-text">{request.sessionType}</p>
                </div>
              </div>

              {request.note && (
                <div>
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Note from student</p>
                  <div className="rounded-2xl bg-white p-4 text-sm text-text shadow-soft">{request.note}</div>
                </div>
              )}

              <p className="text-[11px] text-muted">
                Submitted {new Date(request.submittedAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
              </p>

              {request.status === "pending" && conflict && (
                <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  <div>
                    <p className="font-semibold">You already have a session at this time.</p>
                    <p className="mt-0.5 text-danger/80">
                      {conflict.existing.sessionType} · {formatDateLabel(conflict.existing.date)} · {formatTime12(conflict.existing.start)}
                      {conflict.existing.bookings?.[0]?.studentName ? ` · ${conflict.existing.bookings[0].studentName}` : ""}
                    </p>
                  </div>
                </div>
              )}

              {request.status === "needs_new_time" && (
                <div className="flex flex-col gap-2.5 rounded-xl bg-warning/[0.08] p-4">
                  <p className="text-sm font-semibold text-warning">Waiting on the student to pick a new time</p>
                  <p className="text-xs text-warning/80">{request.resolutionMessage}</p>
                  <div className="mt-1 flex flex-col gap-2">
                    {request.offeredSlots?.map((o) => (
                      <div key={`${o.date}-${o.start}`} className="flex items-center justify-between gap-2 rounded-2xl bg-white px-3.5 py-2.5 shadow-soft">
                        <span className="text-sm font-medium text-text">
                          {formatDateLabel(o.date, { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(o.start)}
                        </span>
                        <Button fullWidth={false} className="px-3 py-1.5 text-xs" onClick={() => handleSimulateStudentPicked(o)}>
                          Simulate: student picked this
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {(request.status === "accepted" || request.status === "declined") && request.resolutionMessage && (
                <div
                  className={`rounded-xl p-3.5 text-sm ${
                    request.status === "accepted"
                      ? "bg-success/10 text-success motion-safe:animate-[celebrate-pop_0.5s_ease-out]"
                      : "bg-danger/[0.06] text-danger"
                  }`}
                >
                  {request.resolutionMessage}
                </div>
              )}

              {request.status === "pending" && (
                <div className="flex flex-col gap-2.5 border-t border-text/[0.07] pt-4">
                  {!conflict ? (
                    <Button fullWidth disabled={submitting} className="flex items-center justify-center gap-1.5" onClick={handleAccept}>
                      <CheckIcon className="h-4 w-4" />
                      {submitting ? "Confirming…" : "Accept"}
                    </Button>
                  ) : (
                    <Button fullWidth className="flex items-center justify-center gap-1.5" onClick={() => setMode("offerNewTime")}>
                      <CalendarIcon className="h-4 w-4" />
                      Offer a different time
                    </Button>
                  )}
                  <Button variant="secondary" fullWidth className="border-danger text-danger hover:bg-danger/5" onClick={() => setMode("decline")}>
                    Decline
                  </Button>
                </div>
              )}
            </div>
          )}

          {mode === "decline" && (
            <StructuredResponseForm
              title="Decline this request"
              description="Pick a reason and add an optional note. The request is marked declined and the reason is recorded on it."
              reasons={DECLINE_REASONS}
              noteLabel="Note (optional)"
              submitLabel="Decline request"
              submitTone="danger"
              doneHeading="Request declined"
              doneMessage={`${request.studentName}'s request is marked as declined.`}
              onSubmit={({ reason, note }) => onDecline(request.id, { reasonTag: reason, resolutionMessage: joinReasonNote(reason, note) })}
              onBack={() => setMode("view")}
              onDone={onClose}
            />
          )}

          {mode === "offerNewTime" && offerDone && (
            <ConfirmationCard
              state="success"
              heading="New time offered"
              message={`${request.studentName}'s request is now marked "Needs new time" with your offered slot and reason recorded.`}
              primaryAction={<Button onClick={onClose}>Done</Button>}
            />
          )}

          {mode === "offerNewTime" && !offerDone && (
            <div className="flex flex-col gap-4">
              <p className="text-sm font-semibold text-text">Offer a different time</p>
              <DateTimeAvailabilityPicker
                date={offerDate}
                start={offerStart}
                duration={offerDuration}
                onChangeDate={setOfferDate}
                onChangeStart={setOfferStart}
                onChangeDuration={setOfferDuration}
                suggestedSlots={nearbySuggestions}
                isAdHoc={Boolean(offerDate && offerStart && !offerConflict && !nearbySuggestions.some((s) => s.date === offerDate && s.start === offerStart))}
                conflict={offerConflict}
                minDate={isoDate(TODAY)}
              />
              <div>
                <span className="mb-1.5 block text-sm font-medium text-text">Reason</span>
                <Select
                  wrapperClassName="block w-full"
                  value={offerReason}
                  onChange={(e) => setOfferReason(e.target.value)}
                  className={`w-full rounded-xl border bg-bg px-3.5 py-2.5 pr-10 text-sm text-text ${offerTouched && !offerReason ? "border-danger" : "border-text/15"}`}
                >
                  <option value="">Select a reason…</option>
                  {NEW_TIME_REASONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </Select>
                {offerTouched && !offerReason && <p role="alert" className="mt-1 text-xs font-medium text-danger">Choose a reason to continue.</p>}
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-text">Note (optional)</span>
                <textarea
                  value={offerNote}
                  onChange={(e) => setOfferNote(e.target.value.slice(0, 300))}
                  rows={3}
                  placeholder="Add context for your records…"
                  className="w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
              <div className="flex gap-2.5">
                <Button fullWidth disabled={Boolean(offerConflict) || !offerReason} onClick={handleSendOfferNewTime}>
                  Offer this time
                </Button>
                <Button variant="secondary" fullWidth onClick={() => setMode("view")}>
                  Back
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
