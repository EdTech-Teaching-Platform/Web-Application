// liveJoin — the ONE shared clock + Join/Locked rule for every live class
// Join button in the educator portal (Live Classes Upcoming panel, Live
// Classes calendar, Availability upcoming/agenda, booking detail drawer,
// Live Class Host/lobby guard). Nothing else in the app should decide "can
// the educator join this session yet?" on its own.
//
// -- Time model -----------------------------------------------------------
// The app runs on a FIXED mock clock (`TODAY` = 2026-09-20 12:00, see
// teacherCourses.js) and all seed data is dated relative to it. A real
// `new Date()` would put every seeded session in the past, so getNow()
// is the mock clock PLUS real elapsed time since this module loaded:
//   getNow() = TODAY + (Date.now() - APP_START)
// That keeps the demo dates meaningful while letting Locked -> Join Now
// actually flip live during a session (useNow re-reads it on an interval).
// Everything that needs a "now" for live-class logic must call getNow();
// the rest of the app that still reads the frozen TODAY for date-only
// bucketing (e.g. "today's date") stays consistent because mock time only
// drifts a few hours during a session.
//
// -- Join rule ------------------------------------------------------------
//   ended  : now >= end (end = start + duration; exactly at the end counts
//            as ended), or the session was completed/cancelled.
//   open   : the session is on the SAME CALENDAR DAY as now AND
//            now >= start - JOIN_OPEN_MINUTES (and not ended), or it is
//            already in progress / marked live.
//   locked : everything else. A future date is ALWAYS locked regardless of
//            time-of-day math (00:10 tomorrow is locked at 23:50 today).
import { useEffect, useState } from "react";
import { TODAY } from "./teacherCourses";

export const JOIN_OPEN_MINUTES = 30;

const MIN_MS = 60000;
const APP_START = Date.now();

export function getNow() {
  return new Date(TODAY.getTime() + (Date.now() - APP_START));
}

// Ticking "now" so Join buttons flip Locked -> Join Now without a refresh.
export function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => getNow());
  useEffect(() => {
    const id = window.setInterval(() => setNow(getNow()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}

function pad2(n) {
  return String(n).padStart(2, "0");
}

// Local calendar-day key, "YYYY-MM-DD" (never UTC — the educator's wall
// clock is what decides "same day").
export function dayKey(d) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function parseLocalDateTime(dateIso, hhmm) {
  const [y, m, d] = dateIso.split("-").map(Number);
  const [h, mi] = hhmm.split(":").map(Number);
  return new Date(y, m - 1, d, h, mi, 0, 0);
}

function fmt12(d) {
  const h = d.getHours();
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${pad2(d.getMinutes())} ${period}`;
}

// { start, end } Dates for a session shaped like a slot ({ date, start,
// end }) or a schedule-ish record ({ date, start, duration }).
export function sessionWindow(session) {
  const start = parseLocalDateTime(session.date, session.start);
  let end;
  if (session.end) {
    end = parseLocalDateTime(session.date, session.end);
    if (end <= start) end = new Date(end.getTime() + 24 * 60 * MIN_MS);
  } else {
    end = new Date(start.getTime() + (Number(session.duration) || 60) * MIN_MS);
  }
  return { start, end };
}

export function joinState(session, now = getNow()) {
  const { start, end } = sessionWindow(session);
  const dayStart = new Date(start.getFullYear(), start.getMonth(), start.getDate());
  const rawOpen = new Date(start.getTime() - JOIN_OPEN_MINUTES * MIN_MS);
  // Clamp so a 00:10 session reports "opens 12:00 AM" on its own day
  // instead of a misleading time on the previous day.
  const opensAt = rawOpen < dayStart ? dayStart : rawOpen;
  const base = { opensAt, startsAt: start, endsAt: end };

  if (session.status === "completed" || session.liveClass?.status === "completed") {
    return { ...base, state: "ended", reason: "This session has ended", minutesToOpen: 0 };
  }
  if (session.status === "cancelled") {
    return { ...base, state: "ended", reason: "This session was cancelled", minutesToOpen: 0 };
  }
  if (session.liveClass?.status === "live") {
    return { ...base, state: "open", reason: "Live now", minutesToOpen: 0 };
  }
  if (now.getTime() >= end.getTime()) {
    return { ...base, state: "ended", reason: "This session has ended", minutesToOpen: 0 };
  }

  const sameDay = dayKey(now) === dayKey(start);
  const inProgress = now.getTime() >= start.getTime();
  if (now.getTime() >= opensAt.getTime() && (sameDay || inProgress)) {
    return { ...base, state: "open", reason: "Join opens 30 minutes before the session", minutesToOpen: 0 };
  }

  return {
    ...base,
    state: "locked",
    reason: sameDay ? `Opens at ${fmt12(opensAt)} (30 min before start)` : "Opens 30 minutes before the session",
    minutesToOpen: Math.max(0, Math.ceil((opensAt.getTime() - now.getTime()) / MIN_MS)),
  };
}
