import { useEffect, useMemo, useState } from "react";
import EmptyState from "../../../components/ui/EmptyState";
import Select from "../../../components/ui/Select";
import { AlertTriangleIcon, CalendarIcon, ChevronRightIcon } from "../../../components/ui/icons";
import {
  defaultMonthKey,
  getUpcomingLiveSessions,
  groupByMonth,
  monthKeyFromDate,
  monthLabel,
  shiftMonthKey,
} from "../data/liveSessions";
import FadeSwap from "./FadeSwap";
import LiveSessionCard from "./LiveSessionCard";

const MONTHS_AHEAD = 12;

function Skeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading upcoming sessions">
      {[0, 1, 2].map((i) => (
        <div key={i} className="h-28 rounded-2xl bg-bg motion-safe:animate-pulse" />
      ))}
    </div>
  );
}

// UpcomingLiveSessionsPanel — month-paginated list of upcoming live class
// sessions across ALL courses, soonest first. Only sessions that haven't
// ended appear (in-progress/open ones stay); cancelled ones don't. Opens
// on the month of the soonest upcoming session. Navigation is limited to
// the current month .. +12 months: past months can never contain
// "upcoming" sessions, so Previous stops at the current month.
export default function UpcomingLiveSessionsPanel({ slots, courses, now, onEdit, onJoin }) {
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [picked, setPicked] = useState(null);
  const [direction, setDirection] = useState(1);

  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 350);
    return () => window.clearTimeout(t);
  }, [retry]);

  const data = useMemo(() => {
    try {
      const upcoming = getUpcomingLiveSessions(slots, now);
      return { upcoming, byMonth: groupByMonth(upcoming), error: false };
    } catch {
      return { upcoming: [], byMonth: {}, error: true };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slots, now, retry]);

  const nowMonth = monthKeyFromDate(now);
  const maxMonth = shiftMonthKey(nowMonth, MONTHS_AHEAD);
  const clamp = (k) => (k < nowMonth ? nowMonth : k > maxMonth ? maxMonth : k);
  const activeKey = clamp(picked ?? defaultMonthKey(data.upcoming, now));
  const sessions = data.byMonth[activeKey] || [];

  const monthOptions = useMemo(() => {
    const out = [];
    for (let i = 0; i <= MONTHS_AHEAD; i += 1) {
      const k = shiftMonthKey(nowMonth, i);
      out.push({ key: k, label: monthLabel(k), count: (data.byMonth[k] || []).length });
    }
    return out;
  }, [nowMonth, data.byMonth]);

  function go(key, dir) {
    setDirection(dir);
    setPicked(clamp(key));
  }

  const canPrev = activeKey > nowMonth;
  const canNext = activeKey < maxMonth;
  const navBtn = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted transition-colors hover:bg-bg hover:text-text disabled:cursor-not-allowed disabled:opacity-35 disabled:hover:bg-transparent";

  return (
    <div id="upcoming-live-panel" className="h-fit rounded-3xl bg-surface p-5 shadow-soft">
      <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-text">
        <CalendarIcon className="h-4 w-4 text-muted" />
        Upcoming Live Sessions
      </h2>

      <div className="mb-3 flex items-center justify-between gap-1">
        <button type="button" aria-label="Previous month" disabled={!canPrev} onClick={() => go(shiftMonthKey(activeKey, -1), -1)} className={navBtn}>
          <ChevronRightIcon className="h-4 w-4 rotate-180" />
        </button>
        <h3 className="min-w-0 flex-1 truncate text-center text-base font-bold text-text" aria-live="polite">
          {monthLabel(activeKey)}
        </h3>
        <button type="button" aria-label="Next month" disabled={!canNext} onClick={() => go(shiftMonthKey(activeKey, 1), 1)} className={navBtn}>
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </div>
      <Select
        wrapperClassName="mb-4 block w-full"
        aria-label="Jump to month"
        value={activeKey}
        onChange={(e) => go(e.target.value, e.target.value >= activeKey ? 1 : -1)}
        className="w-full rounded-full border border-text/12 bg-surface py-2 pl-4 pr-9 text-xs font-semibold text-text"
      >
        {monthOptions.map((o) => (
          <option key={o.key} value={o.key}>
            {o.label}
            {o.count ? ` · ${o.count} session${o.count === 1 ? "" : "s"}` : ""}
          </option>
        ))}
      </Select>

      {loading ? (
        <Skeleton />
      ) : data.error ? (
        <div role="alert" className="flex flex-col items-center gap-2 rounded-2xl bg-danger/10 px-4 py-6 text-center text-sm text-danger">
          <AlertTriangleIcon className="h-5 w-5" />
          Couldn't load upcoming sessions.
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
      ) : (
        <FadeSwap swapKey={activeKey} direction={direction}>
          {sessions.length === 0 ? (
            <EmptyState
              icon={CalendarIcon}
              heading={`No live classes scheduled in ${monthLabel(activeKey)}`}
              message="Sessions you schedule for any course will show up here."
              className="py-8! px-4! shadow-none! bg-bg!"
            />
          ) : (
            <div className="flex max-h-[70vh] flex-col gap-3 overflow-y-auto pr-0.5">
              {sessions.map((slot) => (
                <LiveSessionCard key={slot.id} slot={slot} now={now} courses={courses} onEdit={onEdit} onJoin={onJoin} />
              ))}
            </div>
          )}
        </FadeSwap>
      )}
    </div>
  );
}
