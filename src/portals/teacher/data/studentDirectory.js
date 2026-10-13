// Student Management — cross-course student directory. Builds one unified
// record per unique student name across every course this educator
// teaches, aggregated from the exact same per-course student records My
// Courses, Course Management's Students tab, Scheduled Call Booking and
// Messaging already read from (teacherCourses.js via TeacherCoursesContext)
// -- never a separately hardcoded roster. A student showing two course
// chips here is genuinely enrolled in both of those courses in the app's
// shared mock data (see ScheduleCallModal/messagingData.js's own
// buildDirectory/buildStudentDirectory, which this follows the same
// precedent as, just enriched with the extra aggregate fields this section
// needs: overall progress, at-risk reasoning, activity/enrollment window).
import { TODAY, daysAgo } from "./teacherCourses";

function keyFor(name) {
  return name.trim().toLowerCase();
}

export function initials(name) {
  return (name || "")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

// Multi-segment progress bar colors, one per enrolled course — reuses the
// same rotation-1..4 chart palette DonutChart/deviceBreakdown already
// established for "one color per category", cycling if a student is
// somehow enrolled in more than 5 of this educator's courses.
export const COURSE_SEGMENT_COLORS = ["bg-primary", "bg-rotation-1", "bg-rotation-3", "bg-rotation-2", "bg-rotation-4"];

function enrichEntry(entry) {
  const { enrollments } = entry;
  const overallProgress = Math.round(enrollments.reduce((sum, e) => sum + e.progress, 0) / enrollments.length);
  const lastActive = enrollments.reduce((latest, e) => (e.lastActive > latest ? e.lastActive : latest), enrollments[0].lastActive);
  const enrolledAt = enrollments.reduce((earliest, e) => (e.enrolledAt < earliest ? e.enrolledAt : earliest), enrollments[0].enrolledAt);
  const certificateCount = enrollments.filter((e) => e.certificateIssued).length;
  const allCompleted = enrollments.every((e) => e.completionStatus === "completed");
  const anyStarted = enrollments.some((e) => e.completionStatus !== "not-started");
  const overallStatus = allCompleted ? "completed" : anyStarted ? "in-progress" : "not-started";
  const lastActiveDaysAgo = daysAgo(lastActive);
  const enrolledDaysAgo = daysAgo(enrolledAt);
  const atRisk = !allCompleted && lastActiveDaysAgo >= 14;

  return {
    ...entry,
    courseCount: enrollments.length,
    overallProgress,
    lastActive,
    lastActiveDaysAgo,
    enrolledAt,
    enrolledDaysAgo,
    certificateCount,
    overallStatus,
    atRisk,
    isNew: enrolledDaysAgo <= 30,
    activeThisWeek: lastActiveDaysAgo <= 7,
  };
}

export function buildRoster(courses) {
  const map = new Map();
  (courses || []).forEach((course) => {
    (course.students || []).forEach((s) => {
      const key = keyFor(s.name);
      if (!map.has(key)) map.set(key, { key, name: s.name, enrollments: [] });
      map.get(key).enrollments.push({
        courseId: course.id,
        courseTitle: course.title,
        studentId: s.id,
        progress: s.progress,
        completionStatus: s.completionStatus,
        lastActive: s.lastActive,
        enrolledAt: s.enrolledAt,
        certificateIssued: s.certificateIssued,
      });
    });
  });
  return Array.from(map.values())
    .map(enrichEntry)
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function rosterStats(roster) {
  const total = roster.length;
  const activeThisWeek = roster.filter((r) => r.activeThisWeek).length;
  const atRisk = roster.filter((r) => r.atRisk).length;
  const newThisMonth = roster.filter((r) => r.isNew).length;
  return { total, activeThisWeek, atRisk, newThisMonth };
}

// Picks which enrollment a single-target action (Schedule Call)
// should act on when a student has more than one course with this
// educator — the most recently active one, so the action lands on
// whichever relationship is "live" right now rather than an arbitrary
// first course.
export function primaryEnrollment(entry) {
  return entry.enrollments.reduce((best, e) => (e.lastActive > best.lastActive ? e : best), entry.enrollments[0]);
}

// -- At-Risk reasoning --------------------------------------------------
// Prefers a specific signal already present in real course data (a late
// submission still awaiting review, a course never started) over a plain
// "inactive" message, so the At-Risk dashboard reads as diagnostic rather
// than one repeated warning banner.
export function atRiskReason(entry, courses) {
  if (!entry.atRisk) return null;

  for (const enr of entry.enrollments) {
    const course = (courses || []).find((c) => c.id === enr.courseId);
    const lateSubmission = (course?.submissions || []).find(
      (s) => (s.studentId === enr.studentId || s.studentName === entry.name) && s.late && s.status !== "graded"
    );
    if (lateSubmission) {
      return {
        text: `Submitted "${lateSubmission.moduleTitle}" late — still awaiting review`,
        action: "reminder",
        courseId: enr.courseId,
        courseTitle: enr.courseTitle,
        assignmentTitle: lateSubmission.moduleTitle,
      };
    }
  }

  const stalled = entry.enrollments.find((e) => e.completionStatus === "not-started" && daysAgo(e.enrolledAt) >= 14);
  if (stalled && entry.overallProgress === 0) {
    return {
      text: `Enrolled ${daysAgo(stalled.enrolledAt)} days ago, hasn't started ${entry.enrollments.length > 1 ? "any course yet" : "the course yet"}`,
      action: "encouragement",
      courseId: stalled.courseId,
      courseTitle: stalled.courseTitle,
    };
  }

  return {
    text: `No activity in ${entry.lastActiveDaysAgo} days`,
    action: entry.lastActiveDaysAgo >= 21 ? "encouragement" : "check-in",
    courseId: primaryEnrollment(entry).courseId,
    courseTitle: primaryEnrollment(entry).courseTitle,
  };
}

export function atRiskActionLabel() {
  return "Add to group announcement";
}

// -- Assessments (graded/drafted submissions across every enrolled course) --
export function studentAssessments(entry, courses) {
  const rows = [];
  entry.enrollments.forEach((enr) => {
    const course = (courses || []).find((c) => c.id === enr.courseId);
    (course?.submissions || [])
      .filter((s) => s.studentId === enr.studentId || s.studentName === entry.name)
      .filter((s) => s.status === "graded" || s.status === "draft")
      .forEach((s) => rows.push({ ...s, courseId: enr.courseId, courseTitle: enr.courseTitle }));
  });
  return rows.sort((a, b) => (b.gradedAt || b.submittedAt || "").localeCompare(a.gradedAt || a.submittedAt || ""));
}

// -- Bookings & sessions (reuses TeacherAvailabilityContext's real slots) --
export function studentBookings(entry, slots) {
  return (slots || [])
    .filter((s) => (s.bookings || []).some((b) => b.studentName === entry.name))
    .sort((a, b) => (b.date + b.start).localeCompare(a.date + a.start));
}

export function bookingDisplayStatus(slot) {
  if (slot.status === "cancelled") return { label: "Cancelled", status: "neutral" };
  if (slot.status === "rescheduled") return { label: "Rescheduled", status: "warning" };
  if (slot.status === "booked" && slot.date < isoToday()) return { label: "Completed", status: "success" };
  if (slot.status === "booked") return { label: "Upcoming", status: "success" };
  return { label: "Open", status: "neutral" };
}

function isoToday() {
  return TODAY.toISOString().slice(0, 10);
}

// Attendance recorded against a slot's live class (present/partial/absent),
// same definitions used for
// slot.liveClass.summary.attendance -- read here rather than a separate
// mock so a student's attendance record never disagrees with their actual
// live-class summary.
export function studentAttendanceForSlot(slot, studentName) {
  const attendance = slot.liveClass?.summary?.attendance;
  if (!attendance) return null;
  return attendance.find((a) => a.name === studentName) || null;
}

// -- Activity timeline (Overview tab) ------------------------------------
export function studentTimeline(entry, courses) {
  const events = [];
  entry.enrollments.forEach((enr) => {
    events.push({ type: "enrolled", date: enr.enrolledAt, courseTitle: enr.courseTitle });
    if (enr.certificateIssued) events.push({ type: "certificate", date: enr.lastActive, courseTitle: enr.courseTitle });
    const course = (courses || []).find((c) => c.id === enr.courseId);
    (course?.submissions || [])
      .filter((s) => s.studentId === enr.studentId || s.studentName === entry.name)
      .forEach((s) => {
        if (s.submittedAt) events.push({ type: "submitted", date: s.submittedAt, courseTitle: enr.courseTitle, title: s.moduleTitle });
        if (s.status === "graded" && s.gradedAt) {
          events.push({ type: "graded", date: s.gradedAt, courseTitle: enr.courseTitle, title: s.moduleTitle, score: s.score });
        }
      });
  });
  return events.filter((e) => e.date).sort((a, b) => b.date.localeCompare(a.date));
}
