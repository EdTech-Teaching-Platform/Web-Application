// Session Requests — mock data + pure helpers for the Session Requests
// model that replaces educator-initiated ad-hoc "Schedule a Call" as the
// general-purpose scheduling flow (Part 5). A request is its own record,
// separate from a booking/slot: it only BECOMES a real booking once the
// educator Accepts it (via TeacherAvailabilityContext.scheduleCall, the
// exact same function Mentorship Check-In uses — one booking pipeline,
// never a parallel one).
//
// Real student names + course titles reused from the same
// people/courses already seeded in teacherAvailability.js/teacherCourses.js
// (Daniel Osei, Grace Kim, Sofia Rossi, Noor Haddad, Jonas Weber, Carlos
// Ibarra), same discipline Mentorship Hub's data file followed.
import { TODAY } from "./teacherCourses";
import { startOfWeek, addDays, isoDate } from "./teacherAvailability";

export const REQUEST_STATUSES = ["pending", "accepted", "needs_new_time", "declined"];

// StatusBadge tokens are ONLY success|warning|danger|neutral (never a
// rotation color) — map every request status onto one of those.
export const REQUEST_STATUS_META = {
  pending: { label: "Pending", badge: "neutral" },
  accepted: { label: "Accepted", badge: "success" },
  needs_new_time: { label: "Needs New Time", badge: "warning" },
  declined: { label: "Declined", badge: "danger" },
};

export const REQUEST_FILTERS = ["All", "Pending", "Accepted", "Needs New Time", "Declined"];
export const REQUEST_SORTS = [
  { key: "newest", label: "Newest First" },
  { key: "soonest", label: "Soonest Requested Time" },
];

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
export function newRequestId() {
  return id("req");
}

export function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

// Structured responses: the educator picks a reason (and may add a note)
// instead of writing a message. The result is recorded on the request.
export const DECLINE_REASONS = [
  "Outside my teaching hours",
  "Fully booked that week",
  "Better handled in a live class",
  "Not a fit for this session type",
  "Other",
];

export const NEW_TIME_REASONS = [
  "Already booked at that time",
  "Live class scheduled",
  "Outside my teaching hours",
  "Other",
];

export function joinReasonNote(reason, note) {
  return note ? `${reason} — ${note}` : reason;
}

const thisWeekStart = startOfWeek(TODAY);

function isoIn(daysFromToday) {
  return isoDate(addDays(TODAY, daysFromToday));
}

// One request whose exact requested time genuinely collides with an
// already-booked slot in teacherAvailability.js's INITIAL_SLOTS (the
// Wed-this-week 16:00 recurring "1:1 Doubt Clearing" booked by Daniel
// Osei) — the negotiation flow's demo conflict scenario.
const conflictDate = isoDate(addDays(thisWeekStart, 3)); // Wed this week

export const INITIAL_SESSION_REQUESTS = [
  {
    id: id("req"),
    studentName: "Grace Kim",
    courseId: "c2",
    courseTitle: "Modern React Patterns for Production",
    sessionType: "1:1 Doubt Clearing",
    requestedDate: isoIn(2),
    requestedStart: "14:00",
    requestedEnd: "14:30",
    flexible: false,
    note: "Struggling with the useEffect cleanup example from lecture 4 — could use 30 minutes to walk through it.",
    submittedAt: new Date(TODAY.getTime() - 3 * 3600_000).toISOString(),
    status: "pending",
    offeredSlots: [],
    resolutionMessage: "",
    resolvedBookingSlotId: null,
  },
  {
    id: id("req"),
    studentName: "Carlos Ibarra",
    courseId: "c2",
    courseTitle: "Modern React Patterns for Production",
    sessionType: "Consultation",
    requestedDate: conflictDate,
    requestedStart: "16:00",
    requestedEnd: "16:30",
    flexible: false,
    note: "Would love feedback on my testing setup before the module deadline.",
    submittedAt: new Date(TODAY.getTime() - 26 * 3600_000).toISOString(),
    status: "pending",
    offeredSlots: [],
    resolutionMessage: "",
    resolvedBookingSlotId: null,
  },
  {
    id: id("req"),
    studentName: "Noor Haddad",
    courseId: "c3",
    courseTitle: "Portfolio Reviews for Junior Designers",
    sessionType: "Consultation",
    requestedDate: isoIn(-4),
    requestedStart: "10:00",
    requestedEnd: "10:30",
    flexible: false,
    note: "Portfolio walkthrough ahead of my interviews next week.",
    submittedAt: new Date(TODAY.getTime() - 5 * 86400_000).toISOString(),
    status: "accepted",
    offeredSlots: [],
    resolutionMessage: "Accepted — see you then!",
    resolvedBookingSlotId: null, // demo record: pre-resolved, no live slot link needed
  },
  {
    id: id("req"),
    studentName: "Sofia Rossi",
    courseId: "c2",
    courseTitle: "Modern React Patterns for Production",
    sessionType: "1:1 Doubt Clearing",
    requestedDate: isoDate(addDays(thisWeekStart, 2)), // Tue this week, 18:00 — collides with the Live Class block
    requestedStart: "18:00",
    requestedEnd: "18:30",
    flexible: true,
    note: "Any time Tuesday evening works if this slot doesn't.",
    submittedAt: new Date(TODAY.getTime() - 2 * 86400_000).toISOString(),
    status: "needs_new_time",
    offeredSlots: [
      { date: isoDate(addDays(thisWeekStart, 2)), start: "19:30", end: "20:00" },
      { date: isoDate(addDays(thisWeekStart, 3)), start: "18:00", end: "18:30" },
    ],
    reasonTag: "Live class scheduled",
    resolutionMessage: "Live class scheduled — a Live Class runs at 6:00 PM Tuesday. Offered Tuesday 7:30 PM or Wednesday 6:00 PM instead.",
    resolvedBookingSlotId: null,
  },
  {
    id: id("req"),
    studentName: "Jonas Weber",
    courseId: "c1",
    courseTitle: "Advanced UI Principles & Color Theory",
    sessionType: "Consultation",
    requestedDate: isoIn(-8),
    requestedStart: "21:30",
    requestedEnd: "22:00",
    flexible: false,
    note: "Only free late evening this week, sorry!",
    submittedAt: new Date(TODAY.getTime() - 9 * 86400_000).toISOString(),
    status: "declined",
    offeredSlots: [],
    reasonTag: "Outside my teaching hours",
    resolutionMessage: "Outside my teaching hours",
    resolvedBookingSlotId: null,
  },
];
