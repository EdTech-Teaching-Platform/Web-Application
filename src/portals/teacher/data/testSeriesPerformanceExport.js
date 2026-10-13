// Export tables for the Performance tab. Scope = the current filters, so the
// file always matches what is on screen. Excel gets several sheets; CSV gets the
// student results table (CSV can only hold one table).
import { toCsv, buildXlsx } from "./spreadsheetExport";

export function buildPerformanceTables(report, perf, filters) {
  const S = report.scope;
  const tests = S.tests;
  const studentHeaders = ["Rank", "Student", "Batch", "Status", "Average score %", "Percentile", "Accuracy %", "Avg time (min)", "Attempts", "Negative marks lost", "Guess rate %", "Skip rate %", ...tests.map((t) => `${t.title} %`), "Strong topics", "Weak topics"];
  const studentRows = report.students.slice().sort((a, b) => (a.rank ?? 9999) - (b.rank ?? 9999)).map((s) => [
    s.rank ?? "", s.name, s.batch, s.status, s.avgPct ?? "", s.percentile ?? "", s.accuracy ?? "", s.timeSec ? Math.round((s.timeSec / 60) * 10) / 10 : "", s.attemptCount, s.negLoss, s.guessRate, s.skipRate,
    ...s.pcts.map((p) => (p === null ? "" : p)), s.strengths.join("; "), s.weak.join("; "),
  ]);
  const k = report.kpi;
  const summaryRows = [
    ["Series", perf.title], ["Test", filters.testId === "all" ? "All tests" : tests[0]?.title || ""], ["Date range", `${filters.from || "start"} to ${filters.to || "today"}`],
    ["Cohort", filters.cohort === "all" ? "All students" : filters.cohort.replace(/^(course|group):/, "")], ["Attempt", filters.mode],
    ["Enrolled (tracked cohort)", k.enrolled], ["Attempted", k.attempted], ["Completion rate %", k.completion], ["Average score %", k.avg], ["Median %", k.median], ["Highest %", k.high],
    ["Pass rate %", k.pass], ["Avg time per test (min)", k.timeMin], ["Avg accuracy %", k.accuracy],
  ];
  const questionRows = report.questions.map((q) => [q.label, q.text, q.topic, q.difficulty, q.responses, q.correctPct ?? "", q.avgTimeSec ?? "", q.topWrong ? `${q.topWrong.label} (${q.topWrong.pct}%)` : "", q.disc ?? "", q.auto, q.flags.join("; ")]);
  const topicRows = report.topics.rows.map((t) => [t.topic, t.acc ?? "", t.n]);
  return {
    studentHeaders, studentRows,
    sheets: [
      { name: "Summary", headers: ["Metric", "Value"], rows: summaryRows },
      { name: "Students", headers: studentHeaders, rows: studentRows },
      { name: "Questions", headers: ["Question", "Text", "Topic", "Difficulty", "Responses", "Correct %", "Avg time (s)", "Most chosen wrong", "Discrimination", "Auto label", "Flags"], rows: questionRows },
      { name: "Topics", headers: ["Topic", "Accuracy %", "Responses"], rows: topicRows },
    ],
  };
}

export function buildPerformanceFile(report, perf, filters, format) {
  const t = buildPerformanceTables(report, perf, filters);
  if (format === "csv") return { blob: toCsv(t.studentRows, t.studentHeaders), ext: "csv" };
  return { blob: buildXlsx(t.sheets), ext: "xlsx" };
}
