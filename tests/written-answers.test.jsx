/** @vitest-environment jsdom */
// Written answers, typed or uploaded, marked by the teacher (client, 20 Nov;
// 20261120090000). SQL side: supabase/tests/written_answers.sql.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, renderHook, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpcHandlers = {};
const rpc = vi.fn(async (name) => {
  const h = rpcHandlers[name];
  if (h instanceof Error) return { data: null, error: h };
  return { data: typeof h === "function" ? h() : h ?? null, error: null };
});
const invoke = vi.fn(async () => ({ data: { url: "https://signed.example/file" }, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: (...a) => invoke(...a) },
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      getSession: async () => ({ data: { session: { access_token: "t" } } }),
    },
  },
}));
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => ({ user: { id: "s1", role: "student", email: "s@x.in" }, loading: false }) }));

import { ANSWER_BUCKET, AnswerUploadError, buildAnswerPath, validateAnswerRequest } from "../supabase/functions/answer-uploads/validate.ts";
import { checkAnswerFile, mapAnswerUploads, uploadAnswerFile } from "../src/services/answerUploadsApi";
import { markProblem } from "../src/components/grading/gradingUtils";

const A = "11111111-1111-4111-8111-111111111111";
const Q = "22222222-2222-4222-8222-222222222222";
const S = "33333333-3333-4333-8333-333333333333";
const U = "44444444-4444-4444-8444-444444444444";
const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const file = (name, type, size = 2000) => { const f = new File(["x"], name, { type }); Object.defineProperty(f, "size", { value: size }); return f; };

beforeEach(() => {
  for (const k of Object.keys(rpcHandlers)) delete rpcHandlers[k];
  rpc.mockClear(); invoke.mockClear();
  window.scrollTo = () => {};
  // jsdom has no IntersectionObserver (the report's reveal animations use it)
  window.IntersectionObserver = class { observe() {} unobserve() {} disconnect() {} takeRecords() { return []; } };
});
afterEach(() => cleanup());

describe("answer-uploads Edge Function validators", () => {
  it("upload: ids, type and size are checked; the path comes from ids and the type", () => {
    expect(ANSWER_BUCKET).toBe("answer-uploads");
    const ok = validateAnswerRequest({ action: "upload", attemptId: A, questionId: Q, fileName: "C:\\pics\\page1.jpg", contentType: "image/jpeg", size: 5000 });
    expect(ok).toEqual({ action: "upload", attemptId: A, questionId: Q, fileName: "page1.jpg", contentType: "image/jpeg", size: 5000 });
    expect(() => validateAnswerRequest({ action: "upload", attemptId: "x", questionId: Q, contentType: "image/jpeg", size: 1 })).toThrow(AnswerUploadError);
    expect(() => validateAnswerRequest({ action: "upload", attemptId: A, questionId: Q, contentType: "text/html", size: 1 })).toThrow(/photo/);
    expect(() => validateAnswerRequest({ action: "upload", attemptId: A, questionId: Q, contentType: "application/pdf", size: 11 * 1024 * 1024 })).toThrow(/10 MB/);
    expect(buildAnswerPath(S, A, Q, "application/pdf", U)).toBe(`${S}/${A}/${Q}/${U}.pdf`);
    expect(() => buildAnswerPath("../x", A, Q, "image/png", U)).toThrow();
  });
  it("view: a file id; download is optional", () => {
    expect(validateAnswerRequest({ action: "view", uploadId: U })).toEqual({ action: "view", uploadId: U, download: false });
    expect(() => validateAnswerRequest({ action: "view", uploadId: "nope" })).toThrow(/file id/);
    expect(() => validateAnswerRequest({ action: "delete" })).toThrow(/Unknown action/);
  });
});

describe("answer upload service", () => {
  it("checks files: photos and PDFs only, HEIC explained, PDFs up to 10 MB", () => {
    expect(checkAnswerFile(file("a.jpg", "image/jpeg"))).toBeNull();
    expect(checkAnswerFile(file("a.pdf", "application/pdf"))).toBeNull();
    expect(checkAnswerFile(file("a.pdf", "application/pdf", 11 * 1024 * 1024))).toMatch(/larger than 10 MB/);
    expect(checkAnswerFile(file("a.heic", "image/heic"))).toMatch(/HEIC/);
    expect(checkAnswerFile(file("a.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"))).toMatch(/photo .* or a PDF/);
  });
  it("uploads: (photo resized) -> upload URL -> PUT -> register, and groups files by question", async () => {
    const prepare = vi.fn(async () => ({ file: file("page.webp", "image/webp", 900) }));
    const inv = vi.fn(async () => ({ path: `${S}/${A}/${Q}/${U}.webp`, signedUrl: "https://put" }));
    const put = vi.fn(async () => {});
    const reg = vi.fn(async () => ({ can_upload: true, window_closes_at: "2026-11-20T10:15:00Z",
      uploads: [{ id: U, question_id: Q, file_name: "page.webp", content_type: "image/webp", size_bytes: 900 }] }));
    const out = await uploadAnswerFile({ attemptId: A, questionId: Q, file: file("IMG_1.jpg", "image/jpeg", 4_000_000) }, { prepare, invoke: inv, put, rpc: reg });
    expect(prepare).toHaveBeenCalled();
    expect(inv).toHaveBeenCalledWith("answer-uploads", { action: "upload", attemptId: A, questionId: Q, fileName: "page.webp", contentType: "image/webp", size: 900 });
    expect(put).toHaveBeenCalledWith("https://put", expect.any(File), expect.anything());
    expect(reg).toHaveBeenCalledWith("student_register_answer_upload", expect.objectContaining({ p_path: `${S}/${A}/${Q}/${U}.webp`, p_content_type: "image/webp" }));
    expect(out.canUpload).toBe(true);
    expect(out.byQuestion[Q]).toHaveLength(1);
  });
  it("a PDF is sent as it is", async () => {
    const prepare = vi.fn();
    const inv = vi.fn(async () => ({ path: "p", signedUrl: "u" }));
    await uploadAnswerFile({ attemptId: A, questionId: Q, file: file("sheet.pdf", "application/pdf", 3000) },
      { prepare, invoke: inv, put: async () => {}, rpc: async () => ({ uploads: [] }) });
    expect(prepare).not.toHaveBeenCalled();
    expect(inv.mock.calls[0][1]).toMatchObject({ contentType: "application/pdf", size: 3000 });
  });
});

describe("AnswerUploader", () => {
  const files = [{ id: U, questionId: Q, fileName: "page-1.jpg", contentType: "image/jpeg", size: 120000 }];
  it("uploads a picked file, shows the list, removes, and pauses proctoring while picking", async () => {
    const { default: AnswerUploader } = await import("../src/portals/student/pages/../components/AnswerUploader");
    const next = mapAnswerUploads({ can_upload: true, uploads: [{ id: U, question_id: Q, file_name: "page-1.jpg", content_type: "image/jpeg", size_bytes: 120000 }] });
    const api = { upload: vi.fn(async () => next), remove: vi.fn(async () => mapAnswerUploads({ can_upload: true, uploads: [] })), fileUrl: vi.fn(async () => "https://signed") };
    const onChange = vi.fn(); const onPickStart = vi.fn(); const onPickEnd = vi.fn();
    const { rerender } = render(<AnswerUploader attemptId={A} questionId={Q} files={[]} api={api} onChange={onChange} onPickStart={onPickStart} onPickEnd={onPickEnd} />);
    const input = screen.getByLabelText("Choose photos or PDF");
    fireEvent.click(input);
    expect(onPickStart).toHaveBeenCalled();
    fireEvent.change(input, { target: { files: [file("page-1.jpg", "image/jpeg")] } });
    await wait();
    expect(onPickEnd).toHaveBeenCalled();
    expect(api.upload).toHaveBeenCalledWith(expect.objectContaining({ attemptId: A, questionId: Q }));
    expect(onChange).toHaveBeenCalledWith(next);
    rerender(<AnswerUploader attemptId={A} questionId={Q} files={files} api={api} onChange={onChange} />);
    expect(screen.getByText("page-1.jpg")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Remove page-1.jpg" }));
    await wait();
    expect(api.remove).toHaveBeenCalledWith(U);
  });
  it("a wrong file type is reported and not uploaded", async () => {
    const { default: AnswerUploader } = await import("../src/portals/student/components/AnswerUploader");
    const api = { upload: vi.fn(), remove: vi.fn(), fileUrl: vi.fn() };
    render(<AnswerUploader attemptId={A} questionId={Q} files={[]} api={api} />);
    fireEvent.change(screen.getByLabelText("Choose photos or PDF"), { target: { files: [file("a.heic", "image/heic")] } });
    expect(await screen.findByRole("alert")).toHaveTextContent(/HEIC/);
    expect(api.upload).not.toHaveBeenCalled();
  });
  it("5 files: no more buttons; closed uploads: view only", async () => {
    const { default: AnswerUploader } = await import("../src/portals/student/components/AnswerUploader");
    const five = Array.from({ length: 5 }, (_, i) => ({ ...files[0], id: `${i}${U.slice(1)}`, fileName: `p${i}.jpg` }));
    const api = { upload: vi.fn(), remove: vi.fn(), fileUrl: vi.fn() };
    const { rerender } = render(<AnswerUploader attemptId={A} questionId={Q} files={five} api={api} />);
    expect(screen.queryByLabelText("Take a photo")).toBeNull();
    expect(screen.getByText(/maximum of 5 files/)).toBeInTheDocument();
    rerender(<AnswerUploader attemptId={A} questionId={Q} files={files} canUpload={false} api={api} />);
    expect(screen.getByText("Uploads are closed for this test.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();
    expect(screen.getByRole("button", { name: "View" })).toBeInTheDocument();
  });
});

describe("test runner: type or upload", () => {
  it("a written question offers Type answer and Upload answer sheet", async () => {
    const { WrittenAnswer } = await import("../src/portals/student/pages/TestRunner");
    const onChange = vi.fn();
    const upload = { attemptId: A, files: [], canUpload: true, onChange: vi.fn(), onPickStart: vi.fn(), onPickEnd: vi.fn() };
    render(<WrittenAnswer question={{ id: Q, type: "short_answer" }} value="" onChange={onChange} upload={upload} />);
    expect(screen.getByRole("tab", { name: "Type answer" })).toHaveAttribute("aria-selected", "true");
    fireEvent.change(screen.getByLabelText("Your answer"), { target: { value: "F = ma" } });
    expect(onChange).toHaveBeenCalledWith("F = ma");
    fireEvent.click(screen.getByRole("tab", { name: "Upload answer sheet" }));
    expect(screen.getByTestId("answer-uploader")).toBeInTheDocument();
    expect(screen.getByText(/15 minutes after the test ends/)).toBeInTheDocument();
    expect(screen.queryByText(/evaluated by AI/)).toBeNull();
  });
  it("with uploads and no text it opens on the upload tab", async () => {
    const { WrittenAnswer } = await import("../src/portals/student/pages/TestRunner");
    const upload = { attemptId: A, files: [{ id: U, fileName: "p.jpg", contentType: "image/jpeg", size: 10 }], canUpload: true };
    render(<WrittenAnswer question={{ id: Q, type: "short_answer" }} value="" onChange={() => {}} upload={upload} />);
    expect(screen.getByRole("tab", { name: "Upload answer sheet (1)" })).toHaveAttribute("aria-selected", "true");
  });
});

describe("proctoring pause while picking a file", () => {
  it("window changes are ignored while paused, counted again after the grace", async () => {
    const { useProctor, RESUME_GRACE_MS } = await import("../src/portals/student/hooks/useProctor");
    let t = 1000;
    const onEvent = vi.fn();
    const { result } = renderHook(() => useProctor({ enabled: true, onEvent, now: () => t }));
    act(() => result.current.pause());
    window.dispatchEvent(new Event("blur"));
    expect(onEvent).not.toHaveBeenCalled();
    document.dispatchEvent(new Event("copy", { cancelable: true }));
    expect(onEvent).toHaveBeenCalledWith("copy", {});
    act(() => result.current.resume());
    t += RESUME_GRACE_MS + 1;
    window.dispatchEvent(new Event("blur"));
    expect(onEvent).toHaveBeenCalledWith("window_blur", {});
  });
});

describe("report: teacher marks, late uploads", () => {
  const report = (over = {}) => ({
    attempt_id: A, test_id: "t1", test_title: "Motion", series_title: "Mechanics",
    summary: { attempt_number: 1, submitted_at: "2026-11-20T10:00:00Z", score: 22, max_score: 34, percentage: 64.7, passed: true,
               correct_count: 2, incorrect_count: 1, partial_count: 1, skipped_count: 0, pending_count: 0, pending_marks: 0, rank: 1,
               total_attempts: 1, percentile: 100, passing_percentage: 40, time_taken_secs: 300, time_limit_mins: 60, answers_hidden: false },
    comparison: {}, breakdowns: {}, strengths: [], weaknesses: [],
    questions: [{ position: 2, question_id: Q, text: "State Newton's second law.", type: "short_answer", ui_type: "subjective",
                  status: "partial", points: 10, points_earned: 8, options: [], student_answer: "Force = mass x acceleration",
                  teacher_evaluation: { marks_awarded: 8, feedback: "Good, add the formula." } }],
    teacher: { status: "published", overall_feedback: "Solid start. Practise diagrams.", evaluated_at: "2026-11-20T12:00:00Z" },
    ...over,
  });
  async function renderReport() {
    rpcHandlers.student_get_test_intro = { can_start: false };
    const { default: TestReport } = await import("../src/portals/student/pages/TestReport");
    render(<MemoryRouter initialEntries={[`/student/report/${A}`]}><Routes><Route path="/student/report/:attemptId" element={<TestReport />} /></Routes></MemoryRouter>);
  }
  it("shows the teacher's overall and per-question feedback and the uploaded sheets", async () => {
    rpcHandlers.student_get_report = report();
    rpcHandlers.student_list_answer_uploads = { can_upload: false, uploads: [{ id: U, question_id: Q, file_name: "p1.jpg", content_type: "image/jpeg", size_bytes: 204800 }] };
    await renderReport();
    expect(await screen.findByRole("heading", { name: "Your teacher's evaluation" })).toBeInTheDocument();
    expect(screen.getByText("Solid start. Practise diagrams.")).toBeInTheDocument();
    expect(screen.getByText("Marked by teacher")).toBeInTheDocument();
    expect(screen.getByText("Good, add the formula.")).toBeInTheDocument();
    expect(screen.getByText("8 / 10")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: /Page 1 · 200 KB/ })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Add your answer sheets" })).toBeNull();
  });
  it("within 15 minutes of the test: add answer sheets per written question", async () => {
    rpcHandlers.student_get_report = report({ teacher: undefined, questions: [{ ...report().questions[0], status: "pending", points_earned: null, teacher_evaluation: undefined, student_answer: "" }],
      summary: { ...report().summary, pending_count: 1, pending_marks: 10 } });
    rpcHandlers.student_list_answer_uploads = { can_upload: true, window_closes_at: "2026-11-20T10:15:00Z", uploads: [] };
    await renderReport();
    expect(await screen.findByRole("heading", { name: "Add your answer sheets" })).toBeInTheDocument();
    expect(screen.getByText(/waiting for your teacher's marks/)).toBeInTheDocument();
    expect(screen.getByTestId("answer-uploader")).toBeInTheDocument();
  });
});

describe("marking screens", () => {
  it("validates marks", () => {
    expect(markProblem("", 10)).toBeNull();
    expect(markProblem("7.5", 10)).toBeNull();
    expect(markProblem("11", 10)).toMatch(/Between 0 and 10/);
    expect(markProblem("-1", 10)).toMatch(/Between/);
    expect(markProblem("abc", 10)).toMatch(/number/);
  });

  it("the queue lists attempts with the candidate code and links to marking", async () => {
    const { default: GradingQueue } = await import("../src/components/grading/GradingQueue");
    const api = { list: vi.fn(async () => ({ rows: [{ attempt_id: A, test_title: "Motion", series_title: "Mechanics", candidate: "Candidate 3F9A2C",
      attempt_number: 1, submitted_at: "2026-11-20T10:00:00Z", written_count: 3, pending_count: 3, upload_count: 4, evaluation_status: "pending" }], total: 1 })) };
    render(<MemoryRouter><GradingQueue basePath="/teacher/evaluate" api={api} /></MemoryRouter>);
    expect(await screen.findByText("Candidate 3F9A2C")).toBeInTheDocument();
    expect(screen.getByText(/3 to mark · 4 uploaded files/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Evaluate" })).toHaveAttribute("href", `/teacher/evaluate/${A}`);
    fireEvent.click(screen.getByRole("tab", { name: "Marked" }));
    await waitFor(() => expect(api.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: "published" })));
  });

  const detail = (over = {}) => ({
    attempt: { id: A, test_title: "Motion", series_title: "Mechanics", candidate: "Candidate 3F9A2C", attempt_number: 1, submitted_at: "2026-11-20T10:00:00Z" },
    evaluation: { status: "pending" }, can_publish: true, upload_window_closes_at: "2026-11-20T10:15:00Z",
    objective: { count: 1, marks_earned: 4, marks_possible: 4 },
    questions: [
      { question_id: Q, position: 2, text: "State Newton's second law.", max_marks: 10, typed_answer: "F = ma", uploads: [], marking_guide: "5 + 5", model_answer: "F = ma", grade: null },
      { question_id: U, position: 3, text: "Derive v = u + at.", max_marks: 10, typed_answer: "", grade: null,
        uploads: [{ id: S, file_name: "sheet.pdf", content_type: "application/pdf", size_bytes: 300000 }] },
    ],
    ...over,
  });

  it("marks each question, saves a draft, then publishes after confirming", async () => {
    const { default: GradingWorkspace } = await import("../src/components/grading/GradingWorkspace");
    const api = { get: vi.fn(async () => detail()), save: vi.fn(async (id, grades, overall, publish) => detail({ evaluation: { status: publish ? "published" : "draft" } })) };
    const filesApi = { fileUrl: vi.fn(async () => "https://signed") };
    render(<MemoryRouter><GradingWorkspace attemptId={A} backTo="/teacher/evaluate" api={api} filesApi={filesApi} /></MemoryRouter>);
    expect(await screen.findByText("Candidate 3F9A2C")).toBeInTheDocument();
    expect(screen.getAllByText("F = ma").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: /Open sheet.pdf/ })).toBeInTheDocument();
    const publish = screen.getByRole("button", { name: "Publish marks" });
    expect(publish).toBeDisabled();
    expect(screen.getByText(/Give marks for 2 more answered questions/)).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText("Marks (out of 10)", { selector: `#mark-${Q}` }), { target: { value: "12" } });
    expect(screen.getByText("Between 0 and 10.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Marks (out of 10)", { selector: `#mark-${Q}` }), { target: { value: "8" } });
    fireEvent.click(within(screen.getByLabelText("Marks (out of 10)", { selector: `#mark-${U}` }).parentElement).getByRole("button", { name: "Full" }));
    fireEvent.change(screen.getAllByPlaceholderText("What was good, what was missing")[0], { target: { value: "Add the formula." } });
    expect(screen.getByText("22 / 24 marks")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Save draft" }));
    await wait();
    expect(api.save).toHaveBeenLastCalledWith(A, [
      { questionId: Q, marks: 8, feedback: "Add the formula." }, { questionId: U, marks: 10, feedback: "" },
    ], "", false);
  });

  it("publish waits for the student's upload window", async () => {
    const { default: GradingWorkspace } = await import("../src/components/grading/GradingWorkspace");
    const api = { get: vi.fn(async () => detail({ can_publish: false, questions: [{ ...detail().questions[0], grade: { marks: 8 } }] })), save: vi.fn() };
    render(<MemoryRouter><GradingWorkspace attemptId={A} api={api} filesApi={{ fileUrl: vi.fn() }} /></MemoryRouter>);
    expect((await screen.findAllByText(/can (still )?upload answer sheets until/)).length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "Publish marks" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save draft" })).toBeEnabled();
  });

  it("publishing asks first, then sends publish = true", async () => {
    const { default: GradingWorkspace } = await import("../src/components/grading/GradingWorkspace");
    const ready = detail({ questions: detail().questions.map((q) => ({ ...q, grade: { marks: 5, feedback: "" } })) });
    const api = { get: vi.fn(async () => ready), save: vi.fn(async () => ({ ...ready, evaluation: { status: "published", published_at: "2026-11-20T12:00:00Z" } })) };
    render(<MemoryRouter><GradingWorkspace attemptId={A} api={api} filesApi={{ fileUrl: vi.fn() }} /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Publish marks" }));
    const dialog = screen.getByRole("dialog", { name: "Publish these marks?" });
    expect(within(dialog).getByText(/14 \/ 24/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Publish" }));
    await wait();
    expect(api.save).toHaveBeenCalledWith(A, expect.any(Array), "", true);
    expect(screen.getByText(/Marks published. The student has been notified./)).toBeInTheDocument();
  });
});
