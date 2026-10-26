/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";

const rpc = vi.fn();
vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: (...args) => rpc(...args) } }));

import { FeedbackForm } from "../src/portals/student/components/FeedbackForm";
import { validateFeedback } from "../src/portals/student/utils/feedback";
import { mapModerationRow, moderationApi } from "../src/portals/admin/services/moderationApi";
import { ItemDetail } from "../src/portals/admin/pages/ContentModeration";

afterEach(() => cleanup());
beforeEach(() => rpc.mockReset());

// -----------------------------------------------------------------------------
describe("feedback validation", () => {
  it("needs a rating for feedback and 5-2000 characters", () => {
    expect(validateFeedback({ kind: "feedback", rating: 0, message: "Great test" })).toEqual({ rating: "Give a rating from 1 to 5 stars." });
    expect(validateFeedback({ kind: "feedback", rating: 4, message: " hi " })).toEqual({ message: "Write at least 5 characters." });
    expect(validateFeedback({ kind: "query", rating: 0, message: "x".repeat(2001) })).toEqual({ message: "Keep it under 2000 characters." });
    expect(validateFeedback({ kind: "complaint", message: "Hello there" })).toHaveProperty("kind");
    expect(validateFeedback({ kind: "issue", rating: 0, message: "Option B is right" })).toEqual({});
  });
});

describe("feedback form", () => {
  const questions = [
    { question_id: "q1", position: 1, text: "First question" },
    { question_id: "q2", position: 2, text: "Second question" },
  ];

  function renderForm(api) {
    const onSubmitted = vi.fn();
    render(<FeedbackForm open attemptId="att-1" questions={questions} api={api} onSubmitted={onSubmitted} onClose={vi.fn()} />);
    return onSubmitted;
  }

  it("keeps Send disabled until the form is valid, counts characters, and sends the right payload", async () => {
    const api = { submit: vi.fn().mockResolvedValue("fb-1") };
    const onSubmitted = renderForm(api);
    const send = screen.getByRole("button", { name: "Send" });
    expect(send).toBeDisabled();

    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Nice test" } });
    expect(screen.getByText("9 / 2000")).toBeInTheDocument();
    expect(send).toBeDisabled();                                   // feedback still needs stars
    fireEvent.click(screen.getByRole("radio", { name: "4 stars" }));
    expect(send).toBeEnabled();

    fireEvent.change(screen.getByLabelText("Category (optional)"), { target: { value: "unclear_question" } });
    fireEvent.change(screen.getByLabelText("Question (optional)"), { target: { value: "q2" } });
    await act(async () => { fireEvent.click(send); });

    expect(api.submit).toHaveBeenCalledWith({
      attemptId: "att-1", kind: "feedback", rating: 4, category: "unclear_question", questionId: "q2", message: "Nice test",
    });
    expect(onSubmitted).toHaveBeenCalledWith("fb-1");
    expect(screen.getByText("Thanks, it's sent")).toBeInTheDocument();
  });

  it("does not need stars for an issue, and shows a loader while sending", async () => {
    let resolve;
    const api = { submit: vi.fn(() => new Promise((r) => { resolve = r; })) };
    renderForm(api);
    fireEvent.click(screen.getByRole("radio", { name: /Report an issue/ }));
    expect(screen.queryByRole("radiogroup", { name: "Rating" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Option B is also correct" } });
    fireEvent.click(screen.getByRole("button", { name: "Send" }));
    expect(screen.getByRole("button", { name: "Sending…" })).toBeDisabled();
    await act(async () => { resolve("fb-2"); });
    expect(api.submit.mock.calls[0][0]).toMatchObject({ kind: "issue", questionId: "" });
  });

  it("shows the server's message when sending fails (e.g. the daily limit)", async () => {
    const api = { submit: vi.fn().mockRejectedValue(new Error("You can send up to 5 messages per test series each day. Try again tomorrow.")) };
    renderForm(api);
    fireEvent.click(screen.getByRole("radio", { name: /^Query/ }));
    fireEvent.change(screen.getByLabelText("Message"), { target: { value: "Why is Q3 wrong?" } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Send" })); });
    expect(screen.getByRole("alert")).toHaveTextContent("up to 5 messages per test series");
    expect(screen.getByRole("button", { name: "Send" })).toBeEnabled();
  });

  it("shows the length error after the field is touched", () => {
    renderForm({ submit: vi.fn() });
    const msg = screen.getByLabelText("Message");
    fireEvent.change(msg, { target: { value: "hey" } });
    fireEvent.blur(msg);
    expect(screen.getByText("Write at least 5 characters.")).toBeInTheDocument();
  });
});

// -----------------------------------------------------------------------------
const ROW = {
  id: "fb-1", kind: "issue", rating: null, category: "wrong_answer", message: "Option B is also correct.",
  status: "in_review", admin_note: null, created_at: "2026-10-27T10:00:00Z", updated_at: "2026-10-27T10:05:00Z",
  reviewed_at: "2026-10-27T10:05:00Z", student_id: "s-1", student_name: "Student A", student_email: "a@x.com",
  series_id: "ser-1", series_title: "Physics series", test_id: "t-1", test_title: "Test 1", attempt_id: "att-1",
  question_id: "q-1", reviewed_by: "adm-1", reviewed_by_name: "Moderator",
};

describe("moderation list mapping", () => {
  it("maps an RPC row to the page shape", () => {
    expect(mapModerationRow(ROW)).toEqual({
      id: "fb-1", kind: "issue", kindLabel: "Issue", rating: null, category: "wrong_answer", categoryLabel: "Wrong answer",
      message: "Option B is also correct.", status: "in_review", statusLabel: "In review", statusBadge: "is-verified",
      adminNote: "", createdAt: "2026-10-27T10:00:00Z", reviewedAt: "2026-10-27T10:05:00Z", reviewedByName: "Moderator",
      student: { id: "s-1", name: "Student A", email: "a@x.com" },
      series: { id: "ser-1", title: "Physics series" },
      test: { id: "t-1", title: "Test 1" },
      attemptId: "att-1", questionId: "q-1",
    });
    expect(mapModerationRow({ ...ROW, student_name: null, test_title: null, category: null })).toMatchObject({
      student: { name: "Unknown student" }, test: { title: "" }, categoryLabel: "",
    });
  });

  it("calls list_moderation_items with null for 'all' and returns rows + total", async () => {
    rpc.mockResolvedValue({ data: [{ row_data: ROW, total_count: 7 }], error: null });
    const res = await moderationApi.list({ search: "  option ", kind: "issue", status: "open", series: "all", page: 2, size: 10 });
    expect(rpc).toHaveBeenCalledWith("list_moderation_items", {
      p_search: "option", p_kind: "issue", p_status: "open", p_series: null, p_page: 2, p_size: 10,
    });
    expect(res.total).toBe(7);
    expect(res.rows[0]).toMatchObject({ kindLabel: "Issue", statusLabel: "In review", student: { name: "Student A" } });
  });

  it("surfaces RPC errors with their message and code", async () => {
    rpc.mockResolvedValue({ data: null, error: { message: "Admin access required.", code: "42501" } });
    await expect(moderationApi.stats()).rejects.toMatchObject({ message: "Admin access required.", code: "42501" });
  });
});

describe("moderation detail actions", () => {
  it("needs a note to resolve, then sends the status and note", async () => {
    const api = {
      get: vi.fn().mockResolvedValue({ ...mapModerationRow(ROW), question: null, attempt: null, history: [] }),
      setStatus: vi.fn().mockResolvedValue(mapModerationRow({ ...ROW, status: "resolved" })),
    };
    const setToast = vi.fn();
    const onChanged = vi.fn();
    render(<ItemDetail id="fb-1" api={api} onClose={vi.fn()} onChanged={onChanged} setToast={setToast} />);
    await screen.findByText("Option B is also correct.");
    fireEvent.click(screen.getByRole("button", { name: "Resolve" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Add a note for the student");
    expect(api.setStatus).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText(/Note to the student/), { target: { value: "Accepted, scores updated." } });
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Resolve" })); });
    expect(api.setStatus).toHaveBeenCalledWith("fb-1", "resolved", "Accepted, scores updated.");
    await waitFor(() => expect(onChanged).toHaveBeenCalled());
    expect(setToast).toHaveBeenCalledWith("Marked resolved. The student has been notified.");
    // the reloaded item is still "in review", so the actions offered are Resolve / Dismiss
    expect(screen.getByRole("button", { name: "Dismiss" })).toBeInTheDocument();
  });
});
