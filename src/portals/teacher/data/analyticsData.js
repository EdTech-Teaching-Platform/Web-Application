// analyticsData.js — pure derived-helper functions for the portfolio-wide
// Analytics hub. Every number here is computed from the SAME shared mock
// data every other screen already reads (TeacherCoursesContext's courses,
// earningsData's seeded ledger, studentDirectory's roster) — nothing here
// is a separately hardcoded figure, so Analytics can never drift from
// Earnings/Course Management/Student Management/Reviews.
//
// A few derivations need a granularity the existing mock data doesn't
// literally carry (a time-of-day activity log, a month-by-month at-risk
// history). Those are clearly marked APPROXIMATION below: each is derived
// deterministically from real fields already on the data (dates, progress,
// ids) rather than Math.random()-per-render, so they're stable and
// internally consistent, but they are not real recorded events.

import { TODAY, courseAnalytics, courseTotalRevenue, courseMonthlyRevenue } from "./teacherCourses";
import { buildRoster, rosterStats } from "./studentDirectory";
import { seedEarnings } from "./earningsData";

// ---------------------------------------------------------------------
// Date range — mirrors Earnings' exact DATE_RANGES ("30D"/"3M"/"6M"/"All")
// rather than the spec's This Month/Last 3 Months/This Year/All Time/Custom
// wording, since the instruction is to replicate Earnings' *actual*
// control exactly, and that's the real set Earnings.jsx/EarningsDashboardTab
// already ship. "Custom" isn't part of the real control either, so it's
// left out here too, for the same reconciliation reason.
export const ANALYTICS_RANGES = ["30D", "3M", "6M", "All"];

export function rangeDays(range) {
  if (range === "30D") return 30;
  if (range === "3M") return 90;
  if (range === "6M") return 180;
  return Infinity;
}

export function isoDaysAgo(n) {
  return new Date(TODAY.getTime() - n * 86400000).toISOString().slice(0, 10);
}

function inRange(dateStr, range) {
  if (!dateStr) return false;
  if (range === "All") return true;
  return dateStr >= isoDaysAgo(rangeDays(range));
}

// Previous period of equal length immediately preceding the current range
// — used for every hero-stat trend comparison below.
function inPriorRange(dateStr, range) {
  if (!dateStr || range === "All") return false;
  const days = rangeDays(range);
  const start = isoDaysAgo(days * 2);
  const end = isoDaysAgo(days);
  return dateStr >= start && dateStr < end;
}

function pctChange(current, prior) {
  if (prior <= 0) return current > 0 ? 100 : 0;
  return Math.round(((current - prior) / prior) * 1000) / 10;
}

// ---------------------------------------------------------------------
// Shared roster + ledger — every section below reuses these two, never a
// second independently-built copy.
export function buildAnalyticsRoster(courses) {
  return buildRoster(courses);
}

export function buildAnalyticsLedger(courses) {
  return seedEarnings(courses).ledger;
}

// ---------------------------------------------------------------------
// Reviews — identical formula to PortfolioReviewsSection.jsx's `stats.avg`
// so the hero card's rating can never disagree with the Reviews page.
export function allReviews(courses) {
  return courses.flatMap((c) => c.reviews.map((r) => ({ ...r, courseId: c.id, courseTitle: c.title })));
}

export function portfolioAvgRating(courses) {
  const reviews = allReviews(courses);
  if (!reviews.length) return 0;
  return reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
}

// ---------------------------------------------------------------------
// Revenue — reuses the exact ledger seedEarnings()/courseBreakdown() build
// for Earnings, filtered to the selected range.
export function revenueInRange(ledger, range) {
  const rows = ledger.filter((e) => (e.type === "sale" || e.type === "clawback") && inRange(e.date, range));
  return Math.round(rows.reduce((s, e) => s + e.amount, 0) * 100) / 100;
}

function revenuePriorRange(ledger, range) {
  if (range === "All") return 0;
  const rows = ledger.filter((e) => (e.type === "sale" || e.type === "clawback") && inPriorRange(e.date, range));
  return Math.round(rows.reduce((s, e) => s + e.amount, 0) * 100) / 100;
}

// ---------------------------------------------------------------------
// Hero stats (Part 1) — each with a trend vs. the prior equivalent period.
// Enrollment/completion trends use each student's real enrolledAt/lastActive
// dates as the timestamp to compare against the range boundary — completions
// have no separate `completedAt` field in the mock data, so a completed
// student's `lastActive` date is used as a stand-in for "when they finished"
// (APPROXIMATION — noted because the mock data genuinely has no distinct
// completion timestamp).
export function heroStats(courses, range) {
  const roster = buildAnalyticsRoster(courses);
  const ledger = buildAnalyticsLedger(courses);
  const stats = rosterStats(roster);

  const allStudents = courses.flatMap((c) => c.students.map((s) => ({ ...s, courseId: c.id })));
  const totalCompletions = allStudents.filter((s) => s.completionStatus === "completed").length;
  const priorCompletions = allStudents.filter((s) => s.completionStatus === "completed" && inPriorRange(s.lastActive, range)).length;
  const currentCompletions = range === "All" ? totalCompletions : allStudents.filter((s) => s.completionStatus === "completed" && inRange(s.lastActive, range)).length;

  const totalEnrollments = allStudents.length;
  const completionRate = totalEnrollments ? Math.round((totalCompletions / totalEnrollments) * 1000) / 10 : 0;

  const currentStudents = range === "All" ? stats.total : roster.filter((r) => inRange(r.enrolledAt, range)).length;
  const priorStudents = roster.filter((r) => inPriorRange(r.enrolledAt, range)).length;

  const currentRevenue = revenueInRange(ledger, range);
  const priorRevenue = revenuePriorRange(ledger, range);

  const reviews = allReviews(courses);
  const currentReviews = range === "All" ? reviews : reviews.filter((r) => inRange(r.date, range));
  const priorReviews = reviews.filter((r) => inPriorRange(r.date, range));
  const currentAvgRating = currentReviews.length ? currentReviews.reduce((s, r) => s + r.rating, 0) / currentReviews.length : portfolioAvgRating(courses);
  const priorAvgRating = priorReviews.length ? priorReviews.reduce((s, r) => s + r.rating, 0) / priorReviews.length : currentAvgRating;

  return {
    totalStudents: stats.total,
    totalStudentsTrend: pctChange(currentStudents, priorStudents),
    totalCompletions,
    totalCompletionsTrend: pctChange(currentCompletions, priorCompletions),
    completionRate,
    avgRating: portfolioAvgRating(courses),
    avgRatingTrend: pctChange(currentAvgRating, priorAvgRating),
    totalRevenue: currentRevenue,
    totalRevenueTrend: pctChange(currentRevenue, priorRevenue),
  };
}

// ---------------------------------------------------------------------
// Combined trend series (Part 1) — monthly buckets of enrollments,
// completions and revenue over the selected range.
export function monthlyBucketLabels(range) {
  const months = range === "30D" ? 1 : range === "3M" ? 3 : 6;
  const buckets = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, 1);
    buckets.push({ key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleString("en-US", { month: "short" }) });
  }
  return buckets;
}

export function combinedTrendSeries(courses, range) {
  const buckets = monthlyBucketLabels(range === "All" ? "6M" : range).map((b) => ({ ...b, enrollments: 0, completions: 0, revenue: 0 }));
  const ledger = buildAnalyticsLedger(courses);
  const allStudents = courses.flatMap((c) => c.students);

  function bucketFor(dateStr) {
    const d = new Date(dateStr);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    return buckets.find((b) => b.key === key);
  }

  allStudents.forEach((s) => {
    const eb = bucketFor(s.enrolledAt);
    if (eb) eb.enrollments += 1;
    if (s.completionStatus === "completed") {
      const cb = bucketFor(s.lastActive); // APPROXIMATION — see heroStats note
      if (cb) cb.completions += 1;
    }
  });

  ledger.forEach((e) => {
    if (e.type !== "sale" && e.type !== "clawback") return;
    const b = bucketFor(e.date);
    if (b) b.revenue += e.amount;
  });

  return buckets.map((b) => ({ label: b.label, enrollments: b.enrollments, completions: b.completions, revenue: Math.round(b.revenue * 100) / 100 }));
}

// ---------------------------------------------------------------------
// Per-course comparison rows (Part 2).
export function courseComparisonRows(courses) {
  return courses
    .filter((c) => c.status === "published" || c.status === "archived")
    .map((c) => {
      const total = c.students.length;
      const completed = c.students.filter((s) => s.completionStatus === "completed").length;
      const analytics = courseAnalytics(c.id);
      return {
        id: c.id,
        title: c.title,
        status: c.status,
        enrollments: total,
        completionRate: total ? Math.round((completed / total) * 1000) / 10 : 0,
        avgRating: c.rating || 0,
        ratingCount: c.ratingCount || 0,
        revenue: courseTotalRevenue(c),
        monthlyRevenue: courseMonthlyRevenue(c),
        sparkline: analytics.enrollmentTrend,
      };
    })
    .sort((a, b) => b.revenue - a.revenue);
}

// ---------------------------------------------------------------------
// Auto-surfaced insights (Part 1) — real comparisons over the same data,
// not static copy. Each carries a `to` route so the highlight card can
// route straight into the relevant deeper section/screen.
export function portfolioInsights(courses) {
  const rows = courseComparisonRows(courses);
  const roster = buildAnalyticsRoster(courses);
  const insights = [];

  const withStudents = rows.filter((r) => r.enrollments > 0);
  if (withStudents.length) {
    const best = [...withStudents].sort((a, b) => b.completionRate - a.completionRate)[0];
    insights.push({
      id: "top-engagement",
      tone: "success",
      title: `"${best.title}" has your highest completion rate`,
      detail: `${best.completionRate}% of enrolled students finish it — your portfolio average is ${
        Math.round((withStudents.reduce((s, r) => s + r.completionRate, 0) / withStudents.length) * 10) / 10
      }%.`,
      to: `/teacher/coursemanagement/${best.id}?tab=analytics`,
    });

    const worst = [...withStudents].sort((a, b) => a.completionRate - b.completionRate)[0];
    if (worst.id !== best.id && worst.completionRate < 50) {
      insights.push({
        id: "struggling-course",
        tone: "warning",
        title: `"${worst.title}" is struggling with completion`,
        detail: `Only ${worst.completionRate}% of students finish it — worth a look at where they drop off.`,
        to: `/teacher/coursemanagement/${worst.id}?tab=analytics`,
      });
    }
  }

  const nearFinishInactive = roster.filter((r) => r.overallProgress >= 70 && r.overallProgress < 100 && r.lastActiveDaysAgo >= 7);
  if (nearFinishInactive.length) {
    insights.push({
      id: "near-finish-inactive",
      tone: "warning",
      title: `${nearFinishInactive.length} student${nearFinishInactive.length === 1 ? " is" : "s are"} close to finishing, but gone quiet`,
      detail: `${nearFinishInactive.length} student${nearFinishInactive.length === 1 ? "" : "s"} at 70%+ progress with no activity in a week — a nudge now could convert them into a completion.`,
      to: "/teacher/analytics?tab=engagement",
    });
  }

  if (withStudents.length) {
    const topRevenue = [...withStudents].sort((a, b) => b.revenue - a.revenue)[0];
    insights.push({
      id: "top-revenue",
      tone: "success",
      title: `"${topRevenue.title}" leads your portfolio in revenue`,
      detail: `${formatUsd(topRevenue.revenue)} in lifetime earnings — see the full breakdown in Revenue Insights.`,
      to: "/teacher/analytics?tab=revenue",
    });
  }

  const quiz = quizAnalytics(courses);
  if (quiz.mostMissed.length) {
    const top = quiz.mostMissed[0];
    insights.push({
      id: "most-missed-question",
      tone: "warning",
      title: `Students most often miss one question in "${top.courseTitle}"`,
      detail: `${top.missPct}% of students get "${top.question.slice(0, 60)}${top.question.length > 60 ? "…" : ""}" wrong — worth revisiting that lesson.`,
      to: "/teacher/analytics?tab=assessment",
    });
  }

  return insights;
}

// Kept under its original name so existing imports keep working; now
// renders rupees with Indian digit grouping (whole rupees).
function formatUsd(n) {
  return `₹${Math.round(Math.abs(n)).toLocaleString("en-IN")}`;
}

// ---------------------------------------------------------------------
// Engagement funnel (Part 3) — aggregated across every course's real
// student progress field. "Started first lesson" is inferred as progress
// > 0 and "50% complete" as progress >= 50 (APPROXIMATION — the mock data
// tracks one overall progress % per student, not a per-lesson completion
// log, so these stage boundaries are read off that single field rather
// than a literal "started lesson 1" event).
export function engagementFunnel(courses) {
  const students = courses.flatMap((c) => c.students);
  const enrolled = students.length;
  const started = students.filter((s) => s.progress > 0).length;
  const halfway = students.filter((s) => s.progress >= 50).length;
  const completed = students.filter((s) => s.progress === 100 || s.completionStatus === "completed").length;

  const stages = [
    { key: "enrolled", label: "Enrolled", count: enrolled },
    { key: "started", label: "Started First Lesson", count: started },
    { key: "halfway", label: "50% Complete", count: halfway },
    { key: "completed", label: "Completed", count: completed },
  ];

  return stages.map((s, i) => {
    const prev = i === 0 ? null : stages[i - 1];
    const pctOfStart = enrolled ? Math.round((s.count / enrolled) * 1000) / 10 : 0;
    const dropoffFromPrev = prev && prev.count ? Math.round((1 - s.count / prev.count) * 1000) / 10 : 0;
    return { ...s, pctOfStart, dropoffFromPrev };
  });
}

// ---------------------------------------------------------------------
// Activity heatmap (Part 3) — APPROXIMATION. The mock data has no
// time-of-day activity log, so this grid is built deterministically: a
// seeded PRNG (mulberry32, seeded by a fixed string so it never changes
// between renders) sets each cell's baseline, then real lastActive /
// submittedAt dates bias the weekday columns that actually saw activity —
// so it's stable and roughly consistent with the real dates on record,
// but not a literal recorded event log.
function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const HOUR_BLOCKS = ["12–4am", "4–8am", "8am–12pm", "12–4pm", "4–8pm", "8pm–12am"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function activityHeatmap(courses) {
  const rand = mulberry32(20260920);
  const weekdayCounts = new Array(7).fill(0);
  courses.forEach((c) => {
    c.students.forEach((s) => {
      if (s.lastActive) weekdayCounts[new Date(s.lastActive).getDay()] += 1;
    });
    (c.submissions || []).forEach((s) => {
      if (s.submittedAt) weekdayCounts[new Date(s.submittedAt).getDay()] += 1;
    });
  });
  const maxWeekday = Math.max(...weekdayCounts, 1);

  const grid = WEEKDAYS.map((day, dayIdx) => {
    const weekdayBias = 0.4 + (weekdayCounts[dayIdx] / maxWeekday) * 0.6;
    const cells = HOUR_BLOCKS.map((block, hourIdx) => {
      const timeBias = hourIdx >= 2 && hourIdx <= 4 ? 1.15 : 0.85; // daytime/evening skew
      const base = rand();
      const value = Math.round(Math.min(100, base * 70 * weekdayBias * timeBias + 10));
      return { hour: block, value };
    });
    return { day, cells };
  });

  return grid;
}

// ---------------------------------------------------------------------
// Lesson-level drop-off (Part 3) — reuses each course's real, already-
// established `dropoffFunnel` from courseAnalytics() (teacherCourses.js),
// the same data Course Management's Analytics tab already shows — never a
// separately invented number.
export function lessonDropoffByCourse(courses) {
  return courses
    .filter((c) => c.students.length > 0)
    .map((c) => ({ id: c.id, title: c.title, funnel: courseAnalytics(c.id).dropoffFunnel }))
    .filter((c) => c.funnel.length > 0);
}

// ---------------------------------------------------------------------
// At-risk trend over time (Part 3) — reuses studentDirectory.js's exact
// `atRisk` derivation (completionStatus !== "completed" && daysAgo(lastActive)
// >= 14), never redefined. Since at-risk is a derived, not stored, flag,
// a historical trend needs a point-in-time recomputation: for each past
// month-end, at-risk is recomputed as if "today" were that date instead of
// TODAY (APPROXIMATION — noted because the mock data has no stored history
// of who was at-risk on any past date; this replays the same real formula
// against each student's real lastActive/completionStatus as of that date).
export function atRiskTrend(courses, months = 6) {
  const roster = buildAnalyticsRoster(courses);
  const points = [];
  for (let i = months - 1; i >= 0; i--) {
    const asOf = new Date(TODAY.getFullYear(), TODAY.getMonth() - i, TODAY.getDate());
    const label = asOf.toLocaleString("en-US", { month: "short" });
    const count = roster.filter((r) => {
      if (r.overallStatus === "completed") return false;
      if (new Date(r.enrolledAt) > asOf) return false; // not enrolled yet as of that date
      const lastActiveMs = new Date(r.lastActive) > asOf ? asOf : new Date(r.lastActive);
      const days = Math.round((asOf - lastActiveMs) / 86400000);
      return days >= 14;
    }).length;
    points.push({ label, count });
  }
  return points;
}

// ---------------------------------------------------------------------
// Quiz analytics (Part 4) — reuses each course's real `quizPerformance`
// (courseAnalytics(), teacherCourses.js — already question-level: question
// text + correctPct), the same data Course Management's Analytics tab
// shows. Average score and pass rate are derived from that same set as a
// proxy (APPROXIMATION — the mock data has per-question correctPct across
// all quiz-takers but no per-student quiz score record beyond one sample
// submission, so "average score" here is the average correctPct across all
// tracked questions, and "pass rate" is the share of questions with
// correctPct >= 70, a defensible read of the same real numbers rather than
// a fabricated separate figure).
export function quizAnalytics(courses) {
  const rows = [];
  courses.forEach((c) => {
    const qp = courseAnalytics(c.id).quizPerformance || [];
    qp.forEach((q) => rows.push({ courseId: c.id, courseTitle: c.title, question: q.question, correctPct: q.correctPct, missPct: 100 - q.correctPct }));
  });

  const avgScore = rows.length ? Math.round((rows.reduce((s, r) => s + r.correctPct, 0) / rows.length) * 10) / 10 : 0;
  const passRate = rows.length ? Math.round((rows.filter((r) => r.correctPct >= 70).length / rows.length) * 100) : 0;
  const mostMissed = [...rows].sort((a, b) => b.missPct - a.missPct);

  return { totalQuestions: rows.length, avgScore, passRate, mostMissed };
}

// ---------------------------------------------------------------------
// Grading turnaround (Part 4) — derived from real submittedAt/gradedAt
// timestamps already on submission records.
export function gradingTurnaround(courses) {
  const graded = courses.flatMap((c) =>
    (c.submissions || [])
      .filter((s) => s.status === "graded" && s.submittedAt && s.gradedAt)
      .map((s) => ({
        ...s,
        courseTitle: c.title,
        turnaroundDays: Math.max(0, Math.round((new Date(s.gradedAt) - new Date(s.submittedAt)) / 86400000)),
      }))
  );

  const avgTurnaround = graded.length ? Math.round((graded.reduce((s, g) => s + g.turnaroundDays, 0) / graded.length) * 10) / 10 : 0;

  const buckets = [
    { key: "same-day", label: "Same day", test: (d) => d <= 1 },
    { key: "1-3", label: "1–3 days", test: (d) => d > 1 && d <= 3 },
    { key: "3-7", label: "3–7 days", test: (d) => d > 3 && d <= 7 },
    { key: "7plus", label: "7+ days", test: (d) => d > 7 },
  ];
  const distribution = buckets.map((b) => ({
    label: b.label,
    count: graded.filter((g) => b.test(g.turnaroundDays)).length,
  }));

  const trend = graded
    .reduce((acc, g) => {
      const d = new Date(g.gradedAt);
      const key = `${d.getFullYear()}-${d.getMonth()}`;
      const label = d.toLocaleString("en-US", { month: "short" });
      let bucket = acc.find((b) => b.key === key);
      if (!bucket) {
        bucket = { key, label, total: 0, count: 0 };
        acc.push(bucket);
      }
      bucket.total += g.turnaroundDays;
      bucket.count += 1;
      return acc;
    }, [])
    .sort((a, b) => (a.key < b.key ? -1 : 1))
    .map((b) => ({ label: b.label, avgDays: Math.round((b.total / b.count) * 10) / 10 }));

  return { avgTurnaround, distribution, trend, sampleSize: graded.length };
}

// Rubric insight — GradingPanel/course data only carries rubric criteria
// (label + points) for a small subset of assignment lessons (c2's "Profile
// and fix a slow list view", plus two empty rubric arrays on c4/c5). There
// is no per-student, per-criterion score recorded anywhere in the mock
// data, so a genuine "which rubric criterion students struggle with most"
// insight isn't derivable — this returns the raw criteria that do exist so
// the UI can show them as reference context, and the UI marks the deeper
// insight as not applicable rather than fabricating scores.
export function rubricCriteriaOnRecord(courses) {
  const rows = [];
  courses.forEach((c) => {
    (c.modules || []).forEach((m) => {
      (m.lessons || []).forEach((l) => {
        if (l.rubric && l.rubric.length) {
          rows.push({ courseId: c.id, courseTitle: c.title, lessonTitle: l.title, criteria: l.rubric });
        }
      });
    });
  });
  return rows;
}

// ---------------------------------------------------------------------
// Revenue & financial (Part 5).
export function revenueEfficiency(courses) {
  const roster = buildAnalyticsRoster(courses);
  const publishedRows = courseComparisonRows(courses).filter((r) => r.status === "published");
  const totalRevenue = publishedRows.reduce((s, r) => s + r.revenue, 0);
  const perStudent = roster.length ? Math.round((totalRevenue / roster.length) * 100) / 100 : 0;
  const perCourse = publishedRows.length ? Math.round((totalRevenue / publishedRows.length) * 100) / 100 : 0;
  return { totalRevenue, perStudent, perCourse, publishedCount: publishedRows.length };
}

// Revenue split by source (direct / bundle / test series), from the same
// ledger rows revenueInRange() sums, so the parts always add to the total.
export function revenueBySource(courses, range) {
  const rows = buildAnalyticsLedger(courses).filter((e) => (e.type === "sale" || e.type === "clawback") && inRange(e.date, range));
  const keys = { course: "Direct", bundle: "Bundle", test_series: "Test series" };
  const out = Object.entries(keys).map(([key, label]) => {
    const part = rows.filter((e) => (e.source || "course") === key);
    return { key, label, count: part.filter((e) => e.type === "sale").length, amount: Math.round(part.reduce((s, e) => s + e.amount, 0) * 100) / 100 };
  });
  const total = Math.round(out.reduce((s, r) => s + r.amount, 0) * 100) / 100;
  return { rows: out, total, reconciles: total === revenueInRange(buildAnalyticsLedger(courses), range) };
}

// Free-preview conversion signal — courses with 2+ free-preview lessons
// (the real `preview: true` flag on lesson objects, teacherCourses.js /
// contentData.js) vs. courses with fewer, compared by average total sales.
// Framed deliberately as a correlation across a small course set, not a
// causal claim — the UI carries the same caveat.
export function previewConversionSignal(courses) {
  const rows = courses
    .filter((c) => c.status === "published" || c.status === "archived")
    .map((c) => {
      const previewCount = (c.modules || []).reduce((s, m) => s + (m.lessons || []).filter((l) => l.preview).length, 0);
      return { id: c.id, title: c.title, previewCount, totalSales: c.totalSales || 0 };
    });
  const withMorePreviews = rows.filter((r) => r.previewCount >= 2);
  const withFewerPreviews = rows.filter((r) => r.previewCount < 2);
  const avg = (list) => (list.length ? Math.round((list.reduce((s, r) => s + r.totalSales, 0) / list.length) * 10) / 10 : 0);
  return {
    rows,
    moreGroupAvgSales: avg(withMorePreviews),
    fewerGroupAvgSales: avg(withFewerPreviews),
    moreGroupCount: withMorePreviews.length,
    fewerGroupCount: withFewerPreviews.length,
  };
}

export { formatUsd };
