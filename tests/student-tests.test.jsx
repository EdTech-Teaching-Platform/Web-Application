/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));

import {
  clockOffsetMs,
  initialState,
  runnerReducer,
  secondsLeft,
  SAVE_DEBOUNCE_MS,
  useAttemptRunner,
} from "../src/portals/student/hooks/useAttemptRunner";
import { attachProctorListeners } from "../src/portals/student/hooks/useProctor";
import { answerPayload } from "../src/portals/student/services/attemptApi";

beforeAll(() => {
  globalThis.IntersectionObserver = class { observe() {} disconnect() {} unobserve() {} };
  window.scrollTo = vi.fn();
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const T0 = new Date("2026-10-26T10:00:00.000Z").getTime();

function startResponse(overrides = {}) {
  return {
    attempt_id: "att-1",
    test_id: "test-1",
    test_title: "Physics mock 1",
    attempt_number: 1,
    resumed: false,
    started_at: new Date(T0).toISOString(),
    deadline: new Date(T0 + 30 * 60 * 1000).toISOString(),
    server_now: new Date(T0).toISOString(),
    violation_limit: 2,
    violations_count: 0,
    questions: [
      { id: "q1", position: 1, text: "Single", type: "multiple_choice", multi_select: false, points: 1, negative_marks: 0,
        section: "General", options: [{ id: "o1", text: "A" }, { id: "o2", text: "B" }] },
      { id: "q2", position: 2, text: "Blank", type: "fill_in_blank", points: 1, negative_marks: 0, section: "General", options: [] },
    ],
    saved_answers: [],
    ...overrides,
  };
}

function fakeApi(overrides = {}) {
  return {
    start: vi.fn().mockResolvedValue(startResponse()),
    saveAnswer: vi.fn().mockResolvedValue({ saved: true }),
    logEvent: vi.fn().mockResolvedValue({ counted: true, violations_count: 1, violation_limit: 2, remaining: 1, auto_submitted: false }),
    submit: vi.fn().mockResolvedValue({ summary: { status: "submitted" } }),
    report: vi.fn().mockResolvedValue({ summary: { status: "submitted", auto_submit_reason: "proctor_limit" } }),
    ...overrides,
  };
}

// -----------------------------------------------------------------------------
describe("runner timing", () => {
  it("corrects for the client clock and counts down to the server deadline", () => {
    const offset = clockOffsetMs(new Date(T0).toISOString(), T0 - 5000);   // client 5 s behind
    expect(offset).toBe(5000);
    const deadline = new Date(T0 + 60_000).toISOString();
    expect(secondsLeft(deadline, offset, T0 - 5000)).toBe(60);
    expect(secondsLeft(deadline, offset, T0 + 55_000)).toBe(0);
    expect(secondsLeft(null, 0, T0)).toBeNull();
  });
});

describe("runner state machine (reducer)", () => {
  it("restores saved answers on resume", () => {
    const s = runnerReducer(initialState, {
      type: "started",
      clientNow: T0,
      attempt: startResponse({
        resumed: true,
        saved_answers: [
          { question_id: "q1", selected_option_ids: ["o2"], answer_text: null },
          { question_id: "q2", selected_option_ids: [], answer_text: "Paris" },
        ],
      }),
    });
    expect(s.phase).toBe("running");
    expect(s.answers).toEqual({ q1: ["o2"], q2: "Paris" });
    expect(s.limit).toBe(2);
  });

  it("shows a blocking warning per counted violation and submits when the server says so", () => {
    let s = runnerReducer(initialState, { type: "started", clientNow: T0, attempt: startResponse() });
    s = runnerReducer(s, { type: "violation", eventType: "window_blur",
      result: { counted: true, violations_count: 1, violation_limit: 2, remaining: 1, auto_submitted: false } });
    expect(s.phase).toBe("warning");
    expect(s.warning).toEqual({ type: "window_blur", remaining: 1 });
    s = runnerReducer(s, { type: "ackWarning" });
    expect(s.phase).toBe("running");
    // the blur + visibilitychange pair of one switch is not counted twice
    s = runnerReducer(s, { type: "violation", eventType: "visibility_hidden",
      result: { counted: false, violations_count: 1, violation_limit: 2, remaining: 1, auto_submitted: false } });
    expect(s.phase).toBe("running");
    s = runnerReducer(s, { type: "violation", eventType: "copy",
      result: { counted: true, violations_count: 3, violation_limit: 2, remaining: 0, auto_submitted: true, auto_submit_reason: "proctor_limit" } });
    expect(s.phase).toBe("submitting");
    expect(s.reason).toBe("proctor_limit");
  });

  it("ignores answers once the attempt is submitting", () => {
    let s = runnerReducer(initialState, { type: "started", clientNow: T0, attempt: startResponse() });
    s = runnerReducer(s, { type: "submitting", reason: "time_up" });
    expect(runnerReducer(s, { type: "answer", questionId: "q1", value: ["o1"] })).toBe(s);
  });

  it("builds the save payload per question type", () => {
    expect(answerPayload({ type: "multiple_choice" }, ["o1", "o2"])).toEqual({ selected_option_ids: ["o1", "o2"] });
    expect(answerPayload({ type: "true_false" }, "o1")).toEqual({ selected_option_ids: ["o1"] });
    expect(answerPayload({ type: "fill_in_blank" }, "Paris")).toEqual({ answer_text: "Paris" });
    expect(answerPayload({ type: "short_answer" }, undefined)).toEqual({ answer_text: "" });
  });
});

// -----------------------------------------------------------------------------
describe("useAttemptRunner", () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout", "setInterval", "clearInterval", "Date"] });
    vi.setSystemTime(T0);
  });

  async function startRunner(api, onFinished = vi.fn()) {
    const hook = renderHook(() => useAttemptRunner("test-1", { api, onFinished }));
    await act(async () => {});
    return { ...hook, onFinished };
  }

  it("starts the attempt and logs a resume", async () => {
    const api = fakeApi({ start: vi.fn().mockResolvedValue(startResponse({ resumed: true })) });
    const { result } = await startRunner(api);
    expect(api.start).toHaveBeenCalledWith("test-1");
    expect(result.current.state.phase).toBe("running");
    expect(api.logEvent).toHaveBeenCalledWith("att-1", "attempt_resumed");
  });

  it("autosaves once per question after the debounce", async () => {
    const api = fakeApi();
    const { result } = await startRunner(api);
    act(() => {
      result.current.answer("q2", "Par");
      result.current.answer("q2", "Paris");
    });
    expect(api.saveAnswer).not.toHaveBeenCalled();
    await act(async () => { vi.advanceTimersByTime(SAVE_DEBOUNCE_MS); });
    expect(api.saveAnswer).toHaveBeenCalledTimes(1);
    expect(api.saveAnswer).toHaveBeenCalledWith("att-1", "q2", { answer_text: "Paris" });
    expect(result.current.state.saving.q2).toBe("saved");
  });

  it("submits automatically at the deadline, flushing unsaved answers first", async () => {
    const api = fakeApi({ start: vi.fn().mockResolvedValue(startResponse({ deadline: new Date(T0 + 3000).toISOString() })) });
    const { result, onFinished } = await startRunner(api);
    expect(result.current.remaining).toBe(3);
    act(() => result.current.answer("q1", ["o1"]));
    await act(async () => { vi.advanceTimersByTime(3000); });
    await act(async () => {});
    expect(api.saveAnswer).toHaveBeenCalledWith("att-1", "q1", { selected_option_ids: ["o1"] });
    expect(api.submit).toHaveBeenCalledWith("att-1");
    expect(api.saveAnswer.mock.invocationCallOrder[0]).toBeLessThan(api.submit.mock.invocationCallOrder[0]);
    expect(result.current.state.phase).toBe("submitted");
    expect(result.current.state.reason).toBe("time_up");
    expect(onFinished).toHaveBeenCalledWith("att-1", { summary: { status: "submitted" } });
  });

  it("submits only once even if asked twice", async () => {
    const api = fakeApi();
    const { result } = await startRunner(api);
    await act(async () => {
      result.current.submit();
      result.current.submit();
    });
    expect(api.submit).toHaveBeenCalledTimes(1);
  });

  it("sends proctor events to the API and follows a server auto-submit", async () => {
    const api = fakeApi({
      logEvent: vi.fn().mockResolvedValue({ counted: true, violations_count: 3, violation_limit: 2, remaining: 0,
                                            auto_submitted: true, auto_submit_reason: "proctor_limit", status: "submitted" }),
    });
    const { result, onFinished } = await startRunner(api);
    await act(async () => { await result.current.reportViolation("fullscreen_exit"); });
    expect(api.logEvent).toHaveBeenCalledWith("att-1", "fullscreen_exit", {});
    expect(api.report).toHaveBeenCalledWith("att-1");
    expect(api.submit).not.toHaveBeenCalled();
    expect(result.current.state.phase).toBe("submitted");
    expect(onFinished).toHaveBeenCalledWith("att-1", expect.objectContaining({ summary: expect.any(Object) }));
  });

  it("shows the error when the server refuses to start (e.g. no attempts left)", async () => {
    const error = Object.assign(new Error("You have used all 2 attempts for this test."), { code: "P0001" });
    const { result } = await startRunner(fakeApi({ start: vi.fn().mockRejectedValue(error) }));
    expect(result.current.state.phase).toBe("error");
    expect(result.current.state.error).toBe(error);
  });
});

// -----------------------------------------------------------------------------
describe("proctor listeners", () => {
  it("reports every window / clipboard event and blocks copy, paste and right-click", () => {
    const onEvent = vi.fn();
    const detach = attachProctorListeners({ win: window, doc: document, onEvent });

    window.dispatchEvent(new Event("blur"));
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    const copy = new Event("copy", { cancelable: true });
    document.dispatchEvent(copy);
    const paste = new Event("paste", { cancelable: true });
    document.dispatchEvent(paste);
    const menu = new Event("contextmenu", { cancelable: true });
    document.dispatchEvent(menu);

    expect(onEvent.mock.calls.map((c) => c[0])).toEqual(["window_blur", "visibility_hidden", "copy", "paste", "contextmenu"]);
    expect(copy.defaultPrevented && paste.defaultPrevented && menu.defaultPrevented).toBe(true);

    detach();
    window.dispatchEvent(new Event("blur"));
    expect(onEvent).toHaveBeenCalledTimes(5);
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });

  it("detects leaving full screen", () => {
    const onEvent = vi.fn();
    const doc = new EventTarget();
    doc.fullscreenElement = {};
    doc.documentElement = {};
    const detach = attachProctorListeners({ win: new EventTarget(), doc, onEvent });
    doc.fullscreenElement = null;
    doc.dispatchEvent(new Event("fullscreenchange"));
    doc.fullscreenElement = {};
    doc.dispatchEvent(new Event("fullscreenchange"));
    expect(onEvent.mock.calls.map((c) => c[0])).toEqual(["fullscreen_exit", "fullscreen_enter"]);
    detach();
  });
});

// -----------------------------------------------------------------------------
const REPORT = {
  version: 1,
  attempt_id: "att-9",
  test_id: "test-1",
  test_title: "Physics mock 1",
  series_id: "s-1",
  series_title: "Physics series",
  summary: {
    status: "submitted", attempt_number: 1, started_at: "2026-10-26T10:00:00Z", submitted_at: "2026-10-26T10:20:00Z",
    time_taken_secs: 1200, time_limit_mins: 30, score: 1, max_score: 2, total_marks: 7, percentage: 50,
    passing_percentage: 40, passed: true, provisional: true, correct_count: 1, incorrect_count: 0, skipped_count: 1,
    pending_count: 1, pending_marks: 5, rank: 1, total_attempts: 3, percentile: 100, class_average: 40,
    topper_percentage: 50, violations_count: 0, violation_limit: 3, auto_submitted: false, auto_submit_reason: null,
    answers_hidden: false,
  },
  questions: [
    { position: 1, question_id: "q1", text: "Pick one", type: "multiple_choice", status: "correct", points: 1, points_earned: 1,
      options: [{ id: "o1", text: "Right", selected: true, is_correct: true }], explanation: "Because.", section: "General", topic: "Algebra" },
    { position: 2, question_id: "q2", text: "Capital of France", type: "fill_in_blank", status: "skipped", points: 1, points_earned: 0,
      options: [], student_answer: null, correct_answer: "Paris", section: "General", topic: "Geography" },
    { position: 3, question_id: "q3", text: "Explain gravity", type: "short_answer", status: "pending", points: 5, points_earned: null,
      options: [], student_answer: "Mass attracts mass.", correct_answer: null, section: "General", topic: "Physics" },
  ],
  breakdowns: {
    by_section: [{ name: "General", position: 0, total: 3, attempted: 2, correct: 1, incorrect: 0, skipped: 1, pending: 1, graded: 1, accuracy: 100 }],
    by_topic: [], by_difficulty: [],
  },
  strengths: [{ topic: "Algebra", accuracy: 100 }],
  weaknesses: [],
  comparison: { your_percentage: 50, average_percentage: 40, topper_percentage: 50, your_score: 1, average_score: 0.8,
                topper_score: 1, difference_from_average: 10, difference_from_topper: 0 },
};

describe("report page", () => {
  beforeEach(() => vi.resetModules());

  async function renderReport(report = REPORT) {
    vi.doMock("../src/portals/student/services/attemptApi", async (orig) => ({
      ...(await orig()),
      attemptApi: {
        report: vi.fn().mockResolvedValue(report),
        intro: vi.fn().mockResolvedValue({ can_start: true }),
      },
    }));
    const { default: TestReport } = await import("../src/portals/student/pages/TestReport");
    render(
      <MemoryRouter initialEntries={["/student/report/att-9"]}>
        <Routes><Route path="/student/report/:attemptId" element={<TestReport />} /></Routes>
      </MemoryRouter>,
    );
    await screen.findByText("Physics mock 1");
  }

  it("shows the pending-review state for written answers", async () => {
    await renderReport();
    expect(screen.getByText(/1 written answer is pending review \(5 marks\)/)).toBeInTheDocument();
    expect(screen.getByText(/Passed \(provisional\)/)).toBeInTheDocument();
    expect(screen.getAllByText("Pending review").length).toBeGreaterThan(0);
    expect(screen.getByText("5 marks, awaiting review")).toBeInTheDocument();
  });

  it("shows skipped questions with the accepted answer", async () => {
    await renderReport();
    expect(screen.getAllByText("Skipped").length).toBeGreaterThan(0);
    expect(screen.getByText("Not answered")).toBeInTheDocument();
    expect(screen.getByText("Paris")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Retake" })).toBeInTheDocument();
  });

  it("explains an automatic submission", async () => {
    await renderReport({ ...REPORT, summary: { ...REPORT.summary, auto_submitted: true, auto_submit_reason: "proctor_limit", violations_count: 4 } });
    expect(screen.getByText(/submitted automatically after 4 violations/)).toBeInTheDocument();
  });
});

describe("history row", () => {
  it("links finished attempts to their report and running ones to the runner", async () => {
    const { attemptTarget } = await import("../src/portals/student/pages/History");
    expect(attemptTarget({ status: "submitted", has_report: true, attempt_id: "a", test_id: "t" })).toBe("/student/report/a");
    expect(attemptTarget({ status: "in_progress", is_expired: false, attempt_id: "a", test_id: "t" })).toBe("/student/test/t/take");
    expect(attemptTarget({ status: "in_progress", is_expired: true, attempt_id: "a", test_id: "t" })).toBe("/student/report/a");
    expect(attemptTarget({ status: "submitted", has_report: false, attempt_id: "a", test_id: "t" })).toBeNull();
  });
});

describe("runner page", () => {
  beforeEach(() => vi.resetModules());

  it("asks the student to enter full screen before the questions appear", async () => {
    // The runner shows the signed-in email as a watermark (EmailWatermark uses useAuth).
    vi.doMock("../src/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "u-1", email: "student@test.local", role: "student" }, loading: false }) }));
    vi.doMock("../src/portals/student/services/attemptApi", async (orig) => ({
      ...(await orig()),
      attemptApi: fakeApi(),
    }));
    const { default: TestRunner } = await import("../src/portals/student/pages/TestRunner");
    render(
      <MemoryRouter initialEntries={["/student/test/test-1/take"]}>
        <Routes><Route path="/student/test/:testId/take" element={<TestRunner />} /></Routes>
      </MemoryRouter>,
    );
    const begin = await screen.findByRole("button", { name: /begin in full screen/i });
    expect(screen.queryByText("Single")).not.toBeInTheDocument();
    await act(async () => { begin.click(); });
    await waitFor(() => expect(screen.getByText("Single")).toBeInTheDocument());
    expect(screen.getByRole("navigation", { name: "Question palette" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent("30:00");
  });
});
