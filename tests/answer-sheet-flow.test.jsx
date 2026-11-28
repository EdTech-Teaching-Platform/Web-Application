/** @vitest-environment jsdom */
// Written answers: typed in the test, answer sheet (PDF / photos) uploaded
// AFTER finishing in a short window, marked by the teacher (QA 22 Nov flow,
// 20261128090000; earlier: 20261120 / 20261121). SQL side:
// supabase/tests/answer_sheet_flow.sql. Replaces written-answers*.test.jsx.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpcHandlers = {};
const rpc = vi.fn(async (name, params) => {
  const h = rpcHandlers[name];
  if (h instanceof Error) return { data: null, error: h };
  return { data: typeof h === "function" ? h(params) : h ?? null, error: null };
});
const invoke = vi.fn(async () => ({ data: { url: "https://signed.example/file" }, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: (...a) => invoke(...a) },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), getSession: async () => ({ data: { session: null } }) },
  },
}));
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "s1", role: "student", email: "s@x.in" }, loading: false }) }));

import { ANSWER_BUCKET, AnswerUploadError, buildAnswerPath, validateAnswerRequest } from "../supabase/functions/answer-uploads/validate.ts";
import { tombstoneEmail } from "../supabase/functions/delete-account/validate.ts";
import { checkAnswerFile, mapSheetStatus, uploadSheetFile } from "../src/services/answerUploadsApi";
import { markProblem } from "../src/components/grading/gradingUtils";
import { uploadMinutes, emptyTest } from "../src/portals/admin/data/testSeriesWizard";
import { pickCameraMode, cameraErrorMessage } from "../src/portals/student/utils/camera";

const A = "11111111-1111-4111-8111-111111111111";
const Q = "22222222-2222-4222-8222-222222222222";
const S = "33333333-3333-4333-8333-333333333333";
const U = "44444444-4444-4444-8444-444444444444";
const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const file = (name, type, size = 2000) => { const f = new File(["x"], name, { type }); Object.defineProperty(f, "size", { value: size }); return f; };
const sheet = (over = {}) => ({
  attempt_id: A, test_id: "t1", status: "submitted", has_written: true, grace_minutes: 5, submitted_at: "2026-11-28T10:00:00Z",
  window_closes_at: "2026-11-28T10:05:00Z", server_now: "2026-11-28T10:01:00Z", can_upload: true, problem: null,
  sheet_submitted_at: null, max_files: 10, uploads: [], ...over,
});

beforeEach(() => {
  for (const k of Object.keys(rpcHandlers)) delete rpcHandlers[k];
  rpc.mockClear(); invoke.mockClear();
  window.scrollTo = () => {};
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
  window.open = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:local");
  URL.revokeObjectURL = vi.fn();
});
afterEach(() => cleanup());

describe("Edge Function validators", () => {
  it("answer-uploads: without a question id the file goes to the attempt's sheet", () => {
    expect(ANSWER_BUCKET).toBe("answer-uploads");
    const r = validateAnswerRequest({ action: "upload", attemptId: A, fileName: "C:\\scans\\sheet.pdf", contentType: "application/pdf", size: 5000 });
    expect(r).toEqual({ action: "upload", attemptId: A, questionId: null, fileName: "sheet.pdf", contentType: "application/pdf", size: 5000 });
    expect(buildAnswerPath(S, A, null, "application/pdf", U)).toBe(`${S}/${A}/sheet/${U}.pdf`);
    expect(buildAnswerPath(S, A, Q, "image/png", U)).toBe(`${S}/${A}/${Q}/${U}.png`);
    expect(() => validateAnswerRequest({ action: "upload", attemptId: A, questionId: "x", contentType: "image/png", size: 1 })).toThrow(AnswerUploadError);
    expect(() => validateAnswerRequest({ action: "upload", attemptId: A, contentType: "text/html", size: 1 })).toThrow(/photo/);
    expect(validateAnswerRequest({ action: "view", uploadId: U })).toEqual({ action: "view", uploadId: U, download: false });
  });
  it("delete-account: the email is released with a tombstone address", () => {
    expect(tombstoneEmail("ABC-1")).toBe("deleted+abc-1@deleted.invalid");
  });
});

describe("upload service", () => {
  it("checks files", () => {
    expect(checkAnswerFile(file("a.pdf", "application/pdf"))).toBeNull();
    expect(checkAnswerFile(file("a.heic", "image/heic"))).toMatch(/HEIC/);
    expect(checkAnswerFile(file("a.pdf", "application/pdf", 11 * 1024 * 1024))).toMatch(/10 MB/);
  });
  it("a sheet file: upload URL without a question -> PUT -> register on the sheet", async () => {
    const inv = vi.fn(async () => ({ path: `${S}/${A}/sheet/${U}.pdf`, signedUrl: "https://put" }));
    const put = vi.fn(async () => {});
    const reg = vi.fn(async () => sheet({ uploads: [{ id: U, question_id: null, file_name: "sheet.pdf", content_type: "application/pdf", size_bytes: 3000 }] }));
    const out = await uploadSheetFile({ attemptId: A, file: file("sheet.pdf", "application/pdf", 3000) }, { invoke: inv, put, rpc: reg });
    expect(inv).toHaveBeenCalledWith("answer-uploads", { action: "upload", attemptId: A, fileName: "sheet.pdf", contentType: "application/pdf", size: 3000 });
    expect(reg).toHaveBeenCalledWith("student_register_sheet_upload", expect.objectContaining({ p_path: `${S}/${A}/sheet/${U}.pdf` }));
    expect(out.files).toHaveLength(1);
    expect(out.graceMinutes).toBe(5);
  });
  it("maps the sheet status", () => {
    const s = mapSheetStatus(sheet({ auto_submit_reason: "proctor_limit", can_upload: false, problem: "too many violations" }));
    expect(s).toMatchObject({ hasWritten: true, canUpload: false, autoSubmitReason: "proctor_limit", maxFiles: 10, problem: "too many violations" });
  });
});

describe("camera", () => {
  it("phones use the native camera, computers the in-page one", () => {
    expect(pickCameraMode({ matchMedia: () => ({ matches: true }), navigator: {} })).toBe("native");
    expect(pickCameraMode({ matchMedia: () => ({ matches: false }), navigator: { mediaDevices: { getUserMedia() {} } } })).toBe("inpage");
    expect(pickCameraMode({ matchMedia: () => ({ matches: false }), navigator: {} })).toBe("files");
    expect(cameraErrorMessage({ name: "NotAllowedError" })).toMatch(/blocked/);
  });
  it("on a computer, Take a photo opens the camera in the page and the photo is uploaded", async () => {
    const { default: AnswerUploader } = await import("../src/portals/student/components/AnswerUploader");
    const stream = { getTracks: () => [{ stop: vi.fn() }] };
    const getUserMedia = vi.fn(async () => stream);
    Object.defineProperty(window.navigator, "mediaDevices", { value: { getUserMedia }, configurable: true });
    HTMLMediaElement.prototype.play = vi.fn(async () => {});
    HTMLCanvasElement.prototype.getContext = vi.fn(() => ({ drawImage: vi.fn() }));
    HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob(["jpg"], { type: "image/jpeg" })); };
    const api = { upload: vi.fn(async () => mapSheetStatus(sheet())), remove: vi.fn(), fileUrl: vi.fn() };
    render(<AnswerUploader attemptId={A} questionId={null} files={[]} api={api} maxFiles={10} cameraMode="inpage" />);
    fireEvent.click(screen.getByRole("button", { name: "Take a photo" }));
    expect(getUserMedia).toHaveBeenCalled();
    const capture = await screen.findByRole("button", { name: "Capture" });
    await waitFor(() => expect(capture).toBeEnabled());
    fireEvent.click(capture);
    fireEvent.click(await screen.findByRole("button", { name: "Use this photo" }));
    await wait();
    expect(api.upload).toHaveBeenCalledWith(expect.objectContaining({ attemptId: A, questionId: null, file: expect.any(File) }));
  });
  it("a blocked camera says what to do", async () => {
    const { default: CameraCapture } = await import("../src/portals/student/components/CameraCapture");
    render(<CameraCapture onCapture={vi.fn()} onClose={vi.fn()} mediaDevices={{ getUserMedia: async () => { throw Object.assign(new Error("x"), { name: "NotAllowedError" }); } }} />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/Camera access was blocked/);
  });
});

describe("the test runner", () => {
  it("written questions are typed; the note points to the answer-sheet step", async () => {
    const { WrittenAnswer } = await import("../src/portals/student/pages/TestRunner");
    const onChange = vi.fn();
    render(<WrittenAnswer value="" onChange={onChange} sheet={{ hasWritten: true, graceMinutes: 5 }} />);
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "F = ma" } });
    expect(onChange).toHaveBeenCalledWith("F = ma");
    expect(screen.getByText(/After you finish the test you'll have 5 minutes to upload a PDF or photos/)).toBeInTheDocument();
    expect(screen.queryByRole("tab")).toBeNull();
    expect(screen.queryByTestId("answer-uploader")).toBeNull();
  });
});

describe("the answer-sheet screen", () => {
  async function renderSheet(status, api) {
    const { default: AnswerSheet } = await import("../src/portals/student/pages/AnswerSheet");
    render(<MemoryRouter initialEntries={[`/student/answer-sheet/${A}`]}><Routes>
      <Route path="/student/answer-sheet/:attemptId" element={<AnswerSheet api={api} />} />
      <Route path="/student/report/:attemptId" element={<p>Report page</p>} />
      <Route path="/student/test/:testId/take" element={<p>Runner</p>} />
    </Routes></MemoryRouter>);
  }
  const apiFor = (status) => ({
    status: vi.fn(async () => mapSheetStatus(status)),
    submit: vi.fn(async () => mapSheetStatus({ ...status, can_upload: false, sheet_submitted_at: "2026-11-28T10:02:00Z" })),
    upload: vi.fn(), remove: vi.fn(), fileUrl: vi.fn(),
  });
  it("shows the countdown and the rule; Submit asks first, then goes to the report", async () => {
    const api = apiFor(sheet({ uploads: [{ id: U, question_id: null, file_name: "sheet.pdf", content_type: "application/pdf", size_bytes: 3000 }] }));
    await renderSheet(null, api);
    expect(await screen.findByRole("heading", { name: "Upload your answer sheet" })).toBeInTheDocument();
    expect(screen.getByRole("timer")).toHaveTextContent(/04:0\d|03:5\d/);
    expect(screen.getByText(/You have 5 minutes to\s+upload what you wrote on paper/)).toBeInTheDocument();
    expect(screen.getByText("sheet.pdf")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Submit" }));
    const dialog = screen.getByRole("dialog", { name: "Submit your answer sheet?" });
    expect(within(dialog).getByText(/can't add or remove anything/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Submit" }));
    expect(await screen.findByText("Report page")).toBeInTheDocument();
    expect(api.submit).toHaveBeenCalledWith(A);
  });
  it("nothing uploaded: Submit stays disabled until a file has finished uploading (QA 28 Nov)", async () => {
    let finish;
    const api = apiFor(sheet());
    api.upload = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
    await renderSheet(null, api);
    const submit = await screen.findByRole("button", { name: "Submit" });
    expect(submit).toBeDisabled();
    expect(screen.getByText("Upload your answer sheet to submit.")).toBeInTheDocument();
    const input = document.querySelector('input[type="file"][multiple]');
    fireEvent.change(input, { target: { files: [new File(["%PDF"], "sheet.pdf", { type: "application/pdf" })] } });
    expect(await screen.findByText("Wait for the upload to finish.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Submit" })).toBeDisabled();
    await act(async () => {
      finish(mapSheetStatus(sheet({ uploads: [{ id: U, question_id: null, file_name: "sheet.pdf", content_type: "application/pdf", size_bytes: 4 }] })));
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Submit" })).toBeEnabled());
    expect(screen.getByText("1 file ready.")).toBeInTheDocument();
  });
  it("when the time is up it submits by itself", async () => {
    const api = apiFor(sheet({ server_now: "2026-11-28T10:05:00Z" }));
    await renderSheet(null, api);
    expect(await screen.findByText("Report page")).toBeInTheDocument();
    expect(api.submit).toHaveBeenCalledWith(A);
  });
  it("closed (violations, already submitted, over): straight to the report", async () => {
    await renderSheet(null, apiFor(sheet({ can_upload: false, auto_submit_reason: "proctor_limit", problem: "too many violations" })));
    expect(await screen.findByText("Report page")).toBeInTheDocument();
  });
});

describe("the report", () => {
  const report = (row = {}, over = {}) => ({
    attempt_id: A, test_id: "t1", test_title: "Motion", series_title: "Mechanics",
    summary: { attempt_number: 1, submitted_at: "2026-11-28T10:00:00Z", score: 4, max_score: 4, percentage: 100, passed: true, provisional: true,
               correct_count: 1, incorrect_count: 0, skipped_count: 0, pending_count: 1, pending_marks: 10, rank: 1, total_attempts: 1,
               percentile: 100, passing_percentage: 40, time_taken_secs: 300, time_limit_mins: 60, answers_hidden: false },
    comparison: {}, breakdowns: {}, strengths: [], weaknesses: [],
    questions: [{ position: 2, question_id: Q, text: "Derive v = u + at.", type: "short_answer", ui_type: "subjective", status: "pending",
                  points: 10, points_earned: null, options: [], student_answer: "", correct_answer: null, model_answer_pending: true, ...row }],
    ...over,
  });
  async function renderReport() {
    rpcHandlers.student_get_test_intro = { can_start: false };
    rpcHandlers.student_list_answer_uploads = { can_upload: false, uploads: [] };
    const { default: TestReport } = await import("../src/portals/student/pages/TestReport");
    render(<MemoryRouter initialEntries={[`/student/report/${A}`]}><Routes><Route path="/student/report/:attemptId" element={<TestReport />} /></Routes></MemoryRouter>);
  }
  it("while the sheet is open: a way back to the upload screen", async () => {
    rpcHandlers.student_get_report = report();
    rpcHandlers.student_sheet_status = sheet();
    await renderReport();
    expect(await screen.findByRole("link", { name: "Continue to upload" })).toHaveAttribute("href", `/student/answer-sheet/${A}`);
    expect(screen.queryByText(/model answer/i)).toBeNull();
  });
  it("after Submit: the sheet files (in-page preview) and 'On your answer sheet'", async () => {
    rpcHandlers.student_get_report = report();
    rpcHandlers.student_sheet_status = sheet({ can_upload: false, sheet_submitted_at: "2026-11-28T10:02:00Z",
      uploads: [{ id: U, question_id: null, file_name: "sheet.pdf", content_type: "application/pdf", size_bytes: 3000 }] });
    await renderReport();
    expect(await screen.findByText(/1 file submitted at/)).toBeInTheDocument();
    expect(screen.getByText("On your answer sheet")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /sheet.pdf/ }));
    expect(screen.getByRole("dialog", { name: "Preview of sheet.pdf" })).toBeInTheDocument();
    expect(window.open).not.toHaveBeenCalled();
  });
  it("after the marks: no model answer is shown, even an old stored one (QA 28 Nov)", async () => {
    rpcHandlers.student_get_report = report({ status: "partial", points_earned: 7, correct_answer: "a = (v - u) / t", model_answer_pending: undefined,
      teacher_evaluation: { marks_awarded: 7, feedback: "Good." } }, { teacher: { status: "published", overall_feedback: "Well done." } });
    rpcHandlers.student_sheet_status = sheet({ can_upload: false });
    await renderReport();
    expect(await screen.findByText("Good.")).toBeInTheDocument();
    expect(screen.queryByText(/Model answer/)).toBeNull();
    expect(screen.queryByText("a = (v - u) / t")).toBeNull();
  });
});

describe("marking", () => {
  const detail = (over = {}) => ({
    attempt: { id: A, test_title: "Motion", series_title: "Mechanics", candidate: "Candidate 32FF18", attempt_number: 2, submitted_at: "2026-11-28T10:00:00Z" },
    evaluation: { status: "pending" }, can_publish: true, upload_window_minutes: 5, upload_window_closes_at: "2026-11-28T10:02:00Z",
    objective: { marks_earned: 4, marks_possible: 4 },
    sheet: { files: [{ id: U, file_name: "sheet.pdf", content_type: "application/pdf", size_bytes: 3000, created_at: "2026-11-28T10:01:00Z" }],
             removed: [{ id: S, file_name: "blurry.jpg", content_type: "image/jpeg", size_bytes: 10, created_at: "2026-11-28T10:00:30Z", removed_at: "2026-11-28T10:00:50Z" }],
             submitted_at: "2026-11-28T10:02:00Z" },
    questions: [{ question_id: Q, position: 1, text: "Derive v = u + at.", max_marks: 4, typed_answer: "", uploads: [], grade: null }],
    ...over,
  });
  it("the sheet is next to the questions; an untyped answer isn't 'Not answered'; publish is open", async () => {
    const { default: GradingWorkspace } = await import("../src/components/grading/GradingWorkspace");
    render(<MemoryRouter><GradingWorkspace attemptId={A} api={{ get: async () => detail(), save: vi.fn() }} filesApi={{ fileUrl: vi.fn() }} /></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Answer sheet (1 file)" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Open sheet.pdf/ })).toBeInTheDocument();
    expect(screen.getByText(/Submitted 28 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByText("Removed before submitting (1)")).toBeInTheDocument();
    expect(screen.queryByText("Not answered")).toBeNull();
    expect(screen.getByText("See the answer sheet")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Marks (out of 4)"), { target: { value: "4" } });
    expect(screen.getByRole("button", { name: "Publish marks" })).toBeEnabled();
  });
  it("while the student is still uploading, only a draft", async () => {
    const { default: GradingWorkspace } = await import("../src/components/grading/GradingWorkspace");
    render(<MemoryRouter><GradingWorkspace attemptId={A} api={{ get: async () => detail({ can_publish: false, sheet: { files: [], removed: [], submitted_at: null } }), save: vi.fn() }} filesApi={{ fileUrl: vi.fn() }} /></MemoryRouter>);
    expect((await screen.findAllByText(/still (on the answer-sheet screen|uploading their answer sheet)/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Publish marks" })).toBeDisabled();
    expect(screen.getByText("No answer sheet uploaded.")).toBeInTheDocument();
  });
  it("marks are validated; the queue shows who is still uploading", async () => {
    expect(markProblem("5", 4)).toMatch(/Between 0 and 4/);
    const { default: GradingQueue } = await import("../src/components/grading/GradingQueue");
    const api = { list: vi.fn(async () => ({ rows: [{ attempt_id: A, test_title: "Motion", series_title: "Mechanics", candidate: "Candidate 32FF18",
      attempt_number: 2, submitted_at: "2026-11-28T10:00:00Z", written_count: 1, pending_count: 1, upload_count: 1, evaluation_status: "pending",
      upload_window_closes_at: new Date(Date.now() + 60000).toISOString() }], total: 1 })) };
    render(<MemoryRouter><GradingQueue basePath="/admin/evaluations" api={api} /></MemoryRouter>);
    expect(await screen.findByText("Student uploading")).toBeInTheDocument();
  });
});

describe("settings", () => {
  it("default 5 minutes after finishing, clamped 0..120", () => {
    expect(uploadMinutes("")).toBe(5);
    expect(uploadMinutes(500)).toBe(120);
    expect(emptyTest("T").answerUploadMinutes).toBe(5);
  });
  it("the proctor still ignores only window blur when asked (in-page previews)", async () => {
    const { useProctor } = await import("../src/portals/student/hooks/useProctor");
    const onEvent = vi.fn();
    const { result } = renderHook(() => useProctor({ enabled: true, onEvent, now: () => 1000 }));
    act(() => result.current.pause(60000, ["window_blur"]));
    window.dispatchEvent(new Event("blur"));
    expect(onEvent).not.toHaveBeenCalled();
  });
});
