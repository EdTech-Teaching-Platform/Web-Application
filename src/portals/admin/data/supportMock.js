// Help Desk / Support Tickets + Callback Requests — mock data.
// Jira: Day 15 — Help desk / support tickets + callback requests
// Help Desk / Support Tickets: Give every role a structured way to raise an issue
// and track its resolution. Student, Educator, Parent, Institution,
// Admin. How It Works: A ticketing system — a user raises an issue, it
// is routed to the right team, and both sides can see status and
// replies until it's resolved. Expected Outcome: Faster issue resolution
// and a durable record of what was raised and how it was handled." and
// "Callback Request / Founder Note Capture: Capture a direct outreach
// request for manual follow-up. Visitor, Admin. How It Works: A simple
// contact-capture form routed to the team. Expected Outcome: Logged
// lead/request for follow-up. ⚠ Not detailed in the Technical Design
// Document — a lightweight contact-capture feature likely outside the
// core schema, so kept intentionally simple here (no ticket thread,
// no SLA/priority — just capture + a follow-up note + a status)."
//
// UI-only placeholder data; replace with real calls through
// ../services/adminApi.js once the help-desk endpoints exist. Follows
// the same tiny pub/sub "store" pattern already used by
// data/studentsMock.js / data/permissionsMock.js / data/certificatesMock.js
// so SupportTickets.jsx stays in sync across re-renders without a real
// API layer.

import { useSyncExternalStore } from "react";

/* ============================== Support tickets ============================== */

export const TICKET_STATUS = {
  IN_PROGRESS: "in-progress",
  RESOLVED: "resolved",
};

export const TICKET_STATUS_LABEL = {
  [TICKET_STATUS.IN_PROGRESS]: "In Progress",
  [TICKET_STATUS.RESOLVED]: "Resolved",
};

export const TICKET_STATUS_BADGE_CLASS = {
  [TICKET_STATUS.IN_PROGRESS]: "is-pending",
  [TICKET_STATUS.RESOLVED]: "is-approved",
};

export const TICKET_PRIORITY = {
  LOW: "low",
  MEDIUM: "medium",
  HIGH: "high",
  URGENT: "urgent",
};

export const TICKET_PRIORITY_LABEL = {
  [TICKET_PRIORITY.LOW]: "Low",
  [TICKET_PRIORITY.MEDIUM]: "Medium",
  [TICKET_PRIORITY.HIGH]: "High",
  [TICKET_PRIORITY.URGENT]: "Urgent",
};

export const TICKET_PRIORITY_ORDER = [TICKET_PRIORITY.URGENT, TICKET_PRIORITY.HIGH, TICKET_PRIORITY.MEDIUM, TICKET_PRIORITY.LOW];

export const TICKET_CATEGORY = {
  TECHNICAL: "technical",
  BILLING: "billing",
  COURSE_CONTENT: "course-content",
  ACCOUNT: "account",
  LIVE_CLASS: "live-class",
  OTHER: "other",
};

export const TICKET_CATEGORY_LABEL = {
  [TICKET_CATEGORY.TECHNICAL]: "Technical",
  [TICKET_CATEGORY.BILLING]: "Billing & Payments",
  [TICKET_CATEGORY.COURSE_CONTENT]: "Course Content",
  [TICKET_CATEGORY.ACCOUNT]: "Account & Access",
  [TICKET_CATEGORY.LIVE_CLASS]: "Live Classes",
  [TICKET_CATEGORY.OTHER]: "Other",
};

export const REQUESTER_ROLE_LABEL = {
  student: "Student",
  educator: "Educator",
  parent: "Parent",
  institution: "Institution",
  admin: "Admin",
};

export const SUPPORT_AGENTS = [
  "Unassigned",
  "Tier 1 — Aisha Khan",
  "Tier 1 — Farhan Sheikh",
  "Tier 2 Technical — Rohit Verma",
  "Billing Team — Sana Iqbal",
  "Trust & Safety — Devika Nair",
];

export const TICKET_SLA_TARGET_HOURS = {
  [TICKET_PRIORITY.LOW]: 48,
  [TICKET_PRIORITY.MEDIUM]: 24,
  [TICKET_PRIORITY.HIGH]: 8,
  [TICKET_PRIORITY.URGENT]: 2,
};

const SEED_TICKETS = [
  {
    id: "TKT-3041", subject: "Live class video freezes after 10 minutes", requesterName: "Aarav Mehta", requesterRole: "student",
    category: TICKET_CATEGORY.LIVE_CLASS, priority: TICKET_PRIORITY.HIGH, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Tier 2 Technical — Rohit Verma", createdDate: "Sep 20, 2026 · 08:12", updatedDate: "Sep 20, 2026 · 10:40",
    messages: [
      { author: "Aarav Mehta", role: "student", text: "Every time I join Dr. Menon's DSA live class, the video freezes around the 10 minute mark and I have to rejoin.", timestamp: "Sep 20, 2026 · 08:12" },
      { author: "Rohit Verma", role: "support", text: "Thanks for the report — could you share your connection speed and device/browser? Checking provider-side signal logs for that session now.", timestamp: "Sep 20, 2026 · 10:40" },
    ],
  },
  {
    id: "TKT-3040", subject: "Refund not received for cancelled course", requesterName: "Priya Sharma", requesterRole: "student",
    category: TICKET_CATEGORY.BILLING, priority: TICKET_PRIORITY.HIGH, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Billing Team — Sana Iqbal", createdDate: "Sep 20, 2026 · 07:05", updatedDate: "Sep 20, 2026 · 07:05",
    messages: [
      { author: "Priya Sharma", role: "student", text: "I cancelled 'Data Analytics with Python' 6 days ago and my refund still hasn't reflected in my account.", timestamp: "Sep 20, 2026 · 07:05" },
    ],
  },
  {
    id: "TKT-3039", subject: "Can't upload course thumbnail — file rejected", requesterName: "Dr. Kavita Menon", requesterRole: "educator",
    category: TICKET_CATEGORY.TECHNICAL, priority: TICKET_PRIORITY.MEDIUM, status: TICKET_STATUS.RESOLVED,
    assignedTo: "Tier 1 — Aisha Khan", createdDate: "Sep 18, 2026 · 14:22", updatedDate: "Sep 19, 2026 · 09:15",
    messages: [
      { author: "Dr. Kavita Menon", role: "educator", text: "The course builder keeps rejecting my thumbnail upload with a generic error.", timestamp: "Sep 18, 2026 · 14:22" },
      { author: "Aisha Khan", role: "support", text: "Found it — your file was a 6000x4000 TIFF, we only accept JPG/PNG under 5MB. Converted a version for you and it uploaded fine.", timestamp: "Sep 19, 2026 · 09:10" },
      { author: "Dr. Kavita Menon", role: "educator", text: "That worked, thank you!", timestamp: "Sep 19, 2026 · 09:15" },
    ],
  },
  {
    id: "TKT-3038", subject: "Child's progress not showing in Parent dashboard", requesterName: "Sunil Rao", requesterRole: "parent",
    category: TICKET_CATEGORY.ACCOUNT, priority: TICKET_PRIORITY.MEDIUM, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Unassigned", createdDate: "Sep 20, 2026 · 06:48", updatedDate: "Sep 20, 2026 · 06:48",
    messages: [
      { author: "Sunil Rao", role: "parent", text: "My daughter completed two quizzes this week but the Parent dashboard still shows 'No recent activity'.", timestamp: "Sep 20, 2026 · 06:48" },
    ],
  },
  {
    id: "TKT-3037", subject: "Request to bulk-onboard 40 new students", requesterName: "Greenwood International School", requesterRole: "institution",
    category: TICKET_CATEGORY.ACCOUNT, priority: TICKET_PRIORITY.LOW, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Tier 1 — Farhan Sheikh", createdDate: "Sep 17, 2026 · 11:30", updatedDate: "Sep 19, 2026 · 16:05",
    messages: [
      { author: "Greenwood International School", role: "institution", text: "We have 40 new Grade 9 students starting Monday — is there a bulk-import option instead of adding them one by one?", timestamp: "Sep 17, 2026 · 11:30" },
      { author: "Farhan Sheikh", role: "support", text: "Yes — sending over the CSV template and bulk-import steps for your Institution Admin now.", timestamp: "Sep 19, 2026 · 16:05" },
    ],
  },
  {
    id: "TKT-3036", subject: "Certificate shows wrong completion date", requesterName: "Ishaan Verma", requesterRole: "student",
    category: TICKET_CATEGORY.COURSE_CONTENT, priority: TICKET_PRIORITY.LOW, status: TICKET_STATUS.RESOLVED,
    assignedTo: "Tier 1 — Aisha Khan", createdDate: "Sep 15, 2026 · 09:00", updatedDate: "Sep 16, 2026 · 12:40",
    messages: [
      { author: "Ishaan Verma", role: "student", text: "My certificate for Cryptocurrency Trading Masterclass shows a completion date from before I even finished the last module.", timestamp: "Sep 15, 2026 · 09:00" },
      { author: "Aisha Khan", role: "support", text: "That was a timezone display bug on the certificate template, not the actual record — escalated and it's been reissued with the correct date.", timestamp: "Sep 16, 2026 · 12:40" },
    ],
  },
  {
    id: "TKT-3035", subject: "Two-factor login code never arrives", requesterName: "Vikram Singh", requesterRole: "educator",
    category: TICKET_CATEGORY.ACCOUNT, priority: TICKET_PRIORITY.URGENT, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Tier 2 Technical — Rohit Verma", createdDate: "Sep 20, 2026 · 09:55", updatedDate: "Sep 20, 2026 · 09:55",
    messages: [
      { author: "Vikram Singh", role: "educator", text: "I'm locked out — the SMS OTP for login never arrives and I have a live class starting in 40 minutes.", timestamp: "Sep 20, 2026 · 09:55" },
    ],
  },
  {
    id: "TKT-3034", subject: "Quiz auto-submitted before time ran out", requesterName: "Neha Kapoor", requesterRole: "student",
    category: TICKET_CATEGORY.COURSE_CONTENT, priority: TICKET_PRIORITY.MEDIUM, status: TICKET_STATUS.RESOLVED,
    assignedTo: "Tier 1 — Farhan Sheikh", createdDate: "Sep 10, 2026 · 13:20", updatedDate: "Sep 12, 2026 · 10:00",
    messages: [
      { author: "Neha Kapoor", role: "student", text: "My Excel quiz submitted itself with 8 minutes still on the clock.", timestamp: "Sep 10, 2026 · 13:20" },
      { author: "Farhan Sheikh", role: "support", text: "Confirmed a client-side timer drift on slow connections — your attempt has been reset so you can retake it, and the fix is rolling out platform-wide.", timestamp: "Sep 11, 2026 · 15:30" },
      { author: "Neha Kapoor", role: "student", text: "Retook it, all good now — thanks!", timestamp: "Sep 12, 2026 · 10:00" },
    ],
  },
  {
    id: "TKT-3033", subject: "Payout not received for August earnings", requesterName: "Lakshmi Narayan", requesterRole: "educator",
    category: TICKET_CATEGORY.BILLING, priority: TICKET_PRIORITY.HIGH, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Billing Team — Sana Iqbal", createdDate: "Sep 19, 2026 · 17:10", updatedDate: "Sep 20, 2026 · 08:20",
    messages: [
      { author: "Lakshmi Narayan", role: "educator", text: "My August payout status still shows 'Processing' — it's been 9 days.", timestamp: "Sep 19, 2026 · 17:10" },
      { author: "Sana Iqbal", role: "support", text: "Checked the ledger — your payout is queued behind a bank verification step. Should clear within 48 hours, will confirm once it's marked Paid.", timestamp: "Sep 20, 2026 · 08:20" },
    ],
  },
  {
    id: "TKT-3032", subject: "Whiteboard tool not loading in live class", requesterName: "Rohan Desai", requesterRole: "student",
    category: TICKET_CATEGORY.LIVE_CLASS, priority: TICKET_PRIORITY.MEDIUM, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Unassigned", createdDate: "Sep 20, 2026 · 10:02", updatedDate: "Sep 20, 2026 · 10:02",
    messages: [
      { author: "Rohan Desai", role: "student", text: "The whiteboard panel just shows a spinning loader the whole session, I can only see chat.", timestamp: "Sep 20, 2026 · 10:02" },
    ],
  },
  {
    id: "TKT-3031", subject: "Duplicate charge on card for one course", requesterName: "Aditya Singh", requesterRole: "student",
    category: TICKET_CATEGORY.BILLING, priority: TICKET_PRIORITY.URGENT, status: TICKET_STATUS.RESOLVED,
    assignedTo: "Billing Team — Sana Iqbal", createdDate: "Sep 14, 2026 · 12:00", updatedDate: "Sep 15, 2026 · 09:30",
    messages: [
      { author: "Aditya Singh", role: "student", text: "I was charged twice for 'Spoken English for Working Professionals' — ₹999 shows up twice on my statement.", timestamp: "Sep 14, 2026 · 12:00" },
      { author: "Sana Iqbal", role: "support", text: "Confirmed a duplicate webhook retry on the payment provider's side, not a real double purchase. Reversed the duplicate charge — should reflect in 3–5 business days.", timestamp: "Sep 15, 2026 · 09:30" },
    ],
  },
  {
    id: "TKT-3030", subject: "Request to change registered email address", requesterName: "Tanvi Kulkarni", requesterRole: "student",
    category: TICKET_CATEGORY.ACCOUNT, priority: TICKET_PRIORITY.LOW, status: TICKET_STATUS.RESOLVED,
    assignedTo: "Tier 1 — Aisha Khan", createdDate: "Sep 8, 2026 · 10:15", updatedDate: "Sep 9, 2026 · 11:00",
    messages: [
      { author: "Tanvi Kulkarni", role: "student", text: "I lost access to my old college email — can you update my account to my personal Gmail?", timestamp: "Sep 8, 2026 · 10:15" },
      { author: "Aisha Khan", role: "support", text: "Verified your identity via your enrollment ID and updated the email on file. You'll need to re-verify the new address on next login.", timestamp: "Sep 9, 2026 · 11:00" },
    ],
  },
  {
    id: "TKT-3029", subject: "Institution wants a custom subdomain", requesterName: "Sunrise Public School", requesterRole: "institution",
    category: TICKET_CATEGORY.OTHER, priority: TICKET_PRIORITY.LOW, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Unassigned", createdDate: "Sep 19, 2026 · 15:40", updatedDate: "Sep 19, 2026 · 15:40",
    messages: [
      { author: "Sunrise Public School", role: "institution", text: "Is a branded subdomain (learn.sunrisepublic.edu) something we can set up for our students?", timestamp: "Sep 19, 2026 · 15:40" },
    ],
  },
  {
    id: "TKT-3028", subject: "Assignment file upload stuck at 0%", requesterName: "Simran Kaur", requesterRole: "student",
    category: TICKET_CATEGORY.TECHNICAL, priority: TICKET_PRIORITY.MEDIUM, status: TICKET_STATUS.IN_PROGRESS,
    assignedTo: "Tier 2 Technical — Rohit Verma", createdDate: "Sep 20, 2026 · 07:50", updatedDate: "Sep 20, 2026 · 09:00",
    messages: [
      { author: "Simran Kaur", role: "student", text: "My assignment PDF just sits at 0% upload progress and then times out.", timestamp: "Sep 20, 2026 · 07:50" },
      { author: "Rohit Verma", role: "support", text: "What's the file size? We cap uploads at 25MB — if it's larger, try compressing the PDF and it should go through.", timestamp: "Sep 20, 2026 · 09:00" },
    ],
  },
];

// ---------- tiny mock "store" (mirrors ../data/certificatesMock.js) ----------
const INITIAL_TICKET_NOTES = [
  "Check the requester history before escalating.",
  "Billing team owns the refund verification.",
  "Known upload limitation documented in the educator FAQ.",
  "Parent dashboard sync is being reviewed by platform support.",
];

let _tickets = SEED_TICKETS.map((ticket, index) => ({
  ...ticket,
  firstResponseMinutes: ticket.messages.some((message) => message.role === "support") ? [148, 42, 43, 62][index % 4] : null,
  internalNotes: index < 4 ? [INITIAL_TICKET_NOTES[index]] : [],
  activity: [
    { type: "created", text: "Ticket created by requester", timestamp: ticket.createdDate },
    ...(ticket.messages.length > 1 ? [{ type: "reply", text: "Support reply added", timestamp: ticket.updatedDate }] : []),
  ],
}));
const _listeners = new Set();
function _notify() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function _now() {
  return new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) +
    " · " + new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
}

export function useTickets() {
  return useSyncExternalStore(_subscribe, () => _tickets);
}

export function updateTicketStatus(id, status) {
  _tickets = _tickets.map((t) => (t.id === id ? {
    ...t,
    status,
    updatedDate: _now(),
    activity: [...t.activity, { type: "status", text: `Status changed to ${TICKET_STATUS_LABEL[status]}`, timestamp: _now() }],
  } : t));
  _notify();
}

export function assignTicket(id, assignedTo) {
  _tickets = _tickets.map((t) => (t.id === id ? {
    ...t,
    assignedTo,
    updatedDate: _now(),
    activity: [...t.activity, { type: "assignment", text: `Assigned to ${assignedTo}`, timestamp: _now() }],
  } : t));
  _notify();
}

export function updateTicketPriority(id, priority) {
  _tickets = _tickets.map((t) => (t.id === id ? {
    ...t,
    priority,
    updatedDate: _now(),
    activity: [...t.activity, { type: "priority", text: `Priority changed to ${TICKET_PRIORITY_LABEL[priority]}`, timestamp: _now() }],
  } : t));
  _notify();
}

export function addTicketInternalNote(id, text, author = "Admin User") {
  const note = { author, text, timestamp: _now() };
  _tickets = _tickets.map((t) => (t.id === id ? {
    ...t,
    internalNotes: [...t.internalNotes, note],
    updatedDate: _now(),
    activity: [...t.activity, { type: "note", text: "Internal note added", timestamp: note.timestamp }],
  } : t));
  _notify();
}

export function bulkUpdateTickets(ids, changes) {
  const idSet = new Set(ids);
  _tickets = _tickets.map((t) => {
    if (!idSet.has(t.id)) return t;
    const next = { ...t, ...changes, updatedDate: _now() };
    return {
      ...next,
      activity: [...t.activity, { type: "bulk", text: "Bulk ticket update applied", timestamp: next.updatedDate }],
    };
  });
  _notify();
}

export function addTicketReply(id, text, author = "Admin User") {
  const message = { author, role: "support", text, timestamp: _now() };
  _tickets = _tickets.map((t) =>
    t.id === id
      ? {
        ...t,
        messages: [...t.messages, message],
        updatedDate: _now(),
        firstResponseMinutes: t.firstResponseMinutes || 18,
        activity: [...t.activity, { type: "reply", text: "Reply sent to requester", timestamp: message.timestamp }],
      }
      : t
  );
  _notify();
}

/* ============================== Callback requests ============================== */
// Kept intentionally lightweight (⚠ not detailed in the Technical Design
// Document) — capture + a status + an optional follow-up note, no ticket
// thread or SLA/priority fields.

export const CALLBACK_STATUS = {
  NEW: "new",
  CONTACTED: "contacted",
  CLOSED: "closed",
};

export const CALLBACK_STATUS_LABEL = {
  [CALLBACK_STATUS.NEW]: "New",
  [CALLBACK_STATUS.CONTACTED]: "Contacted",
  [CALLBACK_STATUS.CLOSED]: "Closed",
};

export const CALLBACK_STATUS_BADGE_CLASS = {
  [CALLBACK_STATUS.NEW]: "is-account-suspended",
  [CALLBACK_STATUS.CONTACTED]: "is-pending",
  [CALLBACK_STATUS.CLOSED]: "is-account-inactive",
};

export const CALLBACK_SOURCE_LABEL = {
  visitor: "Website Visitor",
  institution: "Prospective Institution",
  educator: "Prospective Educator",
};

const SEED_CALLBACKS = [
  { id: "CB-118", name: "Rakesh Iyer", phone: "+91 98450 12233", email: "rakesh.iyer@example.com", source: "institution", message: "Onboard three Indore branches under one institution account.", submittedDate: "Sep 20, 2026 · 09:20", status: CALLBACK_STATUS.NEW, followUpNote: "", scheduledAt: "2026-09-21T11:00", completedAt: null },
  { id: "CB-117", name: "Megha Shah", phone: "+91 90040 55210", email: "megha.shah@example.com", source: "visitor", message: "Ask about trial classes for two children in grades 6 and 9.", submittedDate: "Sep 19, 2026 · 18:44", status: CALLBACK_STATUS.CONTACTED, followUpNote: "Called Sep 20, offered a free trial live class for both grades — awaiting confirmation of preferred slot.", scheduledAt: "2026-09-22T15:30", completedAt: null },
  { id: "CB-116", name: "Dr. Anil Chandran", phone: "+91 98860 77410", email: "anil.chandran@example.com", source: "educator", message: "Learn about educator verification and payout terms.", submittedDate: "Sep 19, 2026 · 14:05", status: CALLBACK_STATUS.CONTACTED, followUpNote: "Sent educator onboarding deck + verification checklist by email." },
  { id: "CB-115", name: "Fatima Sheikh", phone: "+91 99870 30021", email: "fatima.sheikh@example.com", source: "visitor", message: "Discuss bulk course licensing for an NGO program after 5pm.", submittedDate: "Sep 18, 2026 · 11:30", status: CALLBACK_STATUS.NEW, followUpNote: "" },
  { id: "CB-114", name: "Global Bright Minds Academy", phone: "+91 79800 44120", email: "admissions@brightminds.example", source: "institution", message: "Request an Institution Admin demo and LMS migration guidance.", submittedDate: "Sep 17, 2026 · 16:52", status: CALLBACK_STATUS.CLOSED, followUpNote: "Walkthrough completed Sep 18; they've signed up directly through Institution Onboarding — closing this lead." },
  { id: "CB-113", name: "Karthik Subramaniam", phone: "+91 94440 19980", email: "karthik.s@example.com", source: "visitor", message: "Ask about pricing for the UPSC test-series bundle.", submittedDate: "Sep 16, 2026 · 10:10", status: CALLBACK_STATUS.CLOSED, followUpNote: "Called and shared pricing directly — no bundle exists yet, logged as a feature request." },
  { id: "CB-112", name: "Ritu Agarwal", phone: "+91 98290 66710", email: "ritu.agarwal@example.com", source: "educator", message: "Ask whether an existing student batch can join the platform.", submittedDate: "Sep 15, 2026 · 09:00", status: CALLBACK_STATUS.NEW, followUpNote: "" },
  { id: "CB-111", name: "St. Xavier's Learning Trust", phone: "+91 80500 22014", email: "trust@stxaviers.example", source: "institution", message: "Request a compliance and accreditation reporting demo.", submittedDate: "Sep 12, 2026 · 13:15", status: CALLBACK_STATUS.CONTACTED, followUpNote: "Demo scheduled for Sep 24 with the Regional Growth & Compliance screens.", scheduledAt: "2026-09-24T14:00", completedAt: null },
];

let _callbacks = SEED_CALLBACKS.map((callback) => ({
  ...callback,
  activity: [{ type: "created", text: "Callback request received", timestamp: callback.submittedDate }],
}));

export function useCallbackRequests() {
  return useSyncExternalStore(_subscribe, () => _callbacks);
}

export function updateCallbackStatus(id, status, followUpNote) {
  _callbacks = _callbacks.map((c) =>
    c.id === id ? {
      ...c,
      status,
      followUpNote: followUpNote !== undefined ? followUpNote : c.followUpNote,
      completedAt: status === CALLBACK_STATUS.CLOSED ? (c.completedAt || _now()) : c.completedAt,
      activity: [...c.activity, { type: "status", text: `Status changed to ${CALLBACK_STATUS_LABEL[status]}`, timestamp: _now() }],
    } : c
  );
  _notify();
}

export function updateCallbackSchedule(id, scheduledAt) {
  _callbacks = _callbacks.map((c) => c.id === id ? {
    ...c,
    scheduledAt,
    activity: [...c.activity, { type: "schedule", text: scheduledAt ? "Callback scheduled" : "Callback schedule cleared", timestamp: _now() }],
  } : c);
  _notify();
}

export function completeCallback(id) {
  _callbacks = _callbacks.map((c) => c.id === id ? {
    ...c,
    status: CALLBACK_STATUS.CLOSED,
    completedAt: _now(),
    activity: [...c.activity, { type: "completed", text: "Callback completed", timestamp: _now() }],
  } : c);
  _notify();
}

