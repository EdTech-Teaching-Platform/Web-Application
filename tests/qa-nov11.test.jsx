/** @vitest-environment jsdom */
// QA reports #15-#26 (02 Nov 2026), fixed 11 Nov:
//   blocking (#15/#16/#26): a blocked student can't log in, and an open
//   session sees the block within one poll; the edit-test drawer (#17/#18/#20);
//   assignments (#22-#25); delete account (#21). (#19, the toast contrast, is
//   covered by shared-ui.test.jsx.)
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpcHandlers = {};
const rpcCalls = [];
const rpc = vi.fn(async (name, params) => {
  rpcCalls.push([name, params]);
  const h = rpcHandlers[name];
  if (h instanceof Error) return { data: null, error: h };
  return { data: typeof h === "function" ? h(params) : h ?? null, error: null };
});
const signOut = vi.fn(async () => ({ error: null }));
const signInWithPassword = vi.fn(async () => ({ data: {}, error: null }));
const invoke = vi.fn(async () => ({ data: { banned: true }, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: (...a) => invoke(...a) },
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: (...a) => signOut(...a),
      signInWithPassword: (...a) => signInWithPassword(...a),
      getSession: async () => ({ data: { session: { access_token: "t" } } }),
      getUser: async () => ({ data: { user: { identities: [{ provider: "email" }] } } }),
    },
  },
}));
const auth = { user: { id: "adm-1", name: "Admin", role: "admin", email: "a@x.in" }, loading: false };
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => auth }));

import { refuseBlockedStudent, BLOCKED_LOGIN_MESSAGE } from "../src/auth/services/authApi";
import { useAccountStatus } from "../src/portals/student/hooks/useAccountStatus";
import { testSeriesApi } from "../src/portals/admin/services/testSeriesApi";
import { editErrors } from "../src/portals/admin/pages/TestSeriesDetail";
import { buildDetailAssignment } from "../src/portals/admin/pages/AssignEducators";
import { fromDateTimeLocal, toDateTimeLocal } from "../src/utils/datetimeLocal";

const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => {
  for (const k of Object.keys(rpcHandlers)) delete rpcHandlers[k];
  rpcCalls.length = 0;
  rpc.mockClear(); signOut.mockClear(); signInWithPassword.mockClear(); invoke.mockClear();
  window.scrollTo = () => {};
  Element.prototype.scrollTo = () => {};
});
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("blocked student (#15, #16, #26)", () => {
  it("login: a blocked student is signed out again with a clear message", async () => {
    rpcHandlers.student_get_account_status = { blocked: true };
    await expect(refuseBlockedStudent({ role: "student" })).rejects.toThrow(BLOCKED_LOGIN_MESSAGE);
    expect(signOut).toHaveBeenCalled();
    expect(BLOCKED_LOGIN_MESSAGE).toMatch(/contact the administrator/i);
  });

  it("login: an active student, another role, or a failed check gets in", async () => {
    rpcHandlers.student_get_account_status = { blocked: false };
    await expect(refuseBlockedStudent({ role: "student" })).resolves.toBeUndefined();
    await expect(refuseBlockedStudent({ role: "admin" })).resolves.toBeUndefined();
    expect(rpcCalls.filter(([n]) => n === "student_get_account_status")).toHaveLength(1);
    rpcHandlers.student_get_account_status = Object.assign(new Error("network"), { code: "500" });
    await expect(refuseBlockedStudent({ role: "student" })).resolves.toBeUndefined();
    expect(signOut).not.toHaveBeenCalled();
  });

  it("an open session sees the block on the next poll, without a reload or focus change", async () => {
    let blocked = false;
    const load = vi.fn(async () => ({ blocked }));
    function Probe() {
      const s = useAccountStatus({ load, pollMs: 40 });
      return <p>{s.blocked ? "Account blocked" : "Dashboard"}</p>;
    }
    render(<Probe />);
    expect(await screen.findByText("Dashboard")).toBeInTheDocument();
    blocked = true;   // the admin blocks the student now
    expect(await screen.findByText("Account blocked", {}, { timeout: 1000 })).toBeInTheDocument();
    expect(load.mock.calls.length).toBeGreaterThan(1);
  });
});

// -----------------------------------------------------------------------------
const SERIES_ID = "ser-1";
const TEST_ID = "quiz-1";
function seriesJson(test = {}) {
  return {
    id: SERIES_ID, title: "Kirchhoff", status: "published", is_published: true, origin: "admin",
    tests: [{
      id: TEST_ID, series_id: SERIES_ID, position: 1, title: "Loops", instructions: "Read carefully", duration_minutes: 30,
      total_marks: 3, total_marks_planned: 15, marks_sum: 3, passing_percent: 40, passing_marks: 6, attempt_limit: 2,
      scheduled_at: "2026-11-20T04:30:00+00:00", shuffle_questions: false, shuffle_options: false, status: "published",
      questions: [{ id: "q1", position: 1, type: "mcq_single", body: "Current law?", marks: 3, options: [
        { id: "o1", option_key: "A", label: "KCL", is_correct: true }, { id: "o2", option_key: "B", label: "Ohm", is_correct: false }] }],
      ...test,
    }],
  };
}

describe("edit test drawer (#17, #18, #20)", () => {
  it("the test's total is the planned one (the assignment's 15), with the questions' marks beside it", async () => {
    rpcHandlers.get_test_series = seriesJson();
    const s = await testSeriesApi.get(SERIES_ID);
    expect(s.tests[0].totalMarks).toBe(15);
    expect(s.tests[0].questionMarks).toBe(3);
    expect(s.tests[0].passingMarks).toBe(6);
    rpcHandlers.get_test_series = seriesJson({ total_marks_planned: null, marks_sum: undefined, total_marks: 3 });
    const old = await testSeriesApi.get(SERIES_ID);
    expect(old.tests[0].totalMarks).toBe(3);   // before 20261111090000 / no planned total
    expect(old.tests[0].questionMarks).toBe(3);
  });

  it("schedule round trip: the stored ISO shows in the date input and goes back as the same moment", () => {
    const local = toDateTimeLocal("2026-11-20T04:30:00+00:00");
    expect(local).toMatch(/^2026-11-20T\d{2}:\d{2}$/);
    expect(new Date(fromDateTimeLocal(local)).toISOString()).toBe("2026-11-20T04:30:00.000Z");
    expect(toDateTimeLocal("")).toBe("");
    expect(fromDateTimeLocal("")).toBe("");
  });

  it("Save changes checks the details, not publishing rules", () => {
    const ok = { name: "Loops", duration: 30, totalMarks: 15, passingMarks: 6 };
    expect(editErrors(ok)).toEqual([]);
    expect(editErrors({ ...ok, passingMarks: 32, totalMarks: 4 })).toEqual(["Passing marks cannot exceed total marks."]);
    expect(editErrors({ ...ok, name: "" })).toContain("Test name is required.");
  });

  async function openEdit() {
    rpcHandlers.get_test_series = seriesJson();
    rpcHandlers.update_test = (p) => ({ ...seriesJson().tests[0], title: p.p.name });
    const { default: TestSeriesDetail } = await import("../src/portals/admin/pages/TestSeriesDetail");
    render(<MemoryRouter initialEntries={[`/admin/testseries/${SERIES_ID}`]}><Routes>
      <Route path="/admin/testseries/:seriesId" element={<TestSeriesDetail />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: "Edit" }));
  }

  it("editing shows Save changes only (no Publish, no Save as Draft), with the saved values", async () => {
    await openEdit();
    expect(screen.getByRole("button", { name: "Save changes" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save as draft/i })).toBeNull();
    const drawer = screen.getByRole("button", { name: "Save changes" }).closest(".ul-set-drawer, [class*='drawer']") || document.body;
    expect(within(drawer).queryByRole("button", { name: /^publish$/i })).toBeNull();
    expect(screen.getByPlaceholderText("e.g. 40")).toHaveValue(15);
    expect(screen.getByPlaceholderText("e.g. 16")).toHaveValue(6);
    expect(screen.getByText("Questions so far add up to 3 of 15 marks: 12 still to add.")).toBeInTheDocument();
    expect(document.querySelector('input[type="datetime-local"]').value).toMatch(/^2026-11-20T/);
  });

  it("Save changes sends the edits without a status, so a published test stays published", async () => {
    await openEdit();
    fireEvent.change(screen.getByPlaceholderText("e.g. Physics Full Mock Test 1"), { target: { value: "Loops (revised)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() => expect(rpcCalls.some(([n]) => n === "update_test")).toBe(true));
    const [, params] = rpcCalls.find(([n]) => n === "update_test");
    expect(params.p_id).toBe(TEST_ID);
    expect(params.p).toMatchObject({ name: "Loops (revised)", totalMarks: 15, passingMarks: 6, duration: 30, attemptLimit: 2 });
    expect(params.p).not.toHaveProperty("status");
    expect(params.p.scheduledAt).toBe("2026-11-20T04:30:00.000Z");
    expect(await screen.findByText('"Loops (revised)" saved.')).toBeInTheDocument();
  });

  it("passing marks above the total is shown in the drawer and nothing is saved", async () => {
    await openEdit();
    fireEvent.change(screen.getByPlaceholderText("e.g. 40"), { target: { value: "4" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. 16"), { target: { value: "32" } });
    fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
    expect(await screen.findByText("Passing marks cannot exceed total marks.")).toBeInTheDocument();
    expect(rpcCalls.some(([n]) => n === "update_test")).toBe(false);
  });
});

// -----------------------------------------------------------------------------
const ROW = {
  id: "asg-1", code: "ASG-5001", series_id: SERIES_ID, series_name: "Kirchhoff", subject: "Physics", topics: ["Loops"],
  educator_id: "edu-1", educator_name: "ASHIKA", test_name: "Loops paper", question_count: 10, question_type_mix: "objective",
  difficulty: "Medium", total_marks: 15, duration_minutes: 30, instructions: "", assigned_date: "2026-11-02", deadline: "2026-12-01",
  status: "assigned", display_status: "assigned", progress: 0, created_at: "2026-11-02T10:00:00Z",
  test_count: 5, grade: "12th Grade", exam: "JEE", audience: "",
};

describe("assignments (#22, #23, #24, #25)", () => {
  it("details: history comes from the detail response; a missing part never crashes (#24)", () => {
    const fromList = { id: "asg-1", testName: "Loops paper", testCount: 5 };
    const before = buildDetailAssignment(null, fromList, "asg-1");
    expect(before.history).toEqual([]);
    const after = buildDetailAssignment({ assignment: ROW, history: [{ action: "Assigned", note: "Assignment created.", at: "2026-11-02T10:00:00Z", by: "Q Admin" }] }, fromList, "asg-1");
    expect(after.history).toEqual([{ action: "Assigned", note: "Assignment created.", at: "2026-11-02T10:00:00Z", by: "Q Admin" }]);
    expect(after.testCount).toBe(5);
    expect(buildDetailAssignment(null, null, "asg-1")).toBeNull();
  });

  async function renderAssign(row = ROW) {
    rpcHandlers.list_assignments = [{ row_data: row, total_count: 1 }];
    rpcHandlers.list_series_requests = [];
    rpcHandlers.list_series_options = [{ id: SERIES_ID, title: "Kirchhoff" }];
    rpcHandlers.list_assignable_educators = [{ row_data: { id: "edu-1", name: "ASHIKA", subjects: ["Physics"] }, total_count: 1 }];
    rpcHandlers.get_assignment_detail = { assignment: row, history: [{ action: "Assigned", note: "Assignment created.", at: row.created_at, by: "Q Admin" }], comments: [], notifications: [] };
    rpcHandlers.update_assignment_requirements = null;
    const { default: AssignEducators } = await import("../src/portals/admin/pages/AssignEducators");
    render(<MemoryRouter><AssignEducators /></MemoryRouter>);
    await screen.findByText("ASHIKA");
  }
  const openMenu = () => fireEvent.click(screen.getAllByRole("button", { name: /more actions/i })[0]);

  it("View Details opens the details with the history, not a blank screen (#24)", async () => {
    await renderAssign();
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "View Details" }));
    expect(await screen.findByText("Number of Tests")).toBeInTheDocument();
    expect(await screen.findByText(/Assignment created\./)).toBeInTheDocument();
    expect(screen.getByText(/Q Admin/)).toBeInTheDocument();
  });

  it("Edit Requirements shows the saved number of tests (5) and waits for the save (#23)", async () => {
    await renderAssign();
    openMenu();
    fireEvent.click(await screen.findByRole("menuitem", { name: "Edit Requirements" }));
    const count = await screen.findByDisplayValue("5");
    expect(count).toBeInTheDocument();
    rpcHandlers.update_assignment_requirements = Object.assign(new Error("Assignment not found or already closed."), { code: "P0002" });
    fireEvent.click(screen.getByRole("button", { name: "Save Changes" }));
    expect(await screen.findByText("Assignment not found or already closed.")).toBeInTheDocument();
    expect(screen.queryByText(/requirements updated/i)).toBeNull();
    expect(rpcCalls.find(([n]) => n === "update_assignment_requirements")[1].patch.testCount).toBe(5);
  });

  it("a cancelled assignment offers only View Details (#22)", async () => {
    await renderAssign({ ...ROW, status: "cancelled", display_status: "cancelled" });
    openMenu();
    expect(await screen.findByRole("menuitem", { name: "View Details" })).toBeInTheDocument();
    for (const name of ["Edit Requirements", "Reassign Educator", "Extend Deadline", "Cancel Assignment"]) {
      expect(screen.queryByRole("menuitem", { name })).toBeNull();
    }
  });

  it("Recently assigned asks the server for assigned_desc (created_at, newest first) (#25)", async () => {
    await renderAssign();
    fireEvent.change(screen.getByDisplayValue("Deadline: soonest first"), { target: { value: "assigned_desc" } });
    await waitFor(() => expect(rpcCalls.some(([n, p]) => n === "list_assignments" && p.p_sort === "assigned_desc")).toBe(true));
  });
});

// -----------------------------------------------------------------------------
describe("delete account (#21)", () => {
  function fakeApi(initial = null) {
    let current = initial;
    return {
      mine: vi.fn(async () => current),
      request: vi.fn(async (reason) => { current = { id: "r1", status: "pending", reason, createdAt: "2026-11-11T05:00:00Z" }; return current; }),
      cancel: vi.fn(async () => { current = { ...current, status: "cancelled" }; return current; }),
    };
  }

  it("asks for the password and DELETE, then sends the request; it can be withdrawn", async () => {
    const { default: DeleteAccountSection } = await import("../src/components/account/DeleteAccountSection");
    const api = fakeApi();
    const verify = vi.fn(async () => {});
    render(<DeleteAccountSection email="s@x.in" api={api} verify={verify} passwordCheck={async () => true} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete account…" }));
    const dialog = screen.getByRole("dialog", { name: "Delete your account?" });
    expect(within(dialog).getByText(/administrator reviews the request/i)).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: "Request deletion" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Your password"), { target: { value: "secret1" } });
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "delete" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Moving abroad" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(await screen.findByText(/Your deletion request was sent/)).toBeInTheDocument();
    expect(verify).toHaveBeenCalledWith("s@x.in", "secret1");
    expect(api.request).toHaveBeenCalledWith("Moving abroad");
    expect(await screen.findByText(/You asked to delete your account/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Withdraw request" }));
    expect(await screen.findByText("Your deletion request was withdrawn.")).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Delete account…" })).toBeInTheDocument();
  });

  it("a wrong password is shown and nothing is requested", async () => {
    const { default: DeleteAccountSection } = await import("../src/components/account/DeleteAccountSection");
    const api = fakeApi();
    const verify = vi.fn(async () => { throw new Error("That password isn't right."); });
    render(<DeleteAccountSection email="s@x.in" api={api} verify={verify} passwordCheck={async () => true} />);
    fireEvent.click(await screen.findByRole("button", { name: "Delete account…" }));
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "nope" } });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Request deletion" }));
    expect(await screen.findByText("That password isn't right.")).toBeInTheDocument();
    expect(api.request).not.toHaveBeenCalled();
  });

  it("admin: approving blocks the account, then bans its sign-in; reject notifies", async () => {
    const { default: DeletionRequestsTab } = await import("../src/portals/admin/pages/DeletionRequestsTab");
    const row = { id: "r1", status: "pending", role: "student", userId: "stu-9", name: "Riya", email: "r@x.in", reason: "Moving", createdAt: "2026-11-11T05:00:00Z" };
    const api = { list: vi.fn(async () => ({ rows: [row], total: 1 })), resolve: vi.fn(async () => ({ ...row, status: "approved" })), ban: vi.fn(async () => ({})) };
    render(<DeletionRequestsTab api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve and block" }));
    expect(await screen.findByText(/can no longer sign in/)).toBeInTheDocument();
    expect(api.resolve).toHaveBeenCalledWith("r1", "approved", "");
    expect(api.ban).toHaveBeenCalledWith("stu-9", "Account deletion approved");
  });

  it("admin: a failed sign-in ban is a warning with Retry", async () => {
    const { default: DeletionRequestsTab } = await import("../src/portals/admin/pages/DeletionRequestsTab");
    const row = { id: "r2", status: "pending", role: "educator", userId: "edu-9", name: "Asha", email: "e@x.in", createdAt: "2026-11-11T05:00:00Z" };
    const api = { list: vi.fn(async () => ({ rows: [row], total: 1 })), resolve: vi.fn(async () => ({})), ban: vi.fn(async () => { throw new Error("Auth down"); }) };
    render(<DeletionRequestsTab api={api} />);
    fireEvent.click(await screen.findByRole("button", { name: "View" }));
    fireEvent.click(screen.getByRole("button", { name: "Approve and block" }));
    expect(await screen.findByText(/sign-in ban failed: Auth down/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
  });

  it("the admin Help Desk has a Deletion Requests tab", async () => {
    const { default: SupportTickets } = await import("../src/portals/admin/pages/SupportTickets");
    const api = { list: vi.fn(async () => ({ rows: [], total: 0 })), resolve: vi.fn(), ban: vi.fn() };
    render(<SupportTickets initialTab="deletions" deletionsApi={api} />);
    expect(await screen.findByText("No deletion requests.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Deletion Requests" })).toBeInTheDocument();
    await wait();
  });
});

// -----------------------------------------------------------------------------
describe("series description for buyers (11 Nov)", () => {
  const HTML = "<p>Complete <strong>JEE Main</strong> physics practice.</p><ul><li>10 full mocks</li><li>Detailed solutions</li></ul><p>&nbsp;</p><script>alert(1)</script>";

  it("rich text becomes readable plain text for cards and search", async () => {
    const { richTextToPlain, sanitizeRichHtml } = await import("../src/utils/richText");
    expect(richTextToPlain(HTML)).toBe("Complete JEE Main physics practice. 10 full mocks Detailed solutions");
    expect(richTextToPlain("Plain old description")).toBe("Plain old description");
    expect(richTextToPlain("")).toBe("");
    const safe = sanitizeRichHtml('<p onclick="x()">Hi <a href="javascript:1">there</a></p><script>bad()</script>');
    expect(safe).toBe("<p>Hi there</p>");
  });

  it("the series page shows the description formatted (no raw tags), with who it's for and the syllabus", async () => {
    auth.user = { id: "stu-1", name: "Riya", role: "student", email: "r@x.in" };
    rpcHandlers.student_get_series = {
      id: SERIES_ID, title: "JEE Physics Pro", description: HTML, who_for: "Class 12 students preparing for JEE Main.",
      syllabus: "Mechanics\nElectrostatics\nOptics", is_free: true, pricing: "free", tests_count: 0, tests: [], is_enrolled: false,
    };
    const { default: SeriesDetail } = await import("../src/portals/student/pages/SeriesDetail");
    render(<MemoryRouter initialEntries={[`/student/test-series/${SERIES_ID}`]}><Routes>
      <Route path="/student/test-series/:seriesId" element={<SeriesDetail />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "About this series" })).toBeInTheDocument();
    expect(screen.queryByText(/<p>|<strong>|&nbsp;/)).toBeNull();
    expect(screen.getByText("JEE Main", { selector: "strong" })).toBeInTheDocument();
    expect(screen.getByText("10 full mocks", { selector: "li" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Who it's for" })).toBeInTheDocument();
    expect(screen.getByText("Class 12 students preparing for JEE Main.")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Syllabus" })).toBeInTheDocument();
    expect(document.querySelector("script")).toBeNull();
    auth.user = { id: "adm-1", name: "Admin", role: "admin", email: "a@x.in" };
  });

  it("a series card shows the description as clean text", async () => {
    const { default: SeriesShowcaseCard } = await import("../src/portals/student/components/SeriesShowcaseCard");
    render(<MemoryRouter><SeriesShowcaseCard series={{ id: "s1", title: "JEE Physics Pro", description: HTML, is_free: true, tests_count: 3 }} index={0} onOpen={() => {}} /></MemoryRouter>);
    expect(screen.getByText("Complete JEE Main physics practice. 10 full mocks Detailed solutions")).toBeInTheDocument();
    expect(screen.queryByText(/<p>/)).toBeNull();
  });
});
