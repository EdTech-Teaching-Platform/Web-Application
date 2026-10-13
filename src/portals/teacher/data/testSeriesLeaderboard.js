// Leaderboard for ONE test series -- derived entirely from the same per-series
// student-attempt data that powers the Performance tab
// (generateSeriesPerformance + selectAttempts in testSeriesPerformanceData.js).
// Nothing is hardcoded or recomputed from a second source.
//
//   buildLeaderboard(series) -> { empty, tests, overall, byTest, students }
//     overall[]  one row per student who finished at least one test
//                { key, name, batch, rank, pct, marks, maxMarks, testsDone, testsTotal, timeSec, date }
//     byTest{}   testId -> rows { key, name, batch, rank, pct, marks, maxMarks, timeSec, date, attemptNo }
//
// Overall ranking method (shown in the UI): the average of each student's BEST
// score on every test they have completed. Ties go to more tests completed,
// then to less total time. "Total time" is the sum of the time taken on those
// best attempts.
//
// Only real, finished student attempts count. In-progress attempts are
// skipped, and the educator's "Preview as Student" runs are excluded outright:
// they live only in sessionStorage (TestSeriesStudentPreview) and never reach
// this dataset, and the filter below drops anything flagged as a preview
// should a future backend ever return one.
import { generateSeriesPerformance, selectAttempts } from "./testSeriesPerformanceData";

export const LB_VIEWS = ["Overall", "Per test"];
export const LB_SORTS = [
  { key: "score", label: "Score" },
  { key: "time", label: "Time taken" },
  { key: "date", label: "Completion date" },
];
export const OVERALL_METHOD = "Ranked by the average of each student's best score across the tests they've completed. Ties go to more tests completed, then less time.";

const round1 = (v) => Math.round(v * 10) / 10;
const isRealAttempt = (a) => a.finished && !a.isPreview && !a.preview && a.source !== "preview";

// Ties share a rank (1, 2, 2, 4 ...). `sameAsPrev(prev, cur)` decides what counts as a tie.
function assignRanks(sorted, sameAsPrev) {
  let rank = 0;
  return sorted.map((row, i) => {
    if (i === 0 || !sameAsPrev(sorted[i - 1], row)) rank = i + 1;
    return { ...row, rank };
  });
}

export function buildLeaderboard(series) {
  const perf = generateSeriesPerformance(series);
  if (!perf) return { empty: true, tests: [], overall: [], byTest: {}, students: 0 };
  const who = new Map(perf.students.map((s) => [s.key, s]));
  const best = selectAttempts(perf.attempts.filter(isRealAttempt), "Best");
  const tests = perf.tests.map((t) => ({ id: t.id, title: t.title, sectionTitle: t.sectionTitle, maxMarks: t.maxMarks, duration: t.duration }));

  const byTest = {};
  tests.forEach((t) => {
    const rows = best
      .filter((a) => a.testId === t.id)
      .map((a) => ({
        key: a.studentKey,
        name: who.get(a.studentKey)?.name || a.studentKey,
        batch: who.get(a.studentKey)?.batch || "",
        pct: a.pct,
        marks: a.marks,
        maxMarks: a.maxMarks,
        timeSec: a.timeSec,
        date: a.date,
        attemptNo: a.no,
      }))
      .sort((a, b) => b.pct - a.pct || a.timeSec - b.timeSec || a.name.localeCompare(b.name));
    byTest[t.id] = assignRanks(rows, (p, c) => p.pct === c.pct && p.timeSec === c.timeSec);
  });

  const perStudent = new Map();
  best.forEach((a) => {
    const cur = perStudent.get(a.studentKey) || { pcts: [], marks: 0, maxMarks: 0, timeSec: 0, date: "" };
    cur.pcts.push(a.pct);
    cur.marks += a.marks;
    cur.maxMarks += a.maxMarks;
    cur.timeSec += a.timeSec;
    if (a.date > cur.date) cur.date = a.date;
    perStudent.set(a.studentKey, cur);
  });
  const overallRows = Array.from(perStudent.entries())
    .map(([key, v]) => ({
      key,
      name: who.get(key)?.name || key,
      batch: who.get(key)?.batch || "",
      pct: round1(v.pcts.reduce((n, x) => n + x, 0) / v.pcts.length),
      marks: round1(v.marks),
      maxMarks: v.maxMarks,
      testsDone: v.pcts.length,
      testsTotal: tests.length,
      timeSec: v.timeSec,
      date: v.date,
    }))
    .sort((a, b) => b.pct - a.pct || b.testsDone - a.testsDone || a.timeSec - b.timeSec || a.name.localeCompare(b.name));
  const overall = assignRanks(overallRows, (p, c) => p.pct === c.pct && p.testsDone === c.testsDone);
  return { empty: overall.length === 0, tests, overall, byTest, students: overall.length };
}

export function searchRows(rows, query) {
  const q = String(query || "").trim().toLowerCase();
  return q ? rows.filter((r) => r.name.toLowerCase().includes(q)) : rows;
}

// Rank always reflects the score ranking; sorting only re-orders the rows shown.
export function sortRows(rows, sort) {
  const out = rows.slice();
  if (sort === "time") return out.sort((a, b) => a.timeSec - b.timeSec || a.rank - b.rank);
  if (sort === "date") return out.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.rank - b.rank));
  return out.sort((a, b) => a.rank - b.rank || a.name.localeCompare(b.name));
}
