/** @vitest-environment jsdom */
import React from "react";
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

beforeAll(() => {
  window.scrollTo = vi.fn();
});

describe("admin roles (D13)", () => {
  it("maps admin and super_admin to the app role admin", async () => {
    const { mapDbRole, isAdminDbRole, ADMIN_DB_ROLES } = await import("../src/utils/roles");
    expect(mapDbRole("admin")).toBe("admin");
    expect(mapDbRole("super_admin")).toBe("admin");
    expect(ADMIN_DB_ROLES).toEqual(["admin", "super_admin"]);
    expect(isAdminDbRole("super_admin")).toBe(true);
    expect(isAdminDbRole("head_teacher")).toBe(false);
    expect(isAdminDbRole(undefined)).toBe(false);
  });

  it("allows the admin portal for mapped admins only", async () => {
    const { canUseAdminPortal } = await import("../src/utils/roles");
    expect(canUseAdminPortal({ role: "admin", dbRole: "super_admin" })).toBe(true);
    expect(canUseAdminPortal({ role: "admin", dbRole: "admin" })).toBe(true);
    expect(canUseAdminPortal({ role: "teacher", dbRole: "educator" })).toBe(false);
    expect(canUseAdminPortal(null)).toBe(false);
  });

  it("accepts admin and super_admin in Edge Function admin checks", async () => {
    const { isAdminRole } = await import("../supabase/functions/_shared/roles.ts");
    expect(isAdminRole("admin")).toBe(true);
    expect(isAdminRole("super_admin")).toBe(true);
    expect(isAdminRole("regional_head")).toBe(false);
    expect(isAdminRole(null)).toBe(false);
  });
});

describe("AdminLayout with a super_admin", () => {
  beforeEach(() => vi.resetModules());
  afterEach(() => cleanup());

  // serverAdmin = what adm_is_platform_admin() returns for this user.
  async function renderLayout({ dbRole, serverAdmin }) {
    const rpc = vi.fn(async () => ({ data: serverAdmin, error: null }));
    vi.doMock("../src/services/supabaseClient", () => ({ supabase: { rpc } }));
    vi.doMock("../src/hooks/useAuth", () => ({
      useAuth: () => ({ user: { id: "u-1", role: "admin", dbRole }, loading: false }),
    }));
    vi.doMock("../src/portals/admin/components/AdminSidebar", () => ({ default: () => null }));
    vi.doMock("../src/portals/admin/components/AdminTopbar", () => ({ default: () => null }));
    vi.doMock("../src/portals/admin/components/icons", () => {
      const Icon = () => null;
      return { IconBook: Icon, IconLightbulb: Icon, IconPencil: Icon, IconGlobe: Icon, IconGraduationCap: Icon,
               IconChart: Icon, IconCalculator: Icon, IconAtom: Icon };
    });
    const { default: AdminLayout } = await import("../src/layouts/AdminLayout");
    render(
      <MemoryRouter initialEntries={["/admin/students"]}>
        <Routes>
          <Route path="/admin" element={<AdminLayout />}>
            <Route path="students" element={<div>Students page</div>} />
          </Route>
          <Route path="/" element={<div>Home</div>} />
        </Routes>
      </MemoryRouter>,
    );
    return rpc;
  }

  it("renders admin pages for a super_admin the server confirms", async () => {
    const rpc = await renderLayout({ dbRole: "super_admin", serverAdmin: true });
    expect(await screen.findByText("Students page")).toBeInTheDocument();
    expect(screen.queryByText("Home")).not.toBeInTheDocument();
    expect(rpc).toHaveBeenCalledWith("adm_is_platform_admin");
  });

  it("redirects a self-promoted user (role admin, not allowlisted)", async () => {
    await renderLayout({ dbRole: "admin", serverAdmin: false });
    expect(await screen.findByText("Home")).toBeInTheDocument();
    expect(screen.queryByText("Students page")).not.toBeInTheDocument();
  });
});
