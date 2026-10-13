// Per-student drill-down for the detail drawer. Everything is derived from the
// same scoped report the dashboard uses, so numbers always agree with the table.
import { DIFFICULTIES } from "./testSeriesPerformanceData";
import { mean, round1, accOf } from "./testSeriesPerformanceStats";

export function computeStudentDetail(report, key) {
  const st = report.students.find((s) => s.key === key);
  if (!st) return null;
  const S = report.scope;
  const perf = S.perf;
  const qs = new Map(perf.questions.map((q) => [q.id, q]));
  const pctRows = (testId) => S.rows.filter((r) => r.testId === testId);

  const history = S.tests.map((t, i) => {
    const row = st.rows.find((r) => r.testId === t.id);
    const all = pctRows(t.id);
    const below = row ? all.filter((r) => r.pct < row.pct).length : 0;
    const equal = row ? all.filter((r) => r.pct === row.pct).length : 0;
    const rk = st.rankHistory.find((r) => r.testId === t.id);
    return { id: t.id, title: t.title, short: `T${i + 1}`, pct: row ? row.pct : null, percentile: row && all.length ? Math.round(((below + equal / 2) / all.length) * 100) : null, rank: rk?.rank ?? null, of: rk?.of ?? all.length };
  });

  const sections = report.sections.map((s) => ({ id: s.id, title: s.title, mine: st.sectionPct[s.id] ?? null, cohort: s.avg }));

  const topicTally = {};
  st.rows.forEach((r) => r.answers.forEach((a) => {
    const q = qs.get(a.qid);
    if (!q || q.subjective) return;
    const t = (topicTally[q.topic] = topicTally[q.topic] || { c: 0, w: 0, s: 0 });
    if (a.status === "correct") t.c += 1; else if (a.status === "wrong") t.w += 1; else t.s += 1;
  }));
  const topics = report.topics.rows.map((t) => ({ topic: t.topic, mine: topicTally[t.topic] ? accOf(topicTally[t.topic]) : null, cohort: t.acc })).filter((t) => t.mine !== null || t.cohort !== null);

  const diffTally = {};
  st.rows.forEach((r) => r.answers.forEach((a) => {
    const q = qs.get(a.qid);
    if (!q || q.subjective) return;
    const t = (diffTally[q.difficulty] = diffTally[q.difficulty] || { c: 0, w: 0, s: 0 });
    if (a.status === "correct") t.c += 1; else if (a.status === "wrong") t.w += 1; else t.s += 1;
  }));
  const difficulty = DIFFICULTIES.map((d) => ({ label: d, mine: diffTally[d] ? accOf(diffTally[d]) : null, cohort: report.diffAcc[d] })).filter((d) => d.mine !== null || d.cohort !== null);

  const timing = report.questions.filter((q) => !q.subjective).map((q) => {
    let mine = null;
    st.rows.forEach((r) => { const a = r.answers.find((x) => x.qid === q.id); if (a) mine = a.timeSec; });
    return { id: q.id, label: `Q${q.number}`, full: q.label, mine, cohort: q.avgTimeSec };
  }).filter((q) => q.mine !== null);

  const attempts = st.attempts.slice().sort((a, b) => b.date.localeCompare(a.date) || b.no - a.no).map((a) => ({
    id: a.id, test: perf.tests.find((t) => t.id === a.testId)?.title || "Test", no: a.no, date: a.date, finished: a.finished, pct: a.pct, timeMin: round1(a.timeSec / 60), late: a.late, fast: a.fast,
  }));

  const withoutPenalty = st.rows.length ? round1(mean(st.rows.map((r) => (r.maxMarks ? Math.max(0, r.marks + r.negativeLoss) / r.maxMarks * 100 : 0)))) : null;
  const subjective = st.rows.flatMap((r) => r.subjective.map((sj) => ({ ...sj, test: perf.tests.find((t) => t.id === r.testId)?.title, question: qs.get(sj.qid)?.text, topic: qs.get(sj.qid)?.topic, date: r.date })));

  return {
    student: st, history, sections, topics, difficulty, timing, attempts, subjective,
    negative: { enabled: report.negative.enabled, scheme: report.negative.scheme, lost: st.negLoss, withPenalty: st.avgPct, withoutPenalty },
    cohortGuess: report.guessRate,
    cohortSkip: report.skipRate,
  };
}
