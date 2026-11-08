/** @vitest-environment jsdom */
// QA reports of 07-08 Nov 2026:
//   school / grade from student onboarding missing on the Account page, and the
//   educator sidebar stuck on Profile.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpcData = {};
const rpc = vi.fn(async (name) => ({ data: rpcData[name] ?? null, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: vi.fn() },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: vi.fn(), getSession: async () => ({ data: { session: null } }) },
  },
}));
const auth = { user: { id: "edu-1", name: "Ashika", role: "teacher" }, loading: false };
vi.mock("../src/hooks/useAuth", () => ({ useAuth: () => auth }));

import { firstInvalidStep, onboardingValues, prefillForm, savedMatches } from "../src/portals/student/pages/StudentOnboarding";

const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });

beforeEach(() => {
  for (const k of Object.keys(rpcData)) delete rpcData[k];
  window.sessionStorage.clear();
  window.scrollTo = () => {};
});
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("student onboarding: school and grade reach the profile", () => {
  const EMPTY = { full_name: "", age: "", grade: "", location: "", school_name: "", phone: "", parent_email: "", interests: [] };
  const TYPED = { ...EMPTY, full_name: "Riya Sen", age: "14", grade: "9th Grade", location: "Pune", school_name: "DPS", phone: "9876543210", interests: ["Maths"] };

  it("a late pre-fill of an empty profile keeps what the student typed", () => {
    const after = prefillForm(TYPED, { full_name: "Riya", phone: null, location: null }, {});
    expect(after.grade).toBe("9th Grade");
    expect(after.school_name).toBe("DPS");
    expect(after.location).toBe("Pune");
    expect(after.full_name).toBe("Riya Sen");
    expect(after.interests).toEqual(["Maths"]);
  });

  it("pre-fills empty fields from the saved profile", () => {
    const after = prefillForm(EMPTY, { full_name: "Riya Sen", phone: "9876543210", location: "Pune" }, { grade: "8th Grade", school_name: "KV", age: 13, interests: ["Science"] });
    expect(after).toMatchObject({ full_name: "Riya Sen", grade: "8th Grade", school_name: "KV", age: "13", location: "Pune", interests: ["Science"] });
  });

  it("finishing checks every step, not only the last one", () => {
    expect(firstInvalidStep(TYPED)).toBe(-1);
    expect(firstInvalidStep({ ...TYPED, grade: "" })).toBe(0);
    expect(firstInvalidStep({ ...TYPED, school_name: " " })).toBe(0);
    expect(firstInvalidStep({ ...TYPED, phone: "" })).toBe(1);
  });

  it("the read-back must match what was saved", () => {
    const values = onboardingValues(TYPED);
    expect(values).toMatchObject({ grade: "9th Grade", school_name: "DPS", location: "Pune" });
    expect(savedMatches(values, { profile: { location: "Pune" }, student: { grade: "9th Grade", school_name: "DPS" } })).toBe(true);
    expect(savedMatches(values, { profile: { location: "Pune" }, student: {} })).toBe(false);
  });
});

// -----------------------------------------------------------------------------
describe("educator sidebar after the Profile page", () => {
  const INCOMPLETE = {
    full_name: "Ashika", email: "a@x.in", phone: "", location: "Pune", qualifications: "", experience_years: 3,
    subjects: ["Physics"], languages: ["English"], bio: "", verification_status: "verified", documents: [],
  };

  async function renderPortal(start) {
    auth.user = { id: `edu-${Math.random()}`, name: "Ashika", role: "teacher" };
    rpcData.educator_get_profile = INCOMPLETE;
    const { EducatorGate } = await import("../src/layouts/TeacherLayout");
    const statusApi = { getStatus: vi.fn().mockResolvedValue({ status: "approved" }) };
    render(
      <MemoryRouter initialEntries={[start]}>
        <Routes>
          <Route path="/teacher" element={<EducatorGate user={auth.user} onLogout={vi.fn()} statusApi={statusApi} />}>
            <Route path="dashboard" element={<p>Dashboard page</p>} />
            <Route path="assigned" element={<p>Assigned page</p>} />
            <Route path="stats" element={<p>Stats page</p>} />
            <Route path="profile" element={<p>Profile page</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  }
  const nav = (label) => fireEvent.click(screen.getByRole("link", { name: label }));

  it("after being sent to Profile, every sidebar link still navigates", async () => {
    await renderPortal("/teacher/dashboard");
    expect(await screen.findByText("Profile page")).toBeInTheDocument();
    await wait();
    nav("Assigned");
    expect(await screen.findByText("Assigned page")).toBeInTheDocument();
    await wait();
    expect(screen.getByText("Assigned page")).toBeInTheDocument();
    nav("Stats");
    expect(await screen.findByText("Stats page")).toBeInTheDocument();
    nav("Dashboard");
    expect(await screen.findByText("Dashboard page")).toBeInTheDocument();
  });

  it("opening Profile first (before the check finishes) does not trap the educator either", async () => {
    await renderPortal("/teacher/profile");
    expect(await screen.findByText("Profile page")).toBeInTheDocument();
    await wait();
    nav("Assigned");
    expect(await screen.findByText("Assigned page")).toBeInTheDocument();
    await wait();
    expect(screen.getByText("Assigned page")).toBeInTheDocument();
  });
});
