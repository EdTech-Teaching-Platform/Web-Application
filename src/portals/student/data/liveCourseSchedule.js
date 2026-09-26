import { COURSES, getCourseById } from "../../../data/catalogMock";
import { LIVE_CLASS_SESSIONS, SESSION, getStoredBooking } from "./sessionMock";

const TIME_SLOTS = [
  { hour: 18, minute: 0 },
  { hour: 16, minute: 0 },
  { hour: 20, minute: 0 },
  { hour: 11, minute: 0 },
  { hour: 17, minute: 0 },
];

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

function sessionForDate(course, date, now) {
  const liveCourses = COURSES.filter((item) => item.status === "active" && item.courseType === "Live");
  const index = liveCourses.findIndex((item) => item.id === course.id);
  const slot = TIME_SLOTS[index % TIME_SLOTS.length];
  const startAt = new Date(date);
  startAt.setHours(slot.hour, slot.minute, 0, 0);
  const endAt = new Date(startAt.getTime() + 60 * 60 * 1000);
  const status = now < startAt ? "upcoming" : now < endAt ? "live" : "ended";
  const classTitle = course.id === "c1"
    ? "Functions in practice"
    : `${course.title} · Live class`;

  return {
    id: `scheduled-${course.id}-${dateKey(startAt)}`,
    courseId: course.id,
    courseTitle: course.title,
    educator: course.subtitle,
    classTitle,
    date: startAt.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
    startAt,
    endAt,
    time: `${startAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })} – ${endAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`,
    duration: "60 minutes",
    status,
  };
}

export function getLiveCourseSchedule(courseId, now = new Date()) {
  const course = getCourseById(courseId);
  if (!course || course.courseType !== "Live" || course.status !== "active") return null;

  const liveCourses = COURSES.filter((item) => item.status === "active" && item.courseType === "Live");
  const index = liveCourses.findIndex((item) => item.id === course.id);
  const date = new Date(now);
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + (index % 5));

  let session = sessionForDate(course, date, now);
  // Once today's session has ended, show the next weekly class. While the
  // session is live, keep today's start time so the Join button stays active.
  if (session.status === "ended") {
    date.setDate(date.getDate() + 7);
    session = sessionForDate(course, date, now);
  }
  return session;
}

export function getLiveClassSessionById(sessionId, now = new Date()) {
  const match = /^scheduled-(c\d+)-(\d{8})$/.exec(sessionId || "");
  if (match) {
    const course = getCourseById(match[1]);
    if (!course || course.courseType !== "Live") return null;
    const dateKeyValue = match[2];
    const date = new Date(Number(dateKeyValue.slice(0, 4)), Number(dateKeyValue.slice(4, 6)) - 1, Number(dateKeyValue.slice(6, 8)));
    return sessionForDate(course, date, now);
  }

  // Handle static or booked session IDs (such as 'l1', 'l3', or 'booked')
  let session = null;
  if (sessionId === "booked") {
    session = getStoredBooking() || SESSION;
  } else {
    session = LIVE_CLASS_SESSIONS.find((item) => item.id === sessionId);
  }

  if (session) {
    if (session.courseId) {
      const courseSchedule = getLiveCourseSchedule(session.courseId, now);
      if (courseSchedule) {
        return {
          ...session,
          date: courseSchedule.date,
          time: courseSchedule.time,
          startAt: courseSchedule.startAt,
          endAt: courseSchedule.endAt,
          status: courseSchedule.status,
          duration: courseSchedule.duration || session.duration || "60 minutes",
        };
      }
    }

    let startAt = session.startAt ? new Date(session.startAt) : null;
    let endAt = session.endAt ? new Date(session.endAt) : null;
    if (!startAt && session.date && session.time) {
      const startTimePart = session.time.split(/[\u2013\u2014-]/)[0]?.trim();
      const parsedStart = new Date(`${session.date} ${startTimePart}`);
      if (!isNaN(parsedStart.getTime())) {
        startAt = parsedStart;
        const endTimePart = session.time.split(/[\u2013\u2014-]/)[1]?.trim();
        const parsedEnd = endTimePart ? new Date(`${session.date} ${endTimePart}`) : new Date(startAt.getTime() + 60 * 60 * 1000);
        endAt = isNaN(parsedEnd.getTime()) ? new Date(startAt.getTime() + 60 * 60 * 1000) : parsedEnd;
      }
    }

    let status = session.status;
    if (!status && startAt && endAt) {
      status = now < startAt ? "upcoming" : now < endAt ? "live" : "ended";
    } else if (!status) {
      status = "upcoming";
    }

    return {
      ...session,
      startAt,
      endAt,
      status,
    };
  }

  return null;
}

export function formatClassStart(startAt) {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);
  const sameDate = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const label = sameDate(startAt, today)
    ? "Today"
    : sameDate(startAt, tomorrow)
      ? "Tomorrow"
      : startAt.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
  return `${label} · ${startAt.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}`;
}
