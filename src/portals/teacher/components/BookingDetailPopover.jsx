import { useEffect, useState } from "react";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import JoinSessionButton from "./JoinSessionButton";
import MeetingProviderChip from "./MeetingProviderChip";
import { useNow } from "../data/liveJoin";
import { formatTime12, formatDateLabel, minutesUntilSlot, SHORT_NOTICE_BUFFER_MIN } from "../data/teacherAvailability";
import {
  UsersIcon,
  BookIcon,
  ClockIcon,
  XIcon,
  PencilIcon,
  TrashIcon,
  AlertTriangleIcon,
  RepeatIcon,
  ArrowRightIcon,
  CalendarIcon,
  VideoIcon,
  CheckIcon,
} from "../../../components/ui/icons";

const STATUS_BADGE = {
  booked: { status: "success", label: "Confirmed" },
  cancelled: { status: "danger", label: "Cancelled" },
  rescheduled: { status: "warning", label: "Rescheduled" },
  completed: { status: "success", label: "Completed" },
};

function initials(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("");
}

function HistoryTimeline({ history }) {
  if (!history || history.length === 0) return null;
  return (
    <div>
      <span className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <ClockIcon className="h-3.5 w-3.5" />
        Booking history
      </span>
      <div className="flex flex-col gap-3 border-l-2 border-text/[0.08] pl-4">
        {history.map((h) => (
          <div key={h.id} className="relative">
            <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-primary/50 ring-4 ring-white" />
            {h.type === "created" && (
              <p className="text-sm text-muted">
                Originally booked for{" "}
                <span className="font-semibold text-text">
                  {formatDateLabel(h.to.date)} · {formatTime12(h.to.start)}
                </span>
              </p>
            )}
            {h.type === "rescheduled" && (
              <p className="text-sm text-muted">
                Rescheduled from{" "}
                <span className="font-semibold text-muted line-through">
                  {formatDateLabel(h.from.date)} · {formatTime12(h.from.start)}
                </span>{" "}
                to{" "}
                <span className="font-semibold text-text">
                  {formatDateLabel(h.to.date)} · {formatTime12(h.to.start)}
                </span>
                {h.reasonTag && <span className="text-muted"> · {h.reasonTag}</span>}
              </p>
            )}
            {h.type === "cancelled" && (
              <p className="text-sm text-muted">
                Cancelled
                {h.reasonTag && <span className="text-muted"> · {h.reasonTag}</span>}
              </p>
            )}
            {h.type === "completed" && <p className="text-sm text-muted">Live class session completed</p>}
            {h.reason && <p className="mt-0.5 text-xs italic text-muted">"{h.reason}"</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

// BookingDetailPopover — the slide-over any booked/cancelled/rescheduled
// slot opens into: read-only where the booking is no longer live, but
// otherwise the hub for Reschedule, Cancel, Message and Join, with the
// full history timeline so a moved or cancelled session never looks like
// it just silently changed. Right-edge drawer (same shell/motion as
// StudentProgressDrawer) rather than the shared centered Modal, since this
// is drilling into one calendar slot, not a separate dialog — and it's
// already full-width below the drawer's own max-w-md on any phone-sized
// viewport, so no separate mobile layout is needed.
export default function BookingDetailPopover({ slot, onClose, onReschedule, onCancel, onOpenSlotId, onScheduleLiveClass, onJoinLiveClass, onEditLiveClass }) {
  const now = useNow(15000);
  const [entered, setEntered] = useState(false);
  const open = Boolean(slot);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const badge = STATUS_BADGE[slot.status] ?? STATUS_BADGE.booked;
  const isLive = slot.status === "booked";
  const mins = minutesUntilSlot(slot, now);
  const soon = mins <= 15 && mins >= -15;
  const shortNotice = isLive && mins >= 0 && mins < SHORT_NOTICE_BUFFER_MIN;
  const primaryBooking = slot.bookings?.[0];
  const isGroup = (slot.bookings?.length || 0) > 1;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-text/50 transition-opacity duration-200 ease-out ${entered ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex h-full w-full max-w-md flex-col overflow-hidden rounded-l-3xl bg-bg shadow-elevated transition-transform duration-200 ease-out ${
          entered ? "translate-x-0" : "translate-x-4 opacity-0"
        }`}
      >
        <div className="flex items-start justify-between gap-3 border-b border-text/[0.07] bg-white px-5 py-4">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {primaryBooking ? initials(primaryBooking.studentName) : "?"}
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-text">
                  {isGroup ? `${slot.bookings.length} students` : primaryBooking?.studentName || "Unbooked"}
                </p>
                <p className="truncate text-xs text-muted">{primaryBooking?.courseTitle}</p>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-full p-1.5 text-muted hover:bg-bg hover:text-text">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5">
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-text/[0.06] px-3 py-1 text-xs font-semibold text-muted">{slot.sessionType}</span>
              <StatusBadge status={badge.status}>{badge.label}</StatusBadge>
              {slot.origin === "adhoc" && <span className="rounded-full bg-text/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted">Ad-hoc time</span>}
              {slot.recurrence && (
                <span className="flex items-center gap-1 rounded-full bg-text/[0.05] px-2.5 py-1 text-[11px] font-medium text-muted">
                  <RepeatIcon className="h-3 w-3" /> Recurring series
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm text-muted shadow-soft">
              <ClockIcon className="h-4 w-4 shrink-0 text-muted" />
              <span>
                {formatDateLabel(slot.date, { weekday: "long", month: "long", day: "numeric" })} · {formatTime12(slot.start)}–{formatTime12(slot.end)}
              </span>
              {soon && isLive && <span className="ml-auto shrink-0 rounded-full bg-danger/12 px-2 py-0.5 text-[10px] font-bold text-danger">Starting soon</span>}
            </div>

            {slot.liveClass && (
              <div className={`flex items-center gap-3 rounded-xl px-4 py-3 ${slot.liveClass.status === "completed" ? "bg-success/10" : "bg-primary/[0.06]"}`}>
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${slot.liveClass.status === "completed" ? "bg-success/15 text-success" : "bg-primary/15 text-primary"}`}>
                  {slot.liveClass.status === "completed" ? <CheckIcon className="h-4 w-4" /> : <VideoIcon className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{slot.liveClass.title}</p>
                  <p className="flex flex-wrap items-center gap-1.5 text-xs text-muted">
                    {slot.liveClass.status === "completed" ? "Session completed" : slot.liveClass.status === "live" ? "Live now" : "Live Class Scheduled"}
                    <MeetingProviderChip provider={slot.liveClass.meeting?.provider} />
                  </p>
                </div>
                {slot.liveClass.status !== "completed" && isLive && (
                  <JoinSessionButton session={slot} now={now} onJoin={onJoinLiveClass} size="sm" />
                )}
              </div>
            )}

            {slot.status === "rescheduled" && slot.supersededBySlotId && (
              <button
                type="button"
                onClick={() => onOpenSlotId?.(slot.supersededBySlotId)}
                className="flex items-center justify-between rounded-xl bg-warning/10 px-4 py-3 text-left text-sm font-medium text-warning transition-colors hover:bg-warning/15"
              >
                This session was moved — view its new time
                <ArrowRightIcon className="h-4 w-4 shrink-0" />
              </button>
            )}

            {shortNotice && (
              <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                This session starts soon — short-notice changes may be disruptive for {isGroup ? "attendees" : primaryBooking?.studentName?.split(" ")[0] || "the student"}.
              </div>
            )}

            {isGroup ? (
              <div className="flex flex-col gap-2">
                {slot.bookings.map((b) => (
                  <div key={b.id} className="flex items-start gap-3 rounded-2xl bg-white px-4 py-3 shadow-soft">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                      {initials(b.studentName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                        <UsersIcon className="h-3.5 w-3.5 text-muted" />
                        {b.studentName}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <BookIcon className="h-3 w-3" />
                        {b.courseTitle}
                      </p>
                      {b.note && <p className="mt-1.5 text-xs text-muted">"{b.note}"</p>}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              primaryBooking?.note && (
                <div className="rounded-2xl bg-white px-4 py-3 shadow-soft">
                  <span className="mb-1 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <CalendarIcon className="h-3 w-3" />
                    Agenda note
                  </span>
                  <p className="text-sm text-muted">"{primaryBooking.note}"</p>
                </div>
              )
            )}

            <HistoryTimeline history={slot.history} />
          </div>
        </div>

        <div className="flex flex-col gap-2 border-t border-text/[0.07] bg-white px-5 py-4">
          {isLive ? (
            <>
              <div className="grid grid-cols-2 gap-2">
                {slot.liveClass && onEditLiveClass ? (
                  <Button variant="secondary" fullWidth className="flex items-center justify-center gap-1.5 text-sm" onClick={() => onEditLiveClass(slot)}>
                    <PencilIcon className="h-4 w-4" />
                    Edit session
                  </Button>
                ) : (
                  <Button variant="secondary" fullWidth className="flex items-center justify-center gap-1.5 text-sm" onClick={() => onReschedule?.(slot)}>
                    <PencilIcon className="h-4 w-4" />
                    Reschedule
                  </Button>
                )}
                <Button
                  variant="secondary"
                  fullWidth
                  className="flex items-center justify-center gap-1.5 border-danger text-danger hover:bg-danger/5"
                  onClick={() => onCancel?.(slot)}
                >
                  <TrashIcon className="h-4 w-4" />
                  Cancel
                </Button>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {!slot.liveClass ? (
                  <Button fullWidth className="flex items-center justify-center gap-1.5" onClick={() => onScheduleLiveClass?.(slot)}>
                    <VideoIcon className="h-4 w-4" />
                    Schedule Live Class
                  </Button>
                ) : (
                  <JoinSessionButton session={slot} now={now} onJoin={onJoinLiveClass} size="lg" fullWidth />
                )}
              </div>
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}
