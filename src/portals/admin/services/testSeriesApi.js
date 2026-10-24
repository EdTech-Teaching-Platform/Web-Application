import { supabase } from "../../../services/supabaseClient";
import { normalizeRpcError, callRpc, listResult } from "./adminApi";

function throwIfError(error) {
  if (error) throw normalizeRpcError(error);
}

function mapQuestion(question) {
  const options = (question.question_options || []).sort((a, b) => a.position - b.position);
  return {
    id: question.id,
    type: ["mcq", "multi_select", "true_false"].includes(question.type) ? "objective" : "subjective",
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
  };
}

function mapTest(test) {
  const questions = (test.questions || []).sort((a, b) => a.position - b.position).map(mapQuestion);
  return {
    id: test.id,
    name: test.title,
    instructions: test.instructions || "",
    duration: test.duration_minutes,
    totalMarks: Number(test.total_marks || 0),
    passingMarks: Math.round(Number(test.total_marks || 0) * Number(test.passing_percent || 0) / 100),
    passingPercent: Number(test.passing_percent || 0),
    attemptLimit: test.attempt_limit,
    scheduledAt: test.scheduled_at || "",
    shuffleQuestions: !!test.shuffle_questions,
    shuffleOptions: !!test.shuffle_options,
    status: test.status,
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
    tests: (series.tests || []).sort((a, b) => a.position - b.position).map(mapTest),
  };
}

export const testSeriesApi = {
  stats: () => callRpc("get_test_series_stats"),
  list: async (params) => {
    const result = listResult(await callRpc("list_test_series", params));
    return { ...result, rows: result.rows.map((row) => mapSeries(row)) };
  },
  get: async (id) => {
    const { data, error } = await supabase
      .from("test_series")
      .select("*, subjects(name), tests(*, questions(*, question_options(*)), test_sections(*))")
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    throwIfError(error);
    return data ? mapSeries({ ...data, subject_name: data.subjects?.name }) : null;
  },
  createTest: async (seriesId, payload) => {
    const { data, error } = await supabase.from("tests").insert({
      series_id: seriesId,
      title: payload.name,
      instructions: payload.instructions || null,
      duration_minutes: payload.duration,
      total_marks: payload.totalMarks,
      passing_percent: payload.passingPercent || 40,
      attempt_limit: payload.attemptLimit,
      scheduled_at: payload.scheduledAt || null,
      shuffle_questions: !!payload.shuffleQuestions,
      shuffle_options: !!payload.shuffleOptions,
      status: payload.status || "draft",
    }).select().single();
    throwIfError(error);
    return mapTest(data);
  },
  updateTest: async (id, payload) => {
    const { data, error } = await supabase.from("tests").update({
      title: payload.name,
      instructions: payload.instructions || null,
      duration_minutes: payload.duration,
      total_marks: payload.totalMarks,
      passing_percent: payload.passingPercent || 40,
      attempt_limit: payload.attemptLimit,
      scheduled_at: payload.scheduledAt || null,
      shuffle_questions: !!payload.shuffleQuestions,
      shuffle_options: !!payload.shuffleOptions,
      status: payload.status || "draft",
    }).eq("id", id).select().single();
    throwIfError(error);
    return mapTest(data);
  },
  deleteTest: async (id) => {
    const { error } = await supabase.from("tests").delete().eq("id", id);
    throwIfError(error);
  },
  setTestStatus: async (id, status) => {
    const { data, error } = await supabase.from("tests").update({ status }).eq("id", id).select().single();
    throwIfError(error);
    return mapTest(data);
  },
  createSection: async (payload) => {
    const { data, error } = await supabase.from("test_sections").insert(payload).select().single();
    throwIfError(error);
    return data;
  },
  updateSection: async (id, payload) => {
    const { data, error } = await supabase.from("test_sections").update(payload).eq("id", id).select().single();
    throwIfError(error);
    return data;
  },
  deleteSection: async (id) => {
    const { error } = await supabase.from("test_sections").delete().eq("id", id);
    throwIfError(error);
  },
  createQuestion: async (payload) => {
    const { data, error } = await supabase.from("questions").insert(payload).select().single();
    throwIfError(error);
    return data;
  },
  updateQuestion: async (id, payload) => {
    const { data, error } = await supabase.from("questions").update(payload).eq("id", id).select().single();
    throwIfError(error);
    return data;
  },
  deleteQuestion: async (id) => {
    const { error } = await supabase.from("questions").delete().eq("id", id);
    throwIfError(error);
  },
  createOption: async (payload) => {
    const { data, error } = await supabase.from("question_options").insert(payload).select().single();
    throwIfError(error);
    return data;
  },
  updateOption: async (id, payload) => {
    const { data, error } = await supabase.from("question_options").update(payload).eq("id", id).select().single();
    throwIfError(error);
    return data;
  },
  deleteOption: async (id) => {
    const { error } = await supabase.from("question_options").delete().eq("id", id);
    throwIfError(error);
  },
  deleteSeries: async (id) => {
    const { error } = await supabase.from("test_series").update({ deleted_at: new Date().toISOString() }).eq("id", id);
    throwIfError(error);
  },
  createSeries: async (payload) => {
    const { data: subject, error: subjectError } = payload.subject
      ? await supabase.from("subjects").select("id").eq("name", payload.subject).maybeSingle()
      : { data: null, error: null };
    throwIfError(subjectError);
    const { data, error } = await supabase.from("test_series").insert({
      title: payload.name,
      about: payload.description || null,
      subject_id: subject?.id || null,
      audience: payload.audience || null,
      pricing: payload.pricing,
      price_inr: payload.price,
      start_date: payload.startDate || null,
      end_date: payload.endDate || null,
      status: payload.status || "draft",
    }).select().single();
    throwIfError(error);
    return data;
  },
  updateSeries: async (id, payload) => {
    const { data: subject, error: subjectError } = payload.subject
      ? await supabase.from("subjects").select("id").eq("name", payload.subject).maybeSingle()
      : { data: null, error: null };
    throwIfError(subjectError);
    const { data, error } = await supabase.from("test_series").update({
      title: payload.name,
      about: payload.description || null,
      subject_id: subject?.id || null,
      audience: payload.audience || null,
      pricing: payload.pricing,
      price_inr: payload.price,
      start_date: payload.startDate || null,
      end_date: payload.endDate || null,
      status: payload.status || "draft",
    }).eq("id", id).select().single();
    throwIfError(error);
    return data;
  },
  publishSeries: (id) => callRpc("publish_test_series", { p_id: id }),
  duplicateSeries: (id) => callRpc("duplicate_test_series", { p_id: id }),
  saveDraft: (id, state) => callRpc("save_wizard_draft", { p_id: id, p_state: state }),
  discardDraft: (id) => callRpc("discard_wizard_draft", { p_id: id }),
  nameExists: (name, exclude) => callRpc("series_name_exists", { p_name: name, p_exclude: exclude || null }),
  saveWizard: (payload, publish) => callRpc("upsert_test_series_full", { p: payload, p_publish: publish }),
};
