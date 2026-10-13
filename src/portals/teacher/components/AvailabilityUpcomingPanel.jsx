import { useNow } from "../data/liveJoin";
import JoinSessionButton from "./JoinSessionButton";
import { formatTime12 } from "../data/teacherAvailability";
import { UsersIcon, BookIcon, ChevronRightIcon, VideoIcon } from "../../../components/ui/icons";

function minutesUntil(slot, now) {
  const [h, m] = slot.start.split(":").map(Number);
  const dt = new Date(slot.date);
  dt.setHours(h, m, 0, 0);
  return Math.round((dt - now) / 60000);
}

// AvailabilityUpcomingPanel — a compact "what's next" strip so the
// educator doesn't have to scan the whole grid to see who's booked soon.
// Each card opens the same booking detail slide-over the calendar and
// agenda use (Reschedule/Cancel live there), so this panel is a shortcut
// into the same flows, not a separate surface. The Join button mirrors
// how a live-class join action reads elsewhere in the portal (primary,
// filled, play icon) once a session is close enough to start — the actual
// join mechanism lives in Live Classes, not here. Join/Locked state comes
// from the shared joinState helper (data/liveJoin.js) like every other
// live class Join button.
export default function AvailabilityUpcomingPanel({ slots, onOpenSlot, onScheduleLiveClass, onJoinLiveClass }) {
  const now = useNow(15000);
  const upcoming = slots
    .filter((s) => s.status === "booked" && minutesUntil(s, now) > -60)
    .sort((a, b) => minutesUntil(a, now) - minutesUntil(b, now))
    .slice(0, 4);

  return (
    <div className="rounded-3xl bg-white p-5 shadow-soft">
      <h2 className="mb-3 text-sm font-semibold text-text">Upcoming sessions</h2>
      {upcoming.length === 0 ? (
        <p className="py-4 text-center text-xs text-muted">No confirmed bookings coming up.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {upcoming.map((s) => {
            const mins = minutesUntil(s, now);
            const soon = mins <= 15 && mins >= -15;
            return (
              <div key={s.id} className="rounded-xl bg-bg p-3.5 transition-colors hover:bg-primary/[0.05]">
              <button type="button" onClick={() => onOpenSlot?.(s)} className="group w-full text-left">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold text-muted">
                    {new Date(s.date).toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(s.start)}
                  </span>
                  {soon ? (
                    <span className="rounded-full bg-danger/12 px-2 py-0.5 text-[10px] font-bold text-danger">Starting soon</span>
                  ) : (
                    <ChevronRightIcon className="h-3.5 w-3.5 shrink-0 text-text/25 transition-transform group-hover:translate-x-0.5" />
                  )}
                </div>
                <p className="mt-1.5 flex items-center gap-1.5 text-sm font-semibold text-text">
                  <UsersIcon className="h-3.5 w-3.5 text-muted" />
                  {s.bookings.map((b) => b.studentName).join(", ")}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
                  <BookIcon className="h-3 w-3" />
                  {s.bookings[0]?.courseTitle} · {s.sessionType}
                </p>
              </button>
                {s.liveClass ? (
                  <div className="mt-2.5">
                    <JoinSessionButton session={s} now={now} onJoin={onJoinLiveClass} fullWidth />
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onScheduleLiveClass?.(s)}
                    title="Turn this booking into a live class"
                    className="mt-2.5 flex w-full items-center justify-center gap-1.5 rounded-full bg-text/[0.06] py-2 text-xs font-semibold text-muted transition-colors duration-150 hover:bg-primary/10 hover:text-primary"
                  >
                    <VideoIcon className="h-3.5 w-3.5" />
                    Schedule Live Class
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
