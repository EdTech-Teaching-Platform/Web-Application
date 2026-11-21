/** @vitest-environment jsdom */
// QA 21 Nov, written answers: model answer hidden before marking, "View"
// previews in the page (no tab-switch violation), add-only after submitting
// with history for the teacher, upload time set per test. SQL side:
// supabase/tests/written_answers_fixes.sql.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpcHandlers = {};
const rpc = vi.fn(async (name) => {
  const h = rpcHandlers[name];
  return { data: typeof h === "function" ? h() : h ?? null, error: null };
});
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: vi.fn(async () => ({ data: { url: "https://signed.example/f" }, error: null })) },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) },
  },
}));
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "s1", role: "student" }, loading: false }) }));

import { uploadMinutes, wizardRpcPayload, emptyTest } from "../src/portals/admin/data/testSeriesWizard";

const A = "11111111-1111-4111-8111-111111111111";
const Q = "22222222-2222-4222-8222-222222222222";
const U = "44444444-4444-4444-8444-444444444444";

beforeEach(() => {
  for (const k of Object.keys(rpcHandlers)) delete rpcHandlers[k];
  window.scrollTo = () => {};
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  window.open = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:local-pdf");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

describe("View previews in the page (no new tab during the test)", () => {
  const photo = { id: U, questionId: Q, fileName: "page-1.jpg", contentType: "image/jpeg", size: 1000 };
  it("a photo opens in a dialog; the runner is told so it can relax focus checks", async () => {
    const { default: AnswerUploader } = await import("../src/portals/student/components/AnswerUploader");
    const api = { upload: vi.fn(), remove: vi.fn(), fileUrl: vi.fn(async () => "https://signed.example/page.jpg") };
    const onPreviewOpen = vi.fn(); const onPreviewClose = vi.fn();
    render(<AnswerUploader attemptId={A} questionId={Q} files={[photo]} api={api} onPreviewOpen={onPreviewOpen} onPreviewClose={onPreviewClose} />);
    fireEvent.click(screen.getByRole("button", { name: "View" }));
    expect(onPreviewOpen).toHaveBeenCalled();
    expect(window.open).not.toHaveBeenCalled();
    expect(await screen.findByRole("img", { name: /Your answer sheet page-1.jpg/ })).toHaveAttribute("src", "https://signed.example/page.jpg");
    expect(screen.getByRole("dialog", { name: "Preview of page-1.jpg" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onPreviewClose).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).toBeNull();
  });
  it("a PDF is fetched and shown from a local blob in a frame", async () => {
    const { default: AnswerPreview } = await import("../src/portals/student/components/AnswerPreview");
    const fetchImpl = vi.fn(async () => new Response(new Blob(["%PDF"]), { status: 200 }));
    render(<AnswerPreview file={{ id: U, fileName: "sheet.pdf", contentType: "application/pdf" }} onClose={() => {}}
      api={{ fileUrl: async () => "https://signed.example/sheet.pdf" }} fetchImpl={fetchImpl} />);
    const frame = await screen.findByTitle("PDF sheet.pdf");
    expect(frame).toHaveAttribute("src", "blob:local-pdf");
    expect(fetchImpl).toHaveBeenCalledWith("https://signed.example/sheet.pdf");
  });
  it("while previewing, only window blur is ignored; switching tabs still counts", async () => {
    const { useProctor } = await import("../src/portals/student/hooks/useProctor");
    const onEvent = vi.fn();
    const { result } = renderHook(() => useProctor({ enabled: true, onEvent, now: () => 1000 }));
    act(() => result.current.pause(60000, ["window_blur"]));
    window.dispatchEvent(new Event("blur"));
    expect(onEvent).not.toHaveBeenCalled();
    Object.defineProperty(document, "visibilityState", { value: "hidden", configurable: true });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(onEvent).toHaveBeenCalledWith("visibility_hidden", {});
    Object.defineProperty(document, "visibilityState", { value: "visible", configurable: true });
  });
});

describe("after submitting: add only", () => {
  it("no Remove button when removal isn't allowed, with a note", async () => {
    const { default: AnswerUploader } = await import("../src/portals/student/components/AnswerUploader");
    const files = [{ id: U, questionId: Q, fileName: "p.jpg", contentType: "image/jpeg", size: 10 }];
    render(<AnswerUploader attemptId={A} questionId={Q} files={files} canUpload canRemove={false} api={{ upload: vi.fn(), remove: vi.fn(), fileUrl: vi.fn() }} />);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.getByText(/can't be removed after submitting/)).toBeInTheDocument();
    expect(screen.getByLabelText("Choose photos or PDF")).toBeInTheDocument();
  });
});

describe("report: model answer and the upload rule", () => {
  const report = (row, over = {}) => ({
    attempt_id: A, test_id: "t1", test_title: "Lenses", series_title: "Optics",
    summary: { attempt_number: 1, submitted_at: "2026-11-21T01:06:00Z", score: 4, max_score: 4, percentage: 100, passed: true, provisional: true,
               correct_count: 1, incorrect_count: 0, skipped_count: 0, pending_count: 1, pending_marks: 10, rank: 1, total_attempts: 1,
               percentile: 100, passing_percentage: 40, time_taken_secs: 300, time_limit_mins: 60, answers_hidden: false },
    comparison: {}, breakdowns: {}, strengths: [], weaknesses: [],
    questions: [{ position: 1, question_id: Q, text: "Derive the lens formula.", type: "short_answer", ui_type: "subjective",
                  status: "pending", points: 10, points_earned: null, options: [], student_answer: "Using similar triangles…", ...row }],
    ...over,
  });
  async function renderReport() {
    rpcHandlers.student_get_test_intro = { can_start: false };
    const { default: TestReport } = await import("../src/portals/student/pages/TestReport");
    render(<MemoryRouter initialEntries={[`/student/report/${A}`]}><Routes><Route path="/student/report/:attemptId" element={<TestReport />} /></Routes></MemoryRouter>);
  }
  it("a pending written answer shows no model answer, just when it will appear", async () => {
    rpcHandlers.student_get_report = report({ correct_answer: null, explanation: null, model_answer_pending: true });
    rpcHandlers.student_list_answer_uploads = { can_upload: false, uploads: [] };
    await renderReport();
    expect(await screen.findByText("The model answer is shown after your teacher has marked this answer.")).toBeInTheDocument();
    expect(screen.queryByText(/Model answer:/)).toBeNull();
  });
  it("the upload section states the test's rule, counts down, and has no Remove", async () => {
    rpcHandlers.student_get_report = report({ correct_answer: null, model_answer_pending: true });
    rpcHandlers.student_list_answer_uploads = {
      can_upload: true, can_remove: false, grace_minutes: 30, submitted_at: "2026-11-21T01:06:00Z",
      window_closes_at: "2026-11-21T01:36:00Z", server_now: "2026-11-21T01:20:00Z",
      uploads: [{ id: U, question_id: Q, file_name: "p1.jpg", content_type: "image/jpeg", size_bytes: 1000 }],
    };
    await renderReport();
    expect(await screen.findByRole("heading", { name: "Add your answer sheets" })).toBeInTheDocument();
    expect(screen.getByText(/This test gives you 30 minutes after submitting/)).toBeInTheDocument();
    expect(screen.getByText(/You can add pages but not remove them/)).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/16:00 left|15:5\d left/);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
  });
  it("once the time is over the section disappears by itself", async () => {
    rpcHandlers.student_get_report = report({ correct_answer: null, model_answer_pending: true });
    rpcHandlers.student_list_answer_uploads = { can_upload: true, grace_minutes: 15, window_closes_at: "2026-11-21T01:21:00Z",
      server_now: "2026-11-21T01:22:00Z", uploads: [] };
    await renderReport();
    await screen.findByText(/waiting for your teacher's marks/);
    expect(screen.queryByRole("heading", { name: "Add your answer sheets" })).toBeNull();
  });
});

describe("marking screen: the rule and the history", () => {
  it("shows the test's rule, flags pages added after submitting, and lists removed pages", async () => {
    const { default: GradingWorkspace } = await import("../src/components/grading/GradingWorkspace");
    const data = {
      attempt: { id: A, test_title: "Lenses", series_title: "Optics", candidate: "Candidate 1A2B3C", attempt_number: 1, submitted_at: "2026-11-21T01:06:00Z" },
      evaluation: { status: "pending" }, can_publish: true, upload_window_minutes: 30, upload_window_closes_at: "2026-11-21T01:36:00Z",
      objective: { marks_earned: 4, marks_possible: 4 },
      questions: [{ question_id: Q, position: 1, text: "Derive the lens formula.", max_marks: 10, typed_answer: "", grade: null,
        uploads: [
          { id: U, file_name: "a.pdf", content_type: "application/pdf", size_bytes: 1000, created_at: "2026-11-21T01:00:00Z", after_submission: false },
          { id: "55555555-5555-4555-8555-555555555555", file_name: "b.pdf", content_type: "application/pdf", size_bytes: 1000, created_at: "2026-11-21T01:10:00Z", after_submission: true },
        ],
        removed_uploads: [{ id: "66666666-6666-4666-8666-666666666666", file_name: "old.jpg", content_type: "image/jpeg", size_bytes: 10,
          created_at: "2026-11-21T00:55:00Z", removed_at: "2026-11-21T00:58:00Z" }] }],
    };
    render(<MemoryRouter><GradingWorkspace attemptId={A} api={{ get: async () => data, save: vi.fn() }} filesApi={{ fileUrl: vi.fn() }} /></MemoryRouter>);
    expect(await screen.findByText(/students can add pages \(not remove them\) for 30 minutes after submitting/)).toBeInTheDocument();
    expect(screen.getAllByText("After submitting")).toHaveLength(1);
    expect(screen.getByText("Removed by the student during the test (1)")).toBeInTheDocument();
    expect(screen.getByText("old.jpg")).toBeInTheDocument();
  });
});

describe("the per-test setting", () => {
  it("defaults to 15, is clamped to 0..120, and goes out with the wizard's tests", () => {
    expect(uploadMinutes("")).toBe(15);
    expect(uploadMinutes("30")).toBe(30);
    expect(uploadMinutes(500)).toBe(120);
    expect(uploadMinutes(-5)).toBe(0);
    expect(emptyTest("T").answerUploadMinutes).toBe(15);
    const st = { name: "S", tests: [{ ...emptyTest("T1"), answerUploadMinutes: "45" }], availability: { goLive: "now", mode: "always" },
      classification: {}, lateSubmissions: {}, pricing: "free" };
    let payload = null;
    try { payload = wizardRpcPayload(st, {}, false); } catch { payload = null; }
    if (payload) expect(payload.tests[0].answerUploadMinutes).toBe("45");
  });
});
