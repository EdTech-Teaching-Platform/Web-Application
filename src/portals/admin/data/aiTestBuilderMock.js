// AI Question Generator / Test Builder — mock "AI" engine.
//
// This app has no backend and no live API keys anywhere (every other
// "smart" feature — Reports, Payments, Regional Growth — is realistic
// client-side mock data; see reportsMock.js / paymentsMock.js for the
// same pattern). A real model call would need a backend proxy to hold a
// key safely, which doesn't exist here, so this module plays that role:
// a deterministic, template-driven generator (genuinely produces varied,
// structurally complete tests from the admin's parameters) and a real
// regex-based parser for the "paste a question paper" flow (actually
// reads the pasted text — it does not fabricate content, and explicitly
// flags anything it couldn't confidently extract).
//
// Output here is intentionally its own richer shape (sections, 5 question
// types, per-question marks/negative-marking) — the existing Test Series
// data model (testSeriesMock.js) only has a flat questions[] per test with
// two types (objective/subjective). AITestBuilder.jsx is responsible for
// flattening a generated/parsed test into that existing shape when the
// admin chooses to save it as a real Test Series — nothing here touches
// testSeriesMock.js itself.

export const AI_QUESTION_TYPE = {
  MCQ: "mcq",
  MULTI_SELECT: "multi_select",
  TRUE_FALSE: "true_false",
  SHORT_ANSWER: "short_answer",
  LONG_ANSWER: "long_answer",
};
export const AI_QUESTION_TYPE_LABEL = {
  [AI_QUESTION_TYPE.MCQ]: "MCQ",
  [AI_QUESTION_TYPE.MULTI_SELECT]: "Multiple Select",
  [AI_QUESTION_TYPE.TRUE_FALSE]: "True / False",
  [AI_QUESTION_TYPE.SHORT_ANSWER]: "Short Answer",
  [AI_QUESTION_TYPE.LONG_ANSWER]: "Long Answer",
};
export const AI_QUESTION_TYPE_OPTIONS = Object.values(AI_QUESTION_TYPE);

export const EXAM_TYPE_OPTIONS = ["JEE", "NEET", "CBSE Board", "ICSE Board", "Bank PO", "SSC", "UPSC", "General / Custom"];
export const DIFFICULTY_OPTIONS = ["Easy", "Medium", "Hard", "Mixed"];
export const LANGUAGE_OPTIONS = ["English", "Hindi", "Bilingual (English + Hindi)"];

export const GENERATION_MODE = {
  FULL: "full",
  STRUCTURE_ONLY: "structure_only",
  QUESTIONS_FOR_STRUCTURE: "questions_for_structure",
};
export const GENERATION_MODE_OPTIONS = [
  { value: GENERATION_MODE.FULL, label: "Generate complete test structure and questions" },
  { value: GENERATION_MODE.STRUCTURE_ONLY, label: "Generate only the test structure" },
  { value: GENERATION_MODE.QUESTIONS_FOR_STRUCTURE, label: "Generate questions for an existing structure" },
];

export const TOPIC_POOL = {
  Physics: ["Kinematics", "Laws of Motion", "Work, Energy & Power", "Thermodynamics", "Electrostatics", "Current Electricity", "Optics", "Modern Physics"],
  Chemistry: ["Atomic Structure", "Chemical Bonding", "Thermochemistry", "Equilibrium", "Organic Reaction Mechanisms", "Periodic Table Trends", "Electrochemistry"],
  Mathematics: ["Algebra", "Trigonometry", "Calculus", "Coordinate Geometry", "Probability", "Matrices & Determinants", "Sequences & Series"],
  Biology: ["Cell Biology", "Genetics", "Human Physiology", "Plant Physiology", "Ecology", "Evolution", "Biotechnology"],
  "Computer Science": ["Data Structures", "Algorithms", "DBMS", "Operating Systems", "Computer Networks", "OOP Concepts"],
  "Reasoning & Aptitude": ["Number Series", "Blood Relations", "Syllogisms", "Data Interpretation", "Time & Work", "Profit & Loss"],
  "General Knowledge": ["Indian History", "Geography", "Current Affairs", "Polity", "Economy", "Science & Technology"],
  English: ["Reading Comprehension", "Grammar", "Vocabulary", "Para Jumbles", "Error Spotting"],
};
export const DEFAULT_TOPICS = ["General"];

let idSeq = 1;
function nextAiId(prefix) {
  idSeq += 1;
  return `${prefix}-${idSeq}`;
}
function hashIndex(str, mod) {
  let h = 0;
  const s = String(str);
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return mod > 0 ? h % mod : 0;
}
function pickFrom(arr, seed) {
  if (!arr || arr.length === 0) return "";
  return arr[hashIndex(seed, arr.length)];
}

// ---------- template-driven question generation (the "AI") ----------

const MCQ_STEMS = [
  (topic) => `Which of the following statements about ${topic} is correct?`,
  (topic) => `In the context of ${topic}, which option best applies?`,
  (topic) => `Identify the correct relationship associated with ${topic}.`,
  (topic) => `Which of the following is NOT typically associated with ${topic}?`,
  (topic) => `A standard exam question on ${topic} would most likely test which concept below?`,
];
const MCQ_OPTION_FRAMES = [
  (topic) => `It directly determines the core behaviour of ${topic}.`,
  (topic) => `It is an unrelated concept outside the scope of ${topic}.`,
  (topic) => `It only applies under special/idealised conditions for ${topic}.`,
  (topic) => `It is the standard textbook definition used for ${topic}.`,
];

function genMCQ({ topic, subject, difficulty, marks, negativeMarks, index }) {
  const stem = pickFrom(MCQ_STEMS, `${index}-stem`)(topic);
  const correctIdx = hashIndex(`${index}-correct`, 4);
  const options = ["A", "B", "C", "D"].map((label, i) => ({
    key: label,
    text: MCQ_OPTION_FRAMES[(i + hashIndex(index, 4)) % MCQ_OPTION_FRAMES.length](topic),
  }));
  return {
    id: nextAiId("AIQ"),
    type: AI_QUESTION_TYPE.MCQ,
    text: stem,
    options,
    correctAnswer: options[correctIdx].key,
    marks,
    negativeMarks: negativeMarks || 0,
    difficulty,
    subject,
    topic,
    explanation: `Reviews the core definition/behaviour of ${topic} expected at ${difficulty.toLowerCase()} level.`,
    issues: [],
  };
}

function genMultiSelect({ topic, subject, difficulty, marks, negativeMarks, index }) {
  const options = ["A", "B", "C", "D"].map((label, i) => ({
    key: label,
    text: MCQ_OPTION_FRAMES[(i + hashIndex(index + "ms", 4)) % MCQ_OPTION_FRAMES.length](topic),
  }));
  const correctCount = 2 + (hashIndex(index, 2));
  const correct = [];
  for (let i = 0; i < options.length && correct.length < correctCount; i++) {
    if (hashIndex(`${index}-${i}`, 2) === 0 || correct.length < 2 - (options.length - 1 - i)) correct.push(options[i].key);
  }
  return {
    id: nextAiId("AIQ"),
    type: AI_QUESTION_TYPE.MULTI_SELECT,
    text: `Select ALL statements that correctly describe ${topic}.`,
    options,
    correctAnswers: correct.length ? correct : [options[0].key],
    marks,
    negativeMarks: negativeMarks || 0,
    difficulty,
    subject,
    topic,
    explanation: `More than one option can be true for ${topic}; partial credit rules follow the test's marking scheme.`,
    issues: [],
  };
}

function genTrueFalse({ topic, subject, difficulty, marks, negativeMarks, index }) {
  const isTrue = hashIndex(index, 2) === 0;
  return {
    id: nextAiId("AIQ"),
    type: AI_QUESTION_TYPE.TRUE_FALSE,
    text: `True or False: ${topic} behaves consistently with the standard model taught at the ${difficulty.toLowerCase()} level.`,
    options: [{ key: "True", text: "True" }, { key: "False", text: "False" }],
    correctAnswer: isTrue ? "True" : "False",
    marks,
    negativeMarks: negativeMarks || 0,
    difficulty,
    subject,
    topic,
    explanation: `Statement is ${isTrue ? "true" : "false"} based on the standard treatment of ${topic}.`,
    issues: [],
  };
}

function genShortAnswer({ topic, subject, difficulty, marks, index }) {
  return {
    id: nextAiId("AIQ"),
    type: AI_QUESTION_TYPE.SHORT_ANSWER,
    text: `In 2-3 sentences, briefly explain the key concept behind ${topic}.`,
    answerInstructions: "Expect a concise, 2-3 sentence response identifying the core idea and one supporting detail.",
    marks,
    difficulty,
    subject,
    topic,
    rubric: `Full marks for a correct, concise explanation of ${topic}; partial credit for a partially correct answer.`,
    issues: [],
  };
}

function genLongAnswer({ topic, subject, difficulty, marks, index }) {
  return {
    id: nextAiId("AIQ"),
    type: AI_QUESTION_TYPE.LONG_ANSWER,
    text: `Discuss ${topic} in detail, including its significance and at least one real-world or exam-relevant application.`,
    answerInstructions: "Expect a structured, multi-paragraph answer covering definition, mechanism/derivation (where applicable), and application.",
    marks,
    difficulty,
    subject,
    topic,
    rubric: `Marks allocated across: definition/setup, core explanation or derivation, and application/example for ${topic}.`,
    issues: [],
  };
}

const GENERATORS = {
  [AI_QUESTION_TYPE.MCQ]: genMCQ,
  [AI_QUESTION_TYPE.MULTI_SELECT]: genMultiSelect,
  [AI_QUESTION_TYPE.TRUE_FALSE]: genTrueFalse,
  [AI_QUESTION_TYPE.SHORT_ANSWER]: genShortAnswer,
  [AI_QUESTION_TYPE.LONG_ANSWER]: genLongAnswer,
};

function resolveDifficulty(difficulty, index) {
  if (!difficulty || difficulty === "Mixed") return pickFrom(["Easy", "Medium", "Hard"], `diff-${index}`);
  return difficulty;
}

// ---------- structure + question generation entry points ----------

// Evenly distributes question/marks counts across N sections (remainder
// going to the earliest sections), respecting any question types the
// admin picked. This is "the structure" — section shells with no
// questions filled in yet.
export function generateTestStructure(config) {
  const sectionCount = Math.max(1, Math.min(10, Number(config.numSections) || 1));
  const totalQuestions = Math.max(sectionCount, Number(config.numQuestions) || sectionCount * 5);
  const totalMarks = Number(config.totalMarks) || totalQuestions * 4;
  const baseQ = Math.floor(totalQuestions / sectionCount);
  const remainderQ = totalQuestions - baseQ * sectionCount;
  const marksPerQ = Math.round((totalMarks / totalQuestions) * 100) / 100;
  const types = config.questionTypes && config.questionTypes.length ? config.questionTypes : [AI_QUESTION_TYPE.MCQ];

  const sections = [];
  for (let i = 0; i < sectionCount; i++) {
    const questionCount = baseQ + (i < remainderQ ? 1 : 0);
    sections.push({
      id: nextAiId("SEC"),
      name: sectionCount === 1 ? "Section A" : `Section ${String.fromCharCode(65 + i)}`,
      instructions: `Answer all ${questionCount} question${questionCount === 1 ? "" : "s"} in this section.`,
      questionCount,
      marksPerQuestion: marksPerQ,
      totalMarks: Math.round(questionCount * marksPerQ * 100) / 100,
      questionTypes: types,
      questions: [],
    });
  }
  return { sections };
}

// Fills every section's questions[] according to its own questionCount /
// marksPerQuestion / questionTypes — works whether the structure was just
// generated above, or is one the admin has hand-edited first (the
// "questions for an existing structure" mode).
export function generateQuestionsForStructure(config, structure) {
  let qIndex = 0;
  const negMarks = config.negativeMarking ? Number(config.negativeMarkValue) || 1 : 0;
  const topics = config.topics && config.topics.length ? config.topics : (TOPIC_POOL[config.subject] || DEFAULT_TOPICS);

  const sections = structure.sections.map((sec) => {
    const count = Math.max(0, Number(sec.questionCount) || 0);
    const marksPerQuestion = Number(sec.marksPerQuestion) || 1;
    const types = sec.questionTypes && sec.questionTypes.length ? sec.questionTypes : [AI_QUESTION_TYPE.MCQ];
    const questions = [];
    for (let i = 0; i < count; i++) {
      qIndex += 1;
      const type = types[hashIndex(`${sec.id}-${i}`, types.length)];
      const topic = pickFrom(topics, `${sec.id}-${i}-topic`);
      const gen = GENERATORS[type] || genMCQ;
      questions.push(
        gen({
          topic,
          subject: config.subject || "General",
          difficulty: resolveDifficulty(config.difficulty, qIndex),
          marks: marksPerQuestion,
          negativeMarks: [AI_QUESTION_TYPE.MCQ, AI_QUESTION_TYPE.MULTI_SELECT, AI_QUESTION_TYPE.TRUE_FALSE].includes(type) ? negMarks : 0,
          index: qIndex,
        })
      );
    }
    return { ...sec, questions };
  });
  return { ...structure, sections };
}

// Single entry point used by the "Generate with AI" tab — dispatches on
// generationMode so the UI doesn't need to know the structure/question
// steps are separate.
export function generateTest(config, existingStructure) {
  let structure;
  if (config.generationMode === GENERATION_MODE.QUESTIONS_FOR_STRUCTURE && existingStructure) {
    structure = existingStructure;
  } else {
    structure = generateTestStructure(config);
  }
  const sections =
    config.generationMode === GENERATION_MODE.STRUCTURE_ONLY
      ? structure.sections
      : generateQuestionsForStructure(config, structure).sections;

  return {
    id: nextAiId("AITEST"),
    name: config.testName || "Untitled AI-Generated Test",
    subject: config.subject || "General",
    examType: config.examType || "General / Custom",
    difficulty: config.difficulty || "Medium",
    language: config.language || "English",
    duration: Number(config.duration) || 60,
    totalMarks: Number(config.totalMarks) || sections.reduce((sum, s) => sum + (s.totalMarks || 0), 0),
    negativeMarking: !!config.negativeMarking,
    negativeMarkValue: config.negativeMarking ? Number(config.negativeMarkValue) || 1 : 0,
    additionalInstructions: config.additionalInstructions || "",
    sections,
    warnings: [],
    source: "ai",
  };
}

export function createEmptyTest(name = "New Test") {
  return {
    id: nextAiId("AITEST"),
    name,
    subject: "General",
    examType: "General / Custom",
    difficulty: "Medium",
    language: "English",
    duration: 60,
    totalMarks: 0,
    negativeMarking: false,
    negativeMarkValue: 0,
    additionalInstructions: "",
    sections: [],
    warnings: [],
    source: "manual",
  };
}

// ---------- paste-a-question-paper parser ----------
//
// Real regex-based extraction — never invents content. Anything it can't
// confidently read (missing answer key, unclear marks, unclear options)
// is left blank/null and flagged in the question's own `issues` array
// plus the test-level `warnings` array, for the admin to review.

const SECTION_RE = /^\s*(?:section|part)[\s:-]*([a-z0-9]+)\b[\s:.\-]*(.*)$/i;
const QUESTION_RE = /^\s*(?:q(?:uestion)?\.?\s*)?(\d{1,3})\s*[\.\):]\s+(.*)$/i;
const OPTION_RE = /^\s*\(?([a-dA-D])\)?[\.\)]\s+(.*)$/;
const ANSWER_RE = /^\s*(?:ans(?:wer)?)\s*[:.\-]?\s*(.+)$/i;
const MARKS_RE = /\[?\(?(\d+(?:\.\d+)?)\s*marks?\)?\]?/i;
const ANSWER_KEY_BLOCK_RE = /answer\s*key/i;
const TRUE_FALSE_RE = /true\s*(?:or|\/)\s*false/i;
const MULTI_SELECT_HINT_RE = /select\s+(all|two|three|multiple)|choose\s+all/i;

function detectMarks(text) {
  const m = text.match(MARKS_RE);
  return m ? Number(m[1]) : null;
}
function stripMarks(text) {
  return text.replace(MARKS_RE, "").trim();
}

export function parseQuestionPaper(rawText) {
  const warnings = [];
  const lines = (rawText || "").split(/\r?\n/);

  const sections = [];
  let currentSection = null;
  let currentQuestion = null;
  const answerKeyEntries = {}; // questionNumber -> answer, from a trailing "Answer Key" block
  let inAnswerKeyBlock = false;

  const ensureDefaultSection = () => {
    if (!currentSection) {
      currentSection = { id: nextAiId("SEC"), name: "Section A", instructions: "", questionCount: 0, marksPerQuestion: null, totalMarks: 0, questionTypes: [], questions: [], parsed: true };
      sections.push(currentSection);
    }
    return currentSection;
  };
  const closeQuestion = () => {
    if (currentQuestion) {
      currentQuestion.text = currentQuestion.text.trim();
      finalizeParsedQuestion(currentQuestion, warnings);
      ensureDefaultSection().questions.push(currentQuestion);
      currentQuestion = null;
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    if (ANSWER_KEY_BLOCK_RE.test(line) && line.length < 40) {
      closeQuestion();
      inAnswerKeyBlock = true;
      continue;
    }
    if (inAnswerKeyBlock) {
      // Accepts forms like "1-B, 2-D, 3. True, 4) A" on one or many lines.
      const re = /(\d{1,3})\s*[-.)\s]\s*([A-Da-d]|true|false)\b/gi;
      let m;
      let found = false;
      while ((m = re.exec(line))) {
        answerKeyEntries[m[1]] = /true|false/i.test(m[2]) ? (m[2][0].toUpperCase() + m[2].slice(1).toLowerCase()) : m[2].toUpperCase();
        found = true;
      }
      if (found) continue;
      // A line in the answer-key block that doesn't match just falls through.
    }

    const sectionMatch = line.match(SECTION_RE);
    if (sectionMatch) {
      closeQuestion();
      currentSection = {
        id: nextAiId("SEC"),
        name: `Section ${sectionMatch[1].toUpperCase()}`,
        instructions: sectionMatch[2] || "",
        questionCount: 0,
        marksPerQuestion: null,
        totalMarks: 0,
        questionTypes: [],
        questions: [],
        parsed: true,
      };
      sections.push(currentSection);
      continue;
    }

    const qMatch = line.match(QUESTION_RE);
    if (qMatch) {
      closeQuestion();
      currentQuestion = {
        id: nextAiId("AIQ"),
        number: qMatch[1],
        text: stripMarks(qMatch[2]),
        options: [],
        correctAnswer: null,
        marks: detectMarks(line),
        negativeMarks: 0,
        type: null,
        issues: [],
      };
      continue;
    }

    const optMatch = line.match(OPTION_RE);
    if (optMatch && currentQuestion) {
      currentQuestion.options.push({ key: optMatch[1].toUpperCase(), text: stripMarks(optMatch[2]) });
      continue;
    }

    const ansMatch = line.match(ANSWER_RE);
    if (ansMatch && currentQuestion) {
      currentQuestion.correctAnswer = ansMatch[1].trim().replace(/[.\s]+$/, "");
      continue;
    }

    // Plain continuation line — belongs to whichever question/section
    // we're currently inside (question text can wrap multiple lines).
    if (currentQuestion) {
      const marks = detectMarks(line);
      if (marks != null && currentQuestion.marks == null) currentQuestion.marks = marks;
      currentQuestion.text += ` ${stripMarks(line)}`;
    } else if (currentSection && !currentSection.instructions) {
      currentSection.instructions = line;
    }
  }
  closeQuestion();

  // Apply any trailing "Answer Key" block to questions that didn't have
  // an inline "Answer:" line of their own.
  if (Object.keys(answerKeyEntries).length) {
    for (const sec of sections) {
      for (const q of sec.questions) {
        if (!q.correctAnswer && q.number && answerKeyEntries[q.number]) {
          q.correctAnswer = answerKeyEntries[q.number];
          q.issues = q.issues.filter((i) => i !== "no_answer_key");
        }
      }
    }
  }

  if (sections.length === 0) {
    warnings.push("Nothing recognizable was extracted — check the pasted text has numbered questions (e.g. \"1.\", \"Q1.\").");
  }
  let anyAnswerFound = false;
  let anyMissingAnswer = false;
  sections.forEach((sec) => {
    sec.questionCount = sec.questions.length;
    const marksValues = sec.questions.map((q) => q.marks).filter((m) => m != null);
    sec.marksPerQuestion = marksValues.length ? marksValues[0] : null;
    sec.totalMarks = sec.questions.reduce((sum, q) => sum + (q.marks || 0), 0);
    sec.questionTypes = [...new Set(sec.questions.map((q) => q.type))];
    sec.questions.forEach((q) => {
      if (q.correctAnswer) anyAnswerFound = true;
      else anyMissingAnswer = true;
    });
  });
  if (anyMissingAnswer) {
    warnings.push(anyAnswerFound ? "Some questions are missing an answer key — review before publishing." : "No answer key was found anywhere in the pasted text — correct answers are left blank for manual entry.");
  }

  return {
    id: nextAiId("AITEST"),
    name: "Pasted Question Paper",
    subject: "General",
    examType: "General / Custom",
    difficulty: "Medium",
    language: "English",
    duration: 60,
    totalMarks: sections.reduce((sum, s) => sum + (s.totalMarks || 0), 0),
    negativeMarking: false,
    negativeMarkValue: 0,
    additionalInstructions: "",
    sections,
    warnings,
    source: "pasted",
  };
}

function finalizeParsedQuestion(q, warnings) {
  const optionCount = q.options.length;
  if (TRUE_FALSE_RE.test(q.text)) {
    q.type = AI_QUESTION_TYPE.TRUE_FALSE;
    if (optionCount === 0) q.options = [{ key: "True", text: "True" }, { key: "False", text: "False" }];
  } else if (optionCount >= 2) {
    q.type = MULTI_SELECT_HINT_RE.test(q.text) ? AI_QUESTION_TYPE.MULTI_SELECT : AI_QUESTION_TYPE.MCQ;
    if (optionCount < 4) q.issues.push("fewer_than_4_options");
  } else if (/\b(explain|describe|discuss|derive|elaborate)\b/i.test(q.text)) {
    q.type = AI_QUESTION_TYPE.LONG_ANSWER;
  } else {
    q.type = AI_QUESTION_TYPE.SHORT_ANSWER;
  }

  if ([AI_QUESTION_TYPE.MCQ, AI_QUESTION_TYPE.MULTI_SELECT, AI_QUESTION_TYPE.TRUE_FALSE].includes(q.type) && !q.correctAnswer) {
    q.issues.push("no_answer_key");
  }
  if (q.marks == null) {
    q.issues.push("marks_not_specified");
    q.marks = 1;
  }
}

export const PARSED_ISSUE_LABEL = {
  no_answer_key: "No answer key found",
  marks_not_specified: "Marks not specified — defaulted to 1",
  fewer_than_4_options: "Fewer than 4 options detected",
};
