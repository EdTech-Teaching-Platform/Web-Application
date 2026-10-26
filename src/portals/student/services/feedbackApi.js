import { callRpc } from "./studentRpc";

// Test feedback / queries / issue reports (docs/STUDENT_RPC_CONTRACT.md "Feedback").
export const feedbackApi = {
  // Returns the new item's id.
  submit: ({ attemptId, kind, rating = null, category = null, questionId = null, message }) =>
    callRpc("student_submit_feedback", {
      p_attempt_id: attemptId,
      p_kind: kind,
      p_rating: kind === "feedback" ? rating : null,
      p_category: category || null,
      p_question_id: questionId || null,
      p_message: message,
    }),
  // The caller's own items (newest first); seriesId null = every series.
  mine: (seriesId = null) => callRpc("student_my_feedback", { p_series_id: seriesId }),
};

export default feedbackApi;
