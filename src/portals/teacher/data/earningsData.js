// Mock earnings ledger for the Earnings section (Revenue Dashboard,
// Earnings Ledger, Wallet & Transactions, Payout Request).
//
// Single source of truth: every transaction on every screen is derived
// from the same seeded ledger + payouts arrays via computeBalances(), so
// no two screens can ever disagree about a number. The ledger is seeded
// from each course's real totalSales/salesThisMonth so the sums exactly
// reconcile with courseTotalRevenue()/courseMonthlyRevenue() (the same
// figures already shown on My Courses + Course Management).

import { computeEducatorEarnings } from "../components/contentData";
import { TODAY, courseAnalytics } from "./teacherCourses";
import { TEST_SERIES_SALES_SEED } from "./testSeriesData";
import { bundleSaleTag } from "./bundleData";

export const PENDING_WINDOW_DAYS = 14;

export const PAYOUT_METHODS = [
  { id: "bank-1", type: "bank", label: "HDFC Bank Savings ••4821", detail: "Bank transfer (IMPS/NEFT) · 1–2 business days" },
  { id: "paypal-1", type: "paypal", label: "UPI · ansh.mehra@okhdfcbank", detail: "UPI · Instant to 1 business day" },
  { id: "card-1", type: "card", label: "RuPay Debit ••1187", detail: "Debit card · Instant (small fee applies)" },
];

export const LEDGER_TYPE_META = {
  sale: { label: "Course sale", tone: "success" },
  clawback: { label: "Refund clawback", tone: "danger" },
  payout: { label: "Payout", tone: "neutral" },
};

export const PAYOUT_STATUS_META = {
  Requested: { label: "Requested", tone: "neutral" },
  Approved: { label: "Approved", tone: "neutral" },
  Processing: { label: "Processing", tone: "warning" },
  Paid: { label: "Paid", tone: "success" },
  Failed: { label: "Failed", tone: "danger" },
};

export const DATE_RANGES = ["30D", "3M", "6M", "All"];

// Shared formatters live in src/utils/formatMoney.js (INR-first, Indian
// grouping); re-exported here so existing imports keep working.
export { formatMoney, formatSigned, formatCompactMoney } from "../../../utils/formatMoney";

function isoDaysAgo(n) {
  return new Date(TODAY.getTime() - n * 86400000).toISOString().slice(0, 10);
}

let _seq = 0;
function txnId() {
  _seq += 1;
  return `txn-${String(_seq).padStart(4, "0")}`;
}

const SAMPLE_BUYERS = [
  "Priya Nair", "Marcus Webb", "Elena Ruiz", "Sam Okafor", "Jordan Lee", "Ava Thompson", "Noah Kim",
  "Fatima Hassan", "Leo Bianchi", "Grace Park", "Ibrahim Saleh", "Mia Chen", "Theo Novak", "Zara Ahmed",
];

function buyerFor(i) {
  return SAMPLE_BUYERS[i % SAMPLE_BUYERS.length];
}

// Splits `older` (a sale count) into rupee-amount batches across a
// course's own revenueTrend months, weighted by each month's sales, so
// the distribution looks organic instead of a flat average. The last
// batch absorbs the rounding residual so the sum is always exact.
function allocateOlderBatches(course, olderCount, netPerSale, commissionPerSale) {
  const trend = courseAnalytics(course.id)?.revenueTrend || [];
  const totalTarget = Math.round(olderCount * netPerSale * 100) / 100;
  const totalWeight = trend.reduce((s, t) => s + (t.sales || 0), 0);
  const batches = [];

  if (totalWeight > 0) {
    let allocated = 0;
    trend.forEach((t, idx) => {
      const isLast = idx === trend.length - 1;
      const raw = isLast
        ? Math.round((totalTarget - allocated) * 100) / 100
        : Math.round(totalTarget * ((t.sales || 0) / totalWeight) * 100) / 100;
      allocated = Math.round((allocated + raw) * 100) / 100;
      const monthsBack = trend.length - idx; // oldest trend month -> furthest back
      batches.push({ label: t.label, amount: raw, monthsBack });
    });
  } else if (olderCount > 0) {
    const per = Math.round((totalTarget / 6) * 100) / 100;
    let allocated = 0;
    for (let m = 6; m >= 1; m--) {
      const isLast = m === 1;
      const amt = isLast ? Math.round((totalTarget - allocated) * 100) / 100 : per;
      allocated = Math.round((allocated + amt) * 100) / 100;
      batches.push({ label: null, amount: amt, monthsBack: m });
    }
  }

  return batches.map((b) => ({
    ...b,
    commission: Math.round(b.amount * (commissionPerSale / netPerSale) * 100) / 100,
  }));
}

export function seedEarnings(courses) {
  _seq = 0;
  const ledger = [];

  const paidCourses = courses.filter((c) => c.pricingModel !== "free" && (c.totalSales || 0) > 0);

  paidCourses.forEach((course) => {
    const { earnings: net, commission } = computeEducatorEarnings(course.price);
    const currency = course.currency || "INR";
    const monthly = course.salesThisMonth || 0;
    const total = course.totalSales || 0;
    const older = Math.max(0, total - monthly);

    // This month's sales -- one entry per sale, spread across the last 30
    // days, so their sum equals courseMonthlyRevenue(course) exactly.
    // Anything inside the pending window is still "pending"; the rest of
    // this month has already cleared.
    for (let i = 0; i < monthly; i++) {
      const span = Math.max(1, monthly - 1);
      const daysBack = Math.floor((i / span) * 29);
      // Bundle attribution is a TAG on an existing sale (never extra money),
      // so every total below still reconciles with courseMonthlyRevenue().
      const bundleTag = bundleSaleTag(course.id, i);
      ledger.push({
        id: txnId(),
        type: "sale",
        ...(bundleTag ? { source: "bundle", ...bundleTag } : {}),
        courseId: course.id,
        courseTitle: course.title,
        buyer: buyerFor(i),
        grossAmount: course.price,
        commission,
        amount: net,
        currency,
        date: isoDaysAgo(daysBack),
        status: daysBack < PENDING_WINDOW_DAYS ? "pending" : "cleared",
        description: bundleTag ? `Course sale — ${course.title} (via bundle: ${bundleTag.bundleName})` : `Course sale — ${course.title}`,
      });
    }

    // Everything sold before this month, batched by month so the ledger
    // doesn't need a thousand identical rows, but still reconciles
    // exactly against courseTotalRevenue(course).
    if (older > 0) {
      const batches = allocateOlderBatches(course, older, net, commission);
      batches.forEach((b) => {
        if (Math.abs(b.amount) < 0.005) return;
        ledger.push({
          id: txnId(),
          type: "sale",
          courseId: course.id,
          courseTitle: course.title,
          buyer: "Multiple students",
          grossAmount: null,
          commission: b.commission,
          amount: b.amount,
          currency,
          date: isoDaysAgo(30 + (b.monthsBack - 1) * 30),
          status: "cleared",
          description: b.label
            ? `Course sales — ${course.title} (${b.label})`
            : `Course sales — ${course.title}`,
        });
      });
    }
  });

  // Test Series revenue (additive): paid, published test series sell
  // through the same ledger shape as course sales. They are attributed
  // distinctly -- `source: "test_series"`, the series id as `courseId` and
  // "<title> (Test Series)" as `courseTitle` -- so the Ledger's course filter,
  // the per-course breakdown, Wallet totals and Analytics revenue all include
  // them with no other changes. Older sales are batched per month like
  // course sales are.
  TEST_SERIES_SALES_SEED.forEach((ts) => {
    const { commission, earnings: net } = computeEducatorEarnings(ts.price);
    const courseTitle = `${ts.title} (Test Series)`;
    ts.recent.forEach((sale) => {
      ledger.push({
        id: txnId(),
        type: "sale",
        source: "test_series",
        courseId: ts.seriesId,
        courseTitle,
        buyer: sale.buyer,
        grossAmount: ts.price,
        commission,
        amount: net,
        currency: "INR",
        date: isoDaysAgo(sale.daysBack),
        status: sale.daysBack < PENDING_WINDOW_DAYS ? "pending" : "cleared",
        description: `Test series sale — ${ts.title}`,
      });
    });
    ts.older.forEach((batch) => {
      ledger.push({
        id: txnId(),
        type: "sale",
        source: "test_series",
        courseId: ts.seriesId,
        courseTitle,
        buyer: "Multiple students",
        grossAmount: null,
        commission: Math.round(commission * batch.count * 100) / 100,
        amount: Math.round(net * batch.count * 100) / 100,
        currency: "INR",
        date: isoDaysAgo(30 + (batch.monthsBack - 1) * 30),
        status: "cleared",
        description: `Test series sales — ${ts.title} (${batch.count} students)`,
      });
    });
  });

  ledger.sort((a, b) => (a.date < b.date ? 1 : -1));

  // One clawback example: a refund on a specific, already-recorded sale.
  // The original credit is left untouched (immutable) -- this is a
  // separate, distinctly-styled debit entry that references it.
  const refundSource = ledger.find(
    (e) => e.type === "sale" && e.courseId === "c1" && e.buyer !== "Multiple students" && e.status === "cleared"
  );
  let clawback = null;
  if (refundSource) {
    clawback = {
      id: txnId(),
      type: "clawback",
      courseId: refundSource.courseId,
      courseTitle: refundSource.courseTitle,
      buyer: refundSource.buyer,
      grossAmount: refundSource.grossAmount,
      commission: -refundSource.commission,
      amount: -refundSource.amount,
      currency: refundSource.currency,
      date: isoDaysAgo(1),
      status: "cleared",
      description: `Refund clawback — ${refundSource.courseTitle} (${refundSource.buyer})`,
      relatedEntryId: refundSource.id,
    };
    ledger.unshift(clawback);
  }

  // Payout lifecycle examples, covering every status the Payout History
  // list can show. Only the Paid payout gets a matching ledger debit --
  // a Failed payout releases the hold and leaves no trace on the ledger.
  const paidPayoutEntry = {
    id: txnId(),
    type: "payout",
    courseId: null,
    courseTitle: null,
    buyer: null,
    grossAmount: null,
    commission: null,
    amount: -800000,
    currency: "INR",
    date: isoDaysAgo(32),
    status: "cleared",
    description: `Payout — ${PAYOUT_METHODS[0].label}`,
    payoutId: "po-1001",
  };
  ledger.unshift(paidPayoutEntry);

  const payouts = [
    {
      id: "po-1001",
      amount: 800000,
      currency: "INR",
      method: PAYOUT_METHODS[0],
      status: "Paid",
      requestedAt: isoDaysAgo(35),
      completedAt: isoDaysAgo(32),
      failureReason: null,
      ledgerEntryId: paidPayoutEntry.id,
    },
    {
      id: "po-1002",
      amount: 125000,
      currency: "INR",
      method: PAYOUT_METHODS[1],
      status: "Processing",
      requestedAt: isoDaysAgo(2),
      completedAt: null,
      failureReason: null,
      ledgerEntryId: null,
    },
    {
      id: "po-1003",
      amount: 25000,
      currency: "INR",
      method: PAYOUT_METHODS[2],
      status: "Failed",
      requestedAt: isoDaysAgo(10),
      completedAt: isoDaysAgo(9),
      failureReason: "Card declined by issuer — try a different method.",
      ledgerEntryId: null,
    },
    {
      id: "po-1004",
      amount: 15000,
      currency: "INR",
      method: PAYOUT_METHODS[0],
      status: "Requested",
      requestedAt: isoDaysAgo(0),
      completedAt: null,
      failureReason: null,
      ledgerEntryId: null,
    },
  ];

  ledger.sort((a, b) => (a.date < b.date ? 1 : -1));

  return { ledger, payouts };
}

// The one place every balance figure on every Earnings screen is computed
// from -- Dashboard hero stats, Wallet balances, and the Payout modal's
// "available to withdraw" all call this with the same ledger + payouts.
export function computeBalances(ledger, payouts) {
  let clearedCredits = 0;
  let pendingCredits = 0;
  let clawbackDebits = 0;
  let paidPayouts = 0;

  ledger.forEach((e) => {
    if (e.type === "sale") {
      if (e.status === "pending") pendingCredits += e.amount;
      else clearedCredits += e.amount;
    } else if (e.type === "clawback") {
      clawbackDebits += e.amount;
    } else if (e.type === "payout") {
      paidPayouts += Math.abs(e.amount);
    }
  });

  const heldPayouts = payouts.reduce(
    (sum, p) => (p.status === "Requested" || p.status === "Approved" || p.status === "Processing" ? sum + p.amount : sum),
    0
  );

  const round2 = (n) => Math.round(n * 100) / 100;

  return {
    totalEarnings: round2(clearedCredits + pendingCredits + clawbackDebits),
    pendingBalance: round2(pendingCredits),
    availableBalance: round2(clearedCredits + clawbackDebits - paidPayouts - heldPayouts),
    lifetimeWithdrawn: round2(paidPayouts),
    reserved: round2(heldPayouts),
  };
}

// Course-level breakdown for the Revenue Dashboard's per-course table --
// derived from the same ledger, so it always matches the ledger totals.
export function courseBreakdown(ledger, courses) {
  const byCourse = new Map();
  ledger.forEach((e) => {
    if (!e.courseId || (e.type !== "sale" && e.type !== "clawback")) return;
    const row = byCourse.get(e.courseId) || { courseId: e.courseId, courseTitle: e.courseTitle, net: 0, gross: 0, commission: 0, sales: 0 };
    row.net += e.amount;
    if (e.type === "sale") row.sales += 1;
    if (e.grossAmount) row.gross += e.grossAmount;
    row.commission += e.commission || 0;
    byCourse.set(e.courseId, row);
  });
  return Array.from(byCourse.values())
    .map((r) => ({ ...r, net: Math.round(r.net * 100) / 100 }))
    .sort((a, b) => b.net - a.net);
}

export function ledgerInRange(ledger, range) {
  if (range === "All") return ledger;
  const days = range === "30D" ? 30 : range === "3M" ? 90 : 180;
  const cutoff = isoDaysAgo(days);
  return ledger.filter((e) => e.date >= cutoff);
}

// Where a ledger entry's money came from: direct course sale (default),
// a bundle purchase, or a test series. Tags only -- no separate totals.
export const SOURCE_LABELS = { course: "Direct", bundle: "Bundle", test_series: "Test series" };
export function entrySource(e) {
  return e.source || "course";
}
