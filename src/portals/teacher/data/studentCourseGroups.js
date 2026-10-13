// Student Management — By Course grouping + export row shaping. Everything
// here derives from the same buildRoster() entries and reuses the same
// at-risk definition (teacherCourses.isAtRisk: not completed AND inactive
// 14+ days) the flat roster uses, just evaluated on ONE enrollment instead
// of a student's aggregate across courses.
import { isAtRisk, daysAgo } from "./teacherCourses";

// A roster entry "as seen from one course": same shape the roster card
// already renders (so the card is reused, not forked), with the aggregate
// fields replaced by that single enrollment's values. `source` keeps the
// real multi-course entry so message/profile actions still act on the
// whole student.
export function enrollmentView(entry, enr) {
  const lastActiveDaysAgo = daysAgo(enr.lastActive);
  const enrolledDaysAgo = daysAgo(enr.enrolledAt);
  return {
    ...entry,
    source: entry,
    enrollments: [enr],
    courseCount: 1,
    overallProgress: enr.progress,
    lastActive: enr.lastActive,
    lastActiveDaysAgo,
    enrolledAt: enr.enrolledAt,
    enrolledDaysAgo,
    certificateCount: enr.certificateIssued ? 1 : 0,
    overallStatus: enr.completionStatus,
    atRisk: isAtRisk(enr),
    isNew: enrolledDaysAgo <= 30,
    activeThisWeek: lastActiveDaysAgo <= 7,
  };
}

// Mirrors StudentManagement's flat matchesStatusFilter, evaluated on a
// single enrollment: Active = in progress, At Risk = at risk,
// Completed = completed, Not Started = not started.
export function matchesEnrollmentStatus(enr, key) {
  if (key === "all") return true;
  if (key === "active") return enr.completionStatus === "in-progress";
  if (key === "at-risk") return isAtRisk(enr);
  if (key === "completed") return enr.completionStatus === "completed";
  if (key === "not-started") return enr.completionStatus === "not-started";
  return true;
}

// One group per course the educator teaches (zero-student courses
// included). `total`/`avgProgress`/`atRiskCount` always describe the whole
// course; `items` is what survives the active search/status filters,
// sorted with `sortFn` (name order when omitted).
export function buildCourseGroups(roster, courses, { courseFilterIds = [], statusFilter = "all", search = "", sortFn } = {}) {
  const byCourse = new Map();
  (roster || []).forEach((entry) => {
    entry.enrollments.forEach((enr) => {
      if (!byCourse.has(enr.courseId)) byCourse.set(enr.courseId, []);
      byCourse.get(enr.courseId).push(enrollmentView(entry, enr));
    });
  });
  const q = search.trim().toLowerCase();
  return (courses || [])
    .filter((c) => courseFilterIds.length === 0 || courseFilterIds.includes(c.id))
    .map((course) => {
      const all = byCourse.get(course.id) || [];
      const total = all.length;
      const avgProgress = total ? Math.round(all.reduce((s, v) => s + v.overallProgress, 0) / total) : 0;
      const atRiskCount = all.filter((v) => v.atRisk).length;
      let items = all.filter((v) => matchesEnrollmentStatus(v.enrollments[0], statusFilter));
      if (q) items = items.filter((v) => v.name.toLowerCase().includes(q));
      items = sortFn ? sortFn(items) : [...items].sort((a, b) => a.name.localeCompare(b.name));
      return { course: { id: course.id, title: course.title }, total, avgProgress, atRiskCount, items };
    });
}

// -- Export shaping -------------------------------------------------------
// Email is intentionally absent: the student records in teacherCourses.js
// have no email field, so there is nothing real to export.
export const EXPORT_COLUMNS = [
  { key: "name", label: "Student Name", defaultOn: true },
  { key: "courses", label: "Course(s) Enrolled", defaultOn: true },
  { key: "enrolledAt", label: "Enrollment Date", defaultOn: true },
  { key: "progress", label: "Progress %", defaultOn: true },
  { key: "status", label: "Status", defaultOn: true },
  { key: "lastActive", label: "Last Active Date", defaultOn: true },
  { key: "certificate", label: "Certificate Issued", defaultOn: false },
  { key: "atRisk", label: "At-Risk Flag", defaultOn: true },
];

const STATUS_LABELS = { completed: "Completed", "in-progress": "In Progress", "not-started": "Not Started" };

function dateOnly(s) {
  return typeof s === "string" && /^\d{4}-\d{2}-\d{2}/.test(s) ? s.slice(0, 10) : s || "";
}

// `view` is either a flat roster entry (aggregates across courses) or an
// enrollmentView (aggregates of one enrollment) — same field names, so one
// function serves both modes.
function cellValue(view, key) {
  switch (key) {
    case "name":
      return view.name;
    case "courses":
      return view.enrollments.map((e) => e.courseTitle).join("; ");
    case "enrolledAt":
      return dateOnly(view.enrolledAt);
    case "progress":
      return view.overallProgress;
    case "status":
      return STATUS_LABELS[view.overallStatus] || "Not Started";
    case "lastActive":
      return dateOnly(view.lastActive);
    case "certificate":
      if (view.certificateCount <= 0) return "No";
      return view.courseCount > 1 ? `Yes (${view.certificateCount} of ${view.courseCount})` : "Yes";
    case "atRisk":
      return view.atRisk ? "Yes" : "No";
    default:
      return "";
  }
}

// Flat: one row per student (aggregated). Returns { headers, rows }.
export function buildFlatTable(entries, columnKeys) {
  const cols = EXPORT_COLUMNS.filter((c) => columnKeys.includes(c.key));
  return { headers: cols.map((c) => c.label), rows: entries.map((e) => cols.map((c) => cellValue(e, c.key))) };
}

// Grouped: groups = [{ course:{title}, items:[enrollmentView] }]. The
// "Course" column is always present (first); "Course(s) Enrolled" is
// folded into it. Empty groups are dropped.
export function buildGroupedTables(groups, columnKeys) {
  const cols = EXPORT_COLUMNS.filter((c) => columnKeys.includes(c.key) && c.key !== "courses");
  const headers = ["Course", ...cols.map((c) => c.label)];
  const sheets = groups
    .filter((g) => g.items.length > 0)
    .map((g) => ({
      name: g.course.title,
      headers,
      rows: g.items.map((v) => [g.course.title, ...cols.map((c) => cellValue(v, c.key))]),
    }));
  return { headers, sheets };
}

// CSV for grouped data: one table, rows ordered by course title then (for
// the caller-supplied order inside each course) as given.
export function groupedSheetsToCsvRows(sheets) {
  return [...sheets].sort((a, b) => a.name.localeCompare(b.name)).flatMap((s) => s.rows);
}
