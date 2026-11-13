/** @vitest-environment jsdom */
// QA reports of 13 Nov 2026: publishing with mismatched marks, the assignment
// form (scroll to the first invalid field, tests split across educators), the
// sidebar badge, the assignment details popup that wouldn't close, CMS note
// styling and actions, and assignment messages reaching the educator.
// (The student popup that came back at every login: qa-nov07.test.jsx.)
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
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: vi.fn(async () => ({ data: {}, error: null })) },
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: vi.fn(), getSession: async () => ({ data: { session: { access_token: "t" } } }),
      getUser: async () => ({ data: { user: { identities: [{ provider: "email" }] } } }),
    },
  },
}));
const auth = { user: { id: "adm-1", name: "Admin", role: "admin", email: "a@x.in" }, loading: false };
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => auth }));

import { marksMismatch, validateTestForPublish } from "../src/portals/admin/data/testSeriesMock";
import { allocationSummary, defaultAllocation, shareOf, validateAssignmentForm } from "../src/portals/admin/data/assignmentForm";
import { actionsFor, noteStyle } from "../src/portals/admin/services/moderationApi";
import { badgeHint } from "../src/portals/admin/components/AdminSidebar";
import { assignmentsApi } from "../src/portals/admin/services/assignmentsApi";
import { onChanged } from "../src/services/dataSync";
import { scrollToFirstInvalid } from "../src/utils/scrollToFirstInvalid";

const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => {
  for (const k of Object.keys(rpcHandlers)) delete rpcHandlers[k];
  rpcCalls.length = 0;
  rpc.mockClear();
  window.scrollTo = () => {};
  Element.prototype.scrollTo = () => {};
  Element.prototype.scrollIntoView = vi.fn();
  window.sessionStorage.clear();
});
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("publishing needs the marks to match the total", () => {
  const q = (marks) => ({ kind: "objective", correctAnswer: "A", marks });
  const base = { name: "Loops", duration: 20, passingMarks: 4 };

  it("10 of 40: refused, says how many marks to add", () => {
    const t = { ...base, totalMarks: 40, questions: [q(5), q(5)] };
    expect(marksMismatch(t)).toBe("Questions add up to 10 of 40 marks. Add 30 more marks (or lower the total) before publishing.");
    expect(validateTestForPublish(t).valid).toBe(false);
  });

  it("16 of 10: refused, says how many marks to remove", () => {
    const t = { ...base, totalMarks: 10, questions: [q(4), q(4), q(4), q(4)] };
    expect(marksMismatch(t)).toMatch(/add up to 16 marks, more than the total of 10\. Remove 6 marks/);
    expect(validateTestForPublish(t).valid).toBe(false);
  });

  it("matching marks publish; the server's own sum (questionMarks) is used when given", () => {
    expect(validateTestForPublish({ ...base, totalMarks: 10, questions: [q(4), q(6)] })).toEqual({ valid: true, errors: [] });
    expect(marksMismatch({ totalMarks: 10, questionMarks: 10, questions: [q(1)] })).toBeNull();
    expect(marksMismatch({ totalMarks: 0, questions: [q(3)] })).toBeNull();   // no total set: no rule
  });

  it("Test Detail: Publish shows the mismatch instead of publishing; a published mismatch is flagged", async () => {
    const seriesJson = (status) => ({
      id: "s1", title: "Kirchhoff", status: "published", origin: "admin",
      tests: [{ id: "t1", series_id: "s1", position: 1, title: "Loops", duration_minutes: 20, total_marks: 10, total_marks_planned: 40, marks_sum: 10,
        passing_percent: 40, passing_marks: 16, attempt_limit: 1, status,
        questions: [{ id: "q1", position: 1, type: "mcq_single", body: "KCL?", marks: 10, options: [{ id: "o1", option_key: "A", label: "Yes", is_correct: true }] }] }],
    });
    rpcHandlers.get_test_series = seriesJson("draft");
    const { default: TestDetail } = await import("../src/portals/admin/pages/TestDetail");
    const view = render(<MemoryRouter initialEntries={["/admin/testseries/s1/tests/t1"]}><Routes>
      <Route path="/admin/testseries/:seriesId/tests/:testId" element={<TestDetail />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText("30 marks still to add")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Publish" }));
    expect((await screen.findAllByText(/Questions add up to 10 of 40 marks/)).length).toBeGreaterThan(0);
    expect(rpcCalls.some(([n]) => n === "set_test_status")).toBe(false);
    view.unmount();

    rpcHandlers.get_test_series = seriesJson("published");
    render(<MemoryRouter initialEntries={["/admin/testseries/s1/tests/t1"]}><Routes>
      <Route path="/admin/testseries/:seriesId/tests/:testId" element={<TestDetail />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText("Marks don't match the total:")).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
describe("assignment form", () => {
  it("tests are spread one per educator, and every educator gets a test", () => {
    expect(defaultAllocation(2, ["a", "b"])).toEqual(["a", "b"]);
    expect(defaultAllocation(3, ["a"])).toEqual(["a", "a", "a"]);
    expect(defaultAllocation(4, ["a", "b"])).toEqual(["a", "b", "a", "b"]);
    // a manual pick is kept, but a newly selected educator still gets a test
    expect(defaultAllocation(2, ["a", "b", "c"].slice(0, 2), ["a", "a"])).toEqual(["a", "b"]);
    expect(allocationSummary(["a", "b", "a"], ["a", "b"])).toEqual([{ educatorId: "a", tests: 2 }, { educatorId: "b", tests: 1 }]);
    expect(shareOf(30, 1, 2)).toBe(15);
  });

  it("more educators than tests is explained on the allocation", () => {
    const errs = validateAssignmentForm({ seriesMode: "existing", seriesId: "s", subject: "Physics", testName: "T", educatorIds: ["a", "b", "c"],
      testCount: 2, questionCount: 10, totalMarks: 20, duration: 30, deadline: "2026-12-01" });
    expect(errs).toEqual([{ field: "allocation", message: expect.stringMatching(/3 educators for 2 tests/) }]);
  });

  it("scrollToFirstInvalid scrolls to and focuses the first invalid field", () => {
    document.body.innerHTML = `<div id="c"><input id="ok" /><select id="bad1" aria-invalid="true"></select><input id="bad2" aria-invalid="true" /></div>`;
    const el = scrollToFirstInvalid(document.getElementById("c"));
    expect(el.id).toBe("bad1");
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
    expect(document.activeElement.id).toBe("bad1");
    document.body.innerHTML = "";
  });

  async function renderAssign(rows = []) {
    rpcHandlers.list_assignments = rows.map((r) => ({ row_data: r, total_count: rows.length }));
    rpcHandlers.list_series_requests = [];
    rpcHandlers.list_series_options = [{ id: "s1", title: "Kirchhoff" }];
    rpcHandlers.list_assignable_educators = [
      { row_data: { id: "e1", name: "ASHIKA", subjects: ["Physics"] }, total_count: 2 },
      { row_data: { id: "e2", name: "Ravi", subjects: ["Physics"] }, total_count: 2 },
    ];
    rpcHandlers.create_assignments = ["a1", "a2"];
    const { default: AssignEducators } = await import("../src/portals/admin/pages/AssignEducators");
    render(<MemoryRouter><AssignEducators /></MemoryRouter>);
    await wait(50);
  }
  const openNew = async () => {
    fireEvent.click(screen.getAllByRole("button", { name: /new assignment/i })[0]);
    await screen.findByText("Who builds each test", {}, { timeout: 50 }).catch(() => {});
  };

  it("a failed Create scrolls to the first missing field, which shows its own message", async () => {
    await renderAssign();
    await openNew();
    fireEvent.click(screen.getByRole("button", { name: "Create Assignment" }));
    const seriesSelect = await screen.findByDisplayValue("Select a test series…");
    expect(seriesSelect).toHaveAttribute("aria-invalid", "true");
    expect(screen.getAllByText("Select an existing test series, or switch to \"New series\".").length).toBeGreaterThan(0);
    expect(screen.getAllByText("A deadline is required.").length).toBeGreaterThan(0);
    await waitFor(() => expect(Element.prototype.scrollIntoView).toHaveBeenCalled());
    expect(document.activeElement).toBe(seriesSelect);
    // fixing a field clears its message, the typed values stay
    fireEvent.change(seriesSelect, { target: { value: "s1" } });
    await waitFor(() => expect(seriesSelect).not.toHaveAttribute("aria-invalid"));
    expect(screen.queryByText("Select an existing test series, or switch to \"New series\".")).toBeNull();
  });

  it("2 tests and 2 educators: one test each, shown and sent as the allocation", async () => {
    await renderAssign();
    await openNew();
    fireEvent.change(screen.getByDisplayValue("Select a test series…"), { target: { value: "s1" } });
    fireEvent.change(screen.getByPlaceholderText("e.g. Full Mock Test 3 — Thermodynamics"), { target: { value: "Loops" } });
    fireEvent.click(screen.getByRole("checkbox", { name: /ASHIKA/ }));
    fireEvent.click(screen.getByRole("checkbox", { name: /Ravi/ }));
    const count = screen.getAllByRole("spinbutton")[0];
    fireEvent.change(count, { target: { value: "2" } });
    expect(await screen.findByText("Who builds each test")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Educator for test 1" })).toHaveValue("e1");
    expect(screen.getByRole("combobox", { name: "Educator for test 2" })).toHaveValue("e2");
    expect(screen.getByText(/ASHIKA: 1 test .* · Ravi: 1 test/)).toBeInTheDocument();
    fireEvent.change(document.querySelector('input[type="date"]'), { target: { value: "2026-12-20" } });
    fireEvent.click(screen.getByRole("button", { name: "Create Assignment" }));
    await waitFor(() => expect(rpcCalls.some(([n]) => n === "create_assignments")).toBe(true));
    const [, params] = rpcCalls.find(([n]) => n === "create_assignments");
    expect(params.p.allocation).toEqual([{ educatorId: "e1", tests: 1 }, { educatorId: "e2", tests: 1 }]);
    expect(params.p.testCount).toBe(2);
    expect(await screen.findByText("2 assignments created.")).toBeInTheDocument();
  });

  it("one educator and 2 tests: says that educator builds both", async () => {
    await renderAssign();
    await openNew();
    fireEvent.click(screen.getByRole("checkbox", { name: /ASHIKA/ }));
    fireEvent.change(screen.getAllByRole("spinbutton")[0], { target: { value: "2" } });
    expect(await screen.findByText("One educator builds all 2 tests. Select more educators to split them.")).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
const ROW = {
  id: "asg-1", code: "ASG-5001", series_id: "s1", series_name: "Kirchhoff", subject: "Physics", topics: [], educator_id: "e1",
  educator_name: "ASHIKA", test_name: "Loops paper", question_count: 10, question_type_mix: "objective", difficulty: "Medium",
  total_marks: 15, duration_minutes: 30, assigned_date: "2026-11-02", deadline: "2026-12-01", status: "assigned",
  display_status: "assigned", progress: 0, created_at: "2026-11-02T10:00:00Z", test_count: 1,
};

describe("assignment details popup", () => {
  async function openDetails() {
    rpcHandlers.list_assignments = [{ row_data: ROW, total_count: 1 }];
    rpcHandlers.list_series_requests = [];
    rpcHandlers.list_series_options = [];
    rpcHandlers.list_assignable_educators = [];
    rpcHandlers.get_assignment_detail = { assignment: ROW, history: [], comments: [], notifications: [{ id: "n1", title: "New test assignment", message: "You've been assigned…", created_at: ROW.created_at }] };
    const { default: AssignEducators } = await import("../src/portals/admin/pages/AssignEducators");
    render(<MemoryRouter><AssignEducators /></MemoryRouter>);
    fireEvent.click((await screen.findAllByRole("button", { name: /more actions/i }))[0]);
    fireEvent.click(await screen.findByRole("menuitem", { name: "View Details" }));
    return screen.findByRole("dialog");
  }

  it("X closes it, and it stays closed", async () => {
    const dialog = await openDetails();
    await screen.findByText("Number of Tests");
    fireEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await wait(60);
    expect(screen.queryByText("Number of Tests")).toBeNull();
  });

  it("Escape closes it", async () => {
    await openDetails();
    await screen.findByText("Number of Tests");
    fireEvent.keyDown(document, { key: "Escape" });
    await wait(60);
    expect(screen.queryByText("Number of Tests")).toBeNull();
  });

  it("the educator's own messages are not shown to the admin any more", async () => {
    await openDetails();
    await screen.findByText("Number of Tests");
    expect(screen.queryByText("Educator Notifications")).toBeNull();
    expect(screen.queryByText(/mock, not delivered/)).toBeNull();
  });
});

// -----------------------------------------------------------------------------
describe("sidebar badge", () => {
  it("says what the Assign Educators number counts", () => {
    expect(badgeHint("/admin/testseries/assign-educators", 3)).toBe("3 open assignments: assigned, in progress or waiting for review (completed and cancelled ones aren't counted)");
    expect(badgeHint("/admin/testseries/assign-educators", 1)).toMatch(/^1 open assignment:/);
  });

  it("an assignment change announces itself so the badge refreshes", async () => {
    rpcHandlers.cancel_assignment = null;
    const seen = [];
    const stop = onChanged("assignments", (d) => seen.push(d.action));
    await assignmentsApi.cancel("asg-1", "no");
    stop();
    expect(seen).toEqual(["cancel"]);
  });
});

// -----------------------------------------------------------------------------
describe("content moderation", () => {
  it("a resolved or dismissed item can only be reopened (no Dismiss)", () => {
    expect(actionsFor("resolved").map((a) => a.label)).toEqual(["Reopen (mark in review)"]);
    expect(actionsFor("dismissed").map((a) => a.label)).toEqual(["Reopen (mark in review)"]);
    expect(actionsFor("in_review").map((a) => a.label)).toEqual(["Resolve", "Dismiss"]);
    expect(actionsFor("new").map((a) => a.label)).toEqual(["Mark in review", "Resolve", "Dismiss"]);
  });

  it("the note looks resolved only once the item is resolved", () => {
    expect(noteStyle("in_review")).toEqual({ tone: "review", title: "Note to the student (still in review)" });
    expect(noteStyle("resolved").tone).toBe("resolved");
    expect(noteStyle("dismissed").tone).toBe("dismissed");
  });
});

// -----------------------------------------------------------------------------
describe("educator: assignment messages", () => {
  function fakeApi(rows) {
    let list = rows;
    return {
      listAssignmentNotifications: vi.fn(async () => ({ rows: list, unread: list.filter((n) => !n.isRead).length })),
      markAssignmentNotificationRead: vi.fn(async (id) => { list = list.map((n) => (n.id === id ? { ...n, isRead: true } : n)); return 1; }),
    };
  }
  const MSG = { id: "n1", assignmentId: "asg-1", type: "assigned", title: "New test assignment", message: "You've been assigned \"Loops\" (Physics): 1 test. Deadline: 2026-12-01.", isRead: false, createdAt: "2026-11-13T10:00:00Z" };

  async function renderPortal(api) {
    auth.user = { id: `edu-${Math.random()}`, name: "ASHIKA", role: "teacher", email: "e@x.in" };
    window.sessionStorage.setItem(`ul.educator.profilePrompted.${auth.user.id}`, "1");
    const { EducatorGate } = await import("../src/layouts/TeacherLayout");
    const statusApi = { getStatus: vi.fn().mockResolvedValue({ status: "approved" }) };
    render(<MemoryRouter initialEntries={["/teacher/dashboard"]}><Routes>
      <Route path="/teacher" element={<EducatorGate user={auth.user} onLogout={vi.fn()} statusApi={statusApi} notificationsApi={api} />}>
        <Route path="dashboard" element={<p>Dashboard page</p>} />
        <Route path="assigned" element={<p>Assigned page</p>} />
        <Route path="assigned/:assignmentId" element={<p>Assignment detail page</p>} />
      </Route>
    </Routes></MemoryRouter>);
  }

  it("a new assignment pops up for the educator, with a count on Assigned; View opens it and marks it read", async () => {
    const api = fakeApi([MSG]);
    await renderPortal(api);
    expect(await screen.findByText("New test assignment")).toBeInTheDocument();
    expect(screen.getByLabelText("1 new assignment message")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "View assignment" }));
    expect(await screen.findByText("Assignment detail page")).toBeInTheDocument();
    expect(api.markAssignmentNotificationRead).toHaveBeenCalledWith("n1");
    expect(screen.queryByText("New test assignment")).toBeNull();
    auth.user = { id: "adm-1", name: "Admin", role: "admin", email: "a@x.in" };
  });

  it("Dismiss marks it read, so the next sign-in doesn't show it again", async () => {
    const api = fakeApi([MSG]);
    await renderPortal(api);
    await screen.findByText("New test assignment");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(api.markAssignmentNotificationRead).toHaveBeenCalledWith("n1");
    await waitFor(() => expect(screen.queryByText("New test assignment")).toBeNull());
    cleanup();
    await renderPortal(api);   // signing in again
    await screen.findByText("Dashboard page");
    await wait(50);
    expect(screen.queryByText("New test assignment")).toBeNull();
    auth.user = { id: "adm-1", name: "Admin", role: "admin", email: "a@x.in" };
  });
});
