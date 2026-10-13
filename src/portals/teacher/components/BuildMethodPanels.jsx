// UNUSED -- no longer imported anywhere. The "Build from Course" / "Question Bank" / Duplicate / CSV / AI start paths
// were removed: test series are now built manually from scratch. Safe to delete this file.
// The four configurable build methods behind "How do you want to build this?":
// Duplicate, Import (CSV), Question bank and AI-assisted outline. Each panel is
// controlled by TestSeriesStartFlow, which decides when the series is created.
import { useEffect, useMemo, useRef, useState } from "react";
import FileDropzone from "../../../components/ui/FileDropzone";
import Select from "../../../components/ui/Select";
import Input from "../../../components/ui/Input";
import Checkbox from "../../../components/ui/Checkbox";
import Button from "../../../components/ui/Button";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import StatusBadge from "../../../components/ui/StatusBadge";
import { DownloadIcon, SparkleIcon, TrashIcon, SearchIcon, AlertTriangleIcon, CheckIcon } from "../../../components/ui/icons";
import { TS_DIFFICULTIES, questionTypeMeta, seriesQuestionCount, seriesTestCount, stripHtml } from "../data/testSeriesData";
import { BANK_SUBJECTS, bankTopics, filterBank } from "../data/questionBankData";
import { downloadTextFile, importTemplateCsv, readImportFile } from "../data/testSeriesImport";
import { generateOutline } from "../data/testSeriesBuildTools";

const selectCls = "w-full rounded-full border border-text/12 bg-surface py-2.5 pl-4 pr-10 text-sm text-text";

export function DuplicatePanel({ candidates, selectedId, onSelect }) {
  if (candidates.length === 0) {
    return <p className="rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">You don't have another series to copy yet. Pick a different method, or build this one from scratch.</p>;
  }
  return (
    <fieldset>
      <legend className="mb-2 text-sm font-medium text-text">Which series should we copy?</legend>
      <div className="grid gap-2.5 sm:grid-cols-2">
        {candidates.map((s) => {
          const active = selectedId === s.id;
          return (
            <label key={s.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors duration-150 ${active ? "border-primary bg-primary/[0.06]" : "border-text/12 bg-surface hover:border-primary/50"}`}>
              <input type="radio" name="dup-source" checked={active} onChange={() => onSelect(s.id)} className="mt-1 accent-[var(--color-primary)]" />
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-text">{s.title || "Untitled test series"}</span>
                <span className="block text-xs text-muted">
                  {s.sections.length} section{s.sections.length === 1 ? "" : "s"} · {seriesTestCount(s)} tests · {seriesQuestionCount(s)} questions
                </span>
              </span>
            </label>
          );
        })}
      </div>
      <p className="mt-2 text-xs text-muted">Sections, tests and questions are copied with new ids. The original isn't changed.</p>
    </fieldset>
  );
}

export function ImportPanel({ result, onResult }) {
  const [file, setFile] = useState(null);
  const [reading, setReading] = useState(false);
  const [error, setError] = useState("");
  const token = useRef(0);

  async function pick(f) {
    token.current += 1;
    const mine = token.current;
    setError("");
    if (!f) {
      setFile(null);
      onResult(null);
      return;
    }
    if (f.size > 2 * 1024 * 1024) {
      setError("That file is over 2 MB. Split it into smaller files.");
      return;
    }
    setFile(f);
    setReading(true);
    try {
      const r = await readImportFile(f);
      if (mine === token.current) onResult(r);
    } catch {
      if (mine === token.current) {
        setError("We couldn't read that file. Make sure it's a UTF-8 CSV.");
        onResult(null);
      }
    } finally {
      if (mine === token.current) setReading(false);
    }
  }

  function downloadErrors() {
    const rows = result.report.filter((r) => r.status === "error").map((r) => `${r.row},"${r.messages.join(" | ").replace(/"/g, '""')}"`);
    downloadTextFile("import-errors.csv", `row,problems\r\n${rows.join("\r\n")}\r\n`);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted">Upload a CSV with one question per row. Excel users: File &gt; Save As &gt; CSV UTF-8.</p>
        <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" onClick={() => downloadTextFile("test-series-questions-template.csv", importTemplateCsv())}>
          <DownloadIcon className="h-3.5 w-3.5" />
          Download template
        </Button>
      </div>
      <FileDropzone label="Upload your questions CSV" hint=".csv or .txt, up to 2 MB" file={file} status={reading ? "uploading" : error ? "error" : "success"} progress={60} onFileSelect={pick} onRetry={() => pick(file)} />
      {error && <p className="text-xs text-danger" role="alert">{error}</p>}
      {result && (
        <div className="flex flex-col gap-3" aria-live="polite">
          {result.fileErrors.length > 0 && (
            <div role="alert" className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {result.fileErrors.map((m) => <p key={m}>{m}</p>)}
            </div>
          )}
          {result.report.length > 0 && (
            <>
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <StatusBadge status="success" size="sm">{result.okCount} ready to import</StatusBadge>
                {result.errorCount > 0 && <StatusBadge status="danger" size="sm">{result.errorCount} with errors (skipped)</StatusBadge>}
                {result.errorCount > 0 && (
                  <button type="button" onClick={downloadErrors} className="ml-auto text-primary underline">Download error list</button>
                )}
              </div>
              <div className="max-h-72 overflow-y-auto rounded-2xl ring-1 ring-text/[0.07]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-bg text-muted">
                    <tr><th className="px-3 py-2 font-semibold">Row</th><th className="px-3 py-2 font-semibold">Result</th><th className="px-3 py-2 font-semibold">Details</th></tr>
                  </thead>
                  <tbody className="divide-y divide-text/[0.06]">
                    {result.report.map((r) => (
                      <tr key={r.row} className="align-top">
                        <td className="px-3 py-2 font-semibold text-text">{r.row}</td>
                        <td className="px-3 py-2">
                          {r.status === "ok" ? <span className="inline-flex items-center gap-1 text-pastel-sage-ink"><CheckIcon className="h-3 w-3" />OK</span> : r.status === "warning" ? <span className="inline-flex items-center gap-1 text-pastel-orange-ink"><AlertTriangleIcon className="h-3 w-3" />Warning</span> : <span className="inline-flex items-center gap-1 text-danger"><AlertTriangleIcon className="h-3 w-3" />Error</span>}
                        </td>
                        <td className="px-3 py-2 text-muted">{r.messages.length ? r.messages.join(" ") : r.preview}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export function BankPanel({ selectedIds, onChange }) {
  const [subject, setSubject] = useState("All");
  const [topic, setTopic] = useState("All");
  const [difficulty, setDifficulty] = useState("All");
  const [query, setQuery] = useState("");
  const shown = useMemo(() => filterBank({ subject, topic, difficulty, query }), [subject, topic, difficulty, query]);
  const topics = useMemo(() => bankTopics(subject), [subject]);
  const set = new Set(selectedIds);
  const allShown = shown.length > 0 && shown.every((q) => set.has(q.id));

  function toggle(id) {
    onChange(set.has(id) ? selectedIds.filter((x) => x !== id) : [...selectedIds, id]);
  }
  function toggleAll() {
    if (allShown) onChange(selectedIds.filter((id) => !shown.some((q) => q.id === id)));
    else onChange(Array.from(new Set([...selectedIds, ...shown.map((q) => q.id)])));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
        <Select wrapperClassName="block w-full" aria-label="Subject" className={selectCls} value={subject} onChange={(e) => { setSubject(e.target.value); setTopic("All"); }}>
          <option value="All">All subjects</option>
          {BANK_SUBJECTS.map((s) => <option key={s}>{s}</option>)}
        </Select>
        <Select wrapperClassName="block w-full" aria-label="Topic" className={selectCls} value={topic} onChange={(e) => setTopic(e.target.value)}>
          <option value="All">All topics</option>
          {topics.map((t) => <option key={t}>{t}</option>)}
        </Select>
        <Select wrapperClassName="block w-full" aria-label="Difficulty" className={selectCls} value={difficulty} onChange={(e) => setDifficulty(e.target.value)}>
          <option value="All">All difficulties</option>
          {TS_DIFFICULTIES.map((d) => <option key={d}>{d}</option>)}
        </Select>
        <label className="relative block">
          <span className="sr-only">Search the bank</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search questions" className="w-full rounded-full border border-text/12 bg-surface py-2.5 pl-10 pr-4 text-sm text-text outline-none placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </label>
      </div>
      <div className="flex items-center justify-between text-xs">
        <button type="button" onClick={toggleAll} disabled={shown.length === 0} className="font-semibold text-primary underline disabled:opacity-40">{allShown ? "Clear shown" : "Select all shown"}</button>
        <span className="font-semibold text-muted">{selectedIds.length} selected · {shown.length} shown</span>
      </div>
      {shown.length === 0 ? (
        <p className="rounded-2xl bg-bg px-4 py-6 text-center text-sm text-muted">No bank questions match these filters.</p>
      ) : (
        <ul className="max-h-80 divide-y divide-text/[0.06] overflow-y-auto rounded-2xl ring-1 ring-text/[0.07]">
          {shown.map((q) => (
            <li key={q.id} className="px-4 py-3">
              <Checkbox
                checked={set.has(q.id)}
                onChange={() => toggle(q.id)}
                label={
                  <span className="block">
                    <span className="block text-sm text-text">{stripHtml(q.text)}</span>
                    <span className="mt-1 block text-[11px] text-muted">{q.subject} · {q.topic} · {q.difficulty} · {questionTypeMeta(q.type).short} · {q.points} pts</span>
                  </span>
                }
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function AiPanel({ outline, onOutline, defaultTopic = "" }) {
  const [topic, setTopic] = useState(defaultTopic);
  const [difficulty, setDifficulty] = useState("Intermediate");
  const [sections, setSections] = useState("2");
  const [tests, setTests] = useState("2");
  const [busy, setBusy] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function generate() {
    setBusy(true);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onOutline(generateOutline({ topic, difficulty, sections: Number(sections), testsPerSection: Number(tests) }));
      setBusy(false);
    }, 700);
  }
  function patchSection(sid, patch) {
    onOutline({ ...outline, sections: outline.sections.map((s) => (s.id === sid ? { ...s, ...patch } : s)) });
  }
  function patchTest(sid, tid, patch) {
    patchSection(sid, { tests: outline.sections.find((s) => s.id === sid).tests.map((t) => (t.id === tid ? { ...t, ...patch } : t)) });
  }
  function removeTest(sid, tid) {
    onOutline({ ...outline, sections: outline.sections.map((s) => (s.id === sid ? { ...s, tests: s.tests.filter((t) => t.id !== tid) } : s)).filter((s) => s.tests.length > 0) });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid items-start gap-3 sm:grid-cols-2">
        <Input label="Topic" placeholder="e.g. Quadratic equations" value={topic} onChange={(e) => setTopic(e.target.value)} shape="rect" maxLength={60} containerClassName="sm:col-span-2" />
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Difficulty</span>
          <SegmentedControl options={TS_DIFFICULTIES} value={difficulty} onChange={setDifficulty} className="max-w-full flex-wrap" />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text">Sections</span>
            <Select wrapperClassName="block w-full" className={selectCls} value={sections} onChange={(e) => setSections(e.target.value)}>{[1, 2, 3, 4].map((n) => <option key={n}>{n}</option>)}</Select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-text">Tests each</span>
            <Select wrapperClassName="block w-full" className={selectCls} value={tests} onChange={(e) => setTests(e.target.value)}>{[1, 2, 3, 4, 5].map((n) => <option key={n}>{n}</option>)}</Select>
          </label>
        </div>
      </div>
      <div>
        <Button fullWidth={false} className="px-6 py-2.5" disabled={topic.trim().length < 3 || busy} onClick={generate}>
          <SparkleIcon className="h-4 w-4" />
          {busy ? "Generating…" : outline ? "Regenerate outline" : "Generate outline"}
        </Button>
        {topic.trim().length < 3 && <span className="ml-3 text-xs text-muted">Enter a topic of at least 3 characters.</span>}
      </div>

      {outline && (
        <div className="rounded-2xl bg-pastel-lavender/50 p-4 ring-1 ring-pastel-lavender-ink/10">
          <div className="flex items-start gap-2.5">
            <SparkleIcon className="mt-0.5 h-4 w-4 shrink-0 text-pastel-lavender-ink" />
            <p className="text-xs text-pastel-lavender-ink">
              <span className="font-bold">AI-generated suggestion, not a finished series.</span> This was generated locally from your topic and difficulty. Rename, retime or remove anything below; you'll write the questions yourself in the builder.
            </p>
          </div>
          <div className="mt-4 flex flex-col gap-4">
            {outline.sections.map((s) => (
              <div key={s.id} className="rounded-2xl bg-surface p-3.5 shadow-soft">
                <Input aria-label="Section name" value={s.title} onChange={(e) => patchSection(s.id, { title: e.target.value })} error={!s.title.trim() ? "Name this section." : undefined} shape="rect" className="!py-2 font-semibold" />
                <div className="mt-2.5 flex flex-col gap-2">
                  {s.tests.map((t) => (
                    <div key={t.id} className="grid grid-cols-[1fr_5.5rem_auto] items-start gap-2">
                      <Input aria-label="Test title" value={t.title} onChange={(e) => patchTest(s.id, t.id, { title: e.target.value })} error={!t.title.trim() ? "Give it a title." : undefined} shape="rect" className="!py-2" />
                      <Input aria-label="Minutes" type="number" min={1} value={t.duration} onChange={(e) => patchTest(s.id, t.id, { duration: e.target.value === "" ? "" : Number(e.target.value) })} shape="rect" className="!py-2" />
                      <button type="button" onClick={() => removeTest(s.id, t.id)} aria-label="Remove test" className="mt-1.5 rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"><TrashIcon className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-pastel-lavender-ink">Suggested topic tags: {outline.topicTags.join(", ")}</p>
        </div>
      )}
    </div>
  );
}
