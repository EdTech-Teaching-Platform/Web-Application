// Test Series — shared data layer for BOTH halves of the feature:
//   * Admin "Grant Test Series Creator access" screen (roster + grants)
//   * Teacher "Test Series" section (dashboard, 4-step builder, grading, revenue)
// There is no backend yet, so everything here is seed data + pure helpers;
// the live, mutable copy lives in src/context/TestSeriesContext.jsx.

import { formatMoney } from "../../../utils/formatMoney";
import { circuitStem, inclineStem, projectileStem, skaterStem, velocityGraphOptions, velocityTimeStem } from "./questionImages";
import { normalizeDeadlines, deadlineErrors, effectiveBuildDeadline, nowIso, MOCK_TODAY_ISO } from "./testSeriesDeadlines";

// ---------------------------------------------------------------------
// Taxonomy — IMPORTANT: these constants MUST stay aligned with the public
// Test Series browse/filter facets (class, subject, exam, test type,
// difficulty, language). The builder, the live preview and every filter
// read from here, so changing a facet here changes it everywhere. (The
// public browse page doesn't exist in this repo yet, so this file is the
// source of truth until it does.)
export const TS_GRADES = [
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12",
  "College / University", "Competitive Exams", "Other",
];
export const TS_SUBJECTS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English", "Computer Science", "Social Science", "Other",
];
export const TS_EXAMS = [
  "School Exams", "Board Exams", "Entrance Exams", "Competitive Exams", "University Exams", "Skill Tests",
];
export const TS_TEST_TYPES = ["Topic", "Chapter", "Subject", "Sectional", "Full-Length", "Mock Exam"];
export const TS_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
export const TS_LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Gujarati", "Kannada"];
export const TS_BADGES = [
  "Free", "Popular", "New", "Full Syllabus", "Certification Prep", "Best Value", "Recommended", "Practical",
];
export const TS_SECTION_SUGGESTIONS = ["Skill Tests", "Practice Tests", "Course Tests", "Mock Exams"];

// Lifecycle (Part 6): Assigned -> Drafting -> Ready for review -> Published
// (live) -> Final published (locked) | Archived. `draft` is the legacy key
// (pre-Part-6 data) and is still understood everywhere via normalizeSeries().
export const TS_LIFECYCLE = ["assigned", "drafting", "ready", "published", "final", "archived"];
export const TS_STATUSES = TS_LIFECYCLE;
// StatusBadge only supports success|warning|danger|neutral.
export const TS_STATUS_META = {
  assigned: { label: "Assigned", tone: "neutral" },
  drafting: { label: "Drafting", tone: "warning" },
  ready: { label: "Ready for review", tone: "warning" },
  published: { label: "Published", tone: "success" },
  final: { label: "Final published", tone: "success" },
  archived: { label: "Archived", tone: "neutral" },
};
TS_STATUS_META.draft = TS_STATUS_META.drafting; // legacy key
// ProgressSteps stepper stages. `stageIndex(status)` maps a status onto it.
export const TS_STAGES = ["Assigned", "Build", "Review", "Publish", "Final publish"];
export function stageIndex(status) {
  switch (status) {
    case "assigned": return 0;
    case "drafting":
    case "draft": return 1;
    case "ready": return 2;
    case "published": return 3;
    case "final": return 5; // every stage complete
    default: return -1; // archived: off the track
  }
}
export const isLive = (series) => series.status === "published" || series.status === "final";
// Final-published (and archived) series are read-only apart from metadata + deadline extensions.
export const isStructureLocked = (series) => series.status === "final" || series.status === "archived";
// Old three-bucket view (draft/published/archived) for screens that predate Part 6.
export function legacyBucket(status) {
  if (status === "published" || status === "final") return "published";
  if (status === "archived") return "archived";
  return "draft";
}

export const TS_ORIGINS = ["assigned", "own"];
export const TS_SCOPES = ["course", "standalone"];
export const TS_ORIGIN_LABEL = { assigned: "Assigned by admin", own: "My own" };
export const TS_SCOPE_LABEL = { course: "Course-wise", standalone: "Standalone" };
export const MIN_QUESTIONS = 5;

export const QUESTION_TYPES = [
  { key: "mcq_single", label: "Multiple Choice (single)", short: "MCQ", objective: true },
  { key: "mcq_multi", label: "Multiple Choice (multi)", short: "Multi", objective: true },
  { key: "true_false", label: "True / False", short: "T/F", objective: true },
  { key: "numerical", label: "Numerical", short: "Numeric", objective: true },
  { key: "fill_blank", label: "Fill in the blank", short: "Fill", objective: true },
  { key: "short_answer", label: "Short Answer", short: "Short", objective: false },
  { key: "long_answer", label: "Long Answer / Essay", short: "Essay", objective: false },
];
export function questionTypeMeta(key) {
  return QUESTION_TYPES.find((t) => t.key === key) || QUESTION_TYPES[0];
}
export function isSubjective(type) {
  return type === "short_answer" || type === "long_answer";
}

// ---------------------------------------------------------------------
// Small helpers
export function makeId(prefix = "id") {
  const rand = typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID().slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `${prefix}-${rand}`;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function stripHtml(html = "") {
  return String(html).replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export function initialsOf(name = "") {
  return name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() || "").join("");
}

// ---------------------------------------------------------------------
// Question / series factories + pure helpers
export function newQuestion(type = "mcq_single") {
  const base = { id: makeId("q"), type, text: "", points: 1, difficulty: "Beginner", topic: "", explanation: "" };
  if (type === "mcq_single" || type === "mcq_multi") {
    return { ...base, options: [{ id: makeId("o"), text: "", correct: true }, { id: makeId("o"), text: "", correct: false }] };
  }
  if (type === "true_false") {
    return { ...base, options: [{ id: makeId("o"), text: "True", correct: true }, { id: makeId("o"), text: "False", correct: false }] };
  }
  if (type === "numerical") return { ...base, correctAnswer: "", tolerance: 0 };
  if (type === "fill_blank") return { ...base, correctAnswer: "" };
  return { ...base, points: type === "long_answer" ? 10 : 5, modelAnswer: "", wordLimit: type === "long_answer" ? 300 : 80, rubric: [] };
}

export function newTest() {
  return { id: makeId("t"), title: "", type: "Topic", duration: 30, locked: true, questions: [] };
}

export function newSection(title = "") {
  return { id: makeId("s"), title, tests: [] };
}

// opts: { origin: "own" | "assigned", scope: "course" | "standalone", courseId, assignment, startMethod, init }
export function newSeries(teacherId, opts = {}) {
  const t = todayIso();
  const { origin = "own", scope = "standalone", courseId = null, assignment = null, startMethod = "scratch", init = {} } = opts;
  return normalizeSeries({
    id: makeId("ts"),
    teacherId,
    origin,
    scope,
    courseId: scope === "course" ? courseId : null,
    assignment,
    title: "",
    shortDescription: "",
    about: "",
    whoFor: "",
    grades: [],
    subjects: [],
    exams: [],
    difficulty: "Intermediate",
    languages: ["English"],
    badges: [],
    pricing: { model: "free", price: "" },
    negativeMarking: { enabled: false, scheme: "" },
    sections: [],
    settings: { passingPct: 40, attemptsUnlimited: true, attemptLimit: 3, access: "on_demand", startDate: "", certificate: false },
    status: origin === "assigned" ? "assigned" : "drafting",
    enrollments: 0,
    attempts: 0,
    stepReached: 0,
    startMethod,
    createdAt: t,
    updatedAt: t,
    lastSavedAt: nowIso(),
    draftPayload: { startCompleted: true, stepIndex: 0, activeTestId: null, activeQuestionId: null },
    ...init,
  });
}

// Fills every Part-6 field on a series (seeds, localStorage hydrate, new series).
export function normalizeSeries(raw) {
  const s = { ...raw };
  s.origin = s.origin || "own";
  s.scope = s.scope || "standalone";
  s.courseId = s.scope === "course" ? s.courseId ?? null : null;
  s.assignment = s.assignment || null;
  if (s.status === "draft") s.status = "drafting";
  s.audience = { visibility: "public", seatLimit: "", ...(s.audience || {}) };
  s.courseAccess = { enrolledDefault: true, ...(s.courseAccess || {}) };
  s.startMethod = "scratch"; // every series is built manually, question by question
  s.deadlines = normalizeDeadlines(s.deadlines, { origin: s.origin, requiredDeadline: s.assignment?.requiredDeadline });
  s.extensionRequest = s.extensionRequest || null;
  s.declined = s.declined || null;
  s.lastEditedStep = s.lastEditedStep ?? Math.min(s.stepReached ?? 0, 3);
  s.lastEditedPointer = s.lastEditedPointer || null;
  s.draftPayload = s.draftPayload || { startCompleted: true, stepIndex: s.lastEditedStep, activeTestId: null, activeQuestionId: null };
  if (s.lastSavedAt === undefined) s.lastSavedAt = s.updatedAt ? `${s.updatedAt}T10:00:00.000Z` : null;
  s.publishedAt = s.publishedAt || null;
  s.finalizedAt = s.finalizedAt || null;
  s.builderProgress = typeof s.builderProgress === "number" ? s.builderProgress : computeBuilderProgress(s);
  return s;
}

// Builder progress 0-100: details 15%, structure 15%, questions 70%.
// A not-yet-started assigned series is always 0.
export function computeBuilderProgress(series) {
  if (series.status === "assigned") return 0;
  if (series.status === "ready" || isLive(series) || series.status === "final") return 100;
  const exp = series.assignment?.expected;
  const tests = allTests(series);
  const detailsPart = 1 - Math.min(Object.keys(detailsErrors(series)).length, 6) / 6;
  const testTarget = exp?.tests || Math.max(tests.length, 2);
  const structPart = Math.min(1, tests.filter((t) => t.title.trim() && Number(t.duration) > 0).length / testTarget);
  const qTarget = exp?.questions || 10;
  const validQs = tests.reduce((n, t) => n + t.questions.filter((q) => questionErrors(q).length === 0).length, 0);
  const qPart = Math.min(1, validQs / qTarget);
  return Math.min(99, Math.round((detailsPart * 15 + structPart * 15 + qPart * 70) * 1) );
}

export function quizPoints(questions = []) {
  return questions.reduce((s, q) => s + (Number(q.points) || 0), 0);
}
export function allTests(series) {
  return (series.sections || []).flatMap((s) => s.tests);
}
export function seriesTestCount(series) {
  return allTests(series).length;
}
export function seriesQuestionCount(series) {
  return allTests(series).reduce((s, t) => s + t.questions.length, 0);
}
export function seriesPoints(series) {
  return allTests(series).reduce((s, t) => s + quizPoints(t.questions), 0);
}

// Topics covered — recomputed from the CURRENT questions on every call, so
// the Review step's grid can never drift from what was actually built.
export function topicsCovered(series) {
  const map = new Map();
  allTests(series).forEach((t) =>
    t.questions.forEach((q) => {
      const key = (q.topic || "").trim();
      if (!key) return;
      const k = key.toLowerCase();
      const row = map.get(k) || { topic: key, count: 0 };
      row.count += 1;
      map.set(k, row);
    })
  );
  return Array.from(map.values()).sort((a, b) => b.count - a.count || a.topic.localeCompare(b.topic));
}

// Test Type is DERIVED from the tests actually built (chosen per test).
export function derivedTestTypes(series) {
  const used = new Set(allTests(series).map((t) => t.type));
  return TS_TEST_TYPES.filter((t) => used.has(t));
}
export function questionTypesUsed(series) {
  const used = new Set(allTests(series).flatMap((t) => t.questions.map((q) => q.type)));
  return QUESTION_TYPES.filter((t) => used.has(t.key));
}
export function durationRange(series) {
  const ds = allTests(series).map((t) => Number(t.duration) || 0).filter((d) => d > 0);
  if (!ds.length) return null;
  return { min: Math.min(...ds), max: Math.max(...ds) };
}
export function priceLabel(series) {
  if (series.pricing?.model !== "paid") return series.scope === "course" ? "Included" : "Free";
  const p = Number(series.pricing.price);
  return p > 0 ? formatMoney(p, "INR") : "Free";
}
export function topicSuggestions(series) {
  const used = topicsCovered(series).map((t) => t.topic);
  const extra = (series.courseTopics || []).filter((t) => !used.some((u) => u.toLowerCase() === String(t).toLowerCase()));
  return [...used, ...extra];
}

// Question validation — returns an array of plain-English problems.
export function questionErrors(q) {
  const errs = [];
  if (!stripHtml(q.text)) errs.push("Question text is required.");
  if (!(Number(q.points) > 0)) errs.push("Points must be greater than 0.");
  if (q.type === "mcq_single" || q.type === "mcq_multi") {
    const opts = q.options || [];
    if (opts.length < 2) errs.push("Add at least two options.");
    if (opts.some((o) => !o.text.trim() && !o.image)) errs.push("Every option needs text or an image.");
    const correct = opts.filter((o) => o.correct).length;
    if (correct === 0) errs.push("Mark at least one correct answer.");
    if (q.type === "mcq_single" && correct > 1) errs.push("Single-answer questions can have only one correct option.");
  }
  if (q.type === "true_false" && !(q.options || []).some((o) => o.correct)) errs.push("Pick the correct answer.");
  if (q.type === "numerical") {
    if (q.correctAnswer === "" || q.correctAnswer === undefined || Number.isNaN(Number(q.correctAnswer))) errs.push("Enter the correct numeric answer.");
    if (Number(q.tolerance) < 0) errs.push("Tolerance can't be negative.");
  }
  if (q.type === "fill_blank" && !String(q.correctAnswer || "").trim()) errs.push("Enter the accepted answer.");
  if (isSubjective(q.type)) {
    const rubric = q.rubric || [];
    if (rubric.length) {
      if (rubric.some((r) => !r.label.trim())) errs.push("Every rubric criterion needs a label.");
      if (rubric.some((r) => !(Number(r.points) > 0))) errs.push("Rubric points must be greater than 0.");
      const total = rubric.reduce((s, r) => s + (Number(r.points) || 0), 0);
      if (total !== Number(q.points)) errs.push(`Rubric totals ${total} pts but the question is worth ${Number(q.points) || 0} pts.`);
    }
  }
  return errs;
}

// Step 1 validation — keyed by field so the form can show inline errors.
export function detailsErrors(series) {
  const e = {};
  if (series.title.trim().length < 5) e.title = "Give your series a title (at least 5 characters).";
  if (!series.shortDescription.trim()) e.shortDescription = "Add a one-line summary for the series card.";
  if (series.grades.length === 0) e.grades = "Select at least one class / grade.";
  if (series.subjects.length === 0) e.subjects = "Select at least one subject.";
  if (series.exams.length === 0) e.exams = "Select at least one exam / goal.";
  if (series.languages.length === 0) e.languages = "Select at least one language.";
  if (series.scope === "course" && !series.courseId) e.course = "Pick the course this series belongs to.";
  if (series.pricing.model === "paid" && !(Number(series.pricing.price) > 0)) e.price = "Enter a price greater than 0.";
  if (series.negativeMarking.enabled && !series.negativeMarking.scheme.trim()) e.negativeScheme = "Describe the scheme, e.g. -0.25 per wrong answer.";
  return e;
}
export function structureErrors(series) {
  const e = [];
  if (series.sections.length === 0) e.push("Add at least one section.");
  if (series.sections.some((s) => !s.title.trim())) e.push("Every section needs a name.");
  if (seriesTestCount(series) === 0) e.push("Add at least one test.");
  if (allTests(series).some((t) => !t.title.trim())) e.push("Every test needs a title.");
  if (allTests(series).some((t) => !(Number(t.duration) > 0))) e.push("Every test needs a duration.");
  return e;
}
export function questionsStepErrors(series) {
  const e = [];
  allTests(series).forEach((t) => {
    if (t.questions.length === 0) e.push(`"${t.title || "Untitled test"}" has no questions yet.`);
    else if (t.questions.some((q) => questionErrors(q).length)) e.push(`"${t.title || "Untitled test"}" has questions that need fixing.`);
  });
  return e;
}
// Does this question carry a correct answer (objective) or a rubric / model answer (subjective)?
export function hasAnswerKey(q) {
  if (isSubjective(q.type)) return (q.rubric || []).length > 0 || Boolean(stripHtml(q.modelAnswer || ""));
  if (q.type === "numerical") return q.correctAnswer !== "" && q.correctAnswer !== undefined && !Number.isNaN(Number(q.correctAnswer));
  if (q.type === "fill_blank") return Boolean(String(q.correctAnswer || "").trim());
  return (q.options || []).some((o) => o.correct);
}

// Completeness checklist for the Review step + publish gating.
// Each item: { id, label, ok, required, detail, fix: { step, testId?, questionId?, anchor? } }.
export function completenessChecklist(series) {
  const tests = allTests(series);
  const qs = tests.flatMap((t) => t.questions);
  const exp = series.assignment?.expected;
  const minQ = exp?.questions || MIN_QUESTIONS;
  const dErrs = Object.values(detailsErrors(series));
  const sErrs = structureErrors(series).filter((m) => !m.includes("duration"));
  const noDuration = tests.filter((t) => !(Number(t.duration) > 0));
  const firstEmpty = tests.find((t) => t.questions.length === 0);
  const firstBad = tests.find((t) => t.questions.some((q) => questionErrors(q).length));
  const badQ = firstBad?.questions.find((q) => questionErrors(q).length);
  const noKeyTest = tests.find((t) => t.questions.some((q) => !hasAnswerKey(q)));
  const noKeyQ = noKeyTest?.questions.find((q) => !hasAnswerKey(q));
  const noKeyCount = qs.filter((q) => !hasAnswerKey(q)).length;
  const timing = deadlineErrors(series);
  const build = effectiveBuildDeadline(series);
  const items = [];
  items.push({ id: "details", label: "Series details are complete", ok: dErrs.length === 0, required: true, detail: dErrs[0] || "", fix: { step: 0, anchor: series.scope === "course" && !series.courseId ? "ts-scope" : undefined } });
  items.push({ id: "structure", label: "Sections and tests are set up", ok: sErrs.length === 0, required: true, detail: sErrs[0] || "", fix: { step: 1 } });
  items.push({
    id: "durations",
    label: "Every test has a duration",
    ok: tests.length > 0 && noDuration.length === 0,
    required: true,
    detail: tests.length === 0 ? "Add a test first." : noDuration.length ? `${noDuration.length} test${noDuration.length === 1 ? "" : "s"} missing a duration` : "",
    fix: { step: 1 },
  });
  items.push({ id: "min-questions", label: `At least ${minQ} questions`, ok: qs.length >= minQ, required: true, detail: `${qs.length} of ${minQ} added`, fix: { step: 2, testId: firstEmpty?.id } });
  items.push({
    id: "tests-filled",
    label: "No test is empty or has broken questions",
    ok: tests.length > 0 && !firstEmpty && !firstBad,
    required: true,
    detail: firstEmpty ? `"${firstEmpty.title || "Untitled test"}" has no questions` : firstBad ? `"${firstBad.title || "Untitled test"}" has questions to fix` : "",
    fix: { step: 2, testId: (firstEmpty || firstBad)?.id, questionId: firstEmpty ? undefined : badQ?.id },
  });
  items.push({
    id: "answer-keys",
    label: "Every question has a correct answer or rubric",
    ok: qs.length > 0 && noKeyCount === 0,
    required: true,
    detail: noKeyCount ? `${noKeyCount} question${noKeyCount === 1 ? "" : "s"} without an answer key` : qs.length === 0 ? "Add questions first." : "",
    fix: { step: 2, testId: noKeyTest?.id, questionId: noKeyQ?.id },
  });
  items.push({
    id: "deadline",
    label: "Build deadline is set",
    ok: Boolean(build),
    required: series.origin === "assigned",
    detail: build ? "" : series.origin === "assigned" ? "The admin's deadline is missing." : "Optional for your own series, but it helps you finish on time.",
    fix: { step: 0, anchor: "ts-deadlines" },
  });
  items.push({
    id: "timing",
    label: "Deadlines and go-live dates don't conflict",
    ok: timing.length === 0,
    required: true,
    detail: timing[0]?.msg || "",
    fix: { step: 0, anchor: "ts-deadlines" },
  });
  if (exp) {
    const secs = series.sections.length;
    const marks = seriesPoints(series);
    const gaps = [];
    if (exp.sections && secs !== exp.sections) gaps.push(`${secs}/${exp.sections} sections`);
    if (exp.tests && tests.length !== exp.tests) gaps.push(`${tests.length}/${exp.tests} tests`);
    if (exp.marks && marks !== exp.marks) gaps.push(`${marks}/${exp.marks} marks`);
    items.push({ id: "expected", label: "Matches the admin's expected structure", ok: gaps.length === 0, required: false, detail: gaps.length ? `Currently ${gaps.join(", ")}. Not blocking, but the admin asked for this shape.` : "", fix: { step: 1 } });
  }
  return items;
}

// Publish blockers — [{ msg, step, fix, id }] (step = builder step index to jump to).
// Derived from the required, failing checklist items.
export function publishBlockers(series) {
  return completenessChecklist(series)
    .filter((i) => i.required && !i.ok)
    .map((i) => ({ id: i.id, msg: i.detail ? `${i.label}: ${i.detail}` : i.label, step: i.fix.step, fix: i.fix }));
}

// What the primary button on a card should say/do for a series in its current
// state. `to` is where it navigates: the builder (optionally at the Review
// step) or the read-only detail view.
export function primaryAction(series) {
  const base = `/teacher/testseries/${series.id}`;
  const pct = Math.round(series.builderProgress || 0);
  switch (series.status) {
    case "assigned":
      return { key: "start", label: "Start building", to: base };
    case "drafting":
      return publishBlockers(series).length === 0
        ? { key: "submit", label: "Submit for review", to: `${base}?step=review` }
        : { key: "resume", label: pct > 0 ? `Resume (${pct}%)` : "Resume", to: `${base}?resume=1` };
    case "ready":
      return { key: "publish", label: "Publish", to: `${base}?step=review` };
    default:
      return { key: "view", label: "View", to: `${base}/detail` };
  }
}

// Student-facing visibility for a live series (scheduled go-live may still be ahead).
export function visibilityNote(series) {
  if (!isLive(series)) return "Not visible to students yet";
  const d = series.deadlines || {};
  if (d.publishMode === "scheduled" && d.goLiveAt && d.goLiveAt > MOCK_TODAY_ISO) return `Goes live ${formatDate(d.goLiveAt)}`;
  if (d.windowMode === "window" && d.windowClose && d.windowClose < MOCK_TODAY_ISO) return "Window closed";
  return series.status === "final" ? "Live · structure locked" : "Live for students";
}

// Per-series performance rollup -- the data hook for the Performance tab
// (Part 7 builds the full dashboard on top of this + the series/submissions
// in TestSeriesContext). `submissions` is the context's submissions array.
export function seriesPerformanceSummary(series, submissions = []) {
  const subs = submissions.filter((x) => x.seriesId === series.id);
  const graded = subs.filter((x) => x.status === "graded");
  const price = series.pricing?.model === "paid" ? Number(series.pricing.price) || 0 : 0;
  const scored = graded.filter((x) => x.manualMaxScore > 0 && typeof x.score === "number");
  return {
    enrolled: series.enrollments || 0,
    attempts: series.attempts || 0,
    attemptsPerStudent: series.enrollments ? Math.round((series.attempts / series.enrollments) * 10) / 10 : 0,
    pendingGrading: subs.length - graded.length,
    graded: graded.length,
    avgWrittenScorePct: scored.length ? Math.round((scored.reduce((n, x) => n + x.score / x.manualMaxScore, 0) / scored.length) * 100) : null,
    revenue: price * (series.enrollments || 0),
    questions: seriesQuestionCount(series),
    tests: seriesTestCount(series),
    marks: seriesPoints(series),
  };
}

// ---------------------------------------------------------------------
// Seed helpers (deterministic ids so seeded submissions can reference the
// seeded questions' rubric criteria).
let _n = 0;
const sid = (p) => `${p}-seed${++_n}`;
const opt = (text, correct = false) => ({ id: sid("o"), text, correct });
function mcq(text, options, correctIdx, topic, points = 4, difficulty = "Intermediate", explanation = "") {
  return { id: sid("q"), type: "mcq_single", text: `<p>${text}</p>`, points, difficulty, topic, explanation, options: options.map((o, i) => opt(o, i === correctIdx)) };
}
function multi(text, options, correctIdxs, topic, points = 4, difficulty = "Advanced") {
  return { id: sid("q"), type: "mcq_multi", text: `<p>${text}</p>`, points, difficulty, topic, explanation: "", options: options.map((o, i) => opt(o, correctIdxs.includes(i))) };
}
function tf(text, answer, topic, points = 2) {
  return { id: sid("q"), type: "true_false", text: `<p>${text}</p>`, points, difficulty: "Beginner", topic, explanation: "", options: [opt("True", answer), opt("False", !answer)] };
}
function num(text, answer, tolerance, topic, points = 4) {
  return { id: sid("q"), type: "numerical", text: `<p>${text}</p>`, points, difficulty: "Intermediate", topic, explanation: "", correctAnswer: String(answer), tolerance };
}
function fill(text, answer, topic, points = 2) {
  return { id: sid("q"), type: "fill_blank", text: `<p>${text}</p>`, points, difficulty: "Beginner", topic, explanation: "", correctAnswer: answer };
}
function subj(type, text, model, topic, rubricRows, wordLimit, difficulty = "Advanced") {
  const rubric = rubricRows.map(([label, points]) => ({ id: sid("r"), label, points }));
  return { id: sid("q"), type, text: `<p>${text}</p>`, points: rubric.reduce((s, r) => s + r.points, 0), difficulty, topic, explanation: "", modelAnswer: `<p>${model}</p>`, wordLimit, rubric };
}
// Attach an uploaded-style image to a seeded question (stem) or to each of its options.
const withImage = (q, image) => ({ ...q, image });
const withOptionImages = (q, images) => ({ ...q, options: q.options.map((o, i) => (images[i] ? { ...o, image: images[i] } : o)) });
const test = (title, type, duration, locked, questions) => ({ id: sid("t"), title, type, duration, locked, questions });
const section = (title, tests) => ({ id: sid("s"), title, tests });

// ---------------------------------------------------------------------
// Teachers roster (admin screen). The demo educator ("Ansh Mehra", the same
// name used for gradedBy elsewhere in this app) has access by default.
export const DEMO_TEACHER_ID = "t-ansh";

export const SEED_TEACHERS = [
  { id: "t-ansh", name: "Ansh Mehra", email: "ansh.mehra@gmail.com", subjects: ["Physics", "Mathematics"], courses: 6, access: true, grantedAt: "2026-08-14", revokedAt: null },
  { id: "t-meera", name: "Dr. Meera Iyer", email: "meera.iyer@universallearning.in", subjects: ["Chemistry"], courses: 4, access: true, grantedAt: "2026-07-02", revokedAt: null },
  { id: "t-rohan", name: "Rohan Kulkarni", email: "rohan.k@universallearning.in", subjects: ["Mathematics"], courses: 3, access: false, grantedAt: null, revokedAt: null },
  { id: "t-sana", name: "Sana Qureshi", email: "sana.q@universallearning.in", subjects: ["English", "Social Science"], courses: 5, access: false, grantedAt: null, revokedAt: null },
  { id: "t-vikram", name: "Vikram Desai", email: "vikram.desai@universallearning.in", subjects: ["Computer Science"], courses: 2, access: false, grantedAt: "2026-06-10", revokedAt: "2026-09-01" },
  { id: "t-lakshmi", name: "Lakshmi Narayanan", email: "lakshmi.n@universallearning.in", subjects: ["Biology"], courses: 7, access: false, grantedAt: null, revokedAt: null },
  { id: "t-arjun", name: "Arjun Bhatt", email: "arjun.bhatt@universallearning.in", subjects: ["Physics"], courses: 1, access: false, grantedAt: null, revokedAt: null },
  { id: "t-neha", name: "Neha Kapoor", email: "neha.kapoor@universallearning.in", subjects: ["Chemistry", "Biology"], courses: 3, access: false, grantedAt: null, revokedAt: null },
  { id: "t-tomas", name: "Tomás Alvarez", email: "tomas.alvarez@universallearning.in", subjects: ["English"], courses: 2, access: false, grantedAt: null, revokedAt: null },
  { id: "t-priya", name: "Priya Menon", email: "priya.menon@universallearning.in", subjects: ["Mathematics", "Computer Science"], courses: 4, access: false, grantedAt: null, revokedAt: null },
];

// Which roster entry is "me"? Auth is a placeholder (user is null until a
// real login exists), so an unmatched or absent user falls back to the demo
// educator -- that's what makes the teacher portal demo-able today.
export function resolveTeacher(user, teachers) {
  if (user) {
    const email = String(user.email || "").toLowerCase();
    const found = teachers.find(
      (t) => (user.id && t.id === user.id) || (email && t.email.toLowerCase() === email) || (user.name && t.name === user.name)
    );
    if (found) return found;
  }
  return teachers.find((t) => t.id === DEMO_TEACHER_ID) || null;
}

// ---------------------------------------------------------------------
// Seed series
const PHYSICS_SHORT = withImage(subj(
  "short_answer",
  "Derive the expression for the time of flight of a projectile launched with speed u at angle θ above the horizontal on level ground.",
  "Vertical displacement is zero at landing: 0 = u sinθ·T − ½gT², so T = 2u sinθ / g.",
  "Projectile Motion",
  [["Sets up vertical motion with correct signs", 2], ["Solves for T correctly", 2], ["States result and assumptions", 1]],
  80
), projectileStem());
const PHYSICS_ESSAY = withImage(subj(
  "long_answer",
  "Explain the law of conservation of angular momentum. Use an example to show how a change in moment of inertia changes angular velocity.",
  "With no net external torque, L = Iω stays constant. A skater pulling arms in reduces I, so ω must rise to keep L unchanged.",
  "Rotational Motion",
  [["States the law with its condition (no external torque)", 3], ["Relates L = Iω correctly", 3], ["Gives a worked/clear example", 2], ["Clarity and structure", 2]],
  300
), skaterStem());

const S_JEE = {
  id: "ts-jee-physics",
  teacherId: "t-ansh",
  title: "JEE Main Physics Mastery — Full Syllabus",
  shortDescription: "Chapter-wise skill checks, graded practice sets and full-length mocks for JEE Main Physics.",
  about:
    "<p>A complete test series built around the JEE Main Physics syllabus. Start with free skill tests to find your gaps, sharpen them with practice sets that include written-answer questions, then finish with timed full-length mocks.</p><ul><li>Detailed explanations for every objective question</li><li>Subjective questions graded by your educator with a rubric</li><li>Negative marking mirrors the real exam</li></ul>",
  whoFor: "Class 11–12 students and droppers preparing for JEE Main who want exam-pattern practice with expert feedback.",
  grades: ["Class 11", "Class 12", "Competitive Exams"],
  subjects: ["Physics"],
  exams: ["Entrance Exams", "Competitive Exams"],
  difficulty: "Advanced",
  languages: ["English", "Hindi"],
  badges: ["Popular", "Full Syllabus", "Best Value"],
  pricing: { model: "paid", price: 799 },
  negativeMarking: { enabled: true, scheme: "-0.25 per wrong answer" },
  sections: [
    section("Skill Tests", [
      test("Kinematics Skill Check", "Topic", 20, false, [
        mcq("A car accelerates uniformly from rest to 20 m/s in 5 s. How far does it travel in this time?", ["25 m", "50 m", "100 m", "10 m"], 1, "Kinematics", 4, "Beginner", "s = ½(u+v)t = ½(0+20)(5) = 50 m."),
        withImage(mcq("The graph shows how a body's velocity changes with time. What is its displacement from t = 0 to t = 6 s?", ["20 m", "30 m", "40 m", "60 m"], 2, "Kinematics", 4, "Intermediate", "Displacement is the area under the v–t graph: ½ × 4 × 10 + 2 × 10 = 40 m."), velocityTimeStem()),
        tf("The area under a velocity–time graph gives displacement.", true, "Kinematics"),
        num("A ball is thrown upward at 20 m/s. Taking g = 10 m/s², find the maximum height reached (in metres).", 20, 0.1, "Kinematics"),
        fill("The slope of a position–time graph gives the ______.", "velocity", "Kinematics"),
      ]),
      test("Laws of Motion Skill Check", "Topic", 20, false, [
        mcq("A 2 kg block is pulled by a net force of 6 N. Its acceleration is:", ["3 m/s²", "12 m/s²", "0.33 m/s²", "8 m/s²"], 0, "Laws of Motion", 4, "Beginner"),
        withImage(mcq("A block of mass m slides down the frictionless incline shown. What is its acceleration along the slope? (g = 10 m/s²)", ["5 m/s²", "10 m/s²", "8.66 m/s²", "2.5 m/s²"], 0, "Laws of Motion", 4, "Intermediate", "Along a smooth incline a = g sin θ = 10 × sin 30° = 5 m/s²."), inclineStem()),
        mcq("Which law explains why passengers lurch forward when a bus brakes suddenly?", ["Newton's first law", "Newton's second law", "Newton's third law", "Law of gravitation"], 0, "Laws of Motion", 4, "Beginner"),
        multi("Which of the following are contact forces?", ["Friction", "Tension", "Gravity", "Normal reaction"], [0, 1, 3], "Laws of Motion"),
      ]),
    ]),
    section("Practice Tests", [
      test("Mechanics Practice Set 1", "Chapter", 45, true, [
        mcq("The dimensional formula of angular momentum is:", ["ML²T⁻¹", "MLT⁻¹", "ML²T⁻²", "M⁰L²T⁻¹"], 0, "Rotational Motion", 4),
        num("A projectile is launched at 30 m/s at 30° above horizontal. Find its time of flight in seconds (g = 10 m/s²).", 3, 0.05, "Projectile Motion"),
        PHYSICS_SHORT,
      ]),
      test("Electrostatics & Current Practice Set", "Chapter", 45, true, [
        mcq("Two equal charges repel with force F. If the distance doubles, the force becomes:", ["F/2", "F/4", "2F", "4F"], 1, "Electrostatics", 4),
        mcq("The SI unit of electric potential is:", ["Volt", "Ampere", "Ohm", "Farad"], 0, "Electrostatics", 4, "Beginner"),
        num("A 12 V battery drives a current through a 4 Ω resistor. Find the current in amperes.", 3, 0.01, "Current Electricity"),
        withImage(num("In the circuit shown, find the current drawn from the 12 V cell (in amperes).", 2, 0.01, "Current Electricity"), circuitStem()),
      ]),
    ]),
    section("Mock Exams", [
      test("Full-Length Mock 1", "Full-Length", 180, true, [
        mcq("A body in SHM has amplitude A. At what displacement is its kinetic energy equal to its potential energy?", ["A/2", "A/√2", "A/4", "A√2"], 1, "Oscillations", 4),
        withOptionImages(mcq("Which velocity–time graph represents a body moving with constant negative acceleration (retardation)?", ["Graph A", "Graph B", "Graph C", "Graph D"], 2, "Kinematics", 4, "Intermediate", "Constant negative acceleration is a straight line with a negative slope: graph C."), velocityGraphOptions()),
        multi("Which quantities are conserved in an elastic collision?", ["Momentum", "Kinetic energy", "Total energy", "Velocity of each body"], [0, 1, 2], "Collisions"),
        PHYSICS_ESSAY,
      ]),
      test("Sectional Mock — Modern Physics", "Sectional", 60, true, [
        mcq("In the photoelectric effect, the stopping potential depends on:", ["Frequency of light", "Intensity of light", "Both equally", "Neither"], 0, "Modern Physics", 4),
        tf("The de Broglie wavelength of a particle increases as its momentum increases.", false, "Modern Physics"),
      ]),
    ]),
  ],
  settings: { passingPct: 40, attemptsUnlimited: false, attemptLimit: 3, access: "on_demand", startDate: "", certificate: true },
  status: "published",
  enrollments: 412,
  attempts: 1286,
  stepReached: 3,
  createdAt: "2026-06-12",
  updatedAt: "2026-09-18",
};

const S_CHEM_DRAFT = {
  id: "ts-chem-draft",
  teacherId: "t-ansh",
  title: "Organic Chemistry Foundations — Class 12",
  shortDescription: "Reaction mechanisms and named reactions, one chapter at a time.",
  about: "<p>Work in progress.</p>",
  whoFor: "",
  grades: ["Class 12"],
  subjects: ["Chemistry"],
  exams: ["Board Exams"],
  difficulty: "Intermediate",
  languages: ["English"],
  badges: ["New"],
  pricing: { model: "free", price: "" },
  negativeMarking: { enabled: false, scheme: "" },
  sections: [
    section("Skill Tests", [
      test("Nomenclature Skill Check", "Topic", 15, false, [
        mcq("What is the IUPAC name of CH₃CH₂CH₂OH?", ["Propan-1-ol", "Propan-2-ol", "Ethanol", "Butan-1-ol"], 0, "Nomenclature", 2, "Beginner"),
      ]),
      test("Reaction Mechanisms", "Chapter", 30, true, []),
    ]),
    section("Practice Tests", []),
  ],
  settings: { passingPct: 40, attemptsUnlimited: true, attemptLimit: 3, access: "on_demand", startDate: "", certificate: false },
  status: "draft",
  enrollments: 0,
  attempts: 0,
  stepReached: 1,
  createdAt: "2026-09-15",
  updatedAt: "2026-09-19",
};

const S_MATH_ARCHIVED = {
  id: "ts-class10-maths",
  teacherId: "t-ansh",
  title: "Class 10 Maths Board Prep — 2025 Edition",
  shortDescription: "Last year's board-pattern practice papers, kept for reference.",
  about: "<p>Board-pattern practice papers for Class 10 Mathematics.</p>",
  whoFor: "Class 10 students preparing for board exams.",
  grades: ["Class 10"],
  subjects: ["Mathematics"],
  exams: ["Board Exams"],
  difficulty: "Intermediate",
  languages: ["English"],
  badges: ["Free"],
  pricing: { model: "free", price: "" },
  negativeMarking: { enabled: false, scheme: "" },
  sections: [
    section("Practice Tests", [
      test("Board Paper 1", "Full-Length", 90, false, [
        mcq("The roots of x² − 5x + 6 = 0 are:", ["2 and 3", "1 and 6", "−2 and −3", "2 and −3"], 0, "Quadratic Equations", 2, "Beginner"),
        num("Find the 10th term of the AP 3, 7, 11, …", 39, 0, "Arithmetic Progressions", 2),
      ]),
    ]),
  ],
  settings: { passingPct: 33, attemptsUnlimited: true, attemptLimit: 3, access: "on_demand", startDate: "", certificate: false },
  status: "archived",
  enrollments: 188,
  attempts: 540,
  stepReached: 3,
  createdAt: "2025-01-10",
  updatedAt: "2026-05-30",
};

const S_NEET_MEERA = {
  id: "ts-neet-chem",
  teacherId: "t-meera",
  title: "NEET Chemistry Chapter Tests",
  shortDescription: "Chapter tests covering the NEET Chemistry syllabus.",
  about: "<p>Chapter-wise tests for NEET Chemistry.</p>",
  whoFor: "NEET aspirants.",
  grades: ["Class 11", "Class 12"],
  subjects: ["Chemistry"],
  exams: ["Entrance Exams"],
  difficulty: "Intermediate",
  languages: ["English"],
  badges: ["Recommended"],
  pricing: { model: "paid", price: 499 },
  negativeMarking: { enabled: true, scheme: "-1 per wrong answer" },
  sections: [
    section("Course Tests", [
      test("Chemical Bonding", "Chapter", 40, false, [
        mcq("Which molecule has a linear geometry?", ["CO₂", "H₂O", "NH₃", "CH₄"], 0, "Chemical Bonding", 4),
      ]),
    ]),
  ],
  settings: { passingPct: 50, attemptsUnlimited: true, attemptLimit: 3, access: "on_demand", startDate: "", certificate: false },
  status: "published",
  enrollments: 96,
  attempts: 240,
  stepReached: 3,
  createdAt: "2026-07-20",
  updatedAt: "2026-09-02",
};

const S_CS_VIKRAM = {
  id: "ts-cs-draft",
  teacherId: "t-vikram",
  title: "Python Skill Tests for Beginners",
  shortDescription: "Short skill checks for first-time programmers.",
  about: "<p>Skill tests for beginner Python.</p>",
  whoFor: "Absolute beginners.",
  grades: ["Other"],
  subjects: ["Computer Science"],
  exams: ["Skill Tests"],
  difficulty: "Beginner",
  languages: ["English"],
  badges: ["Practical"],
  pricing: { model: "free", price: "" },
  negativeMarking: { enabled: false, scheme: "" },
  sections: [section("Skill Tests", [test("Variables & Types", "Topic", 15, false, [fill("The keyword used to define a function in Python is ______.", "def", "Functions")])])],
  settings: { passingPct: 40, attemptsUnlimited: true, attemptLimit: 3, access: "on_demand", startDate: "", certificate: false },
  status: "draft",
  enrollments: 0,
  attempts: 0,
  stepReached: 2,
  createdAt: "2026-08-20",
  updatedAt: "2026-08-28",
};

// ---------------------------------------------------------------------
// Part 6 seeds: 4 series ASSIGNED by an admin (not started / ~40% drafted /
// ready for review / overdue vs. the mock TODAY 2026-09-20) and 3 of the
// educator's OWN series (course-wise on real seeded course ids c1/c2, plus
// one standalone). Existing seeds above are migrated by normalizeSeries().
const ADMIN_KAVITA = { name: "Dr. Kavita Rao", role: "Academic Head" };
const ADMIN_SANDEEP = { name: "Sandeep Joshi", role: "Curriculum Admin" };

function mkSeries(over) {
  return {
    teacherId: "t-ansh",
    shortDescription: "", about: "", whoFor: "",
    grades: [], subjects: [], exams: [], difficulty: "Intermediate", languages: ["English"], badges: [],
    pricing: { model: "free", price: "" },
    negativeMarking: { enabled: false, scheme: "" },
    sections: [],
    settings: { passingPct: 40, attemptsUnlimited: true, attemptLimit: 3, access: "on_demand", startDate: "", certificate: false },
    enrollments: 0, attempts: 0, stepReached: 0,
    createdAt: "2026-09-10", updatedAt: "2026-09-18",
    ...over,
  };
}

// A1 -- assigned, not started
const S_A1 = mkSeries({
  id: "ts-assign-bio9",
  title: "Class 9 Biology — Cell & Tissues Chapter Tests",
  origin: "assigned", scope: "standalone", status: "assigned",
  grades: ["Class 9"], subjects: ["Biology"], exams: ["School Exams"], difficulty: "Beginner",
  createdAt: "2026-09-18", updatedAt: "2026-09-18", lastSavedAt: null,
  draftPayload: { startCompleted: false, stepIndex: 0, activeTestId: null, activeQuestionId: null },
  assignment: {
    assignedBy: ADMIN_KAVITA, assignedOn: "2026-09-18", requiredDeadline: "2026-10-12",
    adminBrief: "Build a chapter-test series for the new Class 9 Biology syllabus covering 'The Fundamental Unit of Life' and 'Tissues'.\nStudents are Class 9 CBSE learners, so keep language simple and use NCERT terminology. Two sections: one for skill checks, one for full chapter tests.",
    expected: { sections: 2, tests: 4, questions: 40, marks: 120 },
    taxonomy: { grades: ["Class 9"], subjects: ["Biology"], exams: ["School Exams"], difficulty: "Beginner" },
    adminNotes: "No negative marking. Every question needs an explanation. Diagrams are not supported yet, so describe them in words.",
  },
});

// A2 -- assigned, course-wise (c2), ~40% drafted
const A2_Q1 = mcq("Which pattern lets a parent control how each list item of a child component is rendered?", ["Render props", "Prop drilling", "Context default value", "Uncontrolled refs"], 0, "Composition", 4, "Intermediate");
const A2_Q5 = fill("A component that wraps another to inject extra props is called a ______ component.", "higher-order", "Composition");
const A2_T1 = test("Composition Patterns", "Chapter", 20, false, [
  A2_Q1,
  mcq("Compound components usually share their implicit state through:", ["React context", "Global variables", "Query strings", "CSS variables"], 0, "Composition", 4, "Intermediate"),
  tf("Custom hooks must start with 'use' so lint rules can verify the Rules of Hooks.", true, "Hooks"),
  mcq("Which API keeps a callback's identity stable between renders?", ["useCallback", "useId", "useTransition", "useSyncExternalStore"], 0, "Performance", 4, "Intermediate"),
  A2_Q5,
]);
const A2_S1 = section("Module Checkpoints", [A2_T1, test("Performance Checkpoint", "Chapter", 20, false, []), test("Testing Hooks", "Chapter", 20, false, [])]);
const S_A2 = mkSeries({
  id: "ts-assign-react",
  title: "React Patterns — Module Checkpoints",
  origin: "assigned", scope: "course", courseId: "c2", status: "drafting",
  grades: ["Other"], subjects: ["Computer Science"], exams: ["Skill Tests"], difficulty: "Advanced",
  whoFor: "Learners enrolled in Modern React Patterns for Production.",
  sections: [A2_S1],
  stepReached: 2, lastEditedStep: 2, startMethod: "scratch",
  lastEditedPointer: { sectionId: A2_S1.id, testId: A2_T1.id, questionId: A2_Q5.id },
  draftPayload: { startCompleted: true, stepIndex: 2, activeTestId: A2_T1.id, activeQuestionId: A2_Q5.id },
  createdAt: "2026-09-11", updatedAt: "2026-09-19", lastSavedAt: "2026-09-19T16:40:00.000Z",
  assignment: {
    assignedBy: ADMIN_SANDEEP, assignedOn: "2026-09-11", requiredDeadline: "2026-09-26",
    adminBrief: "Create checkpoint tests for the Modern React Patterns course, one per module. Learners already enrolled should get access automatically.\nFocus on patterns they actually use at work: composition, hooks, performance and testing.",
    expected: { sections: 2, tests: 4, questions: 20, marks: 80 },
    taxonomy: { grades: ["Other"], subjects: ["Computer Science"], exams: ["Skill Tests"], difficulty: "Advanced" },
    adminNotes: "Keep each checkpoint under 25 minutes. Tag every question with its module topic.",
  },
});

// A3 -- assigned, standalone, ready for review (due in 2 days)
const OPT_Q = [
  mcq("A concave mirror has a focal length of 20 cm. Its radius of curvature is:", ["10 cm", "20 cm", "40 cm", "80 cm"], 2, "Ray Optics"),
  mcq("The refractive index of glass is 1.5. The speed of light in glass is (c = 3×10⁸ m/s):", ["2×10⁸ m/s", "4.5×10⁸ m/s", "1.5×10⁸ m/s", "3×10⁸ m/s"], 0, "Ray Optics"),
  num("An object is placed 30 cm from a convex lens of focal length 10 cm. Find the image distance in cm.", 15, 0.1, "Ray Optics"),
  mcq("The critical angle is smallest for the medium with:", ["Highest refractive index", "Lowest refractive index", "Equal indices", "Zero density"], 0, "Ray Optics"),
  tf("A convex lens always forms a real image.", false, "Ray Optics", 4),
  mcq("The power of a lens of focal length 50 cm is:", ["+2 D", "+0.5 D", "+5 D", "−2 D"], 0, "Ray Optics"),
  mcq("Interference of light confirms its:", ["Wave nature", "Particle nature", "Speed", "Polarisation only"], 0, "Wave Optics"),
  mcq("In Young's double slit experiment, fringe width is proportional to:", ["λD/d", "d/λD", "λd/D", "D/λ"], 0, "Wave Optics"),
  num("Light of wavelength 600 nm, slit separation 1 mm, screen at 1 m. Fringe width in mm?", 0.6, 0.01, "Wave Optics"),
  tf("Diffraction is most pronounced when the obstacle size is comparable to the wavelength.", true, "Wave Optics", 4),
  mcq("Polarisation proves that light waves are:", ["Transverse", "Longitudinal", "Stationary", "Mechanical"], 0, "Wave Optics"),
  fill("The bending of light around an obstacle is called ______.", "diffraction", "Wave Optics", 4),
];
const S_A3 = mkSeries({
  id: "ts-assign-optics",
  title: "Class 12 Physics — Optics Sectional Tests",
  origin: "assigned", scope: "standalone", status: "ready",
  shortDescription: "Two sectional tests on ray and wave optics for Class 12 boards and JEE.",
  about: "<p>Ray optics and wave optics sectional tests with explanations.</p>",
  whoFor: "Class 12 students preparing for boards and JEE Main.",
  grades: ["Class 12"], subjects: ["Physics"], exams: ["Board Exams", "Entrance Exams"], difficulty: "Intermediate",
  pricing: { model: "paid", price: 349 },
  sections: [section("Sectional Tests", [test("Ray Optics Sectional", "Sectional", 30, true, OPT_Q.slice(0, 6)), test("Wave Optics Sectional", "Sectional", 30, true, OPT_Q.slice(6))])],
  stepReached: 3, lastEditedStep: 3, startMethod: "scratch",
  createdAt: "2026-09-08", updatedAt: "2026-09-19", lastSavedAt: "2026-09-19T11:05:00.000Z",
  assignment: {
    assignedBy: ADMIN_KAVITA, assignedOn: "2026-09-08", requiredDeadline: "2026-09-22",
    adminBrief: "Prepare two sectional tests on Optics (ray and wave) for Class 12. This will be sold as a standalone series, so please set a price within the 249 to 499 rupee band.",
    expected: { sections: 1, tests: 2, questions: 12, marks: 48 },
    taxonomy: { grades: ["Class 12"], subjects: ["Physics"], exams: ["Board Exams", "Entrance Exams"], difficulty: "Intermediate" },
    adminNotes: "Make sure answer keys are double-checked. Numerical tolerances should not exceed 2%.",
  },
});

// A4 -- assigned, course-wise (c1), OVERDUE (due 2026-09-15)
const S_A4 = mkSeries({
  id: "ts-assign-color",
  title: "Colour Theory Fundamentals — Checkpoint Quizzes",
  origin: "assigned", scope: "course", courseId: "c1", status: "drafting",
  grades: ["Other"], subjects: ["Other"], exams: [], difficulty: "Intermediate",
  sections: [section("Checkpoint Quizzes", [test("Colour Models", "Chapter", 15, false, [
    mcq("Which colour model do screens use?", ["RGB", "CMYK", "Pantone", "RYB"], 0, "Color Models", 4, "Beginner"),
    tf("Complementary colours sit opposite each other on the colour wheel.", true, "Color Wheel", 4),
  ])])],
  stepReached: 2, lastEditedStep: 2,
  createdAt: "2026-09-03", updatedAt: "2026-09-12", lastSavedAt: "2026-09-12T09:30:00.000Z",
  assignment: {
    assignedBy: ADMIN_SANDEEP, assignedOn: "2026-09-03", requiredDeadline: "2026-09-15",
    adminBrief: "Add checkpoint quizzes to the Advanced UI Principles & Color Theory course so students can self-check after each module.\nThe course launch announcement already mentions these quizzes, so this one is time-sensitive.",
    expected: { sections: 1, tests: 4, questions: 20, marks: 80 },
    taxonomy: { grades: ["Other"], subjects: ["Other"], exams: ["Skill Tests"], difficulty: "Intermediate" },
    adminNotes: "One quiz per course module. Link every question to a lesson topic.",
  },
});

// O1 -- own, course-wise (c1), drafting
const O1_T1 = test("Colour Fundamentals Check", "Chapter", 15, false, [
  mcq("A WCAG AA contrast ratio for normal text is at least:", ["4.5:1", "3:1", "7:1", "2:1"], 0, "Accessibility", 4, "Intermediate"),
  mcq("Saturation describes a colour's:", ["Intensity", "Lightness", "Hue name", "Opacity only"], 0, "HSL", 4, "Beginner"),
  fill("Hue, saturation and ______ make up the HSL model.", "lightness", "HSL"),
  mcq("A tint is made by adding which colour to a hue?", ["White", "Black", "Grey", "Its complement"], 0, "Color Mixing", 4, "Beginner"),
  tf("Adding black to a hue creates a shade.", true, "Color Mixing"),
  mcq("Which scheme uses three colours evenly spaced on the wheel?", ["Triadic", "Analogous", "Complementary", "Monochromatic"], 0, "Color Schemes", 4, "Intermediate"),
]);
const S_O1 = mkSeries({
  id: "ts-own-color",
  title: "Colour Theory Mastery Checks",
  origin: "own", scope: "course", courseId: "c1", status: "drafting",
  shortDescription: "Quick self-checks for every module of the colour theory course.",
  about: "<p>Self-check quizzes that match the course modules.</p>",
  whoFor: "Students of Advanced UI Principles & Color Theory.",
  grades: ["Other"], subjects: ["Other"], exams: ["Skill Tests"], difficulty: "Intermediate",
  sections: [section("Course Tests", [O1_T1, test("Accessible Palettes", "Chapter", 20, false, [])])],
  stepReached: 2, lastEditedStep: 2, startMethod: "scratch",
  lastEditedPointer: { sectionId: null, testId: O1_T1.id, questionId: O1_T1.questions[5].id },
  draftPayload: { startCompleted: true, stepIndex: 2, activeTestId: null, activeQuestionId: null },
  createdAt: "2026-09-14", updatedAt: "2026-09-19", lastSavedAt: "2026-09-19T20:15:00.000Z",
});

// O2 -- own, course-wise (c2), FINAL published (locked)
const S_O2 = mkSeries({
  id: "ts-own-react-final",
  title: "React Patterns — Final Assessment",
  origin: "own", scope: "course", courseId: "c2", status: "final",
  shortDescription: "The end-of-course assessment for Modern React Patterns for Production.",
  about: "<p>A timed final assessment that tests everything covered in the course.</p>",
  whoFor: "Students who completed Modern React Patterns for Production.",
  grades: ["Other"], subjects: ["Computer Science"], exams: ["Skill Tests"], difficulty: "Advanced",
  pricing: { model: "free", price: "" },
  sections: [section("Final Assessment", [
    test("Patterns & Architecture", "Subject", 40, false, [
      mcq("Which approach avoids prop drilling across many levels?", ["Context", "Global CSS", "Query strings", "Refs"], 0, "Composition", 4, "Intermediate"),
      mcq("What does React.memo skip when props are unchanged?", ["Re-rendering the component", "Mounting it", "Reading context", "Running effects cleanup"], 0, "Performance", 4, "Intermediate"),
      tf("useMemo guarantees a value is never recomputed.", false, "Performance", 4),
    ]),
    test("Testing & Reliability", "Subject", 30, false, [
      mcq("Which query is preferred in Testing Library for accessibility?", ["getByRole", "getByTestId", "container.querySelector", "getByClassName"], 0, "Testing", 4, "Intermediate"),
      fill("Mocking a module in Jest uses jest.______.", "mock", "Testing"),
      num("A suite runs 120 tests and 6 fail. What percentage pass?", 95, 0.1, "Testing"),
    ]),
  ])],
  enrollments: 56, attempts: 120, stepReached: 3, lastEditedStep: 3, startMethod: "scratch",
  publishedAt: "2026-09-01", finalizedAt: "2026-09-12",
  deadlines: { publishMode: "now", windowMode: "window", windowOpen: "2026-09-01", windowClose: "2026-11-30", late: { policy: "penalty", penaltyPct: 10, graceHours: 48 } },
  createdAt: "2026-08-25", updatedAt: "2026-09-12", lastSavedAt: "2026-09-12T14:20:00.000Z",
});

// O3 -- own, standalone, early drafting
const S_O3 = mkSeries({
  id: "ts-own-reasoning",
  title: "Logical Reasoning Sprint — 20 Day Plan",
  origin: "own", scope: "standalone", status: "drafting",
  shortDescription: "Daily short reasoning tests for competitive exams.",
  about: "<p>A 20 day sprint of short logical reasoning tests.</p>",
  whoFor: "Competitive exam aspirants.",
  grades: ["Competitive Exams"], subjects: ["Mathematics"], exams: ["Competitive Exams"], difficulty: "Intermediate",
  pricing: { model: "paid", price: 299 },
  audience: { visibility: "public", seatLimit: "" },
  sections: [section("Practice Tests", [test("Day 1 — Series & Patterns", "Topic", 15, false, [
    mcq("What comes next? 2, 6, 12, 20, ?", ["28", "30", "32", "26"], 1, "Number Series", 2, "Beginner"),
    mcq("If all roses are flowers and some flowers fade, which must be true?", ["Some roses fade", "All flowers are roses", "No conclusion about roses fading", "Roses never fade"], 2, "Syllogisms", 2, "Intermediate"),
  ])])],
  stepReached: 1, lastEditedStep: 1, startMethod: "scratch",
  createdAt: "2026-09-17", updatedAt: "2026-09-19", lastSavedAt: "2026-09-19T08:50:00.000Z",
  deadlines: { attemptExpiryDays: 30 },
});

export const SEED_SERIES = [S_A1, S_A2, S_A3, S_A4, S_O1, S_O2, S_O3, S_JEE, S_CHEM_DRAFT, S_MATH_ARCHIVED, S_NEET_MEERA, S_CS_VIKRAM].map(normalizeSeries);

// ---------------------------------------------------------------------
// Seeded subjective submissions -> Grading queue. Same shape as a course
// submission (see C1_SUBMISSIONS in teacherCourses.js) plus
// `source: "test_series"` and the series/test/question context + the
// question's rubric, so GradingPanel's rubric workflow runs unchanged.
// studentIds are plain strings (these students aren't in a course roster).
function submission(n, studentName, q, testTitle, submittedAt, text, extra = {}) {
  return {
    id: `tsub-${n}`,
    source: "test_series",
    seriesId: S_JEE.id,
    seriesTitle: S_JEE.title,
    testTitle,
    questionId: q.id,
    questionText: q.text,
    questionImage: q.image || null,
    studentId: `ts-stu-${n}`,
    studentName,
    lessonId: q.id,
    moduleTitle: testTitle,
    type: "quiz",
    manualMaxScore: q.points,
    rubric: q.rubric,
    submittedAt,
    late: false,
    status: "pending",
    content: { kind: "text", value: text },
    ...extra,
  };
}

export const SEED_TS_SUBMISSIONS = [
  submission(1, "Aarav Sharma", PHYSICS_SHORT, "Mechanics Practice Set 1", "2026-09-10",
    "Taking upward as positive, vertical displacement at landing is zero so 0 = u sinθ T − ½ g T². Dividing by T (T ≠ 0) gives T = 2u sinθ / g. This assumes level ground and no air resistance."),
  submission(2, "Ishita Verma", PHYSICS_SHORT, "Mechanics Practice Set 1", "2026-09-14",
    "Time of flight is T = 2 u sin θ / g because the object goes up for u sin θ / g and comes down for the same time."),
  submission(3, "Karthik Raman", PHYSICS_SHORT, "Mechanics Practice Set 1", "2026-09-17",
    "T = u sinθ / g"),
  submission(4, "Diya Patel", PHYSICS_ESSAY, "Full-Length Mock 1", "2026-09-05",
    "Angular momentum is conserved when no external torque acts on a system. L = I ω, so if I decreases, ω increases. A figure skater spinning with arms outstretched pulls the arms in, reducing the moment of inertia, and spins much faster. The total angular momentum stays the same throughout."),
  submission(5, "Rahul Nair", PHYSICS_ESSAY, "Full-Length Mock 1", "2026-09-12",
    "Conservation of angular momentum means the spin of an object stays the same. For example a planet keeps going round the sun at constant speed."),
  submission(6, "Meher Singh", PHYSICS_SHORT, "Mechanics Practice Set 1", "2026-08-30",
    "Using vertical motion, 0 = u sinθ·T − ½gT² ⇒ T = 2u sinθ/g (level ground, g constant).",
    { status: "graded", score: 5, feedback: "<p>Complete and clearly stated, assumptions included.</p>", gradedAt: "2026-09-02", gradedBy: "Ansh Mehra" }),
];

// ---------------------------------------------------------------------
// Earnings seed — paid test-series sales, folded into earningsData's
// ledger by seedEarnings() (same transaction shape as course sales, tagged
// `source: "test_series"`). Only PAID PUBLISHED series sell.
export const TEST_SERIES_SALES_SEED = [
  {
    seriesId: S_JEE.id,
    title: S_JEE.title,
    origin: "own", // Part 6 tags (own | assigned) / (standalone | course) so Revenue can segment later
    scope: "standalone",
    price: 799,
    recent: [
      { buyer: "Aarav Sharma", daysBack: 1 },
      { buyer: "Ishita Verma", daysBack: 3 },
      { buyer: "Karthik Raman", daysBack: 6 },
      { buyer: "Diya Patel", daysBack: 9 },
      { buyer: "Rahul Nair", daysBack: 13 },
      { buyer: "Meher Singh", daysBack: 18 },
      { buyer: "Zoya Khan", daysBack: 24 },
      { buyer: "Kabir Joshi", daysBack: 28 },
    ],
    older: [{ count: 46, monthsBack: 2 }, { count: 62, monthsBack: 3 }, { count: 31, monthsBack: 4 }],
  },
];

