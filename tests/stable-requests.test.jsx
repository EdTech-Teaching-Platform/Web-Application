/** @vitest-environment jsdom */
// Admin pages must fetch once on mount and again only when an input changes.
// With an inline `useRpc(() => api.x(...))` every render made a new request
// function, so each response re-rendered the page and fetched again forever.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: { rpc: (...a) => rpc(...a), functions: { invoke: vi.fn() }, auth: { onAuthStateChange: () => {} } },
}));

import FinancialAnalytics from "../src/portals/admin/pages/FinancialAnalytics";
import PaymentOversight from "../src/portals/admin/pages/PaymentOversight";
import RegionalAnalytics from "../src/portals/admin/pages/RegionalAnalytics";
import ReportsBuilder from "../src/portals/admin/pages/ReportsBuilder";
import TransactionHistory from "../src/portals/admin/pages/TransactionHistory";
import UserManagement from "../src/portals/admin/pages/UserManagement";
import CreateDiscount from "../src/portals/admin/pages/discounts/CreateDiscount";
import DiscountAnalytics from "../src/portals/admin/pages/discounts/DiscountAnalytics";
import { DiscountNavProvider } from "../src/portals/admin/pages/discounts/DiscountsShared";

const wait = (ms) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
const names = () => rpc.mock.calls.map(([n]) => n);

beforeEach(() => rpc.mockClear());
afterEach(() => cleanup());

// Mount, let every fetch settle, then check nothing fetches again by itself.
async function expectSettles(element, expected) {
  render(<MemoryRouter>{element}</MemoryRouter>);
  await wait(50);
  const first = rpc.mock.calls.length;
  await wait(150);
  expect(rpc.mock.calls.length).toBe(first);
  if (expected) expect([...names()].sort()).toEqual([...expected].sort());
  return first;
}

describe("admin pages fetch once, not on every render", () => {
  it("FinancialAnalytics; a new range fetches once more", async () => {
    await expectSettles(<FinancialAnalytics />, ["get_financial_analytics"]);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "last_7_days" } });
    await wait(50);
    expect(names()).toEqual(["get_financial_analytics", "get_financial_analytics"]);
    expect(rpc.mock.calls[1][1]).toMatchObject({ p_range: "last_7_days" });
  });

  it("PaymentOversight", async () => {
    const n = await expectSettles(<PaymentOversight />);
    expect(n).toBe(3);   // transactions, refund stats, pending refunds
  });

  it("RegionalAnalytics", async () => {
    const n = await expectSettles(<RegionalAnalytics />);
    expect(n).toBe(4);   // summary, trend, by region, comparison
  });

  it("ReportsBuilder: only the options until a report type is chosen", async () => {
    const n = await expectSettles(<ReportsBuilder />);
    expect(n).toBe(1);
  });

  it("TransactionHistory: typing fetches once after the debounce, not per keystroke", async () => {
    const n = await expectSettles(<TransactionHistory />);
    expect(n).toBe(2);   // list + stats
    const box = screen.getByPlaceholderText(/Search transaction/);
    fireEvent.change(box, { target: { value: "T" } });
    fireEvent.change(box, { target: { value: "TX" } });
    fireEvent.change(box, { target: { value: "TX-1" } });
    await wait(400);
    expect(rpc.mock.calls.length).toBe(4);
    await wait(150);
    expect(rpc.mock.calls.length).toBe(4);
  });

  it("UserManagement", async () => {
    const n = await expectSettles(<UserManagement />);
    expect(n).toBeLessThanOrEqual(3);
  });

  it("DiscountAnalytics and CreateDiscount (edit)", async () => {
    await expectSettles(<DiscountAnalytics />);
    expect(rpc.mock.calls.length).toBe(1);
    cleanup();
    rpc.mockClear();
    await expectSettles(
      <DiscountNavProvider value={{ navigate: vi.fn(), params: new URLSearchParams("edit=d1"), setParams: vi.fn() }}>
        <CreateDiscount />
      </DiscountNavProvider>,
    );
    expect(rpc.mock.calls.length).toBe(1);
  });
});
