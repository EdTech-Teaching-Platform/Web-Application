// Leaderboard data for Test Performance Analytics.
//
// The app has no per-learner attempt store, so learner scores are DERIVED
// (deterministically, no randomness) from each published series' real
// aggregates: a learner's score in a series is centred on that series'
// weighted average score and spread by a stable hash of (learner, series).
// The UI labels this as demo data. Swap buildAttempts() for a real API call
// when per-learner attempts exist; ranking/percentile logic below is unchanged.

import { getStudentsSnapshot } from "./studentsMock";

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0) / 4294967295; // 0..1
}

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

// rows: flattened published tests that have attempts (see TestPerformanceAnalytics)
export function buildAttempts(rows) {
  const students = getStudentsSnapshot();
  const bySeries = new Map();
  for (const t of rows) {
    if (!t.attempts) continue;
    if (!bySeries.has(t.seriesId)) bySeries.set(t.seriesId, { seriesId: t.seriesId, seriesName: t.seriesName, attempts: 0, weighted: 0 });
    const s = bySeries.get(t.seriesId);
    s.attempts += t.attempts;
    s.weighted += (t.avgScore || 0) * t.attempts;
  }
  const out = [];
  for (const s of bySeries.values()) {
    const avg = s.attempts ? s.weighted / s.attempts : 0;
    for (const stu of students) {
      const h = hash(`${stu.id}|${s.seriesId}`);
      if (h < 0.18) continue; // not every learner attempts every series
      const score = clamp(avg + (hash(`${s.seriesId}|${stu.id}`) - 0.5) * 44, 8, 100);
      out.push({
        studentId: stu.id,
        name: stu.name,
        seriesId: s.seriesId,
        seriesName: s.seriesName,
        score: Math.round(score * 10) / 10,
        attempts: 1 + Math.floor(h * 4),
      });
    }
  }
  return out;
}

// Rank one list of {studentId,name,score,attempts}. Competition ranking (1,2,2,4).
// Percentile = share of ranked learners scoring strictly below.
export function rankEntries(entries) {
  const sorted = [...entries].sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
  const n = sorted.length;
  return sorted.map((e, i) => {
    const rank = i > 0 && sorted[i - 1].score === e.score ? null : i + 1;
    return { ...e, _rank: rank };
  }).map((e, i, arr) => {
    const rank = e._rank ?? arr[i - 1].rank;
    const below = arr.filter((x) => x.score < e.score).length;
    const { _rank, ...rest } = e;
    return { ...rest, rank, percentile: n > 1 ? Math.round((below / n) * 1000) / 10 : 100 };
  });
}

// seriesId === "all" aggregates each learner across series (attempt-weighted average).
export function buildLeaderboard(attempts, seriesId) {
  if (seriesId !== "all") return rankEntries(attempts.filter((a) => a.seriesId === seriesId));
  const map = new Map();
  for (const a of attempts) {
    if (!map.has(a.studentId)) map.set(a.studentId, { studentId: a.studentId, name: a.name, sum: 0, w: 0, attempts: 0 });
    const m = map.get(a.studentId);
    m.sum += a.score * a.attempts;
    m.w += a.attempts;
    m.attempts += a.attempts;
  }
  return rankEntries(
    Array.from(map.values()).map((m) => ({
      studentId: m.studentId,
      name: m.name,
      score: Math.round((m.sum / m.w) * 10) / 10,
      attempts: m.attempts,
    }))
  );
}
