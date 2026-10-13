// Regional Head onboarding — which students and teachers each Regional Head
// has brought onto the platform, and how those people are doing since.
//
// A record only stores the link (person id -> head id, date). Everything about
// the person — name, grade, last-active, account status, course progress,
// verification — is joined LIVE from Student Management (studentsMock) and
// Educator Management (educatorsMock), so activity always matches those
// screens. Heads come from regionalHeadsMock.
//
// Onboarding a person here creates the real account in the matching module
// (students: addStudent; teachers: addEducator, left "pending verification"
// so the normal educator verification flow still applies).
//
// Like studentsMock / educatorsMock this store is in-memory (no backend yet).

import { useMemo, useSyncExternalStore } from "react";
import { useStudents, addStudent, STUDENT_STATUS } from "./studentsMock";
import { useEducators, addEducator } from "./educatorsMock";
import { useRegionalState } from "./regionalHeadsMock";

export const PERSON = { STUDENT: "student", TEACHER: "teacher" };
export const INACTIVE_AFTER_DAYS = 14;

const SEED = [
  { id: "ONB-1001", type: "student", personId: "STU-2001", headId: "RH-1002", onboardedAt: "2026-08-02" },
  { id: "ONB-1002", type: "student", personId: "STU-2002", headId: "RH-1002", onboardedAt: "2026-07-28" },
  { id: "ONB-1003", type: "student", personId: "STU-2003", headId: "RH-1001", onboardedAt: "2026-06-14" },
  { id: "ONB-1004", type: "student", personId: "STU-2004", headId: "RH-1002", onboardedAt: "2026-09-01" },
  { id: "ONB-1005", type: "student", personId: "STU-2005", headId: "RH-1001", onboardedAt: "2026-04-09" },
  { id: "ONB-1006", type: "student", personId: "STU-2006", headId: "RH-1002", onboardedAt: "2026-05-22" },
  { id: "ONB-1007", type: "student", personId: "STU-2007", headId: "RH-1001", onboardedAt: "2026-03-03" },
  { id: "ONB-1008", type: "student", personId: "STU-2008", headId: "RH-1001", onboardedAt: "2026-09-12" },
  { id: "ONB-1009", type: "teacher", personId: "EDU-1001", headId: "RH-1002", onboardedAt: "2026-06-20" },
  { id: "ONB-1010", type: "teacher", personId: "EDU-1012", headId: "RH-1002", onboardedAt: "2026-07-15" },
  { id: "ONB-1011", type: "teacher", personId: "EDU-1006", headId: "RH-1001", onboardedAt: "2026-05-11" },
  { id: "ONB-1012", type: "teacher", personId: "EDU-1010", headId: "RH-1001", onboardedAt: "2026-06-02" },
  { id: "ONB-1013", type: "teacher", personId: "EDU-1009", headId: "RH-1001", onboardedAt: "2026-04-18" },
];

let _records = SEED.map((r) => ({ ...r }));
let _seq = 1013;
const _listeners = new Set();
const _emit = () => _listeners.forEach((fn) => fn());
const _subscribe = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };
const _snapshot = () => _records;

export const todayIso = () => new Date().toISOString().slice(0, 10);
const normEmail = (e) => String(e || "").trim().toLowerCase();

// "Today" / "Yesterday" / "3 days ago" / "2 weeks ago" / "1 month ago" -> days
export function daysFromLabel(label) {
  const t = String(label || "").toLowerCase();
  if (!t || t === "today") return 0;
  if (t === "yesterday") return 1;
  const m = t.match(/(\d+)\s*(day|week|month|year)/);
  if (!m) return 0;
  const n = Number(m[1]);
  return n * { day: 1, week: 7, month: 30, year: 365 }[m[2]];
}

// ------------------------------------------------------------ onboarding

export function validateStudent(i, ctx) {
  const e = [];
  if (!String(i.name || "").trim()) e.push("Student name is required.");
  const em = normEmail(i.email);
  if (!/^\S+@\S+\.\S+$/.test(em)) e.push("Enter a valid email address.");
  else if (ctx.students.some((s) => normEmail(s.email) === em)) e.push("A student with this email already exists.");
  if (!i.grade) e.push("Select the student's grade.");
  return e;
}

export function validateTeacher(i, ctx) {
  const e = [];
  if (!String(i.firstName || "").trim()) e.push("First name is required.");
  if (!String(i.lastName || "").trim()) e.push("Last name is required.");
  const em = normEmail(i.email);
  if (!/^\S+@\S+\.\S+$/.test(em)) e.push("Enter a valid email address.");
  else if (ctx.educators.some((x) => normEmail(x.email) === em)) e.push("A teacher with this email already exists.");
  if (!i.subject) e.push("Select the subject they teach.");
  if (!String(i.qualification || "").trim()) e.push("Qualification is required.");
  return e;
}

export function onboardStudent(headId, input, ctx) {
  const errors = validateStudent(input, ctx);
  if (errors.length) return { ok: false, errors };
  const res = addStudent(input);
  if (!res.ok) return { ok: false, errors: [res.error] };
  _records = [{ id: `ONB-${++_seq}`, type: PERSON.STUDENT, personId: res.student.id, headId, onboardedAt: todayIso() }, ..._records];
  _emit();
  return { ok: true, person: res.student };
}

export function onboardTeacher(headId, input, ctx) {
  const errors = validateTeacher(input, ctx);
  if (errors.length) return { ok: false, errors };
  const teacher = addEducator({
    firstName: input.firstName, lastName: input.lastName, email: input.email, phone: input.phone || "",
    subjects: [input.subject], qualification: input.qualification, years: Number(input.years) || 0,
    accountStatus: "active", verificationStatus: "pending",
  });
  _records = [{ id: `ONB-${++_seq}`, type: PERSON.TEACHER, personId: teacher.id, headId, onboardedAt: todayIso() }, ..._records];
  _emit();
  return { ok: true, person: teacher };
}

// ------------------------------------------------------------------ hooks

function studentRow(rec, s) {
  const progress = s && s.enrolledCourses && s.enrolledCourses.length
    ? Math.round(s.enrolledCourses.reduce((n, c) => n + (c.progress || 0), 0) / s.enrolledCourses.length) : 0;
  const days = s ? daysFromLabel(s.lastActive) : 0;
  const blocked = !!s && s.status === STUDENT_STATUS.BLOCKED;
  return {
    id: rec.id, type: PERSON.STUDENT, personId: rec.personId, headId: rec.headId, onboardedAt: rec.onboardedAt,
    name: s ? s.name : "Removed student", email: s ? s.email : "", grade: s ? s.grade : "",
    lastActive: s ? s.lastActive : "—", daysInactive: days,
    courses: s && s.enrolledCourses ? s.enrolledCourses.length : 0, progress,
    blocked, missing: !s,
    attention: !s || blocked || days >= INACTIVE_AFTER_DAYS,
    attentionReason: !s ? "Account removed" : blocked ? "Account blocked" : days >= INACTIVE_AFTER_DAYS ? `Inactive ${s.lastActive}` : "",
  };
}

function teacherRow(rec, e) {
  const days = e ? e.lastActiveDaysAgo || 0 : 0;
  const reasons = [];
  if (!e) reasons.push("Account removed");
  else {
    if (e.accountStatus !== "active") reasons.push(`Account ${e.accountStatus}`);
    if (e.verificationStatus === "rejected") reasons.push("Verification rejected");
    else if (e.verificationStatus !== "verified") reasons.push("Verification pending");
    if (days >= INACTIVE_AFTER_DAYS) reasons.push(`Inactive ${e.lastActive}`);
  }
  return {
    id: rec.id, type: PERSON.TEACHER, personId: rec.personId, headId: rec.headId, onboardedAt: rec.onboardedAt,
    name: e ? e.name : "Removed teacher", email: e ? e.email : "",
    subjects: e ? e.subjects || [] : [],
    lastActive: e ? e.lastActive : "—", daysInactive: days,
    accountStatus: e ? e.accountStatus : "removed", verificationStatus: e ? e.verificationStatus : "",
    students: e && e.performance ? e.performance.totalStudents : 0,
    courses: e && e.courses ? e.courses.length : 0,
    engagement: e && e.performance ? e.performance.engagementScore : 0,
    missing: !e,
    attention: reasons.length > 0, attentionReason: reasons.join(" · "),
  };
}

export function useRegionalOnboarding() {
  const records = useSyncExternalStore(_subscribe, _snapshot);
  const students = useStudents();
  const educators = useEducators();
  const regional = useRegionalState();
  return useMemo(() => {
    const ctx = { students, educators, heads: regional.heads };
    const studentRows = records.filter((r) => r.type === PERSON.STUDENT).map((r) => studentRow(r, students.find((s) => s.id === r.personId)));
    const teacherRows = records.filter((r) => r.type === PERSON.TEACHER).map((r) => teacherRow(r, educators.find((e) => e.id === r.personId)));
    const forHead = (headId) => {
      const st = studentRows.filter((r) => r.headId === headId);
      const te = teacherRows.filter((r) => r.headId === headId);
      return {
        students: st, teachers: te,
        activeStudents: st.filter((r) => !r.attention).length,
        activeTeachers: te.filter((r) => !r.attention).length,
        attention: st.filter((r) => r.attention).length + te.filter((r) => r.attention).length,
      };
    };
    return { ctx, forHead, studentRows, teacherRows };
  }, [records, students, educators, regional]);
}

// Who onboarded this student / teacher (for Student & Educator Management).
export function useOnboardedBy(personId) {
  const { studentRows, teacherRows } = useRegionalOnboarding();
  const regional = useRegionalState();
  const row = [...studentRows, ...teacherRows].find((r) => r.personId === personId);
  if (!row) return null;
  const head = regional.heads.find((h) => h.id === row.headId);
  return { headName: head ? head.name : "Former Regional Head", region: head ? head.region : "", onboardedAt: row.onboardedAt };
}

export function fmtDate(isoDate) {
  if (!isoDate) return "—";
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
