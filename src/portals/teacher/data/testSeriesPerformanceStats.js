// Pure aggregation for the Performance tab: takes the generated attempts
// (testSeriesPerformanceData.js) plus the active filters and returns every
// number the dashboard renders (KPIs, histogram, trend, leaderboard, student
// rows, topic matrix, question analytics, engagement). No React in here.
import { addDays, daysBetween, ranksByTest, selectAttempts, DIFFICULTIES } from "./testSeriesPerformanceData";

export const mean = (a) => (a.length ? a.reduce((n, v) => n + v, 0) / a.length : 0);
export const round1 = (v) => Math.round(v * 10) / 10;
export function median(a) {
  if (!a.length) return 0;
  const s = a.slice().sort((x, y) => x - y);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
export function percentileOf(sorted, p) {
  if (!sorted.length) return 0;
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}
const pctOf = (n, d) => (d ? (n / d) * 100 : 0);

export const DEFAULT_FILTERS = { testId: "all", from: "", to: "", cohort: "all", mode: "Best" };

// ---- scoping ---------------------------------------------------------------
// ctx: { courseMembers: { [courseId]: string[] student keys } }
export function scopePerformance(perf, filters = DEFAULT_FILTERS, ctx = {}) {
  const f = { ...DEFAULT_FILTERS, ...filters };
  let students = perf.students;
  if (f.cohort.startsWith("course:")) {
    const set = new Set((ctx.courseMembers || {})[f.cohort.slice(7)] || []);
    students = students.filter((s) => set.has(s.key));
  } else if (f.cohort.startsWith("group:")) {
    students = students.filter((s) => s.batch === f.cohort.slice(6));
  }
  const keys = new Set(students.map((s) => s.key));
  const tests = f.testId === "all" ? perf.tests : perf.tests.filter((t) => t.id === f.testId);
  const testIds = new Set(tests.map((t) => t.id));
  const attemptsAll = perf.attempts.filter((a) => keys.has(a.studentKey) && testIds.has(a.testId) && (!f.from || a.date >= f.from) && (!f.to || a.date <= f.to));
  const rows = selectAttempts(attemptsAll, f.mode);
  return { perf, filters: f, students, keys, tests, testIds, attemptsAll, rows, ranks: ranksByTest(rows, tests) };
}

const qMap = (perf) => new Map(perf.questions.map((q) => [q.id, q]));

// Objective responses of a set of attempt rows -> counters.
function tally(rows, qs, pred = () => true) {
  const t = { c: 0, w: 0, s: 0 };
  rows.forEach((r) => r.answers.forEach((a) => {
    const q = qs.get(a.qid);
    if (!q || q.subjective || !pred(q, a)) return;
    if (a.status === "correct") t.c += 1; else if (a.status === "wrong") t.w += 1; else if (a.status === "skipped") t.s += 1;
  }));
  return t;
}
export const accOf = (t) => (t.c + t.w ? round1(pctOf(t.c, t.c + t.w)) : null);

function groupTally(rows, qs, keyFn) {
  const out = {};
  rows.forEach((r) => r.answers.forEach((a) => {
    const q = qs.get(a.qid);
    if (!q || q.subjective) return;
    const k = keyFn(q, r);
    const t = (out[k] = out[k] || { c: 0, w: 0, s: 0 });
    if (a.status === "correct") t.c += 1; else if (a.status === "wrong") t.w += 1; else if (a.status === "skipped") t.s += 1;
  }));
  return out;
}

// ---- per-student summaries ------------------------------------------------
function summarizeStudents(S) {
  const { perf, tests, rows, attemptsAll, ranks } = S;
  const qs = qMap(perf);
  const expectedByTest = Object.fromEntries(perf.tests.map((t) => [t.id, 0]));
  perf.questions.forEach((q) => { expectedByTest[q.testId] += q.expectedSec; });
  const list = S.students.map((st) => {
    const mine = rows.filter((r) => r.studentKey === st.key).sort((a, b) => perf.tests.findIndex((t) => t.id === a.testId) - perf.tests.findIndex((t) => t.id === b.testId));
    const att = attemptsAll.filter((a) => a.studentKey === st.key);
    const pcts = tests.map((t) => mine.find((r) => r.testId === t.id)?.pct ?? null);
    const tl = tally(mine, qs);
    const secs = {};
    mine.forEach((r) => {
      const s = (secs[r.sectionId] = secs[r.sectionId] || { m: 0, x: 0 });
      s.m += r.marks > 0 ? r.marks : 0;
      s.x += r.maxMarks;
    });
    const sectionPct = Object.fromEntries(Object.entries(secs).map(([k, v]) => [k, round1(pctOf(v.m, v.x))]));
    const topics = groupTally(mine, qs, (q) => q.topic);
    const topicList = Object.entries(topics).map(([topic, t]) => ({ topic, acc: accOf(t), n: t.c + t.w })).filter((t) => t.acc !== null);
    topicList.sort((a, b) => b.acc - a.acc);
    const strengths = topicList.filter((t) => t.acc >= 70).slice(0, 2).map((t) => t.topic);
    const weak = topicList.slice().reverse().filter((t) => t.acc < 60 && !strengths.includes(t.topic)).slice(0, 2).map((t) => t.topic);
    const timeSec = mine.length ? mean(mine.map((r) => r.timeSec)) : 0;
    const exp = mine.length ? mean(mine.map((r) => expectedByTest[r.testId])) : 0;
    const finished = new Set(mine.map((r) => r.testId)).size;
    const lateCount = att.filter((a) => a.finished && a.late).length;
    const status = !att.length ? "Not started" : lateCount > 0 ? "Late" : finished >= tests.length && mine.length ? "Completed" : "In progress";
    const rk = ranks[st.key] || [];
    const prevPct = pcts.filter((v) => v !== null).slice(-2, -1)[0];
    const lastPct = pcts.filter((v) => v !== null).slice(-1)[0];
    const objTotal = tl.c + tl.w + tl.s;
    return {
      ...st,
      rows: mine,
      attempts: att,
      attemptCount: att.length,
      pcts,
      avgPct: mine.length ? round1(mean(mine.map((r) => r.pct))) : null,
      marks: round1(mine.reduce((n, r) => n + r.marks, 0)),
      maxMarks: mine.reduce((n, r) => n + r.maxMarks, 0),
      accuracy: accOf(tl),
      timeSec: Math.round(timeSec),
      timeRatio: exp ? timeSec / exp : null,
      guessRate: tl.c + tl.w ? round1(pctOf(mine.reduce((n, r) => n + r.guessed, 0), tl.c + tl.w)) : 0,
      skipRate: objTotal ? round1(pctOf(tl.s, objTotal)) : 0,
      negLoss: round1(mine.reduce((n, r) => n + r.negativeLoss, 0)),
      lateCount,
      fastCount: att.filter((a) => a.finished && a.fast).length,
      finished,
      status,
      sectionPct,
      strengths,
      weak,
      lastPct: lastPct ?? null,
      delta: lastPct !== undefined && prevPct !== undefined ? round1(lastPct - prevPct) : null,
      firstToLast: pcts.filter((v) => v !== null).length > 1 ? round1(lastPct - pcts.filter((v) => v !== null)[0]) : null,
      rankMove: rk.length > 1 ? rk[rk.length - 2].rank - rk[rk.length - 1].rank : null,
      lastRank: rk.length ? rk[rk.length - 1].rank : null,
      rankHistory: rk,
    };
  });
  // overall rank / percentile among students with scores
  const scored = list.filter((s) => s.avgPct !== null).sort((a, b) => b.avgPct - a.avgPct || (b.accuracy || 0) - (a.accuracy || 0));
  scored.forEach((s, i) => {
    const prev = scored[i - 1];
    s.rank = prev && prev.avgPct === s.avgPct && (prev.accuracy || 0) === (s.accuracy || 0) ? prev.rank : i + 1;
    const below = scored.filter((o) => o.avgPct < s.avgPct).length;
    const equal = scored.filter((o) => o.avgPct === s.avgPct).length;
    s.percentile = Math.round(((below + equal / 2) / scored.length) * 100);
  });
  list.forEach((s) => { if (s.avgPct === null) { s.rank = null; s.percentile = null; } });
  // badges
  const top = Math.max(1, Math.ceil(scored.length * 0.1));
  scored.forEach((s, i) => { s.badges = []; if (i < top && scored.length >= 5) s.badges.push("Top 10%"); });
  const improved = scored.filter((s) => s.firstToLast !== null && s.firstToLast >= 5).sort((a, b) => b.firstToLast - a.firstToLast)[0];
  if (improved) improved.badges.push("Most improved");
  const fastest = scored.filter((s) => s.timeRatio && (s.accuracy || 0) >= 50 && s.avgPct >= (perf.config.passPct || 40)).sort((a, b) => a.timeRatio - b.timeRatio)[0];
  if (fastest) fastest.badges.push("Fastest");
  scored.forEach((s) => { if (Object.values(s.sectionPct).some((v) => v >= 99.9) && s.rows.length) s.badges.push("Perfect section"); });
  list.forEach((s) => { s.badges = s.badges || []; });
  return list;
}

// ---- questions -------------------------------------------------------------
function questionStats(S) {
  const { perf, tests, rows } = S;
  const out = [];
  tests.forEach((t) => {
    const trows = rows.filter((r) => r.testId === t.id).sort((a, b) => b.pct - a.pct);
    const n = trows.length;
    const g = Math.max(2, Math.round(n * 0.27));
    const topSet = new Set(trows.slice(0, g).map((r) => r.id));
    const botSet = new Set(trows.slice(-g).map((r) => r.id));
    perf.questions.filter((q) => q.testId === t.id).forEach((q, qi) => {
      const resp = trows.map((r) => ({ r, a: r.answers.find((x) => x.qid === q.id) })).filter((x) => x.a);
      const frac = ({ r, a }) => (q.subjective ? (q.points ? a.marks / q.points : 0) : a.status === "correct" ? 1 : 0);
      const correctPct = resp.length ? round1(mean(resp.map(frac)) * 100) : null;
      const topResp = resp.filter(({ r }) => topSet.has(r.id));
      const botResp = resp.filter(({ r }) => botSet.has(r.id));
      const disc = n >= 6 && topResp.length && botResp.length ? Math.round((mean(topResp.map(frac)) - mean(botResp.map(frac))) * 100) / 100 : null;
      const dist = q.choices.map((c) => ({ ...c, count: resp.filter(({ a }) => a.choice === c.key).length, top: topResp.filter(({ a }) => a.choice === c.key).length }));
      const skipped = resp.filter(({ a }) => a.status === "skipped").length;
      const wrongOpts = dist.filter((d) => !d.correct).sort((a, b) => b.count - a.count);
      const topWrong = wrongOpts[0] && wrongOpts[0].count > 0 ? wrongOpts[0] : null;
      const keyedTop = q.choices.length ? pctOf(topResp.filter(({ a }) => a.status === "correct").length, topResp.length) : null;
      const topWrongShare = q.choices.length && topResp.length ? pctOf(Math.max(0, ...dist.filter((d) => !d.correct).map((d) => d.top)), topResp.length) : 0;
      const flags = [];
      if (correctPct !== null && correctPct < 10 && resp.length >= 5) flags.push("Under 10% correct");
      if (!q.subjective && keyedTop !== null && topResp.length >= 3 && keyedTop < 40 && topWrongShare >= 40 && resp.length >= 8) flags.push("Key may be wrong");
      out.push({
        id: q.id, number: qi + 1, label: `${t.title} · Q${qi + 1}`, testId: t.id, testTitle: t.title, text: q.text, topic: q.topic, difficulty: q.difficulty, type: q.type, subjective: q.subjective, points: q.points,
        responses: resp.length, correctPct, avgTimeSec: resp.length ? Math.round(mean(resp.map(({ a }) => a.timeSec))) : null, disc, dist, skipped,
        skipPct: resp.length ? round1(pctOf(skipped, resp.length)) : 0, topWrong: topWrong ? { label: topWrong.label, pct: round1(pctOf(topWrong.count, resp.length)) } : null,
        auto: correctPct === null ? "No data" : correctPct >= 85 ? "Too easy" : correctPct < 30 ? "Too hard" : "Balanced", flags,
      });
    });
  });
  return out;
}

// ---- engagement --------------------------------------------------------------
function engagement(S, students) {
  const { perf, tests, attemptsAll } = S;
  const dates = attemptsAll.map((a) => a.date).sort();
  let daily = [];
  if (dates.length) {
    const span = daysBetween(dates[0], dates[dates.length - 1]) + 1;
    const step = span > 35 ? 7 : 1;
    for (let d = 0; d < span; d += step) {
      const from = addDays(dates[0], d);
      const to = addDays(dates[0], Math.min(span - 1, d + step - 1));
      daily.push({ label: from.slice(5), from, to, count: attemptsAll.filter((a) => a.date >= from && a.date <= to).length, title: step === 1 ? from : `${from} to ${to}` });
    }
  }
  const funnel = tests.map((t) => {
    const recs = attemptsAll.filter((a) => a.testId === t.id);
    return { id: t.id, title: t.title, enrolled: S.students.length, started: new Set(recs.map((a) => a.studentKey)).size, finished: new Set(recs.filter((a) => a.finished).map((a) => a.studentKey)).size };
  });
  const nameOf = Object.fromEntries(S.students.map((s) => [s.key, s.name]));
  const testOf = Object.fromEntries(perf.tests.map((t) => [t.id, t.title]));
  const finishedAtt = attemptsAll.filter((a) => a.finished);
  const mk = (a) => ({ id: a.id, student: nameOf[a.studentKey], key: a.studentKey, test: testOf[a.testId], date: a.date, timeMin: round1(a.timeSec / 60), pct: a.pct });
  return {
    daily, funnel,
    avgCompleteMin: finishedAtt.length ? round1(mean(finishedAtt.map((a) => a.timeSec)) / 60) : 0,
    late: finishedAtt.filter((a) => a.late).map(mk),
    fast: finishedAtt.filter((a) => a.fast).map((a) => ({ ...mk(a), expectedMin: round1(a.expectedSec / 60) })),
    retakes: attemptsAll.filter((a) => a.finished && a.no > 1).length,
    students,
  };
}

// ---- the report --------------------------------------------------------------
export function computeReport(perf, filters, ctx) {
  const S = scopePerformance(perf, filters, ctx);
  const { tests, rows } = S;
  const students = summarizeStudents(S);
  const scored = students.filter((s) => s.avgPct !== null);
  const qs = qMap(perf);
  const pass = perf.config.passPct;
  const perTest = tests.map((t) => {
    const r = rows.filter((x) => x.testId === t.id);
    const pcts = r.map((x) => x.pct);
    const sorted = pcts.slice().sort((a, b) => b - a);
    const k = Math.max(1, Math.ceil(sorted.length * 0.1));
    const tl = tally(r, qs);
    return {
      id: t.id, title: t.title, n: r.length,
      avg: round1(mean(pcts)), median: round1(median(pcts)), high: sorted[0] ?? 0,
      top10: round1(mean(sorted.slice(0, k))), bottom10: round1(mean(sorted.slice(-k))),
      pass: round1(pctOf(pcts.filter((v) => v >= pass).length, pcts.length)),
      completion: round1(pctOf(r.length, S.students.length)),
      timeMin: r.length ? round1(mean(r.map((x) => x.timeSec)) / 60) : 0,
      accuracy: accOf(tl) ?? 0,
    };
  });
  const allTally = tally(rows, qs);
  const finishedAll = scored.filter((s) => s.finished >= tests.length).length;
  const kpi = {
    enrolled: S.students.length,
    attempted: scored.length,
    completion: round1(pctOf(finishedAll, S.students.length)),
    avg: round1(mean(scored.map((s) => s.avgPct))),
    median: round1(median(scored.map((s) => s.avgPct))),
    high: scored.length ? Math.max(...scored.map((s) => s.avgPct)) : 0,
    pass: round1(pctOf(scored.filter((s) => s.avgPct >= pass).length, scored.length)),
    timeMin: rows.length ? round1(mean(rows.map((r) => r.timeSec)) / 60) : 0,
    accuracy: accOf(allTally) ?? 0,
  };
  const spark = {
    enrolled: perTest.map((t) => t.n),
    attempted: perTest.map((t) => t.n),
    completion: perTest.map((t) => t.completion),
    avg: perTest.map((t) => t.avg),
    median: perTest.map((t) => t.median),
    high: perTest.map((t) => t.high),
    pass: perTest.map((t) => t.pass),
    timeMin: perTest.map((t) => t.timeMin),
    accuracy: perTest.map((t) => t.accuracy),
  };
  // histogram + percentile view
  const bins = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, to: i === 9 ? 100 : i * 10 + 9.99, count: 0, label: `${i * 10}-${i === 9 ? 100 : i * 10 + 9}` }));
  scored.forEach((s) => { bins[Math.min(9, Math.floor(s.avgPct / 10))].count += 1; });
  const sortedAvg = scored.map((s) => s.avgPct).sort((a, b) => a - b);
  const percentileCurve = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((p) => ({ p, score: round1(percentileOf(sortedAvg, p)) }));
  // sections & topics
  const secRows = perf.sections.map((sec) => {
    const r = rows.filter((x) => x.sectionId === sec.id);
    const m = r.reduce((n, x) => n + Math.max(0, x.marks), 0);
    const x = r.reduce((n, y) => n + y.maxMarks, 0);
    const tl = tally(r, qs);
    return { id: sec.id, title: sec.title, n: r.length, avg: round1(pctOf(m, x)), accuracy: accOf(tl), tests: tests.filter((t) => t.sectionId === sec.id).length };
  }).filter((s) => s.tests > 0);
  const topicNames = Array.from(new Set(perf.questions.filter((q) => S.testIds.has(q.testId)).map((q) => q.topic)));
  const byTopicTest = groupTally(rows, qs, (q, r) => `${q.topic}||${r.testId}`);
  const byTopicDiff = groupTally(rows, qs, (q) => `${q.topic}||${q.difficulty}`);
  const byTopic = groupTally(rows, qs, (q) => q.topic);
  const useTests = tests.length > 1;
  const columns = useTests ? tests.map((t) => ({ id: t.id, label: t.title })) : DIFFICULTIES.map((d) => ({ id: d, label: d }));
  const topicRows = topicNames.map((topic) => {
    const t = byTopic[topic] || { c: 0, w: 0, s: 0 };
    return { topic, acc: accOf(t), n: t.c + t.w, cells: columns.map((c) => { const x = (useTests ? byTopicTest : byTopicDiff)[`${topic}||${c.id}`]; return x ? { acc: accOf(x), n: x.c + x.w } : { acc: null, n: 0 }; }) };
  }).sort((a, b) => (a.acc ?? 101) - (b.acc ?? 101));
  const ranked = topicRows.filter((t) => t.acc !== null);
  const diffAcc = Object.fromEntries(DIFFICULTIES.map((d) => [d, accOf(groupTally(rows, qs, (q) => q.difficulty)[d] || { c: 0, w: 0, s: 0 })]));
  const questions = questionStats(S);
  const base = {
    scope: S, students, scored, kpi, spark, perTest, bins, percentileCurve, passPct: pass,
    sections: secRows,
    topics: { columns, rows: topicRows, weakest: ranked.slice(0, 5), strongest: ranked.slice().reverse().slice(0, 5) },
    diffAcc, questions,
    engagement: engagement(S, students),
    negative: {
      enabled: perf.config.negative.enabled, scheme: perf.config.negative.scheme,
      lostMarks: round1(rows.reduce((n, r) => n + r.negativeLoss, 0)),
      avgLostPerAttempt: rows.length ? round1(mean(rows.map((r) => r.negativeLoss))) : 0,
      share: round1(pctOf(rows.reduce((n, r) => n + r.negativeLoss, 0), rows.reduce((n, r) => n + r.maxMarks, 0))),
    },
    guessRate: allTally.c + allTally.w ? round1(pctOf(rows.reduce((n, r) => n + r.guessed, 0), allTally.c + allTally.w)) : 0,
    skipRate: allTally.c + allTally.w + allTally.s ? round1(pctOf(allTally.s, allTally.c + allTally.w + allTally.s)) : 0,
    empty: rows.length === 0,
  };
  return base;
}
