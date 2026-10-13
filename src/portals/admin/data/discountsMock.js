// Discount Management — campaigns, coupons, student targeting, redemptions,
// audit trail and analytics source data.
//
// There is no backend yet, so this module IS the "server": every rule below
// (validation, redemption limits, first-purchase checks, stacking, the final
// payable amount) lives in plain functions that a checkout API can call
// unchanged. Redemption is a single synchronous read-validate-write on one
// state object, so two attempts can never both take the last remaining use.
//
//   computeDiscount()   pure price maths — used by the preview, validation,
//                       redemption and verification, so they always agree
//   validateCoupons()   all eligibility rules, no side effects
//   redeemCoupons()     re-validates, then records the purchase + redemption
//   verifyRedemption()  recomputes a stored redemption from its terms snapshot
//
// Courses, test series and students are read from their existing stores
// (coursesMock / testSeriesMock / studentsMock). There is no student checkout
// in the Admin portal, so the Student Targeting / Campaign pages offer a
// clearly-labelled "record a purchase" tool that calls redeemCoupons().
// Student notifications are queued in `inbox` (no student inbox or email
// integration exists yet) and summarised in the Admin notification feed.
// Persisted in localStorage; history is never rewritten by archive/delete.

import { useSyncExternalStore } from "react";
import { getCoursesSnapshot, COURSE_STATUS } from "./coursesMock";
import { getTestSeriesSnapshot, SERIES_STATUS, PRICING_TYPE } from "./testSeriesMock";
import { getStudentsSnapshot, STUDENT_STATUS } from "./studentsMock";
import { addNotification } from "./notificationsMock";

/* ---------------- constants ---------------- */
export const DISCOUNT_TYPES = { percent: "Percentage", fixed: "Fixed amount" };
export const KINDS = { standard: "Standard", flash: "Flash sale", referral: "Referral", combo: "Combo" };
export const SCOPES = {
  all_courses: "All courses",
  selected_courses: "Selected courses",
  all_test_series: "All test series",
  selected_test_series: "Selected test series",
  both: "All courses and test series",
};
// Courses are hidden for now: discounts apply to test series only. Flip to false to bring course scopes back.
export const HIDE_COURSES = true;
export const SCOPE_OPTIONS = HIDE_COURSES
  ? { all_test_series: SCOPES.all_test_series, selected_test_series: SCOPES.selected_test_series }
  : SCOPES;
export const STATUS_LABEL = {
  draft: "Draft", scheduled: "Scheduled", active: "Active", paused: "Paused",
  inactive: "Inactive", expired: "Expired", exhausted: "Exhausted", archived: "Archived",
};
export const STATUS_BADGE = {
  draft: "is-account-inactive", scheduled: "is-verified", active: "is-approved", paused: "is-pending",
  inactive: "is-account-inactive", expired: "is-rejected", exhausted: "is-rejected", archived: "is-account-inactive",
};

// role -> allowed actions (the Admin portal has no per-module matrix for discounts yet)
const ROLE_PERMS = {
  "super-admin": ["view", "create", "edit", "approve", "delete"],
  admin: ["view", "create", "edit", "approve", "delete"],
  "head-teacher": ["view"],
};
export const can = (role, action) => (ROLE_PERMS[role || "admin"] || []).includes(action);

const STORAGE_KEY = "ul_admin_discounts_v2";
const DAY = 86400000;
const nowIso = () => new Date().toISOString();
const r2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
let _seq = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(_seq++).toString(36)}`;

export const inr = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

/* ---------------- catalog (existing stores) ---------------- */
const parsePrice = (p) => Number(String(p ?? "").replace(/[^\d.]/g, "")) || 0;
export function getCatalog() {
  const courses = getCoursesSnapshot()
    .filter((c) => c.status === COURSE_STATUS.APPROVED && parsePrice(c.price) > 0)
    .map((c) => ({ type: "course", id: c.id, name: c.title, price: parsePrice(c.price) }));
  const series = getTestSeriesSnapshot()
    .filter((s) => s.status === SERIES_STATUS.PUBLISHED && s.pricing === PRICING_TYPE.PAID && Number(s.price) > 0)
    .map((s) => ({ type: "test_series", id: s.id, name: s.name, price: Number(s.price) }));
  return HIDE_COURSES ? series : [...courses, ...series];
}
const catalogItem = (type, id) => getCatalog().find((x) => x.type === type && x.id === id) || null;

/* ---------------- pure price maths ---------------- */
// items: [{type,id,name,price}]. Returns which items the campaign covers and the discount on them.
export function computeDiscount(c, items) {
  const inScope = (it) => {
    if (c.kind === "combo") return (c.comboProducts || []).some((p) => p.type === it.type && p.id === it.id);
    switch (c.scope) {
      case "all_courses": return it.type === "course";
      case "selected_courses": return it.type === "course" && (c.productIds || []).includes(it.id);
      case "all_test_series": return it.type === "test_series";
      case "selected_test_series": return it.type === "test_series" && (c.productIds || []).includes(it.id);
      case "both": return true;
      default: return false;
    }
  };
  const inBand = (it) => (c.minPrice == null || it.price >= c.minPrice) && (c.maxPrice == null || it.price <= c.maxPrice);
  const eligible = items.filter((it) => inScope(it) && inBand(it));
  if (c.kind === "combo") {
    const need = c.comboProducts || [];
    if (need.length < 2 || !need.every((p) => items.some((it) => it.type === p.type && it.id === p.id))) {
      return { ok: false, reason: "Cart doesn't contain every item of this combo.", eligible: [], subtotal: 0, discount: 0, perItem: [] };
    }
  }
  const subtotal = r2(eligible.reduce((a, it) => a + it.price, 0));
  if (eligible.length === 0) return { ok: false, reason: "No item in the cart is eligible for this coupon.", eligible, subtotal, discount: 0, perItem: [] };
  if (c.minPurchase && subtotal < c.minPurchase) {
    return { ok: false, reason: `Minimum purchase of ${inr(c.minPurchase)} not met (eligible total ${inr(subtotal)}).`, eligible, subtotal, discount: 0, perItem: [] };
  }
  let d = c.type === "percent" ? (subtotal * c.value) / 100 : c.value;
  if (c.type === "percent" && c.maxDiscount) d = Math.min(d, c.maxDiscount);
  d = r2(Math.min(d, subtotal));
  // allocate proportionally so per-item amounts add up exactly
  let left = d;
  const perItem = eligible.map((it, i) => {
    const share = i === eligible.length - 1 ? left : r2((d * it.price) / subtotal);
    left = r2(left - share);
    return { type: it.type, id: it.id, name: it.name, original: it.price, discount: share };
  });
  return { ok: true, eligible, subtotal, discount: d, perItem };
}

// Validation of the campaign definition itself (used by the form).
export function validateCampaignInput(d, { existingId = null, campaigns = [] } = {}) {
  const e = {};
  if (!d.name || !d.name.trim()) e.name = "Give the discount a name.";
  if (d.codeMode === "shared") {
    const code = (d.code || "").trim().toUpperCase();
    if (!code) e.code = "Enter a coupon code or generate one.";
    else if (!/^[A-Z0-9_-]{4,20}$/.test(code)) e.code = "Use 4–20 letters, numbers, - or _.";
    else if (campaigns.some((c) => c.id !== existingId && c.codeMode === "shared" && c.code === code)) e.code = "This code is already used by another discount.";
  } else if (!(d.prefix || "").trim() || !/^[A-Za-z0-9]{2,8}$/.test(d.prefix.trim())) e.prefix = "Enter a 2–8 character prefix for the generated codes.";
  const v = Number(d.value);
  if (!(v > 0)) e.value = "Enter a discount value above 0.";
  else if (d.type === "percent" && v > 100) e.value = "A percentage can't exceed 100%.";
  const num = (x) => (x === "" || x == null ? null : Number(x));
  const minP = num(d.minPurchase), maxD = num(d.maxDiscount), lo = num(d.minPrice), hi = num(d.maxPrice);
  if (minP != null && minP < 0) e.minPurchase = "Can't be negative.";
  if (maxD != null && maxD <= 0) e.maxDiscount = "Cap must be above 0.";
  if (lo != null && lo < 0) e.minPrice = "Can't be negative.";
  if (lo != null && hi != null && lo > hi) e.maxPrice = "Maximum price can't be lower than the minimum price.";
  if (d.type === "fixed" && v > 0) {
    const ceiling = hi ?? minP;
    if (ceiling != null && v > ceiling) e.value = `A fixed discount of ${inr(v)} exceeds the ${hi != null ? "maximum eligible price" : "minimum purchase"} (${inr(ceiling)}).`;
  }
  if (!d.startAt) e.startAt = "Choose a start date and time.";
  if (!d.endAt) e.endAt = "Choose an expiry date and time.";
  if (d.startAt && d.endAt && new Date(d.endAt) <= new Date(d.startAt)) e.endAt = "Expiry must be after the start.";
  if (d.kind === "flash" && d.startAt && d.endAt && new Date(d.endAt) - new Date(d.startAt) > 7 * DAY) e.endAt = "Flash sales are time-limited — keep them within 7 days.";
  const tl = num(d.totalLimit), pl = num(d.perStudentLimit);
  if (tl != null && (!Number.isInteger(tl) || tl < 1)) e.totalLimit = "Use a whole number of at least 1, or leave blank for no limit.";
  if (pl == null || !Number.isInteger(pl) || pl < 1) e.perStudentLimit = "Use a whole number of at least 1.";
  else if (tl != null && pl > tl) e.perStudentLimit = "Per-student limit can't exceed the total limit.";
  if (d.kind === "combo") {
    if ((d.comboProducts || []).length < 2) e.comboProducts = "Pick at least two items for a combo.";
  } else if ((d.scope === "selected_courses" || d.scope === "selected_test_series") && (d.productIds || []).length === 0) {
    e.productIds = "Select at least one product.";
  }
  if (d.audience?.mode === "students" && (d.audience.studentIds || []).length === 0) e.audience = "Choose at least one student for an exclusive coupon.";
  if (d.kind === "referral" && d.codeMode !== "unique") e.codeMode = "Referral coupons use unique per-student codes.";
  return e;
}

/* ---------------- state ---------------- */
function daysFromNow(n, h = 0) { return new Date(Date.now() + n * DAY + h * 3600000).toISOString(); }

function baseCampaign(o) {
  return {
    description: "", kind: "standard", codeMode: "shared", code: "", prefix: "", type: "percent", value: 10,
    minPurchase: null, maxDiscount: null, minPrice: null, maxPrice: null, scope: "all_test_series", productIds: [], comboProducts: [],
    totalLimit: null, perStudentLimit: 1, firstPurchaseOnly: false, stackable: false,
    audience: { mode: "public", studentIds: [], group: null }, eligibility: { regions: [], grades: [] },
    state: "active", createdAt: nowIso(), updatedAt: nowIso(), createdBy: "Admin User", expiredLogged: false, ...o,
  };
}

function emptyState() { return { campaigns: [], coupons: [], assignments: [], redemptions: [], audit: [], inbox: [], seq: 1000 }; }

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.campaigns)) return { ...emptyState(), ...p };
    }
  } catch (e) { /* fall through to seed */ }
  return null;
}

let _state = load() || emptyState();
const _listeners = new Set();
function commit(next) {
  _state = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch (e) { /* ignore */ }
  _listeners.forEach((fn) => fn());
}
const _sub = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY) { _state = load() || _state; _listeners.forEach((fn) => fn()); } });
}
export const useDiscountState = () => useSyncExternalStore(_sub, () => _state);
export const getDiscountState = () => _state;

function nextCampaignId(st) { const n = Math.max(1000, ...st.campaigns.map((c) => Number(c.id.replace(/\D/g, "")) || 0)) + 1; return `DSC-${n}`; }
function withAudit(st, actor, action, campaign, detail) {
  return { ...st, audit: [{ id: uid("a"), at: nowIso(), actor: actor?.name || "Admin User", role: actor?.role || "admin", action, campaignId: campaign?.id || null, campaignName: campaign?.name || "", detail: detail || "" }, ...st.audit] };
}

/* ---------------- derived status ---------------- */
export function redeemedCount(st, campaignId) { return st.redemptions.filter((r) => r.applied.some((a) => a.campaignId === campaignId)).length; }
export function effectiveStatus(c, st = _state, at = Date.now()) {
  if (c.state === "archived") return "archived";
  if (c.state === "draft") return "draft";
  if (c.state === "paused") return "paused";
  if (c.state === "inactive") return "inactive";
  if (at < new Date(c.startAt).getTime()) return "scheduled";
  if (at > new Date(c.endAt).getTime()) return "expired";
  if (c.totalLimit != null && redeemedCount(st, c.id) >= c.totalLimit) return "exhausted";
  return "active";
}

// Called by pages on mount: writes an "Expired" audit entry once per campaign.
export function refreshExpiry() {
  const due = _state.campaigns.filter((c) => !c.expiredLogged && ["active", "paused", "inactive"].includes(c.state) && Date.now() > new Date(c.endAt).getTime());
  if (!due.length) return;
  let st = { ..._state, campaigns: _state.campaigns.map((c) => (due.includes(c) ? { ...c, expiredLogged: true } : c)) };
  due.forEach((c) => { st = withAudit(st, { name: "System", role: "system" }, "Expired", c, `Discount reached its expiry date (${new Date(c.endAt).toLocaleString("en-IN")}).`); });
  commit(st);
}

/* ---------------- student groups ---------------- */
const parseDaysAgo = (txt) => {
  const t = String(txt || "").toLowerCase();
  if (t === "today") return 0; if (t === "yesterday") return 1;
  const m = t.match(/(\d+)\s*(day|week|month)/);
  if (!m) return null;
  return Number(m[1]) * (m[2] === "day" ? 1 : m[2] === "week" ? 7 : 30);
};
export function studentStats(s, st = _state) {
  const prog = (s.enrolledCourses || []).map((c) => c.progress || 0);
  return {
    avgProgress: prog.length ? Math.round(prog.reduce((a, b) => a + b, 0) / prog.length) : 0,
    completed: (s.enrolledCourses || []).filter((c) => c.progress >= 100).map((c) => c.title),
    inactiveDays: parseDaysAgo(s.lastActive),
    joinedDaysAgo: Math.floor((Date.now() - Date.parse(s.registeredDate)) / DAY),
    purchases: (s.enrolledCourses || []).length + st.redemptions.filter((r) => r.studentId === s.id).length,
    redemptions: st.redemptions.filter((r) => r.studentId === s.id).length,
  };
}
export const studentRegion = (s) => (s.city || "").split(",").pop().trim();

// Rules the current student data can actually answer.
export const GROUP_RULES_AVAILABLE = ["minAvgProgress", "completedAny", "enrolledInCourses", "newWithinDays", "inactiveForDays", "neverPurchased", "minPurchases", "regions", "grades"];
export const GROUP_RULES_UNAVAILABLE = [
  "Minimum test score — needs test-attempt results per student",
  "Completed a test series — needs test-series attempt/completion data",
  "Institution — students have no institution field yet",
];
export function matchGroup(rules, students = getStudentsSnapshot(), st = _state) {
  const r = rules || {};
  return students.filter((s) => {
    if (s.status === STUDENT_STATUS.BLOCKED) return false;
    const x = studentStats(s, st);
    if (r.minAvgProgress != null && r.minAvgProgress !== "" && x.avgProgress < Number(r.minAvgProgress)) return false;
    if (r.completedAny && x.completed.length === 0) return false;
    if (r.enrolledInCourses?.length && !(s.enrolledCourses || []).some((c) => r.enrolledInCourses.includes(c.title))) return false;
    if (r.newWithinDays && !(x.joinedDaysAgo <= Number(r.newWithinDays))) return false;
    if (r.inactiveForDays && !(x.inactiveDays != null && x.inactiveDays >= Number(r.inactiveForDays))) return false;
    if (r.neverPurchased && x.purchases > 0) return false;
    if (r.minPurchases && x.purchases < Number(r.minPurchases)) return false;
    if (r.regions?.length && !r.regions.includes(studentRegion(s))) return false;
    if (r.grades?.length && !r.grades.includes(s.grade)) return false;
    return true;
  });
}
export function describeGroup(rules) {
  const r = rules || {}; const out = [];
  if (r.minAvgProgress) out.push(`avg course progress ≥ ${r.minAvgProgress}%`);
  if (r.completedAny) out.push("completed a course");
  if (r.enrolledInCourses?.length) out.push(`enrolled in ${r.enrolledInCourses.length} selected course(s)`);
  if (r.newWithinDays) out.push(`joined in last ${r.newWithinDays} days`);
  if (r.inactiveForDays) out.push(`inactive ${r.inactiveForDays}+ days`);
  if (r.neverPurchased) out.push("never purchased");
  if (r.minPurchases) out.push(`${r.minPurchases}+ purchases (loyalty)`);
  if (r.regions?.length) out.push(`regions: ${r.regions.join(", ")}`);
  if (r.grades?.length) out.push(`grades: ${r.grades.join(", ")}`);
  return out.join(" · ") || "All active students";
}
export function audienceLabel(c) {
  if (c.audience?.mode === "students") return `Exclusive · ${c.audience.studentIds.length} student(s)`;
  if (c.audience?.mode === "group") return `Group · ${describeGroup(c.audience.group)}`;
  return "Public (anyone with the code)";
}

/* ---------------- validation (backend rules) ---------------- */
function resolveCode(st, raw) {
  const code = String(raw || "").trim().toUpperCase();
  if (!code) return null;
  const shared = st.campaigns.find((c) => c.codeMode === "shared" && c.code === code);
  if (shared) return { campaign: shared, code, unique: null };
  const u = st.coupons.find((x) => x.code === code);
  if (u) return { campaign: st.campaigns.find((c) => c.id === u.campaignId), code, unique: u };
  return null;
}

export function validateCoupons({ codes, studentId, items, at = Date.now(), state = _state }) {
  const errors = [];
  const student = getStudentsSnapshot().find((s) => s.id === studentId);
  if (!student) return { ok: false, errors: ["Student not found."], applied: [] };
  if (student.status === STUDENT_STATUS.BLOCKED) return { ok: false, errors: ["This student's account is blocked."], applied: [] };
  if (!items?.length) return { ok: false, errors: ["The cart is empty."], applied: [] };
  const list = [...new Set((codes || []).map((c) => String(c).trim().toUpperCase()).filter(Boolean))];
  if (!list.length) return { ok: false, errors: ["Enter a coupon code."], applied: [] };

  const resolved = [];
  for (const code of list) {
    const r = resolveCode(state, code);
    if (!r || !r.campaign) { errors.push(`${code}: not a valid coupon code.`); continue; }
    resolved.push(r);
  }
  if (resolved.length > 1 && resolved.some((r) => !r.campaign.stackable)) {
    errors.push("These coupons can't be combined — at least one doesn't allow stacking.");
  }
  if (errors.length) return { ok: false, errors, applied: [] };

  let cart = items.map((i) => ({ ...i }));
  const applied = [];
  const original = r2(items.reduce((a, i) => a + i.price, 0));
  const pastRedemptions = state.redemptions.filter((x) => x.studentId === studentId);
  const hadPurchase = (student.enrolledCourses || []).length > 0 || pastRedemptions.length > 0;

  for (const { campaign: c, code, unique } of resolved) {
    const fail = (m) => errors.push(`${code}: ${m}`);
    const status = effectiveStatus(c, state, at);
    if (status !== "active") { fail(status === "scheduled" ? "this offer hasn't started yet." : status === "expired" ? "this coupon has expired." : status === "exhausted" ? "this coupon has been fully redeemed." : `this coupon is ${STATUS_LABEL[status].toLowerCase()}.`); continue; }
    if (unique && unique.status === "redeemed") { fail("this code has already been used."); continue; }
    if (unique && unique.studentId && unique.studentId !== studentId) { fail("this code was issued to a different student."); continue; }
    if (c.kind === "referral" && unique?.referrerId === studentId) { fail("you can't use your own referral code."); continue; }
    if (c.audience?.mode === "students" && !c.audience.studentIds.includes(studentId)) { fail("this is a private coupon and isn't available to this student."); continue; }
    if (c.audience?.mode === "group" && !matchGroup(c.audience.group, [student], state).length) { fail("this student doesn't meet the eligibility conditions."); continue; }
    if (c.eligibility?.regions?.length && !c.eligibility.regions.includes(studentRegion(student))) { fail(`not available in ${studentRegion(student) || "this region"}.`); continue; }
    if (c.eligibility?.grades?.length && !c.eligibility.grades.includes(student.grade)) { fail(`not available for ${student.grade}.`); continue; }
    if (c.firstPurchaseOnly && hadPurchase) { fail("this offer is for first purchases only."); continue; }
    const mine = pastRedemptions.filter((x) => x.applied.some((a) => a.campaignId === c.id)).length;
    if (mine >= c.perStudentLimit) { fail(`already used ${mine} time(s) — the limit is ${c.perStudentLimit} per student.`); continue; }
    if (c.totalLimit != null && redeemedCount(state, c.id) >= c.totalLimit) { fail("this coupon has been fully redeemed."); continue; }
    const calc = computeDiscount(c, cart);
    if (!calc.ok) { fail(calc.reason); continue; }
    applied.push({ campaignId: c.id, campaignName: c.name, code, uniqueCode: !!unique, discount: calc.discount, perItem: calc.perItem, terms: { type: c.type, value: c.value, maxDiscount: c.maxDiscount, minPurchase: c.minPurchase, kind: c.kind }, referrerId: unique?.referrerId || null });
    cart = cart.map((it) => { const p = calc.perItem.find((x) => x.type === it.type && x.id === it.id); return p ? { ...it, price: r2(it.price - p.discount) } : it; });
  }
  if (errors.length) return { ok: false, errors, applied: [] };
  const totalDiscount = r2(applied.reduce((a, x) => a + x.discount, 0));
  return { ok: true, errors: [], applied, original, totalDiscount, final: r2(original - totalDiscount), items: cart };
}

export function redeemCoupons({ codes, studentId, items, at = Date.now(), actor }) {
  const v = validateCoupons({ codes, studentId, items, at, state: _state }); // validation and write happen against the same state object
  if (!v.ok) return v;
  const student = getStudentsSnapshot().find((s) => s.id === studentId);
  const red = {
    id: uid("r"), studentId, studentName: student.name, at: new Date(at).toISOString(),
    items: items.map((i) => ({ type: i.type, id: i.id, name: i.name, price: i.price })),
    applied: v.applied, original: v.original, discount: v.totalDiscount, final: v.final,
    txnRef: `TXN-${_state.seq + 1}`, recordedBy: actor?.name || "Admin User",
  };
  let st = { ..._state, seq: _state.seq + 1, redemptions: [red, ..._state.redemptions] };
  st = {
    ...st,
    coupons: st.coupons.map((c) => (v.applied.some((a) => a.code === c.code && a.uniqueCode) ? { ...c, status: "redeemed", redeemedBy: studentId, redeemedAt: red.at } : c)),
    assignments: st.assignments.map((a) => (v.applied.some((x) => x.campaignId === a.campaignId) && a.studentId === studentId && !a.redeemedAt ? { ...a, redeemedAt: red.at } : a)),
  };
  v.applied.forEach((a) => {
    st = withAudit(st, { name: student.name, role: "student" }, "Redeemed", { id: a.campaignId, name: a.campaignName }, `${a.code}: ${inr(a.discount)} off ${inr(red.original)} → ${inr(red.final)} (${red.txnRef}).`);
  });
  commit(st);
  return { ...v, redemption: red };
}

// Recompute a stored redemption from the terms captured when it happened.
export function verifyRedemption(r) {
  let cart = r.items.map((i) => ({ ...i }));
  let total = 0;
  for (const a of r.applied) {
    const calc = computeDiscount({ ...a.terms, scope: "both", productIds: [], comboProducts: a.terms.kind === "combo" ? a.perItem.map((p) => ({ type: p.type, id: p.id })) : [], minPrice: null, maxPrice: null }, cart);
    const paidItems = a.perItem.map((p) => ({ type: p.type, id: p.id }));
    const expected = a.terms.kind === "combo" || calc.ok ? calc.discount : 0;
    if (Math.abs(expected - a.discount) > 0.011 && paidItems.length) {
      // scope/price-band rules aren't in the snapshot, so fall back to recomputing from the recorded eligible items
      const sub = r2(a.perItem.reduce((s, p) => s + p.original, 0));
      let d = a.terms.type === "percent" ? (sub * a.terms.value) / 100 : a.terms.value;
      if (a.terms.type === "percent" && a.terms.maxDiscount) d = Math.min(d, a.terms.maxDiscount);
      if (Math.abs(r2(Math.min(d, sub)) - a.discount) > 0.011) return false;
    }
    total = r2(total + a.discount);
    cart = cart.map((it) => { const p = a.perItem.find((x) => x.type === it.type && x.id === it.id); return p ? { ...it, price: r2(it.price - p.discount) } : it; });
  }
  return Math.abs(total - r.discount) < 0.011 && Math.abs(r2(r.original - r.discount) - r.final) < 0.011;
}

/* ---------------- campaign lifecycle ---------------- */
const fail = (error) => ({ ok: false, error });
const guard = (actor, action) => (can(actor?.role, action) ? null : fail("You don't have permission to do that."));

function normalise(d) {
  const num = (x) => (x === "" || x == null ? null : Number(x));
  return {
    ...d, name: d.name.trim(), description: (d.description || "").trim(), code: (d.code || "").trim().toUpperCase(), prefix: (d.prefix || "").trim().toUpperCase(),
    value: Number(d.value), minPurchase: num(d.minPurchase), maxDiscount: d.type === "percent" ? num(d.maxDiscount) : null,
    minPrice: num(d.minPrice), maxPrice: num(d.maxPrice), totalLimit: num(d.totalLimit), perStudentLimit: Number(d.perStudentLimit),
    startAt: new Date(d.startAt).toISOString(), endAt: new Date(d.endAt).toISOString(),
  };
}

export function createCampaign(input, actor, { asDraft = false } = {}) {
  const g = guard(actor, "create"); if (g) return g;
  const errors = validateCampaignInput(input, { campaigns: _state.campaigns });
  if (Object.keys(errors).length) return { ok: false, errors, error: "Fix the highlighted fields." };
  const c = baseCampaign({ ...normalise(input), id: nextCampaignId(_state), state: asDraft ? "draft" : "active", createdBy: actor?.name || "Admin User" });
  let st = { ..._state, campaigns: [c, ..._state.campaigns] };
  st = withAudit(st, actor, "Created", c, `${KINDS[c.kind]} · ${c.type === "percent" ? c.value + "%" : inr(c.value)} · ${asDraft ? "saved as draft" : "activated"}.`);
  commit(st);
  return { ok: true, campaign: c };
}

export function updateCampaign(id, input, actor) {
  const g = guard(actor, "edit"); if (g) return g;
  const cur = _state.campaigns.find((c) => c.id === id);
  if (!cur) return fail("Discount not found.");
  if (cur.state === "archived") return fail("Restore the discount before editing it.");
  const errors = validateCampaignInput(input, { existingId: id, campaigns: _state.campaigns });
  if (Object.keys(errors).length) return { ok: false, errors, error: "Fix the highlighted fields." };
  const used = redeemedCount(_state, id);
  const next = normalise(input);
  if (used > 0 && next.totalLimit != null && next.totalLimit < used) return { ok: false, errors: { totalLimit: `${used} redemption(s) already happened.` }, error: "Fix the highlighted fields." };
  const changed = ["name", "code", "type", "value", "minPurchase", "maxDiscount", "totalLimit", "perStudentLimit", "startAt", "endAt", "scope"].filter((k) => JSON.stringify(cur[k]) !== JSON.stringify(next[k]));
  const c = { ...cur, ...next, id, state: cur.state, createdAt: cur.createdAt, createdBy: cur.createdBy, expiredLogged: false, updatedAt: nowIso() };
  commit(withAudit({ ..._state, campaigns: _state.campaigns.map((x) => (x.id === id ? c : x)) }, actor, "Edited", c, changed.length ? `Changed: ${changed.join(", ")}.` : "Saved without field changes. Past redemptions are unchanged."));
  return { ok: true, campaign: c };
}

export function setCampaignState(id, action, actor) {
  const g = guard(actor, "approve"); if (g) return g;
  const c = _state.campaigns.find((x) => x.id === id); if (!c) return fail("Discount not found.");
  const eff = effectiveStatus(c);
  const map = {
    activate: { from: ["draft", "inactive"], to: "active", label: "Activated" },
    deactivate: { from: ["active", "paused"], to: "inactive", label: "Deactivated" },
    pause: { from: ["active"], to: "paused", label: "Paused" },
    resume: { from: ["paused"], to: "active", label: "Resumed" },
    archive: { from: ["draft", "inactive", "paused", "active"], to: "archived", label: "Archived" },
    restore: { from: ["archived"], to: "inactive", label: "Restored" },
  }[action];
  if (!map) return fail("Unknown action.");
  if (!map.from.includes(c.state)) return fail(`A ${STATUS_LABEL[eff].toLowerCase()} discount can't be ${map.label.toLowerCase()}.`);
  if (action === "archive" && eff === "active") return fail("Deactivate or pause the discount before archiving it.");
  if (action === "activate" && new Date(c.endAt) < new Date()) return fail("This discount's expiry date has passed — edit the dates first.");
  commit(withAudit({ ..._state, campaigns: _state.campaigns.map((x) => (x.id === id ? { ...x, state: map.to, updatedAt: nowIso() } : x)) }, actor, map.label, c, action === "activate" && new Date(c.startAt) > new Date() ? `Scheduled to go live ${new Date(c.startAt).toLocaleString("en-IN")}.` : ""));
  return { ok: true };
}

export function duplicateCampaign(id, actor) {
  const g = guard(actor, "create"); if (g) return g;
  const c = _state.campaigns.find((x) => x.id === id); if (!c) return fail("Discount not found.");
  const copy = { ...c, id: nextCampaignId(_state), name: `${c.name} (Copy)`, code: c.codeMode === "shared" ? generateCode("COPY") : "", state: "draft", createdAt: nowIso(), updatedAt: nowIso(), createdBy: actor?.name || "Admin User", expiredLogged: false, audience: { ...c.audience, studentIds: [...(c.audience?.studentIds || [])] } };
  commit(withAudit({ ..._state, campaigns: [copy, ..._state.campaigns] }, actor, "Duplicated", copy, `Copied from ${c.id}${c.code ? " (" + c.code + ")" : ""} as a draft.`));
  return { ok: true, campaign: copy };
}

export function deleteCampaign(id, actor) {
  const g = guard(actor, "delete"); if (g) return g;
  const c = _state.campaigns.find((x) => x.id === id); if (!c) return fail("Discount not found.");
  if (c.state !== "draft") return fail("Only draft discounts can be deleted — archive others instead.");
  if (redeemedCount(_state, id) > 0 || _state.assignments.some((a) => a.campaignId === id)) return fail("This draft already has assigned or redeemed coupons, so it can only be archived.");
  commit(withAudit({ ..._state, campaigns: _state.campaigns.filter((x) => x.id !== id), coupons: _state.coupons.filter((x) => x.campaignId !== id) }, actor, "Deleted", c, "Unused draft deleted. Audit entries are kept."));
  return { ok: true };
}

/* ---------------- codes ---------------- */
const ALPHA = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
export function generateCode(prefix = "UL", len = 6) {
  let s = ""; for (let i = 0; i < len; i++) s += ALPHA[Math.floor(Math.random() * ALPHA.length)];
  return `${String(prefix).toUpperCase()}${prefix ? "-" : ""}${s}`;
}
function freshCode(st, prefix, taken) {
  for (let i = 0; i < 50; i++) {
    const code = generateCode(prefix);
    if (!taken.has(code) && !st.coupons.some((c) => c.code === code) && !st.campaigns.some((c) => c.code === code)) { taken.add(code); return code; }
  }
  return `${prefix}-${uid("")}`.toUpperCase();
}

// Unassigned bulk codes (any student can use each once).
export function generateBulkCodes(campaignId, count, actor) {
  const g = guard(actor, "create"); if (g) return g;
  const c = _state.campaigns.find((x) => x.id === campaignId); if (!c) return fail("Discount not found.");
  if (c.codeMode !== "unique") return fail("Bulk codes need a discount set to unique codes.");
  const n = Number(count);
  if (!Number.isInteger(n) || n < 1 || n > 1000) return fail("Enter between 1 and 1000 codes.");
  const taken = new Set();
  const made = Array.from({ length: n }, () => ({ code: freshCode(_state, c.prefix, taken), campaignId, studentId: null, referrerId: null, status: "issued", createdAt: nowIso() }));
  commit(withAudit({ ..._state, coupons: [...made, ..._state.coupons] }, actor, "Bulk codes generated", c, `${n} unique codes (${c.prefix}-…).`));
  return { ok: true, codes: made };
}

/* ---------------- distribution ---------------- */
export function assignCoupons({ campaignId, studentIds, notify = true, actor }) {
  const g = guard(actor, "edit"); if (g) return g;
  const c = _state.campaigns.find((x) => x.id === campaignId); if (!c) return fail("Discount not found.");
  if (["archived", "expired"].includes(effectiveStatus(c))) return fail("This discount can't receive new assignments.");
  const students = getStudentsSnapshot();
  let st = _state; const taken = new Set(); const result = { assigned: [], duplicates: [], blocked: [] };
  const at = nowIso();
  studentIds.forEach((sid) => {
    const s = students.find((x) => x.id === sid); if (!s) return;
    if (s.status === STUDENT_STATUS.BLOCKED) { result.blocked.push(s); return; }
    if (st.assignments.some((a) => a.campaignId === campaignId && a.studentId === sid)) { result.duplicates.push(s); return; }
    let code = c.code;
    if (c.codeMode === "unique") {
      code = freshCode(st, c.prefix, taken);
      st = { ...st, coupons: [{ code, campaignId, studentId: sid, referrerId: c.kind === "referral" ? sid : null, status: "issued", createdAt: at }, ...st.coupons] };
    }
    const a = { id: uid("as"), campaignId, studentId: sid, studentName: s.name, code, assignedAt: at, deliveredAt: notify ? at : null, redeemedAt: null, reminderSentAt: null };
    st = { ...st, assignments: [a, ...st.assignments] };
    if (notify) st = { ...st, inbox: [{ id: uid("in"), studentId: sid, campaignId, code, kind: "coupon", message: `You've received ${c.type === "percent" ? c.value + "%" : inr(c.value)} off with code ${code}. Valid until ${new Date(c.endAt).toLocaleDateString("en-IN")}.`, at }, ...st.inbox] };
    result.assigned.push(s);
  });
  if (result.assigned.length) {
    st = withAudit(st, actor, "Coupons assigned", c, `${result.assigned.length} student(s)${notify ? ", notified" : ", not notified"}${result.duplicates.length ? `; ${result.duplicates.length} already had it` : ""}.`);
    commit(st);
    if (notify) addNotification({ type: "system", title: "Coupons distributed", message: `${c.name}: ${result.assigned.length} student(s) notified (queued in the student inbox — email delivery isn't connected yet).`, link: "/admin/discounts" });
  }
  return { ok: true, ...result };
}

export function sendExpiryReminders(withinDays, actor) {
  const g = guard(actor, "edit"); if (g) return g;
  const limit = Date.now() + withinDays * DAY; let st = _state; let n = 0;
  st.assignments.forEach((a) => {
    const c = st.campaigns.find((x) => x.id === a.campaignId);
    if (!c || a.redeemedAt || a.reminderSentAt || effectiveStatus(c, st) !== "active" || new Date(c.endAt).getTime() > limit) return;
    st = { ...st, assignments: st.assignments.map((x) => (x.id === a.id ? { ...x, reminderSentAt: nowIso() } : x)), inbox: [{ id: uid("in"), studentId: a.studentId, campaignId: c.id, code: a.code, kind: "reminder", message: `Your coupon ${a.code} expires on ${new Date(c.endAt).toLocaleDateString("en-IN")}.`, at: nowIso() }, ...st.inbox] };
    n += 1;
  });
  if (n) { st = withAudit(st, actor, "Expiry reminders sent", null, `${n} reminder(s) for coupons ending within ${withinDays} day(s).`); commit(st); addNotification({ type: "system", title: "Expiry reminders sent", message: `${n} student(s) reminded about expiring coupons.`, link: "/admin/discounts" }); }
  return { ok: true, sent: n };
}

export function assignmentStatus(a, st = _state) {
  const c = st.campaigns.find((x) => x.id === a.campaignId);
  if (a.redeemedAt) return "redeemed";
  if (c && ["expired", "archived"].includes(effectiveStatus(c, st))) return "expired";
  return a.deliveredAt ? "delivered" : "assigned";
}

/* ---------------- seed (runs the real engine) ---------------- */
if (_state.campaigns.length === 0) {
  const cat = getCatalog();
  const courses = cat.filter((x) => x.type === "course"); const series = cat.filter((x) => x.type === "test_series");
  const admin = { name: "Admin User", role: "admin" };
  let seedNo = 1000;
  const mk = (o) => baseCampaign({ id: `DSC-${++seedNo}`, ...o });
  const seeds = [
    mk({ name: "Welcome 10%", description: "10% off for first-time buyers of a test series.", code: "WELCOME10", type: "percent", value: 10, maxDiscount: 500, scope: "all_test_series", firstPurchaseOnly: true, startAt: daysFromNow(-20), endAt: daysFromNow(40), totalLimit: 200, perStudentLimit: 1 }),
    mk({ name: "Test Series Flash Sale", description: "Weekend flash sale on paid test series.", kind: "flash", code: "FLASH200", type: "fixed", value: 200, minPurchase: 499, scope: "all_test_series", startAt: daysFromNow(-1), endAt: daysFromNow(2), totalLimit: 50, perStudentLimit: 1 }),
    mk({ name: "Test Series Booster", description: "Flat 15% on selected test series.", code: "BOOST15", type: "percent", value: 15, maxDiscount: 1000, scope: series.length ? "selected_test_series" : "all_test_series", productIds: series.slice(0, 2).map((x) => x.id), startAt: daysFromNow(-30), endAt: daysFromNow(30), perStudentLimit: 1, stackable: true }),
    mk({ name: "Summer Test Series Sale", description: "Ended discount.", code: "SUMMER25", type: "percent", value: 25, maxDiscount: 750, scope: "all_test_series", startAt: daysFromNow(-60), endAt: daysFromNow(-10), perStudentLimit: 1, expiredLogged: true }),
    mk({ name: "Spring Early Bird (upcoming)", description: "Scheduled discount.", code: "SPRING20", type: "percent", value: 20, scope: "all_test_series", startAt: daysFromNow(10), endAt: daysFromNow(25), perStudentLimit: 1 }),
  ];
  let st = { ..._state, campaigns: seeds };
  seeds.forEach((c) => { st = withAudit(st, admin, "Created", c, `${KINDS[c.kind]} · ${c.type === "percent" ? c.value + "%" : inr(c.value)}.`); });
  _state = st;
  const studs = getStudentsSnapshot().filter((s) => s.status === STUDENT_STATUS.ACTIVE);
  const buy = (code, sIdx, picks, daysAgo) => {
    const s = studs[sIdx]; const items = picks.filter(Boolean); if (!s || !items.length) return;
    redeemCoupons({ codes: [code], studentId: s.id, items, at: Date.now() - daysAgo * DAY, actor: admin });
  };
  buy("SUMMER25", 0, [series[0]], 25);
  buy("SUMMER25", 1, [series[1] || series[0]], 18);
  buy("BOOST15", 2, [series[0]], 9);
  buy("BOOST15", 3, [series[1] || series[0]], 6);
  buy("FLASH200", 3, [series[0]], 0);
  buy("WELCOME10", 4, [series[1] || series[0]], 3);
  commit(_state);
}
