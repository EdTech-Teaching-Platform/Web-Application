// Staff Assignment, Transfer, Requests & Audit History — mock data.
// Extends Day 6 (Region/branch hierarchy + staff assignment)
// with the richer workflow the Admin actually needs day to day: an
// assignment carries role/department/subjects/classes and a Primary/
// Secondary type and a date range (not just "this educator is at this
// branch"); a transfer ends the old assignment and opens a new one at
// the target branch with a reason and an effective date; every create/
// transfer/end/role-change is written to an immutable-style history
// list (audit-log pattern: actor + reason + timestamp,
// nothing edited or deleted in place); and a Head Teacher / Regional
// Head can submit an assignment-or-transfer request that an Admin
// approves (which performs the same create/transfer + history write)
// or rejects (which changes nothing but records why).
//
// This module is the source of truth for assignment detail; it calls
// back into institutionsMock.js's assignStaffToUnit/unassignStaffFromUnit
// so each org unit's lightweight staffIds roster (used by the Hierarchy
// tab) stays in sync automatically — nothing needs to update both stores
// by hand.
//
// UI-only placeholder data; replace with real calls through
// ../services/adminApi.js once the backend exists. Follows the same tiny
// pub/sub "store" pattern as the other data/*Mock.js files.

import { useSyncExternalStore } from "react";
import { assignStaffToUnit, unassignStaffFromUnit, getInstitutionsSnapshot } from "./institutionsMock";
import { getEducatorsSnapshot } from "./educatorsMock";

export const ASSIGNMENT_TYPE = {
  PRIMARY: "Primary",
  SECONDARY: "Secondary",
};

export const ASSIGNMENT_STATUS = {
  ACTIVE: "active",
  ENDED: "ended",
};

export const REQUEST_TYPE = {
  ASSIGNMENT: "Assignment",
  TRANSFER: "Transfer",
};

export const REQUEST_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const REQUEST_STATUS_LABEL = {
  [REQUEST_STATUS.PENDING]: "Pending",
  [REQUEST_STATUS.APPROVED]: "Approved",
  [REQUEST_STATUS.REJECTED]: "Rejected",
};

// Pending -> reuses the same amber "is-pending" token as everywhere else
// in the Admin console; Approved/Rejected reuse the verification-queue
// approve/reject tokens (is-approved / is-rejected) from
// EducatorVerification.css — no new colors introduced.
export const REQUEST_STATUS_BADGE_CLASS = {
  [REQUEST_STATUS.PENDING]: "is-pending",
  [REQUEST_STATUS.APPROVED]: "is-approved",
  [REQUEST_STATUS.REJECTED]: "is-rejected",
};

export const HISTORY_ACTION = {
  ASSIGNED: "Assigned",
  TRANSFERRED: "Transferred",
  REMOVED: "Removed",
  ROLE_CHANGED: "Role Changed",
};

export const ROLE_OPTIONS = [
  "Subject Teacher",
  "Head Teacher",
  "Coordinator",
  "Lab Instructor",
  "Counselor",
  "Sports Instructor",
];

export const DEPARTMENT_OPTIONS = [
  "Mathematics",
  "Science",
  "English",
  "Social Studies",
  "Computer Science",
  "Languages",
  "Arts & Sports",
  "Administration",
];

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
function nowISO() {
  return new Date().toISOString();
}

// ---------- seed assignments (a realistic slice, cross-referencing the
// same staffIds already seeded on institutionsMock.js's org units so
// both stores agree from the start) ----------
const SEED_ASSIGNMENTS = [
  { id: "ASG-1", educatorId: "EDU-1001", institutionId: "INS-3001", orgUnitId: "OU-1", department: "Computer Science", role: "Subject Teacher", subjects: ["Data Structures", "Computer Science"], classesSections: ["Grade 11-A", "Grade 12-B"], startDate: "2024-11-05", endDate: null, assignmentType: ASSIGNMENT_TYPE.PRIMARY, status: ASSIGNMENT_STATUS.ACTIVE },
  { id: "ASG-2", educatorId: "EDU-1005", institutionId: "INS-3001", orgUnitId: "OU-1", department: "Mathematics", role: "Subject Teacher", subjects: ["Mathematics"], classesSections: ["Grade 9-A"], startDate: "2023-02-20", endDate: null, assignmentType: ASSIGNMENT_TYPE.SECONDARY, status: ASSIGNMENT_STATUS.ACTIVE },
  { id: "ASG-3", educatorId: "EDU-1008", institutionId: "INS-3001", orgUnitId: "OU-2", department: "Science", role: "Subject Teacher", subjects: ["Chemistry", "Biology"], classesSections: ["Grade 10-A", "Grade 10-B"], startDate: "2024-03-30", endDate: null, assignmentType: ASSIGNMENT_TYPE.PRIMARY, status: ASSIGNMENT_STATUS.ACTIVE },
  { id: "ASG-4", educatorId: "EDU-1006", institutionId: "INS-3002", orgUnitId: "OU-3", department: "Administration", role: "Head Teacher", subjects: ["World History"], classesSections: [], startDate: "2023-06-15", endDate: null, assignmentType: ASSIGNMENT_TYPE.PRIMARY, status: ASSIGNMENT_STATUS.ACTIVE },
  { id: "ASG-5", educatorId: "EDU-1009", institutionId: "INS-3002", orgUnitId: "OU-12", department: "Mathematics", role: "Subject Teacher", subjects: ["Mathematics", "Physics"], classesSections: ["Grade 9-A", "Grade 9-B"], startDate: "2023-10-12", endDate: null, assignmentType: ASSIGNMENT_TYPE.PRIMARY, status: ASSIGNMENT_STATUS.ACTIVE },
  { id: "ASG-6", educatorId: "EDU-1010", institutionId: "INS-3004", orgUnitId: "OU-7", department: "English", role: "Subject Teacher", subjects: ["English Literature"], classesSections: ["Grade 11-A"], startDate: "2022-09-18", endDate: null, assignmentType: ASSIGNMENT_TYPE.PRIMARY, status: ASSIGNMENT_STATUS.ACTIVE },
  { id: "ASG-7", educatorId: "EDU-1012", institutionId: "INS-3004", orgUnitId: "OU-7", department: "Science", role: "Lab Instructor", subjects: ["Biology", "Chemistry"], classesSections: ["Grade 10-A"], startDate: "2024-07-25", endDate: null, assignmentType: ASSIGNMENT_TYPE.SECONDARY, status: ASSIGNMENT_STATUS.ACTIVE },
  { id: "ASG-8", educatorId: "EDU-1011", institutionId: "INS-3006", orgUnitId: "OU-10", department: "Social Studies", role: "Subject Teacher", subjects: ["Economics"], classesSections: ["Batch A"], startDate: "2023-12-05", endDate: null, assignmentType: ASSIGNMENT_TYPE.PRIMARY, status: ASSIGNMENT_STATUS.ACTIVE },
  // An ended assignment + its "Removed" history row, so History has more
  // than one action type out of the box.
  { id: "ASG-9", educatorId: "EDU-1011", institutionId: "INS-3006", orgUnitId: "OU-11", department: "Social Studies", role: "Subject Teacher", subjects: ["Economics"], classesSections: ["Batch B"], startDate: "2023-01-10", endDate: "2026-05-01", assignmentType: ASSIGNMENT_TYPE.SECONDARY, status: ASSIGNMENT_STATUS.ENDED },
];

const SEED_HISTORY = [
  { id: "HIST-1", educatorId: "EDU-1011", institutionId: "INS-3006", previousOrgUnitId: null, newOrgUnitId: "OU-11", action: HISTORY_ACTION.ASSIGNED, timestamp: "2023-01-10T09:00:00.000Z", performedBy: "Admin User", reason: "Initial onboarding assignment." },
  { id: "HIST-2", educatorId: "EDU-1011", institutionId: "INS-3006", previousOrgUnitId: "OU-11", newOrgUnitId: null, action: HISTORY_ACTION.REMOVED, timestamp: "2026-05-01T10:30:00.000Z", performedBy: "Admin User", reason: "Reduced course load at Edappally; consolidated to Kakkanad." },
  { id: "HIST-3", educatorId: "EDU-1011", institutionId: "INS-3006", previousOrgUnitId: null, newOrgUnitId: "OU-10", action: HISTORY_ACTION.ASSIGNED, timestamp: "2023-12-05T09:00:00.000Z", performedBy: "Admin User", reason: "Primary assignment at Kakkanad Centre." },
  { id: "HIST-4", educatorId: "EDU-1009", institutionId: "INS-3002", previousOrgUnitId: "OU-13", newOrgUnitId: "OU-12", action: HISTORY_ACTION.TRANSFERRED, timestamp: "2023-10-12T09:00:00.000Z", performedBy: "Kavita Joshi", reason: "Consolidating Math faculty at Baner Branch." },
];

const SEED_REQUESTS = [
  { id: "REQ-1", educatorId: "EDU-1013", institutionId: "INS-3001", currentOrgUnitId: null, requestedOrgUnitId: "OU-2", requestType: REQUEST_TYPE.ASSIGNMENT, role: "Subject Teacher", date: "2026-09-25", requestedBy: "Sanjay Rao", reason: "Koramangala Campus needs a second Economics/Marketing teacher for the new elective batch.", status: REQUEST_STATUS.PENDING, decisionReason: null, decidedBy: null, decidedAt: null },
  { id: "REQ-2", educatorId: "EDU-1005", institutionId: "INS-3001", currentOrgUnitId: "OU-1", requestedOrgUnitId: "OU-2", requestType: REQUEST_TYPE.TRANSFER, role: "Subject Teacher", date: "2026-10-01", requestedBy: "Meera Iyer", reason: "Requested move closer to home campus; Koramangala has an open Math slot.", status: REQUEST_STATUS.PENDING, decisionReason: null, decidedBy: null, decidedAt: null },
  { id: "REQ-3", educatorId: "EDU-1006", institutionId: "INS-3002", currentOrgUnitId: "OU-3", requestedOrgUnitId: "OU-4", requestType: REQUEST_TYPE.TRANSFER, role: "Head Teacher", date: "2026-08-20", requestedBy: "Arvind Deshmukh", reason: "Temporary cover for Nashik Region while a permanent Head Teacher is hired.", status: REQUEST_STATUS.REJECTED, decisionReason: "Kavita's Pune Metro workload doesn't allow a dual-region assignment right now — hire a dedicated Nashik Head Teacher instead.", decidedBy: "Admin User", decidedAt: "2026-08-22T11:00:00.000Z" },
];

let assignments = SEED_ASSIGNMENTS;
let history = SEED_HISTORY;
let requests = SEED_REQUESTS;
const listeners = new Set();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAssignments() {
  return useSyncExternalStore(subscribe, () => assignments);
}
export function useAssignmentHistory() {
  return useSyncExternalStore(subscribe, () => history);
}
export function useStaffRequests() {
  return useSyncExternalStore(subscribe, () => requests);
}

let nextAssignmentSeq = 10;
let nextHistorySeq = 5;
let nextRequestSeq = 4;

function addHistoryEntry(entry) {
  history = [{ id: `HIST-${nextHistorySeq}`, timestamp: nowISO(), ...entry }, ...history];
  nextHistorySeq += 1;
}

// An educator can hold more than one ACTIVE assignment overall (Primary
// at one branch, Secondary at another) but never two at the SAME unit —
// that's the duplicate this checks for.
export function hasActiveAssignment(educatorId, orgUnitId) {
  return assignments.some((a) => a.educatorId === educatorId && a.orgUnitId === orgUnitId && a.status === ASSIGNMENT_STATUS.ACTIVE);
}

export function activeAssignmentsForEducator(educatorId) {
  return assignments.filter((a) => a.educatorId === educatorId && a.status === ASSIGNMENT_STATUS.ACTIVE);
}

// Creates a new assignment. Returns { success, error?, assignment? } so
// the UI can show an inline duplicate/validation error instead of
// throwing. Keeps institutionsMock.js's staffIds roster in sync.
export function createAssignment(input) {
  const { educatorId, institutionId, orgUnitId } = input;
  if (hasActiveAssignment(educatorId, orgUnitId)) {
    return { success: false, error: "This staff member already has an active assignment at this branch." };
  }
  const assignment = {
    id: `ASG-${nextAssignmentSeq}`,
    educatorId,
    institutionId,
    orgUnitId,
    department: input.department || DEPARTMENT_OPTIONS[0],
    role: input.role || ROLE_OPTIONS[0],
    subjects: input.subjects || [],
    classesSections: input.classesSections || [],
    startDate: input.startDate || todayISO(),
    endDate: null,
    assignmentType: input.assignmentType || ASSIGNMENT_TYPE.PRIMARY,
    status: ASSIGNMENT_STATUS.ACTIVE,
  };
  nextAssignmentSeq += 1;
  assignments = [assignment, ...assignments];
  assignStaffToUnit(institutionId, orgUnitId, educatorId);
  addHistoryEntry({
    educatorId,
    institutionId,
    previousOrgUnitId: null,
    newOrgUnitId: orgUnitId,
    action: HISTORY_ACTION.ASSIGNED,
    performedBy: input.performedBy || "Admin User",
    reason: input.reason || "New staff assignment.",
  });
  emit();
  return { success: true, assignment };
}

// Ends the assignment at its current branch and opens a new one at
// newOrgUnitId, carrying over role/department/subjects/classes/type.
export function transferAssignment(input) {
  const { assignmentId, newOrgUnitId, effectiveDate, reason, performedBy } = input;
  const current = assignments.find((a) => a.id === assignmentId);
  if (!current) return { success: false, error: "Assignment not found." };
  if (current.orgUnitId === newOrgUnitId) {
    return { success: false, error: "New branch must be different from the current branch." };
  }
  if (hasActiveAssignment(current.educatorId, newOrgUnitId)) {
    return { success: false, error: "This staff member already has an active assignment at the destination branch." };
  }
  const effective = effectiveDate || todayISO();
  assignments = assignments.map((a) => (a.id === assignmentId ? { ...a, status: ASSIGNMENT_STATUS.ENDED, endDate: effective } : a));
  const newAssignment = {
    id: `ASG-${nextAssignmentSeq}`,
    educatorId: current.educatorId,
    institutionId: current.institutionId,
    orgUnitId: newOrgUnitId,
    department: current.department,
    role: current.role,
    subjects: current.subjects,
    classesSections: current.classesSections,
    startDate: effective,
    endDate: null,
    assignmentType: current.assignmentType,
    status: ASSIGNMENT_STATUS.ACTIVE,
  };
  nextAssignmentSeq += 1;
  assignments = [newAssignment, ...assignments];
  unassignStaffFromUnit(current.institutionId, current.orgUnitId, current.educatorId);
  assignStaffToUnit(current.institutionId, newOrgUnitId, current.educatorId);
  addHistoryEntry({
    educatorId: current.educatorId,
    institutionId: current.institutionId,
    previousOrgUnitId: current.orgUnitId,
    newOrgUnitId,
    action: HISTORY_ACTION.TRANSFERRED,
    performedBy: performedBy || "Admin User",
    reason: reason || "Staff transfer.",
  });
  emit();
  return { success: true, assignment: newAssignment };
}

export function endAssignment(input) {
  const { assignmentId, reason, performedBy } = input;
  const current = assignments.find((a) => a.id === assignmentId);
  if (!current) return { success: false, error: "Assignment not found." };
  assignments = assignments.map((a) => (a.id === assignmentId ? { ...a, status: ASSIGNMENT_STATUS.ENDED, endDate: todayISO() } : a));
  unassignStaffFromUnit(current.institutionId, current.orgUnitId, current.educatorId);
  addHistoryEntry({
    educatorId: current.educatorId,
    institutionId: current.institutionId,
    previousOrgUnitId: current.orgUnitId,
    newOrgUnitId: null,
    action: HISTORY_ACTION.REMOVED,
    performedBy: performedBy || "Admin User",
    reason: reason || "Assignment ended.",
  });
  emit();
  return { success: true };
}

export function updateAssignmentRole(input) {
  const { assignmentId, patch, reason, performedBy } = input;
  const current = assignments.find((a) => a.id === assignmentId);
  if (!current) return { success: false, error: "Assignment not found." };
  assignments = assignments.map((a) => (a.id === assignmentId ? { ...a, ...patch } : a));
  addHistoryEntry({
    educatorId: current.educatorId,
    institutionId: current.institutionId,
    previousOrgUnitId: current.orgUnitId,
    newOrgUnitId: current.orgUnitId,
    action: HISTORY_ACTION.ROLE_CHANGED,
    performedBy: performedBy || "Admin User",
    reason: reason || "Role/department updated.",
  });
  emit();
  return { success: true };
}

// ---------- Assignment / Transfer Requests ----------

export function createRequest(input) {
  const request = {
    id: `REQ-${nextRequestSeq}`,
    educatorId: input.educatorId,
    institutionId: input.institutionId,
    currentOrgUnitId: input.currentOrgUnitId || null,
    requestedOrgUnitId: input.requestedOrgUnitId,
    requestType: input.requestType,
    role: input.role || ROLE_OPTIONS[0],
    date: input.date || todayISO(),
    requestedBy: input.requestedBy || "Admin User",
    reason: input.reason || "",
    status: REQUEST_STATUS.PENDING,
    decisionReason: null,
    decidedBy: null,
    decidedAt: null,
  };
  nextRequestSeq += 1;
  requests = [request, ...requests];
  emit();
  return request;
}

// Approving performs the underlying assignment/transfer, then marks the
// request Approved. Rejecting changes nothing about the assignment.
export function approveRequest(requestId, performedBy) {
  const request = requests.find((r) => r.id === requestId);
  if (!request || request.status !== REQUEST_STATUS.PENDING) return { success: false, error: "Request is no longer pending." };

  let result;
  if (request.requestType === REQUEST_TYPE.TRANSFER) {
    const current = activeAssignmentsForEducator(request.educatorId).find((a) => a.orgUnitId === request.currentOrgUnitId);
    if (!current) {
      return { success: false, error: "Staff member has no active assignment at the stated current branch to transfer." };
    }
    result = transferAssignment({
      assignmentId: current.id,
      newOrgUnitId: request.requestedOrgUnitId,
      effectiveDate: request.date,
      reason: request.reason,
      performedBy: performedBy || "Admin User",
    });
  } else {
    result = createAssignment({
      educatorId: request.educatorId,
      institutionId: request.institutionId,
      orgUnitId: request.requestedOrgUnitId,
      role: request.role,
      startDate: request.date,
      reason: request.reason,
      performedBy: performedBy || "Admin User",
    });
  }
  if (!result.success) return result;

  requests = requests.map((r) =>
    r.id === requestId ? { ...r, status: REQUEST_STATUS.APPROVED, decidedBy: performedBy || "Admin User", decidedAt: nowISO() } : r
  );
  emit();
  return { success: true };
}

export function rejectRequest(requestId, reason, performedBy) {
  requests = requests.map((r) =>
    r.id === requestId
      ? { ...r, status: REQUEST_STATUS.REJECTED, decisionReason: reason || "", decidedBy: performedBy || "Admin User", decidedAt: nowISO() }
      : r
  );
  emit();
  return { success: true };
}

// ---------- derived helpers (non-hook — combine with useX() in components) ----------

// Verified, active educators with zero ACTIVE assignments anywhere
// within the given institution's org units — the pool a Head Teacher /
// Admin can draw on before looking outside the institution.
export function getUnassignedEducators(institutionId) {
  const inst = getInstitutionsSnapshot().find((i) => i.id === institutionId);
  if (!inst) return [];
  const unitIds = new Set(inst.orgUnits.map((u) => u.id));
  const assignedIds = new Set(
    assignments.filter((a) => a.status === ASSIGNMENT_STATUS.ACTIVE && unitIds.has(a.orgUnitId)).map((a) => a.educatorId)
  );
  return getEducatorsSnapshot().filter(
    (e) => e.verificationStatus === "verified" && e.accountStatus === "active" && !assignedIds.has(e.id)
  );
}

// Per-branch metrics for the Staff Assignments tab. capacityPerStaff is
// the assumed max students one staff member can reasonably cover, used
// only to turn "students" and "total staff" into a workload percentage.
const CAPACITY_PER_STAFF = 30;

export function getBranchMetrics(institution) {
  return institution.orgUnits.map((unit) => {
    const totalStaff = assignments.filter((a) => a.orgUnitId === unit.id && a.status === ASSIGNMENT_STATUS.ACTIVE).length;
    const openPositions = Math.max(0, unit.targetStaff - totalStaff);
    const staffAllocationPct = unit.targetStaff > 0 ? Math.min(100, Math.round((totalStaff / unit.targetStaff) * 100)) : 0;
    const teacherWorkloadPct =
      totalStaff > 0 ? Math.min(100, Math.round((unit.students / (totalStaff * CAPACITY_PER_STAFF)) * 100)) : unit.students > 0 ? 100 : 0;
    return { unit, totalStaff, openPositions, staffAllocationPct, teacherWorkloadPct };
  });
}
