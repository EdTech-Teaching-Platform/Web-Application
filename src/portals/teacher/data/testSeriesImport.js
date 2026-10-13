// UNUSED -- no longer imported anywhere. The "Build from Course" / "Question Bank" / Duplicate / CSV / AI start paths
// were removed: test series are now built manually from scratch. Safe to delete this file.
// "Import questions" build method: real client-side CSV parsing + row-level
// validation. Excel (.xlsx/.xls) can't be parsed without a zip/XML library,
// so those files are rejected with a clear "Save as CSV" instruction rather
// than silently mis-read.
import { QUESTION_TYPES, TS_DIFFICULTIES, makeId, newQuestion } from "./testSeriesData";

export const IMPORT_COLUMNS = ["type", "question", "optionA", "optionB", "optionC", "optionD", "correct", "points", "difficulty", "topic", "explanation", "answer", "tolerance"];

const TEMPLATE_ROWS = [
  ["mcq_single", "Which planet is known as the Red Planet?", "Mars", "Venus", "Jupiter", "Mercury", "A", "2", "Beginner", "Solar System", "Mars looks red because of iron oxide.", "", ""],
  ["mcq_multi", "Which of these are prime numbers?", "2", "4", "5", "9", "A,C", "4", "Intermediate", "Number Theory", "", "", ""],
  ["true_false", "Light travels faster in water than in air.", "", "", "", "", "False", "2", "Beginner", "Optics", "", "", ""],
  ["numerical", "Find the area of a circle of radius 7 (use 22/7).", "", "", "", "", "", "4", "Intermediate", "Mensuration", "", "154", "0.5"],
  ["fill_blank", "The capital of France is ______.", "", "", "", "", "", "2", "Beginner", "Geography", "", "Paris", ""],
  ["short_answer", "State Newton's second law.", "", "", "", "", "", "5", "Intermediate", "Laws of Motion", "", "Force equals mass times acceleration.", ""],
];

function csvCell(v) {
  const s = String(v ?? "");
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export function importTemplateCsv() {
  return [IMPORT_COLUMNS, ...TEMPLATE_ROWS].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
}
export function downloadTextFile(filename, text, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// RFC-4180-style parser: quoted fields, "" escapes, newlines inside quotes,
// CRLF/LF, optional BOM. The delimiter (comma / semicolon / tab) is sniffed
// from the header line.
export function parseCsv(input) {
  let text = String(input ?? "").replace(/^﻿/, "");
  const firstLine = text.split(/\r?\n/, 1)[0] || "";
  const counts = { ",": 0, ";": 0, "\t": 0 };
  let inQ = false;
  for (const ch of firstLine) {
    if (ch === '"') inQ = !inQ;
    else if (!inQ && ch in counts) counts[ch] += 1;
  }
  const delim = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][1] > 0 ? Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0] : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (quoted) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
    } else if (ch === '"' && cell === "") quoted = true;
    else if (ch === delim) {
      row.push(cell);
      cell = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      rows.push(row);
      row = [];
    } else cell += ch;
  }
  if (cell !== "" || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return { rows: rows.filter((r) => r.some((c) => String(c).trim() !== "")), quotedUnterminated: quoted };
}

const TYPE_ALIASES = {
  mcq: "mcq_single", single: "mcq_single", mcq_single: "mcq_single", "multiple choice": "mcq_single",
  multi: "mcq_multi", mcq_multi: "mcq_multi", multiple: "mcq_multi",
  tf: "true_false", true_false: "true_false", "true/false": "true_false", truefalse: "true_false",
  numerical: "numerical", numeric: "numerical", number: "numerical",
  fill: "fill_blank", fill_blank: "fill_blank", "fill in the blank": "fill_blank",
  short: "short_answer", short_answer: "short_answer",
  long: "long_answer", long_answer: "long_answer", essay: "long_answer",
};
const norm = (h) => String(h || "").trim().toLowerCase().replace(/[\s_-]+/g, "");
const HEADER_KEYS = Object.fromEntries(IMPORT_COLUMNS.map((c) => [norm(c), c]));

function htmlText(s) {
  const esc = String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  return `<p>${esc}</p>`;
}

// -> { questions, report: [{ row, status: "ok"|"error"|"warning", messages }], okCount, errorCount, fileErrors }
export function validateImportRows(rows) {
  const out = { questions: [], report: [], okCount: 0, errorCount: 0, fileErrors: [] };
  if (!rows.length) {
    out.fileErrors.push("The file is empty.");
    return out;
  }
  const headers = rows[0].map((h) => HEADER_KEYS[norm(h)] || null);
  if (!headers.includes("question")) out.fileErrors.push('Missing a "question" column. Download the template to see the expected columns.');
  if (!headers.includes("type")) out.fileErrors.push('Missing a "type" column. Download the template to see the expected columns.');
  if (out.fileErrors.length) return out;

  rows.slice(1).forEach((cells, idx) => {
    const rowNo = idx + 2; // header is row 1
    const rec = {};
    headers.forEach((key, i) => {
      if (key) rec[key] = String(cells[i] ?? "").trim();
    });
    const errs = [];
    const warns = [];
    const type = TYPE_ALIASES[String(rec.type || "").toLowerCase()];
    if (!type) errs.push(`Unknown type "${rec.type || ""}". Use one of: ${QUESTION_TYPES.map((t) => t.key).join(", ")}.`);
    if (!rec.question) errs.push("Question text is missing.");
    let points = rec.points === "" || rec.points === undefined ? null : Number(rec.points);
    if (points !== null && !(points > 0)) {
      errs.push("Points must be a number greater than 0.");
      points = null;
    }
    let difficulty = TS_DIFFICULTIES.find((d) => d.toLowerCase() === String(rec.difficulty || "").toLowerCase());
    if (!difficulty) {
      if (rec.difficulty) warns.push(`Difficulty "${rec.difficulty}" isn't Beginner/Intermediate/Advanced; defaulted to Intermediate.`);
      difficulty = "Intermediate";
    }
    let q = null;
    if (type) {
      q = { ...newQuestion(type), id: makeId("q"), text: htmlText(rec.question || ""), difficulty, topic: rec.topic || "", explanation: rec.explanation || "" };
      if (points !== null) q.points = points;
      if (type === "mcq_single" || type === "mcq_multi") {
        const letters = ["A", "B", "C", "D"];
        const texts = [rec.optionA, rec.optionB, rec.optionC, rec.optionD];
        const filled = texts.map((t, i) => ({ t, letter: letters[i] })).filter((x) => x.t);
        if (filled.length < 2) errs.push("Provide at least two options (optionA, optionB, …).");
        const correctLetters = String(rec.correct || "").toUpperCase().split(/[,;/\s]+/).filter(Boolean);
        if (!correctLetters.length) errs.push('Set "correct" to the right option letter(s), e.g. A or A,C.');
        const bad = correctLetters.filter((l) => !filled.some((f) => f.letter === l));
        if (bad.length) errs.push(`"correct" refers to option(s) ${bad.join(", ")} which are empty or don't exist.`);
        if (type === "mcq_single" && correctLetters.length > 1) errs.push("A single-answer question can only have one correct option.");
        q.options = filled.map((f) => ({ id: makeId("o"), text: f.t, correct: correctLetters.includes(f.letter) }));
      } else if (type === "true_false") {
        const v = String(rec.correct || rec.answer || "").toLowerCase();
        if (!["true", "false", "t", "f"].includes(v)) errs.push('Set "correct" to True or False.');
        const isTrue = v === "true" || v === "t";
        q.options = [{ id: makeId("o"), text: "True", correct: isTrue }, { id: makeId("o"), text: "False", correct: !isTrue }];
      } else if (type === "numerical") {
        if (rec.answer === "" || rec.answer === undefined || Number.isNaN(Number(rec.answer))) errs.push('"answer" must be a number.');
        q.correctAnswer = String(rec.answer ?? "");
        const tol = rec.tolerance === "" || rec.tolerance === undefined ? 0 : Number(rec.tolerance);
        if (Number.isNaN(tol) || tol < 0) errs.push('"tolerance" must be 0 or a positive number.');
        q.tolerance = Number.isNaN(tol) || tol < 0 ? 0 : tol;
      } else if (type === "fill_blank") {
        if (!rec.answer) errs.push('"answer" is the accepted fill-in answer and is missing.');
        q.correctAnswer = rec.answer || "";
      } else {
        if (!rec.answer) warns.push('No model "answer" given; add a rubric or model answer before publishing.');
        q.modelAnswer = rec.answer ? htmlText(rec.answer) : "";
      }
    }
    const status = errs.length ? "error" : warns.length ? "warning" : "ok";
    out.report.push({ row: rowNo, status, messages: [...errs, ...warns], preview: String(rec.question || "").slice(0, 80) });
    if (errs.length) out.errorCount += 1;
    else {
      out.okCount += 1;
      out.questions.push(q);
    }
  });
  if (!out.report.length) out.fileErrors.push("No question rows found below the header.");
  return out;
}

export function isExcelFile(file) {
  return /\.(xlsx|xlsm|xls)$/i.test(file?.name || "");
}
export async function readImportFile(file) {
  if (isExcelFile(file)) {
    return { fileErrors: ["Excel workbooks can't be read directly. In Excel choose File > Save As > CSV UTF-8 (Comma delimited), then upload that .csv file."], report: [], questions: [], okCount: 0, errorCount: 0 };
  }
  const text = await file.text();
  const { rows, quotedUnterminated } = parseCsv(text);
  const result = validateImportRows(rows);
  if (quotedUnterminated) result.fileErrors.push("A quoted field is never closed; check the last rows for a stray quote.");
  return result;
}
