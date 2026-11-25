// Full test-series import: one CSV or Word file carries everything the wizard
// asks for (series details, classification, availability, tests and
// questions). The same three-part layout is used by both formats:
//   1. Series details  - a Field / Your answer / Notes table
//   2. Tests           - one row per test
//   3. Questions       - one row per question (the `test` column picks the test)
//
// CSV marks the parts with [SERIES], [TESTS] and [QUESTIONS] lines; Word uses
// three tables (found by their header row, so headings and text around them
// are free). A CSV without those markers is the older questions-only file and
// keeps working exactly as before.
//
// Nothing here talks to the server: the result is a wizard-state patch, which
// the wizard shows on its Review step (save as draft / publish as usual).

import { AUDIENCE_OPTIONS, PRICING_TYPE } from "./testSeriesMock";
import {
  BASE_LANGUAGES, CLASS_SUBJECT_OPTIONS, CSV_COLUMNS, EXAM_OPTIONS, GRADE_OPTIONS, LEVEL_OPTIONS, ROW_STATUS,
  emptyTest, initialWizardState, normalizeText, parseCsv, tableToQuestionRows, uploadMinutes,
} from "./testSeriesWizard";
import { buildCsv } from "../utils/csv";
import { unzipText, zipStore } from "../utils/zip";

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z]/g, "");

// ------------------------------------------------------------ the field list

// key -> wizard state. `options` are the values the wizard accepts.
export const SERIES_FIELDS = [
  { key: "name", label: "Series name", required: true, example: "Sample Physics Test Series (replace me)", note: "Required. Up to 120 characters." },
  { key: "about", label: "About this series", example: "Chapter-wise practice tests for Class 12 Physics.\nEach test follows the board exam pattern.", note: "Optional. Press Enter for a new paragraph." },
  { key: "whoFor", label: "Who it's for", example: "Class 12 students preparing for board exams.", note: "Optional." },
  { key: "audience", label: "Target audience", required: true, options: AUDIENCE_OPTIONS, example: "Class 12", note: "Required. One of the allowed values." },
  { key: "syllabus", label: "Syllabus", example: "Kinematics, Vectors, Waves, Units", note: "Optional. Chapters or topics covered." },
  { key: "pricing", label: "Free or paid", options: ["Free", "Paid"], example: "Free", note: "Free or Paid." },
  { key: "price", label: "Price (INR)", example: "", note: "Only for a Paid series, e.g. 999." },
  { key: "grade", label: "Class / Grade", required: true, options: GRADE_OPTIONS, example: "Class 12", note: "Required. One of the allowed values." },
  { key: "subject", label: "Subject", required: true, options: CLASS_SUBJECT_OPTIONS, example: "Physics", note: "Required. One of the allowed values." },
  { key: "exam", label: "Exam / Goal", required: true, options: EXAM_OPTIONS, example: "Board Exams", note: "Required. One of the allowed values." },
  { key: "level", label: "Difficulty level", required: true, options: LEVEL_OPTIONS, example: "Intermediate", note: "Required. One of the allowed values." },
  { key: "languages", label: "Languages", required: true, example: "English|Hindi", note: `Required. One or more, separated by | . Common: ${BASE_LANGUAGES.join(", ")}.` },
  { key: "buildDeadline", label: "Build deadline", example: "", note: "Optional. Date as YYYY-MM-DD, e.g. 2026-12-31." },
  { key: "goLive", label: "Go live", options: ["Now", "Schedule"], example: "Now", note: "Now, or Schedule to go live later." },
  { key: "goLiveAt", label: "Go-live date and time", example: "", note: "Only if Schedule. YYYY-MM-DD HH:MM, in the future." },
  { key: "access", label: "Availability", options: ["Always open", "Open & close dates"], example: "Always open", note: "Always open, or Open & close dates (then fill the next two rows)." },
  { key: "openAt", label: "Opens on", example: "", note: "Only for Open & close dates. YYYY-MM-DD." },
  { key: "closeAt", label: "Closes on", example: "", note: "Only for Open & close dates. YYYY-MM-DD, after the open date." },
  { key: "monthlyLimit", label: "Monthly access limit", example: "", note: "Attempts per student per month, a whole number. Leave blank for unlimited." },
  { key: "accessDays", label: "Access duration (days)", example: "", note: "Days a student keeps access, a whole number. Leave blank for lifetime." },
  { key: "lateAllowed", label: "Late submissions", options: ["Not allowed", "Allowed"], example: "Not allowed", note: "Not allowed, or Allowed with a grace period." },
  { key: "graceMinutes", label: "Late grace period (min)", example: "", note: "Only if Allowed. Minutes after time is up, e.g. 10." },
];

const FIELD_ALIASES = {
  whofor: "whoFor", targetaudience: "audience", audiencelevel: "audience", freeorpaid: "pricing", classgrade: "grade",
  difficulty: "level", examgoal: "exam", language: "languages", golivedate: "goLiveAt", golivedateandtime: "goLiveAt",
  availabilitymode: "access", opens: "openAt", closes: "closeAt", opensonthe: "openAt", priceinr: "price",
  lateperiod: "graceMinutes", graceperiod: "graceMinutes", latesubmission: "lateAllowed",
};
const FIELD_LOOKUP = {};
SERIES_FIELDS.forEach((f) => { FIELD_LOOKUP[norm(f.key)] = f.key; FIELD_LOOKUP[norm(f.label)] = f.key; });
Object.entries(FIELD_ALIASES).forEach(([k, v]) => { FIELD_LOOKUP[k] = v; });
const FIELD_LABEL = Object.fromEntries(SERIES_FIELDS.map((f) => [f.key, f.label]));

// Tests table columns.
export const TEST_COLUMNS = [
  { key: "name", label: "Test name", required: true, example: ["Mechanics Test 1", "Waves and Units Test 2"] },
  { key: "duration", label: "Duration (min)", required: true, example: ["30", "20"] },
  { key: "passingPercent", label: "Passing %", example: ["40", "40"] },
  { key: "attemptLimit", label: "Attempts allowed", example: ["1", "2"] },
  { key: "answerUpload", label: "Answer upload (min)", example: ["15", "15"] },
  { key: "topics", label: "Topics", example: ["Kinematics|Vectors", "Waves|Units"] },
  { key: "windowMode", label: "Time window", example: ["Inherit", "Inherit"] },
  { key: "windowOpen", label: "Window opens", example: ["", ""] },
  { key: "windowClose", label: "Window closes", example: ["", ""] },
];
const TEST_NOTES = [
  "Test name and duration are required. Passing % defaults to 40, attempts to 1, answer upload to 15 minutes.",
  "Time window: Inherit (use the series dates) or Custom (fill both columns, YYYY-MM-DD HH:MM, inside the series dates).",
  "Topics are optional, separated by | .",
];
const TEST_ALIASES = {
  name: "name", test: "name", testname: "name",
  duration: "duration", durationmin: "duration", durationminutes: "duration",
  passing: "passingPercent", passingpercent: "passingPercent",
  attempts: "attemptLimit", attemptsallowed: "attemptLimit", attemptlimit: "attemptLimit",
  answerupload: "answerUpload", answeruploadmin: "answerUpload", answeruploadminutes: "answerUpload", answeruploadtime: "answerUpload",
  topics: "topics", topic: "topics",
  timewindow: "windowMode", window: "windowMode", windowmode: "windowMode",
  windowopens: "windowOpen", windowopen: "windowOpen", windowcloses: "windowClose", windowclose: "windowClose",
};

// Questions table: the same columns as the questions-only CSV, with `test` first.
export const QUESTION_COLUMNS = ["test", ...CSV_COLUMNS];
export const QUESTION_HEADERS_WORD = ["Test", "Question", "Option A", "Option B", "Option C", "Option D", "Correct", "Marks", "Negative", "Type", "Difficulty", "Subject", "Topic", "Explanation"];
const QUESTION_SAMPLE = [
  ["Mechanics Test 1", "A body moving with uniform velocity has:", "Zero acceleration", "Uniform acceleration", "Increasing acceleration", "Decreasing acceleration", "A", "4", "1", "mcq", "easy", "Physics", "Kinematics", "Uniform velocity means no change in speed or direction."],
  ["Mechanics Test 1", "Which of these are vector quantities?", "Velocity", "Speed", "Force", "Mass", "A|C", "4", "1", "mcq_multi", "medium", "Physics", "Vectors", ""],
  ["Waves and Units Test 2", "Light travels faster than sound.", "", "", "", "", "True", "2", "0", "true_false", "easy", "Physics", "Waves", ""],
  ["Waves and Units Test 2", "The SI unit of force is the ____.", "", "", "", "", "newton", "2", "0", "fill_blank", "easy", "Physics", "Units", ""],
  ["Waves and Units Test 2", "Explain why a body moving with uniform velocity has zero acceleration.", "", "", "", "", "Acceleration is the rate of change of velocity. Uniform velocity means speed and direction do not change, so the rate of change is zero.", "5", "0", "subjective", "medium", "Physics", "Kinematics", ""],
];
export const QUESTION_NOTES = [
  "Test: the Test name from the Tests table. Leave blank to use the first test.",
  "Type: mcq (one correct letter), mcq_multi (letters joined with | e.g. A|C), true_false (True or False), fill_blank (the accepted answer goes in Correct), subjective (a written answer; put the model answer in Correct and the AI grades students against it).",
  "Marks default to 4. Negative marks default to 1 for MCQ and 0 otherwise (always 0 for subjective). Difficulty: easy, medium or hard.",
  "Options A to D are only for MCQ. The banner image and question images are added in the wizard.",
];
export const SERIES_NOTES = "Fill the Your answer column. Required rows are marked in Notes. Allowed values are listed in Notes.";

// ------------------------------------------------------------------ templates

const SECTION_RE = /^\[(series|tests|questions)\]$/i;

export function buildSeriesCsvTemplate() {
  const series = SERIES_FIELDS.map((f) => [f.label, f.example, `${f.note}${f.options ? ` Allowed: ${f.options.join(" / ")}.` : ""}`]);
  const tests = TEST_COLUMNS.map((c) => c.label);
  const testRows = [0, 1].map((i) => TEST_COLUMNS.map((c) => c.example[i]));
  return [
    buildCsv([], [["[SERIES]"], ["Field", "Your answer", "Notes"], ...series]),
    "",
    buildCsv([], [["[TESTS]"], tests, ...testRows, ...TEST_NOTES.map((n) => [`Note: ${n}`])]).replace(/^\r?\n/, ""),
    "",
    buildCsv([], [["[QUESTIONS]"], QUESTION_COLUMNS, ...QUESTION_SAMPLE]),
  ].join("\r\n");
}

// ------------------------------------------------------------ Word (.docx) I/O

const W_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const xmlEsc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

function para(text, { bold = false, size = 22, color = "", after = 80 } = {}) {
  const lines = String(text ?? "").split("\n");
  const runs = lines.map((line, i) => `${i ? "<w:r><w:br/></w:r>" : ""}<w:r><w:rPr>${bold ? "<w:b/>" : ""}${color ? `<w:color w:val="${color}"/>` : ""}<w:sz w:val="${size}"/></w:rPr><w:t xml:space="preserve">${xmlEsc(line)}</w:t></w:r>`).join("");
  return `<w:p><w:pPr><w:spacing w:before="0" w:after="${after}"/></w:pPr>${runs}</w:p>`;
}
function cell(text, width, { header = false, fill = "" } = {}) {
  const shade = header ? '<w:shd w:val="clear" w:color="auto" w:fill="1F2937"/>' : fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${fill}"/>` : "";
  // one <w:p> per line: Word cells keep Enter-separated paragraphs
  const body = String(text ?? "").split("\n").map((line) => para(line, { bold: header, size: 18, color: header ? "FFFFFF" : "", after: 20 })).join("");
  return `<w:tc><w:tcPr><w:tcW w:w="${width}" w:type="dxa"/>${shade}</w:tcPr>${body}</w:tc>`;
}
function table(rows, widths, { firstColFill = "" } = {}) {
  const border = (n) => `<w:${n} w:val="single" w:sz="4" w:space="0" w:color="9CA3AF"/>`;
  const grid = widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("");
  const trs = rows.map((r, ri) => `<w:tr>${ri === 0 ? "<w:trPr><w:tblHeader/></w:trPr>" : ""}${r.map((c, ci) => cell(c, widths[ci], { header: ri === 0, fill: ci === 0 && ri > 0 ? firstColFill : "" })).join("")}</w:tr>`).join("");
  return `<w:tbl><w:tblPr><w:tblW w:w="${widths.reduce((a, b) => a + b, 0)}" w:type="dxa"/><w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders><w:tblLayout w:type="fixed"/><w:tblCellMar><w:left w:w="80" w:type="dxa"/><w:right w:w="80" w:type="dxa"/></w:tblCellMar></w:tblPr><w:tblGrid>${grid}</w:tblGrid>${trs}</w:tbl>`;
}
const fit = (total, ratios) => { const sum = ratios.reduce((a, b) => a + b, 0); return ratios.map((r) => Math.floor((total * r) / sum)); };

function documentXml() {
  const total = 15398; // A4 landscape, 0.5 inch margins, in twips
  const heading = (t) => para(t, { bold: true, size: 28, color: "1F2937", after: 120 });
  const series = SERIES_FIELDS.map((f) => [f.label, f.example, `${f.note}${f.options ? ` Allowed: ${f.options.join(" / ")}.` : ""}`]);
  const body = [
    para("Test Series Import Template", { bold: true, size: 40, after: 120 }),
    para("How to use: 1) Fill the three tables below. 2) Save the file as .docx. 3) In the admin portal choose Create Test Series > Import from file and upload it. 4) Review the draft, then save it or publish.", { after: 60 }),
    para("Keep the tables and their header rows as they are; add or delete rows freely. Text outside the tables is ignored. The sample rows show the format: replace or delete them.", { after: 200 }),
    heading("1. Series details"),
    para(SERIES_NOTES, { size: 18, color: "4B5563" }),
    table([["Field", "Your answer", "Notes"], ...series], fit(total, [3, 5, 8]), { firstColFill: "F3F4F6" }),
    para("", { after: 200 }),
    heading("2. Tests"),
    ...TEST_NOTES.map((n) => para(n, { size: 18, color: "4B5563", after: 20 })),
    para("", { after: 60 }),
    table([TEST_COLUMNS.map((c) => c.label), ...[0, 1].map((i) => TEST_COLUMNS.map((c) => c.example[i]))], fit(total, [4, 2, 2, 2, 2, 4, 2, 3, 3])),
    para("", { after: 200 }),
    heading("3. Questions"),
    ...QUESTION_NOTES.map((n) => para(n, { size: 18, color: "4B5563", after: 20 })),
    para("", { after: 60 }),
    table([QUESTION_HEADERS_WORD, ...QUESTION_SAMPLE], fit(total, [3, 6, 3, 3, 3, 3, 2, 1.5, 1.5, 2.5, 2, 2, 2.5, 5])),
  ].join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="${W_NS}"><w:body>${body}<w:sectPr><w:pgSz w:w="16838" w:h="11906" w:orient="landscape"/><w:pgMar w:top="720" w:right="720" w:bottom="720" w:left="720" w:header="360" w:footer="360" w:gutter="0"/></w:sectPr></w:body></w:document>`;
}

// type: "blob" (browser download) or "uint8array" (tests).
export async function buildSeriesDocxTemplate(type = "blob") {
  const bytes = zipStore([
    { name: "[Content_Types].xml", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>' },
    { name: "_rels/.rels", text: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>' },
    { name: "word/document.xml", text: documentXml() },
  ]);
  return type === "blob" ? new Blob([bytes], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" }) : bytes;
}

export const DOCX_MAX_BYTES = 5 * 1024 * 1024;

// word/document.xml -> tables (arrays of rows of cell text). Nested tables are ignored.
export function docxXmlToTables(xml) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  if (doc.getElementsByTagName("parsererror").length) throw new Error("bad xml");
  const direct = (el, name) => [...el.childNodes].filter((n) => n.localName === name && n.namespaceURI === W_NS);
  const cellText = (tc) => {
    const out = [];
    const walk = (node, parts) => {
      for (const n of node.childNodes) {
        if (n.namespaceURI !== W_NS) continue;
        if (n.localName === "t") parts.push(n.textContent);
        else if (n.localName === "tab") parts.push("\t");
        else if (n.localName === "br" || n.localName === "cr") parts.push("\n");
        else if (n.localName !== "tbl") walk(n, parts);
      }
    };
    const paragraphs = [];
    const collect = (node) => {
      for (const n of node.childNodes) {
        if (n.namespaceURI !== W_NS || n.localName === "tbl") continue;
        if (n.localName === "p") { const parts = []; walk(n, parts); paragraphs.push(parts.join("")); } else collect(n);
      }
    };
    collect(tc);
    out.push(paragraphs.join("\n"));
    return out[0].trim();
  };
  const tables = [];
  const isNested = (tbl) => { for (let p = tbl.parentNode; p; p = p.parentNode) if (p.localName === "tbl" && p.namespaceURI === W_NS) return true; return false; };
  for (const tbl of doc.getElementsByTagNameNS(W_NS, "tbl")) {
    if (isNested(tbl)) continue;
    tables.push(direct(tbl, "tr").map((tr) => direct(tr, "tc").map(cellText)));
  }
  return tables;
}

export async function docxToImport(buffer) {
  let tables;
  try {
    const xml = await unzipText(buffer, "word/document.xml");
    if (xml === null) throw new Error("no document");
    tables = docxXmlToTables(xml);
  } catch {
    return { kind: "error", error: "This does not look like a .docx file. Open it in Word and use File > Save As > Word Document (.docx), or download the template again." };
  }
  const pick = { series: null, tests: null, questions: null };
  for (const t of tables) {
    const head = (t[0] || []).map(norm);
    if (!head.length) continue;
    if (head.includes("question") && !pick.questions) pick.questions = t;
    else if (head[0] === "field" && !pick.series) pick.series = t;
    else if (head.includes("testname") && !pick.tests) pick.tests = t;
  }
  if (!pick.questions) return { kind: "error", error: 'No Questions table found. Use the Word template: the questions table has a header row with "Question", "Option A" and so on.' };
  return assemble({
    seriesPairs: pick.series ? pick.series.slice(1).map((r) => [r[0], r[1]]) : [],
    testTable: pick.tests,
    questionTable: pick.questions,
  });
}

// ------------------------------------------------------------------ CSV I/O

// A CSV with [SERIES]/[TESTS]/[QUESTIONS] markers -> a full import;
// otherwise { kind: "questions" } so the caller keeps the old behaviour.
export function csvToImport(text) {
  const table = parseCsv(text);
  if (!table.some((r) => SECTION_RE.test(String(r[0] ?? "").trim()))) return { kind: "questions" };
  const sections = {};
  let cur = null;
  for (const r of table) {
    const m = SECTION_RE.exec(String(r[0] ?? "").trim());
    if (m) { cur = m[1].toLowerCase(); sections[cur] = []; } else if (cur) sections[cur].push(r);
  }
  if (!sections.questions) return { kind: "error", error: "No [QUESTIONS] section found. Download the template to see the layout." };
  const notNote = (r) => !/^note:/i.test(String(r[0] ?? "").trim());
  return assemble({
    seriesPairs: (sections.series || []).filter((r) => norm(r[0]) !== "field").map((r) => [r[0], r[1]]),
    testTable: sections.tests ? sections.tests.filter(notNote) : null,
    questionTable: sections.questions,
  });
}

// ------------------------------------------------------------- value parsing

const pad = (n) => String(n).padStart(2, "0");
function validYmd(y, m, d) {
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}
// "2026-12-31", "31/12/2026", "31-12-26" (day first, as in India) -> "2026-12-31"; "" empty; null unreadable.
export function parseDate(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  let y; let m; let d;
  let hit = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?!\d)/);
  if (hit) { y = +hit[1]; m = +hit[2]; d = +hit[3]; } else {
    hit = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2}|\d{4})(?!\d)/);
    if (!hit) return null;
    d = +hit[1]; m = +hit[2]; y = +hit[3]; if (y < 100) y += 2000;
  }
  return validYmd(y, m, d) ? `${y}-${pad(m)}-${pad(d)}` : null;
}
// -> "2026-12-31T09:30" (the datetime-local format), "" empty, null unreadable.
export function parseDateTime(v) {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const date = parseDate(s);
  if (date === null || date === "") return null;
  const t = s.match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  let hh = t ? +t[1] : 0;
  const mm = t ? +t[2] : 0;
  if (t && t[3]) { hh = hh % 12 + (/pm/i.test(t[3]) ? 12 : 0); }
  if (hh > 23 || mm > 59) return null;
  return `${date}T${pad(hh)}:${pad(mm)}`;
}
const wholeNumber = (v) => (/^\d+$/.test(String(v).trim()) ? Number(v) : null);
const splitList = (v) => String(v ?? "").split(/[|;,\n]/).map((x) => x.trim()).filter(Boolean);
const toHtml = (text) => String(text ?? "").split(/\n+/).map((l) => l.trim()).filter(Boolean)
  .map((l) => `<p>${l.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]))}</p>`).join("");
const yesNo = (v) => (/^(not|no|false|n|0|disallow)/i.test(v) ? false : /^(yes|y|true|allow|1|on)/i.test(v) ? true : null);

// ------------------------------------------------------------ series fields

export function seriesFromPairs(pairs) {
  const raw = {};
  const unknown = [];
  pairs.forEach(([k, v]) => {
    if (!String(k ?? "").trim()) return;
    const key = FIELD_LOOKUP[norm(k)];
    if (key) raw[key] = String(v ?? "").trim(); else unknown.push(String(k).trim());
  });
  const warnings = [];
  const choice = (key, options) => {
    const v = raw[key];
    if (!v) return "";
    const hit = options.find((o) => normalizeText(o) === normalizeText(v));
    if (hit) return hit;
    warnings.push(`${FIELD_LABEL[key]} "${v}" is not one of: ${options.join(", ")}. Pick it in the wizard.`);
    return "";
  };
  const date = (key) => {
    const d = parseDate(raw[key]);
    if (d === null) warnings.push(`${FIELD_LABEL[key]} "${raw[key]}" is not a date. Use YYYY-MM-DD.`);
    return d || "";
  };

  const base = initialWizardState();
  const paid = /paid/i.test(raw.pricing || "") && !/free/i.test(raw.pricing || "");
  const price = raw.price ? String(raw.price).replace(/[^\d.]/g, "") : "";
  if (!paid && Number(price) > 0) warnings.push("A price was given but the series is Free, so the price is ignored.");

  const langs = [];
  splitList(raw.languages).forEach((l) => {
    const name = BASE_LANGUAGES.find((b) => b.toLowerCase() === l.toLowerCase()) || l.charAt(0).toUpperCase() + l.slice(1);
    if (!langs.some((x) => x.toLowerCase() === name.toLowerCase())) langs.push(name);
  });

  const a = { ...base.availability };
  a.goLive = /sched/i.test(raw.goLive || "") ? "schedule" : "now";
  if (a.goLive === "schedule") {
    const dt = parseDateTime(raw.goLiveAt);
    if (dt === null) warnings.push(`Go-live date and time "${raw.goLiveAt}" is not readable. Use YYYY-MM-DD HH:MM.`);
    a.goLiveAt = dt || "";
  }
  const openAt = date("openAt");
  const closeAt = date("closeAt");
  const windowWord = /window|date|close/i.test(raw.access || "") && !/always/i.test(raw.access || "");
  a.mode = windowWord || (!raw.access && (openAt || closeAt)) ? "window" : "always";
  if (a.mode === "window") { a.openAt = openAt; a.closeAt = closeAt; }
  [["monthlyLimit", "monthlyLimited", "Monthly access limit"], ["accessDays", "accessLimited", "Access duration"]].forEach(([k, flag, label]) => {
    const v = raw[k];
    if (!v) return;
    const n = wholeNumber(v);
    if (n && n >= 1) { a[flag] = true; a[k] = n; } else if (!/^(unlimited|lifetime|none|no|-)$/i.test(v)) warnings.push(`${label} "${v}" must be a whole number of 1 or more, or blank. It was left unlimited.`);
  });

  const late = { ...base.lateSubmissions };
  if (raw.lateAllowed) {
    const yn = yesNo(raw.lateAllowed);
    if (yn === null) warnings.push(`Late submissions "${raw.lateAllowed}" must be Allowed or Not allowed.`); else late.allowed = yn;
  }
  if (late.allowed && raw.graceMinutes) {
    const n = wholeNumber(raw.graceMinutes);
    if (n && n > 0) late.graceMinutes = n; else warnings.push(`Late grace period "${raw.graceMinutes}" must be a whole number of minutes.`);
  }

  const series = {
    name: raw.name || "",
    about: toHtml(raw.about),
    whoFor: raw.whoFor || "",
    audience: choice("audience", AUDIENCE_OPTIONS),
    syllabus: raw.syllabus || "",
    pricing: paid ? PRICING_TYPE.PAID : PRICING_TYPE.FREE,
    price: paid ? price : "",
    classification: {
      grade: choice("grade", GRADE_OPTIONS), subject: choice("subject", CLASS_SUBJECT_OPTIONS),
      exam: choice("exam", EXAM_OPTIONS), difficulty: choice("level", LEVEL_OPTIONS), languages: langs,
    },
    buildDeadline: date("buildDeadline"),
    availability: a,
    lateSubmissions: late,
  };
  const missing = [];
  if (!series.name.trim()) missing.push("Series name");
  if (!series.audience) missing.push("Target audience");
  if (!series.classification.grade) missing.push("Class / Grade");
  if (!series.classification.subject) missing.push("Subject");
  if (!series.classification.exam) missing.push("Exam / Goal");
  if (!series.classification.difficulty) missing.push("Difficulty level");
  if (!langs.length) missing.push("Languages");
  if (paid && !(Number(price) > 0)) missing.push("Price");
  if (unknown.length) warnings.push(`Ignored unknown row${unknown.length === 1 ? "" : "s"}: ${unknown.join(", ")}.`);
  return { series, warnings, missing };
}

// -------------------------------------------------------------------- tests

function testsFromTable(table, warnings) {
  if (!table || table.length < 2) return [];
  const header = table[0].map((h) => TEST_ALIASES[norm(h)] || null);
  const out = [];
  table.slice(1).forEach((cells, idx) => {
    const r = {};
    header.forEach((key, i) => { if (key) r[key] = String(cells[i] ?? "").trim(); });
    if (Object.values(r).every((v) => !v)) return;
    const row = `Tests row ${idx + 1}`;
    if (!r.name) { warnings.push(`${row}: no test name, so the row was skipped.`); return; }
    const t = emptyTest(r.name);
    if (r.duration) {
      const n = wholeNumber(r.duration);
      if (n && n > 0) t.duration = n; else warnings.push(`${r.name}: duration "${r.duration}" must be a whole number of minutes. Using 60.`);
    } else warnings.push(`${r.name}: no duration given. Using 60 minutes.`);
    if (r.passingPercent) {
      const n = Number(String(r.passingPercent).replace("%", ""));
      if (Number.isFinite(n) && n >= 0 && n <= 100) t.passingPercent = n; else warnings.push(`${r.name}: passing % "${r.passingPercent}" must be 0 to 100. Using 40.`);
    }
    if (r.attemptLimit) {
      const n = wholeNumber(r.attemptLimit);
      if (n && n >= 1) t.attemptLimit = n; else warnings.push(`${r.name}: attempts "${r.attemptLimit}" must be 1 or more. Using 1.`);
    }
    if (r.answerUpload) {
      const n = wholeNumber(r.answerUpload);
      if (n !== null && n <= 120) t.answerUploadMinutes = uploadMinutes(n); else warnings.push(`${r.name}: answer upload "${r.answerUpload}" must be 0 to 120 minutes. Using 15.`);
    }
    t.topics = splitList(r.topics);
    if (/custom/i.test(r.windowMode || "")) {
      const openAt = parseDateTime(r.windowOpen);
      const closeAt = parseDateTime(r.windowClose);
      if (openAt === null || closeAt === null) warnings.push(`${r.name}: window times must look like YYYY-MM-DD HH:MM.`);
      t.window = { mode: "custom", openAt: openAt || "", closeAt: closeAt || "" };
    }
    out.push(t);
  });
  return out;
}

// ----------------------------------------------------------------- assemble

function assemble({ seriesPairs, testTable, questionTable }) {
  const { rows, error } = tableToQuestionRows(questionTable, 1);
  if (error) return { kind: "error", error };
  const { series, warnings, missing } = seriesFromPairs(seriesPairs);
  const tests = testsFromTable(testTable, warnings);
  const names = new Set();
  tests.forEach((t) => {
    const k = normalizeText(t.name);
    if (names.has(k)) warnings.push(`Two tests are named "${t.name}". Rename one in the Structure step.`);
    names.add(k);
  });
  return { kind: "series", series, tests, rows, warnings, missing };
}

// The wizard-state patch for the rows that validated (report = validateCsvRows output).
export function buildSeriesFromImport(imp, report) {
  const warnings = [...imp.warnings];
  const tests = imp.tests.map((t) => ({ ...t, questions: [] }));
  const byName = new Map(tests.map((t) => [normalizeText(t.name), t]));
  let unassigned = 0;
  report.filter((r) => r.status === ROW_STATUS.VALID).forEach((r) => {
    let t;
    const key = normalizeText(r.test);
    if (key) {
      t = byName.get(key);
      if (!t) {
        t = emptyTest(r.test.trim());
        tests.push(t);
        byName.set(key, t);
        warnings.push(`Test "${r.test.trim()}" is not in the Tests table. It was created with default settings.`);
      }
    } else {
      if (!tests.length) { t = emptyTest("Imported questions"); tests.push(t); byName.set(normalizeText(t.name), t); } else t = tests[0];
      unassigned += 1;
    }
    t.questions.push(r.parsed);
  });
  if (unassigned && tests.length > 1) warnings.push(`${unassigned} question${unassigned === 1 ? " has" : "s have"} no Test value and went into "${tests[0].name}".`);
  return { patch: { ...imp.series, tests }, warnings };
}
