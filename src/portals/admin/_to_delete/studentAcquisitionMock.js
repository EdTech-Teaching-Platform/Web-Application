// Student Acquisition — who brought each student onto the platform.
//
// Attribution is stored per student as one record:
//   channel "regional_head" (methods: outreach | admissions) -> attributorId = Regional Head id (RH-…)
//   channel "teacher"       (methods: referral | network)    -> attributorId = educator id (EDU-…)
// Names, regions, grades and account status are NOT copied: they are joined
// live from the existing stores (regionalHeadsMock, educatorsMock,
// studentsMock), so a renamed teacher, a removed head or a blocked student
// is always reflected. A record keeps only a name snapshot to fall back on
// if the head/teacher is later removed.
//
// Onboarding: a record starts "pending" (a prospect with no student account)
// or "onboarded" (linked to a student in Student Management). Marking a
// pending record onboarded creates the real student via addStudent().
// Like studentsMock, this store is in-memory (no backend yet).

import { useMemo, useSyncExternalStore } from "react";
import { useStudents, getStudentsSnapshot, addStudent, STUDENT_STATUS } from "./studentsMock";
import { useEducators, getEducatorsSnapshot } from "./educatorsMock";
import { useRegionalState, REGIONS } from "./regionalHeadsMock";

export const CHANNEL = { HEAD: "regional_head", TEACHER: "teacher" };
export const CHANNEL_LABEL = { [CHANNEL.HEAD]: "Regional Head", [CHANNEL.TEACHER]: "Teacher" };
export const METHOD_LABEL = { outreach: "Outreach", admissions: "Admissions", referral: "Referral", network: "Network" };
export const METHODS_BY_CHANNEL = {
  [CHANNEL.HEAD]: ["outreach", "admissions"],
  [CHANNEL.TEACHER]: ["referral", "network"],
};
export const ONBOARDING = { PENDING: "pending", ONBOARDED: "onboarded", DROPPED: "dropped" };
export const ONBOARDING_LABEL = { pending: "Pending", onboarded: "Onboarded", dropped: "Not proceeding" };
export const ONBOARDING_BADGE = { pending: "is-pending", onboarded: "is-approved", dropped: "is-rejected" };

const iso = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => iso(new Date(Date.now() - n * 86400000));

// Seed attribution for the students already in Student Management plus a few
// prospects still being onboarded. Regions are cities from REGIONS.
const SEED = [
  { id: "ACQ-1001", studentId: "STU-2001", channel: CHANNEL.HEAD, method: "admissions", attributorId: "RH-1002", attributorName: "Meredith Chan", region: "Bengaluru", acquiredAt: "2026-08-02", onboarding: ONBOARDING.ONBOARDED, onboardedAt: "2026-08-02" },
  { id: "ACQ-1002", studentId: "STU-2002", channel: CHANNEL.TEACHER, method: "referral", attributorId: "EDU-1001", attributorName: "Sarah Jenkins", region: "Bengaluru", acquiredAt: "2026-07-28", onboarding: ONBOARDING.ONBOARDED, onboardedAt: "2026-07-28" },
  { id: "ACQ-1003", studentId: "STU-2003", channel: CHANNEL.HEAD, method: "outreach", attributorId: "RH-1001", attributorName: "Alan Turing", region: "Delhi", acquiredAt: "2026-06-14", onboarding: ONBOARDING.ONBOARDED, onboardedAt: "2026-06-14" },
  { id: "ACQ-1004", studentId: "STU-2004", channel: CHANNEL.TEACHER, method: "network", attributorId: "EDU-1005", attributorName: "Alan Turing", region: "Bengaluru", acquiredAt: "2026-09-01", onboarding: ONBOARDING.ONBOARDED, onboardedAt: "2026-09-01" },
  { id: "ACQ-1005", studentId: "STU-2005", channel: CHANNEL.TEACHER, method: "referral", attributorId: "EDU-1006", attributorName: "Howard Zinn", region: "Mumbai", acquiredAt: "2026-04-09", onboarding: ONBOARDING.ONBOARDED, onboardedAt: "2026-04-09" },
  { id: "ACQ-1006", studentId: "STU-2006", channel: CHANNEL.HEAD, method: "outreach", attributorId: "RH-1002", attributorName: "Meredith Chan", region: "Bengaluru", acquiredAt: "2026-05-22", onboarding: ONBOARDING.ONBOARDED, onboardedAt: "2026-05-22" },
  { id: "ACQ-1007", studentId: "STU-2007", channel: CHANNEL.HEAD, method: "admissions", attributorId: "RH-1001", attributorName: "Alan Turing", region: "Delhi", acquiredAt: "2026-03-03", onboarding: ONBOARDING.ONBOARDED, onboardedAt: "2026-03-03" },
  { id: "ACQ-1008", studentId: "STU-2008", channel: CHANNEL.TEACHER, method: "referral", attributorId: "EDU-1008", attributorName: "Meredith Chan", region: "Mumbai", acquiredAt: "2026-09-12", onboarding: ONBOARDING.ONBOARDED, onboardedAt: "2026-09-12" },
  { id: "ACQ-1009", studentId: null, name: "Tanvi Desai", email: "tanvi.desai@example.com", phone: "+91 98765 40011", grade: "Grade 9", city: "Mumbai, Maharashtra", channel: CHANNEL.TEACHER, method: "referral", attributorId: "EDU-1008", attributorName: "Meredith Chan", region: "Mumbai", acquiredAt: daysAgo(5), onboarding: ONBOARDING.PENDING, onboardedAt: null },
  { id: "ACQ-1010", studentId: null, name: "Priyanka Roy", email: "priyanka.roy@example.com", phone: "+91 98111 22034", grade: "Grade 10", city: "Delhi", channel: CHANNEL.HEAD, method: "outreach", attributorId: "RH-1001", attributorName: "Alan Turing", region: "Delhi", acquiredAt: daysAgo(8), onboarding: ONBOARDING.PENDING, onboardedAt: null },
  { id: "ACQ-1011", studentId: null, name: "Karan Mehta", email: "karan.mehta@example.com", phone: "+91 90000 71122", grade: "Grade 12", city: "Bengaluru, Karnataka", channel: CHANNEL.HEAD, method: "admissions", attributorId: "RH-1002", attributorName: "Meredith Chan", region: "Bengaluru", acquiredAt: daysAgo(3), onboarding: ONBOARDING.PENDING, onboardedAt: null },
  { id: "ACQ-1012", studentId: null, name: "Zoya Khan", email: "zoya.khan@example.com", phone: "+91 93220 55871", grade: "Grade 8", city: "Delhi", channel: CHANNEL.TEACHER, method: "network", attributorId: "EDU-1005", attributorName: "Alan Turing", region: "Delhi", acquiredAt: daysAgo(16), onboarding: ONBOARDING.DROPPED, onboardedAt: null },
];

let _records = SEED.map((r) => ({ ...r }));
let _seq = 1013;
const _listeners = new Set();
const _emit = () => _listeners.forEach((fn) => fn());
const _subscribe = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };
const _snapshot = () => _records;

const normEmail = (e) => String(e || "").trim().toLowerCase();
export const todayIso = () => iso(new Date());

// ---------------------------------------------------------------- actions

// input: { mode: "existing"|"new", studentId?, name?, email?, phone?, grade?, city?,
//          channel, method, attributorId, region, acquiredAt, onboardNow? }
export function recordAcquisition(input, ctx) {
  const errors = validateAcquisition(input, ctx);
  if (errors.length) return { ok: false, errors };
  const attributor = resolveAttributor(input.channel, input.attributorId, ctx);
  const base = {
    id: `ACQ-${++_seq}`,
    channel: input.channel,
    method: input.method,
    attributorId: input.attributorId,
    attributorName: attributor.name,
    region: input.region,
    acquiredAt: input.acquiredAt,
    onboarding: ONBOARDING.PENDING,
    onboardedAt: null,
  };
  let rec;
  if (input.mode === "existing") {
    rec = { ...base, studentId: input.studentId, onboarding: ONBOARDING.ONBOARDED, onboardedAt: input.acquiredAt };
  } else {
    rec = { ...base, studentId: null, name: input.name.trim(), email: normEmail(input.email), phone: input.phone || "", grade: input.grade, city: input.city || "" };
    if (input.onboardNow) {
      const res = addStudent(rec);
      if (!res.ok) return { ok: false, errors: [res.error] };
      rec = { ...rec, studentId: res.student.id, onboarding: ONBOARDING.ONBOARDED, onboardedAt: todayIso() };
    }
  }
  _records = [rec, ..._records];
  _emit();
  return { ok: true, record: rec };
}

export function markOnboarded(recordId) {
  const rec = _records.find((r) => r.id === recordId);
  if (!rec || rec.onboarding !== ONBOARDING.PENDING) return { ok: false, error: "Only pending records can be onboarded." };
  const res = addStudent(rec);
  if (!res.ok) return { ok: false, error: res.error };
  _records = _records.map((r) => (r.id === recordId ? { ...r, studentId: res.student.id, onboarding: ONBOARDING.ONBOARDED, onboardedAt: todayIso() } : r));
  _emit();
  return { ok: true, student: res.student };
}

export function setNotProceeding(recordId, dropped) {
  _records = _records.map((r) => (r.id === recordId && r.onboarding !== ONBOARDING.ONBOARDED ? { ...r, onboarding: dropped ? ONBOARDING.DROPPED : ONBOARDING.PENDING } : r));
  _emit();
}

// ------------------------------------------------------------- validation

export function resolveAttributor(channel, id, ctx) {
  if (channel === CHANNEL.HEAD) {
    const h = ctx.heads.find((x) => x.id === id);
    return h ? { name: h.name, region: h.region, active: h.status === "active", found: true } : { name: "", found: false };
  }
  const e = ctx.educators.find((x) => x.id === id);
  return e ? { name: e.name, region: "", active: e.accountStatus === "active", found: true } : { name: "", found: false };
}

export function validateAcquisition(i, ctx) {
  const e = [];
  const attributor = resolveAttributor(i.channel, i.attributorId, ctx);
  if (!i.channel) e.push("Choose who acquired the student.");
  else if (!i.attributorId || !attributor.found) e.push(i.channel === CHANNEL.HEAD ? "Select a Regional Head." : "Select a teacher.");
  else if (!attributor.active) e.push("Pick an active Regional Head / teacher.");
  if (!i.method || !(METHODS_BY_CHANNEL[i.channel] || []).includes(i.method)) e.push("Choose how the student was acquired.");
  if (!i.region || !REGIONS.includes(i.region)) e.push("Select the region.");
  if (!i.acquiredAt) e.push("Acquisition date is required.");
  else if (i.acquiredAt > todayIso()) e.push("Acquisition date cannot be in the future.");
  if (i.mode === "existing") {
    if (!i.studentId) e.push("Select an existing student.");
    else if (ctx.records.some((r) => r.studentId === i.studentId)) e.push("This student already has an attribution.");
  } else {
    if (!String(i.name || "").trim()) e.push("Student name is required.");
    const em = normEmail(i.email);
    if (!/^\S+@\S+\.\S+$/.test(em)) e.push("Enter a valid email address.");
    else if (ctx.students.some((s) => normEmail(s.email) === em) || ctx.records.some((r) => normEmail(r.email) === em)) e.push("A student or prospect with this email already exists.");
    if (!i.grade) e.push("Select the student's grade.");
  }
  return e;
}

// ------------------------------------------------------------------ hooks

function monthKey(isoDate) { return String(isoDate || "").slice(0, 7); }

// Joined view of every record + the lookups the page needs.
export function useAcquisitions() {
  const records = useSyncExternalStore(_subscribe, _snapshot);
  const students = useStudents();
  const educators = useEducators();
  const regional = useRegionalState();
  return useMemo(() => {
    const heads = regional.heads;
    const ctx = { records, students, educators, heads };
    const rows = records.map((r) => {
      const student = r.studentId ? students.find((s) => s.id === r.studentId) || null : null;
      const attributor = resolveAttributor(r.channel, r.attributorId, ctx);
      const former = attributor.found ? !attributor.active : true;
      const blocked = !!student && student.status === STUDENT_STATUS.BLOCKED;
      return {
        id: r.id,
        studentId: r.studentId,
        name: student ? student.name : r.name || "Unknown",
        email: student ? student.email : r.email || "",
        grade: student ? student.grade : r.grade || "",
        city: student ? student.city : r.city || "",
        channel: r.channel,
        method: r.method,
        attributorId: r.attributorId,
        attributorName: attributor.found ? attributor.name : r.attributorName,
        attributorFormer: former,
        region: r.region,
        acquiredAt: r.acquiredAt,
        onboarding: r.onboarding,
        onboardedAt: r.onboardedAt,
        accountBlocked: blocked,
        isActive: r.onboarding === ONBOARDING.ONBOARDED && !!student && !blocked,
      };
    });
    const attributedIds = new Set(records.map((r) => r.studentId).filter(Boolean));
    const unattributed = students.filter((s) => !attributedIds.has(s.id));
    return { rows, ctx, unattributed, records };
  }, [records, students, educators, regional]);
}

// Attribution for one student (used by Student Management's detail view).
export function useAcquisitionFor(studentId) {
  const { rows } = useAcquisitions();
  return rows.find((r) => r.studentId === studentId) || null;
}

// ------------------------------------------------------------- aggregates

export function summarize(rows) {
  const thisMonth = monthKey(todayIso());
  const onboarded = rows.filter((r) => r.onboarding === ONBOARDING.ONBOARDED).length;
  return {
    total: rows.length,
    onboarded,
    active: rows.filter((r) => r.isActive).length,
    pending: rows.filter((r) => r.onboarding === ONBOARDING.PENDING).length,
    dropped: rows.filter((r) => r.onboarding === ONBOARDING.DROPPED).length,
    thisMonth: rows.filter((r) => monthKey(r.acquiredAt) === thisMonth).length,
    viaHeads: rows.filter((r) => r.channel === CHANNEL.HEAD).length,
    viaTeachers: rows.filter((r) => r.channel === CHANNEL.TEACHER).length,
    conversion: rows.length ? Math.round((onboarded / rows.length) * 100) : 0,
  };
}

export function groupByAttributor(rows, channel) {
  const map = new Map();
  rows.filter((r) => r.channel === channel).forEach((r) => {
    const cur = map.get(r.attributorId) || { id: r.attributorId, name: r.attributorName, former: r.attributorFormer, regions: new Set(), rows: [] };
    cur.rows.push(r);
    cur.regions.add(r.region);
    map.set(r.attributorId, cur);
  });
  return [...map.values()].map((g) => ({ ...g, regions: [...g.regions], ...summarize(g.rows), last: g.rows.map((r) => r.acquiredAt).sort().pop() }));
}

// Last `n` calendar months (oldest first) with head/teacher splits.
export function monthlySeries(rows, n = 6) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const inMonth = rows.filter((r) => monthKey(r.acquiredAt) === key);
    out.push({
      key,
      label: d.toLocaleDateString("en-US", { month: "short" }),
      year: d.getFullYear(),
      heads: inMonth.filter((r) => r.channel === CHANNEL.HEAD).length,
      teachers: inMonth.filter((r) => r.channel === CHANNEL.TEACHER).length,
      total: inMonth.length,
    });
  }
  return out;
}

export function groupBy(rows, keyFn) {
  const m = new Map();
  rows.forEach((r) => { const k = keyFn(r); m.set(k, (m.get(k) || 0) + 1); });
  return [...m.entries()].map(([key, count]) => ({ key, count })).sort((a, b) => b.count - a.count);
}

export function fmtDate(isoDate) {
  if (!isoDate) return "—";
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export { getStudentsSnapshot, getEducatorsSnapshot };
