// User Management & Student Details — mock data.
// Jira: Day 4 — User management & student details
// User Management & Student Details — oversee student accounts. How It
// Works: Search, view, and act on student accounts. Expected Outcome:
// Operational control over the user base. Block Account — suspend
// a misbehaving account. Admin. How It Works: Suspend action on a user's
// account. Expected Outcome: Suspended account loses access regardless
// of valid credentials.
//
// UI-only placeholder data; replace with real calls through
// ../services/adminApi.js once the user-management endpoints exist. Shape
// (id/status/blockedReason/...) should carry over as-is. Follows the same
// tiny pub/sub "store" pattern already used by data/educatorsMock.js and
// data/coursesMock.js so UserManagement.jsx stays in sync across
// re-renders without a real API layer.

import { useSyncExternalStore } from "react";

export const STUDENT_STATUS = {
  ACTIVE: "active",
  BLOCKED: "blocked",
};

export const STUDENT_STATUS_LABEL = {
  [STUDENT_STATUS.ACTIVE]: "Active",
  [STUDENT_STATUS.BLOCKED]: "Blocked",
};

// Reuses the account-status badge classes EducatorVerification.css already
// defines (is-account-active / is-account-suspended) so a blocked student
// gets the same red treatment a suspended educator does, with no new CSS.
export const STUDENT_STATUS_BADGE_CLASS = {
  [STUDENT_STATUS.ACTIVE]: "is-account-active",
  [STUDENT_STATUS.BLOCKED]: "is-account-suspended",
};

export const GRADE_OPTIONS = [
  "Grade 6",
  "Grade 7",
  "Grade 8",
  "Grade 9",
  "Grade 10",
  "Grade 11",
  "Grade 12",
];

const SEED_STUDENTS = [
  {
    id: "STU-2001",
    name: "Aarav Sharma",
    initials: "AS",
    email: "aarav.sharma@example.com",
    phone: "+91 98200 11234",
    grade: "Grade 10",
    city: "Bengaluru, Karnataka",
    registeredDate: "Aug 2, 2026",
    lastActive: "Today",
    status: STUDENT_STATUS.ACTIVE,
    enrolledCourses: [
      { title: "Data Structures & Algorithms — Foundations", progress: 62 },
      { title: "Spoken English for Working Professionals", progress: 100 },
    ],
    blockedReason: null,
    blockedDate: null,
  },
  {
    id: "STU-2002",
    name: "Meera Iyer",
    initials: "MI",
    email: "meera.iyer@example.com",
    phone: "+91 98450 22991",
    grade: "Grade 9",
    city: "Chennai, Tamil Nadu",
    registeredDate: "Jul 28, 2026",
    lastActive: "Yesterday",
    status: STUDENT_STATUS.ACTIVE,
    enrolledCourses: [{ title: "Modern World History: 1900–Present", progress: 34 }],
    blockedReason: null,
    blockedDate: null,
  },
  {
    id: "STU-2003",
    name: "Kabir Malhotra",
    initials: "KM",
    email: "kabir.malhotra@example.com",
    phone: "+91 99110 44521",
    grade: "Grade 11",
    city: "Delhi",
    registeredDate: "Jun 14, 2026",
    lastActive: "3 days ago",
    status: STUDENT_STATUS.ACTIVE,
    enrolledCourses: [
      { title: "Applied Machine Learning for Developers", progress: 18 },
      { title: "Advanced Data Structures", progress: 45 },
    ],
    blockedReason: null,
    blockedDate: null,
  },
  {
    id: "STU-2004",
    name: "Ananya Reddy",
    initials: "AR",
    email: "ananya.reddy@example.com",
    phone: "+91 90000 78123",
    grade: "Grade 8",
    city: "Hyderabad, Telangana",
    registeredDate: "Sep 1, 2026",
    lastActive: "Today",
    status: STUDENT_STATUS.ACTIVE,
    enrolledCourses: [{ title: "Business Analytics with Excel & SQL", progress: 5 }],
    blockedReason: null,
    blockedDate: null,
  },
  {
    id: "STU-2005",
    name: "Ishaan Verma",
    initials: "IV",
    email: "ishaan.verma@example.com",
    phone: "+91 97170 33482",
    grade: "Grade 12",
    city: "Pune, Maharashtra",
    registeredDate: "Apr 9, 2026",
    lastActive: "2 weeks ago",
    status: STUDENT_STATUS.BLOCKED,
    enrolledCourses: [{ title: "Cryptocurrency Trading Masterclass", progress: 12 }],
    blockedReason: "Repeated sharing of course video links outside the platform, flagged by content moderation twice.",
    blockedDate: "Sep 10, 2026",
  },
  {
    id: "STU-2006",
    name: "Diya Nair",
    initials: "DN",
    email: "diya.nair@example.com",
    phone: "+91 96630 55210",
    grade: "Grade 7",
    city: "Kochi, Kerala",
    registeredDate: "May 22, 2026",
    lastActive: "5 days ago",
    status: STUDENT_STATUS.ACTIVE,
    enrolledCourses: [],
    blockedReason: null,
    blockedDate: null,
  },
  {
    id: "STU-2007",
    name: "Rohan Gupta",
    initials: "RG",
    email: "rohan.gupta@example.com",
    phone: "+91 93220 66104",
    grade: "Grade 10",
    city: "Jaipur, Rajasthan",
    registeredDate: "Mar 3, 2026",
    lastActive: "1 month ago",
    status: STUDENT_STATUS.BLOCKED,
    enrolledCourses: [{ title: "Modern World History: 1900–Present", progress: 8 }],
    blockedReason: "Multiple failed-payment fraud attempts flagged by the payments team.",
    blockedDate: "Aug 25, 2026",
  },
  {
    id: "STU-2008",
    name: "Sneha Joshi",
    initials: "SJ",
    email: "sneha.joshi@example.com",
    phone: "+91 95120 99871",
    grade: "Grade 9",
    city: "Ahmedabad, Gujarat",
    registeredDate: "Sep 12, 2026",
    lastActive: "Today",
    status: STUDENT_STATUS.ACTIVE,
    enrolledCourses: [{ title: "Applied Machine Learning for Developers", progress: 2 }],
    blockedReason: null,
    blockedDate: null,
  },
];

// ---------- tiny mock "store" (mirrors ../data/educatorsMock.js / coursesMock.js) ----------
let _students = [...SEED_STUDENTS];
const _listeners = new Set();
function _notify() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _snapshot() {
  return _students;
}

export function blockStudent(id, reason, admin = "Admin User") {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  _students = _students.map((s) =>
    s.id === id
      ? { ...s, status: STUDENT_STATUS.BLOCKED, blockedReason: reason || "Blocked by admin.", blockedDate: today, blockedBy: admin }
      : s
  );
  _notify();
}

export function unblockStudent(id) {
  _students = _students.map((s) =>
    s.id === id ? { ...s, status: STUDENT_STATUS.ACTIVE, blockedReason: null, blockedDate: null, blockedBy: null } : s
  );
  _notify();
}

export function useStudents() {
  return useSyncExternalStore(_subscribe, _snapshot);
}

export function useStudent(id) {
  const all = useStudents();
  return all.find((s) => s.id === id) || null;
}
