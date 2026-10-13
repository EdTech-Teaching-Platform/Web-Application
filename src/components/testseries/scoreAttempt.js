// scoreAttempt — PURE scoring + answer helpers for the reusable test-taking
// components (TestRunner / TestResults). No React, no storage, no network:
// given a series, a test and the student's answers it returns a result
// object. Whoever hosts the runner decides whether to persist it.
//
// Answer shapes (keyed by question id):
//   mcq_single / true_false -> option id (string)
//   mcq_multi               -> array of option ids
//   numerical / fill_blank  -> string as typed
//   short_answer / long_answer -> string (free text)

import { isSubjective } from "../../portals/teacher/data/testSeriesData";

export const KNOWN_TYPES = ["mcq_single", "mcq_multi", "true_false", "numerical", "fill_blank", "short_answer", "long_answer"];

export function stripTags(html = "") {
  return String(html).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function wordCount(text = "") {
  const t = String(text).trim();
  return t ? t.split(/\s+/).length : 0;
}

export function isAnswered(q, answer) {
  if (answer === undefined || answer === null) return false;
  if (Array.isArray(answer)) return answer.length > 0;
  return String(answer).trim() !== "";
}

// Structural validation of a test before it is run. Throws on genuinely
// malformed data (so the host can show an error state); INCOMPLETE content
// (empty question text, blank options) is allowed -- drafts must preview.
export function validateTestForRun(test) {
  if (!test || typeof test !== "object") throw new Error("This test could not be loaded.");
  if (!Array.isArray(test.questions)) throw new Error("This test has malformed question data.");
  test.questions.forEach((q, i) => {
    if (!q || typeof q !== "object") throw new Error(`Question ${i + 1} is malformed.`);
    if (!KNOWN_TYPES.includes(q.type)) throw new Error(`Question ${i + 1} has an unknown type "${q.type}".`);
    if ((q.type === "mcq_single" || q.type === "mcq_multi" || q.type === "true_false") && !Array.isArray(q.options)) {
      throw new Error(`Question ${i + 1} is missing its options.`);
    }
  });
  return test;
}

// Negative marking. Reads series.negativeMarking = { enabled, scheme } where
// `scheme` is free text such as "-0.25 per wrong answer" or "-1 per wrong
// answer". Returns { enabled, mode, value, parsed } where, per WRONG
// objective answer (unattempted is never penalised):
//   mode "marks"   -> deduct `value` marks (the default: "-0.25" = 0.25 marks)
//   mode "percent" -> deduct value% of that question's points ("25%")
//   mode "fraction"-> deduct value (a/b) of that question's points ("1/4")
//                     unless the text says "mark(s)" not preceded by "of" ("1/4 mark" = 0.25
//                     marks; "1/4 of marks" = a quarter of the question's points)
// Also accepts a bare number in scheme. Unparseable text => parsed:false and
// no deduction (the UI can surface that).
export function parseNegativeMarking(nm) {
  if (!nm || !nm.enabled) return { enabled: false, mode: "marks", value: 0, parsed: true };
  const raw = typeof nm.scheme === "number" ? String(nm.scheme) : String(nm.scheme || "");
  const text = raw.replace(/[−–—]/g, "-").toLowerCase();
  const pct = text.match(/(\d+(?:\.\d+)?)\s*%/);
  if (pct) return { enabled: true, mode: "percent", value: Number(pct[1]) / 100, parsed: true };
  const frac = text.match(/(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)/);
  if (frac && Number(frac[2]) > 0) {
    const v = Number(frac[1]) / Number(frac[2]);
    return { enabled: true, mode: /(?<!of\s)marks?\b/.test(text) ? "marks" : "fraction", value: v, parsed: true };
  }
  const num = text.match(/-?\s*(\d+(?:\.\d+)?)/);
  if (num) return { enabled: true, mode: "marks", value: Math.abs(Number(num[1])), parsed: true };
  return { enabled: true, mode: "marks", value: 0, parsed: false };
}

export function penaltyFor(q, neg) {
  if (!neg.enabled) return 0;
  const pts = Number(q.points) || 0;
  return neg.mode === "marks" ? neg.value : neg.value * pts;
}

function acceptedFill(q) {
  const list = Array.isArray(q.acceptedAnswers) ? q.acceptedAnswers : [];
  return [...String(q.correctAnswer ?? "").split("|"), ...list].map((s) => String(s).trim().toLowerCase()).filter(Boolean);
}

// Is an (answered) objective response correct?
export function isCorrect(q, answer) {
  switch (q.type) {
    case "mcq_single":
    case "true_false": {
      const correct = (q.options || []).find((o) => o.correct);
      return Boolean(correct) && answer === correct.id;
    }
    case "mcq_multi": {
      const correctIds = (q.options || []).filter((o) => o.correct).map((o) => o.id).sort();
      const given = Array.isArray(answer) ? [...answer].sort() : [];
      return correctIds.length > 0 && correctIds.length === given.length && correctIds.every((id, i) => id === given[i]);
    }
    case "numerical": {
      const given = Number(String(answer).trim());
      const target = Number(q.correctAnswer);
      if (Number.isNaN(given) || Number.isNaN(target) || String(q.correctAnswer ?? "").trim() === "") return false;
      const tol = Math.max(0, Number(q.tolerance) || 0);
      return Math.abs(given - target) <= tol + 1e-9;
    }
    case "fill_blank":
      return acceptedFill(q).includes(String(answer).trim().toLowerCase());
    default:
      return false;
  }
}

const round2 = (n) => Math.round(n * 100) / 100;

// Main entry. `answers` = { [questionId]: answer }. Returns a plain result.
export function scoreAttempt({ series, test, answers = {}, timeTakenSec = 0 }) {
  validateTestForRun(test);
  const neg = parseNegativeMarking(series?.negativeMarking);
  const passingPct = Number(series?.settings?.passingPct) || 0;

  let earned = 0;
  let negativeMarks = 0;
  let objectiveMax = 0;
  let subjectiveMax = 0;
  const counts = { correct: 0, wrong: 0, unattempted: 0, pending: 0 };
  const topicMap = new Map();
  const difficulty = {};
  const perQuestion = [];

  test.questions.forEach((q, index) => {
    const points = Number(q.points) || 0;
    const answer = answers[q.id];
    const answered = isAnswered(q, answer);
    const topic = (q.topic || "").trim() || "Uncategorised";
    const diff = q.difficulty || "Unrated";
    const dRow = (difficulty[diff] = difficulty[diff] || { correct: 0, wrong: 0, unattempted: 0, pending: 0, total: 0 });
    dRow.total += 1;

    let status;
    let marks = 0;
    if (isSubjective(q.type)) {
      subjectiveMax += points;
      status = answered ? "pending" : "unattempted";
    } else {
      objectiveMax += points;
      if (!answered) status = "unattempted";
      else if (isCorrect(q, answer)) {
        status = "correct";
        marks = points;
        earned += points;
      } else {
        status = "wrong";
        marks = -penaltyFor(q, neg);
        negativeMarks += penaltyFor(q, neg);
      }
      const tRow = topicMap.get(topic) || { topic, correct: 0, wrong: 0, unattempted: 0, total: 0 };
      tRow.total += 1;
      tRow[status] += 1;
      topicMap.set(topic, tRow);
    }
    counts[status] += 1;
    dRow[status] += 1;
    perQuestion.push({ id: q.id, index, type: q.type, status, marks: round2(marks), maxMarks: points, answered, answer });
  });

  const score = round2(earned - negativeMarks);
  const gradedMax = objectiveMax;
  const percentage = gradedMax > 0 ? round2((Math.max(0, score) / gradedMax) * 100) : null;
  const topics = Array.from(topicMap.values())
    .map((t) => ({ ...t, accuracy: t.total ? Math.round((t.correct / t.total) * 100) : 0 }))
    .sort((a, b) => a.accuracy - b.accuracy || a.topic.localeCompare(b.topic));

  return {
    seriesId: series?.id,
    testId: test.id,
    score,
    earnedMarks: round2(earned),
    negativeMarks: round2(negativeMarks),
    objectiveMax,
    subjectiveMax,
    maxPoints: objectiveMax + subjectiveMax,
    percentage,
    passingPct,
    // Pass/fail covers the auto-graded part only; `provisional` is true while
    // subjective answers still await manual grading.
    passed: percentage === null ? null : percentage >= passingPct,
    provisional: counts.pending > 0,
    counts,
    totalQuestions: test.questions.length,
    topics,
    difficulty,
    timeTakenSec: Math.max(0, Math.round(timeTakenSec)),
    negativeScheme: neg,
    perQuestion,
    submittedAt: new Date().toISOString(),
  };
}

// ---- display helpers (plain text) ----------------------------------------
// An option may be image-only (diagram-based MCQ); fall back to its letter.
function optionLabel(q, o) {
  if (!o) return "";
  if (o.text) return o.text;
  const i = (q.options || []).indexOf(o);
  return o.image ? `Option ${String.fromCharCode(65 + Math.max(0, i))} (image)` : "";
}

export function describeAnswer(q, answer) {
  if (!isAnswered(q, answer)) return "";
  if (q.type === "mcq_single" || q.type === "true_false") return optionLabel(q, (q.options || []).find((o) => o.id === answer));
  if (q.type === "mcq_multi") {
    const ids = Array.isArray(answer) ? answer : [];
    return (q.options || []).filter((o) => ids.includes(o.id)).map((o) => optionLabel(q, o)).join(", ");
  }
  return String(answer);
}

export function describeCorrect(q) {
  if (q.type === "mcq_single" || q.type === "true_false" || q.type === "mcq_multi") {
    return (q.options || []).filter((o) => o.correct).map((o) => optionLabel(q, o)).join(", ");
  }
  if (q.type === "numerical") {
    const tol = Number(q.tolerance) || 0;
    return tol > 0 ? `${q.correctAnswer} (±${tol})` : String(q.correctAnswer ?? "");
  }
  if (q.type === "fill_blank") return acceptedFill({ ...q, correctAnswer: q.correctAnswer }).length ? String(q.correctAnswer).split("|").map((s) => s.trim()).filter(Boolean).join(" / ") : "";
  return "";
}

export function formatDuration(totalSec) {
  const s = Math.max(0, Math.floor(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(r)}` : `${pad(m)}:${pad(r)}`;
}
