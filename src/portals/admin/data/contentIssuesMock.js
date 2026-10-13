// Content moderation issues handled by Regional Heads.
//
// One record per flagged item. Every transition (flag -> head resolves /
// escalates -> admin reviews / resolves / rejects / returns -> head replies,
// admin reopens) goes through the functions below, which append to the
// issue's audit `history`. The Resolved and Escalated sections of the
// Content Moderation page are filtered views of this single list, so an
// issue can never be duplicated across them.
//
// Persisted in localStorage. Regional Head actions are exposed as plain store
// functions (headResolve / headEscalate / headRespond) so a Regional Head
// portal can call them; until that portal exists the admin page offers a
// clearly labelled "act on behalf of the Regional Head" control. Notifications
// to Regional Heads are queued in `headInbox` (no real delivery yet).

import { useSyncExternalStore } from "react";
import { activeHeadForRegion, getRegionalState } from "./regionalHeadsMock";
import { addNotification } from "./notificationsMock";

export const CONTENT_TYPES = ["Test Series", "Question", "Review", "Other"];
export const ESCALATION_REASONS = [
  "Policy violation",
  "Legal / copyright concern",
  "Needs higher authority",
  "Cross-region impact",
  "Repeat offender",
  "Other",
];

export const ISSUE_STATUS = {
  OPEN: "open", // with the Regional Head
  RESOLVED: "resolved",
  REOPENED: "reopened", // admin reopened a head-resolved issue; back with the head
  ESCALATED: "escalated", // awaiting admin
  UNDER_REVIEW: "under_review", // admin opened it
  RETURNED: "returned", // admin sent it back to the head for clarification
  ADMIN_RESOLVED: "admin_resolved",
  REJECTED: "rejected",
  HEAD_REJECTED: "head_rejected", // Regional Head rejected / dismissed the flag
};

export const ISSUE_STATUS_LABEL = {
  open: "With Regional Head",
  resolved: "Resolved",
  reopened: "Reopened",
  escalated: "Escalated",
  under_review: "Under Review",
  returned: "Returned",
  admin_resolved: "Resolved by Admin",
  rejected: "Rejected",
  head_rejected: "Rejected",
};
export const ISSUE_STATUS_BADGE = {
  open: "is-pending",
  resolved: "is-approved",
  reopened: "is-rejected",
  escalated: "is-pending",
  under_review: "is-verified",
  returned: "is-account-inactive",
  admin_resolved: "is-approved",
  rejected: "is-rejected",
  head_rejected: "is-rejected",
};

// which section an issue belongs to
// Section 1 (read-only): issues a Regional Head closed — resolved or rejected.
export const isResolvedSection = (i) => i.status === "resolved" || i.status === "head_rejected";
// Section 2: issues Regional Heads escalated for the Admin to resolve.
export const isEscalatedSection = (i) => i.status === "escalated" || i.status === "admin_resolved";

const STORAGE_KEY = "ul_admin_content_issues_v4";
const DAY = 86400000;
const iso = (ms) => new Date(ms).toISOString();
const ago = (d, h = 0) => iso(Date.now() - d * DAY - h * 3600000);

let _seq = 0;
const uid = (p) => `${p}${Date.now().toString(36)}${(_seq++).toString(36)}`;

function ev(at, actor, role, action, note) {
  return { id: uid("h"), at, actor, role, action, note: note || "" };
}

function seedIssues() {
  const mk = (o) => o;
  return [
    mk({
      id: "FLG-1001", title: "JEE Main Physics Test Series 2026 — inaccurate syllabus claims",
      description: "Test series page promises a rank guarantee that the series content does not support.",
      contentType: "Test Series", contentRef: "JEE Main Physics Test Series 2026", flaggedBy: "Learner · Ana Perez",
      flagReason: "Misleading claims", region: "Delhi", headName: "Alan Turing", headEmail: "alan.turing@example.com",
      status: "resolved", flaggedAt: ago(9), headResolvedAt: ago(7), escalatedAt: null, closedAt: null,
      resolution: "Educator removed the rank-guarantee wording and the test series page was re-checked.",
      escalationReason: "", escalationNote: "", adminNotes: [], reopenCount: 0,
      history: [
        ev(ago(9), "Ana Perez", "Learner", "Flagged", "Misleading claims"),
        ev(ago(9), "System", "System", "Assigned", "Assigned to Alan Turing (Delhi)"),
        ev(ago(7), "Alan Turing", "Regional Head", "Resolved", "Educator removed the rank-guarantee wording and the test series page was re-checked."),
      ],
    }),
    mk({
      id: "FLG-1002", title: "Q-5521 — answer key looks wrong",
      description: "Question 14 in Organic Chemistry mock lists option C as correct; reviewers say B.",
      contentType: "Question", contentRef: "Organic Chemistry Mock · Q14", flaggedBy: "Educator · Prof. Rao",
      flagReason: "Incorrect answer key", region: "Bengaluru", headName: "Meredith Chan", headEmail: "meredith.chan@example.com",
      status: "resolved", flaggedAt: ago(6), headResolvedAt: ago(5), escalatedAt: null, closedAt: null,
      resolution: "Answer key corrected to option B; attempts re-scored.",
      escalationReason: "", escalationNote: "", adminNotes: [], reopenCount: 0,
      history: [
        ev(ago(6), "Prof. Rao", "Educator", "Flagged", "Incorrect answer key"),
        ev(ago(6), "System", "System", "Assigned", "Assigned to Meredith Chan (Bengaluru)"),
        ev(ago(5), "Meredith Chan", "Regional Head", "Resolved", "Answer key corrected to option B; attempts re-scored."),
      ],
    }),
    mk({
      id: "FLG-1003", title: "JEE Full Mock 4 — copied question set",
      description: "Large parts of this test series appear copied from a third-party publisher.",
      contentType: "Test Series", contentRef: "JEE Full Mock 4", flaggedBy: "System · similarity check",
      flagReason: "Possible copyright issue", region: "Delhi", headName: "Alan Turing", headEmail: "alan.turing@example.com",
      status: "escalated", flaggedAt: ago(4), headResolvedAt: null, escalatedAt: ago(3), closedAt: null,
      resolution: "", escalationReason: "Legal / copyright concern",
      escalationNote: "Needs a decision on takedown; outside regional authority.", adminNotes: [], reopenCount: 0,
      history: [
        ev(ago(4), "System", "System", "Flagged", "Possible copyright issue"),
        ev(ago(4), "System", "System", "Assigned", "Assigned to Alan Turing (Delhi)"),
        ev(ago(3), "Alan Turing", "Regional Head", "Escalated to Admin", "Legal / copyright concern — Needs a decision on takedown; outside regional authority."),
      ],
    }),
    mk({
      id: "FLG-1004", title: "Spoken English Basics — abusive review thread",
      description: "A review thread contains personal attacks directed at the educator.",
      contentType: "Review", contentRef: "Spoken English Basics · reviews", flaggedBy: "Educator · Priya Kapoor",
      flagReason: "Abusive language", region: "Bengaluru", headName: "Meredith Chan", headEmail: "meredith.chan@example.com",
      status: "escalated", flaggedAt: ago(5), headResolvedAt: null, escalatedAt: ago(3, 5), closedAt: null,
      resolution: "", escalationReason: "Policy violation",
      escalationNote: "Repeated attacks from the same accounts across test series.", adminNotes: [], reopenCount: 0,
      history: [
        ev(ago(5), "Priya Kapoor", "Educator", "Flagged", "Abusive language"),
        ev(ago(5), "System", "System", "Assigned", "Assigned to Meredith Chan (Bengaluru)"),
        ev(ago(3, 5), "Meredith Chan", "Regional Head", "Escalated to Admin", "Policy violation — Repeated attacks from the same accounts across test series."),
      ],
    }),
    mk({
      id: "FLG-1005", title: "Q-7710 — ambiguous wording",
      description: "Learners report the question can be read two ways.",
      contentType: "Question", contentRef: "Physics Chapter Test 3 · Q7", flaggedBy: "Learner · Rohit Das",
      flagReason: "Ambiguous question", region: "Delhi", headName: "Alan Turing", headEmail: "alan.turing@example.com",
      status: "open", flaggedAt: ago(0, 6), headResolvedAt: null, escalatedAt: null, closedAt: null,
      resolution: "", escalationReason: "", escalationNote: "", adminNotes: [], reopenCount: 0,
      history: [
        ev(ago(0, 6), "Rohit Das", "Learner", "Flagged", "Ambiguous question"),
        ev(ago(0, 6), "System", "System", "Assigned", "Assigned to Alan Turing (Delhi)"),
      ],
    }),
    mk({
      id: "FLG-1006", title: "NEET Biology Crash Course Series — outdated NCERT references",
      description: "Questions cite a syllabus version that was withdrawn.",
      contentType: "Test Series", contentRef: "NEET Biology Crash Course Series", flaggedBy: "Learner · Sneha Iyer",
      flagReason: "Outdated content", region: "Bengaluru", headName: "Meredith Chan", headEmail: "meredith.chan@example.com",
      status: "head_rejected", flaggedAt: ago(8), headResolvedAt: ago(6), escalatedAt: null, closedAt: null,
      resolution: "Rejected: the questions were already updated to the current syllabus.",
      escalationReason: "", escalationNote: "", adminNotes: [], reopenCount: 0,
      history: [
        ev(ago(8), "Sneha Iyer", "Learner", "Flagged", "Outdated content"),
        ev(ago(8), "System", "System", "Assigned", "Assigned to Meredith Chan (Bengaluru)"),
        ev(ago(6), "Meredith Chan", "Regional Head", "Rejected", "Rejected: the questions were already updated to the current syllabus."),
      ],
    }),
  ];
}

function load() {
  try {
    const raw = typeof localStorage !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (raw) {
      const p = JSON.parse(raw);
      if (p && Array.isArray(p.issues)) return { headInbox: [], ...p };
    }
  } catch (e) { /* fall back to seed */ }
  return { issues: seedIssues(), headInbox: [] };
}

let _state = load();
const _listeners = new Set();
function setState(next) {
  _state = next;
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(_state)); } catch (e) { /* ignore */ }
  _listeners.forEach((fn) => fn());
}
const _sub = (fn) => { _listeners.add(fn); return () => _listeners.delete(fn); };
if (typeof window !== "undefined") {
  window.addEventListener("storage", (e) => {
    if (e.key === STORAGE_KEY) { _state = load(); _listeners.forEach((fn) => fn()); }
  });
}

export function useContentIssues() {
  return useSyncExternalStore(_sub, () => _state).issues;
}
export function useHeadInbox() {
  return useSyncExternalStore(_sub, () => _state).headInbox;
}

const now = () => new Date().toISOString();
const ADMIN = "Admin User";

function nextId() {
  const nums = _state.issues.map((i) => Number(String(i.id).replace(/\D/g, "")) || 0);
  return `FLG-${Math.max(1000, ...nums) + 1}`;
}

function patch(id, fn, historyEntry, notifyHead) {
  const issue = _state.issues.find((i) => i.id === id);
  if (!issue) return { ok: false, error: "Issue not found." };
  const updated = fn(issue);
  updated.history = [...issue.history, historyEntry];
  let headInbox = _state.headInbox;
  if (notifyHead) {
    headInbox = [{ id: uid("in"), issueId: id, headName: issue.headName, headEmail: issue.headEmail, message: notifyHead, at: now(), read: false }, ...headInbox];
    updated.history.push(ev(now(), "System", "System", "Regional Head notified", `${issue.headName}: ${notifyHead}`));
  }
  setState({ issues: _state.issues.map((i) => (i.id === id ? updated : i)), headInbox });
  return { ok: true, issue: updated };
}

// ---- flagging ----
export function flagIssue({ title, description, contentType, contentRef, flaggedBy, flagReason, region }) {
  if (!title || !title.trim()) return { ok: false, error: "Add a title for the flagged content." };
  if (!region) return { ok: false, error: "Choose a region." };
  const head = activeHeadForRegion(region, getRegionalState());
  if (!head) return { ok: false, error: `The ${region} has no active Regional Head to assign this to.` };
  const at = now();
  const who = (flaggedBy || "").trim() || "Admin User";
  const issue = {
    id: nextId(), title: title.trim(), description: (description || "").trim(), contentType: contentType || "Other",
    contentRef: (contentRef || "").trim(), flaggedBy: who, flagReason: (flagReason || "").trim() || "Flagged for review",
    region, headName: head.name, headEmail: head.email, status: "open",
    flaggedAt: at, headResolvedAt: null, escalatedAt: null, closedAt: null, resolution: "", escalationReason: "", escalationNote: "",
    adminNotes: [], reopenCount: 0,
    history: [
      ev(at, who, "Reporter", "Flagged", (flagReason || "").trim() || "Flagged for review"),
      ev(at, "System", "System", "Assigned", `Assigned to ${head.name} (${region})`),
      ev(at, "System", "System", "Regional Head notified", `${head.name}: New content issue ${"assigned to you"}`),
    ],
  };
  setState({
    issues: [issue, ..._state.issues],
    headInbox: [{ id: uid("in"), issueId: issue.id, headName: head.name, headEmail: head.email, message: `New content issue assigned: ${issue.title}`, at, read: false }, ..._state.headInbox],
  });
  return { ok: true, issue };
}

// ---- Regional Head actions ----
export function headResolve(id, resolution) {
  const text = (resolution || "").trim();
  if (!text) return { ok: false, error: "Describe how the issue was resolved." };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || !["open", "reopened", "returned"].includes(cur.status)) return { ok: false, error: "This issue can't be resolved in its current state." };
  const res = patch(id, (i) => ({ ...i, status: "resolved", headResolvedAt: now(), resolution: text, escalatedAt: i.status === "returned" ? i.escalatedAt : null }),
    ev(now(), cur.headName, "Regional Head", "Resolved", text));
  if (res.ok) addNotification({ type: "approval", title: "Content issue resolved by Regional Head", message: `${cur.headName} resolved "${cur.title}" (${cur.region}).`, link: `/admin/contentmoderation?tab=resolved&issue=${id}` });
  return res;
}
export function headReject(id, reason) {
  const text = (reason || "").trim();
  if (!text) return { ok: false, error: "Give a reason for rejecting the flag." };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || cur.status !== "open") return { ok: false, error: "This issue can't be rejected in its current state." };
  return patch(id, (i) => ({ ...i, status: "head_rejected", headResolvedAt: now(), resolution: text }),
    ev(now(), cur.headName, "Regional Head", "Rejected", text));
}
export function headEscalate(id, reason, note) {
  if (!reason) return { ok: false, error: "Choose an escalation reason." };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || !["open", "reopened"].includes(cur.status)) return { ok: false, error: "This issue can't be escalated in its current state." };
  const n = (note || "").trim();
  const res = patch(id, (i) => ({ ...i, status: "escalated", escalatedAt: now(), escalationReason: reason, escalationNote: n }),
    ev(now(), cur.headName, "Regional Head", "Escalated to Admin", `${reason}${n ? " — " + n : ""}`));
  if (res.ok) addNotification({ type: "approval", title: "Content issue escalated to Admin", message: `${cur.headName} escalated "${cur.title}" (${cur.region}) — ${reason}.`, link: `/admin/contentmoderation?tab=escalated&issue=${id}` });
  return res;
}
export function headRespond(id, note) {
  const n = (note || "").trim();
  if (!n) return { ok: false, error: "Add the clarification for the Admin." };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || cur.status !== "returned") return { ok: false, error: "This issue wasn't returned for clarification." };
  const res = patch(id, (i) => ({ ...i, status: "escalated" }), ev(now(), cur.headName, "Regional Head", "Clarification sent — re-escalated", n));
  if (res.ok) addNotification({ type: "approval", title: "Regional Head replied to a returned issue", message: `${cur.headName} answered your question on "${cur.title}".`, link: `/admin/contentmoderation?tab=escalated&issue=${id}` });
  return res;
}

// ---- Admin actions ----
export function adminOpenReview(id) {
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || cur.status !== "escalated") return { ok: false, error: "Only escalated issues can be opened for review." };
  return patch(id, (i) => ({ ...i, status: "under_review" }), ev(now(), ADMIN, "Admin", "Opened for review", ""));
}
export function adminAddNote(id, text) {
  const t = (text || "").trim();
  if (!t) return { ok: false, error: "Write a note first." };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur) return { ok: false, error: "Issue not found." };
  const note = { id: uid("an"), at: now(), by: ADMIN, text: t };
  return patch(id, (i) => ({ ...i, adminNotes: [...i.adminNotes, note] }), ev(now(), ADMIN, "Admin", "Internal note added", ""));
}
function requireComment(c, what) {
  const t = (c || "").trim();
  return t ? null : `Add a comment explaining why you ${what}.`;
}
export function adminResolve(id, comment) {
  const err = requireComment(comment, "resolved this");
  if (err) return { ok: false, error: err };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || !["escalated", "under_review"].includes(cur.status)) return { ok: false, error: "This issue isn't awaiting Admin action." };
  return patch(id, (i) => ({ ...i, status: "admin_resolved", closedAt: now(), resolution: comment.trim() }),
    ev(now(), ADMIN, "Admin", "Resolved", comment.trim()), `Admin resolved "${cur.title}": ${comment.trim()}`);
}
export function adminReject(id, comment) {
  const err = requireComment(comment, "rejected this");
  if (err) return { ok: false, error: err };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || !["escalated", "under_review"].includes(cur.status)) return { ok: false, error: "This issue isn't awaiting Admin action." };
  return patch(id, (i) => ({ ...i, status: "rejected", closedAt: now(), resolution: comment.trim() }),
    ev(now(), ADMIN, "Admin", "Rejected", comment.trim()), `Admin rejected the escalation for "${cur.title}": ${comment.trim()}`);
}
export function adminReturn(id, comment) {
  const err = requireComment(comment, "returned this");
  if (err) return { ok: false, error: err };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || !["escalated", "under_review"].includes(cur.status)) return { ok: false, error: "This issue isn't awaiting Admin action." };
  return patch(id, (i) => ({ ...i, status: "returned" }),
    ev(now(), ADMIN, "Admin", "Returned to Regional Head", comment.trim()), `Admin needs clarification on "${cur.title}": ${comment.trim()}`);
}
export function adminReopen(id, comment) {
  const err = requireComment(comment, "reopened this");
  if (err) return { ok: false, error: err };
  const cur = _state.issues.find((i) => i.id === id);
  if (!cur || cur.status !== "resolved") return { ok: false, error: "Only resolved issues can be reopened." };
  return patch(id, (i) => ({ ...i, status: "reopened", reopenCount: (i.reopenCount || 0) + 1 }),
    ev(now(), ADMIN, "Admin", "Reopened", comment.trim()), `Admin reopened "${cur.title}": ${comment.trim()}`);
}
