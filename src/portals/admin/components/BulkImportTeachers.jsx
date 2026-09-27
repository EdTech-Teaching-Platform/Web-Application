// Bulk teacher onboarding — "Import from CSV/Excel" mode of the Add
// Teacher modal (see EducatorVerification.jsx). Reads the uploaded file
// entirely client-side as plain CSV text (see parseCsv below) — no
// SheetJS/CDN dependency (that script was never actually wired into
// index.html, which is why every upload used to fail with "the import
// library hasn't finished loading"), no backend, no npm dependency.
// A file is still accepted whether it's named .csv or .xlsx — an
// admin's "Excel" export is very often just CSV content saved with an
// .xlsx extension, so we parse the raw text either way rather than
// trying to decode a real binary .xlsx workbook. Previews + validates
// every row, then imports the valid rows through the same addEducator()
// store used by the individual "Add Teacher" form — but unlike that
// form's immediately-active/verified default, bulk-imported teachers are
// seeded inactive + verification pending (see handleImportTeachers
// below), since they haven't accepted an invite yet. "Send Invites" has
// no email backend yet, so it simulates a send and shows a per-teacher
// status instead of silently pretending to succeed.

import { useMemo, useRef, useState } from "react";
import { addEducator } from "../data/educatorsMock";
import { IconUpload, IconDownload, IconCheck, IconSend } from "./icons";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s\-().]{7,}$/;

const SAMPLE_ROWS = [
  { Name: "Ananya Sharma", "Phone Number": "+91 98765 43210", Email: "ananya.sharma@example.com" },
  { Name: "Rohit Verma", "Phone Number": "+91 91234 56789", Email: "rohit.verma@example.com" },
  { Name: "Kavya Iyer", "Phone Number": "+91 90000 11223", Email: "kavya.iyer@example.com" },
];

// Small hand-rolled CSV parser (handles quoted fields, embedded commas/
// newlines, and doubled-quote escaping — the same convention csvEscape()
// below uses when writing the sample template) so reading a file never
// depends on an external library being loaded.
function parseCsv(text) {
  const src = text.replace(/^\uFEFF/, ""); // strip a UTF-8 BOM if present
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < src.length; i += 1) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      field = "";
      rows.push(row);
      row = [];
    } else if (ch === "\r") {
      // ignore — a following \n (or none, for a bare \r) ends the line
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  // Drop trailing fully-blank lines (e.g. a trailing newline in the file).
  while (rows.length > 0 && rows[rows.length - 1].every((cell) => cell.trim() === "")) {
    rows.pop();
  }
  if (rows.length === 0) return [];

  const headers = rows[0].map((h) => h.trim());
  return rows.slice(1).map((cells) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = cells[idx] !== undefined ? cells[idx] : "";
    });
    return obj;
  });
}

function normalizeRows(json) {
  return json
    .map((row, i) => {
      const keys = Object.keys(row);
      const findKey = (...names) => keys.find((k) => names.includes(k.trim().toLowerCase()));
      const nameKey = findKey("name", "teacher name", "full name");
      const phoneKey = findKey("phone number", "phone", "phone no", "mobile", "contact", "contact number");
      const emailKey = findKey("email", "email address", "email id");
      return {
        rowNumber: i + 2, // header row is line 1
        name: nameKey ? String(row[nameKey]).trim() : "",
        phone: phoneKey ? String(row[phoneKey]).trim() : "",
        email: emailKey ? String(row[emailKey]).trim() : "",
      };
    })
    .filter((r) => r.name || r.phone || r.email);
}

function validateRow(row) {
  const errors = [];
  if (!row.name) errors.push("Name missing");
  if (!row.phone) errors.push("Phone missing");
  else if (!PHONE_RE.test(row.phone)) errors.push("Invalid phone");
  if (!row.email) errors.push("Email missing");
  else if (!EMAIL_RE.test(row.email)) errors.push("Invalid email");
  return errors;
}

export default function BulkImportTeachers({ onClose, setToast }) {
  const fileInputRef = useRef(null);
  const [step, setStep] = useState("upload"); // upload | preview | done
  const [fileName, setFileName] = useState("");
  const [fileError, setFileError] = useState("");
  const [rows, setRows] = useState([]);
  const [imported, setImported] = useState([]); // [{ id, name, email, inviteStatus }]
  const [sendingInvites, setSendingInvites] = useState(false);
  const [invitesDone, setInvitesDone] = useState(false);

  const rowsWithValidation = useMemo(() => rows.map((r) => ({ ...r, errors: validateRow(r) })), [rows]);
  const validRows = rowsWithValidation.filter((r) => r.errors.length === 0);
  const invalidCount = rowsWithValidation.length - validRows.length;

  // Plain-CSV template, built by hand with no dependency on the SheetJS
  // CDN script — that script can take a moment to load (or fail to load
  // at all on a slow/blocked connection), which made this button silently
  // do nothing before. A hand-built CSV blob + object URL always works,
  // and .csv is also the one format we hand back here: the dropzone still
  // accepts an admin's own .csv OR .xlsx upload (parsed via SheetJS,
  // below), but the sample we hand them is always the plain, dependency-
  // free format.
  const csvEscape = (value) => {
    const str = String(value ?? "");
    return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
  };

  const downloadTemplate = () => {
    const headers = ["Name", "Phone Number", "Email"];
    const lines = [
      headers.join(","),
      ...SAMPLE_ROWS.map((row) => headers.map((h) => csvEscape(row[h])).join(",")),
    ];
    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "teacher_import_template.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const openFilePicker = () => fileInputRef.current?.click();

  const handleFile = async (file) => {
    if (!file) return;
    setFileError("");
    setFileName(file.name);
    try {
      const text = await file.text();
      const json = parseCsv(text);
      const normalized = normalizeRows(json);
      if (normalized.length === 0) {
        setFileError('No rows found. Make sure the file has "Name", "Phone Number" and "Email" columns.');
        return;
      }
      setRows(normalized);
      setStep("preview");
    } catch (err) {
      setFileError("Couldn't read this file. Make sure it's a valid CSV-formatted .csv or .xlsx file.");
    }
  };

  const handleFileInputChange = (e) => {
    const file = e.target.files?.[0];
    handleFile(file);
    e.target.value = "";
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    handleFile(file);
  };

  const resetToUpload = () => {
    setRows([]);
    setFileName("");
    setFileError("");
    setStep("upload");
  };

  // "Import N Teachers" only stages the parsed rows locally — it does
  // NOT create anything in the Educator Management store yet. A teacher
  // is only added there the moment "Send Invites" actually fires (see
  // handleSendInvites below): that's the point the admin has committed
  // to onboarding them, so that's when they should first appear on the
  // Educator Management page (as inactive, pending verification).
  const handleImportTeachers = () => {
    if (validRows.length === 0) return;
    const staged = validRows.map((r, i) => ({
      tempId: `staged-${i}`,
      id: null,
      name: r.name.trim(),
      email: r.email,
      phone: r.phone,
      inviteStatus: "not_sent",
    }));
    setImported(staged);
    setToast(`${staged.length} teacher${staged.length === 1 ? "" : "s"} parsed from "${fileName}". Click "Send Invites" to add them to Educator Management.`);
    setStep("done");
  };

  const handleSendInvites = async () => {
    setSendingInvites(true);
    setImported((list) => list.map((t) => ({ ...t, inviteStatus: "sending" })));
    for (const t of imported) {
      // eslint-disable-next-line no-await-in-loop
      await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 300));
      const parts = t.name.split(/\s+/);
      const firstName = parts[0];
      const lastName = parts.slice(1).join(" ") || "-";
      // This is the actual moment the teacher is created in Educator
      // Management — not at "Import Teachers" above — starting inactive
      // with verification pending, since they haven't accepted the
      // invite yet.
      const edu = addEducator({
        firstName,
        lastName,
        email: t.email,
        phone: t.phone,
        gender: "",
        dob: "",
        subjects: [],
        qualification: "Not provided — imported via bulk onboarding",
        years: 0,
        accountStatus: "inactive",
        verificationStatus: "pending",
      });
      setImported((list) =>
        list.map((x) => (x.tempId === t.tempId ? { ...x, id: edu.id, name: edu.name, inviteStatus: "sent" } : x))
      );
    }
    setSendingInvites(false);
    setInvitesDone(true);
    setToast(`Invitations sent to ${imported.length} teacher${imported.length === 1 ? "" : "s"}. They now appear in Educator Management as inactive, pending verification.`);
  };

  return (
    <div className="ul-edu-import">
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.xlsx"
        onChange={handleFileInputChange}
        style={{ display: "none" }}
      />

      {step === "upload" && (
        <>
          <div
            className="ul-edu-import-dropzone"
            onClick={openFilePicker}
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <IconUpload size={22} color="var(--color-primary)" />
            <p className="ul-edu-import-dropzone__title">Click to browse, or drag a file here</p>
            <p className="ul-edu-import-dropzone__hint">Accepts .csv (an .xlsx file works too, as long as it's saved as plain CSV) — columns: Name, Phone Number, Email</p>
          </div>

          {fileError && <div className="ul-edu-import-banner is-error">{fileError}</div>}

          <button type="button" className="ul-edu-import-sample-btn" onClick={downloadTemplate}>
            <IconDownload size={13} /> Download Sample Template
          </button>

          <div className="ul-usr-review-modal__actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={onClose}>Back</button>
          </div>
        </>
      )}

      {step === "preview" && (
        <>
          <div className="ul-edu-import-summary">
            <span><strong>{fileName}</strong> · {rowsWithValidation.length} row{rowsWithValidation.length === 1 ? "" : "s"} found</span>
            <span className="ul-edu-import-summary__counts">
              <span className="ul-status-badge is-approved">{validRows.length} valid</span>
              {invalidCount > 0 && <span className="ul-status-badge is-rejected">{invalidCount} needs fixing</span>}
            </span>
          </div>

          <div className="ul-edu-import-table-scroll">
            <table className="ul-edu-table ul-edu-import-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Phone Number</th>
                  <th>Email</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {rowsWithValidation.map((r) => (
                  <tr key={r.rowNumber}>
                    <td data-label="Name">{r.name || <em>—</em>}</td>
                    <td data-label="Phone Number">{r.phone || <em>—</em>}</td>
                    <td data-label="Email">{r.email || <em>—</em>}</td>
                    <td data-label="Status">
                      {r.errors.length === 0 ? (
                        <span className="ul-status-badge is-approved">Valid</span>
                      ) : (
                        <>
                          <span className="ul-status-badge is-rejected">Fix required</span>
                          <div className="ul-edu-import-errlist">{r.errors.join(", ")}</div>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="ul-usr-review-modal__actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={resetToUpload}>Choose a different file</button>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={onClose}>Cancel</button>
            <button
              type="button"
              className="ul-btn ul-btn--primary"
              disabled={validRows.length === 0}
              onClick={handleImportTeachers}
            >
              Import {validRows.length || ""} Teacher{validRows.length === 1 ? "" : "s"}
            </button>
          </div>
        </>
      )}

      {step === "done" && (
        <>
          <div className={`ul-edu-import-banner ${invitesDone ? "is-success" : "is-pending"}`}>
            {invitesDone ? (
              <>
                <IconCheck size={14} /> {imported.length} teacher{imported.length === 1 ? "" : "s"} imported as inactive accounts, pending verification.
              </>
            ) : (
              <>
                <IconSend size={14} /> {imported.length} teacher{imported.length === 1 ? "" : "s"} parsed and ready — click "Send Invites" to add {imported.length === 1 ? "them" : "them"} to Educator Management.
              </>
            )}
          </div>

          <div className="ul-edu-import-table-scroll">
            <table className="ul-edu-table ul-edu-import-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Invite Status</th>
                </tr>
              </thead>
              <tbody>
                {imported.map((t) => (
                  <tr key={t.tempId || t.id}>
                    <td data-label="Name">{t.name}</td>
                    <td data-label="Email">{t.email}</td>
                    <td data-label="Invite Status">
                      {t.inviteStatus === "not_sent" && <span className="ul-status-badge is-pending">Not sent</span>}
                      {t.inviteStatus === "sending" && <span className="ul-status-badge is-pending">Sending…</span>}
                      {t.inviteStatus === "sent" && <span className="ul-status-badge is-approved">Sent</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!invitesDone && (
            <p className="ul-edu-import-note">
              These teachers aren't added to Educator Management yet — that happens the moment you click "Send Invites" below (no email service is connected yet, so sending is simulated, but every teacher's status updates live).
            </p>
          )}

          <div className="ul-usr-review-modal__actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={onClose}>Close</button>
            {!invitesDone && (
              <button type="button" className="ul-btn ul-btn--primary" disabled={sendingInvites} onClick={handleSendInvites}>
                <IconSend size={13} /> {sendingInvites ? "Sending Invites…" : "Send Invites"}
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
