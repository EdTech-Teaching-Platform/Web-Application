import { ICON_TONES, toneForKey } from "../../../components/ui/IconBadge";
import { WEEKDAY_LABELS, addDays, formatTime12, startOfWeek } from "../data/teacherAvailability";
import { dayKey } from "../data/liveJoin";
import { courseIdOf, courseTitleOf, sortSessions } from "../data/liveSessions";

const MAX_CHIPS = 2;

// LiveCalendarMonth — month grid of live sessions only. Each day shows up
// to two compact "time · course" chips (colour-coded per course with the
// shared pastel tones) and a "+N more" link that jumps to that day's Day
// view. Below the sm breakpoint chips collapse to dots so cells stay
// tappable; tapping a day opens its Day view.
export default function LiveCalendarMonth({ cursor, sessions, todayKey, nowTime, onOpenSession, onOpenDay }) {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const gridStart = startOfWeek(first);
  const days = Array.from({ length: 42 }).map((_, i) => addDays(gridStart, i));
  // Drop a fully-foreign trailing week so months don't show a blank row.
  const rows = days.slice(35).every((d) => d.getMonth() !== cursor.getMonth()) ? 5 : 6;
  const shown = days.slice(0, rows * 7);

  const byDay = {};
  sortSessions(sessions).forEach((s) => {
    (byDay[s.date] = byDay[s.date] || []).push(s);
  });

  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-soft">
      <div className="grid grid-cols-7 border-b border-text/[0.06]">
        {WEEKDAY_LABELS.map((w) => (
          <div key={w} className="px-1 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wide text-muted">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {shown.map((d) => {
          const key = dayKey(d);
          const inMonth = d.getMonth() === cursor.getMonth();
          const isToday = key === todayKey;
          const list = byDay[key] || [];
          const extra = list.length - MAX_CHIPS;
          return (
            <div
              key={key}
              className={`min-h-[64px] border-b border-l border-text/[0.06] p-1 sm:min-h-[108px] sm:p-1.5 ${inMonth ? "" : "bg-bg/60"}`}
            >
              <button
                type="button"
                onClick={() => onOpenDay(d)}
                aria-label={`${d.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" })}${list.length ? `, ${list.length} live session${list.length === 1 ? "" : "s"}` : ""}`}
                className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold transition-colors hover:bg-primary/10 ${
                  isToday ? "bg-primary text-white hover:bg-primary" : inMonth ? "text-text" : "text-muted/60"
                }`}
              >
                {d.getDate()}
              </button>

              <div className="mt-1 hidden flex-col gap-1 sm:flex">
                {list.slice(0, MAX_CHIPS).map((s) => {
                  const tone = ICON_TONES[toneForKey(courseIdOf(s) || courseTitleOf(s))];
                  const past = new Date(`${s.date}T${s.end}:00`) < nowTime;
                  return (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => onOpenSession(s)}
                      title={`${formatTime12(s.start)} · ${courseTitleOf(s)}`}
                      className={`block w-full truncate rounded-md px-1.5 py-1 text-left text-[11px] font-semibold leading-tight transition-all duration-150 hover:-translate-y-0.5 hover:shadow-soft ${tone} ${past ? "opacity-55" : ""}`}
                    >
                      {formatTime12(s.start)} · {courseTitleOf(s)}
                    </button>
                  );
                })}
                {extra > 0 && (
                  <button
                    type="button"
                    onClick={() => onOpenDay(d)}
                    className="rounded-md px-1.5 py-0.5 text-left text-[11px] font-semibold text-primary hover:bg-primary/[0.08]"
                  >
                    +{extra} more
                  </button>
                )}
              </div>

              {list.length > 0 && (
                <button type="button" onClick={() => onOpenDay(d)} aria-hidden="true" tabIndex={-1} className="mt-1 flex flex-wrap gap-0.5 sm:hidden">
                  {list.slice(0, 3).map((s) => (
                    <span key={s.id} className={`h-1.5 w-1.5 rounded-full ${ICON_TONES[toneForKey(courseIdOf(s) || courseTitleOf(s))].split(" ")[0]} ring-1 ring-text/20`} />
                  ))}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
