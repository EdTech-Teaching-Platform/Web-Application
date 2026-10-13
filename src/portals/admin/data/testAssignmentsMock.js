// Test Series — Educator Assignments, Review & Approval, and (mock)
// educator notifications — extends the existing Test Series module
// (testSeriesMock.js) instead of duplicating it. An "assignment" here
// is the Admin's request for an educator to build out a test/question
// paper for a subject within an existing (or soon-to-exist) test
// series; it is a separate concern from the test series' own
// draft/published lifecycle (testSeriesMock.js), which is untouched.
//
// Same tiny pub/sub "store" pattern as every other admin data/*Mock.js
// file (see testSeriesMock.js / staffAssignmentsMock.js). A "submission"
// is modeled as a sub-object on the assignment itself (not a second,
// separate dataset) so assignment status, review state, and tracker
// progress can never drift apart.
//
// Educator notifications: this app has no real email/push delivery, so
// every assignment/notification event is written to an in-memory mock
// log (see MOCK_NOTICE below) rather than faked as "sent". Treat this
// as an audit trail of what WOULD be sent to the educator once a real
// notification service is wired up.

import { useSyncExternalStore } from "react";
import { getEducatorsSnapshot } from "./educatorsMock";

export const MOCK_NOTICE = "Mock notification only — no email/push delivery is wired up yet.";

export const ASSIGNMENT_STATUS = {
  ASSIGNED: "assigned",
  IN_PROGRESS: "in_progress",
  SUBMITTED: "submitted",
  UNDER_REVIEW: "under_review",
  REVISION_REQUESTED: "revision_requested",
  APPROVED: "approved",
  REJECTED: "rejected",
  COMPLETED: "completed",
  CANCELLED: "cancelled",
};
export const ASSIGNMENT_STATUS_LABEL = {
  assigned: "Assigned",
  in_progress: "In Progress",
  submitted: "Submitted",
  under_review: "Under Review",
  revision_requested: "Revision Requested",
  approved: "Approved",
  rejected: "Rejected",
  completed: "Completed",
  cancelled: "Cancelled",
  overdue: "Overdue", // computed/display-only — never stored
};
export const ASSIGNMENT_STATUS_BADGE_CLASS = {
  assigned: "is-pending",
  in_progress: "is-pending",
  submitted: "is-approved",
  under_review: "is-pending",
  revision_requested: "is-rejected",
  approved: "is-approved",
  rejected: "is-rejected",
  completed: "is-approved",
  cancelled: "is-rejected",
  overdue: "is-rejected",
};
// Rough "how far along" progress bar per status — overridden per-row only
// by the overdue display flag (see getDisplayStatus), not by a stored field.
const STATUS_PROGRESS = {
  assigned: 5,
  in_progress: 40,
  submitted: 75,
  under_review: 80,
  revision_requested: 55,
  approved: 95,
  rejected: 0,
  completed: 100,
  cancelled: 0,
};

export const QUESTION_TYPE_MIX = {
  OBJECTIVE: "objective",
  SUBJECTIVE: "subjective",
  MIXED: "mixed",
};
export const QUESTION_TYPE_MIX_LABEL = {
  objective: "Objective (MCQ) only",
  subjective: "Subjective only",
  mixed: "Mixed (Objective + Subjective)",
};

export const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Mixed"];

let idCounter = 5000;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}
function daysAgo(n) {
  return daysFromNow(-n);
}

function educatorName(id) {
  const e = getEducatorsSnapshot().find((x) => x.id === id);
  return e ? e.name : id;
}

// ---------- mock notification log (admin-visible audit trail only) ----------
let _notificationLog = [];
const _notifListeners = new Set();
function _emitNotif() {
  _notifListeners.forEach((fn) => fn());
}
function _subscribeNotif(fn) {
  _notifListeners.add(fn);
  return () => _notifListeners.delete(fn);
}
function logNotification(assignment, type, title, message) {
  _notificationLog = [
    {
      id: nextId("NTF"),
      assignmentId: assignment.id,
      educatorId: assignment.educatorId,
      educatorName: assignment.educatorName,
      type, // "assigned" | "updated" | "deadline_changed" | "revision_requested" | "approved" | "rejected" | "cancelled"
      title,
      message,
      createdAt: new Date().toISOString(),
      mock: true,
    },
    ..._notificationLog,
  ];
  _emitNotif();
}
export function useAllMockNotifications() {
  return useSyncExternalStore(_subscribeNotif, () => _notificationLog);
}
export function useAssignmentNotifications(assignmentId) {
  const all = useAllMockNotifications();
  return all.filter((n) => n.assignmentId === assignmentId);
}

// ---------- assignment store ----------
function buildAssignment({
  seriesId, seriesName, subject, topics, educatorId, testName, questionCount, questionTypeMix,
  difficulty, totalMarks, duration, instructions, assignedDate, deadline, status,
  submission, history,
}) {
  return {
    id: nextId("ASG"),
    seriesId,
    seriesName,
    subject,
    topics: topics || [],
    educatorId,
    educatorName: educatorName(educatorId),
    testName,
    questionCount: questionCount ?? 20,
    questionTypeMix: questionTypeMix || QUESTION_TYPE_MIX.MIXED,
    difficulty: difficulty || "Medium",
    totalMarks: totalMarks ?? 100,
    duration: duration ?? 60,
    instructions: instructions || "",
    assignedDate: assignedDate || daysAgo(0),
    deadline,
    status: status || ASSIGNMENT_STATUS.ASSIGNED,
    submission: submission || null, // { submittedAt, overallFeedback, questionComments: [{questionRef, comment}], decision, decisionAt, decisionReason }
    history: history || [{ action: "Assigned", by: "Admin User", at: new Date().toISOString(), note: "Assignment created." }],
  };
}

const SEED_ASSIGNMENTS = [
  buildAssignment({
    seriesId: "TS-1001", seriesName: "JEE Main Physics Test Series 2026", subject: "Physics",
    educatorId: "EDU-1005", testName: "Physics Full Mock Test 2 — Electrostatics & Current",
    questionCount: 30, questionTypeMix: QUESTION_TYPE_MIX.MIXED, difficulty: "Hard",
    totalMarks: 100, duration: 90,
    instructions: "Cover electrostatics, capacitors, and current electricity. Include 3 subjective derivation questions.",
    assignedDate: daysAgo(10), deadline: daysAgo(2),
    status: ASSIGNMENT_STATUS.IN_PROGRESS,
  }),
  buildAssignment({
    seriesId: "TS-1002", seriesName: "Class 10 Mathematics Weekly Series", subject: "Mathematics",
    educatorId: "EDU-1005", testName: "Weekly Test 3 — Triangles & Coordinate Geometry",
    questionCount: 20, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Medium",
    totalMarks: 30, duration: 45,
    instructions: "Keep to CBSE Class 10 syllabus weightage. No negative marking.",
    assignedDate: daysAgo(6), deadline: daysFromNow(1),
    status: ASSIGNMENT_STATUS.ASSIGNED,
  }),
  buildAssignment({
    seriesId: "TS-1004", seriesName: "Banking & SSC Reasoning Practice Series", subject: "Reasoning & Aptitude",
    educatorId: "EDU-1009", testName: "Practice Set 13 — Blood Relations & Syllogisms",
    questionCount: 25, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Medium",
    totalMarks: 25, duration: 30,
    instructions: "Match the style/difficulty of Practice Set 12.",
    assignedDate: daysAgo(14), deadline: daysAgo(7),
    status: ASSIGNMENT_STATUS.SUBMITTED,
    submission: {
      submittedAt: daysAgo(6),
      overallFeedback: "",
      questionComments: [],
      decision: null,
      decisionAt: null,
      decisionReason: "",
    },
  }),
  buildAssignment({
    seriesId: "TS-1003", seriesName: "NEET Biology Crash Course Series", subject: "Biology",
    educatorId: "EDU-1008", testName: "Diagnostic Test — Genetics & Evolution",
    questionCount: 25, questionTypeMix: QUESTION_TYPE_MIX.MIXED, difficulty: "Hard",
    totalMarks: 50, duration: 50,
    instructions: "Include at least 2 assertion-reason questions.",
    assignedDate: daysAgo(20), deadline: daysAgo(12),
    status: ASSIGNMENT_STATUS.REVISION_REQUESTED,
    submission: {
      submittedAt: daysAgo(13),
      overallFeedback: "Good coverage, but 4 questions are near-duplicates of the Diagnostic Test — Cell Biology paper. Please revise those and re-submit.",
      questionComments: [
        { questionRef: "Q3", comment: "This is nearly identical to a question in the Cell Biology diagnostic test — please rewrite." },
      ],
      decision: "revision",
      decisionAt: daysAgo(11),
      decisionReason: "Overlapping questions with an earlier test in the same series.",
    },
  }),
  buildAssignment({
    seriesId: "TS-1005", seriesName: "English Proficiency Test Series", subject: "English",
    educatorId: "EDU-1012", testName: "Grammar & Vocabulary Test 2",
    questionCount: 35, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Easy",
    totalMarks: 35, duration: 40,
    instructions: "Focus on tenses and common confusable words.",
    assignedDate: daysAgo(18), deadline: daysAgo(9),
    status: ASSIGNMENT_STATUS.APPROVED,
    submission: {
      submittedAt: daysAgo(10),
      overallFeedback: "Well-structured, clear distractors throughout. Approved as-is.",
      questionComments: [],
      decision: "approved",
      decisionAt: daysAgo(8),
      decisionReason: "",
    },
  }),
  buildAssignment({
    seriesId: "TS-1001", seriesName: "JEE Main Physics Test Series 2026", subject: "Physics",
    educatorId: "EDU-1009", testName: "Physics Full Mock Test 1 — Mechanics & Waves (Re-seed)",
    questionCount: 40, questionTypeMix: QUESTION_TYPE_MIX.MIXED, difficulty: "Hard",
    totalMarks: 40, duration: 60,
    instructions: "Already published once — this assignment is for the retake variant.",
    assignedDate: daysAgo(2), deadline: daysFromNow(10),
    status: ASSIGNMENT_STATUS.ASSIGNED,
  }),
  buildAssignment({
    seriesId: "TS-1002", seriesName: "Class 10 Mathematics Weekly Series", subject: "Mathematics",
    educatorId: "EDU-1009", testName: "Weekly Test 4 — Circles",
    questionCount: 18, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Medium",
    totalMarks: 25, duration: 35,
    instructions: "Keep within chapter scope; no mensuration overlap with Test 5.",
    assignedDate: daysAgo(16), deadline: daysAgo(5),
    status: ASSIGNMENT_STATUS.ASSIGNED,
  }),
  buildAssignment({
    seriesId: "TS-1003", seriesName: "NEET Biology Crash Course Series", subject: "Biology",
    educatorId: "EDU-1012", testName: "Diagnostic Test — Human Physiology (duplicate attempt)",
    questionCount: 20, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Medium",
    totalMarks: 40, duration: 40,
    instructions: "Cover digestive and respiratory systems.",
    assignedDate: daysAgo(25), deadline: daysAgo(15),
    status: ASSIGNMENT_STATUS.REJECTED,
    submission: {
      submittedAt: daysAgo(16),
      overallFeedback: "Too many questions were lifted near-verbatim from a licensed question bank without rework.",
      questionComments: [],
      decision: "rejected",
      decisionAt: daysAgo(14),
      decisionReason: "Content sourcing concern — questions were not sufficiently original.",
    },
  }),
  buildAssignment({
    seriesId: "TS-1004", seriesName: "Banking & SSC Reasoning Practice Series", subject: "Reasoning & Aptitude",
    educatorId: "EDU-1012", testName: "Practice Set 14 — Data Sufficiency",
    questionCount: 20, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Hard",
    totalMarks: 20, duration: 25,
    instructions: "Banking exam pattern, moderate-to-hard difficulty.",
    assignedDate: daysAgo(4), deadline: daysFromNow(6),
    status: ASSIGNMENT_STATUS.IN_PROGRESS,
  }),
];

let _assignments = SEED_ASSIGNMENTS;
const _listeners = new Set();
function _emit() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _snapshot() {
  return _assignments;
}

export function useAssignments() {
  return useSyncExternalStore(_subscribe, _snapshot);
}
export function useAssignment(id) {
  return useAssignments().find((a) => a.id === id) || null;
}
export function getAssignmentsSnapshot() {
  return _snapshot();
}

// A stored status is "Overdue" for display only when the deadline has
// passed and the assignment hasn't reached a terminal good state —
// never written back to the record, so it always reflects "now".
export function getDisplayStatus(a) {
  const terminal = [ASSIGNMENT_STATUS.APPROVED, ASSIGNMENT_STATUS.COMPLETED, ASSIGNMENT_STATUS.CANCELLED, ASSIGNMENT_STATUS.REJECTED];
  if (!terminal.includes(a.status) && a.deadline && a.deadline < daysAgo(0)) return "overdue";
  return a.status;
}
export function getAssignmentProgress(a) {
  if (getDisplayStatus(a) === "overdue" && a.status !== ASSIGNMENT_STATUS.REVISION_REQUESTED) {
    return STATUS_PROGRESS[a.status] ?? 0;
  }
  return STATUS_PROGRESS[a.status] ?? 0;
}

export function createAssignment(data) {
  const assignment = buildAssignment(data);
  _assignments = [assignment, ..._assignments];
  logNotification(
    assignment,
    "assigned",
    "New test assignment",
    `You've been assigned "${assignment.testName}" (${assignment.subject}, ${assignment.seriesName}). Deadline: ${assignment.deadline}.`
  );
  _emit();
  return assignment;
}

export function updateAssignmentRequirements(id, patch) {
  let updated = null;
  _assignments = _assignments.map((a) => {
    if (a.id !== id) return a;
    updated = {
      ...a,
      ...patch,
      history: [...a.history, { action: "Requirements updated", by: "Admin User", at: new Date().toISOString(), note: "Test requirements were edited." }],
    };
    return updated;
  });
  _emit();
  if (updated) {
    logNotification(updated, "updated", "Assignment requirements updated", `Requirements for "${updated.testName}" were updated. Please review the changes.`);
  }
  return updated;
}

export function reassignEducator(id, newEducatorId) {
  let updated = null;
  _assignments = _assignments.map((a) => {
    if (a.id !== id) return a;
    const prevName = a.educatorName;
    updated = {
      ...a,
      educatorId: newEducatorId,
      educatorName: educatorName(newEducatorId),
      status: ASSIGNMENT_STATUS.ASSIGNED,
      submission: null,
      history: [...a.history, { action: "Reassigned", by: "Admin User", at: new Date().toISOString(), note: `Reassigned from ${prevName} to ${educatorName(newEducatorId)}.` }],
    };
    return updated;
  });
  _emit();
  if (updated) {
    logNotification(updated, "assigned", "Test assignment reassigned to you", `You've been assigned "${updated.testName}" (${updated.subject}, ${updated.seriesName}). Deadline: ${updated.deadline}.`);
  }
  return updated;
}

export function extendDeadline(id, newDeadline) {
  let updated = null;
  _assignments = _assignments.map((a) => {
    if (a.id !== id) return a;
    updated = {
      ...a,
      deadline: newDeadline,
      history: [...a.history, { action: "Deadline changed", by: "Admin User", at: new Date().toISOString(), note: `Deadline moved to ${newDeadline}.` }],
    };
    return updated;
  });
  _emit();
  if (updated) {
    logNotification(updated, "deadline_changed", "Assignment deadline changed", `The deadline for "${updated.testName}" is now ${newDeadline}.`);
  }
  return updated;
}

export function cancelAssignment(id, reason) {
  let updated = null;
  _assignments = _assignments.map((a) => {
    if (a.id !== id) return a;
    updated = {
      ...a,
      status: ASSIGNMENT_STATUS.CANCELLED,
      history: [...a.history, { action: "Cancelled", by: "Admin User", at: new Date().toISOString(), note: reason || "Assignment cancelled." }],
    };
    return updated;
  });
  _emit();
  if (updated) {
    logNotification(updated, "cancelled", "Assignment cancelled", `The assignment "${updated.testName}" has been cancelled. ${reason || ""}`.trim());
  }
  return updated;
}

// ---- Review & Approval (acts on the same assignment record) ----

export function startReview(id) {
  let updated = null;
  _assignments = _assignments.map((a) => {
    if (a.id !== id || a.status !== ASSIGNMENT_STATUS.SUBMITTED) return a;
    updated = { ...a, status: ASSIGNMENT_STATUS.UNDER_REVIEW, history: [...a.history, { action: "Review started", by: "Admin User", at: new Date().toISOString(), note: "Admin opened this submission for review." }] };
    return updated;
  });
  if (updated) _emit();
  return updated;
}

export function reviewSubmission(id, { decision, overallFeedback, questionComments, decisionReason }) {
  let updated = null;
  _assignments = _assignments.map((a) => {
    if (a.id !== id) return a;
    const nextStatus =
      decision === "approved" ? ASSIGNMENT_STATUS.APPROVED
      : decision === "revision" ? ASSIGNMENT_STATUS.REVISION_REQUESTED
      : ASSIGNMENT_STATUS.REJECTED;
    updated = {
      ...a,
      status: nextStatus,
      submission: {
        ...(a.submission || {}),
        overallFeedback: overallFeedback || "",
        questionComments: questionComments || [],
        decision,
        decisionAt: new Date().toISOString(),
        decisionReason: decisionReason || "",
      },
      history: [...a.history, { action: decision === "approved" ? "Approved" : decision === "revision" ? "Revision requested" : "Rejected", by: "Admin User", at: new Date().toISOString(), note: decisionReason || overallFeedback || "" }],
    };
    return updated;
  });
  _emit();
  if (updated) {
    const type = decision === "approved" ? "approved" : decision === "revision" ? "revision_requested" : "rejected";
    const title = decision === "approved" ? "Submission approved" : decision === "revision" ? "Revision requested" : "Submission rejected";
    const message = decision === "approved"
      ? `Your submission for "${updated.testName}" was approved.`
      : decision === "revision"
      ? `Revisions were requested for "${updated.testName}": ${updated.submission.overallFeedback || updated.submission.decisionReason}`
      : `Your submission for "${updated.testName}" was rejected: ${updated.submission.decisionReason}`;
    logNotification(updated, type, title, message);
  }
  return updated;
}

// Marks an assignment as completed once its approved test has actually
// been published in the Test Series module — called from wherever the
// existing publish action lives, never automatically on approval alone.
export function markAssignmentCompleted(id) {
  let updated = null;
  _assignments = _assignments.map((a) => {
    if (a.id !== id) return a;
    updated = { ...a, status: ASSIGNMENT_STATUS.COMPLETED, history: [...a.history, { action: "Completed", by: "Admin User", at: new Date().toISOString(), note: "Linked test was published." }] };
    return updated;
  });
  _emit();
  return updated;
}

// ---- Tracker aggregation ----

export function computeTrackerStats(assignments) {
  const list = assignments || _snapshot();
  const totalAssignments = list.length;
  const inProgress = list.filter((a) => getDisplayStatus(a) === ASSIGNMENT_STATUS.IN_PROGRESS).length;
  const pendingSubmissions = list.filter((a) => [ASSIGNMENT_STATUS.ASSIGNED, ASSIGNMENT_STATUS.IN_PROGRESS].includes(a.status)).length;
  const pendingReviews = list.filter((a) => [ASSIGNMENT_STATUS.SUBMITTED, ASSIGNMENT_STATUS.UNDER_REVIEW].includes(a.status)).length;
  const completed = list.filter((a) => a.status === ASSIGNMENT_STATUS.COMPLETED).length;
  const overdue = list.filter((a) => getDisplayStatus(a) === "overdue").length;
  return { totalAssignments, inProgress, pendingSubmissions, pendingReviews, completed, overdue };
}

// Groups assignments by test series so the Tracker table can show one
// row per series with roll-up counts (tests required/created/submitted/
// approved) alongside that series' own data from testSeriesMock.js.
export function groupAssignmentsBySeries(assignments) {
  const list = assignments || _snapshot();
  const bySeries = new Map();
  list.forEach((a) => {
    const key = a.seriesId || `new::${a.seriesName}`;
    if (!bySeries.has(key)) {
      bySeries.set(key, {
        seriesId: a.seriesId,
        seriesName: a.seriesName,
        subject: a.subject,
        educators: new Set(),
        assignments: [],
      });
    }
    const g = bySeries.get(key);
    g.educators.add(a.educatorName);
    g.assignments.push(a);
  });
  return Array.from(bySeries.values()).map((g) => {
    const total = g.assignments.length;
    const created = g.assignments.filter((a) => [ASSIGNMENT_STATUS.SUBMITTED, ASSIGNMENT_STATUS.UNDER_REVIEW, ASSIGNMENT_STATUS.REVISION_REQUESTED, ASSIGNMENT_STATUS.APPROVED, ASSIGNMENT_STATUS.COMPLETED].includes(a.status)).length;
    const submitted = created;
    const approved = g.assignments.filter((a) => [ASSIGNMENT_STATUS.APPROVED, ASSIGNMENT_STATUS.COMPLETED].includes(a.status)).length;
    const completionPct = total ? Math.round((approved / total) * 100) : 0;
    const deadlines = g.assignments.map((a) => a.deadline).sort();
    const nearestDeadline = deadlines[0];
    const anyOverdue = g.assignments.some((a) => getDisplayStatus(a) === "overdue");
    let overallStatus = "On Track";
    if (anyOverdue) overallStatus = "Overdue";
    else if (completionPct === 100 && total > 0) overallStatus = "Complete";
    else if (g.assignments.some((a) => a.status === ASSIGNMENT_STATUS.REVISION_REQUESTED)) overallStatus = "Needs Revision";
    return {
      seriesId: g.seriesId,
      seriesName: g.seriesName,
      subject: g.subject,
      educators: Array.from(g.educators),
      totalTestsRequired: total,
      testsCreated: created,
      testsSubmitted: submitted,
      testsApproved: approved,
      completionPct,
      deadline: nearestDeadline,
      overallStatus,
      assignments: g.assignments,
    };
  });
}

// ---------- Incoming test series requests (Review & Approval) ----------
// A "request" is a test series / test paper that has been SENT to the admin
// (by a content partner, institution, or the academic team) and is waiting
// for a decision: assign an educator to build it, or reject it. It is the
// step BEFORE an assignment exists, so it is a small separate queue; the
// moment the admin assigns an educator, a real assignment record is created
// through createAssignment() — the single source of truth for assignment
// status/progress everywhere else (Assignment Management, Tracker) — and the
// request just keeps a link to it (assignmentId). Assigning also writes the
// (mock) educator notification via the same log as every other assignment
// event; see MOCK_NOTICE — nothing is actually emailed/pushed.

export const REQUEST_STATUS = { PENDING: "pending", ASSIGNED: "assigned", REJECTED: "rejected" };
export const REQUEST_STATUS_LABEL = { pending: "Pending", assigned: "Assigned", rejected: "Rejected" };
export const REQUEST_STATUS_BADGE_CLASS = { pending: "is-pending", assigned: "is-approved", rejected: "is-rejected" };

function buildRequest({
  seriesId, seriesName, subject, topics, testName, sentBy, sentDate, questionCount,
  questionTypeMix, difficulty, totalMarks, duration, instructions, requestedDeadline, status,
  decisionAt, decisionReason, assignmentId,
}) {
  return {
    id: nextId("REQ"),
    seriesId: seriesId || null,
    seriesName,
    subject,
    topics: topics || [],
    testName,
    sentBy,
    sentDate: sentDate || daysAgo(0),
    questionCount: questionCount ?? 20,
    questionTypeMix: questionTypeMix || QUESTION_TYPE_MIX.MIXED,
    difficulty: difficulty || "Medium",
    totalMarks: totalMarks ?? 50,
    duration: duration ?? 60,
    instructions: instructions || "",
    requestedDeadline: requestedDeadline || daysFromNow(14),
    status: status || REQUEST_STATUS.PENDING,
    decisionAt: decisionAt || null,
    decisionReason: decisionReason || "",
    assignmentId: assignmentId || null,
  };
}

let _requests = [
  buildRequest({
    seriesId: "TS-1001", seriesName: "JEE Main Physics Test Series 2026", subject: "Physics",
    testName: "Physics Full Mock Test 3 — Optics & Modern Physics", sentBy: "Academic Content Team", sentDate: daysAgo(1),
    questionCount: 30, questionTypeMix: QUESTION_TYPE_MIX.MIXED, difficulty: "Hard", totalMarks: 100, duration: 90,
    instructions: "Cover ray & wave optics and modern physics. Include 3 subjective derivations.",
    requestedDeadline: daysFromNow(12),
  }),
  buildRequest({
    seriesId: "TS-1003", seriesName: "NEET Biology Crash Course Series", subject: "Biology",
    testName: "Diagnostic Test — Plant Physiology", sentBy: "Vidya Institute (Partner)", sentDate: daysAgo(2),
    questionCount: 25, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Medium", totalMarks: 50, duration: 45,
    instructions: "NCERT-aligned. Include 2 assertion-reason questions.",
    requestedDeadline: daysFromNow(10),
  }),
  buildRequest({
    seriesId: null, seriesName: "UPSC Prelims GS Mock Series", subject: "General Studies", topics: ["Polity", "Economy"],
    testName: "GS Paper 1 — Polity & Economy Mock 1", sentBy: "Academic Content Team", sentDate: daysAgo(3),
    questionCount: 40, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Hard", totalMarks: 80, duration: 60,
    instructions: "New series. Match UPSC Prelims pattern with negative marking.",
    requestedDeadline: daysFromNow(21),
  }),
  buildRequest({
    seriesId: "TS-1005", seriesName: "English Proficiency Test Series", subject: "English",
    testName: "Reading Comprehension Test 1", sentBy: "Vidya Institute (Partner)", sentDate: daysAgo(4),
    questionCount: 20, questionTypeMix: QUESTION_TYPE_MIX.MIXED, difficulty: "Medium", totalMarks: 40, duration: 40,
    instructions: "4 passages, mix of MCQ and short-answer.",
    requestedDeadline: daysFromNow(8),
  }),
  buildRequest({
    seriesId: "TS-1002", seriesName: "Class 10 Mathematics Weekly Series", subject: "Mathematics",
    testName: "Weekly Test 5 — Mensuration", sentBy: "Unverified Submitter", sentDate: daysAgo(9),
    questionCount: 15, questionTypeMix: QUESTION_TYPE_MIX.OBJECTIVE, difficulty: "Easy", totalMarks: 15, duration: 20,
    instructions: "",
    status: REQUEST_STATUS.REJECTED, decisionAt: daysAgo(8),
    decisionReason: "Out of scope for the current term plan; resubmit with a syllabus outline.",
  }),
];
const _reqListeners = new Set();
function _emitReq() {
  _reqListeners.forEach((fn) => fn());
}
function _subscribeReq(fn) {
  _reqListeners.add(fn);
  return () => _reqListeners.delete(fn);
}
export function useSeriesRequests() {
  return useSyncExternalStore(_subscribeReq, () => _requests);
}

// Approve the request by assigning an educator: creates the assignment (which
// logs the mock "New test assignment" notification to that educator).
export function assignRequest(id, { educatorId, deadline, note }) {
  const req = _requests.find((r) => r.id === id);
  if (!req || req.status !== REQUEST_STATUS.PENDING) return null;
  const assignment = createAssignment({
    seriesId: req.seriesId,
    seriesName: req.seriesName,
    subject: req.subject,
    topics: req.topics,
    educatorId,
    testName: req.testName,
    questionCount: req.questionCount,
    questionTypeMix: req.questionTypeMix,
    difficulty: req.difficulty,
    totalMarks: req.totalMarks,
    duration: req.duration,
    instructions: [req.instructions, note].filter(Boolean).join("\n\n"),
    deadline,
  });
  _requests = _requests.map((r) =>
    r.id === id ? { ...r, status: REQUEST_STATUS.ASSIGNED, decisionAt: daysAgo(0), assignmentId: assignment.id } : r
  );
  _emitReq();
  return assignment;
}

export function rejectRequest(id, reason) {
  _requests = _requests.map((r) =>
    r.id === id && r.status === REQUEST_STATUS.PENDING
      ? { ...r, status: REQUEST_STATUS.REJECTED, decisionAt: daysAgo(0), decisionReason: reason || "" }
      : r
  );
  _emitReq();
}
