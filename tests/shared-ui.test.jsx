/** @vitest-environment jsdom */
// P1 shared UI: the toast (contrast, readable messages, layer, dismissal), the
// row action menu (positioning, behaviour, state-aware items), the error
// boundary and the logout confirmation.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: { rpc: (...a) => rpc(...a), functions: { invoke: vi.fn() }, auth: { onAuthStateChange: () => {} } },
}));

import { FALLBACK_ERROR, TOAST_TONES, contrastRatio, normalizeToast, toMessage } from "../src/components/feedback/toastModel";
import PageToast from "../src/components/feedback/Toast";
import ToastStack from "../src/components/ui/Toast";
import { computeMenuPosition } from "../src/components/common/menuPosition";
import RowActionsMenu from "../src/components/common/RowActionsMenu";
import ErrorBoundary from "../src/components/common/ErrorBoundary";
import { useLogoutConfirm } from "../src/components/common/LogoutConfirm";
import TestSeriesDetail from "../src/portals/admin/pages/TestSeriesDetail";
import { EducatorGate } from "../src/layouts/TeacherLayout";

afterEach(() => { cleanup(); vi.useRealTimers(); rpc.mockReset(); rpc.mockImplementation(async () => ({ data: null, error: null })); });

// -----------------------------------------------------------------------------
describe("toast: contrast tokens", () => {
  it("every tone meets WCAG AA (4.5:1) for its text", () => {
    for (const [tone, { bg, fg }] of Object.entries(TOAST_TONES)) {
      expect(contrastRatio(bg, fg), tone).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrastRatio("#ffffff", "#000000")).toBeCloseTo(21, 0);
  });

  it("the stylesheet uses the same colours and sits above every modal (1500 > 1200)", () => {
    const css = fs.readFileSync(path.resolve("src/styles/feedback.css"), "utf8");
    for (const [tone, { bg, fg }] of Object.entries(TOAST_TONES)) {
      const rule = css.match(new RegExp(`\\.ul-toast--${tone}\\s*\\{([^}]*)\\}`))?.[1] || "";
      expect(rule, tone).toContain(`--ul-toast-bg: ${bg}`);
      expect(rule, tone).toContain(`--ul-toast-fg: ${fg}`);
    }
    expect(css).toMatch(/\.ul-toast-viewport\s*\{[^}]*z-index:\s*1500/);
    expect(css).not.toMatch(/\.ul-toast[^{]*\{[^}]*var\(--color-/);   // no portal theme variables
  });
});

describe("toast: always a readable message", () => {
  it("strings, Errors, Supabase errors and odd objects", () => {
    expect(toMessage("  Saved.  ")).toBe("Saved.");
    expect(toMessage(new Error("Passing marks cannot exceed total marks"))).toBe("Passing marks cannot exceed total marks");
    expect(toMessage({ message: "duplicate key", code: "23505" })).toBe("duplicate key");
    expect(toMessage({ error: "Too many uploads." })).toBe("Too many uploads.");
    expect(toMessage({ error_description: "Invalid login" })).toBe("Invalid login");
    expect(toMessage(new Error(""))).toBe(FALLBACK_ERROR);
    expect(toMessage({ code: "500" })).toBe(FALLBACK_ERROR);
    expect(toMessage({ message: "[object Object]", code: "x" })).toBe(FALLBACK_ERROR);
    expect(toMessage({ foo: 1 })).toBe("");
    expect(toMessage(null)).toBe("");
  });

  it("errors are error toasts; {message, tone} and explicit tones win", () => {
    expect(normalizeToast(new Error("Nope"))).toEqual({ message: "Nope", tone: "error" });
    expect(normalizeToast(new Error(""))).toEqual({ message: FALLBACK_ERROR, tone: "error" });
    expect(normalizeToast("Saved.")).toEqual({ message: "Saved.", tone: "info" });
    expect(normalizeToast("Saved.", "success")).toEqual({ message: "Saved.", tone: "success" });
    expect(normalizeToast({ message: "Fix the dates", tone: "warning" })).toEqual({ message: "Fix the dates", tone: "warning" });
    expect(normalizeToast("")).toEqual({ message: "", tone: "info" });
  });
});

describe("toast: PageToast and ToastStack", () => {
  it("renders on <body> (outside the page), has a close button, auto-dismisses; errors are alerts", () => {
    vi.useFakeTimers();
    const onDone = vi.fn();
    const { container, rerender } = render(<div className="page"><PageToast message="Test saved." onDone={onDone} /></div>);
    const toast = screen.getByRole("status");
    expect(toast).toHaveTextContent("Test saved.");
    expect(container.contains(toast)).toBe(false);
    expect(toast.closest(".ul-toast-viewport")).not.toBeNull();
    fireEvent.click(within(toast).getByRole("button", { name: "Dismiss notification" }));
    expect(onDone).toHaveBeenCalledTimes(1);

    rerender(<div className="page"><PageToast message={new Error("Passing marks cannot exceed total marks")} onDone={onDone} /></div>);
    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Passing marks cannot exceed total marks");
    expect(alert).toHaveAttribute("data-tone", "error");
    act(() => { vi.advanceTimersByTime(8000); });
    expect(onDone).toHaveBeenCalledTimes(2);
  });

  it("nothing for an empty message; never [object Object]", () => {
    render(<PageToast message="" onDone={vi.fn()} />);
    expect(screen.queryByRole("status")).toBeNull();
    cleanup();
    render(<PageToast message={{ code: "PGRST", details: null }} onDone={vi.fn()} />);
    expect(screen.getByRole("alert")).toHaveTextContent(FALLBACK_ERROR);
    expect(document.body.textContent).not.toContain("[object Object]");
  });

  it("ToastStack (student pages) uses the same toast, with its action", () => {
    const onAction = vi.fn();
    const onDismiss = vi.fn();
    render(<ToastStack toasts={[{ id: 1, message: "Removed from wishlist", actionLabel: "Undo", onAction }]} onDismiss={onDismiss} />);
    const toast = screen.getByRole("status");
    expect(toast).toHaveClass("ul-toast");
    fireEvent.click(within(toast).getByRole("button", { name: "Undo" }));
    expect(onAction).toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledWith(1);
  });
});

// -----------------------------------------------------------------------------
describe("row menu: positioning", () => {
  const vp = { width: 1200, height: 800 };
  const menu = { width: 200, height: 180 };
  const at = (left, top) => ({ left, right: left + 32, top, bottom: top + 32 });

  it("opens below, right-aligned with the trigger", () => {
    expect(computeMenuPosition(at(900, 100), menu, vp)).toEqual({ top: 136, left: 732, placement: "bottom", align: "end" });
  });
  it("flips above near the bottom of the viewport", () => {
    const p = computeMenuPosition(at(900, 700), menu, vp);
    expect(p.placement).toBe("top");
    expect(p.top).toBe(700 - 4 - 180);
  });
  it("left-aligns near the left edge, and never leaves the viewport", () => {
    const p = computeMenuPosition(at(20, 100), menu, vp);
    expect(p).toMatchObject({ align: "start", left: 20 });
    const tiny = computeMenuPosition(at(150, 120), { width: 400, height: 500 }, { width: 320, height: 300 });
    expect(tiny.left).toBeGreaterThanOrEqual(8);
    expect(tiny.top).toBeGreaterThanOrEqual(8);
    expect(tiny.left + Math.min(400, 320 - 16)).toBeLessThanOrEqual(320 - 8);
  });
  it("picks the side with more room when it fits neither way", () => {
    expect(computeMenuPosition(at(900, 100), { width: 200, height: 700 }, vp).placement).toBe("bottom");
    expect(computeMenuPosition(at(900, 600), { width: 200, height: 700 }, vp).placement).toBe("top");
  });
});

describe("row menu: behaviour", () => {
  function Table({ items, onRow = vi.fn() }) {
    return (
      <div data-testid="scroller" style={{ overflow: "auto", maxHeight: 50 }}>
        <table><tbody><tr onClick={onRow}><td>Row</td><td><RowActionsMenu items={items} /></td></tr></tbody></table>
      </div>
    );
  }

  it("renders outside the scrolling table, skips falsy items, runs the item and closes", () => {
    const publish = vi.fn();
    const onRow = vi.fn();
    render(<Table onRow={onRow} items={[false, { label: "Publish", onClick: publish }, null, { label: "Delete", danger: true, onClick: vi.fn() }]} />);
    fireEvent.click(screen.getByRole("button", { name: "More actions" }));
    const menu = screen.getByRole("menu");
    expect(screen.getByTestId("scroller").contains(menu)).toBe(false);
    expect(within(menu).getAllByRole("menuitem").map((b) => b.textContent)).toEqual(["Publish", "Delete"]);
    expect(within(menu).getByRole("menuitem", { name: "Delete" })).toHaveClass("is-danger");
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Publish" }));
    expect(publish).toHaveBeenCalled();
    expect(screen.queryByRole("menu")).toBeNull();
    expect(onRow).not.toHaveBeenCalled();   // the row's own click never fires
  });

  it("keyboard: first item focused, arrows move, Escape closes and returns focus; outside click closes", () => {
    render(<Table items={[{ label: "View", onClick: vi.fn() }, { label: "Edit", onClick: vi.fn() }]} />);
    const trigger = screen.getByRole("button", { name: "More actions" });
    fireEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("menuitem", { name: "View" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "Edit" })).toHaveFocus();
    fireEvent.keyDown(screen.getByRole("menu"), { key: "ArrowDown" });
    expect(screen.getByRole("menuitem", { name: "View" })).toHaveFocus();   // wraps
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("menu")).toBeNull();
    expect(trigger).toHaveFocus();
    fireEvent.click(trigger);
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("no items: no trigger at all", () => {
    render(<Table items={[false, null]} />);
    expect(screen.queryByRole("button", { name: "More actions" })).toBeNull();
  });
});

describe("row menu: items follow the row's state (test series detail)", () => {
  const SERIES = {
    id: "s1", title: "JEE Physics", status: "draft", origin: "admin", subject_name: "Physics", audience: "Class 12",
    tests: [
      { id: "t1", title: "Unit 1", status: "published", position: 1, duration_minutes: 30, total_marks: 8, passing_percent: 50, attempt_limit: 1, questions: [] },
      { id: "t2", title: "Unit 2", status: "draft", position: 2, duration_minutes: 30, total_marks: 8, passing_percent: 50, attempt_limit: 1, questions: [] },
    ],
  };
  it("a published test offers Unpublish (not Publish); a draft offers Publish", async () => {
    rpc.mockImplementation(async (name) => ({ data: name === "get_test_series" ? SERIES : null, error: null }));
    render(<MemoryRouter initialEntries={["/admin/testseries/s1"]}><Routes><Route path="/admin/testseries/:seriesId" element={<TestSeriesDetail />} /></Routes></MemoryRouter>);
    const row = (name) => screen.getByText(name, { selector: "td *, td" }).closest("tr");
    await screen.findByText("Unit 1");
    fireEvent.click(within(row("Unit 1")).getByRole("button", { name: "More actions" }));
    let items = within(screen.getByRole("menu")).getAllByRole("menuitem").map((b) => b.textContent.trim());
    expect(items).toContain("Unpublish");
    expect(items).not.toContain("Publish");
    fireEvent.keyDown(document, { key: "Escape" });
    fireEvent.click(within(row("Unit 2")).getByRole("button", { name: "More actions" }));
    items = within(screen.getByRole("menu")).getAllByRole("menuitem").map((b) => b.textContent.trim());
    expect(items).toContain("Publish");
    expect(items).not.toContain("Unpublish");
  });
});

// -----------------------------------------------------------------------------
describe("error boundary", () => {
  function Boom({ when }) {
    if (when) throw new Error("Cannot read properties of undefined (reading 'title')");
    return <p>Page content</p>;
  }

  it("a render crash shows a readable panel with Reload and Go back, and is logged", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    render(<ErrorBoundary name="teacher" resetKey="/a"><Boom when /></ErrorBoundary>);
    const panel = screen.getByRole("alert");
    expect(panel).toHaveTextContent("Something went wrong");
    expect(panel).toHaveTextContent("reading 'title'");
    expect(within(panel).getByRole("button", { name: "Reload" })).toBeInTheDocument();
    expect(within(panel).getByRole("button", { name: "Go back" })).toBeInTheDocument();
    expect(log.mock.calls.some((c) => String(c[0]).includes("[teacher] render failure"))).toBe(true);
    log.mockRestore();
  });

  it("navigating to another page (new resetKey) clears the error", () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { rerender } = render(<ErrorBoundary resetKey="/a"><Boom when /></ErrorBoundary>);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    rerender(<ErrorBoundary resetKey="/b"><Boom when={false} /></ErrorBoundary>);
    expect(screen.getByText("Page content")).toBeInTheDocument();
    log.mockRestore();
  });
});

// -----------------------------------------------------------------------------
describe("logout confirmation", () => {
  function Harness({ signOut }) {
    const logout = useLogoutConfirm(signOut);
    return <><button type="button" onClick={logout.request}>Log out</button>{logout.dialog}</>;
  }

  it("Cancel / Escape keep you signed in; Log out signs out", async () => {
    const signOut = vi.fn().mockResolvedValue();
    render(<Harness signOut={signOut} />);
    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    const dialog = screen.getByRole("alertdialog", { name: "Log out?" });
    expect(within(dialog).getByRole("button", { name: "Cancel" })).toHaveFocus();
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(signOut).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Log out" }));
    await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Log out" })); });
    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("the teacher portal asks before logging out (sidebar)", async () => {
    const onLogout = vi.fn();
    const api = { getStatus: vi.fn().mockResolvedValue({ status: "approved", can_edit: false }) };
    render(
      <MemoryRouter initialEntries={["/teacher/dashboard"]}>
        <Routes>
          <Route path="/teacher" element={<EducatorGate user={{ id: "u1", name: "Asha Rao" }} onLogout={onLogout} statusApi={api} />}>
            <Route path="dashboard" element={<p>Dashboard page body</p>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    await screen.findByText("Dashboard page body");
    fireEvent.click(screen.getByRole("button", { name: /Log Out/i }));
    expect(onLogout).not.toHaveBeenCalled();
    await act(async () => { fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Log out" })); });
    expect(onLogout).toHaveBeenCalledTimes(1);
  });
});
