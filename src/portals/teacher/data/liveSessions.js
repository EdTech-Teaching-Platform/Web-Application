// Pure helpers for listing / sorting / grouping live class sessions. Every
// live-class list in the app (Upcoming panel, Live Classes calendar month
// cells, day view, agenda) goes through these so they all agree on what a
// "live class session" is and on soonest-first ordering across courses.
// A session is just a slot from TeacherAvailabilityContext's `slots`.
import { joinState, sessionWindow, getNow } from "./liveJoin";
import { addMinutesToTime, toMinutes } from "./teacherAvailability";

// Only slots carrying a `liveClass` object are real, joinable live
// sessions (a bare "Live Class" slot with no liveClass can't be hosted).
export function isLiveClassSlot(slot) {
  return slot?.sessionType === "Live Class" && Boolean(slot.liveClass);
}

export function compareByStart(a, b) {
  const d = (a.date + a.start).localeCompare(b.date + b.start);
  return d !== 0 ? d : (a.bookings?.[0]?.courseTitle || "").localeCompare(b.bookings?.[0]?.courseTitle || "");
}

export function sortSessions(sessions) {
  return [...sessions].sort(compareByStart);
}

// All non-cancelled live sessions (past and future), soonest first — the
// calendar's source list.
export function getLiveSessions(slots) {
  return sortSessions((slots || []).filter((s) => isLiveClassSlot(s) && s.status !== "cancelled" && s.status !== "rescheduled"));
}

// Upcoming = not cancelled, not completed, and not yet ended (in-progress
// and join-open sessions stay in), soonest-first across ALL courses.
export function getUpcomingLiveSessions(slots, now = getNow()) {
  return getLiveSessions(slots).filter((s) => s.status === "booked" && joinState(s, now).state !== "ended");
}

export function courseIdOf(slot) {
  return slot.liveClass?.courseId || slot.bookings?.[0]?.courseId || null;
}
export function courseTitleOf(slot) {
  return slot.bookings?.[0]?.courseTitle || "Live class";
}

// Enrolled/attending, from real data: `attending` is the occurrence's
// roster (the same bookings count the Availability hover card shows) and
// `enrolled` is the course's current enrollment (TeacherCoursesContext).
export function attendeeInfo(slot, courses) {
  const names = (slot.bookings || []).map((b) => b.studentName);
  const course = (courses || []).find((c) => c.id === courseIdOf(slot));
  return { names, attending: names.length, enrolled: course?.students ? course.students.length : names.length };
}

export function durationMinutes(slot) {
  const { start, end } = sessionWindow(slot);
  return Math.round((end - start) / 60000);
}

// "HH:MM" end for a start + duration; null if it would run past midnight
// (slots are single-day records).
export function computeEndTime(startHHMM, durationMin) {
  const end = addMinutesToTime(startHHMM, durationMin);
  return toMinutes(end) > 23 * 60 + 59 || toMinutes(end) <= toMinutes(startHHMM) ? null : end;
}

// -- Month grouping --------------------------------------------------------
export function monthKeyOf(dateIso) {
  return dateIso.slice(0, 7);
}
export function monthKeyFromDate(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
export function monthLabel(key) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" });
}
export function shiftMonthKey(key, delta) {
  const [y, m] = key.split("-").map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return monthKeyFromDate(d);
}

// { [monthKey]: sessions[] }, each month's list sorted soonest-first.
export function groupByMonth(sessions) {
  const map = {};
  sortSessions(sessions).forEach((s) => {
    const k = monthKeyOf(s.date);
    (map[k] = map[k] || []).push(s);
  });
  return map;
}

// Month to open on: the month of the soonest upcoming session, else the
// current month.
export function defaultMonthKey(upcoming, now = getNow()) {
  return upcoming.length ? monthKeyOf(upcoming[0].date) : monthKeyFromDate(now);
}
