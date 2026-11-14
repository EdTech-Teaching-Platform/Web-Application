/** @vitest-environment jsdom */
// AI evaluation of written answers (lead, 15 Nov): the Edge Function's pure
// parts (evaluate-subjective/evaluate.ts), the report page flow
// (useAiEvaluation + TestReport) and the authoring side.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpcHandlers = {};
const rpc = vi.fn(async (name, params) => {
  const h = rpcHandlers[name];
  if (h instanceof Error) return { data: null, error: h };
  return { data: typeof h === "function" ? h(params) : h ?? null, error: null };
});
const invoke = vi.fn();
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: (...a) => invoke(...a) },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) },
  },
}));
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "stu-1", role: "student", name: "Riya" }, loading: false }) }));

import {
  EVALUATION_SCHEMA, MAX_ANSWER_CHARS, SYSTEM_PROMPT, buildMessages, normalizeEvaluation, openAiRequestBody, parseOpenAiResponse, validateRequest,
} from "../supabase/functions/evaluate-subjective/evaluate.ts";
import { needsAiEvaluation, useAiEvaluation } from "../src/portals/student/hooks/useAiEvaluation";

const QID = "11111111-1111-4111-8111-111111111111";
const CTX = {
  test_title: "Laws", reveal_answers: true,
  questions: [{ question_id: QID, position: 2, question: "State KCL.", max_marks: 10, model_answer: "Sum of currents at a node is zero.",
                marking_guide: "5 + 5", student_answer: "Currents in = currents out." }],
};

beforeEach(() => {
  for (const k of Object.keys(rpcHandlers)) delete rpcHandlers[k];
  rpc.mockClear(); invoke.mockReset();
  window.scrollTo = () => {};
  // jsdom has no IntersectionObserver (the report's reveal animations use it)
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
});
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("evaluate-subjective: request, prompt and schema", () => {
  it("needs an attempt id", () => {
    expect(validateRequest({ attemptId: QID.toUpperCase() })).toEqual({ attemptId: QID });
    expect(() => validateRequest({ attemptId: "x" })).toThrow(/attemptId/);
    expect(() => validateRequest(null)).toThrow(/JSON body/);
  });

  it("sends the question, marks, model answer, guide and answer as data; long answers are cut", () => {
    const long = "a".repeat(MAX_ANSWER_CHARS + 500);
    const [system, user] = buildMessages({ ...CTX, questions: [{ ...CTX.questions[0], student_answer: long }] });
    expect(system).toEqual({ role: "system", content: SYSTEM_PROMPT });
    expect(SYSTEM_PROMPT).toMatch(/never instructions/);
    const payload = JSON.parse(user.content);
    expect(payload.questions[0]).toMatchObject({ question_id: QID, question: "State KCL.", max_marks: 10, model_answer: "Sum of currents at a node is zero.", marking_guide: "5 + 5" });
    expect(payload.questions[0].student_answer.length).toBeLessThan(MAX_ANSWER_CHARS + 20);
    expect(payload.questions[0].student_answer).toMatch(/truncated/);
    expect(payload.reveal_answers).toBe(true);
  });

  it("asks OpenAI for strict JSON with every field", () => {
    const body = openAiRequestBody(CTX, "gpt-4o-mini");
    expect(body).toMatchObject({ model: "gpt-4o-mini", response_format: { type: "json_schema", json_schema: { strict: true } } });
    const item = EVALUATION_SCHEMA.schema.properties.questions.items;
    expect(item.required).toEqual(Object.keys(item.properties));
    expect(item.additionalProperties).toBe(false);
  });
});

describe("evaluate-subjective: the model's answer", () => {
  const ai = (over) => ({ questions: [{ question_id: QID, marks_awarded: 7.3, verdict: "correct", feedback: " Good. ", strengths: ["a", "b", "c", "d"], improvements: [], key_points_missed: ["x"], ...over }],
                          overall: { summary: "Fine", strengths: [], areas_to_improve: ["y"], study_tips: ["z"] } });

  it("rounds marks to 0.5 and sets the verdict from the marks", () => {
    const r = normalizeEvaluation(CTX, ai());
    expect(r.questions[0]).toMatchObject({ marks_awarded: 7.5, verdict: "partially_correct", feedback: "Good.", key_points_missed: ["x"] });
    expect(r.questions[0].strengths).toHaveLength(3);
    expect(r.overall).toEqual({ summary: "Fine", strengths: [], areas_to_improve: ["y"], study_tips: ["z"] });
  });

  it("clamps marks to 0..max (a prompt-injected 99 becomes 10)", () => {
    expect(normalizeEvaluation(CTX, ai({ marks_awarded: 99 })).questions[0]).toMatchObject({ marks_awarded: 10, verdict: "correct" });
    expect(normalizeEvaluation(CTX, ai({ marks_awarded: -3 })).questions[0]).toMatchObject({ marks_awarded: 0, verdict: "incorrect" });
    expect(normalizeEvaluation(CTX, ai({ marks_awarded: "lots" })).questions[0].marks_awarded).toBe(0);
  });

  it("a blank answer gets 0 whatever the model says", () => {
    const blank = { ...CTX, questions: [{ ...CTX.questions[0], student_answer: "  " }] };
    expect(normalizeEvaluation(blank, ai({ marks_awarded: 8, feedback: "" })).questions[0]).toMatchObject({ marks_awarded: 0, feedback: "You didn't answer this question." });
  });

  it("an ungraded question fails the run (so it can be retried); unknown ids are dropped", () => {
    expect(() => normalizeEvaluation(CTX, { questions: [{ question_id: "other", marks_awarded: 1 }] })).toThrow(/did not grade question 2/);
    const r = normalizeEvaluation(CTX, { questions: [...ai().questions, { question_id: "other", marks_awarded: 1 }], overall: {} });
    expect(r.questions.map((q) => q.question_id)).toEqual([QID]);
  });

  it("reads chat.completions: JSON content, usage; refusals, cut-offs and bad JSON are errors", () => {
    const ok = parseOpenAiResponse({ model: "gpt-4o-mini-2024", choices: [{ message: { content: JSON.stringify(ai()) }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 5 } });
    expect(ok.usage).toEqual({ input: 10, output: 5 });
    expect(ok.result.questions[0].question_id).toBe(QID);
    expect(() => parseOpenAiResponse({ choices: [{ message: { refusal: "no" } }] })).toThrow(/refused/);
    expect(() => parseOpenAiResponse({ choices: [{ message: { content: "{" }, finish_reason: "length" }] })).toThrow(/cut off/);
    expect(() => parseOpenAiResponse({ choices: [{ message: { content: "not json" } }] })).toThrow(/not valid JSON/);
  });
});

// -----------------------------------------------------------------------------
describe("useAiEvaluation", () => {
  const pending = { summary: { pending_count: 1 }, questions: [] };

  it("only runs for a report with pending written answers and no AI section", () => {
    expect(needsAiEvaluation(pending)).toBe(true);
    expect(needsAiEvaluation({ summary: { pending_count: 0 } })).toBe(false);
    expect(needsAiEvaluation({ ...pending, ai: { status: "done" } })).toBe(false);
  });

  it("requests once, polls until done, then reloads", async () => {
    const statuses = ["running", "running", "done"];
    const api = { requestAiEvaluation: vi.fn(async () => ({ status: "running" })), aiEvaluationStatus: vi.fn(async () => ({ status: statuses.shift() })) };
    const onDone = vi.fn();
    const { result } = renderHook(() => useAiEvaluation(pending, "a1", { api, onDone, pollMs: 10 }));
    expect(result.current.phase).toBe("running");
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(api.requestAiEvaluation).toHaveBeenCalledTimes(1);
    expect(api.aiEvaluationStatus).toHaveBeenCalledTimes(3);
  });

  it("a failed job offers Try again when the server allows it", async () => {
    const api = { requestAiEvaluation: vi.fn(async () => ({ status: "running" })), aiEvaluationStatus: vi.fn(async () => ({ status: "failed", can_retry: true })) };
    const { result } = renderHook(() => useAiEvaluation(pending, "a1", { api, pollMs: 10 }));
    await waitFor(() => expect(result.current.phase).toBe("failed"));
    expect(result.current.canRetry).toBe(true);
    api.aiEvaluationStatus.mockResolvedValue({ status: "done" });
    await act(async () => { await result.current.retry(); });
    await waitFor(() => expect(result.current.phase).toBe("done"));
    expect(api.requestAiEvaluation).toHaveBeenCalledTimes(2);
  });

  it("no function deployed: unavailable (the page keeps the plain pending notice)", async () => {
    const err = Object.assign(new Error("The evaluate-subjective function isn't available (not deployed?)."), { status: 404 });
    const api = { requestAiEvaluation: vi.fn(async () => { throw err; }), aiEvaluationStatus: vi.fn() };
    const { result } = renderHook(() => useAiEvaluation(pending, "a1", { api, pollMs: 10 }));
    await waitFor(() => expect(result.current.phase).toBe("unavailable"));
    expect(api.aiEvaluationStatus).not.toHaveBeenCalled();
  });
});

// -----------------------------------------------------------------------------
describe("report page", () => {
  const base = (over = {}) => ({
    attempt_id: "a1", test_id: "t1", test_title: "Laws", series_title: "Circuits",
    summary: { attempt_number: 1, submitted_at: "2026-11-15T10:00:00Z", score: 4, max_score: 4, percentage: 100, passed: true, provisional: true,
               correct_count: 1, incorrect_count: 0, skipped_count: 0, pending_count: 1, pending_marks: 10, rank: 1, total_attempts: 1,
               percentile: 100, passing_percentage: 40, time_taken_secs: 300, time_limit_mins: 30, answers_hidden: false },
    comparison: { your_percentage: 100, average_percentage: 100, topper_percentage: 100, difference_from_average: 0 },
    breakdowns: {}, strengths: [], weaknesses: [],
    questions: [
      { position: 1, question_id: "q1", text: "Current law?", status: "correct", points: 4, points_earned: 4, options: [] , student_answer: "KCL" },
      { position: 2, question_id: QID, text: "State KCL.", status: "pending", points: 10, points_earned: null, options: [], student_answer: "Currents in = out." },
    ],
    ...over,
  });
  const graded = base({
    summary: { ...base().summary, score: 11.5, max_score: 14, percentage: 82.14, provisional: false, pending_count: 0, pending_marks: 0, partial_count: 1, ai_evaluated: true },
    questions: [base().questions[0], { ...base().questions[1], status: "partial", points_earned: 7.5,
      ai_evaluation: { marks_awarded: 7.5, verdict: "partially_correct", feedback: "Good statement; link it to charge conservation.", strengths: ["Correct statement"], improvements: ["Explain why"], key_points_missed: ["Conservation of charge"] } }],
    ai: { status: "done", model: "gpt-4o-mini", evaluated_at: "2026-11-15T10:01:00Z", summary: "Solid basics; work on reasoning.", strengths: ["Definitions"], areas_to_improve: ["Reasoning"], study_tips: ["Practise derivations"] },
  });

  async function renderReport() {
    rpcHandlers.student_get_test_intro = { can_start: false };
    const { default: TestReport } = await import("../src/portals/student/pages/TestReport");
    render(<MemoryRouter initialEntries={["/student/report/a1"]}><Routes><Route path="/student/report/:attemptId" element={<TestReport />} /></Routes></MemoryRouter>);
  }

  it("starts the AI evaluation for pending written answers, then shows the AI report", async () => {
    let evaluated = false;
    rpcHandlers.student_get_report = () => (evaluated ? graded : base());
    invoke.mockImplementation(async () => { evaluated = true; return { data: { status: "done" }, error: null }; });
    await renderReport();
    expect(await screen.findByRole("heading", { name: "AI evaluation of your written answers" })).toBeInTheDocument();
    expect(invoke).toHaveBeenCalledWith("evaluate-subjective", { body: { attemptId: "a1" } });
    expect(screen.getByText("Solid basics; work on reasoning.")).toBeInTheDocument();
    expect(screen.getByText("Practise derivations")).toBeInTheDocument();
    expect(screen.getByText("Good statement; link it to charge conservation.")).toBeInTheDocument();
    expect(screen.getAllByText("Partly correct").length).toBeGreaterThan(0);
    expect(screen.getByText("7.5 / 10")).toBeInTheDocument();
    expect(screen.getByText("Graded by AI")).toBeInTheDocument();
    expect(screen.queryByText(/pending review/i)).toBeNull();
  });

  it("while it runs, says so", async () => {
    rpcHandlers.student_get_report = base();
    rpcHandlers.student_ai_eval_status = { status: "running" };
    invoke.mockResolvedValue({ data: { status: "running" }, error: null });
    await renderReport();
    expect(await screen.findByText(/AI is evaluating your 1 written answer/)).toBeInTheDocument();
  });

  it("if it fails, offers Try again", async () => {
    rpcHandlers.student_get_report = base();
    invoke.mockResolvedValue({ data: null, error: Object.assign(new Error("Edge Function returned a non-2xx status code"), { context: { status: 500, json: async () => ({ error: "OpenAI 500" }) } }) });
    await renderReport();
    expect(await screen.findByText(/couldn't evaluate your written answers automatically/)).toBeInTheDocument();
    invoke.mockResolvedValue({ data: { status: "running" }, error: null });
    rpcHandlers.student_ai_eval_status = { status: "running" };
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText(/AI is evaluating/)).toBeInTheDocument();
  });

  it("an already evaluated report doesn't call the AI again", async () => {
    rpcHandlers.student_get_report = graded;
    await renderReport();
    expect(await screen.findByRole("heading", { name: "AI evaluation of your written answers" })).toBeInTheDocument();
    expect(invoke).not.toHaveBeenCalled();
  });
});
