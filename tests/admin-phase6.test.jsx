/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { beforeEach, beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

beforeAll(() => {
  window.scrollTo = vi.fn();
});

describe("admin API errors", () => {
  it("normalizes Supabase errors while preserving code and details", async () => {
    vi.doMock("../src/services/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));
    const { normalizeRpcError } = await import("../src/portals/admin/services/adminApi");
    const error = normalizeRpcError({ message: "No access", code: "42501", details: "RLS" });
    expect(error).toBeInstanceOf(Error);
    expect(error.message).toBe("No access");
    expect(error.code).toBe("42501");
    expect(error.details).toBe("RLS");
  });

  it("provides a safe fallback message", async () => {
    vi.doMock("../src/services/supabaseClient", () => ({ supabase: { rpc: vi.fn() } }));
    const { normalizeRpcError } = await import("../src/portals/admin/services/adminApi");
    expect(normalizeRpcError(null).message).toBe("The admin request failed.");
  });
});

describe("admin mappers", () => {
  it("maps database roles and rejects unknown roles", async () => {
    const { mapDbRole } = await import("../src/utils/roles");
    expect(mapDbRole("educator")).toBe("teacher");
    expect(mapDbRole("regional_head")).toBe("regionalhead");
    expect(mapDbRole("owner")).toBeNull();
  });

  it("maps educator statuses and leaves unknown values visible", async () => {
    const { mapEducatorStatus } = await import("../src/portals/admin/utils/statusMaps");
    expect(mapEducatorStatus("changes_requested")).toBe("Changes requested");
    expect(mapEducatorStatus("future_status")).toBe("future_status");
  });
});

describe("CSV builder", () => {
  it("quotes commas, line breaks, and quotes", async () => {
    const { buildCsv } = await import("../src/portals/admin/utils/csv");
    expect(buildCsv(["Name", "Note"], [["A, B", 'said "yes"']])).toBe(
      'Name,Note\r\n"A, B","said ""yes"""',
    );
  });
});

describe("AdminLayout guard", () => {
  beforeEach(() => vi.resetModules());

  it("redirects anonymous users to admin login", async () => {
    vi.doMock("../src/hooks/useAuth", () => ({ useAuth: () => ({ user: null, loading: false }) }));
    const { default: AdminLayout } = await import("../src/layouts/AdminLayout");
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="/admin/login" element={<div>Admin login</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Admin login")).toBeInTheDocument();
  });

  it("redirects authenticated non-admin users home", async () => {
    vi.doMock("../src/hooks/useAuth", () => ({ useAuth: () => ({ user: { role: "teacher" }, loading: false }) }));
    const { default: AdminLayout } = await import("../src/layouts/AdminLayout");
    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route path="/admin/*" element={<AdminLayout />} />
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("Home")).toBeInTheDocument();
  });
});
