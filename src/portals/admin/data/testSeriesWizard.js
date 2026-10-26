// Test Series creation wizard — constants, CSV import validation,
// template-based outline generator and wizard validation.
//
// Honesty notes (same stance as aiTestBuilderMock.js):
//  - The "AI-assisted outline" is a deterministic template generator. It
//    produces an outline only (test names, topics, counts) — never questions —
//    and the UI says no external AI is connected.

import { DIFFICULTY, PRICING_TYPE, validateSeriesForPublish } from "./testSeriesMock";
import {
  QTYPE, QUESTION_TYPE_OPTIONS, SUBJECTIVE_BLOCKED_MESSAGE, blankQuestionFields, isBlockedQuestionType, normalizeQuestionType,
  questionTypeLabel, validateQuestionDraft,
} from "./questionTypes";
import { TOPIC_POOL } from "./aiTestBuilderMock";

// Every series is standalone ("My own"): no link to any course.
export const SERIES_TYPE = { OWN: "own" };
export const START_METHOD = { SCRATCH: "scratch", DUPLICATE: "duplicate", CSV: "csv", AI: "ai" };

export const GRADE_OPTIONS = [
  "Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12",
  "College / University", "Competitive Exams", "Other",
];
export const CLASS_SUBJECT_OPTIONS = [
  "Mathematics", "Physics", "Chemistry", "Biology", "English", "Computer Science", "Social Science", "Other",
];
export const EXAM_OPTIONS = [
  "School Exams", "Board Exams", "Entrance Exams", "Competitive Exams", "University Exams", "Skill Tests",
];
export const LEVEL_OPTIONS = ["Beginner", "Intermediate", "Advanced"];
export const BASE_LANGUAGES = ["English", "Hindi", "Tamil", "Telugu", "Bengali", "Marathi", "Gujarati", "Kannada"];

let _n = 0;
export function wid(prefix) {
  _n += 1;
  return `${prefix}-${Date.now().toString(36)}${_n}`;
}

export function normalizeText(s) {
  return String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}
export function questionKey(q) {
  return normalizeText(q && q.text);
}

// type: one of QTYPE (data/questionTypes.js). Legacy drafts used
// "objective" / "subjective"; normalizeQuestionType maps them.
export function emptyQuestion(type = QTYPE.MCQ_SINGLE, defaults = {}) {
  const t = normalizeQuestionType(type) ?? QTYPE.MCQ_SINGLE;
  return {
    wid: wid("wq"),
    ...blankQuestionFields(t),
    text: "",
    answerInstructions: "",
    rubric: "",
    image: "",
    marks: 4,
    negativeMarks: t === QTYPE.MCQ_SINGLE || t === QTYPE.MCQ_MULTI ? 1 : 0,
    difficulty: DIFFICULTY.MEDIUM,
    subject: "",
    topic: "",
    explanation: "",
    ...defaults,
  };
}

// Wizard-local copy of a question from anywhere (bank / duplicated series / CSV).
export function cloneQuestion(q) {
  const { id, bankId, key, source, ...rest } = q;
  return normalizeWizardQuestion({ ...emptyQuestion(q.type), ...rest, wid: wid("wq") });
}

// Brings a saved / legacy wizard question onto the current type model.
export function normalizeWizardQuestion(q) {
  const type = normalizeQuestionType(q.type) ?? QTYPE.MCQ_SINGLE;
  const correctAnswers = Array.isArray(q.correctAnswers) && q.correctAnswers.length
    ? q.correctAnswers
    : q.correctAnswer ? [q.correctAnswer] : [];
  return { ...blankQuestionFields(type), ...q, type, correctAnswers, acceptedAnswer: q.acceptedAnswer || "" };
}

export function normalizeWizardState(state) {
  return { ...state, tests: (state.tests || []).map((t) => ({ ...t, questions: (t.questions || []).map(normalizeWizardQuestion) })) };
}

export function blockedQuestionCount(tests) {
  return (tests || []).reduce((n, t) => n + (t.questions || []).filter((q) => isBlockedQuestionType(q.type)).length, 0);
}

export function emptyTest(name = "") {
  return {
    wid: wid("wt"),
    name,
    instructions: "",
    duration: 60,
    passingPercent: 40,
    attemptLimit: 1,
    window: { mode: "inherit", openAt: "", closeAt: "" },
    plannedQuestions: 0,
    topics: [],
    questions: [],
  };
}

export function testTotalMarks(t) {
  return (t.questions || []).reduce((sum, q) => sum + (Number(q.marks) || 0), 0);
}

export function initialWizardState() {
  return {
    seriesType: SERIES_TYPE.OWN,
    startMethod: "",
    sourceSeriesId: "",
    name: "",
    about: "",
    whoFor: "",
    audience: "",
    pricing: PRICING_TYPE.FREE,
    price: "",
    syllabus: "",
    classification: { grade: "", subject: "", exam: "", difficulty: "", languages: [] },
    buildDeadline: "",
    availability: { goLive: "now", goLiveAt: "", mode: "always", openAt: "", closeAt: "", monthlyLimited: false, monthlyLimit: 5, accessLimited: false, accessDays: 90 },
    lateSubmissions: { allowed: false, graceMinutes: 10 },
    tests: [],
  };
}

// ---------------------------------------------------------------- CSV import

export const CSV_COLUMNS = ["question", "optionA", "optionB", "optionC", "optionD", "correct", "marks", "negative", "type", "difficulty", "subject", "topic", "explanation"];
// type: mcq (one correct letter), mcq_multi (letters joined with | e.g. A|C),
// true_false (True / False, or A / B), fill_blank (the accepted answer in
// "correct"). short_answer / long_answer / subjective rows are rejected (coming soon).
export const CSV_TEMPLATE = [
  CSV_COLUMNS.join(","),
  '"A body moving with uniform velocity has:","Zero acceleration","Uniform acceleration","Increasing acceleration","Decreasing acceleration",A,4,1,mcq,easy,Physics,Kinematics,"Uniform velocity means no change in speed or direction."',
  '"Which of these are vector quantities?","Velocity","Speed","Force","Mass",A|C,4,1,mcq_multi,medium,Physics,Vectors,',
  '"Light travels faster than sound.",,,,,True,2,0,true_false,easy,Physics,Waves,',
  '"The SI unit of force is the ____.",,,,,newton,2,0,fill_blank,easy,Physics,Units,',
].join("\n");

export function parseCsv(text) {
  const s = String(text || "").replace(/^﻿/, "");
  const rows = [];
  let row = [];
  let cur = "";
  let inQ = false;
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQ) {
      if (c === '"') {
        if (s[i + 1] === '"') { cur += '"'; i++; } else inQ = false;
      } else cur += c;
    } else if (c === '"') inQ = true;
    else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && s[i + 1] === "\n") i++;
      row.push(cur); cur = "";
      rows.push(row); row = [];
    } else cur += c;
  }
  if (cur !== "" || row.length) { row.push(cur); rows.push(row); }
  return rows.filter((r) => r.some((c) => String(c).trim() !== ""));
}

const HEADER_ALIASES = {
  question: "question", text: "question", questiontext: "question",
  optiona: "optionA", a: "optionA", optionb: "optionB", b: "optionB",
  optionc: "optionC", c: "optionC", optiond: "optionD", d: "optionD",
  correct: "correct", answer: "correct", correctanswer: "correct", correctoption: "correct",
  marks: "marks", mark: "marks", negative: "negative", negativemarks: "negative",
  type: "type", questiontype: "type", difficulty: "difficulty", level: "difficulty",
  subject: "subject", topic: "topic", explanation: "explanation", solution: "explanation",
};

// Returns { rows, error } — rows are editable plain objects keyed by CSV_COLUMNS.
export function csvToRows(text) {
  const table = parseCsv(text);
  if (table.length === 0) return { rows: [], error: "The file is empty." };
  const header = table[0].map((h) => HEADER_ALIASES[String(h).toLowerCase().replace(/[^a-z]/g, "")] || null);
  if (!header.includes("question")) return { rows: [], error: 'No "question" column found in the header row. Download the template to see the expected columns.' };
  const rows = table.slice(1).map((cells, idx) => {
    const r = { _id: wid("csv"), line: idx + 2 };
    CSV_COLUMNS.forEach((c) => { r[c] = ""; });
    header.forEach((key, i) => { if (key) r[key] = String(cells[i] ?? "").trim(); });
    return r;
  });
  return { rows, error: rows.length === 0 ? "The file has a header but no question rows." : "" };
}

export const ROW_STATUS = { VALID: "valid", INVALID: "invalid", INCOMPLETE: "incomplete", DUPLICATE: "duplicate" };

function toType(v) {
  return normalizeQuestionType(v);
}

// "A|C", "A;C", "A C", "AC" -> ["A", "C"]
function letters(v) {
  return [...new Set(String(v || "").toUpperCase().replace(/[^A-D]/g, "").split(""))].sort();
}
function trueFalseKey(v) {
  const t = String(v || "").trim().toLowerCase();
  if (t === "true" || t === "t" || t === "a") return "A";
  if (t === "false" || t === "f" || t === "b") return "B";
  return "";
}
function toDifficulty(v) {
  const d = String(v || "").trim().toLowerCase();
  if (!d) return DIFFICULTY.MEDIUM;
  return Object.values(DIFFICULTY).includes(d) ? d : null;
}

// existingKeys: Set of normalized question texts already in the series.
export function validateCsvRows(rows, existingKeys) {
  const seen = new Map(); // key -> first line
  return rows.map((r) => {
    const incomplete = [];
    const invalid = [];
    const type = toType(r.type);
    const blocked = type && isBlockedQuestionType(type);
    if (!type) invalid.push(`Unknown question type "${r.type}" (use mcq, mcq_multi, true_false or fill_blank).`);
    else if (blocked) invalid.push(`Row type "${r.type}" is not supported yet. ${SUBJECTIVE_BLOCKED_MESSAGE}`);
    if (!r.question) incomplete.push("Question text is missing.");
    if (!blocked && (type === QTYPE.MCQ_SINGLE || type === QTYPE.MCQ_MULTI)) {
      ["optionA", "optionB", "optionC", "optionD"].forEach((k) => { if (!r[k]) incomplete.push(`${k.replace("option", "Option ")} is missing.`); });
      if (!r.correct) incomplete.push("Correct answer is missing.");
      else if (type === QTYPE.MCQ_SINGLE && !/^[A-D]$/i.test(r.correct)) invalid.push(`Correct answer "${r.correct}" must be A, B, C or D.`);
      else if (type === QTYPE.MCQ_MULTI && (letters(r.correct).length === 0 || /[^A-D|;,\s]/i.test(r.correct))) {
        invalid.push(`Correct answers "${r.correct}" must be letters A–D, e.g. A|C.`);
      }
    }
    if (type === QTYPE.TRUE_FALSE) {
      if (!r.correct) incomplete.push("Correct answer is missing (True or False).");
      else if (!trueFalseKey(r.correct)) invalid.push(`Correct answer "${r.correct}" must be True or False.`);
    }
    if (type === QTYPE.FILL_BLANK && !r.correct) incomplete.push("Accepted answer is missing (put it in the correct column).");
    if (r.marks !== "" && !(Number(r.marks) > 0)) invalid.push(`Marks "${r.marks}" must be a positive number.`);
    if (r.negative !== "" && !(Number(r.negative) >= 0)) invalid.push(`Negative marks "${r.negative}" must be 0 or more.`);
    if (toDifficulty(r.difficulty) === null) invalid.push(`Difficulty "${r.difficulty}" must be easy, medium or hard.`);

    let status = ROW_STATUS.VALID;
    let issues = [];
    if (incomplete.length) { status = ROW_STATUS.INCOMPLETE; issues = [...incomplete, ...invalid]; }
    else if (invalid.length) { status = ROW_STATUS.INVALID; issues = invalid; }
    else {
      const key = normalizeText(r.question);
      if (existingKeys && existingKeys.has(key)) { status = ROW_STATUS.DUPLICATE; issues = ["This question is already in the series."]; }
      else if (seen.has(key)) { status = ROW_STATUS.DUPLICATE; issues = [`Same question as row ${seen.get(key)} of this file.`]; }
      else seen.set(key, r.line);
    }
    let question = null;
    if (status === ROW_STATUS.VALID) {
      const isMcq = type === QTYPE.MCQ_SINGLE || type === QTYPE.MCQ_MULTI;
      const keys = type === QTYPE.MCQ_MULTI ? letters(r.correct)
        : type === QTYPE.MCQ_SINGLE ? [r.correct.toUpperCase()]
        : type === QTYPE.TRUE_FALSE ? [trueFalseKey(r.correct)] : [];
      question = emptyQuestion(type, {
        text: r.question,
        optionA: isMcq ? r.optionA : "", optionB: isMcq ? r.optionB : "", optionC: isMcq ? r.optionC : "", optionD: isMcq ? r.optionD : "",
        correctAnswer: keys[0] || "",
        correctAnswers: keys,
        acceptedAnswer: type === QTYPE.FILL_BLANK ? r.correct : "",
        marks: r.marks !== "" ? Number(r.marks) : 4,
        negativeMarks: r.negative !== "" ? Number(r.negative) : isMcq ? 1 : 0,
        difficulty: toDifficulty(r.difficulty),
        subject: r.subject, topic: r.topic, explanation: r.explanation,
      });
    }
    return { ...r, status, issues, question };
  });
}

// ---------------------------------------------------------- Outline generator

// Only the available question types (subjective ones are coming soon).
export const OUTLINE_TYPES = QUESTION_TYPE_OPTIONS.filter((o) => o.available).map((o) => ({ value: o.value, label: o.label }));
export const OUTLINE_DIFFICULTY = ["Easy", "Medium", "Hard", "Mixed"];

export function topicSuggestions(subject) {
  return TOPIC_POOL[subject] || [];
}

// Deterministic template outline: spreads the chosen topics over N tests.
// `seed` rotates the topic order so "Regenerate" gives a different split.
export function generateOutline(cfg, seed = 0) {
  const numTests = Math.max(1, Math.min(30, Number(cfg.numTests) || 1));
  const perTest = Math.max(1, Math.min(200, Number(cfg.questionsPerTest) || 10));
  const baseTopics = cfg.topics && cfg.topics.length ? cfg.topics : topicSuggestions(cfg.subject);
  const topics = baseTopics.length ? baseTopics : ["General"];
  const rot = topics.length ? seed % topics.length : 0;
  const ordered = [...topics.slice(rot), ...topics.slice(0, rot)];
  const types = (cfg.types || []).filter((t) => !isBlockedQuestionType(t)).length
    ? cfg.types.filter((t) => !isBlockedQuestionType(t))
    : [QTYPE.MCQ_SINGLE];
  const perChunk = Math.max(1, Math.ceil(ordered.length / numTests));
  const out = [];
  for (let i = 0; i < numTests; i++) {
    const chunk = ordered.length >= numTests
      ? ordered.slice(i * perChunk, i * perChunk + perChunk)
      : [ordered[i % ordered.length]];
    const tps = chunk.length ? chunk : [ordered[i % ordered.length]];
    const sections = types.map((type, ti) => ({
      type,
      count: Math.floor(perTest / types.length) + (ti < perTest % types.length ? 1 : 0),
    })).filter((x) => x.count > 0);
    out.push({
      id: wid("ol"),
      name: numTests === 1 ? `${cfg.subject || "Full"} Test` : `${cfg.subject ? cfg.subject + " " : ""}Test ${i + 1} — ${tps.join(", ")}`,
      topics: tps,
      questionCount: perTest,
      marksPerQuestion: Number(cfg.marksPerQuestion) || 4,
      duration: Number(cfg.duration) || Math.max(15, perTest * 2),
      difficulty: cfg.difficulty || "Mixed",
      sections,
    });
  }
  return out;
}

// -------------------------------------------------------------- Test type

export function derivedTestType(tests) {
  if (!tests.length) return "—";
  const qs = tests.flatMap((t) => t.questions);
  const kinds = [...new Set(qs.map((q) => questionTypeLabel(q.type)))];
  const mix = kinds.length === 0 ? "no questions yet" : kinds.join(" + ");
  return `${tests.length === 1 ? "Single test" : `Multi-test series (${tests.length} tests)`} · ${mix}`;
}

// ------------------------------------------------------------- Validation

// Options / correct answer / accepted answer incomplete (subjective ones are
// counted separately as blocked).
function missingAnswer(q) {
  if (isBlockedQuestionType(q.type)) return false;
  return validateQuestionDraft({ ...q, text: q.text || "x", marks: q.marks || 1 }).length > 0;
}

export function stripHtml(html) {
  return String(html || "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function isFuture(dt) {
  return dt && new Date(dt).getTime() > Date.now();
}

// Errors for one step (used to gate "Continue"). Returns string[].
export function stepErrors(step, st, ctx) {
  const e = [];
  const c = st.classification;
  const a = st.availability;
  switch (step) {
    case "method":
      if (!st.startMethod) e.push("Choose how you would like to start.");
      break;
    case "source":
      if (st.startMethod === START_METHOD.DUPLICATE && !st.sourceSeriesId) e.push("Pick the series you want to duplicate.");
      else if (st.startMethod !== START_METHOD.DUPLICATE && st.tests.length === 0) {
        e.push(st.startMethod === START_METHOD.CSV ? "Import at least one valid row, or go back and choose another method."
          : "Apply an outline to create the tests, or go back and choose another method.");
      }
      break;
    case "details":
      if (!st.name.trim()) e.push("Series name is required.");
      if (!st.audience) e.push("Target audience is required.");
      if (st.pricing === PRICING_TYPE.PAID && !(Number(st.price) > 0)) e.push("Enter a valid price for a paid series.");
      break;
    case "structure":
      if (st.tests.length === 0) e.push("Add at least one test.");
      st.tests.forEach((t, i) => {
        if (!t.name.trim()) e.push(`Test ${i + 1} needs a name.`);
        if (!(Number(t.duration) > 0)) e.push(`${t.name || `Test ${i + 1}`} needs a duration above 0.`);
      });
      break;
    case "classification":
      if (!c.grade) e.push("Class / Grade is required.");
      if (!c.subject) e.push("Subject is required.");
      if (!c.exam) e.push("Exam / Goal is required.");
      if (!c.difficulty) e.push("Difficulty level is required.");
      if (c.languages.length === 0) e.push("Select at least one language.");
      break;
    case "availability":
      if (a.goLive === "schedule") {
        if (!a.goLiveAt) e.push("Choose the go-live date and time.");
        else if (!isFuture(a.goLiveAt)) e.push("Go-live must be in the future.");
      }
      if (a.monthlyLimited && !(Number.isInteger(Number(a.monthlyLimit)) && Number(a.monthlyLimit) >= 1)) e.push("Monthly access limit must be a whole number of 1 or more.");
      if (a.accessLimited && !(Number.isInteger(Number(a.accessDays)) && Number(a.accessDays) >= 1)) e.push("Access duration must be a whole number of days, 1 or more.");
      if (a.mode === "window") {
        if (!a.openAt || !a.closeAt) e.push("Set both the open and close dates.");
        else if (a.openAt > a.closeAt) e.push("The open date must be before the close date.");
      }
      st.tests.forEach((t, i) => {
        if (t.window.mode !== "custom") return;
        const label = t.name || `Test ${i + 1}`;
        if (!t.window.openAt || !t.window.closeAt) e.push(`${label}: set both window times or switch to "Inherit".`);
        else if (t.window.openAt >= t.window.closeAt) e.push(`${label}: window must open before it closes.`);
        else if (a.mode === "window" && (t.window.openAt.slice(0, 10) < a.openAt || t.window.closeAt.slice(0, 10) > a.closeAt)) e.push(`${label}: window must fall inside the series window.`);
      });
      if (st.lateSubmissions.allowed && !(Number(st.lateSubmissions.graceMinutes) > 0)) e.push("Enter a grace period in minutes for late submissions.");
      break;
    default:
  }
  return e;
}

export const STEP_ORDER = ["method", "source", "details", "structure", "classification", "availability", "review"];

export function applicableSteps(st) {
  return STEP_ORDER.filter((s) => s !== "source" || (st.startMethod && st.startMethod !== START_METHOD.SCRATCH));
}

// Full review: checks[] (label/ok/detail), errors[] block publishing,
// warnings[] don't. draftErrors[] are the minimum to save a draft.
export function validateWizard(st, ctx) {
  const errors = [];
  const warnings = [];
  const draftErrors = [];
  if (!st.name.trim()) draftErrors.push("Series name is required.");

  ["details", "classification", "availability"].forEach((s) => errors.push(...stepErrors(s, st, ctx)));
  errors.push(...stepErrors("structure", st, ctx));
  if (!st.startMethod) errors.push("Choose a starting method.");

  let dupCount = 0;
  let missing = 0;
  const seen = new Set();
  st.tests.forEach((t) => {
    if (t.questions.length === 0) errors.push(`${t.name || "A test"} has no questions.`);
    t.questions.forEach((q) => {
      const k = questionKey(q);
      if (!q.text.trim()) errors.push(`${t.name || "A test"} has a question with no text.`);
      if (k && seen.has(k)) dupCount += 1; else if (k) seen.add(k);
      if (missingAnswer(q)) missing += 1;
    });
  });
  if (missing) errors.push(`${missing} question${missing === 1 ? " is" : "s are"} missing options or a correct answer.`);
  const blocked = blockedQuestionCount(st.tests);
  if (blocked) {
    const msg = `Remove the ${blocked} short / long / subjective question${blocked === 1 ? "" : "s"}: ${SUBJECTIVE_BLOCKED_MESSAGE}`;
    errors.push(msg);
    draftErrors.push(msg);
  }
  if (dupCount) warnings.push(`${dupCount} duplicate question${dupCount === 1 ? "" : "s"} found across the series.`);
  // ctx.nameTaken: the server's answer (series_name_exists); existingSeries: a loaded list, if any.
  const nameClash = !!ctx.nameTaken || (ctx.existingSeries || []).some((s) => s.name.trim().toLowerCase() === st.name.trim().toLowerCase());
  if (st.name.trim() && nameClash) warnings.push("Another series already uses this name.");
  if (st.buildDeadline && st.buildDeadline < new Date().toISOString().slice(0, 10)) warnings.push("The build deadline has already passed.");

  const hasQ = st.tests.some((t) => t.questions.length);
  const checks = [
    { label: "Name & audience", ok: !!st.name.trim() && !!st.audience, detail: st.name.trim() ? st.audience || "Audience missing" : "Name missing" },
    { label: "Tests & questions", ok: st.tests.length > 0 && st.tests.every((t) => t.questions.length > 0), detail: `${st.tests.length} test${st.tests.length === 1 ? "" : "s"}, ${st.tests.reduce((n, t) => n + t.questions.length, 0)} questions` },
    { label: "Answers complete", ok: hasQ && missing === 0, detail: missing ? `${missing} incomplete` : hasQ ? "All set" : "No questions" },
    { label: "Duplicate check", ok: dupCount === 0, detail: dupCount ? `${dupCount} duplicate` : "None found" },
    { label: "Classification", ok: stepErrors("classification", st, ctx).length === 0, detail: "Grade, subject, exam, level, language" },
    { label: "Pricing", ok: !(st.pricing === PRICING_TYPE.PAID && !(Number(st.price) > 0)), detail: st.pricing === PRICING_TYPE.PAID ? (Number(st.price) > 0 ? `Paid · ₹${Number(st.price)}` : "Price missing") : "Free" },
    { label: "Availability", ok: stepErrors("availability", st, ctx).length === 0, detail: "Go-live, window, per-test windows" },
  ];
  return { errors: [...new Set(errors)], warnings, draftErrors, checks };
}

// --------------------------------------------------------------- Payload

export function buildSeriesPayload(st, ctx, publish) {
  const today = new Date().toISOString().slice(0, 10);
  const a = st.availability;
  const scheduled = publish && a.goLive === "schedule";
  const goLiveDate = a.goLiveAt ? a.goLiveAt.slice(0, 10) : today;
  const always = a.mode === "always";
  const status = publish ? (scheduled ? "scheduled" : "published") : "draft";
  const pricing = st.pricing;
  return {
    name: st.name.trim(),
    description: stripHtml(st.about),
    about: st.about,
    whoFor: st.whoFor,
    subject: st.classification.subject,
    audience: st.audience,
    pricing,
    price: pricing === PRICING_TYPE.PAID ? Number(st.price) : 0,
    status,
    startDate: always ? (scheduled ? goLiveDate : today) : a.openAt,
    endDate: always ? "" : a.closeAt,
    seriesType: SERIES_TYPE.OWN,
    syllabus: st.syllabus,
    startMethod: st.startMethod,
    classification: { ...st.classification },
    buildDeadline: st.buildDeadline,
    availability: { mode: a.mode, monthlyLimit: a.monthlyLimited ? Number(a.monthlyLimit) : null, accessDays: a.accessLimited ? Number(a.accessDays) : null },
    goLiveAt: scheduled ? a.goLiveAt : "",
    lateSubmissions: { ...st.lateSubmissions },
    tests: st.tests.map((t) => {
      const total = testTotalMarks(t);
      const published = status === "published";
      return {
        name: t.name.trim(),
        instructions: t.instructions,
        duration: Number(t.duration),
        totalMarks: total,
        passingMarks: Math.round((total * (Number(t.passingPercent) || 0)) / 100),
        attemptLimit: Number(t.attemptLimit) || 1,
        scheduledAt: t.window.mode === "custom" ? t.window.openAt : "",
        window: { ...t.window },
        status: published ? "published" : "draft",
        questions: t.questions.map(({ wid: _w, ...q }) => q),
      };
    }),
  };
}

export function finalPublishCheck(payload) {
  return validateSeriesForPublish(payload);
}
