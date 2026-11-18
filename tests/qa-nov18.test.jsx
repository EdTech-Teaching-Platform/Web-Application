/** @vitest-environment jsdom */
// QA reports of 18 Nov 2026:
//   1. delete account without admin approval (DeleteAccountSection + the
//      delete-account Edge Function's validators);
//   2. attempt limit (server-side, supabase/tests/qa_nov18.sql) - the UI
//      shows "No attempts left" from the server's numbers;
//   3. the educator sees how many tests an assignment asks for;
//   4. back from a test series opened from a notification returns to Notifications.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpcHandlers = {};
const rpc = vi.fn(async (name) => {
  const h = rpcHandlers[name];
  if (h instanceof Error) return { data: null, error: h };
  return { data: typeof h === "function" ? h() : h ?? null, error: null };
});
const invoke = vi.fn(async () => ({ data: { deleted: true }, error: null }));
const signOut = vi.fn(async () => ({ error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: (...a) => invoke(...a) },
    auth: {
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
      signOut: (...a) => signOut(...a),
      getSession: async () => ({ data: { session: { access_token: "t" } } }),
      getUser: async () => ({ data: { user: { identities: [{ provider: "email" }] } } }),
    },
  },
}));
const auth = { user: { id: "stu-1", name: "Riya", role: "student", email: "r@x.in" }, loading: false };
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => auth }));

import { CONFIRM_WORD, DeleteRequestError, hasPasswordIdentity, validateDeleteRequest } from "../supabase/functions/delete-account/validate.ts";
import { accountDeletionApi } from "../src/services/accountDeletionApi";

const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => {
  for (const k of Object.keys(rpcHandlers)) delete rpcHandlers[k];
  rpc.mockClear(); invoke.mockClear(); signOut.mockClear();
  window.scrollTo = vi.fn();
});
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("1. delete account, no admin approval", () => {
  function fakeApi(impl) {
    return { deleteAccount: vi.fn(impl || (async () => ({ deleted: true }))), signOut: vi.fn(async () => {}) };
  }

  it("password + DELETE deletes at once, confirms, then signs out", async () => {
    const { default: DeleteAccountSection } = await import("../src/components/account/DeleteAccountSection");
    const api = fakeApi();
    const onSignedOut = vi.fn();
    render(<DeleteAccountSection email="r@x.in" api={api} passwordCheck={async () => true} onSignedOut={onSignedOut} />);
    expect(screen.queryByText(/administrator/i)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Delete account…" }));
    const dialog = screen.getByRole("dialog", { name: "Delete your account?" });
    expect(within(dialog).getByText(/No approval is needed/)).toBeInTheDocument();
    const submit = within(dialog).getByRole("button", { name: "Delete my account" });
    expect(submit).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Your password"), { target: { value: "secret1" } });
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "delete" } });
    fireEvent.change(within(dialog).getByLabelText(/Reason/), { target: { value: "Moving abroad" } });
    expect(submit).toBeEnabled();
    fireEvent.click(submit);
    expect(await screen.findByRole("alertdialog", { name: "Your account has been deleted" })).toBeInTheDocument();
    expect(api.deleteAccount).toHaveBeenCalledWith({ password: "secret1", reason: "Moving abroad" });
    fireEvent.click(screen.getByRole("button", { name: "OK" }));
    await wait();
    expect(api.signOut).toHaveBeenCalled();
    expect(onSignedOut).toHaveBeenCalled();
  });

  it("a wrong password is shown and the account stays", async () => {
    const { default: DeleteAccountSection } = await import("../src/components/account/DeleteAccountSection");
    const api = fakeApi(async () => { throw Object.assign(new Error("That password isn't right."), { field: "password" }); });
    render(<DeleteAccountSection email="r@x.in" api={api} passwordCheck={async () => true} onSignedOut={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account…" }));
    fireEvent.change(screen.getByLabelText("Your password"), { target: { value: "nope" } });
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("That password isn't right.");
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(api.signOut).not.toHaveBeenCalled();
  });

  it("Google-only accounts confirm with DELETE (no password field)", async () => {
    const { default: DeleteAccountSection } = await import("../src/components/account/DeleteAccountSection");
    const api = fakeApi();
    render(<DeleteAccountSection email="g@x.in" api={api} passwordCheck={async () => false} onSignedOut={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Delete account…" }));
    await wait();
    expect(screen.queryByLabelText("Your password")).toBeNull();
    fireEvent.change(screen.getByLabelText("Type DELETE to confirm"), { target: { value: "DELETE" } });
    fireEvent.click(screen.getByRole("button", { name: "Delete my account" }));
    expect(await screen.findByRole("alertdialog")).toBeInTheDocument();
    expect(api.deleteAccount).toHaveBeenCalledWith({ password: "", reason: "" });
  });

  it("the service calls the delete-account Edge Function with the confirmation", async () => {
    await accountDeletionApi.deleteAccount({ password: "pw", reason: "  bye " });
    expect(invoke).toHaveBeenCalledWith("delete-account", { body: { confirm: "DELETE", password: "pw", reason: "bye" } });
  });

  it("Edge Function validators: DELETE required, password and reason trimmed", () => {
    expect(CONFIRM_WORD).toBe("DELETE");
    expect(() => validateDeleteRequest(null)).toThrow(DeleteRequestError);
    expect(() => validateDeleteRequest({ password: "x" })).toThrow(/Type DELETE/);
    expect(validateDeleteRequest({ confirm: " delete ", password: "pw", reason: "  why  " })).toEqual({ password: "pw", reason: "why" });
    expect(validateDeleteRequest({ confirm: "DELETE" })).toEqual({ password: null, reason: null });
    expect(hasPasswordIdentity({ identities: [{ provider: "email" }] })).toBe(true);
    expect(hasPasswordIdentity({ identities: [{ provider: "google" }], app_metadata: { providers: ["google"] } })).toBe(false);
    expect(hasPasswordIdentity({ app_metadata: { provider: "email" } })).toBe(true);
  });
});

// -----------------------------------------------------------------------------
describe("2. attempt limit (UI side)", () => {
  it("a test with no attempts left can't be started from the series page", async () => {
    rpcHandlers.student_get_series = {
      id: "s1", title: "Physics", description: "", is_free: true, pricing: "free", is_enrolled: true,
      tests: [{ id: "t1", title: "Two tries", questions_count: 5, time_limit_mins: 20, attempts_used: 2, attempts_allowed: 2,
                attempts_remaining: 0, total_marks: 10, position: 1 }],
    };
    const { default: SeriesDetail } = await import("../src/portals/student/pages/SeriesDetail");
    render(<MemoryRouter initialEntries={["/student/test-series/s1"]}><Routes>
      <Route path="/student/test-series/:seriesId" element={<SeriesDetail />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByText("No attempts left")).toBeInTheDocument();
    expect(screen.getByText(/Attempts 2\/2/)).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
describe("3. assignment: number of tests for the educator", () => {
  const base = {
    id: "a1", code: "ASG-1", series_id: "s9", series_name: "Optics series", subject: "Physics", test_name: "Optics",
    status: "in_progress", display_status: "in_progress", deadline: "2026-11-30", question_count: 20, duration_minutes: 45,
    total_marks: 30, topics: [],
  };

  it("the list shows the tests to create, created and to go", async () => {
    const { AssignmentList } = await import("../src/portals/teacher/pages/AssignedWork");
    const api = { listAssignments: vi.fn(async () => [{ ...base, test_count: 2, tests_created: 1, tests_published: 0, tests_remaining: 1 }]) };
    render(<MemoryRouter><AssignmentList api={api} /></MemoryRouter>);
    expect(await screen.findByText("2 tests to create")).toBeInTheDocument();
    expect(screen.getByText(/1 created · 1 to go/)).toBeInTheDocument();
  });

  it("the detail lists the tests and adds the next one", async () => {
    const { AssignmentDetail } = await import("../src/portals/teacher/pages/AssignedWork");
    let created = 1;
    const detail = () => ({
      assignment: { ...base, test_count: 2, tests_created: created, tests_published: 0, tests_remaining: 2 - created,
        tests: Array.from({ length: created }, (_, i) => ({ id: `q${i + 1}`, title: `Optics - Test ${i + 1}`, status: "draft", questions_count: 0 })) },
      series: { id: "s9", title: "Optics series", status: "draft" }, test: { id: "q1" }, history: [], comments: [],
    });
    const api = {
      getAssignment: vi.fn(async () => detail()),
      addAssignmentTest: vi.fn(async () => { created = 2; return detail(); }),
    };
    render(<MemoryRouter initialEntries={["/teacher/assigned/a1"]}><Routes>
      <Route path="/teacher/assigned/:assignmentId" element={<AssignmentDetail api={api} seriesApi={{ publishSeries: vi.fn() }} />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole("heading", { name: "Tests for this assignment" })).toBeInTheDocument();
    expect(screen.getByText("Tests to create")).toBeInTheDocument();
    expect(screen.getByText("1 of 2 created")).toBeInTheDocument();
    expect(screen.getByText(/Test 1: Optics - Test 1/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Add test 2 of 2" }));
    expect(await screen.findByText("2 of 2 created")).toBeInTheDocument();
    expect(api.addAssignmentTest).toHaveBeenCalledWith("a1");
    expect(screen.getByText(/Test 2: Optics - Test 2/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Add test/ })).toBeNull();
    expect(screen.getByText(/All of them are created/)).toBeInTheDocument();
  });

  it("an older server (no test_count) keeps the old layout", async () => {
    const { assignmentTestProgress } = await import("../src/portals/teacher/utils/assignmentProgress");
    expect(assignmentTestProgress({ ...base })).toBeNull();
    expect(assignmentTestProgress({ ...base, test_count: 3, tests_created: 1 })).toMatchObject({ required: 3, created: 1, remaining: 2 });
  });
});

// -----------------------------------------------------------------------------
describe("4. back from a notification's test series", () => {
  it("the notification link carries from=notifications and the series page goes back to Notifications", async () => {
    const { default: Notifications } = await import("../src/portals/student/pages/Notifications");
    const { default: SeriesDetail } = await import("../src/portals/student/pages/SeriesDetail");
    rpcHandlers.student_get_series = { id: "s1", title: "Physics", description: "", is_free: true, pricing: "free", is_enrolled: true, tests: [] };
    const api = {
      list: vi.fn(async () => ({ rows: [{ id: "n1", title: "Your reported issue was resolved", body: "Fixed.", category: "system",
        isRead: true, actionUrl: "/student/test-series/s1", createdAt: "2026-11-18T05:00:00Z" }], unread: 0 })),
      markRead: vi.fn(async () => {}), markAllRead: vi.fn(async () => {}), unreadCount: vi.fn(async () => 0),
    };
    render(<MemoryRouter initialEntries={["/student/notifications"]}><Routes>
      <Route path="/student/notifications" element={<Notifications api={api} />} />
      <Route path="/student/test-series/:seriesId" element={<SeriesDetail />} />
    </Routes></MemoryRouter>);
    fireEvent.click(await screen.findByText("Open the test series"));
    const back = await screen.findByRole("link", { name: "← Notifications" });
    expect(back).toHaveAttribute("href", "/student/notifications");
    fireEvent.click(back);
    expect(await screen.findByRole("heading", { name: "Notifications" })).toBeInTheDocument();
  });

  it("opened from the test series list, back still goes to all test series", async () => {
    rpcHandlers.student_get_series = { id: "s1", title: "Physics", description: "", is_free: true, pricing: "free", is_enrolled: true, tests: [] };
    const { default: SeriesDetail } = await import("../src/portals/student/pages/SeriesDetail");
    render(<MemoryRouter initialEntries={["/student/test-series/s1"]}><Routes>
      <Route path="/student/test-series/:seriesId" element={<SeriesDetail />} />
    </Routes></MemoryRouter>);
    expect(await screen.findByRole("link", { name: "← All test series" })).toBeInTheDocument();
  });
});
