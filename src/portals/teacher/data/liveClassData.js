// Shared helpers for converting a booking into a scheduled live class
// (title suggestion, notify modes, roster picker). Video calling, recording
// and in-class tools are handled by the educator's meeting provider (see
// meetingProviders.js), so nothing here models in-session state.

export function suggestSessionTitle(slot) {
  if (!slot) return "";
  const course = slot.bookings?.[0]?.courseTitle;
  if (!course) return slot.sessionType || "Live Class";
  return `${slot.sessionType} · ${course}`;
}

export const NOTIFY_MODES = [
  { key: "now", label: "Notify now", caption: "Students get the class link as soon as it's created." },
  { key: "reminder", label: "Notify at reminder time", caption: "Students are reminded 15 minutes before the class starts." },
];

// -- Roster ------------------------------------------------------------
// Builds the group-format participant picker from real enrolled-student
// records on the booking's course (never a separate hardcoded list) — the
// booked student(s) come pre-checked, classmates from the same course can
// be added alongside them.
export function buildRosterCandidates(slot, courses) {
  const course = (courses || []).find((c) => c.id === slot?.bookings?.[0]?.courseId);
  const bookedNames = new Set((slot?.bookings || []).map((b) => b.studentName));
  const classmates = (course?.students || [])
    .map((s) => s.name)
    .filter((name) => !bookedNames.has(name));
  return {
    booked: (slot?.bookings || []).map((b) => b.studentName),
    classmates,
  };
}

export function initials(name = "") {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}
