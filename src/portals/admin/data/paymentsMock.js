// Payment / Revenue Oversight + Commission & Refund Management — mock data.
// Jira: Day 8 — Payment/revenue oversight + commission & refunds
//
// Rather than inventing a second, disconnected set of payment numbers,
// this module builds one platform-wide transaction ledger out of the
// SAME payout records already seeded on every educator
// (educatorsMock.js's payments.history — the exact data EducatorProfile.jsx's
// "Payments" tab already renders per educator): each payout already
// carries amount/commission/net/status/method, so this just flattens
// those across every educator into one ledger and pairs each entry with
// one of that educator's real courses/students for display context.
//
// Refund requests are new here — nothing upstream models them yet beyond
// the dashboard's Recent Activity mentioning "processed refund for order
// #48213" (dashboardMock.js) — seeded against real ledger transactions
// and following the same pending/approved/rejected request shape already
// used for staff requests (staffAssignmentsMock.js's useStaffRequests /
// approveRequest / rejectRequest).
//
// UI-only placeholder data; replace with real calls through
// ../services/adminApi.js once the backend exists. Same tiny pub/sub
// "store" pattern as the other data/*Mock.js files.

import { useSyncExternalStore } from "react";
import { getEducatorsSnapshot } from "./educatorsMock";

export const TRANSACTION_STATUS = {
  PAID: "paid",
  PROCESSING: "processing",
  PENDING: "pending",
  FAILED: "failed",
  REFUNDED: "refunded",
};
export const TRANSACTION_STATUS_LABEL = {
  paid: "Paid",
  processing: "Processing",
  pending: "Pending",
  failed: "Failed",
  refunded: "Refunded",
};
export const TRANSACTION_STATUS_BADGE_CLASS = {
  paid: "is-approved",
  processing: "is-pending",
  pending: "is-pending",
  failed: "is-rejected",
  refunded: "is-refunded",
};

export const REFUND_STATUS = { PENDING: "pending", APPROVED: "approved", REJECTED: "rejected" };
export const REFUND_STATUS_LABEL = { pending: "Pending", approved: "Approved", rejected: "Rejected" };
export const REFUND_STATUS_BADGE_CLASS = { pending: "is-pending", approved: "is-approved", rejected: "is-rejected" };

export const REFUND_REASON_OPTIONS = [
  "Course not as described",
  "Technical/access issues",
  "Accidental purchase",
  "Duplicate charge",
  "Not satisfied with content",
  "Other",
];

function nowISO() {
  return new Date().toISOString();
}
function todayISO() {
  return nowISO().slice(0, 10);
}

// ---------- flatten every educator's real payout history into one ledger ----------
function buildTransactions() {
  const educators = getEducatorsSnapshot();
  const rows = [];
  educators.forEach((e) => {
    const history = (e.payments && e.payments.history) || [];
    history.forEach((h, i) => {
      const course = e.courses && e.courses.length ? e.courses[i % e.courses.length] : null;
      const student = e.students && e.students.length ? e.students[i % e.students.length] : null;
      rows.push({
        id: h.id,
        educatorId: e.id,
        educatorName: e.name,
        educatorInitials: e.initials,
        educatorAvatarColor: e.avatarColor,
        courseTitle: (course && course.title) || "General",
        studentName: (student && student.name) || "—",
        date: h.date,
        amount: h.amount,
        commission: h.commission,
        commissionRate: e.payments.commissionRate,
        net: h.net,
        status: h.status,
        method: h.method,
      });
    });
  });
  rows.sort((a, b) => new Date(b.date) - new Date(a.date));
  return rows;
}

let transactions = buildTransactions();

// ---------- seed a handful of refund requests against real, PAID
// transactions so Refund Management opens with real ledger rows to act on ----------
function buildRefundSeed() {
  const paid = transactions.filter((t) => t.status === TRANSACTION_STATUS.PAID);
  if (paid.length === 0) return [];
  const seeds = [
    { pickAt: 1, offsetDays: 2, reason: REFUND_REASON_OPTIONS[0], status: REFUND_STATUS.PENDING },
    { pickAt: 4, offsetDays: 1, reason: REFUND_REASON_OPTIONS[3], status: REFUND_STATUS.PENDING },
    {
      pickAt: 7,
      offsetDays: 5,
      reason: REFUND_REASON_OPTIONS[2],
      status: REFUND_STATUS.APPROVED,
      decidedBy: "Admin User",
      decisionNote: "Verified duplicate charge in gateway logs.",
    },
    {
      pickAt: 10,
      offsetDays: 9,
      reason: REFUND_REASON_OPTIONS[4],
      status: REFUND_STATUS.REJECTED,
      decidedBy: "Admin User",
      decisionNote: "Course was accessed for 12 days before the request — outside the refund window.",
    },
    { pickAt: 13, offsetDays: 3, reason: REFUND_REASON_OPTIONS[1], status: REFUND_STATUS.PENDING },
  ];
  return seeds.map((s, i) => {
    const txn = paid[s.pickAt % paid.length];
    const requestedDate = new Date(Date.parse(txn.date) + s.offsetDays * 86400000).toISOString().slice(0, 10);
    return {
      id: `REF-${1000 + i}`,
      transactionId: txn.id,
      educatorId: txn.educatorId,
      educatorName: txn.educatorName,
      courseTitle: txn.courseTitle,
      studentName: txn.studentName,
      amount: txn.amount,
      requestedDate,
      requestedBy: txn.studentName !== "—" ? txn.studentName : "Student",
      reason: s.reason,
      status: s.status,
      decidedBy: s.decidedBy || null,
      decidedAt: s.decidedBy ? nowISO() : null,
      decisionNote: s.decisionNote || null,
    };
  });
}

let refundRequests = buildRefundSeed();

// Reflect the already-decided seed refunds back onto the ledger so a
// freshly-loaded page shows a consistent state (an approved refund's
// transaction reads REFUNDED, not still PAID).
transactions = transactions.map((t) => {
  const approved = refundRequests.find((r) => r.transactionId === t.id && r.status === REFUND_STATUS.APPROVED);
  return approved ? { ...t, status: TRANSACTION_STATUS.REFUNDED } : t;
});

const listeners = new Set();
function emit() {
  listeners.forEach((l) => l());
}
function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useTransactions() {
  return useSyncExternalStore(subscribe, () => transactions);
}
export function useRefundRequests() {
  return useSyncExternalStore(subscribe, () => refundRequests);
}

let nextRefundSeq = refundRequests.length + 1;

// Logging a refund request (e.g. from the Transaction Details drill-down,
// on behalf of a support ticket) and approving/rejecting it are both
// normal Admin actions.
export function createRefundRequest(input) {
  const txn = transactions.find((t) => t.id === input.transactionId);
  if (!txn) return { success: false, error: "Transaction not found." };
  if (txn.status !== TRANSACTION_STATUS.PAID) {
    return { success: false, error: "Only paid transactions can be refunded." };
  }
  if (refundRequests.some((r) => r.transactionId === txn.id && r.status === REFUND_STATUS.PENDING)) {
    return { success: false, error: "A refund request for this transaction is already pending." };
  }
  const request = {
    id: `REF-${1000 + nextRefundSeq}`,
    transactionId: txn.id,
    educatorId: txn.educatorId,
    educatorName: txn.educatorName,
    courseTitle: txn.courseTitle,
    studentName: txn.studentName,
    amount: txn.amount,
    requestedDate: todayISO(),
    requestedBy: input.requestedBy || "Admin User",
    reason: input.reason || REFUND_REASON_OPTIONS[REFUND_REASON_OPTIONS.length - 1],
    status: REFUND_STATUS.PENDING,
    decidedBy: null,
    decidedAt: null,
    decisionNote: null,
  };
  nextRefundSeq += 1;
  refundRequests = [request, ...refundRequests];
  emit();
  return { success: true, request };
}

export function approveRefund(requestId, performedBy, note) {
  const req = refundRequests.find((r) => r.id === requestId);
  if (!req || req.status !== REFUND_STATUS.PENDING) return { success: false, error: "Request is no longer pending." };
  refundRequests = refundRequests.map((r) =>
    r.id === requestId
      ? { ...r, status: REFUND_STATUS.APPROVED, decidedBy: performedBy || "Admin", decidedAt: nowISO(), decisionNote: note || "" }
      : r
  );
  transactions = transactions.map((t) => (t.id === req.transactionId ? { ...t, status: TRANSACTION_STATUS.REFUNDED } : t));
  emit();
  return { success: true };
}

export function rejectRefund(requestId, performedBy, note) {
  const req = refundRequests.find((r) => r.id === requestId);
  if (!req || req.status !== REFUND_STATUS.PENDING) return { success: false, error: "Request is no longer pending." };
  refundRequests = refundRequests.map((r) =>
    r.id === requestId
      ? { ...r, status: REFUND_STATUS.REJECTED, decidedBy: performedBy || "Admin", decidedAt: nowISO(), decisionNote: note || "" }
      : r
  );
  emit();
  return { success: true };
}

// ---------- derived aggregate helpers (non-hook — combine with useX() in components) ----------
export function getRevenueOverview(txns) {
  const list = txns || transactions;
  const paid = list.filter((t) => t.status === TRANSACTION_STATUS.PAID);
  const totalRevenue = paid.reduce((s, t) => s + t.amount, 0);
  const totalCommission = paid.reduce((s, t) => s + t.commission, 0);
  const totalNet = paid.reduce((s, t) => s + t.net, 0);
  const pendingAmount = list
    .filter((t) => t.status === TRANSACTION_STATUS.PENDING || t.status === TRANSACTION_STATUS.PROCESSING)
    .reduce((s, t) => s + t.net, 0);
  const refundedAmount = list.filter((t) => t.status === TRANSACTION_STATUS.REFUNDED).reduce((s, t) => s + t.amount, 0);
  const failedCount = list.filter((t) => t.status === TRANSACTION_STATUS.FAILED).length;
  return { totalRevenue, totalCommission, totalNet, pendingAmount, refundedAmount, failedCount, count: list.length };
}

export function getMethodBreakdown(txns) {
  const list = txns || transactions;
  const map = new Map();
  list.forEach((t) => {
    map.set(t.method, (map.get(t.method) || 0) + t.amount);
  });
  return Array.from(map.entries()).map(([method, amount]) => ({ method, amount }));
}

// Educators ranked by commission generated (for the Commission Tracking card).
export function getCommissionByEducator(txns) {
  const list = (txns || transactions).filter((t) => t.status === TRANSACTION_STATUS.PAID);
  const map = new Map();
  list.forEach((t) => {
    const cur = map.get(t.educatorId) || {
      educatorId: t.educatorId,
      educatorName: t.educatorName,
      educatorInitials: t.educatorInitials,
      educatorAvatarColor: t.educatorAvatarColor,
      commission: 0,
      revenue: 0,
      count: 0,
    };
    cur.commission += t.commission;
    cur.revenue += t.amount;
    cur.count += 1;
    map.set(t.educatorId, cur);
  });
  return Array.from(map.values()).sort((a, b) => b.commission - a.commission);
}
