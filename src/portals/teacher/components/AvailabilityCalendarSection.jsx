import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTeacherAvailability } from "../context/TeacherAvailabilityContext";
import { TODAY } from "../data/teacherCourses";
import { joinLiveSession } from "../data/meetingProviders";
import {
  startOfWeek,
  addDays,
  isoDate,
  formatTime12,
} from "../data/teacherAvailability";
import AvailabilityWeekGrid from "./AvailabilityWeekGrid";
import AvailabilityAgendaView from "./AvailabilityAgendaView";
import AvailabilityUpcomingPanel from "./AvailabilityUpcomingPanel";
import BookingDetailPopover from "./BookingDetailPopover";
import RescheduleBookingPanel from "./RescheduleBookingPanel";
import CancelBookingModal from "./CancelBookingModal";
import Calendar from "../../../components/ui/Calendar";
import Button from "../../../components/ui/Button";
import {
  ChevronRightIcon,
  CalendarIcon,
  ClockIcon,
} from "../../../components/ui/icons";

const VIEWS = [
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
  { key: "month", label: "Month" },
  { key: "agenda", label: "Agenda" },
];

const STATUS_DOT = {
  open: "bg-primary",
  booked: "bg-success",
  cancelled: "bg-text/25",
  rescheduled: "bg-warning",
  completed: "bg-success/60",
};

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">
      {message}
    </div>
  );
}

// AvailabilityCalendarSection — the top-level orchestrator for Part 2 of
// this screen. Owns the current view + visible date range and wires the
// grid/agenda/month sub-views, the upcoming-sessions sidebar, the
// create/edit panel + booking detail slide-over, Scheduled Call Booking
// and Reschedule/Cancel Booking together over one shared
// TeacherAvailabilityContext, so quick-setup, drag-to-create, manual
// editing, educator-initiated booking and every reschedule/cancel all
// land in the exact same underlying slot list.
export default function AvailabilityCalendarSection() {
  const {
    slots,
    deleteSlot,
    cancelSlot,
    rescheduleBooking,
    cancelBooking,
    getSeriesFutureCount,
  } = useTeacherAvailability();
  const navigate = useNavigate();

  const [view, setView] = useState("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(TODAY));
  const [dayCursor, setDayCursor] = useState(() => new Date(TODAY));
  const [toast, setToast] = useState("");

  const [detailSlot, setDetailSlot] = useState(null);
  const [reschedulingSlot, setReschedulingSlot] = useState(null);
  const [cancellingSlot, setCancellingSlot] = useState(null);

  const todayIso = isoDate(TODAY);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const days = useMemo(() => {
    if (view === "day") return [dayCursor];
    return Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  }, [view, weekStart, dayCursor]);

  function goPrev() {
    if (view === "day") setDayCursor((d) => addDays(d, -1));
    else setWeekStart((w) => addDays(w, -7));
  }
  function goNext() {
    if (view === "day") setDayCursor((d) => addDays(d, 1));
    else setWeekStart((w) => addDays(w, 7));
  }
  function goToday() {
    setWeekStart(startOfWeek(TODAY));
    setDayCursor(new Date(TODAY));
  }

  // Availability is a read-only schedule display now (no manual
  // open-slot creation/edit panel) — every slot, whatever its status,
  // opens the same read-only detail view. Dragging on the grid is a no-op
  // (see the AvailabilityWeekGrid usage below) rather than opening a
  // create panel.
  function openSlot(slot) {
    setDetailSlot(slot);
  }

  function openSlotById(slotId) {
    const found = slots.find((s) => s.id === slotId);
    if (found) setDetailSlot(found);
  }

  function handleAgendaCancel(slot) {
    if (slot.status === "open") deleteSlot(slot.id);
    else cancelSlot(slot.id);
    flash("Removed from schedule.");
  }

  function handleReschedule(slot) {
    setDetailSlot(null);
    setReschedulingSlot(slot);
  }
  function handleCancelBooking(slot) {
    setDetailSlot(null);
    setCancellingSlot(slot);
  }
  function handleScheduleLiveClass(slot) {
    setDetailSlot(null);
    const courseId = slot?.bookings?.[0]?.courseId;
    navigate(courseId ? `/teacher/liveclasses?courseId=${courseId}` : "/teacher/liveclasses");
  }
  function handleJoinLiveClass(slot) {
    setDetailSlot(null);
    // Defence in depth: the buttons already render Locked, but a stale
    // click must never open a not-yet-unlocked session's meeting link.
    const res = joinLiveSession(slot);
    if (!res.ok) flash(res.message);
  }

  const rangeLabel = useMemo(() => {
    if (view === "day") {
      return dayCursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
    }
    const end = addDays(weekStart, 6);
    const sameMonth = weekStart.getMonth() === end.getMonth();
    const startLabel = weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const endLabel = end.toLocaleDateString(undefined, sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
    return `${startLabel} – ${endLabel}`;
  }, [view, weekStart, dayCursor]);

  const hasAnySlots = slots.length > 0;

  // Month view is read-only (the shared Calendar widget has no per-day
  // click hook), so it pairs a dot-summary of TODAY's month with a
  // scrollable list of that month's slots beneath it.
  const monthSlots = useMemo(() => {
    const y = TODAY.getFullYear();
    const m = TODAY.getMonth();
    return slots
      .filter((s) => {
        const d = new Date(s.date);
        return d.getFullYear() === y && d.getMonth() === m && s.status !== "cancelled" && s.status !== "rescheduled";
      })
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }, [slots]);
  const monthEventDays = useMemo(
    () => [...new Set(monthSlots.map((s) => new Date(s.date).getDate()))],
    [monthSlots]
  );

  if (!hasAnySlots) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
        <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
          <CalendarIcon className="h-6 w-6" />
        </span>
        <h3 className="mt-4 text-base font-semibold text-text">Nothing scheduled yet</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted">
          Sessions from accepted requests and scheduled live classes will appear here.
        </p>
        <div className="mt-5 flex flex-wrap items-center justify-center gap-3">
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-6" onClick={() => navigate("/teacher/requests")}>
            <CalendarIcon className="h-4 w-4" />
            View Session Requests
          </Button>
          <Button fullWidth={false} className="px-6" onClick={() => navigate("/teacher/liveclasses")}>
            Schedule a Live Class
          </Button>
        </div>
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
      <div className="min-w-0 flex-1">
        {/* Header controls */}
        <div className="flex flex-col gap-4 rounded-3xl bg-white p-4 sm:p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-1 rounded-full bg-text/[0.05] p-1">
              {VIEWS.map((v) => (
                <button
                  key={v.key}
                  type="button"
                  aria-pressed={view === v.key}
                  onClick={() => setView(v.key)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 ${
                    view === v.key ? "bg-primary text-white" : "text-muted hover:text-text"
                  } hover:-translate-y-0.5 hover:shadow-soft`}
                >
                  {v.label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                fullWidth={false}
                className="flex items-center gap-1.5 px-4 py-2 text-xs"
                onClick={() => navigate("/teacher/requests")}
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Session Requests
              </Button>
              <Button fullWidth={false} className="px-4 py-2 text-xs" onClick={() => navigate("/teacher/liveclasses")}>
                Schedule Live Class
              </Button>
            </div>
          </div>

          {(view === "week" || view === "day") && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  aria-label="Previous"
                  onClick={goPrev}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  <ChevronRightIcon className="h-4 w-4 rotate-180" />
                </button>
                <button
                  type="button"
                  onClick={goToday}
                  className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  Today
                </button>
                <button
                  type="button"
                  aria-label="Next"
                  onClick={goNext}
                  className="flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text"
                >
                  <ChevronRightIcon className="h-4 w-4" />
                </button>
                <span className="ml-1.5 text-sm font-semibold text-text">{rangeLabel}</span>
              </div>
              <span className="flex items-center gap-1.5 rounded-full bg-bg px-3 py-1.5 text-xs font-medium text-muted">
                <ClockIcon className="h-3.5 w-3.5" />
                All times shown in your local timezone — IST
              </span>
            </div>
          )}
        </div>

        {/* Legend */}
        <div className="mt-3 flex flex-wrap items-center gap-4 px-1 text-xs font-medium text-muted">
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-primary/40 ring-1 ring-primary/50" /> Open
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-success/60 ring-1 ring-success" /> Booked
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-warning/50 ring-1 ring-warning" /> Rescheduled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-text/15 ring-1 ring-text/20" /> Cancelled
          </span>
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-success/30 ring-1 ring-success/50" /> Completed
          </span>
        </div>

        {/* Body */}
        <div className="mt-3">
          {(view === "week" || view === "day") && (
            <AvailabilityWeekGrid
              days={days}
              slots={slots}
              onCreateRange={() => {}}
              onOpenSlot={openSlot}
              todayIso={todayIso}
            />
          )}

          {view === "agenda" && (
            <AvailabilityAgendaView
              slots={slots}
              onOpenSlot={openSlot}
              onCancelSlot={handleAgendaCancel}
              onReschedule={handleReschedule}
              onCancelBooking={handleCancelBooking}
              onScheduleLiveClass={handleScheduleLiveClass}
              onJoinLiveClass={handleJoinLiveClass}
            />
          )}

          {view === "month" && (
            <div className="flex flex-col gap-4 rounded-3xl bg-white p-5 sm:flex-row shadow-soft">
              <Calendar eventDays={monthEventDays} className="sm:w-72 sm:shrink-0" />
              <div className="min-w-0 flex-1 border-text/[0.06] sm:border-l sm:pl-5">
                <h3 className="text-sm font-semibold text-text">This month</h3>
                {monthSlots.length === 0 ? (
                  <p className="mt-3 text-sm text-muted">Nothing scheduled this month.</p>
                ) : (
                  <div className="mt-3 flex max-h-80 flex-col divide-y divide-text/[0.06] overflow-y-auto">
                    {monthSlots.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => openSlot(s)}
                        className="flex items-center gap-3 py-2.5 text-left transition-colors hover:bg-bg"
                      >
                        <span className={`h-2 w-2 shrink-0 rounded-full ${STATUS_DOT[s.status]}`} />
                        <span className="w-16 shrink-0 text-xs font-semibold text-muted">
                          {new Date(s.date).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-sm text-text">
                          {s.sessionType} · {formatTime12(s.start)}
                        </span>
                        {s.status === "booked" && (
                          <span className="shrink-0 truncate text-xs text-muted">{s.bookings[0]?.studentName}</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="w-full shrink-0 lg:w-80">
        <AvailabilityUpcomingPanel
          slots={slots}
          onOpenSlot={setDetailSlot}
          onScheduleLiveClass={handleScheduleLiveClass}
          onJoinLiveClass={handleJoinLiveClass}
        />
      </div>

      {detailSlot && (
        <BookingDetailPopover
          slot={detailSlot}
          onClose={() => setDetailSlot(null)}
          onReschedule={handleReschedule}
          onCancel={handleCancelBooking}
          onOpenSlotId={openSlotById}
          onScheduleLiveClass={handleScheduleLiveClass}
          onJoinLiveClass={handleJoinLiveClass}
        />
      )}

      {reschedulingSlot && (
        <RescheduleBookingPanel
          open={Boolean(reschedulingSlot)}
          slot={reschedulingSlot}
          slots={slots}
          onClose={() => setReschedulingSlot(null)}
          onReschedule={(slotId, payload) => {
            const res = rescheduleBooking(slotId, payload);
            if (res.ok) flash("Session rescheduled — the student has been notified.");
            return res;
          }}
          onViewBooking={(slot) => setDetailSlot(slot)}
        />
      )}

      {cancellingSlot && (
        <CancelBookingModal
          open={Boolean(cancellingSlot)}
          slot={cancellingSlot}
          seriesFutureCount={getSeriesFutureCount(cancellingSlot.id)}
          onClose={() => setCancellingSlot(null)}
          onCancelBooking={(slotId, payload) => cancelBooking(slotId, payload)}
          onDone={() => flash("Booking cancelled — the student has been notified.")}
        />
      )}

      <Toast message={toast} />
    </div>
  );
}
