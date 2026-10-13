// Deterministic mock-attempt generator for the per-series Performance tab
// (Part 7). There is no backend, so every attempt is simulated from the
// series' real structure (sections -> tests -> questions with topic, difficulty
// and points) using a seeded PRNG keyed on the series id: the same series
// always yields the same students, scores, times and ranks.
//
//   generateSeriesPerformance(series) -> perf | null
//     null when the series has no attempts to show (draft, no enrolments, no questions).
//   selectAttempts(attempts, mode)    -> one finished attempt per student+test ("first" | "best" | "latest")
//   ranksByTest(rows, tests)          -> { [studentKey]: [{ testId, rank, of, pct }] }
//
// perf = { seriesId, tests, sections, questions, students, attempts, config,
//          trackedCount, enrolledTotal, startDate, today }
import { allTests, isLive, isSubjective, stripHtml } from "./testSeriesData";
import { MOCK_TODAY_ISO } from "./testSeriesDeadlines";

// 13 names that exist in the real course roster (Student Management) so
// "Add to group announcement" resolves them, plus 14 learners from the seeded
// grading queue / extras (not on a course roster; Messaging simply skips them).
export const ROSTER_NAMES = [
  "Priya Sharma", "Daniel Osei", "Mei Lin", "Carlos Ibarra", "Fatima Noor",
  "Jonas Weber", "Aisha Bello", "Ravi Kapoor", "Sofia Rossi", "Liam Carter",
  "Noor Haddad", "Yuki Tanaka", "Elena Petrova",
];
const EXTRA_NAMES = [
  "Aarav Sharma", "Ishita Verma", "Karthik Raman", "Diya Patel", "Rahul Nair", "Meher Singh",
  "Zoya Khan", "Kabir Joshi", "Ananya Iyer", "Vihaan Gupta", "Saanvi Reddy", "Arjun Menon",
  "Tariq Malik", "Grace Kim",
];
const toStudent = (name) => ({ key: name.trim().toLowerCase(), name });
export const STUDENT_POOL = [...ROSTER_NAMES, ...EXTRA_NAMES].map(toStudent);
export const BATCHES = ["Morning batch", "Evening batch", "Weekend batch"];

// ---- seeded PRNG ------------------------------------------------------
export function hashStr(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const round1 = (v) => Math.round(v * 10) / 10;
function gauss(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}
function pick(rng, arr) {
  return arr[Math.floor(rng() * arr.length) % arr.length];
}
function shuffled(rng, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
export function addDays(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function daysBetween(a, b) {
  return Math.round((new Date(`${b}T12:00:00Z`) - new Date(`${a}T12:00:00Z`)) / 86400000);
}
const minIso = (a, b) => (a < b ? a : b);

// ---- grader feedback ----------------------------------------------------
const FEEDBACK = {
  high: ["Complete and clearly reasoned. Assumptions are stated and the conclusion follows.", "Excellent answer: precise, well structured and fully supported.", "Strong response. Only a minor gap in presentation."],
  mid: ["Good core idea, but a step in the working is missing. Show the intermediate reasoning.", "Mostly correct. Tighten the explanation and state your assumptions explicitly.", "Right direction, though the example does not fully support the claim."],
  low: ["The main idea is incomplete. Revisit the definition and try a worked example.", "Several key points are missing. Please review the model answer and resubmit your notes.", "Answer is too brief to earn credit for the reasoning steps."],
};

const LETTERS = "ABCDEFGH";
const BASE_SEC = { mcq_single: 70, mcq_multi: 95, true_false: 30, numerical: 130, fill_blank: 45, short_answer: 260, long_answer: 600 };
const DIFF_ADJ = { Beginner: 0.2, Intermediate: 0.02, Advanced: -0.2 };
export const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

// ---- structure -> flat meta ------------------------------------------
function buildChoices(q, rng) {
  if (Array.isArray(q.options) && q.options.length) {
    return q.options.map((o, i) => ({ key: String(i), label: `${LETTERS[i]}. ${stripHtml(o.text) || `Option ${LETTERS[i]}`}`, correct: Boolean(o.correct) }));
  }
  if (q.type === "numerical") {
    const n = Number(q.correctAnswer);
    const ok = Number.isFinite(n);
    const f = (v) => String(Math.round(v * 100) / 100);
    return [
      { key: "c", label: String(q.correctAnswer), correct: true },
      { key: "w1", label: ok ? f(n * 2) : "Doubled value", correct: false },
      { key: "w2", label: ok ? f(n / 2) : "Halved value", correct: false },
      { key: "w3", label: ok ? f(-n || n + 1) : "Sign error", correct: false },
    ];
  }
  if (q.type === "fill_blank") {
    return [
      { key: "c", label: String(q.correctAnswer || "(keyed answer)"), correct: true },
      { key: "w1", label: "Misspelled / near miss", correct: false },
      { key: "w2", label: "A different term", correct: false },
    ];
  }
  void rng;
  return [];
}

function buildStructure(series, rng) {
  const sections = [];
  const tests = [];
  const questions = [];
  (series.sections || []).forEach((s) => {
    const secTests = (s.tests || []).filter((t) => (t.questions || []).length > 0);
    if (!secTests.length) return;
    sections.push({ id: s.id, title: s.title || "Section" });
    secTests.forEach((t) => {
      const ti = tests.length;
      const qs = t.questions.map((q) => {
        const choices = buildChoices(q, rng);
        const correctKeys = choices.filter((c) => c.correct).map((c) => c.key);
        const wrongKeys = choices.filter((c) => !c.correct).map((c) => c.key);
        const subj = isSubjective(q.type);
        const rubric = subj ? ((q.rubric || []).length ? q.rubric.map((r) => ({ id: r.id, label: r.label, max: Number(r.points) || 0 })) : [{ id: `${q.id}-ov`, label: "Overall quality", max: Number(q.points) || 1 }]) : [];
        return {
          id: q.id,
          testId: t.id,
          testIndex: ti,
          sectionId: s.id,
          type: q.type,
          text: stripHtml(q.text) || "Question",
          topic: (q.topic || "").trim() || "General",
          difficulty: DIFFICULTIES.includes(q.difficulty) ? q.difficulty : "Intermediate",
          points: Number(q.points) || 1,
          subjective: subj,
          rubric,
          choices,
          correctKeys,
          attractor: wrongKeys.length ? pick(rng, wrongKeys) : null,
          expectedSec: BASE_SEC[q.type] || 60,
          trick: round1(gauss(rng) * 0.1),
          trap: false,
        };
      });
      tests.push({
        id: t.id,
        title: t.title || `Test ${ti + 1}`,
        type: t.type,
        index: ti,
        sectionId: s.id,
        sectionTitle: s.title || "Section",
        duration: Number(t.duration) || 30,
        questionIds: qs.map((q) => q.id),
        maxMarks: qs.reduce((n, q) => n + q.points, 0),
      });
      questions.push(...qs);
    });
  });
  // One objective question per series is mis-keyed in the mock data: strong
  // students pick the same wrong option, so the flag logic has something real to find.
  const trapCandidates = questions.filter((q) => !q.subjective && q.type === "mcq_single" && q.attractor);
  if (trapCandidates.length >= 4) pick(rng, trapCandidates).trap = true;
  return { sections, tests, questions };
}

function penaltyOf(series) {
  const neg = series.negativeMarking || {};
  if (!neg.enabled) return { enabled: false, perWrong: 0, scheme: "" };
  const m = String(neg.scheme || "").match(/(\d+(?:\.\d+)?)/);
  return { enabled: true, perWrong: m ? Number(m[1]) : 0.25, scheme: neg.scheme || "" };
}

function topicBias(rng, topics) {
  const out = {};
  topics.forEach((t) => { out[t] = clamp(gauss(rng) * 0.14, -0.3, 0.3); });
  return out;
}

// ---- one attempt ----------------------------------------------------------
function simulateAttempt({ rng, student, test, qs, cfg, no, theta, traits, bias, date, hour, late }) {
  const answers = [];
  const subjective = [];
  let marks = 0, negativeLoss = 0, correct = 0, wrong = 0, skipped = 0, guessed = 0, totalSec = 0;
  qs.forEach((q) => {
    const adj = traits.learn * (no - 1);
    if (q.subjective) {
      const frac = clamp(theta + DIFF_ADJ[q.difficulty] * 0.5 + bias[q.topic] * 0.6 + adj + gauss(rng) * 0.12, 0.05, 1);
      const scores = q.rubric.map((r) => ({ id: r.id, label: r.label, max: r.max, score: clamp(Math.round(r.max * clamp(frac + gauss(rng) * 0.1, 0, 1) * 2) / 2, 0, r.max) }));
      const got = scores.reduce((n, r) => n + r.score, 0);
      const band = got / q.points >= 0.75 ? "high" : got / q.points >= 0.45 ? "mid" : "low";
      const sec = Math.round(q.expectedSec * traits.speed * clamp(0.7 + rng() * 0.6, 0.4, 1.5));
      totalSec += sec;
      marks += got;
      subjective.push({ qid: q.id, rubric: scores, score: got, max: q.points, feedback: pick(rng, FEEDBACK[band]), gradedBy: "Ansh Mehra", timeSec: sec });
      answers.push({ qid: q.id, status: "graded", choice: null, timeSec: sec, marks: got, guess: false });
      return;
    }
    const nChoices = Math.max(2, q.choices.length);
    const isGuess = rng() < traits.guess;
    let p = clamp(theta + DIFF_ADJ[q.difficulty] + bias[q.topic] + q.trick + adj + gauss(rng) * 0.05, 0.03, 0.97);
    if (q.trap) p = clamp(0.68 - theta * 1.05, 0.03, 0.55);
    if (isGuess) p = 1 / nChoices;
    const skipP = clamp(traits.skip * (1 - p) * 1.6, 0, 0.6);
    if (rng() < skipP) {
      const sec = Math.round(q.expectedSec * 0.15 * traits.speed * (0.5 + rng()));
      skipped += 1;
      totalSec += sec;
      answers.push({ qid: q.id, status: "skipped", choice: null, timeSec: sec, marks: 0, guess: false });
      return;
    }
    const ok = rng() < p;
    let sec = Math.round(q.expectedSec * traits.speed * clamp(0.75 + rng() * 0.6 + (ok ? 0 : 0.15), 0.3, 2));
    if (isGuess) sec = Math.max(4, Math.round(sec * 0.25));
    totalSec += sec;
    let choice;
    if (ok) choice = pick(rng, q.correctKeys.length ? q.correctKeys : ["c"]);
    else {
      const wrongKeys = q.choices.filter((c) => !c.correct).map((c) => c.key);
      choice = q.trap && q.attractor ? q.attractor : q.attractor && rng() < 0.45 ? q.attractor : pick(rng, wrongKeys.length ? wrongKeys : ["w1"]);
    }
    const m = ok ? q.points : -(cfg.negative.enabled ? cfg.negative.perWrong : 0);
    if (ok) correct += 1; else { wrong += 1; if (m < 0) negativeLoss += -m; }
    const guess = isGuess;
    if (guess) guessed += 1;
    marks += m;
    answers.push({ qid: q.id, status: ok ? "correct" : "wrong", choice, timeSec: sec, marks: m, guess });
  });
  const maxMarks = test.maxMarks;
  const expectedSec = qs.reduce((n, q) => n + q.expectedSec, 0);
  const duration = test.duration * 60;
  // Scale to the time limit so no attempt exceeds the clock.
  const scale = totalSec > duration * 0.98 ? (duration * 0.96) / totalSec : 1;
  const secScaled = Math.round(totalSec * scale);
  answers.forEach((a) => { a.timeSec = Math.max(2, Math.round(a.timeSec * scale)); });
  const pct = maxMarks ? Math.max(0, marks) / maxMarks * 100 : 0;
  const attempted = correct + wrong;
  const sectionScores = { [test.sectionId]: { marks: Math.max(0, round1(marks)), max: maxMarks } };
  return {
    id: `${student.key}|${test.id}|${no}`,
    studentKey: student.key,
    testId: test.id,
    sectionId: test.sectionId,
    no,
    date,
    hour,
    finished: true,
    marks: round1(marks),
    maxMarks,
    pct: round1(pct),
    correct, wrong, skipped, guessed,
    attempted,
    accuracy: attempted ? round1((correct / attempted) * 100) : 0,
    negativeLoss: round1(negativeLoss),
    timeSec: secScaled,
    durationSec: duration,
    late,
    expectedSec,
    fast: secScaled < expectedSec * 0.3,
    answers,
    subjective,
    sectionScores,
  };
}

// ---- main generator -----------------------------------------------------
const generated = new Map();

export function seriesHasAttempts(series) {
  if (!series || !(series.enrollments > 0) || !(series.attempts > 0)) return false;
  if (!(isLive(series) || series.status === "archived")) return false;
  return allTests(series).some((t) => (t.questions || []).length > 0);
}

export function generateSeriesPerformance(series) {
  if (!seriesHasAttempts(series)) return null;
  const sig = `${series.id}|${series.enrollments}|${series.attempts}|${allTests(series).map((t) => `${t.id}:${t.questions.length}`).join(",")}`;
  if (generated.has(sig)) return generated.get(sig);
  const perf = build(series);
  generated.set(sig, perf);
  return perf;
}

function build(series) {
  const seedBase = hashStr(`ul-perf:${series.id}`);
  const rng = mulberry32(seedBase);
  const { sections, tests, questions } = buildStructure(series, rng);
  if (!tests.length) return null;
  const today = MOCK_TODAY_ISO;
  const created = series.publishedAt || series.createdAt || addDays(today, -60);
  const startDate = created > addDays(today, -75) ? created : addDays(today, -75);
  const span = Math.max(14, daysBetween(startDate, today));
  const winLen = Math.max(4, Math.floor(span / tests.length));
  const attemptCap = series.settings?.attemptsUnlimited ? 3 : clamp(Number(series.settings?.attemptLimit) || 3, 1, 3);
  const cfg = {
    passPct: Number(series.settings?.passingPct) || 40,
    negative: penaltyOf(series),
    attemptCap,
  };
  const topics = Array.from(new Set(questions.map((q) => q.topic)));
  const count = 24 + (seedBase % 4);
  // Every real roster student is tracked (so announcements resolve), topped up with extras.
  const cohort = shuffled(rng, [...ROSTER_NAMES, ...shuffled(rng, EXTRA_NAMES).slice(0, count - ROSTER_NAMES.length)].map(toStudent));
  const attempts = [];
  const students = cohort.map((s, idx) => {
    const r = mulberry32(hashStr(`${series.id}:${s.key}`));
    const theta = clamp(0.56 + gauss(r) * 0.17 - (ROSTER_NAMES.includes(s.name) ? 0.04 : 0), 0.18, 0.93);
    const rusher = r() < 0.07;
    const traits = {
      speed: rusher ? 0.22 : clamp(0.85 + gauss(r) * 0.22, 0.45, 1.5),
      guess: rusher ? 0.55 : clamp(0.02 + r() * 0.08, 0, 0.5),
      skip: clamp(0.04 + r() * 0.22, 0, 0.5),
      learn: 0.03 + r() * 0.04,
    };
    const bias = topicBias(r, topics);
    const roll = r();
    const n = tests.length;
    const drop = roll < 0.11 ? 0 : roll < 0.3 && n > 1 ? 1 + Math.floor(r() * (n - 1)) : n;
    const cap = Math.max(1, attemptCap);
    tests.forEach((test, ti) => {
      if (ti > drop) return;
      const wStart = addDays(startDate, ti * winLen);
      const wEnd = minIso(addDays(wStart, winLen - 1), today);
      if (ti === drop) {
        if (drop < n && r() < 0.5 && wStart <= today) {
          attempts.push({ id: `${s.key}|${test.id}|1`, studentKey: s.key, testId: test.id, sectionId: test.sectionId, no: 1, date: minIso(addDays(wStart, Math.floor(r() * winLen)), today), hour: 12, finished: false, pct: null, expectedSec: 0, marks: 0, maxMarks: test.maxMarks, answers: [], subjective: [], late: false, fast: false, timeSec: Math.round(test.duration * 60 * (0.1 + r() * 0.3)) });
        }
        return;
      }
      if (wStart > today || r() < 0.06) return;
      const qs = questions.filter((q) => q.testId === test.id);
      const retakes = 1 + (r() < 0.26 && cap > 1 ? 1 : 0) + (r() < 0.07 && cap > 2 ? 1 : 0);
      let last = null;
      for (let no = 1; no <= retakes; no += 1) {
        const late = no === 1 && r() < 0.035 && addDays(wEnd, 1) <= today;
        let date = late ? minIso(addDays(wEnd, 1 + Math.floor(r() * 3)), today) : minIso(addDays(wStart, Math.floor(r() * (wEnd >= wStart ? daysBetween(wStart, wEnd) + 1 : 1))), today);
        if (last) date = minIso(addDays(last, 2 + Math.floor(r() * 5)), today);
        const hour = r() < 0.55 ? 18 + Math.floor(r() * 5) : 7 + Math.floor(r() * 11);
        const att = simulateAttempt({ rng: r, student: s, test, qs, cfg, no, theta, traits, bias, date, hour, late });
        attempts.push(att);
        last = date;
      }
    });
    return { key: s.key, name: s.name, batch: BATCHES[hashStr(s.key) % BATCHES.length], theta: Math.round(theta * 100) / 100, index: idx };
  });
  return {
    seriesId: series.id,
    title: series.title,
    sections,
    tests,
    questions,
    students,
    attempts,
    config: cfg,
    trackedCount: students.length,
    enrolledTotal: series.enrollments,
    startDate,
    today,
  };
}

// ---- selection + ranks ------------------------------------------------------
export const ATTEMPT_MODES = ["First", "Best", "Latest"];

// One finished attempt per (student, test) per the chosen mode.
export function selectAttempts(attempts, mode = "Best") {
  const byKey = new Map();
  attempts.forEach((a) => {
    if (!a.finished) return;
    const k = `${a.studentKey}|${a.testId}`;
    const cur = byKey.get(k);
    if (!cur) { byKey.set(k, a); return; }
    if (mode === "First" ? a.no < cur.no : mode === "Latest" ? a.no > cur.no : a.pct > cur.pct) byKey.set(k, a);
  });
  return Array.from(byKey.values());
}

// Rank (1 = best, ties share a rank) of every student within each test.
export function ranksByTest(rows, tests) {
  const out = {};
  tests.forEach((t) => {
    const list = rows.filter((r) => r.testId === t.id).sort((a, b) => b.pct - a.pct);
    list.forEach((r, i) => {
      const rank = i > 0 && list[i - 1].pct === r.pct ? out[list[i - 1].studentKey].find((x) => x.testId === t.id).rank : i + 1;
      (out[r.studentKey] = out[r.studentKey] || []).push({ testId: t.id, rank, of: list.length, pct: r.pct });
    });
  });
  return out;
}
