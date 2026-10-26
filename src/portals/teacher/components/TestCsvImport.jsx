// "Import CSV" for one test. Same columns, validation rules and row-by-row
// report as the admin wizard (the parsing/validation is the admin data layer
// itself), so a file that imports there imports here. Only valid rows are
// imported; nothing happens automatically.
import { Fragment, useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { AUTH_THEME_VARS } from "../../../auth/components/AuthKit";
import Button from "../../../components/ui/Button";
import { UploadIcon, XIcon } from "../../../components/ui/icons";
import { CSV_TEMPLATE, ROW_STATUS, csvToRows, normalizeText, validateCsvRows } from "../../admin/data/testSeriesWizard";
import { difficultyKey, makeId, plainToHtml, stripHtml } from "../data/testSeriesData";

const STATUS_LABEL = { [ROW_STATUS.VALID]: "Valid", [ROW_STATUS.INVALID]: "Invalid", [ROW_STATUS.INCOMPLETE]: "Incomplete", [ROW_STATUS.DUPLICATE]: "Duplicate" };
const STATUS_TONE = {
  [ROW_STATUS.VALID]: "bg-pastel-sage text-pastel-sage-ink",
  [ROW_STATUS.INVALID]: "bg-danger/15 text-danger",
  [ROW_STATUS.INCOMPLETE]: "bg-pastel-orange text-pastel-orange-ink",
  [ROW_STATUS.DUPLICATE]: "bg-pastel-lavender text-pastel-lavender-ink",
};
const field = "w-full rounded-xl border border-text/12 bg-surface px-3 py-2 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15";

// Admin wizard question (from the CSV validator) -> stored teacher question.
function toStoredQuestion(a) {
  const objective = a.type === "objective";
  const base = {
    id: makeId("q"),
    text: plainToHtml(a.text),
    points: Number(a.marks) || (objective ? 4 : 5),
    difficulty: difficultyKey({ easy: "Easy", medium: "Medium", hard: "Hard" }[a.difficulty] || "Medium"),
    subject: a.subject || "",
    topic: a.topic || "",
    explanation: a.explanation || "",
  };
  if (!objective) return { ...base, type: "long_answer", negativeMarks: 0, answerInstructions: a.rubric || "", modelAnswer: "", wordLimit: 300, rubric: [] };
  return {
    ...base,
    type: "mcq_single",
    negativeMarks: Number(a.negativeMarks) || 0,
    options: ["A", "B", "C", "D"].map((k) => ({ id: makeId("o"), text: a[`option${k}`] || "", correct: a.correctAnswer === k })),
  };
}

export default function TestCsvImport({ testTitle, existingQuestions, onImport, onClose }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [flash, setFlash] = useState("");

  const existingKeys = useMemo(() => new Set(existingQuestions.map((q) => normalizeText(stripHtml(q.text)))), [existingQuestions]);
  const report = useMemo(() => (rows ? validateCsvRows(rows, existingKeys) : []), [rows, existingKeys]);
  const counts = report.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});
  const validCount = counts[ROW_STATUS.VALID] || 0;

  function parse(src) {
    const res = csvToRows(src);
    setError(res.error);
    setRows(res.error ? null : res.rows);
    setEditing(null);
    setFlash("");
  }
  function onFile(ev) {
    const f = ev.target.files && ev.target.files[0];
    ev.target.value = "";
    if (!f) return;
    setFileName(f.name);
    const rd = new FileReader();
    rd.onload = () => {
      const t = String(rd.result || "");
      setText(t);
      parse(t);
    };
    rd.readAsText(f);
  }
  function downloadTemplate() {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "test-series-questions-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }
  const patchRow = (id, patch) => setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setRows((rs) => rs.filter((r) => r._id !== id));
  function importValid() {
    const good = report.filter((r) => r.status === ROW_STATUS.VALID);
    if (!good.length) return;
    onImport(good.map((r) => toStoredQuestion(r.question)));
    const ids = new Set(good.map((r) => r._id));
    setRows((rs) => rs.filter((r) => !ids.has(r._id)));
    setFlash(`${good.length} valid question${good.length === 1 ? "" : "s"} imported. Remaining rows still need attention.`);
  }

  // Lock page scroll and close on Escape while the dialog is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev) => ev.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Portal to <body> so no transformed ancestor can break `fixed` positioning.
  return createPortal(
    <div style={AUTH_THEME_VARS} className="font-body fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 py-8">
      <div className="fixed inset-0 bg-text/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label="Import questions from CSV" className="relative my-auto w-full max-w-4xl rounded-3xl bg-white p-6 shadow-xl sm:p-7">
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg font-semibold text-text">Import questions from CSV</h2>
            {testTitle && <p className="mt-0.5 text-sm text-muted">Adding to: {testTitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-text/40 transition-colors hover:bg-bg hover:text-text">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 rounded-2xl border border-dashed border-text/20 bg-bg p-5 sm:flex-row">
            <UploadIcon className="h-6 w-6 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">Upload a CSV file</p>
              <p className="text-xs text-muted">Columns: question, optionA–D, correct, marks, negative, type, difficulty, subject, topic, explanation.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex cursor-pointer items-center rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white shadow-soft">
                Choose file
                <input type="file" accept=".csv,text/csv" onChange={onFile} className="hidden" />
              </label>
              <Button variant="secondary" fullWidth={false} className="px-5 py-2 text-xs" onClick={downloadTemplate}>Template</Button>
            </div>
          </div>

          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text">{fileName ? `Loaded: ${fileName} — or paste CSV text` : "Or paste CSV text"}</span>
            <textarea rows={3} className="w-full rounded-2xl border border-text/12 bg-surface px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" value={text} onChange={(e) => setText(e.target.value)} placeholder="question,optionA,optionB,optionC,optionD,correct,marks,..." />
          </label>
          <div>
            <Button variant="secondary" fullWidth={false} className="px-5 py-2 text-xs" disabled={!text.trim()} onClick={() => parse(text)}>Validate pasted text</Button>
          </div>

          {error && <p role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{error}</p>}
          {flash && <p role="status" className="rounded-2xl bg-pastel-sage px-4 py-3 text-sm font-semibold text-pastel-sage-ink">{flash}</p>}

          {rows && (
            <div className="flex flex-col gap-3">
              <div className="flex flex-wrap items-center gap-2">
                {Object.values(ROW_STATUS).map((s) => (
                  <span key={s} className={`rounded-full px-3 py-1 text-xs font-semibold ${STATUS_TONE[s]}`}>{STATUS_LABEL[s]}: {counts[s] || 0}</span>
                ))}
                <span className="flex-1" />
                <Button fullWidth={false} className="px-5 py-2 text-xs" disabled={validCount === 0} onClick={importValid}>
                  Import {validCount} valid row{validCount === 1 ? "" : "s"}
                </Button>
              </div>
              <p className="text-xs text-muted">Only valid rows are imported. Fix or remove the others first — nothing is imported automatically.</p>
              <div className="overflow-x-auto rounded-2xl ring-1 ring-text/[0.08]">
                <table className="w-full min-w-[40rem] text-left text-sm">
                  <thead className="bg-bg text-xs uppercase tracking-wide text-muted">
                    <tr><th className="px-3 py-2">Row</th><th className="px-3 py-2">Question</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Issues</th><th className="px-3 py-2" /></tr>
                  </thead>
                  <tbody className="divide-y divide-text/[0.06]">
                    {report.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-muted">No rows left.</td></tr>}
                    {report.map((rr) => {
                      // The validator overwrites `question` with the parsed question; show/edit the raw CSV row instead.
                      const raw = rows.find((x) => x._id === rr._id) || rr;
                      const r = { ...raw, status: rr.status, issues: rr.issues };
                      return (
                      <Fragment key={r._id}>
                        <tr className="align-top">
                          <td className="px-3 py-2.5">{r.line}</td>
                          <td className="max-w-[16rem] truncate px-3 py-2.5">{r.question || <em>(empty)</em>}</td>
                          <td className="px-3 py-2.5"><span className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${STATUS_TONE[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                          <td className="px-3 py-2.5 text-xs text-muted">{r.issues.length ? r.issues.join(" ") : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2.5 text-right">
                            <button type="button" className="mr-2 text-xs font-bold text-primary underline" onClick={() => setEditing(editing === r._id ? null : r._id)}>{editing === r._id ? "Done" : "Fix"}</button>
                            <button type="button" className="text-xs font-bold text-danger underline" onClick={() => removeRow(r._id)}>Remove</button>
                          </td>
                        </tr>
                        {editing === r._id && (
                          <tr>
                            <td colSpan={5} className="bg-bg px-3 py-3">
                              <div className="grid gap-3 sm:grid-cols-4">
                                <label className="block sm:col-span-4"><span className="mb-1 block text-xs font-medium text-text">Question</span><input className={field} value={r.question} onChange={(e) => patchRow(r._id, { question: e.target.value })} /></label>
                                {["optionA", "optionB", "optionC", "optionD"].map((k) => (
                                  <label key={k} className="block"><span className="mb-1 block text-xs font-medium text-text">{k.replace("option", "Option ")}</span><input className={field} value={r[k]} onChange={(e) => patchRow(r._id, { [k]: e.target.value })} /></label>
                                ))}
                                <label className="block"><span className="mb-1 block text-xs font-medium text-text">Correct (A–D)</span><input className={field} value={r.correct} onChange={(e) => patchRow(r._id, { correct: e.target.value })} /></label>
                                <label className="block"><span className="mb-1 block text-xs font-medium text-text">Type</span>
                                  <select className={field} value={r.type || "objective"} onChange={(e) => patchRow(r._id, { type: e.target.value })}><option value="objective">objective</option><option value="subjective">subjective</option></select>
                                </label>
                                <label className="block"><span className="mb-1 block text-xs font-medium text-text">Marks</span><input className={field} value={r.marks} onChange={(e) => patchRow(r._id, { marks: e.target.value })} /></label>
                                <label className="block"><span className="mb-1 block text-xs font-medium text-text">Negative</span><input className={field} value={r.negative} onChange={(e) => patchRow(r._id, { negative: e.target.value })} /></label>
                                <label className="block"><span className="mb-1 block text-xs font-medium text-text">Difficulty</span>
                                  <select className={field} value={r.difficulty} onChange={(e) => patchRow(r._id, { difficulty: e.target.value })}><option value="">medium (default)</option><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></select>
                                </label>
                                <label className="block"><span className="mb-1 block text-xs font-medium text-text">Subject</span><input className={field} value={r.subject} onChange={(e) => patchRow(r._id, { subject: e.target.value })} /></label>
                                <label className="block"><span className="mb-1 block text-xs font-medium text-text">Topic</span><input className={field} value={r.topic} onChange={(e) => patchRow(r._id, { topic: e.target.value })} /></label>
                              </div>
                            </td>
                          </tr>
                        )}
                      </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}
