/** @vitest-environment jsdom */
// Full-series import: the CSV and Word templates carry every wizard field,
// parse back to the same series, and a filled file lands on the Review step.
import React from "react";
globalThis.React = React;
import "@testing-library/jest-dom/vitest";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deflateRawSync } from "node:zlib";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const rpc = vi.fn(async () => ({ data: null, error: null }));
vi.mock("../src/services/supabaseClient", () => ({
  supabase: { rpc: (...a) => rpc(...a), functions: { invoke: vi.fn() }, auth: { onAuthStateChange: () => {} } },
}));

import {
  SERIES_FIELDS, buildSeriesCsvTemplate, buildSeriesDocxTemplate, buildSeriesFromImport, csvToImport, docxToImport,
  parseDate, parseDateTime,
} from "../src/portals/admin/data/seriesImport";
import { ROW_STATUS, validateCsvRows, validateWizard } from "../src/portals/admin/data/testSeriesWizard";
import TestSeriesWizard from "../src/portals/admin/pages/TestSeriesWizard";

const wait = (ms = 30) => act(async () => { await new Promise((r) => setTimeout(r, ms)); });
beforeEach(() => { rpc.mockClear(); window.scrollTo = () => {}; });
afterEach(() => cleanup());

function filled(imp) {
  const report = validateCsvRows(imp.rows, new Set());
  return { report, ...buildSeriesFromImport(imp, report) };
}

describe("dates", () => {
  it("reads ISO and day-first dates, and times", () => {
    expect(parseDate("2026-12-31")).toBe("2026-12-31");
    expect(parseDate("31/12/2026")).toBe("2026-12-31");
    expect(parseDate("5-1-26")).toBe("2026-01-05");
    expect(parseDate("31/02/2026")).toBeNull();
    expect(parseDate("")).toBe("");
    expect(parseDateTime("2026-12-31 09:30")).toBe("2026-12-31T09:30");
    expect(parseDateTime("31/12/2026 9:30 PM")).toBe("2026-12-31T21:30");
  });
});

describe("CSV template", () => {
  const csv = buildSeriesCsvTemplate();
  it("lists every series field, the test columns and the question columns", () => {
    SERIES_FIELDS.forEach((f) => expect(csv).toContain(f.label));
    ["Test name", "Duration (min)", "Passing %", "Attempts allowed", "Answer upload (min)", "Time window"].forEach((h) => expect(csv).toContain(h));
    expect(csv).toContain("test,question,optionA,optionB,optionC,optionD,correct,marks,negative,type,difficulty,subject,topic,explanation");
  });
  it("parses back into a complete, valid series", () => {
    const imp = csvToImport(csv);
    expect(imp.kind).toBe("series");
    expect(imp.missing).toEqual([]);
    expect(imp.warnings).toEqual([]);
    const { report, patch } = filled(imp);
    expect(report.every((r) => r.status === ROW_STATUS.VALID)).toBe(true);
    expect(patch.name).toMatch(/Sample Physics/);
    expect(patch.classification).toMatchObject({ grade: "Class 12", subject: "Physics", exam: "Board Exams", difficulty: "Intermediate", languages: ["English", "Hindi"] });
    expect(patch.tests.map((t) => [t.name, t.questions.length, t.duration, t.attemptLimit])).toEqual([["Mechanics Test 1", 2, 30, 1], ["Waves and Units Test 2", 2, 20, 2]]);
    const review = validateWizard({ ...patch, startMethod: "csv" }, {});
    expect(review.errors).toEqual([]);   // ready to publish straight away
  });
  it("a questions-only CSV is left to the old importer", () => {
    expect(csvToImport("question,optionA\nx,y").kind).toBe("questions");
  });
  it("fills availability, pricing and late rules from a hand-edited file", () => {
    const edited = csv
      .replace("Free or paid,Free", "Free or paid,Paid").replace("Price (INR),,", "Price (INR),499,")
      .replace("Go live,Now", "Go live,Schedule").replace("Go-live date and time,,", "Go-live date and time,2099-01-02 10:00,")
      .replace("Availability,Always open", "Availability,Open & close dates").replace("Opens on,,", "Opens on,2099-01-01,").replace("Closes on,,", "Closes on,01/03/2099,")
      .replace("Monthly access limit,,", "Monthly access limit,5,").replace("Access duration (days),,", "Access duration (days),90,")
      .replace("Late submissions,Not allowed", "Late submissions,Allowed").replace("Late grace period (min),,", "Late grace period (min),15,");
    const { patch, warnings } = filled(csvToImport(edited));
    expect(warnings).toEqual([]);
    expect(patch).toMatchObject({ pricing: "paid", price: "499", lateSubmissions: { allowed: true, graceMinutes: 15 } });
    expect(patch.availability).toMatchObject({ goLive: "schedule", goLiveAt: "2099-01-02T10:00", mode: "window", openAt: "2099-01-01", closeAt: "2099-03-01", monthlyLimited: true, monthlyLimit: 5, accessLimited: true, accessDays: 90 });
  });
  it("warns about unknown values instead of guessing, and creates unlisted tests", () => {
    const edited = csv.replace("Class / Grade,Class 12", "Class / Grade,Class 13").replace("Mechanics Test 1,A body", "Mystery Test,A body");
    const imp = csvToImport(edited);
    expect(imp.missing).toContain("Class / Grade");
    const { warnings, patch } = filled(imp);
    expect(warnings.join(" ")).toMatch(/Class 13/);
    expect(warnings.join(" ")).toMatch(/Mystery Test.*not in the Tests table/);
    expect(patch.tests.map((t) => t.name)).toContain("Mystery Test");
  });
});

describe("Word template", () => {
  it("is a real .docx that parses back to the same series as the CSV", async () => {
    const bytes = await buildSeriesDocxTemplate("uint8array");
    expect(String.fromCharCode(bytes[0], bytes[1])).toBe("PK");
    const fromDocx = await docxToImport(bytes);
    expect(fromDocx.kind).toBe("series");
    expect(fromDocx.missing).toEqual([]);
    expect(fromDocx.warnings).toEqual([]);
    const a = filled(fromDocx).patch;
    const b = filled(csvToImport(buildSeriesCsvTemplate())).patch;
    const strip = (p) => JSON.parse(JSON.stringify({ ...p, tests: p.tests.map((t) => ({ ...t, wid: undefined, questions: t.questions.map((q) => ({ ...q, wid: undefined })) })) }));
    expect(strip(a)).toEqual(strip(b));
  });
  it("reads a deflate-compressed .docx, as Word saves it", async () => {
    const stored = await buildSeriesDocxTemplate("uint8array");
    const xml = await (await import("../src/portals/admin/utils/zip")).unzipText(stored, "word/document.xml");
    // rebuild the zip by hand with the document entry deflated (method 8)
    const data = deflateRawSync(Buffer.from(xml));
    const name = Buffer.from("word/document.xml");
    const local = Buffer.alloc(30); local.writeUInt32LE(0x04034b50, 0); local.writeUInt16LE(20, 4); local.writeUInt16LE(8, 8);
    local.writeUInt32LE(data.length, 18); local.writeUInt32LE(xml.length, 22); local.writeUInt16LE(name.length, 26);
    const cen = Buffer.alloc(46); cen.writeUInt32LE(0x02014b50, 0); cen.writeUInt16LE(8, 10); cen.writeUInt32LE(data.length, 20);
    cen.writeUInt32LE(xml.length, 24); cen.writeUInt16LE(name.length, 28);
    const cdStart = local.length + name.length + data.length;
    const end = Buffer.alloc(22); end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(1, 8); end.writeUInt16LE(1, 10);
    end.writeUInt32LE(cen.length + name.length, 12); end.writeUInt32LE(cdStart, 16);
    const zip = new Uint8Array(Buffer.concat([local, name, data, cen, name, end]));
    const res = await docxToImport(zip);
    expect(res.kind).toBe("series");
    expect(res.rows).toHaveLength(4);
  });
  it("rejects a file that is not a Word document", async () => {
    const res = await docxToImport(new TextEncoder().encode("not a zip").buffer);
    expect(res.kind).toBe("error");
  });
});

describe("the wizard", () => {
  it("a filled CSV creates the draft and opens Review, ready to publish", async () => {
    render(<MemoryRouter><TestSeriesWizard /></MemoryRouter>);
    const pick = (label) => screen.queryAllByRole("button").find((b) => b.textContent.includes(label));
    await act(async () => { fireEvent.click(pick("Import from file")); });
    await act(async () => { fireEvent.click(pick("Continue")); });
    fireEvent.change(screen.getByPlaceholderText(/question,optionA/), { target: { value: buildSeriesCsvTemplate() } });
    fireEvent.click(screen.getByRole("button", { name: "Validate pasted text" }));
    expect(screen.getByText(/Click "Create draft from file"/)).toBeInTheDocument();
    await act(async () => { fireEvent.click(screen.getByRole("button", { name: "Create draft from file" })); });
    await wait();
    expect(screen.getByText("Review & publish")).toBeInTheDocument();
    expect(screen.getByText(/Sample Physics Test Series/)).toBeInTheDocument();
    expect(screen.queryByText(/Fix these before publishing/)).toBeNull();
  });
});
