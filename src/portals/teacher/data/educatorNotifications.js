// Educator notification feed — DERIVED from the same data the rest of the
// portal already runs on, not a separate hardcoded list:
//   * session requests          <- SessionRequestsContext (live)
//   * test series assignments + ungraded test-series answers
//                               <- TestSeriesContext (live)
//   * course enrolments, reviews, ungraded submissions, approval /
//     changes-requested status  <- the seed courses TeacherCoursesContext starts from
//   * payout status changes     <- earningsData.seedEarnings payouts
//   * test-series milestone     <- TEST_SERIES_SALES_SEED
//   * profile verification      <- the educator account's verification status
//   * platform announcements    <- a small static list (no source model exists yet)
//
// Every notification belongs to a Notification Preferences category + item
// (notificationPrefsData.js), and the feed hides anything the educator has
// switched OFF for the In-App channel on that screen.
//
// Timestamps are on the app's mock clock (testSeriesDeadlines.timeAgo), the
// same one Messaging and Test Series use, so "3 hr ago" lines up everywhere.
import { useCallback, useSyncExternalStore } from "react";
import { INITIAL_COURSES } from "../context/TeacherCoursesContext";
import { seedEarnings, formatMoney } from "./earningsData";
import { TEST_SERIES_SALES_SEED } from "./testSeriesData";
import { TODAY } from "./teacherCourses";
import { mockNowMs } from "./testSeriesDeadlines";
import { EDUCATOR_STATUS } from "./educatorAccountStore";

const DAY = 86400000;
const iso = (d, t = "09:00:00") => (d.length === 10 ? `${d}T${t}` : d);

let payoutCache = null;
function seedPayouts() {
  if (!payoutCache) payoutCache = seedEarnings(INITIAL_COURSES).payouts;
  return payoutCache;
}

// Static, because nothing models Universal Learning's own announcements yet.
const PLATFORM_EVENTS = [
  {
    id: "platform-live-tools",
    category: "platform",
    itemKey: "platformAnnouncement",
    title: "New: Test Series analytics",
    body: "Score distributions and per-question accuracy are now available for every published test series.",
    at: new Date(TODAY.getTime() - 2 * DAY).toISOString(),
    to: null,
  },
  {
    id: "platform-payout-policy",
    category: "platform",
    itemKey: "policyChange",
    title: "Payout policy update",
    body: "Earnings now clear after a 14-day pending window. Details are in your Revenue tab.",
    at: new Date(TODAY.getTime() - 12 * DAY).toISOString(),
    to: null,
  },
];

export function buildNotifications({ requests = [], series = [], submissions = [], currentTeacherId, account }) {
  const out = [];

  // --- Student Activity -----------------------------------------------------
  const enrolments = INITIAL_COURSES.flatMap((c) =>
    (c.students ?? []).map((s) => ({ c, s }))
  )
    .sort((a, b) => (a.s.enrolledAt < b.s.enrolledAt ? 1 : -1))
    .slice(0, 3);
  enrolments.forEach(({ c, s }) =>
    out.push({
      id: `enroll-${c.id}-${s.name}-${s.enrolledAt}`,
      category: "studentActivity",
      itemKey: "newEnrollment",
      title: `${s.name} enrolled in ${c.title}`,
      at: iso(s.enrolledAt, "11:30:00"),
      to: "/teacher/studentmanagement",
    })
  );

  INITIAL_COURSES.flatMap((c) => (c.reviews ?? []).map((r) => ({ c, r })))
    .sort((a, b) => (a.r.date < b.r.date ? 1 : -1))
    .slice(0, 3)
    .forEach(({ c, r }) =>
      out.push({
        id: `review-${c.id}-${r.studentName}-${r.date}`,
        category: "studentActivity",
        itemKey: "newReview",
        title: `${r.studentName} left a ${r.rating}-star review on ${c.title}`,
        body: r.text,
        at: iso(r.date, "15:10:00"),
        to: "/teacher/reviews",
      })
    );

  // --- Assessments & Grading ------------------------------------------------
  INITIAL_COURSES.forEach((c) => {
    const pending = (c.submissions ?? []).filter((s) => s.status === "pending");
    if (!pending.length) return;
    const latest = pending.map((s) => s.submittedAt).sort().at(-1);
    out.push({
      id: `grade-${c.id}-${pending.length}-${latest}`,
      category: "assessments",
      itemKey: "newSubmission",
      title: `${pending.length} submission${pending.length === 1 ? "" : "s"} ready to grade in ${c.title}`,
      at: iso(latest, "17:45:00"),
      to: "/teacher/grading",
    });
  });

  const tsPendingBySeries = new Map();
  submissions
    .filter((s) => s.source === "test_series" && s.status === "pending")
    .forEach((s) => {
      const row = tsPendingBySeries.get(s.seriesId) ?? { title: s.seriesTitle, n: 0, latest: "" };
      row.n += 1;
      if (s.submittedAt > row.latest) row.latest = s.submittedAt;
      tsPendingBySeries.set(s.seriesId, row);
    });
  tsPendingBySeries.forEach((row, seriesId) =>
    out.push({
      id: `tsgrade-${seriesId}-${row.n}-${row.latest}`,
      category: "assessments",
      itemKey: "newSubmission",
      title: `${row.n} test-series answer${row.n === 1 ? "" : "s"} waiting to be graded`,
      body: row.title,
      at: iso(row.latest, "13:20:00"),
      to: `/teacher/testseries/${seriesId}/detail`,
    })
  );

  // --- Bookings & Live Classes ---------------------------------------------
  requests
    .filter((r) => r.status === "pending")
    .forEach((r) =>
      out.push({
        id: `req-${r.studentName}-${r.submittedAt}`,
        category: "bookings",
        itemKey: "newBooking",
        title: `${r.studentName} requested a ${r.sessionType} session`,
        body: r.courseTitle,
        at: r.submittedAt,
        to: "/teacher/requests",
      })
    );

  // --- Course & Publishing --------------------------------------------------
  INITIAL_COURSES.forEach((c) => {
    if (c.status === "changes_requested") {
      out.push({
        id: `changes-${c.id}`,
        category: "publishing",
        itemKey: "changesRequested",
        title: `Changes requested on ${c.title}`,
        body: c.adminFeedback,
        at: iso(c.updatedAt, "10:00:00"),
        to: `/teacher/coursebuilder/${c.id}`,
      });
    }
    if (c.status === "published" && c.submittedAt) {
      out.push({
        id: `approved-${c.id}`,
        category: "publishing",
        itemKey: "courseApproved",
        title: `${c.title} was approved and is live`,
        at: new Date(new Date(c.submittedAt).getTime() + 2 * DAY).toISOString(),
        to: `/teacher/coursemanagement/${c.id}`,
      });
    }
  });

  series
    .filter((s) => s.teacherId === currentTeacherId && s.origin === "assigned" && !s.declined && ["assigned", "drafting", "ready"].includes(s.status))
    .forEach((s) =>
      out.push({
        id: `assigned-${s.id}-${s.status}`,
        category: "publishing",
        itemKey: "adminFeedback",
        title: `Admin assigned you a test series: ${s.title}`,
        body: "Open it to start building, or request more time.",
        at: iso(s.updatedAt || s.createdAt || "2026-09-18", "09:30:00"),
        to: "/teacher/testseries/assigned",
      })
    );

  // --- Earnings & Payouts ---------------------------------------------------
  seedPayouts().forEach((p) => {
    const amount = formatMoney(p.amount, p.currency);
    const copy = {
      Requested: [`Payout of ${amount} requested`, "We'll let you know when it's approved.", p.requestedAt],
      Approved: [`Payout of ${amount} approved`, "", p.requestedAt],
      Processing: [`Payout of ${amount} is processing`, "It should reach you within 2–3 business days.", p.requestedAt],
      Paid: [`Payout of ${amount} was paid`, "", p.completedAt],
      Failed: [`Payout of ${amount} failed`, p.failureReason ?? "", p.completedAt],
    }[p.status];
    if (!copy) return;
    out.push({
      id: `payout-${p.id}-${p.status}`,
      category: "earnings",
      itemKey: "payoutStatus",
      title: copy[0],
      body: copy[1],
      at: iso(copy[2], "12:00:00"),
      to: "/teacher/earnings",
    });
  });

  TEST_SERIES_SALES_SEED.forEach((t) => {
    const total = t.recent.length + t.older.reduce((n, o) => n + o.count, 0);
    if (total < 100) return;
    out.push({
      id: `milestone-${t.seriesId}-100`,
      category: "earnings",
      itemKey: "earningsMilestone",
      title: `${t.title} passed 100 enrolments`,
      body: `${total} learners have joined this test series so far.`,
      at: new Date(TODAY.getTime() - 4 * DAY).toISOString(),
      to: `/teacher/testseries/${t.seriesId}/detail`,
    });
  });

  // --- Platform Updates (+ this educator's own verification status) ---------
  if (account) {
    const name = account.profile?.fullName?.split(" ")[0] ?? "";
    if (account.status === EDUCATOR_STATUS.APPROVED && account.approvedAt) {
      out.push({
        id: `acct-approved-${account.id}`,
        category: "platform",
        itemKey: "platformAnnouncement",
        title: `You're verified${name ? `, ${name}` : ""} — your Digital ID Card is live`,
        at: account.approvedAt,
        to: "/teacher/profilesetup",
      });
    } else if (account.status === EDUCATOR_STATUS.CHANGES_REQUESTED || account.status === EDUCATOR_STATUS.REJECTED) {
      out.push({
        id: `acct-review-${account.id}-${account.reviewedAt}`,
        category: "platform",
        itemKey: "platformAnnouncement",
        title: account.status === EDUCATOR_STATUS.REJECTED ? "Your educator profile wasn't approved" : "Changes requested on your educator profile",
        body: account.adminFeedback,
        at: account.reviewedAt || account.submittedAt,
        to: "/teacher/registration?resubmit=1",
      });
    } else if (account.status === EDUCATOR_STATUS.PENDING) {
      out.push({
        id: `acct-submitted-${account.id}-${account.submittedAt}`,
        category: "platform",
        itemKey: "platformAnnouncement",
        title: "We received your educator profile",
        body: "It's under verification — most reviews finish within 2–3 business days.",
        at: account.submittedAt,
        to: "/teacher/profilesetup",
      });
    }
  }
  out.push(...PLATFORM_EVENTS);

  const now = mockNowMs();
  return out
    .map((n) => ({ ...n, seenByDefault: now - new Date(n.at).getTime() > 3 * DAY }))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

// "5 min ago" / "3 hr ago" / "yesterday" / "6 days ago", then a plain date.
export function notificationTime(iso8601) {
  const diff = Math.max(0, mockNowMs() - new Date(iso8601).getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const d = Math.floor(hr / 24);
  if (d === 1) return "yesterday";
  if (d < 14) return `${d} days ago`;
  return new Date(iso8601).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ---- Read state (per educator, persisted) ----------------------------------
const READ_KEY = "ul.educator.notifRead.v1";
function loadRead() {
  try {
    return JSON.parse(window.localStorage.getItem(READ_KEY) || "{}") || {};
  } catch {
    return {};
  }
}
let readState = loadRead();
const readListeners = new Set();
function subscribeRead(l) {
  readListeners.add(l);
  const onStorage = (e) => {
    if (e.key === READ_KEY || e.key === null) {
      readState = loadRead();
      readListeners.forEach((fn) => fn());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    readListeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}
function writeRead(next) {
  readState = next;
  try {
    window.localStorage.setItem(READ_KEY, JSON.stringify(next));
  } catch {
    /* in-memory only */
  }
  readListeners.forEach((fn) => fn());
}

export function useNotificationReadState(accountId) {
  const state = useSyncExternalStore(subscribeRead, () => readState, () => readState);
  const readIds = state[accountId] ?? EMPTY;
  const markRead = useCallback(
    (id) => {
      const cur = readState[accountId] ?? [];
      if (cur.includes(id)) return;
      writeRead({ ...readState, [accountId]: [...cur, id] });
    },
    [accountId]
  );
  const markAllRead = useCallback(
    (ids) => writeRead({ ...readState, [accountId]: [...new Set([...(readState[accountId] ?? []), ...ids])] }),
    [accountId]
  );
  return { readIds, markRead, markAllRead };
}
const EMPTY = [];
