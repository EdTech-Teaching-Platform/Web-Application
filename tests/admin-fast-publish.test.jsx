/** @vitest-environment jsdom */
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn();
vi.mock("../src/services/supabaseClient", () => ({ supabase: { rpc: (...args) => rpc(...args) } }));

import { callRpc } from "../src/portals/admin/services/adminApi";
import { RPC_TIMING_STORAGE_KEY } from "../src/portals/admin/utils/debugTiming";
import { failedStepIndex, saveErrorMessage, saveSteps } from "../src/portals/admin/utils/saveProgress";
import TestSeriesWizard from "../src/portals/admin/pages/TestSeriesWizard";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  localStorage.removeItem(RPC_TIMING_STORAGE_KEY);
});
beforeEach(() => {
  rpc.mockReset();
  window.scrollTo = () => {};   // the wizard scrolls to the top on each step; jsdom has no scrolling
});

// -----------------------------------------------------------------------------
describe("save steps and errors", () => {
  it("lists the steps for publish, schedule and drafts", () => {
    expect(saveSteps({ publish: true, scheduled: false })).toEqual(["Saving questions", "Validating", "Publishing"]);
    expect(saveSteps({ publish: true, scheduled: true })).toEqual(["Saving questions", "Validating", "Scheduling go-live"]);
    expect(saveSteps({ publish: false, draftOnly: false })).toEqual(["Saving questions"]);
    expect(saveSteps({ publish: false, draftOnly: true })).toEqual(["Saving draft"]);
  });

  it("puts publish-rule errors on Validating and the rest on the first step", () => {
    const steps = saveSteps({ publish: true });
    expect(failedStepIndex({ message: '"Algebra" has no questions.' }, steps)).toBe(1);
    expect(failedStepIndex({ message: '"Algebra" has 2 question(s) without a correct answer.' }, steps)).toBe(1);
    expect(failedStepIndex({ message: "A test series with this name already exists." }, steps)).toBe(0);
    expect(failedStepIndex({ message: '"Algebra" has no questions.' }, ["Saving draft"])).toBe(0);
  });

  it("says nothing was saved for a server error, and warns when the connection dropped", () => {
    expect(saveErrorMessage({ message: "Admin access required.", code: "42501" })).toBe("Admin access required. Nothing was saved.");
    expect(saveErrorMessage({ message: "TypeError: Failed to fetch", code: "" })).toMatch(/may or may not have been saved/);
  });
});

// -----------------------------------------------------------------------------
describe("debug timing", () => {
  it("is off by default", async () => {
    const time = vi.spyOn(console, "time").mockImplementation(() => {});
    rpc.mockResolvedValue({ data: 1, error: null });
    await callRpc("get_test_series_stats");
    expect(time).not.toHaveBeenCalled();
  });

  it("times every RPC when the localStorage flag is on, even when the call fails", async () => {
    localStorage.setItem(RPC_TIMING_STORAGE_KEY, "1");
    const time = vi.spyOn(console, "time").mockImplementation(() => {});
    const timeEnd = vi.spyOn(console, "timeEnd").mockImplementation(() => {});
    rpc.mockResolvedValueOnce({ data: null, error: { message: "nope", code: "42501" } });
    await expect(callRpc("upsert_test_series_full", {})).rejects.toThrow("nope");
    expect(time).toHaveBeenCalledWith(expect.stringMatching(/^rpc upsert_test_series_full #\d+$/));
    expect(timeEnd).toHaveBeenCalledWith(time.mock.calls[0][0]);
  });
});

// -----------------------------------------------------------------------------
const WIZARD_STATE = {
  seriesType: "own", startMethod: "scratch", sourceSeriesId: "", name: "Fast series", about: "", whoFor: "",
  audience: "Class 12", pricing: "free", price: "", syllabus: "",
  classification: { grade: "Class 12", subject: "Maths", exam: "JEE Main", difficulty: "Medium", languages: ["English"] },
  buildDeadline: "",
  availability: { goLive: "now", goLiveAt: "", mode: "always", openAt: "", closeAt: "", monthlyLimited: false, monthlyLimit: 5, accessLimited: false, accessDays: 90 },
  lateSubmissions: { allowed: false, graceMinutes: 10 },
  tests: [{
    wid: "t1", name: "Algebra", instructions: "", duration: 30, passingPercent: 40, attemptLimit: 1,
    window: { mode: "inherit", openAt: "", closeAt: "" }, plannedQuestions: 1, topics: [],
    questions: [{ wid: "q1", type: "mcq_single", text: "2 + 2?", optionA: "1", optionB: "4", optionC: "5", optionD: "6",
                  correctAnswer: "B", marks: 4, negativeMarks: 0, difficulty: "medium", subject: "", topic: "", explanation: "" }],
  }],
};

function deferred() {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

function renderWizard() {
  render(
    <MemoryRouter initialEntries={[{ pathname: "/admin/testseries/new", state: { seriesId: "s1" } }]}>
      <Routes>
        <Route path="/admin/testseries/new" element={<TestSeriesWizard />} />
        <Route path="/admin/testseries" element={<p>Series list page</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

async function goToReview() {
  await waitFor(() => expect(rpc).toHaveBeenCalledWith("get_test_series", { p_id: "s1" }));
  for (let i = 0; i < 5; i += 1) {
    const next = await screen.findByRole("button", { name: /Continue/ });
    await waitFor(() => expect(next).toBeEnabled());
    fireEvent.click(next);
  }
  return screen.findByRole("button", { name: "Publish now" });
}

describe("wizard publish", () => {
  it("does not load the series list on open, shows the steps, blocks double clicks, and retries after an error", async () => {
    const calls = [];
    rpc.mockImplementation((name, params) => {
      if (name === "get_test_series") return Promise.resolve({ data: { id: "s1", title: "Fast series", wizard_state: WIZARD_STATE, tests: [] }, error: null });
      if (name === "series_name_exists") return Promise.resolve({ data: false, error: null });
      if (name === "upsert_test_series_full") {
        const d = deferred();
        calls.push({ params, d });
        return d.promise;
      }
      return Promise.resolve({ data: null, error: null });
    });
    renderWizard();
    const publish = await goToReview();
    expect(rpc.mock.calls.map((c) => c[0])).not.toContain("list_test_series");

    // first click: one RPC, buttons locked, steps shown
    fireEvent.click(publish);
    fireEvent.click(publish);
    expect(calls).toHaveLength(1);
    expect(calls[0].params.p_publish).toBe(true);
    expect(calls[0].params.p.id).toBe("s1");
    expect(screen.getByRole("button", { name: "Publishing…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Save as draft" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /Back/ })).toBeDisabled();
    const status = screen.getByRole("status");
    expect(status).toHaveTextContent("Publish now…");
    expect(status).toHaveTextContent("Saving questions (in progress)");
    expect(status).toHaveTextContent("Validating (waiting)");
    expect(status).toHaveTextContent("Publishing (waiting)");

    // the server refuses: the failed step, the message, Retry
    await act(async () => { calls[0].d.resolve({ data: null, error: { message: '"Algebra" has no questions.', code: "22023" } }); });
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Publish now failed");
    expect(alert).toHaveTextContent("Validating (failed)");
    expect(alert).toHaveTextContent('"Algebra" has no questions. Nothing was saved.');
    expect(screen.getByRole("button", { name: "Publish now" })).toBeEnabled();

    // retry succeeds and returns to the list
    fireEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(calls).toHaveLength(2);
    await act(async () => { calls[1].d.resolve({ data: "s1", error: null }); });
    expect(await screen.findByText("Series list page")).toBeInTheDocument();
  });

  it("saves a draft of a saved series with one save_wizard_draft call and the same lock", async () => {
    const d = deferred();
    rpc.mockImplementation((name) => {
      if (name === "get_test_series") return Promise.resolve({ data: { id: "s1", title: "Fast series", wizard_state: WIZARD_STATE, tests: [] }, error: null });
      if (name === "series_name_exists") return Promise.resolve({ data: false, error: null });
      if (name === "save_wizard_draft") return d.promise;
      return Promise.resolve({ data: null, error: null });
    });
    renderWizard();
    await goToReview();
    const draft = screen.getByRole("button", { name: "Save as draft" });
    fireEvent.click(draft);
    fireEvent.click(draft);
    expect(rpc.mock.calls.filter((c) => c[0] === "save_wizard_draft")).toHaveLength(1);
    expect(screen.getByRole("button", { name: "Saving…" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Publish now" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("Saving draft (in progress)");

    await act(async () => { d.resolve({ data: null, error: { message: "TypeError: Failed to fetch", code: "" } }); });
    expect(await screen.findByRole("alert")).toHaveTextContent("may or may not have been saved");
    fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });
});
