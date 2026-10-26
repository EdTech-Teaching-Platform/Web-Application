// Feedback form options and validation (mirror student_submit_feedback).

export const FEEDBACK_KINDS = [
  { value: "feedback", label: "Feedback", hint: "Tell us how the test felt." },
  { value: "query", label: "Query", hint: "Ask about a question or your result." },
  { value: "issue", label: "Report an issue", hint: "A wrong answer, an unclear question or a technical problem." },
];
export const FEEDBACK_CATEGORIES = [
  { value: "wrong_answer", label: "Wrong answer" },
  { value: "unclear_question", label: "Unclear question" },
  { value: "technical_problem", label: "Technical problem" },
  { value: "other", label: "Other" },
];
export const FEEDBACK_STATUS = {
  new: { label: "Sent", tone: "neutral" },
  in_review: { label: "In review", tone: "warning" },
  resolved: { label: "Resolved", tone: "success" },
  dismissed: { label: "Closed", tone: "neutral" },
};
export const MESSAGE_MIN = 5;
export const MESSAGE_MAX = 2000;

// Inline errors keyed by field ({} = valid).
export function validateFeedback({ kind, rating, message }) {
  const e = {};
  if (!FEEDBACK_KINDS.some((k) => k.value === kind)) e.kind = "Choose what you want to send.";
  if (kind === "feedback" && !(rating >= 1 && rating <= 5)) e.rating = "Give a rating from 1 to 5 stars.";
  const len = String(message ?? "").trim().length;
  if (len < MESSAGE_MIN) e.message = `Write at least ${MESSAGE_MIN} characters.`;
  else if (len > MESSAGE_MAX) e.message = `Keep it under ${MESSAGE_MAX} characters.`;
  return e;
}
