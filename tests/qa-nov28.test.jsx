/** @vitest-environment jsdom */
// QA 28 Nov bug report (20261129090000).
//   Bug 3  the admin's educator profile, Students tab: the students of the
//          educator's test series (adm_educator_students), not an empty list
//   Bug 4  the admin deletes a student's account after a typed confirmation
//          (admin-delete-student)
// Bug 1 (no model answer) is in tests/admin-question-types.test.jsx and
// tests/answer-sheet-flow.test.jsx; Bug 2 (Submit after the upload) in
// tests/answer-sheet-flow.test.jsx; optional onboarding fields in
// tests/educator-portal.test.jsx and tests/qa-nov07.test.jsx.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn(async () => ({ data: null, error: null }));
const invoke = vi.fn(async () => ({ data: { deleted: true }, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) }, auth: { onAuthStateChange: () => {} } },
}));

import { educatorsApi } from "../src/portals/admin/services/educatorsApi";
import EducatorProfile from "../src/portals/admin/pages/EducatorProfile";
import UserManagement from "../src/portals/admin/pages/UserManagement";
import { AdminDeleteError, statusForCode, validateAdminDeleteRequest } from "../supabase/functions/admin-delete-student/validate.ts";

const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
beforeEach(() => { rpc.mockReset(); rpc.mockResolvedValue({ data: null, error: null }); invoke.mockClear(); });
afterEach(() => cleanup());

const E = "11111111-1111-4111-8111-111111111111";
const S = "22222222-2222-4222-8222-222222222222";
const STUDENTS = {
  summary: { total: 2, active: 1, completed: 1, at_risk: 0, inactive: 0 },
  students: [
    { id: S, name: "Riya Sen", email: "riya@x.in", initials: "RS", series: [{ id: "s1", title: "JEE Physics 2026" }, { id: "s2", title: "NEET Biology" }],
      enrolled_at: "2026-11-20T10:00:00Z", tests_total: 4, tests_done: 2, progress: 50, last_active_at: "2026-11-27T10:00:00Z", status: "active" },
    { id: "s-2", name: "Kabir Das", email: "kabir@x.in", initials: "KD", series: [{ id: "s1", title: "JEE Physics 2026" }],
      enrolled_at: "2026-11-01T10:00:00Z", tests_total: 4, tests_done: 4, progress: 100, last_active_at: "2026-11-26T10:00:00Z", status: "completed" },
  ],
};

// -----------------------------------------------------------------------------
describe("Bug 3: the educator's students", () => {
  it("educatorsApi.students maps adm_educator_students", async () => {
    rpc.mockResolvedValue({ data: STUDENTS, error: null });
    const r = await educatorsApi.students(E);
    expect(rpc).toHaveBeenCalledWith("adm_educator_students", { p_educator: E });
    expect(r.summary).toEqual({ total: 2, active: 1, completed: 1, atRisk: 0, inactive: 0 });
    expect(r.rows[0]).toMatchObject({ id: S, name: "Riya Sen", progress: 50, testsDone: 2, testsTotal: 4, status: "active" });
    expect(r.rows[0].series.map((x) => x.title)).toEqual(["JEE Physics 2026", "NEET Biology"]);
  });

  function renderProfile(students = STUDENTS) {
    rpc.mockImplementation((name) => {
      if (name === "get_educator_detail") {
        return Promise.resolve({ data: { educator: { id: E, full_name: "Ashika", email: "ashika@x", verification_status: "approved",
          account_status: "active", subjects: [], languages: [], actions: [] }, documents: [], history: [], courses: [] }, error: null });
      }
      if (name === "adm_educator_students") return Promise.resolve({ data: students, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    render(
      <MemoryRouter initialEntries={[{ pathname: `/admin/educatorverification/${E}`, state: { tab: "students" } }]}>
        <Routes><Route path="/admin/educatorverification/:educatorId" element={<EducatorProfile />} /></Routes>
      </MemoryRouter>,
    );
  }

  it("the Students tab lists them with their real test series and the counts", async () => {
    renderProfile();
    expect(await screen.findByText("Riya Sen")).toBeInTheDocument();
    expect(screen.getByText("JEE Physics 2026, NEET Biology")).toBeInTheDocument();
    expect(screen.getByText("Kabir Das")).toBeInTheDocument();
    expect(screen.queryByText("No students match these filters.")).toBeNull();
    expect(rpc.mock.calls.some(([n, a]) => n === "adm_educator_students" && a.p_educator === E)).toBe(true);
    // search by series title, filter by status
    fireEvent.change(screen.getByPlaceholderText(/Search students/), { target: { value: "neet" } });
    expect(screen.getByText("Riya Sen")).toBeInTheDocument();
    expect(screen.queryByText("Kabir Das")).toBeNull();
    fireEvent.change(screen.getByPlaceholderText(/Search students/), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("Status: All"), { target: { value: "completed" } });
    expect(screen.queryByText("Riya Sen")).toBeNull();
    expect(screen.getByText("Kabir Das")).toBeInTheDocument();
  });

  it("no students yet says so (not 'no students match these filters')", async () => {
    renderProfile({ summary: { total: 0 }, students: [] });
    expect(await screen.findByText("No students have enrolled in this educator's test series yet.")).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
describe("Bug 4: delete a student's account", () => {
  it("validates the request (user id and the typed DELETE)", () => {
    expect(validateAdminDeleteRequest({ userId: S.toUpperCase(), confirm: "delete", reason: " spam " })).toEqual({ userId: S, reason: "spam" });
    expect(() => validateAdminDeleteRequest({ userId: "x", confirm: "DELETE" })).toThrow(AdminDeleteError);
    expect(() => validateAdminDeleteRequest({ userId: S, confirm: "yes" })).toThrow(/Type DELETE/);
    expect(() => validateAdminDeleteRequest(null)).toThrow(/JSON body/);
    expect([statusForCode("42501"), statusForCode("P0002"), statusForCode("22023"), statusForCode("XX")]).toEqual([403, 404, 400, 500]);
  });

  function renderUsers() {
    let deleted = false;
    rpc.mockImplementation((name) => {
      if (name === "list_students") {
        return Promise.resolve({ data: deleted ? [] : [{ row_data: { id: S, full_name: "Riya Sen", email: "riya@x.in", status: "active", registered_at: "2026-11-01T10:00:00Z" }, total_count: 1 }], error: null });
      }
      if (name === "get_student_stats") return Promise.resolve({ data: { total: deleted ? 0 : 1, active: deleted ? 0 : 1, blocked: 0 }, error: null });
      return Promise.resolve({ data: null, error: null });
    });
    invoke.mockImplementation(async () => { deleted = true; return { data: { deleted: true, userId: S }, error: null }; });
    render(<MemoryRouter><UserManagement /></MemoryRouter>);
  }

  it("Delete asks for DELETE, then calls admin-delete-student and refreshes the list", async () => {
    renderUsers();
    fireEvent.click(await screen.findByRole("button", { name: "Delete Riya Sen's account" }));
    const dialog = screen.getByRole("alertdialog");
    expect(within(dialog).getByText("Delete this student account?")).toBeInTheDocument();
    expect(within(dialog).getByText(/can't be undone/)).toBeInTheDocument();
    const confirm = within(dialog).getByRole("button", { name: "Delete Account" });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByLabelText("Type DELETE to confirm"), { target: { value: "delete" } });
    expect(confirm).toBeEnabled();
    await act(async () => { fireEvent.click(confirm); });
    expect(invoke).toHaveBeenCalledWith("admin-delete-student", { body: { userId: S, confirm: "DELETE", reason: null } });
    await waitFor(() => expect(screen.queryByText("Riya Sen")).toBeNull());
    expect(screen.queryByRole("alertdialog")).toBeNull();
  });

  it("Cancel deletes nothing", async () => {
    renderUsers();
    fireEvent.click(await screen.findByRole("button", { name: "Delete Riya Sen's account" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }));
    await wait();
    expect(invoke).not.toHaveBeenCalled();
    expect(screen.getByText("Riya Sen")).toBeInTheDocument();
  });
});
