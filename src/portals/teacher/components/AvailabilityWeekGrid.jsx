import { useMemo, useRef, useState } from "react";
import { GRID_START_MIN, GRID_END_MIN, ROW_MIN, fromMinutes, formatTime12, isoDate } from "../data/teacherAvailability";
import { WEEKDAY_LABELS } from "../data/teacherAvailability";

// Enlarged from 26px so a 30-min slot has room to show session type +
// time at rest without truncating (Part 4 fix — blocks used to be too
// short to read "1:1 Doubt Clearing" at a glance).
const ROW_PX = 40;
const ROW_COUNT = (GRID_END_MIN - GRID_START_MIN) / ROW_MIN;

const TYPE_ACCENT = {
  open: "bg-primary/10 text-primary ring-1 ring-primary/25 hover:bg-primary/[0.16]",
  booked: "bg-success/15 text-success ring-1 ring-success/30",
  cancelled: "bg-text/[0.05] text-muted ring-1 ring-text/10 line-through",
  rescheduled: "bg-warning/15 text-warning ring-1 ring-warning/30 line-through",
  completed: "bg-success/10 text-success/70 ring-1 ring-success/20",
};

function minutesFromRow(rowIdx) {
  return GRID_START_MIN + rowIdx * ROW_MIN;
}

// AvailabilityWeekGrid — the primary Week/Day calendar surface: a
// scrollable time grid where existing slots render as absolutely
// positioned blocks over a column of invisible row targets, and dragging
// across those row targets within one day selects a new open range. Open
// vs booked vs rescheduled vs cancelled read as four visually distinct
// states per the spec, never just an empty cell standing in for "booked".
export default function AvailabilityWeekGrid({ days, slots, onCreateRange, onOpenSlot, todayIso, readOnly = false }) {
  const [drag, setDrag] = useState(null); // { dayIso, startRow, endRow }
  const containerRef = useRef(null);
  // One hover/tap-revealed detail card at a time — id of the slot it
  // belongs to. Mouse hover sets/clears it; on touch devices (no real
  // hover) the same state is toggled by a tap, so the card becomes
  // tap-to-reveal there instead.
  const [revealedId, setRevealedId] = useState(null);

  const slotsByDay = useMemo(() => {
    const map = {};
    days.forEach((d) => (map[isoDate(d)] = []));
    slots.forEach((s) => {
      if (map[s.date]) map[s.date].push(s);
    });
    return map;
  }, [days, slots]);

  function beginDrag(dayIso, rowIdx) {
    setDrag({ dayIso, startRow: rowIdx, endRow: rowIdx });
  }
  function extendDrag(dayIso, rowIdx) {
    setDrag((d) => (d && d.dayIso === dayIso ? { ...d, endRow: rowIdx } : d));
  }
  function endDrag() {
    if (!drag) return;
    const lo = Math.min(drag.startRow, drag.endRow);
    const hi = Math.max(drag.startRow, drag.endRow) + 1;
    onCreateRange(drag.dayIso, fromMinutes(minutesFromRow(lo)), fromMinutes(minutesFromRow(hi)));
    setDrag(null);
  }

  const hourRows = Array.from({ length: ROW_COUNT }).map((_, i) => i);

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
      <div className="grid" style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}>
        {/* Header row */}
        <div className="border-b border-text/[0.06]" />
        {days.map((d) => {
          const iso = isoDate(d);
          const isToday = iso === todayIso;
          return (
            <div key={iso} className="border-b border-l border-text/[0.06] px-2 py-2.5 text-center">
              <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{WEEKDAY_LABELS[d.getDay()]}</div>
              <div className={`mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full text-sm font-semibold ${isToday ? "bg-primary text-white" : "text-text"}`}>
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      <div
        ref={containerRef}
        onMouseUp={endDrag}
        onMouseLeave={() => drag && endDrag()}
        className="grid max-h-[560px] select-none overflow-y-auto"
        style={{ gridTemplateColumns: `56px repeat(${days.length}, 1fr)` }}
      >
        {/* Time labels column */}
        <div className="relative border-r border-text/[0.06]">
          {hourRows.map((r) => {
            const mins = minutesFromRow(r);
            const isHour = mins % 60 === 0;
            return (
              <div key={r} style={{ height: ROW_PX }} className="relative">
                {isHour && (
                  <span className="absolute -top-2 right-2 text-[10px] font-medium text-muted">{formatTime12(fromMinutes(mins))}</span>
                )}
              </div>
            );
          })}
        </div>

        {/* Day columns */}
        {days.map((d) => {
          const iso = isoDate(d);
          const daySlots = slotsByDay[iso] || [];
          const isDragCol = drag?.dayIso === iso;
          const dragLo = isDragCol ? Math.min(drag.startRow, drag.endRow) : null;
          const dragHi = isDragCol ? Math.max(drag.startRow, drag.endRow) : null;

          return (
            <div key={iso} className="relative border-l border-text/[0.06]">
              {hourRows.map((r) => {
                const mins = minutesFromRow(r);
                const inDrag = isDragCol && r >= dragLo && r <= dragHi;
                return (
                  <button
                    key={r}
                    type="button"
                    onMouseDown={readOnly ? undefined : () => beginDrag(iso, r)}
                    onMouseEnter={readOnly ? undefined : () => extendDrag(iso, r)}
                    tabIndex={readOnly ? -1 : undefined}
                    aria-hidden={readOnly ? true : undefined}
                    style={{ height: ROW_PX }}
                    className={`block w-full border-b transition-colors duration-100 ${
                      mins % 60 === 0 ? "border-text/[0.07]" : "border-text/[0.03]"
                    } ${inDrag ? "bg-primary/[0.14]" : "hover:bg-bg"}`}
                    aria-label={readOnly ? undefined : `Create availability at ${formatTime12(fromMinutes(mins))}`}
                  />
                );
              })}

              {/* Slot blocks, absolutely positioned over the row targets */}
              {daySlots.map((s) => {
                const startMin = Math.max(GRID_START_MIN, minsOf(s.start));
                const endMin = Math.min(GRID_END_MIN, minsOf(s.end));
                const top = ((startMin - GRID_START_MIN) / ROW_MIN) * ROW_PX;
                const height = Math.max(((endMin - startMin) / ROW_MIN) * ROW_PX, ROW_PX - 4);
                const accent = TYPE_ACCENT[s.status] || TYPE_ACCENT.open;
                const bookedCount = s.bookings?.length || 0;
                const statusLabel =
                  s.status === "booked"
                    ? s.liveClass
                      ? s.liveClass.status === "live"
                        ? "Live now"
                        : "Live class scheduled"
                      : `${bookedCount}/${s.maxBookings} booked`
                    : s.status === "cancelled"
                    ? "Cancelled"
                    : s.status === "rescheduled"
                    ? "Rescheduled"
                    : s.status === "completed"
                    ? "Completed"
                    : "Open";
                const durationMin = endMin - startMin;
                const revealed = revealedId === s.id;
                return (
                  <div key={s.id} className="absolute left-1 right-1" style={{ top: top + 1, height: height - 2 }}>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenSlot(s);
                      }}
                      onMouseEnter={() => setRevealedId(s.id)}
                      onMouseLeave={() => setRevealedId((id) => (id === s.id ? null : id))}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                        setRevealedId((id) => (id === s.id ? null : s.id));
                      }}
                      className={`relative block h-full w-full overflow-hidden rounded-lg px-2 py-1 text-left text-[11px] font-semibold leading-tight transition-all duration-150 hover:z-20 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_-8px_rgba(26,26,26,0.35)] ${accent}`}
                    >
                      <span className="block truncate">{s.sessionType}</span>
                      <span className="block truncate font-normal opacity-80">
                        {formatTime12(s.start)} · {statusLabel}
                      </span>
                    </button>

                    {/* Floating hover/tap detail card — absolutely positioned
                        above neighboring slots (z-30), never pushes grid
                        layout. Content depends on the slot's kind, per Part 4. */}
                    {revealed && (
                      <div
                        className="pointer-events-none absolute left-0 top-full z-30 mt-1 w-48 rounded-xl bg-text px-3 py-2.5 text-left text-[11px] leading-snug text-white shadow-[0_12px_28px_-10px_rgba(26,26,26,0.45)]"
                        role="status"
                      >
                        <p className="font-semibold text-white">
                          {formatTime12(s.start)}–{formatTime12(s.end)}
                        </p>
                        {s.status === "booked" && s.liveClass ? (
                          <>
                            {s.bookings?.[0]?.courseTitle && <p className="mt-1 font-medium text-white/90">{s.bookings[0].courseTitle}</p>}
                            <p className="mt-1 text-white/70">
                              {s.liveClass.title || s.sessionType} · {bookedCount} attending
                            </p>
                          </>
                        ) : s.status === "booked" ? (
                          <p className="mt-1 text-white/70">
                            {s.bookings?.[0]?.studentName || "Student"} · {s.sessionType}
                          </p>
                        ) : s.status === "open" ? (
                          <p className="mt-1 text-white/70">
                            {durationMin} min · {s.maxBookings} bookable slot{s.maxBookings === 1 ? "" : "s"}
                          </p>
                        ) : (
                          <p className="mt-1 text-white/70">{statusLabel}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function minsOf(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
