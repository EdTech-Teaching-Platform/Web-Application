/** @vitest-environment jsdom */
// QA reports of 02-07 Nov 2026:
//   login copy for an unknown email, the CSV "import at least one valid row"
//   alert, the tracker creator for admin-created series, the student / educator
//   onboarding redirect, and the student inbox for resolved reports.
// (The admin freeze is in admin-navigation.test.jsx.)
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";

const rpcData = {};
const rpc = vi.fn(async (name) => ({ data: typeof rpcData[name] === "function" ? rpcData[name]() : rpcData[name] ?? null, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: vi.fn() },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: vi.fn(), getSession: async () => ({ data: { session: null } }) },
  },
}));
const auth = { user: { id: "stu-1", name: "Riya Sen", role: "student" }, loading: false };
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => auth }));
vi.mock("../src/hooks/useSignOut", () => ({ useSignOut: () => vi.fn() }));
const profileRows = { current: { profile: {}, student: {} } };
vi.mock("../src/portals/student/services/profileApi", () => ({
  profileApi: { get: vi.fn(async () => profileRows.current), save: vi.fn(async () => {}) },
  default: { get: vi.fn(async () => profileRows.current), save: vi.fn(async () => {}) },
}));

import { authErrorMessage, INVALID_CREDENTIALS_MESSAGE } from "../src/auth/services/authApi";
import { csvToRows, csvPendingMessage, stepErrors, START_METHOD, validateCsvRows } from "../src/portals/admin/data/testSeriesWizard";
import { missingStudentDetails, needsStudentOnboarding, markOnboardingSkipped } from "../src/portals/student/utils/onboarding";
import { missingEducatorDetails } from "../src/portals/teacher/hooks/useProfileCompletion";
import { safeStudentLink } from "../src/portals/student/services/notificationsApi";

const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const COMPLETE = { profile: { full_name: "Riya Sen", phone: "9876543210", location: "Pune" }, student: { grade: "9th Grade", school_name: "DPS" } };

beforeEach(() => {
  rpc.mockClear();
  for (const k of Object.keys(rpcData)) delete rpcData[k];
  rpcData.student_get_account_status = { blocked: false };
  rpcData.student_list_notifications = { rows: [], unread: 0 };
  profileRows.current = COMPLETE;
  auth.user = { id: "stu-1", name: "Riya Sen", role: "student" };
  window.sessionStorage.clear();
  window.scrollTo = () => {};
  Element.prototype.scrollTo = () => {};
});
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("login: an unknown email or wrong password", () => {
  it("says to check the credentials or create an account, without revealing whether the email exists", () => {
    expect(INVALID_CREDENTIALS_MESSAGE).toBe("Unable to sign in. Please check your credentials or create a new account if you're new to Universal Learning.");
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe(INVALID_CREDENTIALS_MESSAGE);
    expect(authErrorMessage({ message: "Invalid login credentials" })).not.toMatch(/not registered|no account/i);
  });
});

// -----------------------------------------------------------------------------
describe("CSV start: valid rows validated but not imported yet", () => {
  const CSV = [
    "question,optionA,optionB,optionC,optionD,correct,marks,negative,type,difficulty,subject,topic,explanation",
    "Q1?,a,b,c,d,A,4,1,mcq,easy,,,", "Q2?,a,b,c,d,B,4,1,mcq,easy,,,", "Q3?,a,b,c,d,C,4,1,mcq,easy,,,", "Q4?,a,b,c,d,D,4,1,mcq,easy,,,",
  ].join("\n");

  it("the step says to click Import N valid rows, not 'import at least one valid row'", () => {
    const report = validateCsvRows(csvToRows(CSV).rows, new Set());
    expect(report.filter((r) => r.status === "valid")).toHaveLength(4);
    const st = { startMethod: START_METHOD.CSV, tests: [] };
    const pending = stepErrors("source", st, { csvPending: 4 });
    expect(pending).toEqual([csvPendingMessage(4)]);
    expect(pending[0]).toMatch(/4 valid rows ready\. Click "Import 4 valid rows"/);
    expect(pending[0]).not.toMatch(/at least one valid row/);
    // nothing valid -> the original message
    expect(stepErrors("source", st, { csvPending: 0 })[0]).toMatch(/Import at least one valid row/);
    // imported -> no message
    expect(stepErrors("source", { ...st, tests: [{ questions: [{}] }] }, { csvPending: 0 })).toEqual([]);
  });

  it("in the wizard: no alert after Validate; a note to click Import; after Import the step is clear", async () => {
    const { default: TestSeriesWizard } = await import("../src/portals/admin/pages/TestSeriesWizard");
    render(<MemoryRouter initialEntries={["/admin/testseries/new"]}><Routes><Route path="/admin/testseries/new" element={<TestSeriesWizard />} /></Routes></MemoryRouter>);
    await screen.findByText("How would you like to start?");
    const pick = (label) => screen.queryAllByRole("button").find((b) => b.textContent.includes(label));
    await act(async () => { fireEvent.click(pick("Import questions")); });
    await act(async () => { fireEvent.click(pick("Continue")); });
    fireEvent.change(screen.getByPlaceholderText(/question,optionA/), { target: { value: CSV } });
    fireEvent.click(screen.getByRole("button", { name: "Validate pasted text" }));
    await wait();
    expect(screen.queryByText(/Import at least one valid row/)).toBeNull();
    expect(screen.getByText(/4 valid rows ready/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Import 4 valid rows" })); });
    expect(screen.queryByText(/valid rows ready/)).toBeNull();
    expect(screen.getByText(/4 questions ready in “Imported questions”/)).toBeInTheDocument();
    expect(pick("Continue")).toBeEnabled();
  });
});

// -----------------------------------------------------------------------------
describe("Test Series Tracker: the creator column", () => {
  const row = (over) => ({
    row_data: {
      series_id: over.id, code: over.id, series_name: over.name, subject: "Maths", educators: over.educators || [],
      total_required: 0, tests_created: 0, tests_submitted: 0, tests_approved: 0, completion_pct: 0, deadline: null,
      overall_status: "No Assignments Yet", series_status: "draft", created_at: "2026-11-07T00:00:00Z", ...over.extra,
    },
    total_count: 4,
  });

  it("admin-created series (MK, MN) show Admin as the creator; educator series show the educator; old rows never guess", async () => {
    rpcData.get_tracker_stats = { total_series: 4 };
    rpcData.list_series_tracker = [
      row({ id: "s-mk", name: "MK", extra: { origin: "admin", creator_name: "Ada Admin" } }),
      row({ id: "s-mn", name: "MN", educators: ["Ravi Kumar"], extra: { origin: "admin", creator_name: "Ada Admin" } }),
      row({ id: "s-ed", name: "Asha's own", extra: { origin: "educator", creator_name: "Asha Rao", overall_status: "Independent" } }),
      row({ id: "s-old", name: "Before the migration" }),
    ];
    const { default: TestSeriesTracker } = await import("../src/portals/admin/pages/TestSeriesTracker");
    render(<MemoryRouter><TestSeriesTracker /></MemoryRouter>);
    const rowOf = async (name) => (await screen.findAllByText(name))[0].closest("tr");
    const mk = await rowOf("MK");
    expect(mk).toHaveTextContent(/Admin\s*Creator/);
    const mn = await rowOf("MN");
    expect(mn).toHaveTextContent(/Admin\s*Creator/);
    expect(mn).toHaveTextContent("Ravi Kumar");
    expect(await rowOf("Asha's own")).toHaveTextContent(/Asha Rao\s*Creator/);
    const old = await rowOf("Before the migration");
    expect(old).not.toHaveTextContent("Creator");
  });
});

// -----------------------------------------------------------------------------
describe("student onboarding after sign-in", () => {
  it("lists the missing mandatory details", () => {
    expect(missingStudentDetails(COMPLETE)).toEqual([]);
    expect(missingStudentDetails({ profile: { full_name: "Riya" }, student: { grade: "9th Grade" } }).map((m) => m.key))
      .toEqual(["school_name", "location", "phone"]);
  });

  it("any student with missing details needs onboarding (not only new Google accounts); a skip lasts the session", async () => {
    const api = { get: vi.fn(async () => ({ profile: { full_name: "Riya" }, student: {} })) };
    expect(await needsStudentOnboarding({ id: "u9", role: "student" }, { api })).toBe(true);
    expect(await needsStudentOnboarding({ id: "u9", role: "teacher" }, { api })).toBe(false);
    markOnboardingSkipped("u9");
    expect(await needsStudentOnboarding({ id: "u9", role: "student" }, { api })).toBe(false);
    expect(await needsStudentOnboarding({ id: "u8", role: "student" }, { api: { get: async () => { throw new Error("offline"); } } })).toBe(false);
  });

  async function renderStudent(path = "/student/dashboard") {
    const { default: StudentLayout } = await import("../src/layouts/StudentLayout");
    return render(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route path="/student" element={<StudentLayout />}>
            <Route path="dashboard" element={<p>Dashboard page</p>} />
            <Route path="history" element={<p>History page</p>} />
            <Route path="notifications" element={<p>Inbox page</p>} />
            <Route path="test-series/:id" element={<p>Series page</p>} />
          </Route>
          <Route path="/student/onboarding" element={<p>Onboarding wizard</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("a student with missing details lands on the onboarding wizard after login, once per session", async () => {
    profileRows.current = { profile: { full_name: "Riya Sen" }, student: {} };
    await renderStudent();
    expect(await screen.findByText("Onboarding wizard")).toBeInTheDocument();
    cleanup();
    await renderStudent();   // same session (e.g. after "Skip for now"): not bounced again
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("a complete profile goes straight to the dashboard (and the status persists: it comes from the profile)", async () => {
    await renderStudent();
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(screen.queryByText("Onboarding wizard")).toBeNull();
  });

  it("keeps where the student was going", async () => {
    profileRows.current = { profile: {}, student: {} };
    const { default: StudentLayout } = await import("../src/layouts/StudentLayout");
    let seen = "";
    function OnboardingProbe() { seen = useLocation().search; return <p>Onboarding wizard</p>; }
    render(
      <MemoryRouter initialEntries={["/student/history"]}>
        <Routes>
          <Route path="/student" element={<StudentLayout />}><Route path="history" element={<p>History page</p>} /></Route>
          <Route path="/student/onboarding" element={<OnboardingProbe />} />
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("Onboarding wizard");
    expect(seen).toBe(`?redirect=${encodeURIComponent("/student/history")}`);
  });

  // ---------------------------------------------------------------- inbox
  const resolved = {
    id: "n1", category: "support_ticket", title: "Your reported issue was resolved",
    body: "Thanks, option A is now accepted too.", action_url: "/student/test-series/s-1",
    reference_type: "test_feedback", reference_id: "fb-1", is_read: false, created_at: new Date().toISOString(),
  };

  it("a resolved report: the bell shows it, a popup names it, View marks it read and opens the test series", async () => {
    let unread = true;
    rpcData.student_list_notifications = () => ({ rows: [{ ...resolved, is_read: !unread }], unread: unread ? 1 : 0 });
    rpcData.student_mark_notification_read = () => { unread = false; return 1; };
    await renderStudent();
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
    expect(await screen.findByRole("link", { name: "Notifications, 1 unread" })).toHaveAttribute("href", "/student/notifications");
    expect(screen.getByText("Your reported issue was resolved")).toBeInTheDocument();
    expect(screen.getByText("Thanks, option A is now accepted too.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "View test" })); });
    expect(rpc).toHaveBeenCalledWith("student_mark_notification_read", { p_id: "n1" });
    expect(await screen.findByText("Series page")).toBeInTheDocument();
    expect(screen.queryByText("Your reported issue was resolved")).toBeNull();
    await waitFor(() => expect(screen.getByRole("link", { name: "Notifications" })).toBeInTheDocument());
  });

  it("hiding the popup keeps the notification unread in the inbox", async () => {
    rpcData.student_list_notifications = { rows: [resolved], unread: 1 };
    await renderStudent();
    await screen.findByText("Your reported issue was resolved");
    fireEvent.click(screen.getByRole("button", { name: "Hide for now" }));
    expect(screen.queryByText("Your reported issue was resolved")).toBeNull();
    expect(screen.getByRole("link", { name: "Notifications, 1 unread" })).toBeInTheDocument();
    expect(rpc).not.toHaveBeenCalledWith("student_mark_notification_read", expect.anything());
  });

  it("the Notifications page lists real rows, opens one, and marks all read", async () => {
    rpcData.student_list_notifications = { rows: [resolved, { ...resolved, id: "n2", title: "Older notice", reference_type: "x", action_url: null, is_read: true }], unread: 1 };
    rpcData.student_mark_all_notifications_read = 1;
    const { default: Notifications } = await import("../src/portals/student/pages/Notifications");
    render(<MemoryRouter initialEntries={["/student/notifications"]}><Routes>
      <Route path="/student/notifications" element={<Notifications />} />
      <Route path="/student/test-series/:id" element={<p>Series page</p>} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText("1 unread update")).toBeInTheDocument();
    expect(screen.getByText("Older notice")).toBeInTheDocument();
    expect(screen.getAllByText("Your reports").length).toBeGreaterThan(0);
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Mark all as read" })); });
    expect(rpc).toHaveBeenCalledWith("student_mark_all_notifications_read", {});
    expect(screen.getByText("You're all caught up.")).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByText("Your reported issue was resolved")); });
    expect(await screen.findByText("Series page")).toBeInTheDocument();
  });

  it("only in-app student links are followed", () => {
    expect(safeStudentLink("/student/test-series/1")).toBe("/student/test-series/1");
    expect(safeStudentLink("https://evil.example")).toBeNull();
    expect(safeStudentLink("/admin/usermanagement")).toBeNull();
    expect(safeStudentLink("//evil.example")).toBeNull();
  });
});

// -----------------------------------------------------------------------------
describe("educator: missing profile details after approval", () => {
  const FULL = {
    full_name: "Asha Rao", email: "a@x.in", phone: "9876543210", location: "Pune", qualifications: "M.Sc. Physics",
    experience_years: 6, subjects: ["Physics"], languages: ["English"], bio: "I teach physics to classes 9 to 12 with a focus on problem solving.",
    verification_status: "verified", documents: [],
  };

  it("lists what is missing", () => {
    expect(missingEducatorDetails(FULL)).toEqual([]);
    expect(missingEducatorDetails({ ...FULL, phone: "", bio: "short", subjects: [] }).map((m) => m.key)).toEqual(["phone", "subjects", "bio"]);
    expect(missingEducatorDetails(null)).toEqual([]);
  });

  async function renderTeacher(profile) {
    auth.user = { id: `edu-${Math.random()}`, name: "Asha Rao", role: "teacher" };
    rpcData.educator_get_profile = profile;
    const { EducatorGate } = await import("../src/layouts/TeacherLayout");
    const { default: EducatorProfilePage } = await import("../src/portals/teacher/pages/EducatorProfilePage");
    const statusApi = { getStatus: vi.fn().mockResolvedValue({ status: "approved" }) };
    render(
      <MemoryRouter initialEntries={["/teacher/dashboard"]}>
        <Routes>
          <Route path="/teacher" element={<EducatorGate user={auth.user} onLogout={vi.fn()} statusApi={statusApi} />}>
            <Route path="dashboard" element={<p>Educator dashboard</p>} />
            <Route path="profile" element={<EducatorProfilePage />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }

  it("an approved educator with missing details is taken to the profile page, which lists them", async () => {
    await renderTeacher({ ...FULL, phone: "", qualifications: "", bio: "" });
    expect(await screen.findByText("Welcome! Complete your profile to continue")).toBeInTheDocument();
    expect(screen.getByText(/Please add your phone number, qualifications, bio\./)).toBeInTheDocument();
  });

  it("a complete profile stays on the dashboard", async () => {
    await renderTeacher(FULL);
    expect(await screen.findByText("Educator dashboard")).toBeInTheDocument();
    await wait(50);
    expect(screen.getByText("Educator dashboard")).toBeInTheDocument();
    expect(screen.queryByText(/Complete your profile/)).toBeNull();
  });
});
