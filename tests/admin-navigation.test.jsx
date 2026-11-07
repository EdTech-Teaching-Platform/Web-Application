/** @vitest-environment jsdom */
// QA triage P8 item 1 (#2): moving from Test Series / Management to another
// admin module (Reports Builder, Callback Requests) froze the screen.
// Mounts the real admin layout + routes, clicks through the sidebar and checks
// that every page renders and nothing keeps fetching by itself.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn(async (name) => ({ data: name === "adm_is_platform_admin" ? true : null, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: {
    rpc: (...a) => rpc(...a),
    functions: { invoke: vi.fn(async () => ({ data: null, error: null })) },
    auth: { onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }), signOut: vi.fn() },
    storage: { from: () => ({ createSignedUrl: async () => ({ data: null, error: null }) }) },
    from: () => ({ select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: null, error: null }) }) }) }),
  },
}));
vi.mock("../src/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "admin-1", name: "Ada Admin", role: "admin", dbRole: "admin" }, loading: false }),
}));

// imported after globalThis.React is set (routes.jsx is module-level JSX)
let AdminLayout; let adminRoutes;

const wait = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
beforeEach(async () => {
  AdminLayout = AdminLayout || (await import("../src/layouts/AdminLayout")).default;
  adminRoutes = adminRoutes || (await import("../src/portals/admin/routes")).default;
  rpc.mockClear(); window.scrollTo = () => {}; });
afterEach(() => cleanup());

async function clickNav(label) {
  const link = screen.getAllByRole("link").find((a) => a.textContent.trim() === label);
  expect(link, `sidebar link ${label}`).toBeTruthy();
  await act(async () => { fireEvent.click(link); });
  await wait(400);   // lazy chunk + first fetches
}

async function expectSettled() {
  const before = rpc.mock.calls.length;
  await wait(300);
  expect(rpc.mock.calls.length - before).toBe(0);
}

describe("admin navigation between modules", () => {
  it.each([
    ["Create Test Series", "Reports Builder", /Reports & Analytics/],
    ["Create Test Series", "Callback Request", /Callback Requests/],
    ["Student Management", "Reports Builder", /Reports & Analytics/],
    ["Educator Management", "Callback Request", /Callback Requests/],
    ["Test Series Tracker", "Reports Builder", /Reports & Analytics/],
    ["Assign Educators", "Callback Request", /Callback Requests/],
    ["Discount Management", "Reports Builder", /Reports & Analytics/],
  ])("%s -> %s loads the page", async (from, to, heading) => {
    render(
      <MemoryRouter initialEntries={["/admin/logindashboard"]}>
        <Routes><Route path="/admin" element={<AdminLayout />}>{adminRoutes}</Route></Routes>
      </MemoryRouter>,
    );
    await wait(400);
    await clickNav(from);
    await expectSettled();
    await clickNav(to);
    expect(await screen.findAllByText(heading)).not.toHaveLength(0);
    expect(screen.queryByText("Something went wrong")).toBeNull();
    await expectSettled();
  }, 15000);
});
