/** @vitest-environment jsdom */
// Admin > Content Moderation, end to end against a fake supabase.rpc that
// behaves like 20261027100300 (open / closed filters, a note required to
// resolve or dismiss, stats counted from the same rows).
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

let db;
let failNext = null;
let hold = null;   // a promise set_moderation_status waits on (double-click test)
const rpc = vi.fn(async (name, p) => {
  if (name === "list_moderation_items") {
    const want = p.p_status === "open" ? ["new", "in_review"] : p.p_status === "closed" ? ["resolved", "dismissed"] : [p.p_status];
    const rows = db.filter((i) => want.includes(i.status));
    return { data: rows.map((r) => ({ row_data: { ...r }, total_count: rows.length })), error: null };
  }
  if (name === "get_moderation_stats") {
    const c = (s) => db.filter((i) => i.status === s).length;
    return { data: { new: c("new"), in_review: c("in_review"), resolved: c("resolved"), dismissed: c("dismissed"), by_kind: {} }, error: null };
  }
  if (name === "get_moderation_item") return { data: { ...db.find((i) => i.id === p.p_id), history: [] }, error: null };
  if (name === "get_moderation_filter_options") return { data: { series: [] }, error: null };
  if (name === "set_moderation_status") {
    if (hold) await hold;
    if (failNext) { const error = failNext; failNext = null; return { data: null, error }; }
    if (p.p_status !== "in_review" && !p.p_note) {
      return { data: null, error: { message: "Add a note for the student when you resolve or dismiss.", code: "22023" } };
    }
    const item = db.find((i) => i.id === p.p_id);
    item.status = p.p_status;
    item.admin_note = p.p_note ?? item.admin_note;
    return { data: { ...item }, error: null };
  }
  return { data: null, error: null };
});
vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: (...a) => rpc(...a), auth: { onAuthStateChange: () => {} } } }));

import ContentModeration from "../src/portals/admin/pages/ContentModeration";

const calls = (name) => rpc.mock.calls.filter(([n]) => n === name);
const statCard = (label) => screen.getByText(label.toUpperCase()).closest("button");
const settle = () => act(async () => { await new Promise((r) => setTimeout(r, 0)); });

beforeEach(() => {
  rpc.mockClear();
  failNext = null;
  hold = null;
  db = [
    { id: "fb-1", kind: "issue", status: "new", message: "Option B is also correct.", created_at: "2026-10-30T10:00:00Z", series_title: "JEE Physics", student_name: "Asha" },
    { id: "fb-2", kind: "query", status: "new", message: "Why is Q3 wrong?", created_at: "2026-10-29T10:00:00Z", series_title: "JEE Physics", student_name: "Ravi" },
  ];
});
afterEach(() => cleanup());

async function openReview(message) {
  render(<MemoryRouter><ContentModeration /></MemoryRouter>);
  const row = (await screen.findByText(message)).closest("tr");
  fireEvent.click(within(row).getByRole("button", { name: "Review" }));
  return screen.findByRole("dialog");
}

describe("content moderation flow", () => {
  it("resolve: the drawer closes, list and stats refetch at once, the item moves to Closed, the success message shows", async () => {
    const dialog = await openReview("Option B is also correct.");
    await within(dialog).findByText("Option B is also correct.", { selector: "p" });
    expect(within(statCard("New")).getByText("2")).toBeInTheDocument();
    const listsBefore = calls("list_moderation_items").length;
    const statsBefore = calls("get_moderation_stats").length;

    fireEvent.change(within(dialog).getByLabelText(/Note to the student/), { target: { value: "Accepted, scores updated." } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" })); });
    await settle();

    expect(calls("set_moderation_status")).toEqual([["set_moderation_status", { p_id: "fb-1", p_status: "resolved", p_note: "Accepted, scores updated." }]]);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByText("Marked resolved. The student has been notified.")).toBeInTheDocument();
    expect(calls("list_moderation_items").length).toBeGreaterThan(listsBefore);
    expect(calls("get_moderation_stats").length).toBeGreaterThan(statsBefore);
    await waitFor(() => expect(screen.queryByText("Option B is also correct.")).not.toBeInTheDocument());   // gone from Needs attention
    expect(screen.getByText("Why is Q3 wrong?")).toBeInTheDocument();
    expect(within(statCard("New")).getByText("1")).toBeInTheDocument();
    expect(within(statCard("Resolved")).getByText("1")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Closed" }));
    const row = (await screen.findByText("Option B is also correct.")).closest("tr");
    expect(within(row).getByText("Resolved")).toBeInTheDocument();
    expect(within(row).getByRole("button", { name: "View" })).toBeInTheDocument();
  });

  it("a closed item says so instead of asking to be resolved again", async () => {
    db[0].status = "dismissed";
    render(<MemoryRouter><ContentModeration /></MemoryRouter>);
    fireEvent.click(screen.getByRole("tab", { name: "Closed" }));
    fireEvent.click(within((await screen.findByText("Option B is also correct.")).closest("tr")).getByRole("button", { name: "View" }));
    const dialog = await screen.findByRole("dialog");
    expect(await within(dialog).findByText(/This item is dismissed\. Nothing more is needed/)).toBeInTheDocument();
    expect(within(dialog).queryByText(/required to resolve or dismiss/)).not.toBeInTheDocument();
  });

  it("mark in review keeps the drawer on the new status and keeps the typed note for the resolve", async () => {
    const dialog = await openReview("Option B is also correct.");
    await within(dialog).findByRole("button", { name: "Mark in review" });
    fireEvent.change(within(dialog).getByLabelText(/Note to the student/), { target: { value: "Checking with the author." } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Mark in review" })); });
    await settle();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(await within(dialog).findByText("In review", { selector: ".ul-status-badge" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Mark in review" })).not.toBeInTheDocument();
    expect(within(dialog).getByLabelText(/Note to the student/)).toHaveValue("Checking with the author.");

    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Resolve" })); });
    await settle();
    expect(calls("set_moderation_status").at(-1)[1]).toEqual({ p_id: "fb-1", p_status: "resolved", p_note: "Checking with the author." });
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("a server error keeps the drawer open with the real message", async () => {
    const dialog = await openReview("Option B is also correct.");
    await within(dialog).findByRole("button", { name: "Dismiss" });
    failNext = { message: "Only admins can moderate.", code: "42501" };
    fireEvent.change(within(dialog).getByLabelText(/Note to the student/), { target: { value: "Duplicate report." } });
    await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "Dismiss" })); });
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Only admins can moderate.");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Dismiss" })).toBeEnabled();
    expect(db[0].status).toBe("new");
  });

  it("buttons are disabled while the request runs; a double click sends one request", async () => {
    const dialog = await openReview("Option B is also correct.");
    await within(dialog).findByRole("button", { name: "Resolve" });
    fireEvent.change(within(dialog).getByLabelText(/Note to the student/), { target: { value: "Fixed." } });
    let release;
    hold = new Promise((r) => { release = r; });
    const resolve = within(dialog).getByRole("button", { name: "Resolve" });
    fireEvent.click(resolve);
    fireEvent.click(resolve);
    await settle();
    expect(within(dialog).getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Dismiss" })).toBeDisabled();
    expect(within(dialog).getByLabelText(/Note to the student/)).toBeDisabled();
    await act(async () => { release(); });
    await settle();
    expect(calls("set_moderation_status")).toHaveLength(1);
  });
});
