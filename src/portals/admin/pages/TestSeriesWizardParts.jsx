// Building blocks for the Test Series creation wizard: modal shell, rich-text
// editor, question editor, CSV importer, and the
// template-based outline builder. Pure UI over data/testSeriesWizard.js.

import QuestionImageField from "../components/QuestionImageField";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { IconClose, IconUpload, IconDownload, IconSearch } from "../components/icons";
import { DIFFICULTY, DIFFICULTY_LABEL, SUBJECT_OPTIONS } from "../data/testSeriesMock";
import { QTYPE, SUBJECTIVE_BLOCKED_MESSAGE, isBlockedQuestionType, questionTypeLabel, validateQuestionDraft } from "../data/questionTypes";
import QuestionTypePicker, { QuestionAnswerFields } from "../components/QuestionTypePicker";
import ComingSoonBadge from "../components/ComingSoonBadge";
import {
  emptyQuestion, cloneQuestion, csvToRows, validateCsvRows, ROW_STATUS, CSV_TEMPLATE,
  generateOutline, topicSuggestions, OUTLINE_TYPES, OUTLINE_DIFFICULTY, wid,
} from "../data/testSeriesWizard";

// ------------------------------------------------------------------ Modal

export function WizModal({ title, subtitle, onClose, children, footer, wide }) {
  return (
    <div className="ul-tsw-backdrop" onClick={onClose}>
      <div className={`ul-tsw-modal${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <div className="ul-tsw-modal__head">
          <div>
            <h3>{title}</h3>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" className="ul-tsw-iconbtn" onClick={onClose} aria-label="Close"><IconClose size={16} /></button>
        </div>
        <div className="ul-tsw-modal__body">{children}</div>
        {footer && <div className="ul-tsw-modal__foot">{footer}</div>}
      </div>
    </div>
  );
}

// -------------------------------------------------------------- Rich text

const ALLOWED = new Set(["B", "STRONG", "I", "EM", "U", "UL", "OL", "LI", "BR", "P", "DIV", "H3"]);
export function sanitizeHtml(html) {
  if (!html) return "";
  const doc = new DOMParser().parseFromString(`<div>${html}</div>`, "text/html");
  const root = doc.body.firstChild;
  const walk = (node) => {
    Array.from(node.childNodes).forEach((ch) => {
      if (ch.nodeType === 3) return;
      if (ch.nodeType !== 1 || ch.tagName === "SCRIPT" || ch.tagName === "STYLE") { node.removeChild(ch); return; }
      if (!ALLOWED.has(ch.tagName)) {
        walk(ch);
        while (ch.firstChild) node.insertBefore(ch.firstChild, ch);
        node.removeChild(ch);
      } else {
        Array.from(ch.attributes).forEach((a) => ch.removeAttribute(a.name));
        walk(ch);
      }
    });
  };
  walk(root);
  return root.innerHTML;
}

export function RichText({ value, onChange, placeholder }) {
  const ref = useRef(null);
  useEffect(() => {
    if (ref.current) ref.current.innerHTML = sanitizeHtml(value || "");
    // initial content only; the editor owns the DOM afterwards
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const emit = () => { if (ref.current) onChange(sanitizeHtml(ref.current.innerHTML)); };
  const cmd = (name, arg) => {
    if (!ref.current) return;
    ref.current.focus();
    document.execCommand(name, false, arg || null);
    emit();
  };
  const tools = [
    { l: "B", t: "Bold", f: () => cmd("bold"), s: { fontWeight: 800 } },
    { l: "I", t: "Italic", f: () => cmd("italic"), s: { fontStyle: "italic" } },
    { l: "U", t: "Underline", f: () => cmd("underline"), s: { textDecoration: "underline" } },
    { l: "H", t: "Heading", f: () => cmd("formatBlock", "H3") },
    { l: "• List", t: "Bulleted list", f: () => cmd("insertUnorderedList") },
    { l: "1. List", t: "Numbered list", f: () => cmd("insertOrderedList") },
  ];
  return (
    <div className="ul-tsw-rich">
      <div className="ul-tsw-rich__bar">
        {tools.map((x) => (
          <button key={x.t} type="button" title={x.t} aria-label={x.t} style={x.s} onMouseDown={(e) => e.preventDefault()} onClick={x.f}>{x.l}</button>
        ))}
      </div>
      <div ref={ref} className="ul-tsw-rich__area" contentEditable suppressContentEditableWarning data-placeholder={placeholder} onInput={emit} onBlur={emit} role="textbox" aria-multiline="true" />
    </div>
  );
}

// -------------------------------------------------------- Question editor

export function QuestionEditor({ initial, defaults, onSave, onClose }) {
  const [q, setQ] = useState(() => initial || emptyQuestion(QTYPE.MCQ_SINGLE, defaults));
  const set = (patch) => setQ((p) => ({ ...p, ...patch }));
  // Existing short / long / subjective questions can't be edited yet.
  const locked = !!initial && isBlockedQuestionType(initial.type);
  const errs = validateQuestionDraft(q);
  const switchType = (type) => setQ((p) => ({
    ...emptyQuestion(type),
    wid: p.wid, text: p.text, image: p.image, marks: p.marks, difficulty: p.difficulty, subject: p.subject, topic: p.topic, explanation: p.explanation,
  }));
  return (
    <WizModal
      title={initial ? "Edit question" : "Add question"}
      onClose={onClose}
      footer={<>
        {!locked && errs.length > 0 && <span className="ul-tsw-hint">{errs[0]}</span>}
        <button type="button" className="ul-btn ul-btn--ghost" onClick={onClose}>{locked ? "Close" : "Cancel"}</button>
        {!locked && <button type="button" className="ul-btn ul-btn--primary" disabled={errs.length > 0} onClick={() => onSave(q)}>Save question</button>}
      </>}
    >
      {locked ? (
        <div className="ul-ts-form">
          <div className="ul-ts-errors" role="status">
            <strong>{questionTypeLabel(q.type)} questions can't be edited yet.</strong> <ComingSoonBadge />
            <p>{SUBJECTIVE_BLOCKED_MESSAGE} Remove this question from the test before saving the series.</p>
          </div>
          <p className="ul-tsw-clip">{q.text}</p>
        </div>
      ) : (
        <div className="ul-ts-form">
          <QuestionTypePicker variant="pills" value={q.type} onChange={switchType} />
          <div className="ul-ts-form-row">
            <label htmlFor="wq-text">Question</label>
            <textarea id="wq-text" value={q.text} onChange={(e) => set({ text: e.target.value })} placeholder="Type the question" />
          </div>
          <QuestionImageField value={q.image} onChange={(image) => set({ image })} />
          <QuestionAnswerFields q={q} onChange={set} />
          <div className="ul-ts-form-grid-2">
            <div className="ul-ts-form-row">
              <label htmlFor="wq-marks">Marks</label>
              <input id="wq-marks" type="number" min="0" value={q.marks} onChange={(e) => set({ marks: e.target.value })} />
            </div>
            <div className="ul-ts-form-row">
              <label htmlFor="wq-negative">Negative marks</label>
              <input id="wq-negative" type="number" min="0" value={q.negativeMarks} onChange={(e) => set({ negativeMarks: e.target.value })} />
            </div>
            <div className="ul-ts-form-row">
              <label>Difficulty</label>
              <select value={q.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>
                {Object.values(DIFFICULTY).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
              </select>
            </div>
            <div className="ul-ts-form-row">
              <label>Subject</label>
              <input type="text" value={q.subject} onChange={(e) => set({ subject: e.target.value })} />
            </div>
            <div className="ul-ts-form-row">
              <label>Topic</label>
              <input type="text" value={q.topic} onChange={(e) => set({ topic: e.target.value })} />
            </div>
          </div>
          <div className="ul-ts-form-row">
            <label>Explanation (optional)</label>
            <textarea value={q.explanation} onChange={(e) => set({ explanation: e.target.value })} />
          </div>
        </div>
      )}
    </WizModal>
  );
}

// ------------------------------------------------------------ CSV importer

const STATUS_LABEL = {
  [ROW_STATUS.VALID]: "Valid", [ROW_STATUS.INVALID]: "Invalid",
  [ROW_STATUS.INCOMPLETE]: "Incomplete", [ROW_STATUS.DUPLICATE]: "Duplicate",
};
const STATUS_CLASS = {
  [ROW_STATUS.VALID]: "is-approved", [ROW_STATUS.INVALID]: "is-rejected",
  [ROW_STATUS.INCOMPLETE]: "is-pending", [ROW_STATUS.DUPLICATE]: "is-verified",
};

export function CsvImporter({ existingKeys, onImport }) {
  const [text, setText] = useState("");
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState(null);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(null);
  const [flash, setFlash] = useState("");

  const report = useMemo(() => (rows ? validateCsvRows(rows, existingKeys) : []), [rows, existingKeys]);
  const counts = report.reduce((m, r) => ({ ...m, [r.status]: (m[r.status] || 0) + 1 }), {});

  const parse = (src) => {
    const res = csvToRows(src);
    setError(res.error);
    setRows(res.error ? null : res.rows);
    setEditing(null);
    setFlash("");
  };
  const onFile = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setFileName(f.name);
    const rd = new FileReader();
    rd.onload = () => { setText(String(rd.result || "")); parse(String(rd.result || "")); };
    rd.readAsText(f);
    e.target.value = "";
  };
  const downloadTemplate = () => {
    const blob = new Blob([CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "test-series-questions-template.csv"; a.click();
    URL.revokeObjectURL(url);
  };
  const patchRow = (id, patch) => setRows((rs) => rs.map((r) => (r._id === id ? { ...r, ...patch } : r)));
  const removeRow = (id) => setRows((rs) => rs.filter((r) => r._id !== id));
  const importValid = () => {
    const good = report.filter((r) => r.status === ROW_STATUS.VALID);
    if (!good.length) return;
    onImport(good.map((r) => r.question));
    const ids = new Set(good.map((r) => r._id));
    setRows((rs) => rs.filter((r) => !ids.has(r._id)));
    setFlash(`${good.length} valid question${good.length === 1 ? "" : "s"} imported. Remaining rows still need attention.`);
  };

  return (
    <div className="ul-tsw-stack">
      <div className="ul-tsw-dropzone">
        <IconUpload size={22} />
        <div>
          <strong>Upload a CSV file</strong>
          <p>Columns: question, optionA–D, correct, marks, negative, type, difficulty, subject, topic, explanation.</p>
        </div>
        <div className="ul-tsw-row">
          <label className="ul-btn ul-btn--primary ul-tsw-filebtn">
            Choose file
            <input type="file" accept=".csv,text/csv" onChange={onFile} hidden />
          </label>
          <button type="button" className="ul-btn ul-btn--ghost" onClick={downloadTemplate}><span className="ul-tsw-inline"><IconDownload size={13} /> Template</span></button>
        </div>
      </div>
      <div className="ul-ts-form-row">
        <label>{fileName ? `Loaded: ${fileName} — or paste CSV text` : "Or paste CSV text"}</label>
        <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="question,optionA,optionB,optionC,optionD,correct,marks,..." />
        <div><button type="button" className="ul-btn ul-btn--ghost" disabled={!text.trim()} onClick={() => parse(text)}>Validate pasted text</button></div>
      </div>
      {error && <div className="ul-ts-errors"><strong>{error}</strong></div>}
      {flash && <div className="ul-tsw-note is-ok">{flash}</div>}

      {rows && (
        <div className="ul-tsw-report">
          <div className="ul-tsw-report__sum">
            {Object.values(ROW_STATUS).map((s) => (
              <span key={s} className={`ul-status-badge ${STATUS_CLASS[s]}`}>{STATUS_LABEL[s]}: {counts[s] || 0}</span>
            ))}
            <span className="ul-tsw-spacer" />
            <button type="button" className="ul-btn ul-btn--primary" disabled={!counts[ROW_STATUS.VALID]} onClick={importValid}>
              Import {counts[ROW_STATUS.VALID] || 0} valid row{(counts[ROW_STATUS.VALID] || 0) === 1 ? "" : "s"}
            </button>
          </div>
          <p className="ul-tsw-hint">Only valid rows are imported. Fix or remove the others first — nothing is imported automatically.</p>
          <div className="ul-tsw-tablewrap">
            <table className="ul-tsw-table">
              <thead><tr><th>Row</th><th>Question</th><th>Status</th><th>Issues</th><th /></tr></thead>
              <tbody>
                {report.length === 0 && <tr><td colSpan={5} className="ul-tsw-empty">No rows left.</td></tr>}
                {report.map((r) => (
                  <Fragment key={r._id}>
                    <tr>
                      <td>{r.line}</td>
                      <td className="ul-tsw-clip">{r.question || <em>(empty)</em>}</td>
                      <td><span className={`ul-status-badge ${STATUS_CLASS[r.status]}`}>{STATUS_LABEL[r.status]}</span></td>
                      <td>{r.issues.length ? r.issues.join(" ") : "—"}</td>
                      <td className="ul-tsw-actions">
                        <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setEditing(editing === r._id ? null : r._id)}>{editing === r._id ? "Done" : "Fix"}</button>
                        <button type="button" className="ul-btn ul-btn--danger" onClick={() => removeRow(r._id)}>Remove</button>
                      </td>
                    </tr>
                    {editing === r._id && (
                      <tr>
                        <td colSpan={5}>
                          <div className="ul-tsw-fixgrid">
                            <div className="ul-ts-form-row" style={{ gridColumn: "1 / -1" }}><label>Question</label><input value={r.question} onChange={(e) => patchRow(r._id, { question: e.target.value })} /></div>
                            {["optionA", "optionB", "optionC", "optionD"].map((k) => (
                              <div className="ul-ts-form-row" key={k}><label>{k.replace("option", "Option ")}</label><input value={r[k]} onChange={(e) => patchRow(r._id, { [k]: e.target.value })} /></div>
                            ))}
                            <div className="ul-ts-form-row"><label>Correct (A–D)</label><input value={r.correct} onChange={(e) => patchRow(r._id, { correct: e.target.value })} /></div>
                            <div className="ul-ts-form-row"><label>Type</label>
                              <select value={r.type || "objective"} onChange={(e) => patchRow(r._id, { type: e.target.value })}><option value="objective">objective</option><option value="subjective">subjective</option></select>
                            </div>
                            <div className="ul-ts-form-row"><label>Marks</label><input value={r.marks} onChange={(e) => patchRow(r._id, { marks: e.target.value })} /></div>
                            <div className="ul-ts-form-row"><label>Negative</label><input value={r.negative} onChange={(e) => patchRow(r._id, { negative: e.target.value })} /></div>
                            <div className="ul-ts-form-row"><label>Difficulty</label>
                              <select value={r.difficulty} onChange={(e) => patchRow(r._id, { difficulty: e.target.value })}><option value="">medium (default)</option><option value="easy">easy</option><option value="medium">medium</option><option value="hard">hard</option></select>
                            </div>
                            <div className="ul-ts-form-row"><label>Subject</label><input value={r.subject} onChange={(e) => patchRow(r._id, { subject: e.target.value })} /></div>
                            <div className="ul-ts-form-row"><label>Topic</label><input value={r.topic} onChange={(e) => patchRow(r._id, { topic: e.target.value })} /></div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ----------------------------------------------------------- Outline builder

export function OutlineBuilder({ initialSubject, initialAudience, audienceOptions, onApply }) {
  const [cfg, setCfg] = useState({
    subject: initialSubject || "", topics: [], audience: initialAudience || "", difficulty: "Mixed",
    numTests: 4, questionsPerTest: 20, types: [QTYPE.MCQ_SINGLE], marksPerQuestion: 4, duration: 40,
  });
  const [topicInput, setTopicInput] = useState("");
  const [outline, setOutline] = useState(null);
  const [seed, setSeed] = useState(0);
  const set = (patch) => setCfg((c) => ({ ...c, ...patch }));
  const suggestions = topicSuggestions(cfg.subject);

  const toggleTopic = (t) => set({ topics: cfg.topics.includes(t) ? cfg.topics.filter((x) => x !== t) : [...cfg.topics, t] });
  const addTopic = () => {
    const parts = topicInput.split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length) set({ topics: [...new Set([...cfg.topics, ...parts])] });
    setTopicInput("");
  };
  const toggleType = (t) => set({ types: cfg.types.includes(t) ? cfg.types.filter((x) => x !== t) : [...cfg.types, t] });
  const ready = cfg.subject && cfg.types.length > 0 && Number(cfg.numTests) > 0 && Number(cfg.questionsPerTest) > 0;
  const generate = (nextSeed) => { setSeed(nextSeed); setOutline(generateOutline(cfg, nextSeed)); };
  const patchItem = (id, patch) => setOutline((o) => o.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const move = (i, d) => setOutline((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const addBlank = () => setOutline((o) => [...o, { id: wid("ol"), name: `Test ${o.length + 1}`, topics: [], questionCount: Number(cfg.questionsPerTest) || 10, marksPerQuestion: Number(cfg.marksPerQuestion) || 4, duration: Number(cfg.duration) || 30, difficulty: cfg.difficulty, sections: [] }]);

  return (
    <div className="ul-tsw-stack">
      <div className="ul-tsw-note">
        <strong>Template-based suggestion — no external AI is connected.</strong> This builds an editable outline (test names, topics, counts) from your inputs. It does not write questions, and nothing is published automatically.
      </div>
      <div className="ul-ts-form-grid-2">
        <div className="ul-ts-form-row">
          <label>Subject</label>
          <select value={cfg.subject} onChange={(e) => set({ subject: e.target.value, topics: [] })}>
            <option value="">Select subject…</option>
            {SUBJECT_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
        <div className="ul-ts-form-row">
          <label>Target audience / class</label>
          <select value={cfg.audience} onChange={(e) => set({ audience: e.target.value })}>
            <option value="">Select audience…</option>
            {audienceOptions.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>
      </div>
      <div className="ul-ts-form-row">
        <label>Topics (pick suggestions or type your own, comma separated)</label>
        <div className="ul-tsw-chips">
          {[...new Set([...suggestions, ...cfg.topics])].map((t) => (
            <button key={t} type="button" className={`ul-tsw-chip${cfg.topics.includes(t) ? " is-on" : ""}`} onClick={() => toggleTopic(t)}>{t}</button>
          ))}
        </div>
        <div className="ul-tsw-row">
          <input type="text" value={topicInput} onChange={(e) => setTopicInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }} placeholder="Add topics…" style={{ flex: 1 }} />
          <button type="button" className="ul-btn ul-btn--ghost" onClick={addTopic}>Add</button>
        </div>
      </div>
      <div className="ul-ts-form-grid-2">
        <div className="ul-ts-form-row"><label>Number of tests</label><input type="number" min="1" max="30" value={cfg.numTests} onChange={(e) => set({ numTests: e.target.value })} /></div>
        <div className="ul-ts-form-row"><label>Questions per test</label><input type="number" min="1" max="200" value={cfg.questionsPerTest} onChange={(e) => set({ questionsPerTest: e.target.value })} /></div>
        <div className="ul-ts-form-row"><label>Marks per question</label><input type="number" min="1" value={cfg.marksPerQuestion} onChange={(e) => set({ marksPerQuestion: e.target.value })} /></div>
        <div className="ul-ts-form-row"><label>Duration per test (min)</label><input type="number" min="5" value={cfg.duration} onChange={(e) => set({ duration: e.target.value })} /></div>
        <div className="ul-ts-form-row"><label>Difficulty</label>
          <select value={cfg.difficulty} onChange={(e) => set({ difficulty: e.target.value })}>{OUTLINE_DIFFICULTY.map((d) => <option key={d}>{d}</option>)}</select>
        </div>
        <div className="ul-ts-form-row"><label>Question types</label>
          <div className="ul-tsw-chips">
            {OUTLINE_TYPES.map((t) => <button key={t.value} type="button" className={`ul-tsw-chip${cfg.types.includes(t.value) ? " is-on" : ""}`} onClick={() => toggleType(t.value)}>{t.label}</button>)}
          </div>
        </div>
      </div>
      <div><button type="button" className="ul-btn ul-btn--primary" disabled={!ready} onClick={() => generate(0)}>Generate outline</button></div>

      {outline && (
        <div className="ul-tsw-review">
          <div className="ul-tsw-row">
            <h4>Suggested outline ({outline.length} test{outline.length === 1 ? "" : "s"})</h4>
            <span className="ul-tsw-spacer" />
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => generate(seed + 1)}>Regenerate</button>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={addBlank}>+ Add test</button>
          </div>
          {outline.length === 0 && <p className="ul-tsw-empty">Outline is empty. Regenerate or add a test.</p>}
          {outline.map((t, i) => (
            <div key={t.id} className="ul-tsw-outlinerow">
              <span className="ul-tsw-num">{i + 1}</span>
              <div className="ul-tsw-outlinemain">
                <input value={t.name} onChange={(e) => patchItem(t.id, { name: e.target.value })} aria-label="Test name" />
                <small>{t.topics.join(", ") || "No topics"} · {t.difficulty}{t.sections.length ? ` · ${t.sections.map((s) => `${s.count} ${questionTypeLabel(s.type)}`).join(" + ")}` : ""}</small>
              </div>
              <label className="ul-tsw-mini">Qs<input type="number" min="1" value={t.questionCount} onChange={(e) => patchItem(t.id, { questionCount: Number(e.target.value) || 0 })} /></label>
              <label className="ul-tsw-mini">Min<input type="number" min="1" value={t.duration} onChange={(e) => patchItem(t.id, { duration: Number(e.target.value) || 0 })} /></label>
              <button type="button" className="ul-tsw-iconbtn" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up">↑</button>
              <button type="button" className="ul-tsw-iconbtn" disabled={i === outline.length - 1} onClick={() => move(i, 1)} aria-label="Move down">↓</button>
              <button type="button" className="ul-tsw-iconbtn" onClick={() => setOutline((o) => o.filter((x) => x.id !== t.id))} aria-label="Remove"><IconClose size={13} /></button>
            </div>
          ))}
          <div>
            <button type="button" className="ul-btn ul-btn--primary" disabled={outline.length === 0 || outline.some((t) => !t.name.trim())} onClick={() => onApply(outline, cfg)}>Use this outline</button>
            <span className="ul-tsw-hint" style={{ marginLeft: 10 }}>Creates empty draft tests. You add the questions next.</span>
          </div>
        </div>
      )}
    </div>
  );
}

