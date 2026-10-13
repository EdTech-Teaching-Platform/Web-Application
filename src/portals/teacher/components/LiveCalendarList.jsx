import EmptyState from "../../../components/ui/EmptyState";
import { CalendarIcon } from "../../../components/ui/icons";
import { formatDateLabel } from "../data/teacherAvailability";
import { dayKey } from "../data/liveJoin";
import { sortSessions } from "../data/liveSessions";
import LiveSessionCard from "./LiveSessionCard";

// LiveCalendarList — chronological list of live sessions for the Day view
// (one day, no date repeated per card) and the Agenda view (grouped under
// day headings; also the default on phones). Always soonest-first.
export default function LiveCalendarList({ sessions, courses, now, mode, emptyLabel, onOpenSession, onEdit, onJoin }) {
  const sorted = sortSessions(sessions);
  if (sorted.length === 0) {
    return <EmptyState icon={CalendarIcon} heading="Nothing scheduled" message={emptyLabel} />;
  }

  const groups = [];
  sorted.forEach((s) => {
    const last = groups[groups.length - 1];
    if (last && last.date === s.date) last.items.push(s);
    else groups.push({ date: s.date, items: [s] });
  });
  const todayKey = dayKey(now);

  return (
    <div className="flex flex-col gap-5">
      {groups.map((g) => (
        <section key={g.date} aria-label={formatDateLabel(g.date, { weekday: "long", month: "long", day: "numeric" })}>
          {mode === "agenda" && (
            <h3 className="mb-2 flex items-center gap-2 px-1 text-xs font-semibold uppercase tracking-wide text-muted">
              {formatDateLabel(g.date, { weekday: "short", month: "short", day: "numeric" })}
              {g.date === todayKey && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-bold normal-case tracking-normal text-white">Today</span>}
            </h3>
          )}
          <div className="flex flex-col gap-3">
            {g.items.map((s) => (
              <LiveSessionCard
                key={s.id}
                slot={s}
                now={now}
                courses={courses}
                showDate={false}
                onOpen={onOpenSession}
                onEdit={onEdit}
                onJoin={onJoin}
                className="bg-surface shadow-soft"
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
