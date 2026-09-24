const QUIZ_KEY = "universal-learning-quiz-attempt";
const ASSIGNMENT_KEY = "universal-learning-assignment";

export const QUIZ = {
  id: "quiz-control-flow",
  courseId: "c1",
  title: "Knowledge Check: Control Flow",
  durationMinutes: 10,
  attemptLimit: 2,
  questions: [
    { id: "q1", prompt: "Which keyword exits a loop immediately?", options: ["continue", "break", "pass", "return"], answer: 1 },
    { id: "q2", prompt: "Which loop is best when the number of iterations is known?", options: ["for", "while", "try", "if"], answer: 0 },
    { id: "q3", prompt: "What does `range(3)` produce?", options: ["1, 2, 3", "0, 1, 2", "0, 1, 2, 3", "3"], answer: 1 },
    { id: "q4", prompt: "Which branch runs when no `if` or `elif` condition matches?", options: ["catch", "finally", "else", "default"], answer: 2 },
  ],
};

export const ASSIGNMENT = {
  id: "assignment-project",
  courseId: "c1",
  title: "Submit your project",
  dueDate: "September 24, 2026",
  resubmissionUntil: "September 30, 2026",
  maxFileSize: "25 MB",
  permissions: { canSubmit: true, canResubmit: true, canViewFeedback: true },
  rubric: [
    { criterion: "Correctness", points: 40, earned: 34, feedback: "Core requirements are met. Add validation for empty input." },
    { criterion: "Code quality", points: 30, earned: 26, feedback: "Clear structure. Extract the repeated loop into a helper." },
    { criterion: "Explanation", points: 30, earned: 24, feedback: "Good explanation; include time complexity in the README." },
  ],
};

function read(key, fallback) {
  try {
    return JSON.parse(window.localStorage.getItem(key) || JSON.stringify(fallback));
  } catch {
    return fallback;
  }
}

function write(key, value) {
  window.localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export function getQuizState() {
  return read(QUIZ_KEY, { answers: {}, flagged: [], currentIndex: 0, remainingSeconds: QUIZ.durationMinutes * 60, attempts: [], draftSavedAt: null });
}

export function saveQuizDraft(patch) {
  return write(QUIZ_KEY, { ...getQuizState(), ...patch, draftSavedAt: new Date().toISOString() });
}

export function submitQuizAttempt() {
  const state = getQuizState();
  if (state.attempts.length >= QUIZ.attemptLimit) {
    return { ok: false, reason: "attempt-limit", state };
  }
  const score = QUIZ.questions.reduce((total, question) => total + (state.answers[question.id] === question.answer ? 1 : 0), 0);
  const result = {
    id: `attempt-${Date.now()}`,
    submittedAt: new Date().toISOString(),
    score,
    total: QUIZ.questions.length,
    percentage: Math.round((score / QUIZ.questions.length) * 100),
    passed: score / QUIZ.questions.length >= 0.6,
    answers: state.answers,
  };
  const next = { ...state, attempts: [...state.attempts, result], lastResult: result };
  write(QUIZ_KEY, next);
  return { ok: true, result, state: next };
}

export function getAssignmentState() {
  return read(ASSIGNMENT_KEY, {
    status: "Pending",
    late: false,
    drafts: [],
    submissions: [
      {
        id: "submission-1",
        version: 1,
        submittedAt: "September 18, 2026 · 4:20 PM",
        fileName: "python-loops-project.zip",
        status: "Graded",
        score: 84,
        feedback: "A solid submission with clear progress. Apply the rubric notes before resubmitting.",
      },
    ],
    timeline: [
      { label: "Assignment opened", date: "September 15, 2026 · 9:00 AM", state: "done" },
      { label: "Submission received", date: "September 18, 2026 · 4:20 PM", state: "done" },
      { label: "Educator grading", date: "September 19, 2026 · 10:15 AM", state: "done" },
      { label: "Feedback returned", date: "September 19, 2026 · 11:00 AM", state: "done" },
    ],
  });
}

export function saveAssignmentDraft(draft) {
  const state = getAssignmentState();
  return write(ASSIGNMENT_KEY, { ...state, drafts: [...state.drafts, { ...draft, savedAt: new Date().toISOString() }] });
}

export function submitAssignment(fileName) {
  const state = getAssignmentState();
  if (!ASSIGNMENT.permissions.canSubmit || !ASSIGNMENT.permissions.canResubmit) {
    return { ok: false, reason: "permission-denied", state };
  }
  const version = state.submissions.length + 1;
  const next = {
    ...state,
    status: "Pending",
    late: false,
    submissions: [...state.submissions, { id: `submission-${version}`, version, submittedAt: "Just now", fileName, status: "Pending", score: null, feedback: null }],
    timeline: [...state.timeline, { label: `Version ${version} submitted`, date: "Just now", state: "current" }],
  };
  write(ASSIGNMENT_KEY, next);
  return { ok: true, state: next };
}
