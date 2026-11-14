/** @vitest-environment jsdom */
// QA triage P8: /teacher/test-series/new (#11) and CSV import end to end, in
// the admin and teacher portals.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: { rpc: (...a) => rpc(...a), functions: { invoke: vi.fn() }, auth: { onAuthStateChange: () => {} } },
}));

import { CSV_TEMPLATE, ROW_STATUS, csvToRows, parseCsv, validateCsvRows } from "../src/portals/admin/data/testSeriesWizard";
import { CsvImporter } from "../src/portals/admin/pages/TestSeriesWizardParts";
import TestSeriesWizard from "../src/portals/admin/pages/TestSeriesWizard";
import { EducatorGate } from "../src/layouts/TeacherLayout";

const HEADER = "question,optionA,optionB,optionC,optionD,correct,marks,negative,type,difficulty,subject,topic,explanation";
// commas and quotes inside fields, an escaped quote, an invalid answer, a subjective row without a model answer
const SAMPLE = [
  HEADER,
  '"What is 2, plus 2?","3","4","5, maybe","6",B,4,1,mcq,easy,Maths,"Addition, basics","Count: 2 + 2 = 4"',
  '"He said ""hello"" — which word is quoted?",hello,said,He,which,A,2,0,mcq,medium,English,Quotes,',
  '"Bad answer row",a,b,c,d,E,4,1,mcq,easy,,,',
  '"Explain gravity",,,,,,5,0,subjective,medium,Physics,,',
].join("\r\n");

const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
beforeEach(() => { rpc.mockClear(); window.scrollTo = () => {}; });
afterEach(() => cleanup());

// -----------------------------------------------------------------------------
describe("CSV parsing", () => {
  it("handles commas and escaped quotes inside fields, CRLF and a BOM", () => {
    const rows = parseCsv(`﻿${SAMPLE}`);
    expect(rows).toHaveLength(5);
    expect(rows[1][0]).toBe("What is 2, plus 2?");
    expect(rows[1][4]).toBe("6");
    expect(rows[1][3]).toBe("5, maybe");
    expect(rows[1][11]).toBe("Addition, basics");
    expect(rows[2][0]).toBe('He said "hello" — which word is quoted?');
  });

  it("validates each row with a reason; a subjective row needs its model answer; the row keeps its text", () => {
    const { rows, error } = csvToRows(SAMPLE);
    expect(error).toBe("");
    const report = validateCsvRows(rows, new Set());
    expect(report.map((r) => r.status)).toEqual([ROW_STATUS.VALID, ROW_STATUS.VALID, ROW_STATUS.INVALID, ROW_STATUS.INCOMPLETE]);
    expect(report[0].question).toBe("What is 2, plus 2?");
    expect(report[0].parsed).toMatchObject({ text: "What is 2, plus 2?", correctAnswer: "B", optionC: "5, maybe", topic: "Addition, basics" });
    expect(report[2].issues.join(" ")).toMatch(/must be A, B, C or D/);
    expect(report[3].issues.join(" ")).toMatch(/Model answer is missing/);
    expect(report[3].question).toBe("Explain gravity");
  });

  it("the template validates cleanly", () => {
    const report = validateCsvRows(csvToRows(CSV_TEMPLATE).rows, new Set());
    expect(report.every((r) => r.status === ROW_STATUS.VALID)).toBe(true);
  });
});

// -----------------------------------------------------------------------------
describe("CSV importer", () => {
  function paste(text) {
    fireEvent.change(screen.getByPlaceholderText(/question,optionA/), { target: { value: text } });
    fireEvent.click(screen.getByRole("button", { name: "Validate pasted text" }));
  }

  it("previews valid and invalid rows with reasons, imports only the valid ones, never crashes", () => {
    const onImport = vi.fn();
    render(<CsvImporter existingKeys={new Set()} onImport={onImport} />);
    paste(SAMPLE);
    expect(screen.getByText("What is 2, plus 2?")).toBeInTheDocument();
    expect(screen.getByText(/must be A, B, C or D/)).toBeInTheDocument();
    expect(screen.getByText(/Model answer is missing/)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Import 2 valid rows" }));
    expect(onImport).toHaveBeenCalledTimes(1);
    expect(onImport.mock.calls[0][0].map((q) => q.text)).toEqual(["What is 2, plus 2?", 'He said "hello" — which word is quoted?']);
    expect(screen.getByText(/2 valid questions imported/)).toBeInTheDocument();
    expect(screen.queryByText("What is 2, plus 2?")).toBeNull();     // imported rows leave the preview
    expect(screen.getByText("Bad answer row")).toBeInTheDocument();  // the rest stay
  });

  it("Fix: the editor keeps the row text and a corrected row becomes valid", () => {
    render(<CsvImporter existingKeys={new Set()} onImport={vi.fn()} />);
    paste([HEADER, '"Bad answer row",a,b,c,d,E,4,1,mcq,easy,,,'].join("\n"));
    fireEvent.click(screen.getByRole("button", { name: "Fix" }));
    expect(screen.getByDisplayValue("Bad answer row")).toBeInTheDocument();
    fireEvent.change(screen.getByDisplayValue("E"), { target: { value: "C" } });
    expect(screen.getByRole("button", { name: "Import 1 valid row" })).toBeEnabled();
    const type = screen.getByDisplayValue("MCQ (single answer)");
    expect(within(type).getByRole("option", { name: /Subjective/ })).toBeEnabled();
  });

  it("file picker: reads a .csv file; refuses other files with a message", async () => {
    render(<CsvImporter existingKeys={new Set()} onImport={vi.fn()} />);
    const input = document.querySelector('input[type="file"]');
    await act(async () => { fireEvent.change(input, { target: { files: [new File(["x"], "photo.png", { type: "image/png" })] } }); });
    expect(screen.getByText(/Choose a .csv file/)).toBeInTheDocument();
    await act(async () => { fireEvent.change(input, { target: { files: [new File([SAMPLE], "questions.csv", { type: "text/csv" })] } }); });
    await wait(30);
    expect(screen.getByText(/Loaded: questions.csv/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Import 2 valid rows" })).toBeInTheDocument();
  });

  it("the template downloads as a CSV file", () => {
    const createObjectURL = vi.fn(() => "blob:x");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<CsvImporter existingKeys={new Set()} onImport={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /Template/ }));
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(click).toHaveBeenCalled();
    click.mockRestore();
  });
});

// -----------------------------------------------------------------------------
async function startCsvImport() {
  const pick = (label) => screen.queryAllByRole("button").find((b) => b.textContent.includes(label));
  await act(async () => { fireEvent.click(pick("Import questions")); });
  await act(async () => { fireEvent.click(pick("Continue")); });
  fireEvent.change(screen.getByPlaceholderText(/question,optionA/), { target: { value: SAMPLE } });
  fireEvent.click(screen.getByRole("button", { name: "Validate pasted text" }));
  await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Import 2 valid rows" })); });
}

describe("the wizard routes", () => {
  it("/teacher/test-series/new mounts for an approved educator and imports a CSV (#11)", async () => {
    const api = { getStatus: vi.fn().mockResolvedValue({ status: "approved" }) };
    render(
      <MemoryRouter initialEntries={["/teacher/test-series/new"]}>
        <Routes>
          <Route path="/teacher" element={<EducatorGate user={{ id: "u1", name: "Asha Rao" }} onLogout={vi.fn()} statusApi={api} />}>
            <Route path="test-series/new" element={<TestSeriesWizard />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("How would you like to start?")).toBeInTheDocument();
    await startCsvImport();
    expect(screen.getByText(/2 questions ready in “Imported questions”/)).toBeInTheDocument();
  });

  it("the admin wizard imports the same CSV", async () => {
    render(<MemoryRouter initialEntries={["/admin/testseries/new"]}><Routes><Route path="/admin/testseries/new" element={<TestSeriesWizard />} /></Routes></MemoryRouter>);
    expect(await screen.findByText("How would you like to start?")).toBeInTheDocument();
    await startCsvImport();
    expect(screen.getByText(/2 questions ready in “Imported questions”/)).toBeInTheDocument();
  });

  it("a page that still crashes shows the error panel inside the teacher portal, not a blank screen", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    function Broken() { throw new Error("boom in the wizard"); }
    const api = { getStatus: vi.fn().mockResolvedValue({ status: "approved" }) };
    render(
      <MemoryRouter initialEntries={["/teacher/test-series/new"]}>
        <Routes>
          <Route path="/teacher" element={<EducatorGate user={{ id: "u1", name: "Asha Rao" }} onLogout={vi.fn()} statusApi={api} />}>
            <Route path="test-series/new" element={<Broken />} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/boom in the wizard/)).toBeInTheDocument();
    expect(screen.getAllByText("Educator Studio").length).toBeGreaterThan(0);   // the portal chrome stays
    log.mockRestore();
  });
});
