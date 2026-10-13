import { useState } from "react";
import { formatTime12 } from "../data/teacherAvailability";
import { ClockIcon, UsersIcon, TrashIcon, RepeatIcon, PencilIcon, MoreIcon, VideoIcon } from "../../../components/ui/icons";
import StatusBadge from "../../../components/ui/StatusBadge";
import JoinSessionButton from "./JoinSessionButton";
import { joinState, useNow } from "../data/liveJoin";

// Maps a slot's status onto the shared StatusBadge's status tokens (the
// same three success/warning/danger + neutral used for every other
// lifecycle badge in the app) instead of a locally-styled variant.
const STATUS_META = {
  open: { label: "Open", status: "neutral" },
  booked: { label: "Booked", status: "success" },
  cancelled: { label: "Cancelled", status: "neutral" },
  rescheduled: { label: "Rescheduled", status: "warning" },
  completed: { label: "Completed", status: "success" },
};

function RowActions({ slot, now, onOpenSlot, onCancelSlot, onReschedule, onCancelBooking, onScheduleLiveClass, onJoinLiveClass }) {
  const [menuOpen, setMenuOpen] = useState(false);

  if (slot.status === "open") {
    return (
      <>
        <div className="hidden items-center gap-1 sm:flex">
          <button type="button" onClick={() => onOpenSlot(slot)} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.06]">
            Edit
          </button>
          <button type="button" onClick={() => onCancelSlot(slot)} aria-label="Delete slot" className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
        <MobileKebab
          open={menuOpen}
          setOpen={setMenuOpen}
          actions={[
            { label: "Edit", onClick: () => onOpenSlot(slot) },
            { label: "Delete", danger: true, onClick: () => onCancelSlot(slot) },
          ]}
        />
      </>
    );
  }

  if (slot.status === "booked") {
    return (
      <>
        <div className="hidden items-center gap-1 sm:flex">
          <button type="button" onClick={() => onOpenSlot(slot)} className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.06]">
            Details
          </button>
          <button
            type="button"
            onClick={() => onReschedule(slot)}
            className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-bg hover:text-text"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Reschedule
          </button>
          <button type="button" onClick={() => onCancelBooking(slot)} aria-label="Cancel booking" className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
            <TrashIcon className="h-4 w-4" />
          </button>
          {slot.liveClass ? (
            <JoinSessionButton session={slot} now={now} onJoin={onJoinLiveClass} size="sm" />
          ) : (
            <button
              type="button"
              onClick={() => onScheduleLiveClass(slot)}
              className="flex items-center gap-1 rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-bg hover:text-text"
            >
              <VideoIcon className="h-3.5 w-3.5" />
              Live Class
            </button>
          )}
        </div>
        <MobileKebab
          open={menuOpen}
          setOpen={setMenuOpen}
          actions={[
            { label: "Details", onClick: () => onOpenSlot(slot) },
            { label: "Reschedule", onClick: () => onReschedule(slot) },
            slot.liveClass
              ? (() => {
                  const js = joinState(slot, now);
                  return { label: js.state === "open" ? "Join live class" : "Join locked", disabled: js.state !== "open", hint: js.reason, onClick: () => onJoinLiveClass(slot) };
                })()
              : { label: "Schedule live class", onClick: () => onScheduleLiveClass(slot) },
            { label: "Cancel booking", danger: true, onClick: () => onCancelBooking(slot) },
          ]}
        />
      </>
    );
  }

  if (slot.status === "completed") {
    return (
      <>
        <button
          type="button"
          onClick={() => onOpenSlot(slot)}
          className="hidden rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.06] sm:block"
        >
          Details
        </button>
        <MobileKebab open={menuOpen} setOpen={setMenuOpen} actions={[{ label: "Details", onClick: () => onOpenSlot(slot) }]} />
      </>
    );
  }

  // cancelled / rescheduled — terminal, history-only rows
  return (
    <>
      <button type="button" onClick={() => onOpenSlot(slot)} className="hidden rounded-full px-2.5 py-1.5 text-xs font-semibold text-muted hover:bg-bg hover:text-text sm:block">
        Details
      </button>
      <MobileKebab open={menuOpen} setOpen={setMenuOpen} actions={[{ label: "Details", onClick: () => onOpenSlot(slot) }]} />
    </>
  );
}

function MobileKebab({ open, setOpen, actions }) {
  return (
    <div className="relative sm:hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-text"
      >
        <MoreIcon className="h-4 w-4" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close menu" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="absolute right-0 top-full z-20 mt-1 flex w-40 flex-col overflow-hidden rounded-2xl bg-white py-1 shadow-lg">
            {actions.map((a) => (
              <button
                key={a.label}
                type="button"
                disabled={a.disabled}
                title={a.disabled ? a.hint : undefined}
                onClick={() => {
                  setOpen(false);
                  a.onClick();
                }}
                className={`px-3.5 py-2 text-left text-sm font-medium transition-colors hover:bg-bg disabled:cursor-not-allowed disabled:text-text/35 disabled:hover:bg-transparent ${a.danger ? "text-danger" : "text-text"}`}
              >
                {a.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// AvailabilityAgendaView — the secondary, simpler chronological view: one
// row per slot, sorted soonest-first. Cancelled and rescheduled bookings
// stay in this list too (muted, with their final status badge) instead of
// disappearing, so the educator keeps a clear history — only truly deleted
// never-booked availability is ever removed outright. Row actions collapse
// into a kebab menu below the sm breakpoint.
export default function AvailabilityAgendaView({ slots, onOpenSlot, onCancelSlot, onReschedule, onCancelBooking, onScheduleLiveClass, onJoinLiveClass }) {
  const now = useNow(15000);
  const sorted = [...slots].sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
        <ClockIcon className="h-6 w-6 text-text/20" />
        <p className="mt-3 text-sm font-medium text-muted">Nothing on the schedule.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col divide-y divide-text/[0.06] rounded-3xl bg-white shadow-soft">
      {sorted.map((s) => {
        const meta = STATUS_META[s.status] ?? STATUS_META.open;
        const muted = s.status === "cancelled" || s.status === "rescheduled";
        return (
          <div key={s.id} className={`flex items-center gap-3 px-4 py-3.5 ${muted ? "opacity-60" : ""}`}>
            <div className="w-20 shrink-0">
              <p className="text-sm font-semibold text-text">{new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</p>
              <p className="text-xs text-muted">{formatTime12(s.start)}</p>
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1.5 truncate text-sm font-medium text-text">
                {s.sessionType}
                {s.recurrence && <RepeatIcon className="h-3 w-3 shrink-0 text-muted" title="Recurring" />}
                {s.bookings?.[0]?.sessionTag === "mentorship" && (
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                    Mentorship
                  </span>
                )}
              </p>
              {s.bookings?.length > 0 && (
                <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <UsersIcon className="h-3 w-3" />
                  {s.bookings.map((b) => b.studentName).join(", ")}
                </p>
              )}
            </div>
            <StatusBadge status={meta.status} size="sm" showIcon={false} className="shrink-0">
              {s.status === "booked" && s.liveClass ? (s.liveClass.status === "live" ? "Live now" : "Live scheduled") : meta.label}
            </StatusBadge>
            <RowActions
              slot={s}
              now={now}
              onOpenSlot={onOpenSlot}
              onCancelSlot={onCancelSlot}
              onReschedule={onReschedule}
              onCancelBooking={onCancelBooking}
              onScheduleLiveClass={onScheduleLiveClass}
              onJoinLiveClass={onJoinLiveClass}
            />
          </div>
        );
      })}
    </div>
  );
}
