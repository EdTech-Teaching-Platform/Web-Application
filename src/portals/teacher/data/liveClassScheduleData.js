// Shared mock data + pure helpers for per-course Live Class scheduling
// (Live Classes landing page + Schedule/Manage panels). Same data-file/
// context split every other teacher feature here uses (teacherAvailability.js,
// liveClassData.js, mentorshipData.js): pure recurrence/derivation math
// lives here so it can be reasoned about independent of React state.
//
// -- Architecture note (recurring schedules vs. the shared `slots` array) --
// A "live class schedule" record (below) is the educator-authored RULE —
// one-off or weekly, a time, optional end date, meeting details (provider + link), title and
// notify settings. It is never rendered directly anywhere: the calendar,
// the agenda, the Upcoming Sessions panels and Live Class Host all keep
// reading the exact same `slots` array TeacherAvailabilityContext already
// owns, the same single source of truth Scheduled Call Booking and
// Reschedule/Cancel use. So creating or editing a schedule immediately
// MATERIALIZES its next several concrete occurrences as real slot records
// (sessionType "Live Class", status "booked", one `liveClass` object
// already attached, `blockId` set to the schedule's id so every occurrence
// belonging to one schedule can be found again) — never lazily derived at
// render time. This mirrors how `generateSlots` already turns one
// recurring availability block into N real slot records, so the rest of
// the app (week grid hover cards, agenda rows, Upcoming panels, Live Class
// Host's `slots.find(s => s.id === slotId)`) needs zero special-casing to
// show a schedule-born occurrence versus any other slot.
import { EXTRA_COURSES, C1_STUDENTS } from "./teacherCourses";
import { TODAY } from "./teacherCourses";
import { COURSE } from "../components/contentData";
import { getNow } from "./liveJoin";
import {
  WEEKDAY_LABELS,
  addMinutesToTime,
  fromMinutes,
  isoDate,
  addDays,
  formatDateLabel,
  formatTime12,
  findConflict,
  historyEntry,
  newId,
} from "./teacherAvailability";

// -- Course -> enrolled students lookup ------------------------------------
// Built once from the same course records TeacherCoursesContext seeds from
// (c1's students come from the exported C1_STUDENTS; the rest from
// EXTRA_COURSES — the courses the seed schedules below are built on).
// Every LIVE surface (LiveClasses.jsx, Manage Schedule) instead reads
// course.students straight from useTeacherCourses() so there is exactly
// one place attendance/enrollment counts come from; this stays a
// read-only lookup for seeding demo schedules only.
function courseStudentsById(courseId) {
  if (courseId === "c1") return C1_STUDENTS;
  const course = EXTRA_COURSES.find((c) => c.id === courseId);
  return course?.students || [];
}

export const NOTIFY_MODES = [
  { key: "now", label: "Notify enrolled students now", caption: "Students get the class link and details as soon as this is saved." },
  { key: "closer", label: "Notify closer to the session", caption: "Students are reminded automatically as each session approaches." },
];

export const RECURRING_NOTIFY_MODES = [
  { key: "every_occurrence", label: "Notify before every occurrence", caption: "Each upcoming session gets its own reminder to enrolled students." },
  { key: "once", label: "Notify once about the recurring schedule", caption: "Students hear about the recurring series a single time, up front." },
];

export function suggestScheduleTitle(course) {
  if (!course) return "Live Class";
  return `${course.title} — Live Class`;
}

// -- Recurrence --------------------------------------------------------
// Pure derivation: given a schedule rule and a starting date, returns up
// to `count` upcoming { date, start, end } occurrences — never mutates or
// reads shared state. One-off schedules yield at most one occurrence
// (none once its date has passed); weekly schedules walk forward day by
// day, matching `daysOfWeek`, capped by `endDate` (or a 26-week safety cap
// with no end date, same reasoning as teacherAvailability.js's own
// 12-week recurring-availability cap).
export function generateOccurrences(schedule, fromDate, count = 8) {
  if (!schedule) return [];
  const fromIso = typeof fromDate === "string" ? fromDate : isoDate(fromDate);
  const duration = Number(schedule.duration) || 60;
  const end = addMinutesToTime(schedule.time, duration);

  if (schedule.recurrence === "one-off") {
    if (!schedule.date || schedule.date < fromIso) return [];
    return [{ date: schedule.date, start: schedule.time, end }];
  }

  const occurrences = [];
  const days = new Set(schedule.daysOfWeek?.length ? schedule.daysOfWeek : [new Date(fromIso).getDay()]);
  const hardCapEnd = addDays(new Date(fromIso), 7 * 26);
  const boundEnd = schedule.endDate ? new Date(schedule.endDate) : hardCapEnd;
  for (let d = new Date(fromIso); d <= boundEnd && occurrences.length < count; d = addDays(d, 1)) {
    if (days.has(d.getDay())) occurrences.push({ date: isoDate(d), start: schedule.time, end });
  }
  return occurrences;
}

// Plain-language summary for the course card / manage panel header.
export function describeSchedule(schedule) {
  if (!schedule) return "";
  if (schedule.recurrence === "one-off") {
    return `One-off — ${formatDateLabel(schedule.date, { month: "short", day: "numeric", year: "numeric" })}, ${formatTime12(schedule.time)}`;
  }
  const days = (schedule.daysOfWeek || []).map((d) => `${WEEKDAY_LABELS[d]}s`).join("/");
  return `Weekly, ${days || "—"} ${formatTime12(schedule.time)}`;
}

// -- Materializing an occurrence into a real slot --------------------------
// One occurrence -> one full slot record, shaped exactly like every other
// slot in TeacherAvailabilityContext's `slots` array (same fields
// generateSlots/createAdHocSlot produce) so nothing downstream needs a
// "schedule-born slot" special case. `students` is the enrolled roster at
// materialization time (a real snapshot, same convention bookings already
// use elsewhere in this app).
export function materializeOccurrenceSlot(schedule, occurrence, students) {
  const bookings = (students || []).map((s) => ({
    id: newId("bk"),
    studentName: s.name,
    courseId: schedule.courseId,
    courseTitle: schedule.courseTitle,
    note: "",
    createdBy: "educator",
    sessionTag: "live_class",
  }));
  return {
    id: newId("slot"),
    blockId: schedule.id,
    date: occurrence.date,
    start: occurrence.start,
    end: occurrence.end,
    sessionType: "Live Class",
    maxBookings: Math.max(bookings.length, 1),
    bufferMin: 0,
    recurrence: schedule.recurrence === "weekly" ? { type: "weekly", days: schedule.daysOfWeek, endDate: schedule.endDate || null } : null,
    status: "booked",
    bookings,
    origin: "availability",
    history: [historyEntry("created", { to: { date: occurrence.date, start: occurrence.start, end: occurrence.end }, actor: "educator" })],
    supersededBySlotId: null,
    supersededFromSlotId: null,
    liveClass: {
      id: newId("live"),
      status: "scheduled",
      createdAt: TODAY.toISOString(),
      title: schedule.title,
      format: bookings.length > 1 ? "Group" : "1:1",
      participants: bookings.map((b) => b.studentName),
      meeting: schedule.meeting || null,
      materials: null,
      notifyMode: schedule.recurrence === "weekly" && schedule.recurringNotifyMode === "once" ? "closer" : schedule.notifyMode,
      scheduleId: schedule.id,
      courseId: schedule.courseId,
    },
  };
}

// Skips any occurrence that would collide with something already on the
// calendar (same conflict rule Scheduled Call Booking/Availability use)
// instead of silently double-booking a time — returns the materialized
// slots plus a skipped count so the caller can surface it.
export function materializeSchedule(schedule, students, existingSlots, fromDate = TODAY, count = 8) {
  const occurrences = generateOccurrences(schedule, fromDate, count);
  const created = [];
  let skipped = 0;
  occurrences.forEach((occ) => {
    const candidate = { date: occ.date, start: occ.start, end: occ.end };
    const conflict = findConflict([...existingSlots, ...created], [candidate], schedule.id);
    if (conflict) {
      skipped += 1;
      return;
    }
    created.push(materializeOccurrenceSlot(schedule, occ, students));
  });
  return { created, skipped };
}

export function newScheduleId() {
  return newId("sched");
}

// -- Seed schedules --------------------------------------------------------
// One course with an active weekly recurring schedule (several upcoming
// occurrences, real enrollment-based attendee counts), one with a one-off
// scheduled class, and (intentionally) no schedule at all for a third
// course — so the Live Classes landing page always shows all three states
// out of the box.
const weeklyScheduleId = newScheduleId();
export const SEED_WEEKLY_SCHEDULE = {
  id: weeklyScheduleId,
  courseId: "c2",
  courseTitle: "Modern React Patterns for Production",
  recurrence: "weekly",
  daysOfWeek: [2], // Tuesdays
  time: "18:00",
  duration: 90,
  date: null,
  endDate: null,
  title: "Modern React Patterns — Weekly Live Class",
  meeting: { provider: "zoom", link: "https://zoom.us/j/84021937155", meetingId: "840 2193 7155", passcode: "react2026" },
  notifyMode: "now",
  recurringNotifyMode: "every_occurrence",
  status: "active",
  createdAt: TODAY.toISOString(),
};

const oneOffScheduleId = newScheduleId();
export const SEED_ONEOFF_SCHEDULE = {
  id: oneOffScheduleId,
  courseId: "c6",
  courseTitle: "Design Systems 101",
  recurrence: "one-off",
  daysOfWeek: [],
  time: hhmmFromNow(180), // later today — see "Seeds relative to the shared clock" below
  duration: 60,
  date: isoDate(TODAY),
  endDate: null,
  title: "Design Systems 101 — Live Q&A",
  meeting: { provider: "meet", link: "https://meet.google.com/abc-defg-hij", meetingId: "", passcode: "" },
  notifyMode: "closer",
  recurringNotifyMode: "every_occurrence",
  status: "active",
  createdAt: TODAY.toISOString(),
};

// -- Seeds relative to the shared clock -------------------------------------
// Join/Locked is decided against getNow() (data/liveJoin.js: the mock
// TODAY plus real elapsed time), so the "later today" demo sessions are
// built from that same clock — rounded to 5 minutes — instead of
// hardcoded clock times that could drift out of the demo window:
//   * c1 (Advanced UI Principles): weekly Sun + Wed, starting ~25 min
//     after "now" -> today's session is already inside its 30-minute
//     window (Join Now) and, at 60 min long, stays open for ~85 minutes of
//     real time. Its 14 occurrences run through early November, so the
//     calendar spans September, October and November.
//   * c6 (Design Systems 101): a one-off ~3 hours after "now" -> Locked
//     today ("Opens at ..."), flipping to Join Now once the clock reaches
//     30 minutes before it. (Previously a one-off 9 days out; the weekly
//     seeds already cover the future dates.)
// Every other occurrence (c2 Tuesdays, c1 later days) is a future date and
// therefore always Locked.
function hhmmFromNow(offsetMin) {
  const d = new Date(getNow().getTime() + offsetMin * 60000);
  const mins = Math.round((d.getHours() * 60 + d.getMinutes()) / 5) * 5;
  return fromMinutes(Math.min(mins, 22 * 60));
}

export const SEED_C1_WEEKLY_SCHEDULE = {
  id: newScheduleId(),
  courseId: "c1",
  courseTitle: COURSE.title,
  recurrence: "weekly",
  daysOfWeek: [0, 3], // Sundays + Wednesdays
  time: hhmmFromNow(25),
  duration: 60,
  date: null,
  endDate: null,
  title: "Advanced UI Principles — Live Studio",
  meeting: { provider: "teams", link: "https://teams.microsoft.com/l/meetup-join/19%3ameeting_UiDesign01%40thread.v2/0", meetingId: "", passcode: "" },
  notifyMode: "now",
  recurringNotifyMode: "every_occurrence",
  status: "active",
  createdAt: TODAY.toISOString(),
};

export const INITIAL_LIVE_CLASS_SCHEDULES = [SEED_WEEKLY_SCHEDULE, SEED_ONEOFF_SCHEDULE, SEED_C1_WEEKLY_SCHEDULE];

function buildSeedSlots(schedule, count = 6) {
  const students = courseStudentsById(schedule.courseId);
  const { created } = materializeSchedule(schedule, students, [], TODAY, count);
  return created;
}

export const INITIAL_LIVE_CLASS_SLOTS = [
  ...buildSeedSlots(SEED_WEEKLY_SCHEDULE, 8),
  ...buildSeedSlots(SEED_ONEOFF_SCHEDULE),
  ...buildSeedSlots(SEED_C1_WEEKLY_SCHEDULE, 14),
];
