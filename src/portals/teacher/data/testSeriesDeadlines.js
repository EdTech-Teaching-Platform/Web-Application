// Test Series deadlines + mock-clock helpers (Part 6D).
// Everything date-related for a series lives here so the builder, the
// "Assigned to me" page, the cards and the future Performance tab all read the
// same rules. "Today" is the app-wide mock clock (TODAY in teacherCourses.js,
// 2026-09-20) so countdowns stay stable in the demo instead of drifting off
// the real calendar.
import { TODAY } from "./teacherCourses";

const pad = (n) => String(n).padStart(2, "0");
export const MOCK_TODAY_ISO = `${TODAY.getFullYear()}-${pad(TODAY.getMonth() + 1)}-${pad(TODAY.getDate())}`;

// Mock "now": the mock TODAY plus real time elapsed since the app loaded, so
// "Saved just now / 3 min ago" ticks naturally yet sits on the mock calendar.
const LOADED_AT = Date.now();
export function mockNowMs() {
  return TODAY.getTime() + (Date.now() - LOADED_AT);
}
export function nowIso() {
  return new Date(mockNowMs()).toISOString();
}

export function timeAgo(iso) {
  if (!iso) return "never";
  const diff = Math.max(0, mockNowMs() - new Date(iso).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}

function dayNumber(iso) {
  const [y, m, d] = String(iso).slice(0, 10).split("-").map(Number);
  return Math.round(Date.UTC(y, (m || 1) - 1, d || 1) / 86400000);
}
export function isIsoDate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v));
}
export function daysBetween(aIso, bIso) {
  return dayNumber(bIso) - dayNumber(aIso);
}
// Whole days from the mock today to `iso` (negative = in the past, null = no date).
export function daysUntil(iso) {
  return isIsoDate(iso) ? daysBetween(MOCK_TODAY_ISO, iso) : null;
}
export function addDays(iso, n) {
  const d = new Date((dayNumber(iso) + n) * 86400000);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

// Countdown tone: sage > 7 days, gold 3-7, red < 3 or overdue.
export function deadlineTone(days) {
  if (days === null || days === undefined) return "none";
  if (days < 3) return "danger";
  if (days <= 7) return "gold";
  return "sage";
}
export function countdownLabel(days) {
  if (days === null || days === undefined) return "No deadline";
  if (days < 0) return `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"}`;
  if (days === 0) return "Due today";
  if (days === 1) return "Due tomorrow";
  return `${days} days left`;
}

// ---------------------------------------------------------------------
// Deadlines object (stored on every series as `series.deadlines`)
export function defaultDeadlines() {
  return {
    buildDeadline: "", // required + locked for assigned series, optional for own
    buildLocked: false,
    publishMode: "now", // "now" | "scheduled"
    goLiveAt: "",
    windowMode: "always", // "always" | "window"
    windowOpen: "",
    windowClose: "",
    testWindows: {}, // { [testId]: { mode: "inherit" | "custom", open, close } } (date-times)
    // Late submissions (admin wizard): policy "none" = not allowed, anything else = allowed with a grace period.
    late: { policy: "none", graceMinutes: 10, penaltyPct: 10, graceHours: 24 },
    monthlyLimited: false, // how many tests one student can open per calendar month
    monthlyLimit: 5,
    accessLimited: false, // days a student keeps access after joining / buying
    accessDays: 90,
    attemptExpiryDays: "",
    reminders: { edu7: true, edu3: true, edu1: true, students: true },
  };
}
export function normalizeDeadlines(d, { origin = "own", requiredDeadline = "" } = {}) {
  const base = defaultDeadlines();
  const merged = {
    ...base,
    ...(d || {}),
    late: { ...base.late, ...((d && d.late) || {}) },
    reminders: { ...base.reminders, ...((d && d.reminders) || {}) },
    testWindows: { ...((d && d.testWindows) || {}) },
  };
  if (origin === "assigned" && requiredDeadline) {
    merged.buildDeadline = merged.buildDeadline || requiredDeadline;
    merged.buildLocked = true;
  }
  return merged;
}

// The effective (admin-approved) build deadline, including an approved extension.
export function effectiveBuildDeadline(series) {
  const ext = series.extensionRequest;
  if (ext && ext.status === "approved" && isIsoDate(ext.newDate)) return ext.newDate;
  return series.deadlines?.buildDeadline || series.assignment?.requiredDeadline || "";
}

// Ordered milestones for the visual timeline. `order` is the canonical
// sequence used to detect conflicts (a later milestone dated before an earlier one).
export function timelineEvents(series) {
  const d = series.deadlines || defaultDeadlines();
  const out = [];
  const assignedOn = series.assignment?.assignedOn || series.createdAt;
  if (assignedOn) out.push({ key: "assigned", order: 0, label: series.origin === "assigned" ? "Assigned" : "Created", date: assignedOn });
  const build = effectiveBuildDeadline(series);
  if (build) out.push({ key: "build", order: 1, label: "Build deadline", date: build });
  if (d.publishMode === "scheduled" && d.goLiveAt) out.push({ key: "publish", order: 2, label: "Go-live", date: String(d.goLiveAt).slice(0, 10) });
  if (d.windowMode === "window" && d.windowOpen) out.push({ key: "open", order: 3, label: "Window opens", date: d.windowOpen });
  if (d.windowMode === "window" && d.windowClose) out.push({ key: "close", order: 4, label: "Window closes", date: d.windowClose });
  return out;
}

// Validates the availability fields (same rules as the admin wizard's Availability step).
// Returns [{ id, level: "error" | "warning", field, msg }].
export function deadlineIssues(series) {
  const d = series.deadlines || defaultDeadlines();
  const issues = [];
  const push = (id, level, field, msg) => issues.push({ id, level, field, msg });
  const build = effectiveBuildDeadline(series);
  const day = (v) => String(v || "").slice(0, 10);

  if (series.origin === "assigned" && !build) push("build-missing", "error", "buildDeadline", "An assigned series needs a build deadline.");
  if (d.publishMode === "scheduled") {
    if (!d.goLiveAt) push("golive-missing", "error", "goLiveAt", "Choose the go-live date and time.");
    else if (!(Date.parse(d.goLiveAt) > mockNowMs())) push("golive-past", "error", "goLiveAt", "Go-live must be in the future.");
  }
  if (d.monthlyLimited && !(Number.isInteger(Number(d.monthlyLimit)) && Number(d.monthlyLimit) >= 1)) push("monthly", "error", "monthlyLimit", "Monthly access limit must be a whole number of 1 or more.");
  if (d.accessLimited && !(Number.isInteger(Number(d.accessDays)) && Number(d.accessDays) >= 1)) push("access", "error", "accessDays", "Access duration must be a whole number of days, 1 or more.");
  if (d.windowMode === "window") {
    if (!d.windowOpen || !d.windowClose) push("window-missing", "error", "windowOpen", "Set both the open and close dates.");
    else if (day(d.windowOpen) > day(d.windowClose)) push("close-before-open", "error", "windowClose", "The open date must be before the close date.");
  }
  // Per-test windows (date-times) must be complete, ordered and inside the series window.
  Object.entries(d.testWindows || {}).forEach(([testId, w]) => {
    if (!w || w.mode !== "custom") return;
    const test = (series.sections || []).flatMap((s) => s.tests).find((t) => t.id === testId);
    if (!test) return;
    const label = test.title || "Untitled test";
    if (!w.open || !w.close) push(`tw-${testId}`, "error", `tw-${testId}`, `${label}: set both window times or switch to "Inherit".`);
    else if (w.open >= w.close) push(`tw-${testId}`, "error", `tw-${testId}`, `${label}: window must open before it closes.`);
    else if (d.windowMode === "window" && (day(w.open) < day(d.windowOpen) || day(w.close) > day(d.windowClose))) push(`tw-${testId}`, "error", `tw-${testId}`, `${label}: window must fall inside the series window.`);
  });
  if (d.late && d.late.policy !== "none" && !(Number(d.late.graceMinutes) > 0)) push("late-grace", "error", "lateGrace", "Enter a grace period in minutes for late submissions.");
  return issues;
}
export function deadlineErrors(series) {
  return deadlineIssues(series).filter((i) => i.level === "error");
}
