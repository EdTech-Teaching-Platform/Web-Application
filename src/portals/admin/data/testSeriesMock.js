// Test Series — mock data + store for the Admin "Test Series" module.
// Strict 3-level hierarchy: Test Series -> Tests -> Questions.
// Single Admin role — every action below is available to any Admin
// (reuses the existing Settings & Permissions matrix's Test Series row,
// see data/permissionsMock.js MODULE.TEST_SERIES — no separate Super
// Admin behaviour in this module).
//
// Pub/sub store pattern (useSyncExternalStore), same shape as the rest
// of the admin mock data files (see permissionsMock.js).

import { useSyncExternalStore } from "react";

export const SERIES_STATUS = { DRAFT: "draft", PUBLISHED: "published" };
export const SERIES_STATUS_LABEL = {
  [SERIES_STATUS.DRAFT]: "Draft",
  [SERIES_STATUS.PUBLISHED]: "Published",
};
export const SERIES_STATUS_BADGE_CLASS = {
  [SERIES_STATUS.DRAFT]: "is-pending",
  [SERIES_STATUS.PUBLISHED]: "is-approved",
};

export const PRICING_TYPE = { FREE: "free", PAID: "paid" };
export const PRICING_TYPE_LABEL = {
  [PRICING_TYPE.FREE]: "Free",
  [PRICING_TYPE.PAID]: "Paid",
};

export const TEST_STATUS = { DRAFT: "draft", PUBLISHED: "published" };
export const TEST_STATUS_LABEL = {
  [TEST_STATUS.DRAFT]: "Draft",
  [TEST_STATUS.PUBLISHED]: "Published",
};
export const TEST_STATUS_BADGE_CLASS = {
  [TEST_STATUS.DRAFT]: "is-pending",
  [TEST_STATUS.PUBLISHED]: "is-approved",
};

export const QUESTION_TYPE = { OBJECTIVE: "objective", SUBJECTIVE: "subjective" };
export const QUESTION_TYPE_LABEL = {
  [QUESTION_TYPE.OBJECTIVE]: "Objective (MCQ)",
  [QUESTION_TYPE.SUBJECTIVE]: "Subjective",
};

export const DIFFICULTY = { EASY: "easy", MEDIUM: "medium", HARD: "hard" };
export const DIFFICULTY_LABEL = {
  [DIFFICULTY.EASY]: "Easy",
  [DIFFICULTY.MEDIUM]: "Medium",
  [DIFFICULTY.HARD]: "Hard",
};
export const DIFFICULTY_BADGE_CLASS = {
  [DIFFICULTY.EASY]: "is-approved",
  [DIFFICULTY.MEDIUM]: "is-pending",
  [DIFFICULTY.HARD]: "is-rejected",
};

export const SUBJECT_OPTIONS = [
  "Physics", "Chemistry", "Mathematics", "Biology",
  "Computer Science", "Reasoning & Aptitude", "General Knowledge", "English",
];

export const AUDIENCE_OPTIONS = [
  "JEE Aspirants", "NEET Aspirants", "Class 10", "Class 12",
  "Banking & SSC", "Undergraduate", "General",
];

let idCounter = 1000;
function nextId(prefix) {
  idCounter += 1;
  return `${prefix}-${idCounter}`;
}

function objectiveQuestion({ text, optionA, optionB, optionC, optionD, correctAnswer, marks, negativeMarks, difficulty, subject, explanation }) {
  return {
    id: nextId("Q"),
    type: QUESTION_TYPE.OBJECTIVE,
    text, optionA, optionB, optionC, optionD, correctAnswer,
    marks: marks ?? 4,
    negativeMarks: negativeMarks ?? 1,
    difficulty: difficulty || DIFFICULTY.MEDIUM,
    subject: subject || "",
    explanation: explanation || "",
  };
}

function subjectiveQuestion({ text, answerInstructions, marks, difficulty, subject, rubric }) {
  return {
    id: nextId("Q"),
    type: QUESTION_TYPE.SUBJECTIVE,
    text,
    answerInstructions: answerInstructions || "",
    marks: marks ?? 5,
    difficulty: difficulty || DIFFICULTY.MEDIUM,
    subject: subject || "",
    rubric: rubric || "",
  };
}

function buildTest({ name, instructions, duration, totalMarks, passingMarks, attemptLimit, scheduledAt, status, questions }) {
  return {
    id: nextId("TEST"),
    name,
    instructions: instructions || "",
    duration,
    totalMarks,
    passingMarks,
    attemptLimit,
    scheduledAt,
    status: status || TEST_STATUS.DRAFT,
    questions: questions || [],
  };
}

function buildSeries({ name, description, subject, audience, pricing, price, status, startDate, endDate, enrollment, attempts, avgPerformance, tests }) {
  return {
    id: nextId("TS"),
    name,
    description: description || "",
    subject,
    audience,
    pricing: pricing || PRICING_TYPE.FREE,
    price: pricing === PRICING_TYPE.PAID ? (price ?? 0) : 0,
    status: status || SERIES_STATUS.DRAFT,
    startDate,
    endDate,
    enrollment: enrollment ?? 0,
    attempts: attempts ?? 0,
    avgPerformance: avgPerformance ?? 0,
    tests: tests || [],
  };
}

const SEED_TEST_SERIES = [
  buildSeries({
    name: "JEE Main Physics Test Series 2026",
    description: "Full-length and topic-wise Physics tests aligned to the JEE Main 2026 syllabus.",
    subject: "Physics", audience: "JEE Aspirants",
    pricing: PRICING_TYPE.PAID, price: 999,
    status: SERIES_STATUS.PUBLISHED,
    startDate: "2026-09-01", endDate: "2026-12-15",
    enrollment: 3420, attempts: 8760, avgPerformance: 62,
    tests: [
      buildTest({
        name: "Physics Full Mock Test 1 — Mechanics & Waves",
        instructions: "60 minutes, 40 marks. Calculator not allowed.",
        duration: 60, totalMarks: 40, passingMarks: 16, attemptLimit: 2,
        scheduledAt: "2026-10-05T09:00", status: TEST_STATUS.PUBLISHED,
        questions: [
          objectiveQuestion({ text: "A body moving with uniform velocity has:", optionA: "Zero acceleration", optionB: "Uniform acceleration", optionC: "Increasing acceleration", optionD: "Decreasing acceleration", correctAnswer: "A", subject: "Mechanics" }),
          objectiveQuestion({ text: "The SI unit of frequency is:", optionA: "Second", optionB: "Hertz", optionC: "Newton", optionD: "Joule", correctAnswer: "B", subject: "Waves" }),
          subjectiveQuestion({ text: "Derive the expression for the time period of a simple pendulum.", answerInstructions: "Show all steps clearly, including the restoring force analysis.", marks: 8, subject: "Mechanics", rubric: "2 marks for setup, 4 marks for derivation, 2 marks for final expression." }),
        ],
      }),
    ],
  }),
  buildSeries({
    name: "Class 10 Mathematics Weekly Series",
    description: "Chapter-wise weekly tests covering the full CBSE Class 10 Mathematics syllabus.",
    subject: "Mathematics", audience: "Class 10",
    pricing: PRICING_TYPE.FREE,
    status: SERIES_STATUS.PUBLISHED,
    startDate: "2026-08-10", endDate: "2026-11-30",
    enrollment: 6210, attempts: 14980, avgPerformance: 71,
    tests: [
      buildTest({
        name: "Weekly Test 1 — Real Numbers & Polynomials",
        duration: 45, totalMarks: 30, passingMarks: 12, attemptLimit: 3,
        scheduledAt: "2026-08-17T10:00", status: TEST_STATUS.PUBLISHED,
        questions: [
          objectiveQuestion({ text: "HCF of 12 and 18 is:", optionA: "2", optionB: "6", optionC: "12", optionD: "18", correctAnswer: "B", marks: 3, negativeMarks: 0, subject: "Real Numbers" }),
          objectiveQuestion({ text: "The degree of the polynomial 3x^2 + 5x + 2 is:", optionA: "0", optionB: "1", optionC: "2", optionD: "3", correctAnswer: "C", marks: 3, negativeMarks: 0, subject: "Polynomials" }),
        ],
      }),
      buildTest({
        name: "Weekly Test 2 — Linear Equations",
        duration: 45, totalMarks: 30, passingMarks: 12, attemptLimit: 3,
        scheduledAt: "2026-08-24T10:00", status: TEST_STATUS.DRAFT,
        questions: [],
      }),
    ],
  }),
  buildSeries({
    name: "NEET Biology Crash Course Series",
    description: "High-yield Biology tests covering Botany and Zoology for NEET aspirants.",
    subject: "Biology", audience: "NEET Aspirants",
    pricing: PRICING_TYPE.PAID, price: 1499,
    status: SERIES_STATUS.DRAFT,
    startDate: "2026-11-01", endDate: "2027-01-15",
    enrollment: 0, attempts: 0, avgPerformance: 0,
    tests: [
      buildTest({
        name: "Diagnostic Test — Cell Biology",
        duration: 50, totalMarks: 50, passingMarks: 20, attemptLimit: 1,
        scheduledAt: "2026-11-10T09:00", status: TEST_STATUS.DRAFT,
        questions: [
          objectiveQuestion({ text: "The powerhouse of the cell is the:", optionA: "Nucleus", optionB: "Ribosome", optionC: "Mitochondria", optionD: "Golgi body", correctAnswer: "C", subject: "Cell Biology" }),
        ],
      }),
    ],
  }),
  buildSeries({
    name: "Banking & SSC Reasoning Practice Series",
    description: "Daily reasoning and aptitude practice sets for Banking and SSC exams.",
    subject: "Reasoning & Aptitude", audience: "Banking & SSC",
    pricing: PRICING_TYPE.FREE,
    status: SERIES_STATUS.PUBLISHED,
    startDate: "2026-07-01", endDate: "2026-12-31",
    enrollment: 9840, attempts: 22150, avgPerformance: 58,
    tests: [
      buildTest({
        name: "Practice Set 12 — Puzzles & Seating Arrangement",
        duration: 30, totalMarks: 25, passingMarks: 10, attemptLimit: 5,
        scheduledAt: "2026-09-20T08:00", status: TEST_STATUS.PUBLISHED,
        questions: [
          objectiveQuestion({ text: "In a row of 20 students, A is 7th from the left. What is A's position from the right?", optionA: "12th", optionB: "13th", optionC: "14th", optionD: "15th", correctAnswer: "C", marks: 2, negativeMarks: 0.5, subject: "Puzzles" }),
          subjectiveQuestion({ text: "Explain the approach you would use to solve a circular seating arrangement puzzle.", marks: 5, subject: "Puzzles", rubric: "Award marks for a clear, step-by-step strategy." }),
        ],
      }),
    ],
  }),
  buildSeries({
    name: "English Proficiency Test Series",
    description: "Grammar, vocabulary, and comprehension tests for competitive exam preparation.",
    subject: "English", audience: "General",
    pricing: PRICING_TYPE.PAID, price: 499,
    status: SERIES_STATUS.PUBLISHED,
    startDate: "2026-08-01", endDate: "2026-10-31",
    enrollment: 1875, attempts: 3640, avgPerformance: 66,
    tests: [
      buildTest({
        name: "Grammar & Vocabulary Test 1",
        duration: 40, totalMarks: 35, passingMarks: 14, attemptLimit: 2,
        scheduledAt: "2026-08-12T11:00", status: TEST_STATUS.PUBLISHED,
        questions: [
          objectiveQuestion({ text: "Choose the correctly spelled word.", optionA: "Recieve", optionB: "Receive", optionC: "Receeve", optionD: "Receve", correctAnswer: "B", marks: 1, negativeMarks: 0.25, subject: "Vocabulary" }),
        ],
      }),
    ],
  }),
];

let _seriesList = SEED_TEST_SERIES;
const _listeners = new Set();

function emit() {
  _listeners.forEach((fn) => fn());
}

function subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

function getSnapshot() {
  return _seriesList;
}

export function useTestSeriesList() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function useTestSeriesById(seriesId) {
  const list = useTestSeriesList();
  return list.find((s) => s.id === seriesId) || null;
}

export function useTestById(seriesId, testId) {
  const series = useTestSeriesById(seriesId);
  const test = series ? series.tests.find((t) => t.id === testId) || null : null;
  return { series, test };
}

export function computeOverviewStats(list) {
  const totalSeries = list.length;
  const totalEnrolled = list.reduce((sum, s) => sum + s.enrollment, 0);
  const totalAttempts = list.reduce((sum, s) => sum + s.attempts, 0);
  const withAttempts = list.filter((s) => s.attempts > 0);
  const avgPerformance = withAttempts.length
    ? Math.round(withAttempts.reduce((sum, s) => sum + s.avgPerformance, 0) / withAttempts.length)
    : 0;
  return { totalSeries, totalEnrolled, totalAttempts, avgPerformance };
}

// ---- Test Series CRUD ----

export function createTestSeries(data) {
  const series = buildSeries(data);
  _seriesList = [series, ..._seriesList];
  emit();
  return series;
}

export function updateTestSeries(id, data) {
  _seriesList = _seriesList.map((s) => (s.id === id ? { ...s, ...data, price: data.pricing === PRICING_TYPE.PAID ? (data.price ?? s.price) : 0 } : s));
  emit();
}

export function deleteTestSeries(id) {
  _seriesList = _seriesList.filter((s) => s.id !== id);
  emit();
}

export function duplicateTestSeries(id) {
  const source = _seriesList.find((s) => s.id === id);
  if (!source) return null;
  const clone = {
    ...source,
    id: nextId("TS"),
    name: `${source.name} (Copy)`,
    status: SERIES_STATUS.DRAFT,
    enrollment: 0,
    attempts: 0,
    avgPerformance: 0,
    tests: source.tests.map((t) => ({
      ...t,
      id: nextId("TEST"),
      status: TEST_STATUS.DRAFT,
      questions: t.questions.map((q) => ({ ...q, id: nextId("Q") })),
    })),
  };
  _seriesList = [clone, ..._seriesList];
  emit();
  return clone;
}

export function setSeriesStatus(id, status) {
  _seriesList = _seriesList.map((s) => (s.id === id ? { ...s, status } : s));
  emit();
}

export function validateSeriesForPublish(series) {
  const errors = [];
  if (!series.name || !series.name.trim()) errors.push("Test Series name is required.");
  if (!series.subject) errors.push("Subject / Category is required.");
  if (!series.audience) errors.push("Target audience is required.");
  if (!series.startDate || !series.endDate) errors.push("Start and end dates are required.");
  if (series.startDate && series.endDate && series.startDate > series.endDate) errors.push("Start date must be before end date.");
  if (series.pricing === PRICING_TYPE.PAID && (!series.price || Number(series.price) <= 0)) errors.push("A valid price is required for a paid Test Series.");
  return { valid: errors.length === 0, errors };
}

// ---- Test CRUD (within a series) ----

export function createTest(seriesId, data) {
  const test = buildTest(data);
  _seriesList = _seriesList.map((s) => (s.id === seriesId ? { ...s, tests: [...s.tests, test] } : s));
  emit();
  return test;
}

export function updateTest(seriesId, testId, data) {
  _seriesList = _seriesList.map((s) => (s.id !== seriesId ? s : { ...s, tests: s.tests.map((t) => (t.id === testId ? { ...t, ...data } : t)) }));
  emit();
}

export function deleteTest(seriesId, testId) {
  _seriesList = _seriesList.map((s) => (s.id !== seriesId ? s : { ...s, tests: s.tests.filter((t) => t.id !== testId) }));
  emit();
}

export function duplicateTest(seriesId, testId) {
  let clone = null;
  _seriesList = _seriesList.map((s) => {
    if (s.id !== seriesId) return s;
    const source = s.tests.find((t) => t.id === testId);
    if (!source) return s;
    clone = {
      ...source,
      id: nextId("TEST"),
      name: `${source.name} (Copy)`,
      status: TEST_STATUS.DRAFT,
      questions: source.questions.map((q) => ({ ...q, id: nextId("Q") })),
    };
    return { ...s, tests: [...s.tests, clone] };
  });
  emit();
  return clone;
}

export function setTestStatus(seriesId, testId, status) {
  _seriesList = _seriesList.map((s) => (s.id !== seriesId ? s : { ...s, tests: s.tests.map((t) => (t.id === testId ? { ...t, status } : t)) }));
  emit();
}

export function validateTestForPublish(test) {
  const errors = [];
  if (!test.name || !test.name.trim()) errors.push("Test name is required.");
  if (!test.duration || Number(test.duration) <= 0) errors.push("A valid duration (minutes) is required.");
  if (!test.totalMarks || Number(test.totalMarks) <= 0) errors.push("Total marks is required.");
  if (!test.passingMarks || Number(test.passingMarks) <= 0) errors.push("Passing marks is required.");
  if (test.passingMarks && test.totalMarks && Number(test.passingMarks) > Number(test.totalMarks)) errors.push("Passing marks cannot exceed total marks.");
  if (!test.scheduledAt) errors.push("A scheduled date/time is required.");
  if (!test.questions || test.questions.length === 0) errors.push("At least one question is required before publishing.");
  return { valid: errors.length === 0, errors };
}

// ---- Question CRUD (within a test) ----

export function createQuestion(seriesId, testId, type, data) {
  const question = type === QUESTION_TYPE.OBJECTIVE ? objectiveQuestion(data) : subjectiveQuestion(data);
  _seriesList = _seriesList.map((s) => (s.id !== seriesId ? s : {
    ...s,
    tests: s.tests.map((t) => (t.id !== testId ? t : { ...t, questions: [...t.questions, question] })),
  }));
  emit();
  return question;
}

export function updateQuestion(seriesId, testId, questionId, data) {
  _seriesList = _seriesList.map((s) => (s.id !== seriesId ? s : {
    ...s,
    tests: s.tests.map((t) => (t.id !== testId ? t : {
      ...t,
      questions: t.questions.map((q) => (q.id === questionId ? { ...q, ...data } : q)),
    })),
  }));
  emit();
}

export function deleteQuestion(seriesId, testId, questionId) {
  _seriesList = _seriesList.map((s) => (s.id !== seriesId ? s : {
    ...s,
    tests: s.tests.map((t) => (t.id !== testId ? t : { ...t, questions: t.questions.filter((q) => q.id !== questionId) })),
  }));
  emit();
}
