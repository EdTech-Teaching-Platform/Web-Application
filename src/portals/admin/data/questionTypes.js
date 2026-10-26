// Question types for the admin question editor, the series wizard and the
// imports. Values are the types the server accepts (adm_map_question_type):
//   mcq_single, mcq_multi, true_false -> lead multiple_choice / true_false
//   fill_blank                        -> lead fill_in_blank (accepted answer)
//   short_answer, long_answer, subjective -> lead short_answer, manual grading:
//   COMING SOON. The pickers show them disabled, every import rejects them,
//   and the server refuses to create or edit them
//   (20261027090000_admin_block_subjective.sql). Existing ones stay readable.
import { SUBJECTIVE_ENABLED } from "../utils/featureFlags";

export const QTYPE = Object.freeze({
  MCQ_SINGLE: "mcq_single",
  MCQ_MULTI: "mcq_multi",
  TRUE_FALSE: "true_false",
  FILL_BLANK: "fill_blank",
  SHORT_ANSWER: "short_answer",
  LONG_ANSWER: "long_answer",
  SUBJECTIVE: "subjective",
});

export const SUBJECTIVE_BLOCKED_MESSAGE =
  "Short answer, long answer and subjective questions are coming soon. Use MCQ, true / false or fill in the blank.";

const BLOCKED = new Set([QTYPE.SHORT_ANSWER, QTYPE.LONG_ANSWER, QTYPE.SUBJECTIVE]);

export const QUESTION_TYPE_OPTIONS = [
  { value: QTYPE.MCQ_SINGLE, label: "MCQ (single answer)", hint: "Four options, one correct answer." },
  { value: QTYPE.MCQ_MULTI, label: "MCQ (multiple answers)", hint: "Four options, one or more correct. Scored only when every correct option is picked." },
  { value: QTYPE.TRUE_FALSE, label: "True / False", hint: "The student picks True or False." },
  { value: QTYPE.FILL_BLANK, label: "Fill in the blank", hint: "Typed answer, checked against the accepted answer (case and extra spaces ignored)." },
  { value: QTYPE.SHORT_ANSWER, label: "Short answer", hint: "A few words or a sentence, graded by a teacher." },
  { value: QTYPE.LONG_ANSWER, label: "Long answer", hint: "A paragraph or more, graded by a teacher." },
  { value: QTYPE.SUBJECTIVE, label: "Subjective", hint: "Free-form answer graded against a rubric." },
].map((o) => ({ ...o, available: SUBJECTIVE_ENABLED || !BLOCKED.has(o.value) }));

const ALIASES = {
  "": QTYPE.MCQ_SINGLE, objective: QTYPE.MCQ_SINGLE, mcq: QTYPE.MCQ_SINGLE, mcq_single: QTYPE.MCQ_SINGLE,
  single: QTYPE.MCQ_SINGLE, multiple_choice: QTYPE.MCQ_SINGLE,
  mcq_multi: QTYPE.MCQ_MULTI, multi: QTYPE.MCQ_MULTI, multi_select: QTYPE.MCQ_MULTI, multiple_select: QTYPE.MCQ_MULTI, msq: QTYPE.MCQ_MULTI,
  true_false: QTYPE.TRUE_FALSE, truefalse: QTYPE.TRUE_FALSE, tf: QTYPE.TRUE_FALSE, boolean: QTYPE.TRUE_FALSE,
  fill_blank: QTYPE.FILL_BLANK, fill_in_blank: QTYPE.FILL_BLANK, fill_in_the_blank: QTYPE.FILL_BLANK, blank: QTYPE.FILL_BLANK,
  numerical: QTYPE.FILL_BLANK, numeric: QTYPE.FILL_BLANK,
  short_answer: QTYPE.SHORT_ANSWER, short: QTYPE.SHORT_ANSWER,
  long_answer: QTYPE.LONG_ANSWER, long: QTYPE.LONG_ANSWER,
  subjective: QTYPE.SUBJECTIVE, descriptive: QTYPE.SUBJECTIVE, essay: QTYPE.SUBJECTIVE,
};

// Any stored / legacy / CSV spelling -> one of QTYPE, or null when unknown.
export function normalizeQuestionType(type) {
  const key = String(type ?? "").trim().toLowerCase().replace(/[\s/-]+/g, "_");
  return Object.prototype.hasOwnProperty.call(ALIASES, key) ? ALIASES[key] : null;
}

export function isBlockedQuestionType(type) {
  return !SUBJECTIVE_ENABLED && BLOCKED.has(normalizeQuestionType(type));
}

export function isChoiceType(type) {
  const t = normalizeQuestionType(type);
  return t === QTYPE.MCQ_SINGLE || t === QTYPE.MCQ_MULTI || t === QTYPE.TRUE_FALSE;
}

export function questionTypeLabel(type) {
  const t = normalizeQuestionType(type);
  return QUESTION_TYPE_OPTIONS.find((o) => o.value === t)?.label ?? "Unknown type";
}

export const OPTION_KEYS = ["A", "B", "C", "D"];
export const TRUE_FALSE_OPTIONS = [{ key: "A", text: "True" }, { key: "B", text: "False" }];

// A blank question of `type` in the shape both editors use.
export function blankQuestionFields(type = QTYPE.MCQ_SINGLE) {
  return {
    type: normalizeQuestionType(type) ?? QTYPE.MCQ_SINGLE,
    optionA: "", optionB: "", optionC: "", optionD: "",
    correctAnswer: "",
    correctAnswers: [],
    acceptedAnswer: "",
  };
}

// Inline errors for one question draft (editor, wizard, imports).
export function validateQuestionDraft(q) {
  const errors = [];
  const type = normalizeQuestionType(q.type);
  if (!type) errors.push(`Unknown question type "${q.type}".`);
  if (isBlockedQuestionType(type)) errors.push(SUBJECTIVE_BLOCKED_MESSAGE);
  if (!String(q.text ?? "").trim()) errors.push("Question text is required.");
  if (!(Number(q.marks) > 0)) errors.push("Marks must be greater than 0.");
  if (q.negativeMarks !== "" && q.negativeMarks !== undefined && !(Number(q.negativeMarks) >= 0)) {
    errors.push("Negative marks must be 0 or more.");
  }
  if (type === QTYPE.MCQ_SINGLE || type === QTYPE.MCQ_MULTI) {
    if (OPTION_KEYS.some((k) => !String(q[`option${k}`] ?? "").trim())) errors.push("All four options (A–D) are required.");
  }
  if (type === QTYPE.MCQ_SINGLE && !OPTION_KEYS.includes(q.correctAnswer)) errors.push("Select the correct answer.");
  if (type === QTYPE.MCQ_MULTI) {
    const picked = (q.correctAnswers || []).filter((k) => OPTION_KEYS.includes(k));
    if (picked.length === 0) errors.push("Select at least one correct answer.");
  }
  if (type === QTYPE.TRUE_FALSE && !["A", "B"].includes(q.correctAnswer)) errors.push("Choose True or False as the correct answer.");
  if (type === QTYPE.FILL_BLANK && !String(q.acceptedAnswer ?? "").trim()) errors.push("Enter the accepted answer.");
  return errors;
}

// The create / update payload for create_question, update_question and
// upsert_test_series_full (adm_insert_question / adm_insert_options shapes).
export function questionPayload(q) {
  const type = normalizeQuestionType(q.type);
  const base = {
    type,
    text: String(q.text ?? "").trim(),
    image: q.image || "",
    marks: Number(q.marks) || 0,
    negativeMarks: Number(q.negativeMarks) || 0,
    difficulty: q.difficulty || "medium",
    subject: q.subject || "",
    topic: q.topic || "",
    explanation: q.explanation || "",
  };
  if (type === QTYPE.FILL_BLANK) {
    const answer = String(q.acceptedAnswer ?? "").trim();
    return { ...base, options: [], correctAnswer: answer, correctAnswers: [answer] };
  }
  if (type === QTYPE.TRUE_FALSE) {
    return { ...base, options: TRUE_FALSE_OPTIONS, correctAnswer: q.correctAnswer, correctAnswers: [q.correctAnswer] };
  }
  const options = OPTION_KEYS.map((key) => ({ key, text: String(q[`option${key}`] ?? "").trim() }));
  const correct = type === QTYPE.MCQ_MULTI
    ? OPTION_KEYS.filter((k) => (q.correctAnswers || []).includes(k))
    : [q.correctAnswer].filter(Boolean);
  return { ...base, options, correctAnswer: correct[0] || "", correctAnswers: correct };
}

// Splits imported questions into accepted ones and blocked ones with a reason.
export function rejectBlockedQuestions(questions) {
  const accepted = [];
  const rejected = [];
  for (const q of questions || []) {
    if (isBlockedQuestionType(q.type)) rejected.push({ question: q, reason: SUBJECTIVE_BLOCKED_MESSAGE });
    else accepted.push(q);
  }
  return { accepted, rejected };
}
