/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn();
vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: (...args) => rpc(...args), functions: { invoke: vi.fn() } } }));
const auth = { user: null, loading: false, logout: vi.fn() };
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => auth }));

import TeacherLayout, { EducatorGate } from "../src/layouts/TeacherLayout";
import EducatorOnboarding from "../src/portals/teacher/pages/EducatorOnboarding";
import EducatorTestSeries from "../src/portals/teacher/pages/EducatorTestSeries";
import TestSeriesWizard from "../src/portals/admin/pages/TestSeriesWizard";
import SeriesReviewBanner from "../src/portals/admin/components/SeriesReviewBanner";
import { educatorApi } from "../src/portals/teacher/services/educatorApi";
import {
  GATE, fieldErrorsFrom, gateFor, groupSeriesByTab, missingRequiredDocuments, resumeStep, seriesActionLabel, validateOnboarding,
} from "../src/portals/teacher/utils/onboarding";
import {
  ADMIN_AUTHORING, AuthoringPortalContext, EDUCATOR_AUTHORING, publishActionLabel,
} from "../src/portals/admin/context/authoringPortal";

beforeEach(() => {
  rpc.mockReset();
  auth.user = { id: "u1", role: "teacher", name: "Asha Rao" };
  window.scrollTo = () => {};
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

// -----------------------------------------------------------------------------
describe("the portal gate", () => {
  const statusApi = (status) => ({ getStatus: vi.fn().mockResolvedValue(status) });

  function renderGate(api, path = "/teacher/stats") {
    render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/teacher" element={<EducatorGate user={auth.user} onLogout={vi.fn()} statusApi={api} />}>
            <Route path="stats" element={<p>Stats feature</p>} />
            <Route path="dashboard" element={<p>Dashboard feature</p>} />
          </Route>
          <Route path="/teacher/onboarding" element={<p>Onboarding page</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("maps every status to a screen", () => {
    expect(gateFor({ status: "verified" })).toBe(GATE.PORTAL);
    expect(gateFor({ status: "draft" })).toBe(GATE.ONBOARDING);
    expect(gateFor({ status: "pending" })).toBe(GATE.PENDING);
    expect(gateFor({ status: "under_review" })).toBe(GATE.PENDING);
    expect(gateFor({ status: "changes_requested" })).toBe(GATE.CHANGES);
    expect(gateFor({ status: "rejected" })).toBe(GATE.REJECTED);
    expect(gateFor({ status: "suspended" })).toBe(GATE.SUSPENDED);
  });

  it("verified: the portal renders the feature route with the six nav items", async () => {
    renderGate(statusApi({ status: "verified" }));
    expect(await screen.findByText("Stats feature")).toBeInTheDocument();
    const nav = screen.getByRole("navigation");
    for (const label of ["Dashboard", "Assigned", "Test Series", "Create Test Series", "Stats", "Profile"]) {
      expect(nav).toHaveTextContent(label);
    }
  });

  it("pending: a full-page screen with the submitted date and logout, and the typed feature URL is blocked", async () => {
    renderGate(statusApi({ status: "pending", submitted_at: "2026-10-28T09:00:00Z" }));
    expect(await screen.findByRole("heading", { name: "Pending approval" })).toBeInTheDocument();
    expect(screen.getByText(/We received your application on/)).toBeInTheDocument();
    expect(screen.queryByText("Stats feature")).not.toBeInTheDocument();
    expect(screen.queryByRole("navigation")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
  });

  it("changes requested and rejected show the admin's note and a resubmit link", async () => {
    renderGate(statusApi({ status: "changes_requested", note: "Upload a clearer ID back." }));
    expect(await screen.findByText("Upload a clearer ID back.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit and resubmit" })).toHaveAttribute("href", "/teacher/onboarding");
    cleanup();
    renderGate(statusApi({ status: "rejected", note: "ID does not match." }));
    expect(await screen.findByText("ID does not match.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Update and resubmit" })).toBeInTheDocument();
    expect(screen.queryByText("Stats feature")).not.toBeInTheDocument();
  });

  it("suspended shows a clear message; draft goes to onboarding", async () => {
    renderGate(statusApi({ status: "suspended", note: "Policy review" }));
    expect(await screen.findByRole("heading", { name: /suspended/ })).toBeInTheDocument();
    expect(screen.getByText("Policy review")).toBeInTheDocument();
    cleanup();
    renderGate(statusApi({ status: "draft" }));
    expect(await screen.findByText("Onboarding page")).toBeInTheDocument();
  });

  it("re-checks every 60 s while pending and on window focus, and opens the portal once verified", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = { getStatus: vi.fn().mockResolvedValueOnce({ status: "pending" }).mockResolvedValue({ status: "verified" }) };
    renderGate(api);
    expect(await screen.findByRole("heading", { name: "Pending approval" })).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(await screen.findByText("Stats feature")).toBeInTheDocument();
    expect(api.getStatus).toHaveBeenCalledTimes(2);
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(api.getStatus).toHaveBeenCalledTimes(3);
  });

  it("sends non-educators away and signed-out users to the teacher login", () => {
    auth.user = { id: "s1", role: "student" };
    render(
      <MemoryRouter initialEntries={["/teacher/stats"]}>
        <Routes>
          <Route path="/teacher/*" element={<TeacherLayout />} />
          <Route path="/student/dashboard" element={<p>Student home</p>} />
          <Route path="/teacher/login" element={<p>Teacher login</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Student home")).toBeInTheDocument();
    cleanup();
    auth.user = null;
    render(
      <MemoryRouter initialEntries={["/teacher/dashboard"]}>
        <Routes>
          <Route path="/teacher/*" element={<TeacherLayout />} />
          <Route path="/teacher/login" element={<p>Teacher login</p>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Teacher login")).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
describe("onboarding validation and resume", () => {
  const valid = {
    full_name: "Asha Rao", phone: "+91 98765 43210", location: "Pune", qualifications: "MSc Physics", experience_years: 7,
    subjects: ["Physics"], languages: ["English"], bio: "I teach physics to senior school students preparing for JEE.",
  };

  it("mirrors the server rules", () => {
    expect(validateOnboarding(valid)).toEqual({});
    expect(Object.keys(validateOnboarding({ ...valid, phone: "12", location: "Not provided" }, 1))).toEqual(["phone", "location"]);
    expect(validateOnboarding({ ...valid, experience_years: 61 }, 2)).toHaveProperty("experience_years");
    expect(validateOnboarding({ ...valid, experience_years: "" }, 2)).toHaveProperty("experience_years");
    expect(validateOnboarding({ ...valid, subjects: [], bio: "short" }, 3)).toEqual({
      subjects: "Add 1 to 20 subjects (each up to 60 characters).", bio: "Write a short bio of 50 to 1000 characters.",
    });
    expect(validateOnboarding({}, 2)).not.toHaveProperty("full_name");
  });

  it("resumes after the last saved step and reads server field errors", () => {
    expect(resumeStep({ step: 0 })).toBe(1);
    expect(resumeStep({ step: 2 })).toBe(3);
    expect(resumeStep({ step: 5 })).toBe(5);
    expect(fieldErrorsFrom({ details: "{\"phone\":\"Bad\"}" })).toEqual({ phone: "Bad" });
    expect(fieldErrorsFrom({ details: "not json" })).toEqual({});
    expect(missingRequiredDocuments([{ doc_type: "government_id", doc_name: "front" }]).map((d) => d.docName)).toEqual(["back"]);
  });

  function onboardingApi(overrides = {}) {
    return {
      getOnboarding: vi.fn().mockResolvedValue({
        step: 2, data: { ...valid, subjects: [], languages: [], bio: "" }, documents: [],
        status: { status: "draft", can_edit: true },
      }),
      saveStep: vi.fn(),
      uploadDocument: vi.fn(),
      removeDocument: vi.fn(),
      submitOnboarding: vi.fn(),
      ...overrides,
    };
  }

  function renderOnboarding(api) {
    render(
      <MemoryRouter initialEntries={["/teacher/onboarding"]}>
        <Routes>
          <Route path="/teacher/onboarding" element={<EducatorOnboarding api={api} />} />
          <Route path="/teacher" element={<p>Teacher home</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("resumes at step 3 after a refresh and blocks an invalid step without a request", async () => {
    const api = onboardingApi();
    renderOnboarding(api);
    expect(await screen.findByRole("heading", { level: 1, name: "Subjects, languages and bio" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(api.saveStep).not.toHaveBeenCalled();
    expect(screen.getByText("Write a short bio of 50 to 1000 characters.")).toBeInTheDocument();
  });

  it("shows the server's field errors when a save is refused", async () => {
    const api = onboardingApi({
      getOnboarding: vi.fn().mockResolvedValue({ step: 0, data: valid, documents: [], status: { status: "draft", can_edit: true } }),
      saveStep: vi.fn().mockRejectedValue(Object.assign(new Error("Check the highlighted fields."), {
        code: "22023", details: JSON.stringify({ phone: "Enter a valid phone number (7 to 15 digits)." }),
      })),
    });
    renderOnboarding(api);
    await screen.findByRole("heading", { level: 1, name: "Personal and contact" });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Save and continue" })); });
    expect(api.saveStep).toHaveBeenCalledWith(1, { full_name: "Asha Rao", phone: "+91 98765 43210", location: "Pune" });
    expect(screen.getByText("Enter a valid phone number (7 to 15 digits).")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Check the highlighted fields.");
  });

  it("goes back to /teacher when the application can't be edited (pending)", async () => {
    renderOnboarding(onboardingApi({ getOnboarding: vi.fn().mockResolvedValue({ step: 5, data: valid, documents: [], status: { status: "pending", can_edit: false } }) }));
    expect(await screen.findByText("Teacher home")).toBeInTheDocument();
  });

  it("shows an upload error on the document and keeps Continue blocked", async () => {
    const api = onboardingApi({
      getOnboarding: vi.fn().mockResolvedValue({ step: 3, data: valid, documents: [], status: { status: "draft", can_edit: true } }),
      uploadDocument: vi.fn().mockRejectedValue(Object.assign(new Error("The upload failed. Check your connection and try again."), { stage: "upload" })),
    });
    renderOnboarding(api);
    await screen.findByRole("heading", { level: 1, name: "ID verification" });
    const file = new File(["x"], "front.jpg", { type: "image/jpeg" });
    const input = document.getElementById("doc-government-id-front");
    await act(async () => { fireEvent.change(input, { target: { files: [file] } }); });
    expect(api.uploadDocument).toHaveBeenCalledWith(expect.objectContaining({ docType: "government_id", docName: "front", file }));
    expect(await screen.findByText("The upload failed. Check your connection and try again.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Save and continue" }));
    expect(api.saveStep).not.toHaveBeenCalled();
    expect(screen.getByText("Upload: Government ID: front, Government ID: back.")).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
describe("upload error handling", () => {
  const file = new File(["x"], "id.jpg", { type: "image/jpeg" });

  it("refuses a bad file before any request", async () => {
    const invoke = vi.fn();
    const pdf = new File(["x"], "id.pdf", { type: "application/pdf" });
    await expect(educatorApi.uploadDocument({ docType: "government_id", docName: "front", file: pdf }, { invoke }))
      .rejects.toMatchObject({ stage: "check", message: "Upload a JPEG, PNG or WebP picture." });
    expect(invoke).not.toHaveBeenCalled();
  });

  it("reports the rate limit, a failed upload and a refused registration by stage", async () => {
    const limited = vi.fn().mockRejectedValue(Object.assign(new Error("Too many uploads."), { status: 429 }));
    await expect(educatorApi.uploadDocument({ docType: "government_id", docName: "front", file }, { invoke: limited }))
      .rejects.toMatchObject({ stage: "url", message: "You've uploaded a lot in the last hour. Try again later." });

    const ticket = vi.fn().mockResolvedValue({ path: "u1/government_id-front-1.jpg", signedUrl: "https://x/upload", token: "t" });
    const put = vi.fn().mockRejectedValue(new Error("The upload failed. Try again."));
    await expect(educatorApi.uploadDocument({ docType: "government_id", docName: "front", file }, { invoke: ticket, put }))
      .rejects.toMatchObject({ stage: "upload" });

    rpc.mockResolvedValueOnce({ data: null, error: { message: "The file is larger than 5 MB.", code: "22023" } });
    const ok = vi.fn().mockResolvedValue();
    await expect(educatorApi.uploadDocument({ docType: "government_id", docName: "front", file }, { invoke: ticket, put: ok }))
      .rejects.toMatchObject({ stage: "register", message: "The file is larger than 5 MB." });
    expect(rpc).toHaveBeenCalledWith("educator_register_document", {
      p_doc_type: "government_id", p_path: "u1/government_id-front-1.jpg", p_doc_name: "front",
    });
  });
});

// -----------------------------------------------------------------------------
describe("educator test series tabs", () => {
  const rows = [
    { id: "a", name: "Live one", status: "published", origin: "educator", code: "TS-1", test_count: 2, attempts: 5 },
    { id: "b", name: "Scheduled", status: "scheduled", origin: "admin", code: "TS-2", test_count: 1, attempts: 0 },
    { id: "c", name: "My draft", status: "draft", origin: "educator", code: "TS-3", test_count: 1 },
    { id: "d", name: "Waiting", status: "pending_approval", origin: "educator", code: "TS-4", test_count: 1, submitted_at: "2026-10-28T09:00:00Z" },
    { id: "e", name: "Bounced", status: "rejected", origin: "educator", code: "TS-5", test_count: 1, rejection_reason: "Add explanations." },
  ];

  it("groups rows by status and labels the actions", () => {
    const g = groupSeriesByTab(rows);
    expect(g.published.map((r) => r.id)).toEqual(["a", "b"]);
    expect(g.drafts.map((r) => r.id)).toEqual(["c"]);
    expect(g.pending.map((r) => r.id)).toEqual(["d"]);
    expect(g.rejected.map((r) => r.id)).toEqual(["e"]);
    expect(seriesActionLabel(rows[2])).toBe("Submit for approval");
    expect(seriesActionLabel(rows[4])).toBe("Resubmit for approval");
    expect(seriesActionLabel({ status: "draft", origin: "admin" })).toBe("Publish");
  });

  it("renders the tabs with counts and the rejection reason", async () => {
    const api = { list: vi.fn().mockResolvedValue({ rows, total: 5 }) };
    render(<MemoryRouter><EducatorTestSeries api={api} /></MemoryRouter>);
    expect(await screen.findByRole("tab", { name: /Published \(2\)/ })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Drafts \(1\)/ })).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("My draft")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: /Rejected/ }));
    expect(screen.getByText("Add explanations.")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Edit" })).toHaveAttribute("href", "/teacher/test-series/e");
  });
});

// -----------------------------------------------------------------------------
describe("role-based labels", () => {
  it("educator's own series: Submit for approval; assigned or admin: publish", () => {
    expect(publishActionLabel(EDUCATOR_AUTHORING, { origin: "educator" })).toBe("Submit for approval");
    expect(publishActionLabel(EDUCATOR_AUTHORING, { origin: "admin" })).toBe("Publish now");
    expect(publishActionLabel(ADMIN_AUTHORING, { origin: "educator" })).toBe("Publish now");
    expect(publishActionLabel(ADMIN_AUTHORING, { origin: "admin" }, true)).toBe("Schedule go-live");
  });

  it("the review banner offers Submit for approval on a draft and is read-only while pending", () => {
    render(<SeriesReviewBanner portal={EDUCATOR_AUTHORING} series={{ id: "s1", origin: "educator", status: "draft" }} />);
    expect(screen.getByRole("button", { name: "Submit for approval" })).toBeInTheDocument();
    cleanup();
    render(<SeriesReviewBanner portal={EDUCATOR_AUTHORING} series={{ id: "s1", origin: "educator", status: "pending_approval" }} />);
    expect(screen.getByText(/Waiting for admin approval/)).toBeInTheDocument();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  const WIZARD_STATE = {
    seriesType: "own", startMethod: "scratch", sourceSeriesId: "", name: "Mechanics drills", about: "", whoFor: "",
    audience: "Class 12", pricing: "free", price: "", syllabus: "",
    classification: { grade: "Class 12", subject: "Physics", exam: "JEE Main", difficulty: "Medium", languages: ["English"] },
    buildDeadline: "",
    availability: { goLive: "now", goLiveAt: "", mode: "always", openAt: "", closeAt: "", monthlyLimited: false, monthlyLimit: 5, accessLimited: false, accessDays: 90 },
    lateSubmissions: { allowed: false, graceMinutes: 10 },
    tests: [{
      wid: "t1", name: "Kinematics", instructions: "", duration: 30, passingPercent: 40, attemptLimit: 1,
      window: { mode: "inherit", openAt: "", closeAt: "" }, plannedQuestions: 1, topics: [],
      questions: [{ wid: "q1", type: "mcq_single", text: "v = u + at holds for?", optionA: "Any motion", optionB: "Uniform acceleration", optionC: "Circular", optionD: "None",
                    correctAnswer: "B", marks: 4, negativeMarks: 0, difficulty: "medium", subject: "", topic: "", explanation: "" }],
    }],
  };

  it("the shared wizard says Submit for approval for an educator and saves, then submits (never publishes)", async () => {
    rpc.mockImplementation((name) => {
      if (name === "get_test_series") return Promise.resolve({ data: { id: "s9", title: "Mechanics drills", wizard_state: WIZARD_STATE, tests: [] }, error: null });
      if (name === "series_name_exists") return Promise.resolve({ data: false, error: null });
      if (name === "upsert_test_series_full") return Promise.resolve({ data: "s9", error: null });
      if (name === "educator_submit_series_for_approval") return Promise.resolve({ data: { status: "pending_approval" }, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    render(
      <MemoryRouter initialEntries={[{ pathname: "/teacher/test-series/new", state: { seriesId: "s9" } }]}>
        <AuthoringPortalContext.Provider value={EDUCATOR_AUTHORING}>
          <Routes>
            <Route path="/teacher/test-series/new" element={<TestSeriesWizard />} />
            <Route path="/teacher/test-series" element={<p>My series list</p>} />
          </Routes>
        </AuthoringPortalContext.Provider>
      </MemoryRouter>,
    );
    await waitFor(() => expect(rpc).toHaveBeenCalledWith("get_test_series", { p_id: "s9" }));
    for (let i = 0; i < 5; i += 1) {
      const next = await screen.findByRole("button", { name: /Continue/ });
      await waitFor(() => expect(next).toBeEnabled());
      fireEvent.click(next);
    }
    const submit = await screen.findByRole("button", { name: "Submit for approval" });
    expect(screen.queryByRole("button", { name: "Publish now" })).not.toBeInTheDocument();
    await act(async () => { fireEvent.click(submit); });
    expect(await screen.findByText("My series list")).toBeInTheDocument();
    const upsert = rpc.mock.calls.find((c) => c[0] === "upsert_test_series_full");
    expect(upsert[1].p_publish).toBe(false);
    expect(rpc).toHaveBeenCalledWith("educator_submit_series_for_approval", { p_series_id: "s9" });
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain("adm_publish_test_series");
  });
});
