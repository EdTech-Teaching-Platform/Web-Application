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
    testWindows: {}, // { [testId]: { mode: "inherit" | "custom", open, close } }
    late: { policy: "none", penaltyPct: 10, graceHours: 24 }, // policy: "none" | "penalty"
    attemptExpiryDays: "", // standalone only: attempt expires N days after the student starts
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
  if (d.publishMode === "scheduled" && d.goLiveAt) out.push({ key: "publish", order: 2, label: "Go-live", date: d.goLiveAt });
  if (d.windowMode === "window" && d.windowOpen) out.push({ key: "open", order: 3, label: "Window opens", date: d.windowOpen });
  if (d.windowMode === "window" && d.windowClose) out.push({ key: "close", order: 4, label: "Window closes", date: d.windowClose });
  return out;
}

// Validates the deadline fields against each other.
// Returns [{ id, level: "error" | "warning", field, msg }].
export function deadlineIssues(series) {
  const d = series.deadlines || defaultDeadlines();
  const issues = [];
  const push = (id, level, field, msg) => issues.push({ id, level, field, msg });
  const build = effectiveBuildDeadline(series);
  const standalone = series.scope === "standalone";

  if (series.origin === "assigned" && !build) push("build-missing", "error", "buildDeadline", "An assigned series needs a build deadline.");
  if (d.publishMode === "scheduled") {
    if (!isIsoDate(d.goLiveAt)) push("golive-missing", "error", "goLiveAt", "Pick the go-live date for scheduled publishing.");
    else if (build && daysBetween(build, d.goLiveAt) < 0) push("golive-before-build", "error", "goLiveAt", `Go-live (${d.goLiveAt}) is before the build deadline (${build}). You can't go live before the series is built.`);
    else if (daysUntil(d.goLiveAt) < 0) push("golive-past", "warning", "goLiveAt", "The go-live date is in the past, so the series will publish as soon as you publish it.");
  }
  if (d.windowMode === "window") {
    const hasOpen = isIsoDate(d.windowOpen);
    const hasClose = isIsoDate(d.windowClose);
    if (!hasOpen) push("open-missing", "error", "windowOpen", "Pick when the window opens.");
    if (!hasClose) push("close-missing", "error", "windowClose", "Pick when the window closes.");
    if (hasOpen && hasClose && daysBetween(d.windowOpen, d.windowClose) <= 0) push("close-before-open", "error", "windowClose", "The window must close after it opens.");
    if (hasOpen && build && daysBetween(build, d.windowOpen) < 0) push("open-before-build", "error", "windowOpen", `The window opens (${d.windowOpen}) before the build deadline (${build}).`);
    if (hasOpen && d.publishMode === "scheduled" && isIsoDate(d.goLiveAt) && daysBetween(d.goLiveAt, d.windowOpen) < 0) push("open-before-golive", "error", "windowOpen", `The window opens (${d.windowOpen}) before go-live (${d.goLiveAt}).`);
    if (hasClose && daysUntil(d.windowClose) < 0) push("close-past", "error", "windowClose", "The window closes in the past.");
  }
  // Per-test windows must sit inside the series window.
  Object.entries(d.testWindows || {}).forEach(([testId, w]) => {
    if (!w || w.mode !== "custom") return;
    const test = (series.sections || []).flatMap((s) => s.tests).find((t) => t.id === testId);
    if (!test) return;
    const label = test.title || "Untitled test";
    if (!isIsoDate(w.open) || !isIsoDate(w.close)) {
      push(`tw-missing-${testId}`, "error", `tw-${testId}`, `"${label}": set both open and close dates, or switch it back to inherit.`);
      return;
    }
    if (daysBetween(w.open, w.close) <= 0) push(`tw-order-${testId}`, "error", `tw-${testId}`, `"${label}" closes before it opens.`);
    if (d.windowMode === "window" && isIsoDate(d.windowOpen) && daysBetween(d.windowOpen, w.open) < 0) push(`tw-early-${testId}`, "error", `tw-${testId}`, `"${label}" opens before the series window does.`);
    if (d.windowMode === "window" && isIsoDate(d.windowClose) && daysBetween(w.close, d.windowClose) < 0) push(`tw-late-${testId}`, "error", `tw-${testId}`, `"${label}" closes after the series window does.`);
  });
  if (d.late.policy === "penalty") {
    const pct = Number(d.late.penaltyPct);
    const hrs = Number(d.late.graceHours);
    if (!(pct > 0 && pct <= 100)) push("late-pct", "error", "latePct", "Late penalty must be between 1% and 100%.");
    if (!(hrs >= 1 && hrs <= 720)) push("late-hours", "error", "lateHours", "Late submissions can be accepted for 1 to 720 hours.");
    if (d.windowMode !== "window") push("late-needs-window", "warning", "latePolicy", "A late-submission policy only applies once a close date is set.");
  }
  if (standalone && d.attemptExpiryDays !== "" && d.attemptExpiryDays !== null) {
    const n = Number(d.attemptExpiryDays);
    if (!(Number.isInteger(n) && n >= 1 && n <= 365)) push("expiry", "error", "attemptExpiry", "Attempt expiry must be a whole number of days between 1 and 365.");
  }
  const ext = series.extensionRequest;
  if (ext && ext.status === "pending" && isIsoDate(ext.newDate) && build && daysBetween(build, ext.newDate) <= 0) push("ext-order", "warning", "extension", "The requested extension date isn't after the current deadline.");
  return issues;
}
export function deadlineErrors(series) {
  return deadlineIssues(series).filter((i) => i.level === "error");
}
