// Dependency-free spreadsheet file generation for the Student Management
// export: RFC 4180 CSV and a hand-written minimal .xlsx (OOXML parts inside
// a STORE-method ZIP). Everything here is pure (no React, no DOM beyond
// Blob/TextEncoder, plus an explicit downloadBlob helper) so it can be run
// and verified outside the app.

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
export const CSV_MIME = "text/csv;charset=utf-8";

// XML 1.0 forbids most C0 control characters (tab/LF/CR are allowed).
const INVALID_XML_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

function cleanText(value) {
  return String(value ?? "").replace(INVALID_XML_CHARS, "");
}

function escapeXml(value) {
  return cleanText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// -- CSV ------------------------------------------------------------------
function csvCell(value) {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

// rows: array of arrays. headers: array of strings. Returns a Blob with a
// UTF-8 BOM (so Excel detects the encoding) and CRLF line endings.
export function toCsvString(rows, headers) {
  const lines = [];
  if (headers && headers.length) lines.push(headers.map(csvCell).join(","));
  rows.forEach((r) => lines.push(r.map(csvCell).join(",")));
  return "﻿" + lines.join("\r\n") + "\r\n";
}

export function toCsv(rows, headers) {
  return new Blob([toCsvString(rows, headers)], { type: CSV_MIME });
}

// -- ZIP (STORE) ----------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

export function crc32(bytes) {
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function dosDateTime(date) {
  const year = Math.max(1980, date.getFullYear());
  return {
    time: (date.getHours() << 11) | (date.getMinutes() << 5) | (date.getSeconds() >> 1),
    date: ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate(),
  };
}

// files: [{ name: string, data: Uint8Array }] -> Uint8Array (a .zip)
export function zipStore(files, now = new Date()) {
  const encoder = new TextEncoder();
  const { time, date } = dosDateTime(now);
  const entries = files.map((f) => {
    const nameBytes = encoder.encode(f.name);
    return { nameBytes, data: f.data, crc: crc32(f.data), offset: 0 };
  });

  let localSize = 0;
  let centralSize = 0;
  entries.forEach((e) => {
    localSize += 30 + e.nameBytes.length + e.data.length;
    centralSize += 46 + e.nameBytes.length;
  });
  const out = new Uint8Array(localSize + centralSize + 22);
  const view = new DataView(out.buffer);
  let p = 0;

  entries.forEach((e) => {
    e.offset = p;
    view.setUint32(p, 0x04034b50, true);
    view.setUint16(p + 4, 20, true); // version needed
    view.setUint16(p + 6, 0x0800, true); // flags: UTF-8 file names
    view.setUint16(p + 8, 0, true); // method 0 = stored
    view.setUint16(p + 10, time, true);
    view.setUint16(p + 12, date, true);
    view.setUint32(p + 14, e.crc, true);
    view.setUint32(p + 18, e.data.length, true); // compressed size
    view.setUint32(p + 22, e.data.length, true); // uncompressed size
    view.setUint16(p + 26, e.nameBytes.length, true);
    view.setUint16(p + 28, 0, true); // extra length
    out.set(e.nameBytes, p + 30);
    p += 30 + e.nameBytes.length;
    out.set(e.data, p);
    p += e.data.length;
  });

  const centralStart = p;
  entries.forEach((e) => {
    view.setUint32(p, 0x02014b50, true);
    view.setUint16(p + 4, 20, true); // version made by
    view.setUint16(p + 6, 20, true); // version needed
    view.setUint16(p + 8, 0x0800, true);
    view.setUint16(p + 10, 0, true);
    view.setUint16(p + 12, time, true);
    view.setUint16(p + 14, date, true);
    view.setUint32(p + 16, e.crc, true);
    view.setUint32(p + 20, e.data.length, true);
    view.setUint32(p + 24, e.data.length, true);
    view.setUint16(p + 28, e.nameBytes.length, true);
    view.setUint16(p + 30, 0, true); // extra length
    view.setUint16(p + 32, 0, true); // comment length
    view.setUint16(p + 34, 0, true); // disk number start
    view.setUint16(p + 36, 0, true); // internal attrs
    view.setUint32(p + 38, 0, true); // external attrs
    view.setUint32(p + 42, e.offset, true);
    out.set(e.nameBytes, p + 46);
    p += 46 + e.nameBytes.length;
  });

  view.setUint32(p, 0x06054b50, true);
  view.setUint16(p + 4, 0, true); // this disk
  view.setUint16(p + 6, 0, true); // disk with central dir
  view.setUint16(p + 8, entries.length, true);
  view.setUint16(p + 10, entries.length, true);
  view.setUint32(p + 12, p - centralStart, true);
  view.setUint32(p + 16, centralStart, true);
  view.setUint16(p + 20, 0, true); // comment length
  return out;
}

// -- XLSX -----------------------------------------------------------------
// Excel sheet names: max 31 chars, none of [ ] : * ? / \, cannot be empty
// or start/end with an apostrophe, and must be unique case-insensitively.
export function sanitizeSheetName(name, used = new Set()) {
  let base = cleanText(name).replace(/[[\]:*?/\\]/g, " ").replace(/\s+/g, " ").trim();
  base = base.replace(/^'+|'+$/g, "").trim();
  if (!base) base = "Sheet";
  base = base.slice(0, 31).trim() || "Sheet";
  let candidate = base;
  let n = 2;
  while (used.has(candidate.toLowerCase())) {
    const suffix = ` (${n++})`;
    candidate = base.slice(0, 31 - suffix.length).trim() + suffix;
  }
  used.add(candidate.toLowerCase());
  return candidate;
}

function columnLetters(index) {
  let n = index + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

function textCell(ref, value, style) {
  const s = style ? ` s="${style}"` : "";
  return `<c r="${ref}" t="inlineStr"${s}><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
}

function sheetXml(headers, rows) {
  const matrix = [];
  if (headers && headers.length) matrix.push({ cells: headers, header: true });
  rows.forEach((r) => matrix.push({ cells: r, header: false }));
  const colCount = matrix.reduce((m, r) => Math.max(m, r.cells.length), 0);

  const widths = Array.from({ length: colCount }, (_, c) => {
    const longest = matrix.reduce((m, r) => {
      const v = r.cells[c];
      const len = v === null || v === undefined ? 0 : String(v).length;
      return Math.max(m, len);
    }, 0);
    return Math.min(60, Math.max(10, longest + 3));
  });

  const rowsXml = matrix
    .map((r, i) => {
      const cells = r.cells
        .map((v, c) => {
          const ref = `${columnLetters(c)}${i + 1}`;
          if (v === null || v === undefined || v === "") return "";
          if (!r.header && typeof v === "number" && Number.isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
          return textCell(ref, v, r.header ? 1 : 0);
        })
        .join("");
      return `<row r="${i + 1}">${cells}</row>`;
    })
    .join("");

  const lastRef = `${columnLetters(Math.max(colCount, 1) - 1)}${Math.max(matrix.length, 1)}`;
  const hasHeader = headers && headers.length;
  const view = hasHeader
    ? `<sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/><selection pane="bottomLeft" activeCell="A2" sqref="A2"/></sheetView></sheetViews>`
    : `<sheetViews><sheetView workbookViewId="0"/></sheetViews>`;
  const cols = colCount
    ? `<cols>${widths.map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join("")}</cols>`
    : "";

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<dimension ref="A1:${lastRef}"/>${view}<sheetFormatPr defaultRowHeight="15"/>${cols}` +
    `<sheetData>${rowsXml}</sheetData></worksheet>`
  );
}

const STYLES_XML =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
  `<fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts>` +
  `<fills count="3"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill>` +
  `<fill><patternFill patternType="solid"><fgColor rgb="FFF2E6DC"/><bgColor indexed="64"/></patternFill></fill></fills>` +
  `<borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders>` +
  `<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>` +
  `<cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>` +
  `<xf numFmtId="0" fontId="1" fillId="2" borderId="0" xfId="0" applyFont="1" applyFill="1"/></cellXfs>` +
  `<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

// sheets: [{ name, headers: string[], rows: (string|number|null)[][] }]
// Returns the .xlsx file as bytes.
export function buildXlsxBytes(sheets) {
  const encoder = new TextEncoder();
  const list = sheets && sheets.length ? sheets : [{ name: "Sheet1", headers: [], rows: [] }];
  const used = new Set();
  const named = list.map((s) => ({ ...s, safeName: sanitizeSheetName(s.name, used) }));

  const contentTypes =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
    `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
    `<Default Extension="xml" ContentType="application/xml"/>` +
    `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
    named
      .map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`)
      .join("") +
    `<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>` +
    `</Types>`;

  const rootRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
    `</Relationships>`;

  const workbook =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<bookViews><workbookView/></bookViews><sheets>` +
    named.map((s, i) => `<sheet name="${escapeXml(s.safeName)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join("") +
    `</sheets></workbook>`;

  const workbookRels =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    named
      .map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`)
      .join("") +
    `<Relationship Id="rId${named.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>` +
    `</Relationships>`;

  const files = [
    { name: "[Content_Types].xml", data: encoder.encode(contentTypes) },
    { name: "_rels/.rels", data: encoder.encode(rootRels) },
    { name: "xl/workbook.xml", data: encoder.encode(workbook) },
    { name: "xl/_rels/workbook.xml.rels", data: encoder.encode(workbookRels) },
    { name: "xl/styles.xml", data: encoder.encode(STYLES_XML) },
    ...named.map((s, i) => ({ name: `xl/worksheets/sheet${i + 1}.xml`, data: encoder.encode(sheetXml(s.headers, s.rows || [])) })),
  ];
  return zipStore(files);
}

export function buildXlsx(sheets) {
  return new Blob([buildXlsxBytes(sheets)], { type: XLSX_MIME });
}

// Triggers a real browser download via a temporary anchor.
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
