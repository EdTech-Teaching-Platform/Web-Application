import { callRpc, listResult } from "./adminApi";

// Every read and write goes through SECURITY DEFINER RPCs: the lead's RLS
// gives admins read-only access to test_series / quizzes / quiz_questions /
// quiz_question_options, so direct table writes from the browser would fail.

const OBJECTIVE_TYPES = ["objective", "mcq", "mcq_single", "single", "mcq_multi", "multi_select", "multiple_choice", "true_false"];
// Text-answer questions store their accepted / model answer as the single
// correct option; this placeholder means none was given (adm_text_answer).
const MANUAL_GRADING_PLACEHOLDER = "Manual grading: see rubric";

function mapQuestion(question) {
  const options = (question.options || []).slice().sort((a, b) => a.position - b.position);
  const objective = OBJECTIVE_TYPES.includes(question.type);
  const answerOption = options.find((o) => o.is_correct)?.label || "";
  return {
    id: question.id,
    type: objective ? "objective" : "subjective",
    storedType: question.type,
    modelAnswer: objective || answerOption === MANUAL_GRADING_PLACEHOLDER ? "" : answerOption,
    text: question.body || "",
    optionA: options.find((o) => o.option_key === "A")?.label || "",
    optionB: options.find((o) => o.option_key === "B")?.label || "",
    optionC: options.find((o) => o.option_key === "C")?.label || "",
    optionD: options.find((o) => o.option_key === "D")?.label || "",
    correctAnswer: options.find((o) => o.is_correct)?.option_key || "",
    answerInstructions: question.answer_instructions || "",
    rubric: question.answer_instructions || "",
    marks: Number(question.marks || 0),
    negativeMarks: Number(question.negative_marks || 0),
    difficulty: question.difficulty || "medium",
    subject: question.subject || "",
    topic: question.topic || "",
    explanation: question.explanation || "",
    image: question.image_path || "",
    needsManualGrading: !!question.needs_manual_grading,
  };
}

function mapTest(test) {
  const questions = (test.questions || []).slice().sort((a, b) => a.position - b.position).map(mapQuestion);
  const totalMarks = Number(test.total_marks || 0);
  return {
    id: test.id,
    name: test.title,
    instructions: test.instructions || "",
    duration: test.duration_minutes,
    totalMarks,
    passingMarks: test.passing_marks != null
      ? Number(test.passing_marks)
      : Math.round(totalMarks * Number(test.passing_percent || 0) / 100),
    passingPercent: Number(test.passing_percent || 0),
    attemptLimit: test.attempt_limit,
    scheduledAt: test.scheduled_at || "",
    shuffleQuestions: !!test.shuffle_questions,
    shuffleOptions: !!test.shuffle_options,
    showAnswersAfter: test.show_answers_after || "submission",
    status: test.status,
    sections: test.sections || [],
    questions,
  };
}

function mapSeries(series) {
  const subject = series.subject_name || "";
  return {
    ...series,
    name: series.title,
    description: series.about || "",
    subject,
    price: Number(series.price_inr || 0),
    startDate: series.start_date || "",
    endDate: series.end_date || "",
    enrollment: Number(series.enrollments || 0),
    attempts: Number(series.attempts || 0),
    avgPerformance: Number(series.avg_score || 0),
    tests: (series.tests || []).slice().sort((a, b) => a.position - b.position).map(mapTest),
  };
}

export const testSeriesApi = {
  stats: () => callRpc("get_test_series_stats"),
  list: async (params) => {
    const result = listResult(await callRpc("list_test_series", params));
    return { ...result, rows: result.rows.map((row) => mapSeries(row)) };
  },
  get: async (id) => {
    const data = await callRpc("get_test_series", { p_id: id });
    return data ? mapSeries(data) : null;
  },
  createTest: async (seriesId, payload) => mapTest(await callRpc("create_test", { p_series_id: seriesId, p: payload })),
  updateTest: async (id, payload) => mapTest(await callRpc("update_test", { p_id: id, p: payload })),
  deleteTest: (id) => callRpc("delete_test", { p_id: id }),
  duplicateTest: async (id) => mapTest(await callRpc("duplicate_test", { p_id: id })),
  setTestStatus: async (id, status) => mapTest(await callRpc("set_test_status", { p_id: id, p_status: status })),
  createSection: (payload) => callRpc("create_test_section", { p_test_id: payload.test_id ?? payload.testId, p: payload }),
  updateSection: (id, payload) => callRpc("update_test_section", { p_id: id, p: payload }),
  deleteSection: (id) => callRpc("delete_test_section", { p_id: id }),
  createQuestion: (payload) => callRpc("create_question", { p_test_id: payload.test_id ?? payload.testId, p: payload }),
  updateQuestion: (id, payload) => callRpc("update_question", { p_id: id, p: payload }),
  deleteQuestion: (id) => callRpc("delete_question", { p_id: id }),
  createOption: (payload) => callRpc("create_question_option", { p_question_id: payload.question_id ?? payload.questionId, p: payload }),
  updateOption: (id, payload) => callRpc("update_question_option", { p_id: id, p: payload }),
  deleteOption: (id) => callRpc("delete_question_option", { p_id: id }),
  deleteSeries: (id) => callRpc("delete_test_series", { p_id: id }),
  createSeries: (payload) => callRpc("create_test_series", { p: payload }),
  updateSeries: (id, payload) => callRpc("update_test_series", { p_id: id, p: payload }),
  // adm_publish_test_series: the lead owns publish_test_series(uuid, boolean).
  publishSeries: (id) => callRpc("adm_publish_test_series", { p_id: id, p_publish: true }),
  duplicateSeries: (id) => callRpc("duplicate_test_series", { p_id: id }),
  saveDraft: (id, state) => callRpc("save_wizard_draft", { p_id: id, p_state: state }),
  discardDraft: (id) => callRpc("discard_wizard_draft", { p_id: id }),
  nameExists: (name, exclude) => callRpc("series_name_exists", { p_name: name, p_exclude: exclude || null }),
  saveWizard: (payload, publish) => callRpc("upsert_test_series_full", { p: payload, p_publish: publish }),
};
