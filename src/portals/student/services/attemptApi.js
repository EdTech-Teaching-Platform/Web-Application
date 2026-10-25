import { callRpc } from "./studentRpc";

// Taking a test (docs/STUDENT_RPC_CONTRACT.md "Taking a test"). Scoring and
// deadlines are server-side; the client only renders and autosaves.
export const PROCTOR_EVENTS = Object.freeze({
  visibilityHidden: "visibility_hidden",
  windowBlur: "window_blur",
  fullscreenExit: "fullscreen_exit",
  copy: "copy",
  cut: "cut",
  paste: "paste",
  contextMenu: "contextmenu",
  fullscreenEnter: "fullscreen_enter",
  attemptResumed: "attempt_resumed",
});

// Builds the p_answer payload for student_save_answer.
export function answerPayload(question, value) {
  if (question.type === "multiple_choice" || question.type === "true_false") {
    const ids = Array.isArray(value) ? value : value ? [value] : [];
    return { selected_option_ids: ids };
  }
  return { answer_text: typeof value === "string" ? value : "" };
}

export const attemptApi = {
  intro: (testId) => callRpc("student_get_test_intro", { p_test_id: testId }),
  start: (testId) => callRpc("student_start_attempt", { p_test_id: testId }),
  saveAnswer: (attemptId, questionId, answer) =>
    callRpc("student_save_answer", { p_attempt_id: attemptId, p_question_id: questionId, p_answer: answer }),
  logEvent: (attemptId, eventType, meta = {}) =>
    callRpc("student_log_proctor_event", { p_attempt_id: attemptId, p_event_type: eventType, p_meta: meta }),
  submit: (attemptId) => callRpc("student_submit_attempt", { p_attempt_id: attemptId }),
  report: (attemptId) => callRpc("student_get_report", { p_attempt_id: attemptId }),
};

export default attemptApi;
