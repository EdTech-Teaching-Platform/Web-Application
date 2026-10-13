import { useMemo, useState } from "react";
import { ChevronRightIcon } from "./icons";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

function buildMonthGrid(year, month) {
  const first = new Date(year, month, 1);
  const startOffset = first.getDay(); // 0 = Sunday
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

// Calendar — month-grid widget (design.md's named component list doesn't
// cover one yet; added here since Mentorship Hub, Live Classes and any
// portal's "my schedule" view will all need the same grid+event-dot
// pattern — build once to spec rather than let a second portal fork it).
// Read-only for now (no real navigation/event wiring): prev/next just move
// the visible month locally, and eventDays/highlightDays are date numbers
// for the CURRENT rendered month only. Swap for real calendar data once an
// events endpoint exists.
//
// Usage:
//   <Calendar eventDays={[12, 13, 15]} />
export default function Calendar({ eventDays = [], className = "" }) {
  const today = new Date();
  const [cursor, setCursor] = useState({ year: today.getFullYear(), month: today.getMonth() });

  const cells = useMemo(() => buildMonthGrid(cursor.year, cursor.month), [cursor]);
  const monthLabel = useMemo(
    () => new Date(cursor.year, cursor.month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" }),
    [cursor]
  );
  const isCurrentMonth = cursor.year === today.getFullYear() && cursor.month === today.getMonth();
  const eventSet = new Set(eventDays);

  function shiftMonth(delta) {
    setCursor((c) => {
      const next = new Date(c.year, c.month + delta, 1);
      return { year: next.getFullYear(), month: next.getMonth() };
    });
  }

  return (
    <div className={className}>
      <div className="mb-3 flex items-center justify-between">
        <span className="text-sm font-semibold text-text">{monthLabel}</span>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => shiftMonth(-1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-text/50 transition-colors hover:bg-bg hover:text-text"
          >
            <ChevronRightIcon className="h-4 w-4 rotate-180" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
            className="flex h-7 w-7 items-center justify-center rounded-full text-text/50 transition-colors hover:bg-bg hover:text-text"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 gap-y-1.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="text-[11px] font-semibold uppercase tracking-wide text-text/35">
            {w}
          </span>
        ))}
        {cells.map((day, i) => {
          const isToday = isCurrentMonth && day === today.getDate();
          const hasEvent = isCurrentMonth && day && eventSet.has(day);
          return (
            <div key={i} className="flex items-center justify-center py-1">
              {day ? (
                <span
                  className={`relative flex h-8 w-8 items-center justify-center rounded-full text-sm transition-colors duration-150 ${
                    isToday ? "bg-primary font-semibold text-white" : "text-text/75 hover:bg-bg"
                  }`}
                >
                  {day}
                  {hasEvent && !isToday && (
                    <span className="absolute bottom-0.5 h-1 w-1 rounded-full bg-rotation-2" aria-hidden="true" />
                  )}
                </span>
              ) : (
                <span />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
