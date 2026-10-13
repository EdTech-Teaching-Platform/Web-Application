// Regional Head portal — shared data layer (queries, resolution history,
// escalations to Admin, notifications, activity log).
//
// EVERYTHING a Regional Head sees is filtered by their region here, and the
// write functions re-check the region, so a head can never read or change a
// query that belongs to another region.
//
// Students / onboarding come from the existing Admin stores (studentsMock,
// regionalOnboardingMock, regionalHeadsMock) so numbers always match the Admin
// console. Queries and escalations are persisted in localStorage (this demo has
// no backend) and sync across tabs, so an Admin reply shows up in the Regional
// Head's tab live.

import { useMemo, useSyncExternalStore } from "react";
import { useStudents } from "./studentsMock";
import { useEducators } from "./educatorsMock";
import { useRegionalOnboarding, daysFromLabel, INACTIVE_AFTER_DAYS } from "./regionalOnboardingMock";
import { useRegionalState } from "./regionalHeadsMock";
import { addNotification } from "./notificationsMock";

/* ------------------------------------------------------------- constants */

export const QUERY_CATEGORY = {
  COURSE_ACCESS: "course_access",
  ACCOUNT_SETUP: "account_setup",
  PROGRESS: "progress",
  TECHNICAL: "technical",
  PAYMENT: "payment",
  ACCOUNT_BLOCK: "account_block",
  CERTIFICATE: "certificate",
  SAFETY: "safety",
  VERIFICATION: "verification",
};

export const QUERY_CATEGORY_LABEL = {
  [QUERY_CATEGORY.COURSE_ACCESS]: "Course access",
  [QUERY_CATEGORY.ACCOUNT_SETUP]: "Account setup",
  [QUERY_CATEGORY.PROGRESS]: "Progress / content help",
  [QUERY_CATEGORY.TECHNICAL]: "Basic technical help",
  [QUERY_CATEGORY.PAYMENT]: "Payment / refund",
  [QUERY_CATEGORY.ACCOUNT_BLOCK]: "Account block / unblock",
  [QUERY_CATEGORY.CERTIFICATE]: "Certificate",
  [QUERY_CATEGORY.SAFETY]: "Safety / conduct",
  [QUERY_CATEGORY.VERIFICATION]: "Verification / credentials",
};

export const PERSON_LABEL = { student: "Student", teacher: "Teacher" };

// What a Regional Head may close on their own. Everything else must go to Admin.
export const WITHIN_AUTHORITY = new Set([
  QUERY_CATEGORY.COURSE_ACCESS,
  QUERY_CATEGORY.ACCOUNT_SETUP,
  QUERY_CATEGORY.PROGRESS,
  QUERY_CATEGORY.TECHNICAL,
]);
export const isWithinAuthority = (category) => WITHIN_AUTHORITY.has(category);

export const QUERY_STATUS = { OPEN: "open", ESCALATED: "escalated", RESOLVED: "resolved" };
export const QUERY_STATUS_LABEL = { open: "Open", escalated: "Escalated", resolved: "Resolved" };
export const QUERY_STATUS_BADGE = { open: "is-pending", escalated: "is-verified", resolved: "is-approved" };

export const PRIORITY = { LOW: "low", MEDIUM: "medium", HIGH: "high" };
export const PRIORITY_LABEL = { low: "Low", medium: "Medium", high: "High" };

export const ESC_STATUS = { PENDING: "pending", IN_REVIEW: "in_review", RESOLVED: "resolved", RETURNED: "returned" };
export const ESC_STATUS_LABEL = {
  pending: "Pending", in_review: "In review", resolved: "Resolved by Admin", returned: "Returned to Regional Head",
};
export const ESC_STATUS_BADGE = { pending: "is-pending", in_review: "is-verified", resolved: "is-approved", returned: "is-rejected" };

/* ------------------------------------------------------------------ seed */

const iso = (daysAgo, hour = 10) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};

function seedState() {
  return {
    seq: 100,
    queries: [
      { id: "Q-1001", region: "Bengaluru", studentId: "STU-2001", studentName: "Aarav Sharma", category: "course_access", priority: "medium",
        subject: "Cannot open week 4 lectures", description: "The DSA course shows week 4 as locked even though I finished week 3.",
        status: "open", createdAt: iso(1, 9), resolution: null, escalationId: null,
        history: [{ at: iso(1, 9), by: "Aarav Sharma", action: "Query raised", note: "" }] },
      { id: "Q-1002", region: "Bengaluru", studentId: "STU-2004", studentName: "Ananya Reddy", category: "account_setup", priority: "low",
        subject: "Wrong grade on my profile", description: "I am in Grade 8 but my profile might need a check.",
        status: "open", createdAt: iso(2, 11), resolution: null, escalationId: null,
        history: [{ at: iso(2, 11), by: "Ananya Reddy", action: "Query raised", note: "" }] },
      { id: "Q-1003", region: "Bengaluru", studentId: "STU-2006", studentName: "Diya Nair", category: "payment", priority: "high",
        subject: "Charged twice for the same course", description: "My card was charged two times for the Excel & SQL course.",
        status: "open", createdAt: iso(1, 15), resolution: null, escalationId: null,
        history: [{ at: iso(1, 15), by: "Diya Nair", action: "Query raised", note: "" }] },
      { id: "Q-1004", region: "Bengaluru", studentId: "STU-2002", studentName: "Meera Iyer", category: "progress", priority: "low",
        subject: "Progress bar stuck at 34%", description: "I watched the full module but the progress did not move.",
        status: "resolved", createdAt: iso(9, 10), escalationId: null,
        resolution: { at: iso(8, 12), by: "Meredith Chan", note: "Progress was re-synced from the module quiz. Shows 34% correctly now." },
        history: [
          { at: iso(9, 10), by: "Meera Iyer", action: "Query raised", note: "" },
          { at: iso(8, 12), by: "Meredith Chan", action: "Resolved", note: "Progress was re-synced from the module quiz. Shows 34% correctly now." },
        ] },
      { id: "Q-1005", region: "Delhi", studentId: "STU-2003", studentName: "Kabir Malhotra", category: "technical", priority: "medium",
        subject: "Video buffering on mobile", description: "Lectures keep buffering on my phone data.",
        status: "open", createdAt: iso(1, 18), resolution: null, escalationId: null,
        history: [{ at: iso(1, 18), by: "Kabir Malhotra", action: "Query raised", note: "" }] },
      { id: "Q-1006", region: "Delhi", studentId: "STU-2005", studentName: "Ishaan Verma", category: "account_block", priority: "high",
        subject: "Please unblock my account", description: "My account was blocked and I would like it reviewed.",
        status: "open", createdAt: iso(3, 10), resolution: null, escalationId: null,
        history: [{ at: iso(3, 10), by: "Ishaan Verma", action: "Query raised", note: "" }] },
      { id: "Q-1007", region: "Delhi", studentId: "STU-2008", studentName: "Sneha Joshi", category: "course_access", priority: "low",
        subject: "Enrolled but course not visible", description: "I enrolled yesterday and see nothing in My Courses.",
        status: "resolved", createdAt: iso(6, 9), escalationId: null,
        resolution: { at: iso(5, 11), by: "Alan Turing", note: "Enrollment re-linked; course now visible." },
        history: [
          { at: iso(6, 9), by: "Sneha Joshi", action: "Query raised", note: "" },
          { at: iso(5, 11), by: "Alan Turing", action: "Resolved", note: "Enrollment re-linked; course now visible." },
        ] },
      { id: "Q-1009", region: "Bengaluru", personType: "teacher", studentId: "EDU-1001", studentName: "Sarah Jenkins", category: "technical", priority: "medium",
        subject: "Cannot upload lecture video", description: "The course builder stops at 80% when I upload my week 5 video.",
        status: "open", createdAt: iso(1, 13), resolution: null, escalationId: null,
        history: [{ at: iso(1, 13), by: "Sarah Jenkins", action: "Query raised", note: "" }] },
      { id: "Q-1010", region: "Bengaluru", personType: "teacher", studentId: "EDU-1012", studentName: "Fatima Al-Sayed", category: "payment", priority: "high",
        subject: "Payout for last month not received", description: "My September payout is still showing as pending.",
        status: "open", createdAt: iso(2, 16), resolution: null, escalationId: null,
        history: [{ at: iso(2, 16), by: "Fatima Al-Sayed", action: "Query raised", note: "" }] },
      { id: "Q-1011", region: "Delhi", personType: "teacher", studentId: "EDU-1010", studentName: "Grace Whitfield", category: "account_setup", priority: "low",
        subject: "Update my profile subjects", description: "Please add Creative Writing to my subject list.",
        status: "resolved", createdAt: iso(7, 10), escalationId: null,
        resolution: { at: iso(6, 14), by: "Alan Turing", note: "Subject added to the profile and confirmed with the teacher." },
        history: [
          { at: iso(7, 10), by: "Grace Whitfield", action: "Query raised", note: "" },
          { at: iso(6, 14), by: "Alan Turing", action: "Resolved", note: "Subject added to the profile and confirmed with the teacher." },
        ] },
      { id: "Q-1012", region: "Delhi", personType: "teacher", studentId: "EDU-1009", studentName: "Rohan Malhotra", category: "verification", priority: "medium",
        subject: "Account inactive — reactivation request", description: "My account was marked inactive. Please reactivate it.",
        status: "open", createdAt: iso(2, 9), resolution: null, escalationId: null,
        history: [{ at: iso(2, 9), by: "Rohan Malhotra", action: "Query raised", note: "" }] },
      { id: "Q-1008", region: "Mumbai", studentId: "", studentName: "Rhea Kapoor", category: "course_access", priority: "low",
        subject: "Mumbai region sample query", description: "Belongs to another region — never visible to Delhi or Bengaluru heads.",
        status: "open", createdAt: iso(2, 12), resolution: null, escalationId: null,
        history: [{ at: iso(2, 12), by: "Rhea Kapoor", action: "Query raised", note: "" }] },
    ],
    escalations: [],
    notifications: [],
    activity: [
      { id: "A-1", region: "Bengaluru", at: iso(8, 12), kind: "query", text: "Resolved query Q-1004 for Meera Iyer" },
      { id: "A-2", region: "Delhi", at: iso(5, 11), kind: "query", text: "Resolved query Q-1007 for Sneha Joshi" },
    ],
  };
}

/* ----------------------------------------------------------------- store */

const KEY = "ul_regional_portal_v2";
let _state = load();
const _listeners = new Set();

function load() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null;
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.queries) && Array.isArray(p.escalations)) return p;
    }
  } catch { /* fall through to seed */ }
  return seedState();
}

function commit(next) {
  _state = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch { /* storage unavailable */ }
  _listeners.forEach((fn) => fn());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key !== KEY) return;
    _state = load();
    _listeners.forEach((fn) => fn());
  });
}

const subscribe = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };
const snapshot = () => _state;
export const usePortalState = () => useSyncExternalStore(subscribe, snapshot, snapshot);

const nowIso = () => new Date().toISOString();
const nextId = (prefix) => { const n = _state.seq + 1; _state = { ..._state, seq: n }; return `${prefix}-${n}`; };

export function fmtDateTime(isoStr) {
  if (!isoStr) return "—";
  return new Date(isoStr).toLocaleString("en-GB", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
export function timeAgo(isoStr) {
  const mins = Math.max(0, Math.round((Date.now() - new Date(isoStr).getTime()) / 60000));
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} hr ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Yesterday" : `${d} days ago`;
}

function pushActivity(s, region, kind, text) {
  return { ...s, activity: [{ id: `A-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, region, at: nowIso(), kind, text }, ...s.activity].slice(0, 200) };
}

/* ----------------------------------------------------------- region scope */

// All reads/writes below take the head's region and refuse anything else.
const inRegion = (item, region) => !!region && item.region === region;

export function useRegionData(region) {
  const regional = useRegionalState();
  const students = useStudents();
  const { studentRows, teacherRows } = useRegionalOnboarding();
  const educators = useEducators();
  const portal = usePortalState();

  return useMemo(() => {
    const head = regional.heads.find((h) => h.status === "active" && h.region === region) || null;
    const headIds = new Set(regional.heads.filter((h) => h.region === region).map((h) => h.id));
    const onboarded = new Map(studentRows.filter((r) => headIds.has(r.headId)).map((r) => [r.personId, r]));
    const cityOf = (s) => String(s.city || "").split(",")[0].trim();

    const regionStudents = students
      .filter((s) => onboarded.has(s.id) || cityOf(s) === region)
      .map((s) => {
        const rec = onboarded.get(s.id) || null;
        const courses = s.enrolledCourses || [];
        const progress = courses.length ? Math.round(courses.reduce((n, c) => n + (c.progress || 0), 0) / courses.length) : 0;
        const days = daysFromLabel(s.lastActive);
        const blocked = s.status === "blocked";
        const inactive = days >= INACTIVE_AFTER_DAYS;
        return {
          ...s, courses, progress, daysInactive: days, blocked, inactive,
          onboardedAt: rec ? rec.onboardedAt : "", onboardedByHead: !!rec,
          openQueries: portal.queries.filter((q) => inRegion(q, region) && q.studentId === s.id && q.status !== QUERY_STATUS.RESOLVED).length,
        };
      });

    const regionTeachers = teacherRows.filter((r) => headIds.has(r.headId)).map((r) => {
      const e = educators.find((x) => x.id === r.personId) || {};
      return {
        ...r, id: r.personId, phone: e.phone || "", qualification: e.qualification || "", years: e.years || 0,
        blocked: r.accountStatus !== "active", inactive: r.daysInactive >= INACTIVE_AFTER_DAYS,
        onboardedByHead: true,
        openQueries: portal.queries.filter((q) => inRegion(q, region) && q.studentId === r.personId && q.status !== QUERY_STATUS.RESOLVED).length,
      };
    });

    const queries = portal.queries.filter((q) => inRegion(q, region)).map((q) => (q.personType ? q : { ...q, personType: "student" }));
    const escalations = portal.escalations.filter((e) => inRegion(e, region));
    const notifications = portal.notifications.filter((n) => inRegion(n, region));
    const activity = portal.activity.filter((a) => inRegion(a, region));
    return { head, students: regionStudents, teachers: regionTeachers, queries, escalations, notifications, activity };
  }, [regional, students, studentRows, teacherRows, educators, portal, region]);
}

/* ---------------------------------------------------- query: resolve/note */

export function resolveQuery({ region, headName, queryId, note }) {
  const q = _state.queries.find((x) => x.id === queryId);
  if (!q || !inRegion(q, region)) return { ok: false, error: "This query is outside your region." };
  if (q.status === QUERY_STATUS.RESOLVED) return { ok: false, error: "This query is already resolved." };
  if (q.status === QUERY_STATUS.ESCALATED) return { ok: false, error: "This query is with Admin. Wait for their response." };
  if (!isWithinAuthority(q.category)) return { ok: false, error: "This type of issue needs Admin. Use Escalate to Admin." };
  const text = String(note || "").trim();
  if (text.length < 5) return { ok: false, error: "Add a short resolution note (at least 5 characters)." };
  const at = nowIso();
  let s = {
    ..._state,
    queries: _state.queries.map((x) => x.id !== queryId ? x : {
      ...x, status: QUERY_STATUS.RESOLVED, resolution: { at, by: headName, note: text },
      history: [...x.history, { at, by: headName, action: "Resolved", note: text }],
    }),
  };
  s = pushActivity(s, region, "query", `Resolved query ${q.id} for ${q.studentName}`);
  commit(s);
  return { ok: true };
}

export function addQueryNote({ region, headName, queryId, note }) {
  const q = _state.queries.find((x) => x.id === queryId);
  if (!q || !inRegion(q, region)) return { ok: false, error: "This query is outside your region." };
  const text = String(note || "").trim();
  if (!text) return { ok: false, error: "Write a note first." };
  commit({ ..._state, queries: _state.queries.map((x) => x.id !== queryId ? x : { ...x, history: [...x.history, { at: nowIso(), by: headName, action: "Note", note: text }] }) });
  return { ok: true };
}

/* --------------------------------------------------------------- escalate */

export function escalateQuery({ region, head, queryId, reason, priority }) {
  const q = _state.queries.find((x) => x.id === queryId);
  if (!q || !inRegion(q, region)) return { ok: false, error: "This query is outside your region." };
  if (q.status === QUERY_STATUS.RESOLVED) return { ok: false, error: "Resolved queries cannot be escalated." };
  if (q.status === QUERY_STATUS.ESCALATED) return { ok: false, error: "This query is already escalated." };
  const why = String(reason || "").trim();
  if (why.length < 10) return { ok: false, error: "Explain why this needs Admin (at least 10 characters)." };
  const at = nowIso();
  const escId = nextId("ESC");
  const esc = {
    id: escId, queryId, region, headId: head.id, headName: head.name,
    studentId: q.studentId, studentName: q.studentName, personType: q.personType || "student", subject: q.subject, category: q.category,
    reason: why, priority: priority || q.priority, status: ESC_STATUS.PENDING, adminResponse: "",
    createdAt: at, updatedAt: at,
    history: [{ at, by: head.name, role: "Regional Head", action: "Escalated to Admin", note: why }],
  };
  let s = {
    ..._state,
    escalations: [esc, ..._state.escalations],
    queries: _state.queries.map((x) => x.id !== queryId ? x : {
      ...x, status: QUERY_STATUS.ESCALATED, escalationId: escId,
      history: [...x.history, { at, by: head.name, action: "Escalated to Admin", note: why }],
    }),
  };
  s = pushActivity(s, region, "escalation", `Escalated ${q.id} (${q.studentName}) to Admin`);
  commit(s);
  // Admin-side notification (bell + popup)
  addNotification({
    type: "approval",
    title: `Escalation from ${head.name} (${region})`,
    message: `${q.studentName}: ${q.subject}. Reason: ${why}`,
    link: "/admin/escalations",
  });
  return { ok: true, escalation: esc };
}

/* ----------------------------------------------------------- admin side */

export function useEscalations() {
  return usePortalState().escalations;
}

// action: "review" | "resolve" | "return"
export function adminRespond({ escalationId, action, response, admin = "Admin User" }) {
  const e = _state.escalations.find((x) => x.id === escalationId);
  if (!e) return { ok: false, error: "Escalation not found." };
  if (e.status === ESC_STATUS.RESOLVED || e.status === ESC_STATUS.RETURNED) return { ok: false, error: "This escalation is already closed." };
  const text = String(response || "").trim();
  if ((action === "resolve" || action === "return") && text.length < 5) return { ok: false, error: "Write a response for the Regional Head (at least 5 characters)." };
  const at = nowIso();
  const status = action === "review" ? ESC_STATUS.IN_REVIEW : action === "resolve" ? ESC_STATUS.RESOLVED : ESC_STATUS.RETURNED;
  const label = action === "review" ? "Marked in review" : action === "resolve" ? "Resolved by Admin" : "Returned to Regional Head";
  const entry = { at, by: admin, role: "Admin", action: label, note: text };

  let s = {
    ..._state,
    escalations: _state.escalations.map((x) => x.id !== escalationId ? x : {
      ...x, status, updatedAt: at, adminResponse: text || x.adminResponse, history: [...x.history, entry],
    }),
    queries: _state.queries.map((q) => {
      if (q.id !== e.queryId) return q;
      if (action === "resolve") return { ...q, status: QUERY_STATUS.RESOLVED, resolution: { at, by: `${admin} (Admin)`, note: text }, history: [...q.history, { at, by: admin, action: "Resolved by Admin", note: text }] };
      if (action === "return") return { ...q, status: QUERY_STATUS.OPEN, history: [...q.history, { at, by: admin, action: "Returned to Regional Head", note: text }] };
      return { ...q, history: [...q.history, { at, by: admin, action: "Admin is reviewing", note: "" }] };
    }),
  };
  const msg = action === "review"
    ? `Admin is now reviewing your escalation ${e.id} (${e.studentName}).`
    : `${label} — ${e.studentName}: ${text}`;
  s = {
    ...s,
    notifications: [{ id: `N-${Date.now()}`, region: e.region, headId: e.headId, title: `Escalation ${e.id}: ${ESC_STATUS_LABEL[status]}`, message: msg, at, read: false, escalationId: e.id }, ...s.notifications].slice(0, 200),
  };
  s = pushActivity(s, e.region, "escalation", `Admin ${status === ESC_STATUS.IN_REVIEW ? "is reviewing" : status === ESC_STATUS.RESOLVED ? "resolved" : "returned"} escalation ${e.id}`);
  commit(s);
  return { ok: true };
}

/* ---------------------------------------------------------- notifications */

export function markHeadNotificationsRead(region) {
  commit({ ..._state, notifications: _state.notifications.map((n) => (inRegion(n, region) ? { ...n, read: true } : n)) });
}

export function logRegionActivity(region, kind, text) {
  commit(pushActivity(_state, region, kind, text));
}
