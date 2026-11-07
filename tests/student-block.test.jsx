/** @vitest-environment jsdom */
// QA triage P2: blocking enforcement (set-user-ban validators, error mapping,
// the blocked screen, the admin ban call, the educator gate re-check).
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn();
const invoke = vi.fn();
vi.mock("../src/services/supabaseClient", () => ({
  supabase: { rpc: (...a) => rpc(...a), functions: { invoke: (...a) => invoke(...a) }, auth: { onAuthStateChange: () => {} } },
}));

import { BAN_DURATION, BanRequestError, decideBan, validateBanRequest } from "../supabase/functions/set-user-ban/validate.ts";
import { ACCOUNT_BLOCKED_EVENT, BLOCKED_MESSAGE, isAccountBlockedError, notifyAccessDenied } from "../src/services/accountBlock";
import { callRpc as studentCall } from "../src/portals/student/services/studentRpc";
import { callRpc as adminCall } from "../src/portals/admin/services/adminApi";
import { authErrorMessage } from "../src/auth/services/authApi";
import { useAccountStatus } from "../src/portals/student/hooks/useAccountStatus";
import AccountBlockedScreen from "../src/portals/student/components/AccountBlockedScreen";
import { studentsApi } from "../src/portals/admin/services/studentsApi";
import { EducatorGate } from "../src/layouts/TeacherLayout";

const USER = "0f8fad5b-d9cb-469f-a165-70867728950e";
const BLOCKED_PG = { code: "UL403", message: "account_blocked", hint: "account_blocked", details: "Your account has been blocked." };

beforeEach(() => { rpc.mockReset(); invoke.mockReset(); window.scrollTo = () => {}; });
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("set-user-ban validators", () => {
  it("needs a user id and an explicit ban flag", () => {
    expect(validateBanRequest({ userId: USER.toUpperCase(), ban: true, reason: "  Abuse  " })).toEqual({ userId: USER, ban: true, reason: "Abuse" });
    expect(validateBanRequest({ userId: USER, ban: false })).toEqual({ userId: USER, ban: false, reason: null });
    for (const body of [null, {}, { userId: "nope", ban: true }, { userId: USER }, { userId: USER, ban: "yes" }]) {
      expect(() => validateBanRequest(body)).toThrow(BanRequestError);
    }
  });

  it("bans only a blocked, non-admin, non-self account; lifts only after the unblock", () => {
    const req = (ban) => ({ userId: USER, ban, reason: null });
    expect(decideBan(req(true), { exists: true, blocked: true })).toEqual({ ban_duration: BAN_DURATION });
    expect(decideBan(req(false), { exists: true, blocked: false })).toEqual({ ban_duration: "none" });
    const status = (fn) => { try { fn(); return null; } catch (e) { return e.status; } };
    expect(status(() => decideBan(req(true), { exists: false }))).toBe(404);
    expect(status(() => decideBan(req(true), { exists: true, blocked: true, is_self: true }))).toBe(400);
    expect(status(() => decideBan(req(true), { exists: true, blocked: true, is_admin: true }))).toBe(403);
    expect(status(() => decideBan(req(true), { exists: true, blocked: false }))).toBe(409);
    expect(status(() => decideBan(req(false), { exists: true, blocked: true }))).toBe(409);
  });
});

// -----------------------------------------------------------------------------
describe("error mapping", () => {
  it("detects the RPC block, the Auth ban, and nothing else", () => {
    expect(isAccountBlockedError(BLOCKED_PG)).toBe(true);
    expect(isAccountBlockedError({ code: "user_banned", message: "User is banned" })).toBe(true);
    expect(isAccountBlockedError({ message: "User is banned" })).toBe(true);
    expect(isAccountBlockedError({ code: "42501", message: "Sign in to continue." })).toBe(false);
    expect(isAccountBlockedError(null)).toBe(false);
  });

  it("a student RPC refused with UL403 becomes account_blocked and tells the layout", async () => {
    const heard = vi.fn();
    window.addEventListener(ACCOUNT_BLOCKED_EVENT, heard);
    rpc.mockResolvedValue({ data: null, error: BLOCKED_PG });
    await expect(studentCall("student_dashboard")).rejects.toMatchObject({ code: "account_blocked", message: BLOCKED_MESSAGE });
    expect(heard).toHaveBeenCalledTimes(1);
    window.removeEventListener(ACCOUNT_BLOCKED_EVENT, heard);
  });

  it("the shared admin / teacher wrapper does the same", async () => {
    rpc.mockResolvedValue({ data: null, error: BLOCKED_PG });
    await expect(adminCall("educator_get_dashboard")).rejects.toMatchObject({ code: "account_blocked" });
  });

  it("the login page explains a banned account", () => {
    expect(authErrorMessage({ code: "user_banned", message: "User is banned" })).toBe("This account has been blocked. Contact the administrator to restore access.");
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe("Unable to sign in. Please check your credentials or create a new account if you're new to Universal Learning.");
  });
});

// -----------------------------------------------------------------------------
function StudentShell({ load }) {
  const account = useAccountStatus({ load });
  if (account.blocked) return <AccountBlockedScreen message={account.reasonPublic} onLogout={vi.fn()} />;
  return <p>Student dashboard</p>;
}

describe("blocked screen", () => {
  it("a blocked student sees only the blocked screen, with the generic message and Log out", async () => {
    const load = vi.fn().mockResolvedValue({ blocked: true, reason_public: "Your account has been blocked by the administrator. Contact support to restore access." });
    render(<StudentShell load={load} />);
    expect(await screen.findByRole("heading", { name: "Account blocked" })).toBeInTheDocument();
    expect(screen.getByText(/blocked by the administrator/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Log out" })).toBeInTheDocument();
    expect(screen.queryByText("Student dashboard")).toBeNull();
  });

  it("any RPC refused with account_blocked switches to it; a network failure never locks out", async () => {
    const load = vi.fn().mockRejectedValueOnce(Object.assign(new Error("offline"), { code: "network" })).mockResolvedValue({ blocked: false });
    render(<StudentShell load={load} />);
    expect(await screen.findByText("Student dashboard")).toBeInTheDocument();
    rpc.mockResolvedValue({ data: null, error: BLOCKED_PG });
    await act(async () => { await studentCall("student_list_series").catch(() => {}); });
    expect(screen.getByRole("heading", { name: "Account blocked" })).toBeInTheDocument();
  });

  it("checks again when the window regains focus (an unblock restores access)", async () => {
    const load = vi.fn().mockResolvedValueOnce({ blocked: false }).mockResolvedValueOnce({ blocked: true });
    render(<StudentShell load={load} />);
    expect(await screen.findByText("Student dashboard")).toBeInTheDocument();
    await act(async () => { window.dispatchEvent(new Event("focus")); });
    expect(screen.getByRole("heading", { name: "Account blocked" })).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
describe("admin: the ban follows the block", () => {
  it("studentsApi.setBan calls set-user-ban with the user id, flag and reason", async () => {
    invoke.mockResolvedValue({ data: { banned: true }, error: null });
    await studentsApi.setBan(USER, true, "Sharing answers");
    expect(invoke).toHaveBeenCalledWith("set-user-ban", { body: { userId: USER, ban: true, reason: "Sharing answers" } });
  });
});

describe("educator gate", () => {
  it("re-checks at once when an RPC is refused mid-session and shows the suspended screen", async () => {
    const api = { getStatus: vi.fn().mockResolvedValueOnce({ status: "approved" }).mockResolvedValue({ status: "suspended", note: "Policy review" }) };
    render(
      <MemoryRouter initialEntries={["/teacher/dashboard"]}>
        <Routes>
          <Route path="/teacher" element={<EducatorGate user={{ id: "u1", name: "Asha" }} onLogout={vi.fn()} statusApi={api} />}>
            <Route path="dashboard" element={<p>Teacher dashboard body</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Teacher dashboard body")).toBeInTheDocument();
    await act(async () => { notifyAccessDenied({ message: "Educators only." }); });
    expect(await screen.findByText(/suspended/i)).toBeInTheDocument();
    expect(screen.queryByText("Teacher dashboard body")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  });
});
