import { useEffect, useMemo, useState } from "react";
import { useTeacherAvailability } from "../context/TeacherAvailabilityContext";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { addDays, startOfWeek } from "../data/teacherAvailability";
import { dayKey, useNow } from "../data/liveJoin";
import { getLiveSessions } from "../data/liveSessions";
import AvailabilityWeekGrid from "./AvailabilityWeekGrid";
import BookingDetailPopover from "./BookingDetailPopover";
import LiveCalendarMonth from "./LiveCalendarMonth";
import LiveCalendarList from "./LiveCalendarList";
import FadeSwap from "./FadeSwap";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { AlertTriangleIcon, CalendarIcon, ChevronRightIcon } from "../../../components/ui/icons";

const VIEWS = [
  { key: "month", label: "Month" },
  { key: "week", label: "Week" },
  { key: "day", label: "Day" },
  { key: "agenda", label: "Agenda" },
];

function isPhone() {
  try {
    return typeof window !== "undefined" && window.matchMedia("(max-width: 639px)").matches;
  } catch {
    return false;
  }
}

const sameMonthLabel = (d) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });

// LiveClassCalendar — the Live-Classes-only calendar (Month / Week / Day,
// plus an Agenda list that phones default to). It reads the SAME slots the
// Availability calendar reads (useTeacherAvailability().slots, filtered to
// live class sessions) — no store of its own — so an edit made anywhere
// shows up here and in Availability immediately. Clicking a session opens
// the shared BookingDetailPopover (course context, time, attendees, Edit,
// and the same joinState-driven Join button).
export default function LiveClassCalendar({ onEditSession, onJoin, onCancelSession, flash }) {
  const { slots } = useTeacherAvailability();
  const { courses } = useTeacherCourses();
  const now = useNow(15000);

  const [view, setView] = useState(() => (isPhone() ? "agenda" : "month"));
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  const [direction, setDirection] = useState(1);
  const [detailId, setDetailId] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 300);
    return () => window.clearTimeout(t);
  }, [retry]);

  const todayKey = dayKey(now);
  const all = useMemo(() => {
    try {
      return { list: getLiveSessions(slots), error: false };
    } catch {
      return { list: [], error: true };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, retry]);

  // Visible range [from, to] (inclusive local day keys) + title.
  const range = useMemo(() => {
    if (view === "week") {
      const ws = startOfWeek(cursor);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      const a = ws.toLocaleDateString(undefined, { month: "short", day: "numeric" });
      const b = we.toLocaleDateString(undefined, sameMonth ? { day: "numeric", year: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
      return { from: dayKey(ws), to: dayKey(we), title: `${a} – ${b}`, noun: "this week", weekStart: ws };
    }
    if (view === "day") {
      return {
        from: dayKey(cursor),
        to: dayKey(cursor),
        title: cursor.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" }),
        noun: "on this day",
      };
    }
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return { from: dayKey(first), to: dayKey(last), title: sameMonthLabel(cursor), noun: "this month" };
  }, [view, cursor]);

  const inRange = useMemo(() => all.list.filter((s) => s.date >= range.from && s.date <= range.to), [all.list, range]);

  function shift(dir) {
    setDirection(dir);
    setCursor((c) => {
      if (view === "week") return addDays(c, 7 * dir);
      if (view === "day") return addDays(c, dir);
      return new Date(c.getFullYear(), c.getMonth() + dir, 1);
    });
  }
  function goToday() {
    setDirection(1);
    setCursor(new Date(now.getFullYear(), now.getMonth(), now.getDate()));
  }
  function openDay(d) {
    setDirection(1);
    setCursor(new Date(d.getFullYear(), d.getMonth(), d.getDate()));
    setView("day");
  }

  const detailSlot = detailId ? slots.find((s) => s.id === detailId) || null : null;
  const closeDetail = () => setDetailId(null);
  const swapKey = `${view}-${range.from}`;
  const emptyLabel = `No live classes ${range.noun}. Sessions you schedule for any course will show up here.`;

  const navBtn = "flex h-8 w-8 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text";

  let body;
  if (loading) {
    body = (
      <div className="h-80 rounded-3xl bg-surface shadow-soft motion-safe:animate-pulse" aria-busy="true" aria-label="Loading calendar" />
    );
  } else if (all.error) {
    body = (
      <div role="alert" className="flex flex-col items-center gap-3 rounded-3xl bg-danger/10 px-6 py-12 text-center text-sm text-danger">
        <AlertTriangleIcon className="h-5 w-5" />
        Couldn't load the live class calendar.
        <button
          type="button"
          onClick={() => {
            setLoading(true);
            setRetry((n) => n + 1);
          }}
          className="rounded-full bg-danger px-4 py-1.5 text-xs font-semibold text-white"
        >
          Try again
        </button>
      </div>
    );
  } else {
    const emptyNote =
      inRange.length === 0 && (view === "month" || view === "week") ? (
        <p className="mb-3 flex items-center gap-1.5 rounded-xl bg-surface px-4 py-2.5 text-xs font-medium text-muted shadow-soft">
          <CalendarIcon className="h-3.5 w-3.5" />
          Nothing scheduled {range.noun}.
        </p>
      ) : null;
    body = (
      <FadeSwap swapKey={swapKey} direction={direction}>
        {emptyNote}
        {view === "month" && (
          <LiveCalendarMonth cursor={cursor} sessions={inRange} todayKey={todayKey} nowTime={now} onOpenSession={(s) => setDetailId(s.id)} onOpenDay={openDay} />
        )}
        {view === "week" && (
          <AvailabilityWeekGrid
            days={Array.from({ length: 7 }).map((_, i) => addDays(range.weekStart, i))}
            slots={all.list}
            readOnly
            onCreateRange={() => {}}
            onOpenSlot={(s) => setDetailId(s.id)}
            todayIso={todayKey}
          />
        )}
        {(view === "day" || view === "agenda") && (
          <LiveCalendarList
            sessions={inRange}
            courses={courses}
            now={now}
            mode={view}
            emptyLabel={emptyLabel}
            onOpenSession={(s) => setDetailId(s.id)}
            onEdit={onEditSession}
            onJoin={onJoin}
          />
        )}
      </FadeSwap>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-4 rounded-3xl bg-surface p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1 rounded-full bg-text/[0.05] p-1" role="group" aria-label="Calendar view">
            {VIEWS.map((v) => (
              <button
                key={v.key}
                type="button"
                aria-pressed={view === v.key}
                onClick={() => {
                  setDirection(1);
                  setView(v.key);
                }}
                className={`rounded-full px-3.5 py-1.5 text-sm font-semibold transition-all duration-150 ${
                  view === v.key ? "bg-primary text-white" : "text-muted hover:text-text"
                } hover:-translate-y-0.5 hover:shadow-soft`}
              >
                {v.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-1">
            <button type="button" aria-label="Previous" onClick={() => shift(-1)} className={navBtn}>
              <ChevronRightIcon className="h-4 w-4 rotate-180" />
            </button>
            <button type="button" onClick={goToday} className="rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-bg hover:text-text">
              Today
            </button>
            <button type="button" aria-label="Next" onClick={() => shift(1)} className={navBtn}>
              <ChevronRightIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <h2 className="text-base font-bold text-text" aria-live="polite">
          {range.title}
        </h2>
      </div>

      {body}

      {detailSlot && (
        <BookingDetailPopover
          slot={detailSlot}
          onClose={closeDetail}
          onCancel={(s) => {
            closeDetail();
            setCancelling(s);
          }}
          onEditLiveClass={(s) => {
            closeDetail();
            onEditSession(s);
          }}
          onJoinLiveClass={(s) => {
            closeDetail();
            onJoin(s);
          }}
        />
      )}

      <Modal
        open={Boolean(cancelling)}
        onClose={() => setCancelling(null)}
        title="Cancel this session?"
        size="sm"
        footer={
          <>
            <Button
              fullWidth={false}
              className="bg-danger px-6 hover:bg-danger/90"
              onClick={() => {
                onCancelSession(cancelling);
                setCancelling(null);
              }}
            >
              Cancel session
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setCancelling(null)}>
              Keep it
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Only this occurrence is cancelled — enrolled students will be notified and the rest of the schedule is unchanged.</p>
      </Modal>
    </div>
  );
}
