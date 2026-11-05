/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn();
vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: (...args) => rpc(...args), functions: { invoke: vi.fn() } } }));

import {
  EDUCATOR_DB_STATES, EDUCATOR_DECISION, EDUCATOR_STATUS_FILTERS, educatorStatusBadge, mapEducatorStatus,
  toDbEducatorStatus, toUiEducatorStatus,
} from "../src/portals/admin/utils/statusMaps";
import { educatorsApi } from "../src/portals/admin/services/educatorsApi";
import { assignmentsApi } from "../src/portals/admin/services/assignmentsApi";
import EducatorProfile from "../src/portals/admin/pages/EducatorProfile";
import { EducatorGate } from "../src/layouts/TeacherLayout";
import { GATE, gateFor } from "../src/portals/teacher/utils/onboarding";

beforeEach(() => rpc.mockReset());
afterEach(() => { cleanup(); vi.useRealTimers(); });

// -----------------------------------------------------------------------------
describe("educator status vocabulary (statusMaps)", () => {
  it("maps every DB state to a UI key with a label and a badge, and back", () => {
    for (const db of EDUCATOR_DB_STATES) {
      const ui = toUiEducatorStatus(db);
      expect(mapEducatorStatus(ui), db).not.toBe(ui);           // a real label, not the raw key
      expect(educatorStatusBadge(ui)).toMatch(/^is-/);
      expect(toDbEducatorStatus(ui)).toBe(db);
    }
    expect(toUiEducatorStatus("approved")).toBe("verified");
    expect(mapEducatorStatus("verified")).toBe("Approved");
  });

  it("decisions and filters only use values the server accepts", () => {
    for (const value of Object.values(EDUCATOR_DECISION)) expect(EDUCATOR_DB_STATES).toContain(value);
    for (const f of EDUCATOR_STATUS_FILTERS.filter((x) => x.value !== "all")) {
      expect([...EDUCATOR_DB_STATES]).toContain(toDbEducatorStatus(f.value));
    }
    expect(EDUCATOR_DECISION.request_changes).toBe("changes_requested");
  });
});

// -----------------------------------------------------------------------------
describe("admin services", () => {
  it("list_educators: the filter goes out as the DB state and rows come back as UI keys", async () => {
    rpc.mockResolvedValue({ data: [{ row_data: { id: "e1", full_name: "A B", verification_status: "approved", effective_state: "approved", subjects: [] }, total_count: 1 }], error: null });
    const res = await educatorsApi.list({ p_verification: "verified", p_page: 1 });
    expect(rpc).toHaveBeenCalledWith("list_educators", expect.objectContaining({ p_verification: "approved" }));
    expect(res.rows[0].verificationStatus).toBe("verified");
  });

  it("set_educator_verification gets the DB decision", async () => {
    rpc.mockResolvedValue({ data: null, error: null });
    await educatorsApi.setVerification("e1", EDUCATOR_DECISION.request_changes, "Add a B.Ed");
    expect(rpc).toHaveBeenCalledWith("set_educator_verification", { p_id: "e1", p_decision: "changes_requested", p_note: "Add a B.Ed" });
    await educatorsApi.setVerification("e1", "verified");
    expect(rpc).toHaveBeenLastCalledWith("set_educator_verification", { p_id: "e1", p_decision: "approved", p_note: null });
  });

  it("Assign Educators reads list_assignable_educators", async () => {
    rpc.mockResolvedValue({ data: [{ row_data: { id: "e1", name: "Asha", email: "a@x", subjects: ["Maths"], languages: ["Hindi"], open_assignments: 2, rating: null }, total_count: 1 }], error: null });
    const rows = await assignmentsApi.eligibleEducators();
    expect(rpc).toHaveBeenCalledWith("list_assignable_educators", { p_search: null, p_subject: null, p_page: 1, p_size: 200 });
    expect(rows[0]).toMatchObject({ id: "e1", name: "Asha", full_name: "Asha", subjects: ["Maths"], languages: ["Hindi"], openAssignments: 2 });
  });
});

// -----------------------------------------------------------------------------
describe("Educator profile: one decision per click", () => {
  // actions: what adm_educator_actions (20261104090000) returns for that state
  const ACTIONS = {
    pending: ["approve", "request_changes", "reject", "start_review"],
    changes_requested: ["approve", "reject"],
    approved: ["deactivate", "suspend", "delete"],
    "approved/inactive": ["activate", "delete"],
    rejected: ["reconsider", "delete"],
  };
  const detail = (state) => {
    const [status, account = status === "rejected" ? "inactive" : "active"] = state.split("/");
    return {
      educator: {
        id: "e1", full_name: "Asha Rao", email: "asha@x", verification_status: status, account_status: account,
        subjects: ["Maths"], languages: ["English"], years_experience: 5, review_note: status === "changes_requested" ? "Add a B.Ed" : null,
        actions: ACTIONS[state] || ACTIONS[status] || [],
      },
      documents: [], history: [], courses: [],
    };
  };

  function renderProfile(states) {
    let call = 0;
    rpc.mockImplementation((name) => {
      if (name === "get_educator_detail") return Promise.resolve({ data: detail(states[Math.min(call++, states.length - 1)]), error: null });
      return Promise.resolve({ data: null, error: null });
    });
    render(
      <MemoryRouter initialEntries={["/admin/educatorverification/e1"]}>
        <Routes><Route path="/admin/educatorverification/:educatorId" element={<EducatorProfile />} /></Routes>
      </MemoryRouter>,
    );
  }
  const writes = () => rpc.mock.calls.map((c) => c[0]).filter((n) => n !== "get_educator_detail");

  it("Approve runs ONLY set_educator_verification('approved'), then shows the new status", async () => {
    renderProfile(["pending", "approved"]);
    fireEvent.click(await screen.findByRole("button", { name: /Approve/ }));
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Approve" }).at(-1)); });
    expect(writes()).toEqual(["set_educator_verification"]);
    expect(rpc).toHaveBeenCalledWith("set_educator_verification", { p_id: "e1", p_decision: "approved", p_note: null });
    expect(writes()).not.toContain("delete_educator");
    expect(await screen.findByText("Educator approved.")).toBeInTheDocument();
    await waitFor(() => expect(rpc.mock.calls.filter((c) => c[0] === "get_educator_detail").length).toBeGreaterThanOrEqual(2));
    expect(screen.getAllByText("Approved").length).toBeGreaterThan(0);
  });

  it("Request changes needs a reason and sends changes_requested", async () => {
    renderProfile(["pending", "changes_requested"]);
    fireEvent.click(await screen.findByRole("button", { name: "Request changes" }));
    const confirm = screen.getAllByRole("button", { name: "Request changes" }).at(-1);
    expect(confirm).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Reason (shown to the educator)"), { target: { value: "Add a B.Ed" } });
    await act(async () => { fireEvent.click(confirm); });
    expect(writes()).toEqual(["set_educator_verification"]);
    expect(rpc).toHaveBeenCalledWith("set_educator_verification", { p_id: "e1", p_decision: "changes_requested", p_note: "Add a B.Ed" });
  });

  it("#3: a rejected educator shows only Rejected (never Active) and only Reconsider / Delete", async () => {
    renderProfile(["rejected"]);
    expect((await screen.findAllByText("Rejected")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Account: Active")).toBeNull();
    expect(screen.queryByRole("button", { name: /^Deactivate/ })).toBeNull();
    expect(screen.queryByRole("button", { name: /^Suspend/ })).toBeNull();
    expect(screen.getAllByRole("button", { name: "Review and reconsider" }).length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Review and reconsider" })[0]);
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Review and reconsider" }).at(-1)); });
    expect(rpc).toHaveBeenCalledWith("set_educator_verification", { p_id: "e1", p_decision: "under_review", p_note: null });
  });

  it("#4: a deactivated educator's Activate calls the RPC (it used to call an unimported mock)", async () => {
    renderProfile(["approved/inactive", "approved"]);
    expect((await screen.findAllByText("Deactivated")).length).toBeGreaterThan(0);
    expect(screen.getAllByText("Account: Inactive").length).toBeGreaterThan(0);
    fireEvent.click(screen.getAllByRole("button", { name: "Activate" })[0]);
    await act(async () => { fireEvent.click(screen.getAllByRole("button", { name: "Activate" }).at(-1)); });
    expect(writes()).toEqual(["set_educator_account_status"]);
    expect(rpc).toHaveBeenCalledWith("set_educator_account_status", { p_id: "e1", p_status: "active", p_reason: null });
    expect(await screen.findByText("Educator activated.")).toBeInTheDocument();
  });

  it("does not refetch the detail in a loop", async () => {
    renderProfile(["pending"]);
    await screen.findByRole("button", { name: /Approve/ });
    await new Promise((r) => setTimeout(r, 50));
    expect(rpc.mock.calls.filter((c) => c[0] === "get_educator_detail")).toHaveLength(1);
  });
});

// -----------------------------------------------------------------------------
describe("teacher gate after a decision", () => {
  it("'approved' opens the portal", () => {
    expect(gateFor({ status: "approved" })).toBe(GATE.PORTAL);
  });

  it("a teacher on the rejected screen sees a later approval within 60 s, without reloading", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const api = { getStatus: vi.fn().mockResolvedValueOnce({ status: "rejected", note: "Blurry ID" }).mockResolvedValue({ status: "approved" }) };
    render(
      <MemoryRouter initialEntries={["/teacher/dashboard"]}>
        <Routes>
          <Route path="/teacher" element={<EducatorGate user={{ id: "u1", name: "Asha" }} onLogout={vi.fn()} statusApi={api} />}>
            <Route path="dashboard" element={<p>Dashboard feature</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Blurry ID")).toBeInTheDocument();
    await act(async () => { vi.advanceTimersByTime(60000); });
    expect(await screen.findByText("Dashboard feature")).toBeInTheDocument();
  });
});
