/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import {
  isEmail,
  isStrongPassword,
  maskDestination,
  passwordChecks,
  passwordStrength,
  safeRedirect,
} from "../src/auth/utils/validators";

afterEach(() => cleanup());

// A small in-memory stand-in for supabase.from(table). Builders are only
// thenable (like PostgREST's), so code that chains .catch on them would fail.
function fakeDb(initial = {}) {
  const tables = Object.fromEntries(Object.entries(initial).map(([k, rows]) => [k, rows.map((r) => ({ ...r }))]));
  const calls = [];
  const key = { profiles: "id", student_profiles: "user_id" };
  function builder(table) {
    const state = { op: "select", filters: [], payload: null, options: null };
    const run = () => {
      const rows = (tables[table] ??= []);
      const match = (r) => state.filters.every(([c, v]) => r[c] === v);
      if (state.op === "upsert") {
        const k = key[table];
        const exists = rows.find((r) => r[k] === state.payload[k]);
        if (exists && !state.options?.ignoreDuplicates) Object.assign(exists, state.payload);
        if (!exists) rows.push({ ...state.payload });
        return { data: null, error: null };
      }
      if (state.op === "update") {
        rows.filter(match).forEach((r) => Object.assign(r, state.payload));
        return { data: null, error: null };
      }
      const found = rows.filter(match);
      return { data: state.single ? found[0] ?? null : found, error: null };
    };
    const b = {
      select: () => b,
      eq: (c, v) => { state.filters.push([c, v]); return b; },
      maybeSingle: () => { state.single = true; return b; },
      upsert: (payload, options) => { calls.push({ table, op: "upsert", payload, options }); Object.assign(state, { op: "upsert", payload, options }); return b; },
      update: (payload) => { calls.push({ table, op: "update", payload }); Object.assign(state, { op: "update", payload }); return b; },
      then: (resolve, reject) => Promise.resolve().then(run).then(resolve, reject),
    };
    return b;
  }
  return { tables, calls, from: vi.fn((t) => builder(t)) };
}

// -----------------------------------------------------------------------------
describe("auth validators", () => {
  it("validates emails", () => {
    expect(isEmail("student@example.com")).toBe(true);
    expect(isEmail(" user+tag@domain.co.in ")).toBe(true);
    for (const bad of ["", "invalid", "@domain.com", "user@", "user@domain"]) expect(isEmail(bad)).toBe(false);
  });

  it("applies the password rule and reports each check", () => {
    expect(isStrongPassword("secret12")).toBe(true);
    expect(isStrongPassword("short1")).toBe(false);
    expect(isStrongPassword("lettersonly")).toBe(false);
    expect(isStrongPassword("12345678")).toBe(false);
    expect(passwordChecks("abc1")).toEqual([
      { id: "length", label: "At least 8 characters", ok: false },
      { id: "letter", label: "A letter", ok: true },
      { id: "number", label: "A number", ok: true },
    ]);
    expect(passwordStrength("abc")).toBe("weak");
    expect(passwordStrength("secret12")).toBe("fair");
    expect(passwordStrength("Secret-Passw0rd")).toBe("strong");
  });

  it("only allows same-site redirects", () => {
    expect(safeRedirect("/student/test-series")).toBe("/student/test-series");
    for (const bad of ["//evil.com", "https://evil.com", "/\\evil", "", null, undefined]) expect(safeRedirect(bad)).toBe("");
  });

  it("masks the email shown after a reset request", () => {
    expect(maskDestination("student@example.com")).toBe("s••••••@example.com");
  });
});

describe("authErrorMessage", () => {
  it("turns Supabase errors into messages a student can act on", async () => {
    vi.doMock("../src/services/supabaseClient", () => ({ supabase: {} }));
    const { authErrorMessage, GOOGLE_NOT_CONFIGURED } = await import("../src/auth/services/authApi");
    expect(authErrorMessage({ message: "Invalid login credentials" })).toBe("Incorrect email or password.");
    expect(authErrorMessage({ message: "User already registered" })).toMatch(/already exists/);
    expect(authErrorMessage({ message: "Email not confirmed" })).toMatch(/Confirm your email/);
    expect(authErrorMessage({ status: 429, message: "x" })).toMatch(/Too many attempts/);
    expect(authErrorMessage({ message: "Unsupported provider: provider is not enabled" })).toBe(GOOGLE_NOT_CONFIGURED);
    expect(authErrorMessage({ message: "Error sending recovery email" })).toMatch(/couldn't send the email/);
    expect(authErrorMessage({ message: "otp_expired Email link is invalid or has expired" })).toMatch(/expired/);
  });
});

// -----------------------------------------------------------------------------
describe("ensureProfile", () => {
  beforeEach(() => vi.resetModules());

  async function load(db) {
    vi.doMock("../src/services/supabaseClient", () => ({ supabase: { from: db.from } }));
    return import("../src/services/profileService");
  }

  it("returns an existing profile without inserting one", async () => {
    const db = fakeDb({
      profiles: [{ id: "u-1", role: "student", full_name: "Existing", email: "e@x.com", avatar_url: null }],
      student_profiles: [{ user_id: "u-1" }],
    });
    const { ensureProfile } = await load(db);
    const profile = await ensureProfile({ id: "u-1", email: "e@x.com" });
    expect(profile.full_name).toBe("Existing");
    expect(db.calls.filter((c) => c.table === "profiles")).toHaveLength(0);
    expect(db.tables.profiles).toHaveLength(1);
  });

  it("creates the rows once with role student, whatever the metadata claims", async () => {
    const db = fakeDb({ profiles: [], student_profiles: [] });
    const { ensureProfile } = await load(db);
    const user = {
      id: "u-2",
      email: "jane@test.local",
      user_metadata: { full_name: "Jane Doe", role: "admin", picture: "https://img/pic.jpg" },
    };
    const [a, b] = await Promise.all([ensureProfile(user), ensureProfile(user)]);
    expect(a).toBe(b);
    const inserts = db.calls.filter((c) => c.table === "profiles" && c.op === "upsert");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].payload).toEqual({
      id: "u-2", role: "student", full_name: "Jane Doe", email: "jane@test.local", avatar_url: "https://img/pic.jpg",
    });
    expect(inserts[0].options).toEqual({ onConflict: "id", ignoreDuplicates: true });
    expect(db.tables.student_profiles).toEqual([{ user_id: "u-2" }]);

    await ensureProfile(user);   // later sign-ins are idempotent
    expect(db.calls.filter((c) => c.table === "profiles" && c.op === "upsert")).toHaveLength(1);
    expect(db.tables.profiles).toHaveLength(1);
  });

  it("never sends a role other than student", async () => {
    const db = fakeDb({ profiles: [], student_profiles: [] });
    const { ensureProfile, profileSeedFromUser } = await load(db);
    for (const meta of [{ role: "admin" }, { role: "super_admin" }, { name: "Google User", avatar_url: "a" }, {}]) {
      expect(profileSeedFromUser({ id: "x", email: "x@y.z", user_metadata: meta }).role).toBe("student");
    }
    await ensureProfile({ id: "u-3", email: "g@x.com", user_metadata: { name: "Google User" } });
    const sent = db.calls.filter((c) => c.op === "upsert" && c.table === "profiles").map((c) => c.payload.role);
    expect(sent).toEqual(["student"]);
    expect(db.tables.profiles[0].full_name).toBe("Google User");
  });

  it("keeps an existing educator / admin role and adds no student row for it", async () => {
    const db = fakeDb({ profiles: [{ id: "u-4", role: "admin", full_name: "Admin", email: "a@x.com" }], student_profiles: [] });
    const { ensureProfile } = await load(db);
    const profile = await ensureProfile({ id: "u-4", email: "a@x.com" });
    expect(profile.role).toBe("admin");
    expect(db.calls).toHaveLength(0);
  });

  it("explains the failure when the row can't be created (e.g. RLS)", async () => {
    const db = fakeDb({ profiles: [], student_profiles: [] });
    const realFrom = db.from.getMockImplementation();
    db.from.mockImplementation((t) => {
      const b = realFrom(t);
      if (t === "profiles") b.upsert = () => ({ then: (res) => Promise.resolve({ data: null, error: { message: "new row violates row-level security policy" } }).then(res) });
      return b;
    });
    const { ensureProfile, ProfileSetupError } = await load(db);
    await expect(ensureProfile({ id: "u-5", email: "r@x.com" })).rejects.toBeInstanceOf(ProfileSetupError);
  });
});

// -----------------------------------------------------------------------------
describe("ResetPassword page states", () => {
  beforeEach(() => vi.resetModules());

  async function renderReset({ auth, url = "/reset-password", updatePassword = vi.fn() }) {
    vi.doMock("../src/hooks/useAuth", () => ({ useAuth: () => ({ clearRecovery: vi.fn(), ...auth }) }));
    vi.doMock("../src/services/supabaseClient", () => ({ supabase: {} }));
    vi.doMock("../src/auth/services/authApi", async (orig) => ({ ...(await orig()), updatePassword }));
    const { default: ResetPassword } = await import("../src/auth/pages/ResetPassword");
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes><Route path="/reset-password" element={<ResetPassword />} /></Routes>
      </MemoryRouter>,
    );
    return updatePassword;
  }

  it("shows a loading state while the session is restored", async () => {
    await renderReset({ auth: { user: null, loading: true } });
    expect(screen.getByRole("status")).toHaveTextContent(/checking your reset link/i);
  });

  it("shows the expired state when no recovery session exists", async () => {
    await renderReset({ auth: { user: null, loading: false } });
    expect(screen.getByText("This link has expired")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /request a new link/i })).toHaveAttribute("href", "/forgot-password");
  });

  it("shows the expired state at once when the link carries an error", async () => {
    await renderReset({
      auth: { user: { id: "u", role: "student" }, loading: false },
      url: "/reset-password#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired",
    });
    expect(screen.getByText("This link has expired")).toBeInTheDocument();
  });

  it("validates the new password, then shows success", async () => {
    const updatePassword = await renderReset({
      auth: { user: { id: "u", role: "student" }, loading: false },
      updatePassword: vi.fn().mockResolvedValue({}),
    });
    const button = screen.getByRole("button", { name: /save new password/i });
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: "short" } });
    fireEvent.blur(screen.getByLabelText(/^New Password/));
    expect(screen.getByText("At least 8 characters, with 1 letter and 1 number.")).toBeInTheDocument();
    expect(button).toBeDisabled();

    fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: "different1" } });
    fireEvent.blur(screen.getByLabelText(/^Confirm New Password/));
    expect(screen.getByText("Passwords don't match.")).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: "newpass123" } });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(screen.getByText("Password updated")).toBeInTheDocument());
    expect(updatePassword).toHaveBeenCalledWith({ password: "newpass123" });
  });

  it("switches to the expired state when the server says the session expired", async () => {
    await renderReset({
      auth: { user: { id: "u", role: "student" }, loading: false },
      updatePassword: vi.fn().mockRejectedValue(new Error("Your link has expired. Please request a new one.")),
    });
    fireEvent.change(screen.getByLabelText(/^New Password/), { target: { value: "newpass123" } });
    fireEvent.change(screen.getByLabelText(/^Confirm New Password/), { target: { value: "newpass123" } });
    fireEvent.click(screen.getByRole("button", { name: /save new password/i }));
    await waitFor(() => expect(screen.getByText("This link has expired")).toBeInTheDocument());
  });
});

// -----------------------------------------------------------------------------
describe("AuthCallback redirects by role", () => {
  beforeEach(() => vi.resetModules());

  async function renderCallback(user, url = "/auth/callback", needsOnboarding = false) {
    vi.doMock("../src/portals/student/utils/onboarding", () => ({ needsGoogleOnboarding: async () => needsOnboarding }));
    vi.doMock("../src/hooks/useAuth", () => ({ useAuth: () => ({ user, loading: false, error: "" }) }));
    vi.doMock("../src/services/supabaseClient", () => ({ supabase: {} }));
    const { default: AuthCallback } = await import("../src/auth/pages/AuthCallback");
    render(
      <MemoryRouter initialEntries={[url]}>
        <Routes>
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/student/dashboard" element={<p>student home</p>} />
          <Route path="/student/onboarding" element={<p>student onboarding</p>} />
          <Route path="/admin/logindashboard" element={<p>admin home</p>} />
          <Route path="/student/test-series" element={<p>series list</p>} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it("sends students to the student dashboard", async () => {
    await renderCallback({ id: "u", role: "student", dbRole: "student" });
    expect(await screen.findByText("student home")).toBeInTheDocument();
  });

  it("sends admins and super admins to the admin portal", async () => {
    await renderCallback({ id: "u", role: "admin", dbRole: "super_admin" });
    expect(screen.getByText("admin home")).toBeInTheDocument();
  });

  it("honours a same-site redirect", async () => {
    await renderCallback({ id: "u", role: "student" }, "/auth/callback?redirect=%2Fstudent%2Ftest-series");
    expect(await screen.findByText("series list")).toBeInTheDocument();
  });

  it("sends a new Google student through onboarding first", async () => {
    await renderCallback({ id: "u", role: "student" }, "/auth/callback", true);
    expect(await screen.findByText("student onboarding")).toBeInTheDocument();
  });

  it("explains a failed Google sign-in", async () => {
    await renderCallback(null, "/auth/callback?error=access_denied&error_description=Unsupported+provider%3A+provider+is+not+enabled");
    expect(screen.getByText(/Google sign-in isn't set up/)).toBeInTheDocument();
  });
});
