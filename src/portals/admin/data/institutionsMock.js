// Institution & Organization Management — mock data.
// Jira: Day 5 — Institution management + details view
//       Day 6 — Region/branch hierarchy + staff assignment
// See RegionBranchHierarchy.jsx and staffAssignmentsMock.js for the full
// Region/Branch Hierarchy + Staff Assignment feature this file backs.
//
// Institutions are represented as organizations which can contain a
// hierarchy of organizational units (regions/branches, nested via
// parentId). `staffIds` on a unit is a lightweight, always-in-sync roster
// cache (kept current by staffAssignmentsMock.js's richer assignment
// records) so the Hierarchy tab can show "who's here" without importing
// the assignments store — the assignments store is the source of truth
// for role/department/subjects/dates/history, this is just the roster.
//
// UI-only placeholder data; replace with real calls through
// ../services/adminApi.js once the institution-management endpoints
// exist. Follows the same tiny pub/sub "store" pattern already used by
// data/studentsMock.js / data/educatorsMock.js / data/coursesMock.js.

import { useSyncExternalStore } from "react";

export const INSTITUTION_TYPE = {
  SCHOOL: "School",
  REGIONAL_BODY: "Regional Education Body",
  COACHING: "Coaching Institute",
};

export const INSTITUTION_TYPE_OPTIONS = [
  INSTITUTION_TYPE.SCHOOL,
  INSTITUTION_TYPE.REGIONAL_BODY,
  INSTITUTION_TYPE.COACHING,
];

export const INSTITUTION_STATUS = {
  ACTIVE: "active",
  PENDING: "pending",
  SUSPENDED: "suspended",
};

export const INSTITUTION_STATUS_LABEL = {
  [INSTITUTION_STATUS.ACTIVE]: "Active",
  [INSTITUTION_STATUS.PENDING]: "Pending Setup",
  [INSTITUTION_STATUS.SUSPENDED]: "Suspended",
};

export const INSTITUTION_STATUS_BADGE_CLASS = {
  [INSTITUTION_STATUS.ACTIVE]: "is-account-active",
  [INSTITUTION_STATUS.PENDING]: "is-pending",
  [INSTITUTION_STATUS.SUSPENDED]: "is-account-suspended",
};

export const ORG_UNIT_TYPE = {
  REGION: "Region",
  BRANCH: "Branch",
};

function initialsOf(name) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

const SEED_INSTITUTIONS = [
  {
    id: "INS-3001",
    name: "Greenwood International School",
    type: INSTITUTION_TYPE.SCHOOL,
    contactPerson: "Rina Kapoor",
    contactRole: "Principal",
    email: "admin@greenwoodintl.edu.in",
    phone: "+91 98450 22110",
    city: "Bengaluru",
    state: "Karnataka",
    onboardedDate: "Mar 4, 2026",
    status: INSTITUTION_STATUS.ACTIVE,
    orgUnits: [
      { id: "OU-1", parentId: null, name: "Greenwood — Whitefield Campus", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Meera Iyer", educators: 18, students: 412, classesCount: 16, targetStaff: 20, staffIds: ["EDU-1001", "EDU-1005"] },
      { id: "OU-2", parentId: null, name: "Greenwood — Koramangala Campus", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Sanjay Rao", educators: 14, students: 358, classesCount: 13, targetStaff: 16, staffIds: ["EDU-1008"] },
    ],
  },
  {
    id: "INS-3002",
    name: "Deccan Regional Education Trust",
    type: INSTITUTION_TYPE.REGIONAL_BODY,
    contactPerson: "Arvind Deshmukh",
    contactRole: "Regional Director",
    email: "office@deccantrust.org",
    phone: "+91 98220 55871",
    city: "Pune",
    state: "Maharashtra",
    onboardedDate: "Jan 18, 2026",
    status: INSTITUTION_STATUS.ACTIVE,
    orgUnits: [
      { id: "OU-3", parentId: null, name: "Pune Metro Region", type: ORG_UNIT_TYPE.REGION, headTeacher: "Kavita Joshi", educators: 46, students: 1180, classesCount: 4, targetStaff: 6, staffIds: ["EDU-1006"] },
      { id: "OU-12", parentId: "OU-3", name: "Pune Metro — Baner Branch", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Nitin Kulkarni", educators: 16, students: 402, classesCount: 14, targetStaff: 18, staffIds: ["EDU-1009"] },
      { id: "OU-13", parentId: "OU-3", name: "Pune Metro — Hinjewadi Branch", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Shalini Deshpande", educators: 12, students: 318, classesCount: 11, targetStaff: 14, staffIds: [] },
      { id: "OU-4", parentId: null, name: "Nashik Region", type: ORG_UNIT_TYPE.REGION, headTeacher: "Ramesh Patil", educators: 21, students: 540, classesCount: 3, targetStaff: 4, staffIds: [] },
      { id: "OU-14", parentId: "OU-4", name: "Nashik — City Centre Branch", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Not yet assigned", educators: 0, students: 0, classesCount: 8, targetStaff: 10, staffIds: [] },
      { id: "OU-5", parentId: null, name: "Kolhapur Region", type: ORG_UNIT_TYPE.REGION, headTeacher: "Sunita Bhosale", educators: 15, students: 402, classesCount: 2, targetStaff: 3, staffIds: [] },
    ],
  },
  {
    id: "INS-3003",
    name: "Nova Achievers Coaching Centre",
    type: INSTITUTION_TYPE.COACHING,
    contactPerson: "Vikram Malhotra",
    contactRole: "Centre Head",
    email: "contact@novaachievers.in",
    phone: "+91 90120 33445",
    city: "Delhi",
    state: "Delhi",
    onboardedDate: "Jun 21, 2026",
    status: INSTITUTION_STATUS.PENDING,
    orgUnits: [
      { id: "OU-6", parentId: null, name: "Nova Achievers — Rajouri Garden Centre", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Not yet assigned", educators: 0, students: 0, classesCount: 6, targetStaff: 8, staffIds: [] },
    ],
  },
  {
    id: "INS-3004",
    name: "Sunrise Public School",
    type: INSTITUTION_TYPE.SCHOOL,
    contactPerson: "Farah Sheikh",
    contactRole: "Vice Principal",
    email: "admin@sunrisepublic.edu.in",
    phone: "+91 63740 11982",
    city: "Hyderabad",
    state: "Telangana",
    onboardedDate: "Feb 27, 2026",
    status: INSTITUTION_STATUS.ACTIVE,
    orgUnits: [
      { id: "OU-7", parentId: null, name: "Sunrise — Gachibowli Campus", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Divya Reddy", educators: 22, students: 540, classesCount: 19, targetStaff: 24, staffIds: ["EDU-1010", "EDU-1012"] },
    ],
  },
  {
    id: "INS-3005",
    name: "Eastern Frontier School Group",
    type: INSTITUTION_TYPE.REGIONAL_BODY,
    contactPerson: "Bidisha Sen",
    contactRole: "Group Administrator",
    email: "info@easternfrontier.org",
    phone: "+91 98300 77621",
    city: "Kolkata",
    state: "West Bengal",
    onboardedDate: "Nov 9, 2025",
    status: INSTITUTION_STATUS.SUSPENDED,
    suspendedDate: "Jul 30, 2026",
    suspendedReason: "Outstanding platform fee dues beyond the grace period — access paused pending finance-team resolution.",
    orgUnits: [
      { id: "OU-8", parentId: null, name: "Kolkata North Branch", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Debashish Ghosh", educators: 12, students: 296, classesCount: 10, targetStaff: 13, staffIds: [] },
      { id: "OU-9", parentId: null, name: "Kolkata South Branch", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Anita Chatterjee", educators: 10, students: 244, classesCount: 9, targetStaff: 12, staffIds: [] },
    ],
  },
  {
    id: "INS-3006",
    name: "Coastal Coaching Academy",
    type: INSTITUTION_TYPE.COACHING,
    contactPerson: "Sameer Nair",
    contactRole: "Founder",
    email: "hello@coastalacademy.in",
    phone: "+91 94950 66210",
    city: "Kochi",
    state: "Kerala",
    onboardedDate: "May 15, 2026",
    status: INSTITUTION_STATUS.ACTIVE,
    orgUnits: [
      { id: "OU-10", parentId: null, name: "Coastal — Kakkanad Centre", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Lekshmi Menon", educators: 9, students: 187, classesCount: 8, targetStaff: 10, staffIds: ["EDU-1011"] },
      { id: "OU-11", parentId: null, name: "Coastal — Edappally Centre", type: ORG_UNIT_TYPE.BRANCH, headTeacher: "Thomas Varghese", educators: 7, students: 152, classesCount: 6, targetStaff: 8, staffIds: [] },
    ],
  },
];

// totalBranches/totalEducators/totalStudents on the institution roll up
// only TOP-LEVEL units (parentId === null) — a region's own educators/
// students figure already represents everything under it, so nested
// branch children are shown there for structure/staffing detail without
// double-counting the institution-level totals shown in Institution
// Management.
function withTotals(inst) {
  const topLevel = inst.orgUnits.filter((u) => !u.parentId);
  return {
    ...inst,
    initials: initialsOf(inst.name),
    totalBranches: topLevel.length,
    totalEducators: topLevel.reduce((sum, u) => sum + u.educators, 0),
    totalStudents: topLevel.reduce((sum, u) => sum + u.students, 0),
  };
}

// ---------- tiny pub/sub store (same pattern as studentsMock.js) ----------
let institutions = SEED_INSTITUTIONS.map(withTotals);
const listeners = new Set();

function emit() {
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return institutions;
}

export function useInstitutions() {
  return useSyncExternalStore(subscribe, getSnapshot);
}

export function useInstitution(id) {
  const all = useInstitutions();
  return all.find((i) => i.id === id) || null;
}

// Non-hook accessor for the current institutions snapshot — used by
// staffAssignmentsMock.js, which is not a React component but needs to
// read/derive across units (e.g. to compute institution-wide unassigned
// staff) without importing React hooks.
export function getInstitutionsSnapshot() {
  return institutions;
}

let nextIdSeq = 3007;
let nextOrgUnitSeq = 15;

export function onboardInstitution(input) {
  const id = `INS-${nextIdSeq}`;
  nextIdSeq += 1;
  const newInstitution = withTotals({
    id,
    name: input.name.trim(),
    type: input.type,
    contactPerson: input.contactPerson.trim(),
    contactRole: input.contactRole?.trim() || "Administrator",
    email: input.email.trim(),
    phone: input.phone.trim(),
    city: input.city.trim(),
    state: input.state.trim(),
    onboardedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
    status: INSTITUTION_STATUS.PENDING,
    orgUnits: [],
  });
  institutions = [newInstitution, ...institutions];
  emit();
  return newInstitution;
}

export function updateInstitution(id, input) {
  institutions = institutions.map((inst) =>
    inst.id === id
      ? withTotals({
          ...inst,
          name: input.name.trim(),
          type: input.type,
          contactPerson: input.contactPerson.trim(),
          contactRole: input.contactRole?.trim() || inst.contactRole,
          email: input.email.trim(),
          phone: input.phone.trim(),
          city: input.city.trim(),
          state: input.state.trim(),
        })
      : inst
  );
  emit();
}

export function suspendInstitution(id, reason) {
  institutions = institutions.map((inst) =>
    inst.id === id
      ? {
          ...inst,
          status: INSTITUTION_STATUS.SUSPENDED,
          suspendedReason: reason,
          suspendedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        }
      : inst
  );
  emit();
}

export function activateInstitution(id) {
  institutions = institutions.map((inst) =>
    inst.id === id
      ? { ...inst, status: INSTITUTION_STATUS.ACTIVE, suspendedReason: undefined, suspendedDate: undefined }
      : inst
  );
  emit();
}

// ---------- Region / Branch Hierarchy + Staff Assignment (Day 6) ----------

export function addOrgUnit(institutionId, input) {
  const id = `OU-${nextOrgUnitSeq}`;
  nextOrgUnitSeq += 1;
  const newUnit = {
    id,
    parentId: input.parentId || null,
    name: input.name.trim(),
    type: input.type,
    headTeacher: input.headTeacher?.trim() || "Not yet assigned",
    educators: 0,
    students: 0,
    classesCount: input.classesCount ?? 0,
    targetStaff: input.targetStaff ?? (input.type === ORG_UNIT_TYPE.REGION ? 4 : 8),
    staffIds: [],
  };
  institutions = institutions.map((inst) =>
    inst.id === institutionId ? withTotals({ ...inst, orgUnits: [...inst.orgUnits, newUnit] }) : inst
  );
  emit();
  return newUnit;
}

export function updateOrgUnit(institutionId, orgUnitId, input) {
  institutions = institutions.map((inst) => {
    if (inst.id !== institutionId) return inst;
    return withTotals({
      ...inst,
      orgUnits: inst.orgUnits.map((u) =>
        u.id === orgUnitId
          ? { ...u, name: input.name.trim(), type: input.type, headTeacher: input.headTeacher?.trim() || "Not yet assigned" }
          : u
      ),
    });
  });
  emit();
}

// Removes a unit and cascades to any children nested under it (a Region's
// Branches) — deleting a Region deletes what's inside it too.
export function removeOrgUnit(institutionId, orgUnitId) {
  institutions = institutions.map((inst) => {
    if (inst.id !== institutionId) return inst;
    const idsToRemove = new Set([orgUnitId]);
    let changed = true;
    while (changed) {
      changed = false;
      inst.orgUnits.forEach((u) => {
        if (u.parentId && idsToRemove.has(u.parentId) && !idsToRemove.has(u.id)) {
          idsToRemove.add(u.id);
          changed = true;
        }
      });
    }
    return withTotals({ ...inst, orgUnits: inst.orgUnits.filter((u) => !idsToRemove.has(u.id)) });
  });
  emit();
}

// Roster-cache mutators — kept in sync by staffAssignmentsMock.js on
// every create/transfer/end so the Hierarchy tab's "who's here" list
// never has to read the assignments store directly.
export function assignStaffToUnit(institutionId, orgUnitId, educatorId) {
  institutions = institutions.map((inst) => {
    if (inst.id !== institutionId) return inst;
    return withTotals({
      ...inst,
      orgUnits: inst.orgUnits.map((u) =>
        u.id === orgUnitId && !u.staffIds.includes(educatorId) ? { ...u, staffIds: [...u.staffIds, educatorId] } : u
      ),
    });
  });
  emit();
}

export function unassignStaffFromUnit(institutionId, orgUnitId, educatorId) {
  institutions = institutions.map((inst) => {
    if (inst.id !== institutionId) return inst;
    return withTotals({
      ...inst,
      orgUnits: inst.orgUnits.map((u) =>
        u.id === orgUnitId ? { ...u, staffIds: u.staffIds.filter((id) => id !== educatorId) } : u
      ),
    });
  });
  emit();
}
