// Shared mock data + pure scheduling logic for the Educator Availability
// calendar. TeacherAvailabilityContext is the thin stateful wrapper around
// these functions — kept here, data-file style, so the generation/overlap
// math can be unit-reasoned about independent of React state, same split
// contentData.js already uses for the Course Builder's pure helpers.
//
// Extended for Scheduled Call Booking (educator-initiated) and
// Reschedule/Cancel Booking: every slot now also carries `origin`
// ("availability" — came from a published open slot — or "adhoc" — the
// educator picked a time outside published hours), a `history` timeline
// (create/reschedule/cancel entries, kept on both sides of a reschedule so
// reopening either the old or the new slot later still shows the full
// lineage), and `supersededBySlotId` / `supersededFromSlotId` links so a
// rescheduled pair can always find each other.
import { TODAY } from "./teacherCourses";

// "Live Class" intentionally excluded — course-level live classes are
// created only via ScheduleLiveClassModal (tagged sessionTag: "live_class"),
// never picked as an ad-hoc session type here (Scheduled Call / Mentorship
// Check-In / Session Requests).
export const DEFAULT_SESSION_TYPES = ["1:1 Doubt Clearing", "Consultation", "Mentorship Check-In"];

export const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// Grid bounds — 7am to 9pm in 30-minute rows, matching a realistic tutoring
// day without forcing a full 24h scroll.
export const GRID_START_MIN = 7 * 60;
export const GRID_END_MIN = 21 * 60;
export const ROW_MIN = 30;

// Shared across Scheduled Call Booking + Availability's own create panel.
export const DURATION_OPTIONS = [15, 30, 45, 60];

// Quick-select reason chips — Reschedule and Cancel intentionally use
// overlapping but distinct sets, per the platform's actual cancellation
// policy language (a "student requested" cancellation reads differently
// than a technical-issue one, even though both quick-select the same way).
export const RESCHEDULE_REASONS = ["Educator unavailable", "Student requested", "Technical issue", "Other"];
export const CANCEL_REASONS = ["Educator unavailable", "Student requested", "Technical issue", "Schedule conflict", "Other"];

// Short-notice buffer: reschedule/cancel actions inside this window still
// go through (never hard-blocked) but surface a soft warning that the
// change may be disruptive.
export const SHORT_NOTICE_BUFFER_MIN = 120;

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}
// Public alias — components that build ad-hoc records (a new booking, a
// rescheduled slot's fresh id) need a fresh id too, without reaching into
// this module's private counter directly.
export function newId(prefix) {
  return id(prefix);
}

// One entry in a slot's booking history timeline. `to`/`from` are
// { date, start, end } shapes so the UI can render "Originally booked for
// … → Rescheduled to …" without re-deriving anything.
export function historyEntry(type, extra = {}) {
  return { id: id("hist"), type, at: TODAY.toISOString(), ...extra };
}

export function toMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}
export function fromMinutes(mins) {
  const h = Math.floor(mins / 60)
    .toString()
    .padStart(2, "0");
  const m = (mins % 60).toString().padStart(2, "0");
  return `${h}:${m}`;
}
export function formatTime12(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${m.toString().padStart(2, "0")} ${period}`;
}
export function addMinutesToTime(hhmm, minutes) {
  return fromMinutes(toMinutes(hhmm) + Number(minutes || 0));
}

export function isoDate(d) {
  return d.toISOString().slice(0, 10);
}
export function startOfWeek(date) {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}
export function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
export function formatDateLabel(dateIso, opts = { weekday: "short", month: "short", day: "numeric" }) {
  return new Date(dateIso).toLocaleDateString(undefined, opts);
}

// Minutes from "now" (TODAY, the app's fixed demo clock) until a slot's
// start — negative once it's started. Shared by the Upcoming panel, the
// booking detail view's "starting soon" state, and the short-notice
// warning on Reschedule/Cancel.
export function minutesUntilSlot(slot, now = TODAY) {
  const [h, m] = slot.start.split(":").map(Number);
  const dt = new Date(slot.date);
  dt.setHours(h, m, 0, 0);
  return Math.round((dt - now) / 60000);
}

// -- Slot generation -----------------------------------------------------
// One "block" (the create panel's inputs) expands into N individually
// bookable slot records — every calendar cell renders one of these, not a
// live re-split of the block, so editing one slot never silently reshapes
// its neighbors.
export function previewSlotCount({ startTime, endTime, slotLengthMin, bufferMin }) {
  const total = toMinutes(endTime) - toMinutes(startTime);
  if (total <= 0 || !slotLengthMin) return 0;
  const period = Number(slotLengthMin) + Number(bufferMin || 0);
  return Math.max(0, Math.floor((total + Number(bufferMin || 0)) / period));
}

function datesForBlock({ date, recurrence }) {
  if (!recurrence || recurrence.type === "none") return [date];
  const dates = [];
  const start = new Date(date);
  const end = recurrence.endDate ? new Date(recurrence.endDate) : addDays(start, 7 * 12); // 12-week cap with no end date
  const days = new Set(recurrence.days?.length ? recurrence.days : [start.getDay()]);
  for (let d = new Date(start); d <= end; d = addDays(d, 1)) {
    if (days.has(d.getDay())) dates.push(isoDate(d));
  }
  return dates;
}

export function generateSlots(params) {
  const { startTime, endTime, slotLengthMin, bufferMin, sessionType, maxBookings, recurrence } = params;
  const dates = datesForBlock(params);
  const blockId = id("block");
  const slots = [];
  dates.forEach((date) => {
    let cursor = toMinutes(startTime);
    const end = toMinutes(endTime);
    while (cursor + Number(slotLengthMin) <= end) {
      slots.push({
        id: id("slot"),
        blockId,
        date,
        start: fromMinutes(cursor),
        end: fromMinutes(cursor + Number(slotLengthMin)),
        sessionType,
        maxBookings: Number(maxBookings) || 1,
        bufferMin: Number(bufferMin) || 0,
        recurrence: recurrence?.type === "weekly" ? recurrence : null,
        status: "open",
        bookings: [],
        origin: "availability",
        history: [],
        supersededBySlotId: null,
        supersededFromSlotId: null,
      });
      cursor += Number(slotLengthMin) + Number(bufferMin || 0);
    }
  });
  return { blockId, slots };
}

export function overlaps(aStart, aEnd, bStart, bEnd) {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

// Returns the first existing slot (excluding slots sharing excludeBlockId)
// that overlaps any candidate slot on the same date — used both for the
// manual create/edit panel and the quick-setup/copy-week bulk tools, plus
// Scheduled Call Booking and Reschedule's live conflict check. A slot that
// has already been cancelled or superseded by a reschedule no longer
// occupies its time, so it's never a conflict source.
export function findConflict(existingSlots, candidateSlots, excludeBlockId = null) {
  for (const cand of candidateSlots) {
    for (const ex of existingSlots) {
      if (ex.blockId === excludeBlockId) continue;
      if (ex.date !== cand.date) continue;
      if (ex.status === "cancelled" || ex.status === "rescheduled" || ex.status === "completed") continue;
      if (overlaps(ex.start, ex.end, cand.start, cand.end)) return { existing: ex, candidate: cand };
    }
  }
  return null;
}

// Given a target { date, start, end }, either an exact already-open slot
// to fill in place (so booking/rescheduling onto a suggested time reuses
// the real availability slot instead of double-booking it) or a conflict
// against anything else active at that time. Neither found means the time
// is free but outside published availability — an ad-hoc booking.
export function resolveBookingTarget(slots, { date, start, end }, excludeSlotId = null) {
  const exactOpenSlot = slots.find(
    (s) => s.id !== excludeSlotId && s.status === "open" && s.date === date && s.start === start && s.end === end
  );
  if (exactOpenSlot) return { exactOpenSlot: exactOpenSlot, conflict: null };
  const conflict = findConflict(
    slots.filter((s) => s.id !== excludeSlotId),
    [{ date, start, end }]
  );
  return { exactOpenSlot: null, conflict };
}

// Builds a brand-new bookable slot for a time that doesn't line up with any
// published availability — used by both Scheduled Call Booking (ad-hoc
// time picked outside hours) and Reschedule (moved somewhere with no
// matching open slot to reuse).
export function createAdHocSlot({ date, start, end, sessionType, bookingEntry, history }) {
  return {
    id: id("slot"),
    blockId: id("block"),
    date,
    start,
    end,
    sessionType,
    maxBookings: 1,
    bufferMin: 0,
    recurrence: null,
    status: "booked",
    bookings: [bookingEntry],
    origin: "adhoc",
    history: history || [historyEntry("created", { to: { date, start, end }, actor: "educator" })],
    supersededBySlotId: null,
    supersededFromSlotId: null,
  };
}

// -- Mock seed data --------------------------------------------------
// Built around "today" (a Sunday) so this week + next week both render
// fully populated: a recurring Mon/Wed/Fri evening block (mix of open and
// booked), a couple one-off Live Class / Consultation blocks, a cancelled
// slot, an already-rescheduled booking (old + new halves, full history on
// both) and a cancelled booking that still shows up in the agenda for
// reference.
const thisWeekStart = startOfWeek(TODAY);
const mon = isoDate(addDays(thisWeekStart, 1));
const tue = isoDate(addDays(thisWeekStart, 2));
const wed = isoDate(addDays(thisWeekStart, 3));
const thu = isoDate(addDays(thisWeekStart, 4));
const fri = isoDate(addDays(thisWeekStart, 5));
const sat = isoDate(addDays(thisWeekStart, 6));
const nextMon = isoDate(addDays(thisWeekStart, 8));
const nextTue = isoDate(addDays(thisWeekStart, 9));
const nextWed = isoDate(addDays(thisWeekStart, 10));
const nextFri = isoDate(addDays(thisWeekStart, 12));

const recurringWeekly = { type: "weekly", days: [1, 3, 5], endDate: null };

function block(dates, startTime, endTime, sessionType, opts = {}) {
  const blockId = id("block");
  const slots = [];
  dates.forEach((date) => {
    let cursor = toMinutes(startTime);
    const end = toMinutes(endTime);
    const slotLengthMin = opts.slotLengthMin ?? 30;
    const bufferMin = opts.bufferMin ?? 10;
    while (cursor + slotLengthMin <= end) {
      slots.push({
        id: id("slot"),
        blockId,
        date,
        start: fromMinutes(cursor),
        end: fromMinutes(cursor + slotLengthMin),
        sessionType,
        maxBookings: opts.maxBookings ?? 1,
        bufferMin,
        recurrence: opts.recurrence ?? null,
        status: "open",
        bookings: [],
        origin: "availability",
        history: [],
        supersededBySlotId: null,
        supersededFromSlotId: null,
      });
      cursor += slotLengthMin + bufferMin;
    }
  });
  return slots;
}

function bookingFor(studentName, courseTitle, note = "", createdBy = "student") {
  return { id: id("bk"), studentName, courseTitle, note, createdBy };
}

const recurringSlots = block([mon, wed, fri, nextMon, nextWed, nextFri], "16:00", "17:00", "1:1 Doubt Clearing", {
  slotLengthMin: 30,
  bufferMin: 10,
  recurrence: recurringWeekly,
});
// Seed a few bookings + one cancellation onto the recurring slots
if (recurringSlots[0]) {
  recurringSlots[0].status = "booked";
  recurringSlots[0].bookings = [
    { ...bookingFor("Priya Sharma", "Advanced UI Principles & Color Theory"), sessionTag: "mentorship", mentorshipId: "ment-priya" },
  ];
  recurringSlots[0].history = [historyEntry("created", { to: { date: recurringSlots[0].date, start: recurringSlots[0].start, end: recurringSlots[0].end }, actor: "student" })];
}
if (recurringSlots[2]) {
  recurringSlots[2].status = "booked";
  recurringSlots[2].bookings = [bookingFor("Daniel Osei", "Advanced UI Principles & Color Theory", "Wants to review token naming")];
  recurringSlots[2].history = [historyEntry("created", { to: { date: recurringSlots[2].date, start: recurringSlots[2].start, end: recurringSlots[2].end }, actor: "student" })];
}
if (recurringSlots[5]) {
  recurringSlots[5].status = "cancelled";
  recurringSlots[5].history = [historyEntry("cancelled", { reasonTag: "Educator unavailable", reason: "Travelling that week.", actor: "educator", from: { date: recurringSlots[5].date, start: recurringSlots[5].start, end: recurringSlots[5].end } })];
}

const liveClassSlots = block([tue], "18:00", "19:30", "Live Class", {
  slotLengthMin: 90,
  bufferMin: 0,
  maxBookings: 25,
  recurrence: null,
});
liveClassSlots[0].status = "booked";
liveClassSlots[0].bookings = [
  bookingFor("Sofia Rossi", "Modern React Patterns for Production", "Group session"),
  bookingFor("Grace Kim", "Modern React Patterns for Production", "Group session"),
];
liveClassSlots[0].history = [historyEntry("created", { to: { date: liveClassSlots[0].date, start: liveClassSlots[0].start, end: liveClassSlots[0].end }, actor: "student" })];

const consultationSlots = block([sat], "10:00", "11:00", "Consultation", {
  slotLengthMin: 30,
  bufferMin: 0,
  maxBookings: 1,
  recurrence: null,
});
consultationSlots[1].status = "booked";
consultationSlots[1].bookings = [bookingFor("Noor Haddad", "Portfolio Reviews for Junior Designers", "Portfolio walkthrough")];
consultationSlots[1].history = [historyEntry("created", { to: { date: consultationSlots[1].date, start: consultationSlots[1].start, end: consultationSlots[1].end }, actor: "student" })];

// Educator-initiated booking already sitting in an open slot the educator
// picked from their own availability — demonstrates Scheduled Call Booking
// having filled a published slot rather than creating an ad-hoc one.
const scheduledCallSlot = block([thu], "12:00", "12:30", "1:1 Doubt Clearing", { slotLengthMin: 30, bufferMin: 0, maxBookings: 1 })[0];
scheduledCallSlot.status = "booked";
scheduledCallSlot.bookings = [bookingFor("Fatima Noor", "Advanced UI Principles & Color Theory", "Let's review your last assignment before Friday's deadline.", "educator")];
scheduledCallSlot.history = [historyEntry("created", { to: { date: scheduledCallSlot.date, start: scheduledCallSlot.start, end: scheduledCallSlot.end }, actor: "educator" })];

// -- Already-rescheduled booking (old + new halves) ----------------------
// Originally Wednesday this week at 11:00, moved to next Tuesday at 3pm —
// both records kept, linked, and carrying the same shared history so
// reopening either one later still shows "Originally booked for … →
// Rescheduled to …" instead of looking like it silently changed.
const reschedBlockId = id("block");
const reschedBookingEntry = {
  ...bookingFor("Mei Lin", "Advanced UI Principles & Color Theory", "Reviewing the final project rubric together.", "educator"),
  sessionTag: "mentorship",
  mentorshipId: "ment-mei-lin",
};
const reschedOriginal = { date: wed, start: "11:00", end: "11:30" };
const reschedMoved = { date: nextTue, start: "15:00", end: "15:30" };
const reschedHistory = [
  historyEntry("created", { to: reschedOriginal, actor: "educator" }),
  historyEntry("rescheduled", { from: reschedOriginal, to: reschedMoved, reasonTag: "Educator unavailable", reason: "A scheduling conflict came up on my end.", actor: "educator" }),
];
const reschedOldId = id("slot");
const reschedNewId = id("slot");
const reschedOldSlot = {
  id: reschedOldId,
  blockId: reschedBlockId,
  ...reschedOriginal,
  sessionType: "1:1 Doubt Clearing",
  maxBookings: 1,
  bufferMin: 10,
  recurrence: null,
  status: "rescheduled",
  bookings: [reschedBookingEntry],
  origin: "availability",
  history: reschedHistory,
  supersededBySlotId: reschedNewId,
  supersededFromSlotId: null,
};
const reschedNewSlot = {
  id: reschedNewId,
  blockId: reschedBlockId,
  ...reschedMoved,
  sessionType: "1:1 Doubt Clearing",
  maxBookings: 1,
  bufferMin: 10,
  recurrence: null,
  status: "booked",
  bookings: [reschedBookingEntry],
  origin: "adhoc",
  history: reschedHistory,
  supersededBySlotId: null,
  supersededFromSlotId: reschedOldId,
};

// -- Cancelled booking (still visible in the agenda for reference) -------
// Came from a published open slot, so cancelling it also spawns a fresh
// open sibling at the same time — the slot itself is still bookable, only
// this particular booking was called off.
const cancelBlockId = id("block");
const cancelledTime = { date: fri, start: "12:00", end: "12:30" };
const cancelledBookingEntry = bookingFor("Carlos Ibarra", "Modern React Patterns for Production");
const cancelledSlot = {
  id: id("slot"),
  blockId: cancelBlockId,
  ...cancelledTime,
  sessionType: "Consultation",
  maxBookings: 1,
  bufferMin: 0,
  recurrence: null,
  status: "cancelled",
  bookings: [cancelledBookingEntry],
  origin: "availability",
  history: [
    historyEntry("created", { to: cancelledTime, actor: "student" }),
    historyEntry("cancelled", { reasonTag: "Student requested", reason: "Student had a schedule change come up.", actor: "educator", from: cancelledTime }),
  ],
  supersededBySlotId: null,
  supersededFromSlotId: null,
};
const cancelledSiblingOpenSlot = {
  id: id("slot"),
  blockId: cancelBlockId,
  ...cancelledTime,
  sessionType: "Consultation",
  maxBookings: 1,
  bufferMin: 0,
  recurrence: null,
  status: "open",
  bookings: [],
  origin: "availability",
  history: [],
  supersededBySlotId: null,
  supersededFromSlotId: null,
};


// -- Mentorship check-ins (seeded for the Mentorship Hub) -----------------
// Tagged sessionTag:"mentorship" + a stable mentorshipId (matching the
// mentorship records in mentorshipData.js) so these are genuine slots in
// this same shared list -- they show up consistently wherever bookings are
// listed (this calendar, the agenda view, Student Management's Bookings &
// Sessions tab), never a separate mocked-up session log.
const jonasMentorshipTime = { date: isoDate(addDays(thisWeekStart, -18)), start: "17:00", end: "17:30" };
const jonasMentorshipSlot = {
  id: id("slot"),
  blockId: id("block"),
  ...jonasMentorshipTime,
  sessionType: "1:1 Doubt Clearing",
  maxBookings: 1,
  bufferMin: 0,
  recurrence: null,
  status: "booked",
  bookings: [
    {
      ...bookingFor("Jonas Weber", "Advanced UI Principles & Color Theory", "Applied palette critique — bring your latest three palettes.", "educator"),
      sessionTag: "mentorship",
      mentorshipId: "ment-jonas",
    },
  ],
  origin: "adhoc",
  history: [historyEntry("created", { to: jonasMentorshipTime, actor: "educator" })],
  supersededBySlotId: null,
  supersededFromSlotId: null,
};

const sofiaMentorshipTime1 = { date: isoDate(addDays(thisWeekStart, -40)), start: "11:00", end: "11:45" };
const sofiaMentorshipSlot1 = {
  id: id("slot"),
  blockId: id("block"),
  ...sofiaMentorshipTime1,
  sessionType: "Consultation",
  maxBookings: 1,
  bufferMin: 0,
  recurrence: null,
  status: "booked",
  bookings: [
    {
      ...bookingFor("Sofia Rossi", "Modern React Patterns for Production", "Mock portfolio review — senior designer framing.", "educator"),
      sessionTag: "mentorship",
      mentorshipId: "ment-sofia",
    },
  ],
  origin: "adhoc",
  history: [historyEntry("created", { to: sofiaMentorshipTime1, actor: "educator" })],
  supersededBySlotId: null,
  supersededFromSlotId: null,
};

const sofiaMentorshipTime2 = { date: isoDate(addDays(thisWeekStart, -12)), start: "11:00", end: "11:45" };
const sofiaMentorshipSlot2 = {
  id: id("slot"),
  blockId: id("block"),
  ...sofiaMentorshipTime2,
  sessionType: "Consultation",
  maxBookings: 1,
  bufferMin: 0,
  recurrence: null,
  status: "booked",
  bookings: [
    {
      ...bookingFor("Sofia Rossi", "Modern React Patterns for Production", "Capstone presentation & career plan — closing session.", "educator"),
      sessionTag: "mentorship",
      mentorshipId: "ment-sofia",
    },
  ],
  origin: "adhoc",
  history: [historyEntry("created", { to: sofiaMentorshipTime2, actor: "educator" })],
  supersededBySlotId: null,
  supersededFromSlotId: null,
};

export const INITIAL_SLOTS = [
  ...recurringSlots,
  ...liveClassSlots,
  ...consultationSlots,
  scheduledCallSlot,
  reschedOldSlot,
  reschedNewSlot,
  cancelledSlot,
  cancelledSiblingOpenSlot,
  jonasMentorshipSlot,
  sofiaMentorshipSlot1,
  sofiaMentorshipSlot2,
];
