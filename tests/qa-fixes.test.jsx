/** @vitest-environment jsdom */
// QA triage: P3 (educator state UI), P7 (student detail), P4 item 5 (tracker
// creator), P5 a / d / e (readiness, cross-portal refresh, rejected series).
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn();
vi.mock("../src/services/supabaseClient", () => ({
  supabase: { rpc: (...a) => rpc(...a), functions: { invoke: vi.fn() }, auth: { onAuthStateChange: () => {} } },
}));

import { EDUCATOR_ACTIONS, educatorActions, educatorDisplay } from "../src/portals/admin/utils/statusMaps";
import { educatorsApi } from "../src/portals/admin/services/educatorsApi";
import { studentsApi } from "../src/portals/admin/services/studentsApi";
import { testSeriesApi } from "../src/portals/admin/services/testSeriesApi";
import { validateTestForPublish } from "../src/portals/admin/data/testSeriesMock";
import { notifyChanged, onChanged, useRefetchOnChange } from "../src/services/dataSync";
import { useRpc } from "../src/portals/admin/hooks/useRpc";
import EducatorVerification from "../src/portals/admin/pages/EducatorVerification";
import TestDetail from "../src/portals/admin/pages/TestDetail";
import TestSeriesTracker from "../src/portals/admin/pages/TestSeriesTracker";
import { AuthoringPortalContext, EDUCATOR_AUTHORING } from "../src/portals/admin/context/authoringPortal";

const ok = (data) => Promise.resolve({ data, error: null });
const wait = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
beforeEach(() => { rpc.mockReset(); rpc.mockImplementation(() => ok(null)); window.scrollTo = () => {}; });
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("P3: one status vocabulary and the action matrix", () => {
  it("one primary badge; the account badge only for an approved educator", () => {
    expect(educatorDisplay({ verificationStatus: "rejected", accountStatus: "inactive" })).toEqual({
      primary: expect.objectContaining({ label: "Rejected" }), account: null,
    });
    expect(educatorDisplay({ verificationStatus: "rejected", accountStatus: "active" }).account).toBeNull();   // never Active next to Rejected
    expect(educatorDisplay({ verificationStatus: "verified", accountStatus: "active" })).toEqual({
      primary: expect.objectContaining({ label: "Approved" }), account: expect.objectContaining({ label: "Account: Active" }),
    });
    expect(educatorDisplay({ verificationStatus: "verified", accountStatus: "inactive" }).primary.label).toBe("Deactivated");
    expect(educatorDisplay({ verificationStatus: "verified", accountStatus: "suspended" }).primary.label).toBe("Suspended");
    expect(educatorDisplay({ verificationStatus: "pending", accountStatus: "active" })).toEqual({
      primary: expect.objectContaining({ label: "Pending review" }), account: null,
    });
  });

  it("shows only the server's actions, in its order; internal ones are hidden", () => {
    const e = { actions: ["approve", "request_changes", "reject", "start_review"] };
    expect(educatorActions(e)).toEqual(["approve", "request_changes", "reject"]);
    expect(educatorActions({ actions: ["deactivate", "suspend", "delete"] }, ["account"])).toEqual(["deactivate", "suspend"]);
    expect(educatorActions({})).toEqual([]);
    expect(Object.keys(EDUCATOR_ACTIONS)).toEqual(expect.arrayContaining(["reconsider", "activate", "reactivate"]));
  });

  it("each action calls the right RPC", async () => {
    const cases = {
      approve: ["set_educator_verification", { p_id: "e1", p_decision: "approved", p_note: null }],
      request_changes: ["set_educator_verification", { p_id: "e1", p_decision: "changes_requested", p_note: "why" }],
      reject: ["set_educator_verification", { p_id: "e1", p_decision: "rejected", p_note: "why" }],
      reconsider: ["set_educator_verification", { p_id: "e1", p_decision: "under_review", p_note: null }],
      deactivate: ["set_educator_account_status", { p_id: "e1", p_status: "inactive", p_reason: "why" }],
      suspend: ["set_educator_account_status", { p_id: "e1", p_status: "suspended", p_reason: "why" }],
      activate: ["set_educator_account_status", { p_id: "e1", p_status: "active", p_reason: null }],
      reactivate: ["set_educator_account_status", { p_id: "e1", p_status: "active", p_reason: null }],
      delete: ["delete_educator", { p_id: "e1" }],
    };
    for (const [action, call] of Object.entries(cases)) {
      rpc.mockClear();
      await educatorsApi.perform("e1", action, ["approve", "reconsider"].includes(action) ? undefined : "why");
      expect(rpc, action).toHaveBeenCalledWith(...call);
    }
    await expect(educatorsApi.perform("e1", "nope")).rejects.toThrow("Unknown educator action");
  });

  it("the educators list: a rejected row offers only Review and reconsider / Delete, and no Active badge", async () => {
    const row = (id, name, verification, account, actions) => ({
      row_data: { id, full_name: name, email: `${id}@x`, subjects: ["Maths"], verification_status: verification,
                  account_status: account, actions, joined_at: "2026-10-01T00:00:00Z" },
      total_count: 2,
    });
    rpc.mockImplementation((name) => {
      if (name === "list_educators") return ok([row("e1", "Rita Rejected", "rejected", "inactive", ["reconsider", "delete"]),
                                                row("e2", "Asha Approved", "approved", "active", ["deactivate", "suspend", "delete"])]);
      return ok({});
    });
    render(<MemoryRouter><EducatorVerification /></MemoryRouter>);
    const rejected = (await screen.findByText("Rita Rejected")).closest("tr");
    expect(within(rejected).getByText("Rejected")).toBeInTheDocument();
    expect(within(rejected).queryByText("Active")).toBeNull();
    fireEvent.click(within(rejected).getByRole("button", { name: "More actions" }));
    let items = within(screen.getByRole("menu")).getAllByRole("menuitem").map((b) => b.textContent);
    expect(items).toEqual(expect.arrayContaining(["Review and reconsider", "Delete"]));
    expect(items).not.toEqual(expect.arrayContaining(["Suspend"]));
    expect(items).not.toContain("Deactivate");
    fireEvent.keyDown(document, { key: "Escape" });
    const approved = screen.getByText("Asha Approved").closest("tr");
    expect(within(approved).getByText("Active")).toBeInTheDocument();
    fireEvent.click(within(approved).getByRole("button", { name: "More actions" }));
    items = within(screen.getByRole("menu")).getAllByRole("menuitem").map((b) => b.textContent);
    expect(items).toEqual(expect.arrayContaining(["Deactivate", "Suspend", "Delete"]));
  });
});

// -----------------------------------------------------------------------------
describe("P7: the student's real test series", () => {
  it("titles, progress, best score and attempts from the server; courses are kept apart", async () => {
    rpc.mockImplementation(() => ok({
      id: "s1", full_name: "Asha", status: "active",
      enrolled_series: [{ series_id: "a", title: "QA Physics", enrolled_at: "2026-10-30T00:00:00Z", tests_total: 2, tests_done: 1, progress: 50, best_score: 75, attempts: 1 }],
      enrolled_courses: [{ course_id: "c", title: "Algebra course", progress: 10 }],
    }));
    const s = await studentsApi.detail("s1");
    expect(s.enrolledSeries).toEqual([expect.objectContaining({ title: "QA Physics", progress: 50, testsDone: 1, testsTotal: 2, bestScore: 75, attempts: 1 })]);
    expect(s.enrolledSeries.map((x) => x.title)).not.toContain("Algebra course");
    expect(s.enrolledCourses).toEqual([expect.objectContaining({ title: "Algebra course" })]);
  });
});

// -----------------------------------------------------------------------------
describe("P5 a: readiness only for rules that exist", () => {
  const q = { kind: "objective", correctAnswer: "A" };
  it("a schedule is optional; questions and correct answers are what counts", () => {
    expect(validateTestForPublish({ name: "Unit 1", duration: 30, totalMarks: 4, passingMarks: 0, scheduledAt: "", questions: [q] }))
      .toEqual({ valid: true, errors: [] });
    expect(validateTestForPublish({ name: "Unit 1", duration: 30, questions: [] }).errors).toContain("At least one question is required before publishing.");
    expect(validateTestForPublish({ name: "Unit 1", duration: 30, questions: [{ kind: "objective" }] }).errors).toContain("Every question needs a correct answer.");
    expect(validateTestForPublish({ name: "U", duration: 30, totalMarks: 4, passingMarks: 9, questions: [q] }).errors).toContain("Passing marks cannot exceed total marks.");
  });
});

const SERIES = (status, testStatus, origin = "educator") => ({
  id: "s1", title: "Educator Series", status, origin, rejection_reason: status === "rejected" ? "Add answers" : null,
  tests: [{ id: "t1", title: "Unit 1", status: testStatus, position: 1, duration_minutes: 30, total_marks: 4, passing_percent: 50,
            attempt_limit: 1, scheduled_at: null,
            questions: [{ id: "q1", type: "mcq_single", body: "2+2?", marks: 4, position: 1,
                          options: [{ option_key: "A", label: "4", is_correct: true, position: 1 }, { option_key: "B", label: "5", is_correct: false, position: 2 }] }] }],
});
function renderTest(series, portal) {
  rpc.mockImplementation((name) => ok(name === "get_test_series" ? series : null));
  const page = (
    <MemoryRouter initialEntries={["/x/s1/tests/t1"]}>
      <Routes><Route path="/x/:seriesId/tests/:testId" element={<TestDetail />} /></Routes>
    </MemoryRouter>
  );
  return render(portal ? <AuthoringPortalContext.Provider value={portal}>{page}</AuthoringPortalContext.Provider> : page);
}

describe("P5 a / e: the test page", () => {
  it("a published test without a schedule never shows 'not ready'", async () => {
    renderTest(SERIES("published", "published", "admin"));
    await screen.findAllByText("Unit 1");
    expect(screen.queryByText(/Not ready to publish yet/)).toBeNull();
    expect(screen.queryByText(/scheduled date\/time is required/)).toBeNull();
  });

  it("a rejected educator series: only the series-level Resubmit, no test-level Submit for approval", async () => {
    renderTest(SERIES("rejected", "draft"), EDUCATOR_AUTHORING);
    expect(await screen.findByRole("button", { name: "Resubmit for approval" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit for approval" })).toBeNull();
    expect(screen.getByRole("button", { name: /Add Question/ })).toBeEnabled();
  });

  it("while the series waits for approval, Add Question is disabled and says why", async () => {
    renderTest(SERIES("pending_approval", "draft"), EDUCATOR_AUTHORING);
    const add = await screen.findByRole("button", { name: /Add Question/ });
    expect(add).toBeDisabled();
    expect(add).toHaveAttribute("title", expect.stringMatching(/waiting for admin approval/));
  });
});

// -----------------------------------------------------------------------------
describe("P5 d: a change refreshes every open view", () => {
  it("a successful test series write announces the change; a failed one doesn't", async () => {
    const heard = vi.fn();
    const stop = onChanged("test-series", heard);
    rpc.mockImplementation(() => ok({ id: "t1", title: "Unit 1", questions: [] }));
    await testSeriesApi.setTestStatus("t1", "draft");
    expect(heard).toHaveBeenCalledWith(expect.objectContaining({ topic: "test-series", action: "setTestStatus" }));
    heard.mockClear();
    rpc.mockImplementation(() => Promise.resolve({ data: null, error: { message: "nope", code: "42501" } }));
    await expect(testSeriesApi.setTestStatus("t1", "draft")).rejects.toThrow("nope");
    expect(heard).not.toHaveBeenCalled();
    await testSeriesApi.get("s1").catch(() => {});
    expect(heard).not.toHaveBeenCalled();   // reads never announce
    stop();
  });

  it("open pages refetch on a change and on focus; cached lists for that topic are dropped", async () => {
    let n = 0;
    const load = vi.fn(async () => ++n);
    function View() {
      const state = useRpc(load, { cacheKey: "educators:list:x" });
      useRefetchOnChange(state.refetch, "educators", { delayMs: 0 });
      return <p>value {String(state.data)}</p>;
    }
    render(<View />);
    expect(await screen.findByText("value 1")).toBeInTheDocument();
    await act(async () => { notifyChanged("educators"); });
    await wait(10);
    expect(screen.getByText("value 2")).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    await wait(10);
    expect(screen.getByText("value 3")).toBeInTheDocument();
    cleanup();
    render(<View />);   // still cached: the last value shows at once
    expect(screen.getByText("value 3")).toBeInTheDocument();
    cleanup();
    notifyChanged("educators");   // a change drops the cached copy
    render(<View />);
    expect(screen.queryByText("value 3")).toBeNull();
  });
});

// -----------------------------------------------------------------------------
describe("P4 item 5: the tracker shows the creator", () => {
  it("an independent series lists its creator with a Creator badge and reads Independent", async () => {
    rpc.mockImplementation((name) => {
      if (name === "list_series_tracker") return ok([{ row_data: {
        series_id: "s9", series_name: "Indie Algebra", subject: "Maths", educators: [], total_required: 0, tests_created: 0,
        tests_submitted: 0, tests_approved: 0, completion_pct: 0, overall_status: "Independent", origin: "educator", creator_name: "Ravi Kumar",
      }, total_count: 1 }]);
      return ok({});
    });
    render(<MemoryRouter><TestSeriesTracker /></MemoryRouter>);
    const row = (await screen.findByText("Indie Algebra")).closest("tr");
    expect(within(row).getByText("Ravi Kumar")).toBeInTheDocument();
    expect(within(row).getByText("Creator")).toBeInTheDocument();
    expect(within(row).getByText("Independent")).toBeInTheDocument();
  });
});
