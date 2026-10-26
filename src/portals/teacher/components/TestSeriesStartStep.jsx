// Start + Source steps — the same start options as the admin wizard:
// build from scratch, import questions from a CSV, or an AI-assisted
// (template-based) outline. "Duplicate an existing series" is hidden in the
// admin wizard, so it isn't offered here either.
import { useMemo, useState } from "react";
import Input from "../../../components/ui/Input";
import Select from "../../../components/ui/Select";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import { PencilIcon, UploadIcon, QuizIcon, CheckIcon, XIcon, ChevronDownIcon } from "../../../components/ui/icons";
import TestCsvImport from "./TestCsvImport";
import { SUBJECT_OPTIONS } from "../../admin/data/testSeriesMock";
import { OUTLINE_DIFFICULTY, OUTLINE_TYPES, generateOutline, topicSuggestions, wid } from "../../admin/data/testSeriesWizard";
import { TS_AUDIENCES, TS_SUBJECTS, allTests, newSection, newTest } from "../data/testSeriesData";

export const START_METHODS = [
  { key: "scratch", icon: PencilIcon, title: "Build from scratch", text: "Start with an empty series and add tests and questions yourself." },
  { key: "csv", icon: UploadIcon, title: "Import questions", text: "Upload a CSV and review a row-by-row validation report before anything is imported." },
  { key: "ai", icon: QuizIcon, title: "AI-assisted outline", text: "Get an editable, template-based outline of tests and topics from your requirements." },
];
export const SOURCE_LABEL = { csv: "Import", ai: "AI outline" };

const IMPORT_TEST = "Imported questions";

// Replace every test in the series with `tests` (keeps the single flat group the builder uses).
function withTests(series, tests) {
  return { sections: [{ ...(series.sections[0] || newSection("Tests")), tests }] };
}

export function StartMethodStep({ value, onChange }) {
  return (
    <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
      <span className="eyebrow">Start</span>
      <h2 className="mt-1 text-lg font-bold text-text">How would you like to start?</h2>
      <p className="mt-1 text-sm text-muted">Each option leads to its own setup in the next step.</p>
      <div className="mt-5 grid gap-4 md:grid-cols-3">
        {START_METHODS.map(({ key, icon: Icon, title, text }) => {
          const active = value === key;
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => onChange(key)}
              className={`relative flex flex-col items-start gap-2 rounded-2xl border p-5 text-left transition-colors duration-150 ${active ? "border-primary bg-primary/[0.06]" : "border-text/12 bg-white hover:border-primary/50"}`}
            >
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span>
              <span className={`absolute right-4 top-4 grid h-5 w-5 place-items-center rounded-full border ${active ? "border-primary bg-primary text-white" : "border-text/20"}`}>{active && <CheckIcon className="h-3 w-3" />}</span>
              <strong className="text-sm text-text">{title}</strong>
              <span className="text-xs text-muted">{text}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

function CsvSource({ series, onChange }) {
  const [open, setOpen] = useState(false);
  const tests = allTests(series);
  const target = tests.find((t) => t.title === IMPORT_TEST);
  const total = tests.reduce((n, t) => n + t.questions.length, 0);

  function onImport(qs) {
    if (target) onChange(withTests(series, tests.map((t) => (t.id === target.id ? { ...t, questions: [...t.questions, ...qs] } : t))));
    else onChange(withTests(series, [...tests, { ...newTest(), title: IMPORT_TEST, questions: qs }]));
    setOpen(false);
  }
  return (
    <div className="flex flex-col gap-4">
      <Button fullWidth={false} className="w-fit px-6" onClick={() => setOpen(true)}><UploadIcon className="h-4 w-4" />Upload CSV</Button>
      {total > 0 && <p className="rounded-2xl bg-pastel-sage px-4 py-3 text-sm font-semibold text-pastel-sage-ink">{total} question{total === 1 ? "" : "s"} ready in “{IMPORT_TEST}”.</p>}
      {open && <TestCsvImport testTitle={IMPORT_TEST} existingQuestions={target?.questions || []} onImport={onImport} onClose={() => setOpen(false)} />}
    </div>
  );
}

function AiSource({ series, onChange }) {
  const [cfg, setCfg] = useState({ subject: "", topics: [], audience: series.audienceLevel || "", difficulty: "Mixed", numTests: 4, questionsPerTest: 20, types: ["objective"], marksPerQuestion: 4, duration: 40 });
  const [topicInput, setTopicInput] = useState("");
  const [outline, setOutline] = useState(null);
  const [seed, setSeed] = useState(0);
  const set = (p) => setCfg((c) => ({ ...c, ...p }));
  const suggestions = useMemo(() => topicSuggestions(cfg.subject), [cfg.subject]);
  const ready = cfg.subject && cfg.types.length > 0 && Number(cfg.numTests) > 0 && Number(cfg.questionsPerTest) > 0;
  const toggle = (k, v) => set({ [k]: cfg[k].includes(v) ? cfg[k].filter((x) => x !== v) : [...cfg[k], v] });
  const addTopic = () => {
    const parts = topicInput.split(",").map((x) => x.trim()).filter(Boolean);
    if (parts.length) set({ topics: [...new Set([...cfg.topics, ...parts])] });
    setTopicInput("");
  };
  const generate = (s) => { setSeed(s); setOutline(generateOutline(cfg, s)); };
  const patchItem = (id, p) => setOutline((o) => o.map((t) => (t.id === id ? { ...t, ...p } : t)));
  const move = (i, d) => setOutline((o) => { const n = [...o]; const j = i + d; if (j < 0 || j >= n.length) return o; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const addBlank = () => setOutline((o) => [...o, { id: wid("ol"), name: `Test ${o.length + 1}`, topics: [], questionCount: Number(cfg.questionsPerTest) || 10, marksPerQuestion: Number(cfg.marksPerQuestion) || 4, duration: Number(cfg.duration) || 30, difficulty: cfg.difficulty, sections: [] }]);

  function apply() {
    const mapped = TS_SUBJECTS.includes(cfg.subject) ? cfg.subject : "Other";
    onChange({
      ...withTests(series, outline.map((o) => ({ ...newTest(), title: o.name, duration: o.duration, plannedQuestions: o.questionCount, topics: o.topics }))),
      audienceLevel: series.audienceLevel || cfg.audience,
      subjects: series.subjects.length ? series.subjects : [mapped],
    });
  }
  const created = allTests(series).length;

  return (
    <div className="flex flex-col gap-5">
      <p className="rounded-2xl bg-bg px-4 py-3 text-xs text-muted"><strong className="text-text">Template-based suggestion — no external AI is connected.</strong> This builds an editable outline (test names, topics, counts) from your inputs. It does not write questions, and nothing is published automatically.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-text">Subject</span>
          <Select wrapperClassName="block w-full" value={cfg.subject} onChange={(e) => set({ subject: e.target.value, topics: [] })} className="w-full rounded-2xl border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text">
            <option value="">Select subject…</option>
            {SUBJECT_OPTIONS.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </label>
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-text">Target audience / class</span>
          <Select wrapperClassName="block w-full" value={cfg.audience} onChange={(e) => set({ audience: e.target.value })} className="w-full rounded-2xl border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text">
            <option value="">Select audience…</option>
            {TS_AUDIENCES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </label>
      </div>
      <div>
        <span className="mb-2 block text-sm font-medium text-text">Topics (pick suggestions or type your own, comma separated)</span>
        <div className="flex flex-wrap gap-2">
          {[...new Set([...suggestions, ...cfg.topics])].map((t) => <Chip key={t} active={cfg.topics.includes(t)} onClick={() => toggle("topics", t)} className="px-4 py-1.5 text-xs">{t}</Chip>)}
        </div>
        <div className="mt-3 flex max-w-md items-center gap-2">
          <Input aria-label="Add topics" containerClassName="flex-1" placeholder="Add topics…" value={topicInput} onChange={(e) => setTopicInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addTopic(); } }} shape="rect" className="!py-2" />
          <button type="button" onClick={addTopic} className="rounded-full border border-primary/25 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/[0.05]">Add</button>
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Input label="Number of tests" type="number" min={1} max={30} value={cfg.numTests} onChange={(e) => set({ numTests: e.target.value })} shape="rect" />
        <Input label="Questions per test" type="number" min={1} max={200} value={cfg.questionsPerTest} onChange={(e) => set({ questionsPerTest: e.target.value })} shape="rect" />
        <Input label="Marks per question" type="number" min={1} value={cfg.marksPerQuestion} onChange={(e) => set({ marksPerQuestion: e.target.value })} shape="rect" />
        <Input label="Duration per test (min)" type="number" min={5} value={cfg.duration} onChange={(e) => set({ duration: e.target.value })} shape="rect" />
        <label className="block"><span className="mb-1.5 block text-sm font-medium text-text">Difficulty</span>
          <Select wrapperClassName="block w-full" value={cfg.difficulty} onChange={(e) => set({ difficulty: e.target.value })} className="w-full rounded-2xl border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text">
            {OUTLINE_DIFFICULTY.map((d) => <option key={d}>{d}</option>)}
          </Select>
        </label>
        <div><span className="mb-1.5 block text-sm font-medium text-text">Question types</span>
          <div className="flex flex-wrap gap-2">{OUTLINE_TYPES.map((t) => <Chip key={t.value} active={cfg.types.includes(t.value)} onClick={() => toggle("types", t.value)} className="px-4 py-1.5 text-xs">{t.label}</Chip>)}</div>
        </div>
      </div>
      <Button fullWidth={false} className="w-fit px-6" disabled={!ready} onClick={() => generate(0)}>Generate outline</Button>

      {outline && (
        <div className="rounded-2xl bg-bg p-4 sm:p-5">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="mr-auto text-sm font-bold text-text">Suggested outline ({outline.length} test{outline.length === 1 ? "" : "s"})</h3>
            <button type="button" onClick={() => generate(seed + 1)} className="rounded-full border border-primary/25 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.05]">Regenerate</button>
            <button type="button" onClick={addBlank} className="rounded-full border border-primary/25 px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.05]">+ Add test</button>
          </div>
          {outline.length === 0 && <p className="mt-3 text-xs text-muted">Outline is empty. Regenerate or add a test.</p>}
          <div className="mt-3 flex flex-col gap-2">
            {outline.map((t, i) => (
              <div key={t.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white p-3">
                <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-primary/10 text-xs font-bold text-primary">{i + 1}</span>
                <div className="min-w-0 flex-1 basis-56">
                  <input value={t.name} onChange={(e) => patchItem(t.id, { name: e.target.value })} aria-label="Test name" className="w-full rounded-lg border border-text/12 px-3 py-1.5 text-sm text-text outline-none focus:border-primary" />
                  <small className="mt-1 block text-[11px] text-muted">{t.topics.join(", ") || "No topics"} · {t.difficulty}</small>
                </div>
                <label className="text-[11px] font-semibold text-muted">Qs<input type="number" min={1} value={t.questionCount} onChange={(e) => patchItem(t.id, { questionCount: Number(e.target.value) || 0 })} className="ml-1 w-16 rounded-lg border border-text/12 px-2 py-1 text-sm text-text" /></label>
                <label className="text-[11px] font-semibold text-muted">Min<input type="number" min={1} value={t.duration} onChange={(e) => patchItem(t.id, { duration: Number(e.target.value) || 0 })} className="ml-1 w-16 rounded-lg border border-text/12 px-2 py-1 text-sm text-text" /></label>
                <button type="button" disabled={i === 0} onClick={() => move(i, -1)} aria-label="Move up" className="rounded-full p-1.5 text-muted hover:bg-bg disabled:opacity-30"><ChevronDownIcon className="h-3.5 w-3.5 rotate-180" /></button>
                <button type="button" disabled={i === outline.length - 1} onClick={() => move(i, 1)} aria-label="Move down" className="rounded-full p-1.5 text-muted hover:bg-bg disabled:opacity-30"><ChevronDownIcon className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => setOutline((o) => o.filter((x) => x.id !== t.id))} aria-label="Remove" className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"><XIcon className="h-3.5 w-3.5" /></button>
              </div>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button fullWidth={false} className="px-6" disabled={outline.length === 0 || outline.some((t) => !t.name.trim())} onClick={apply}>Use this outline</Button>
            <span className="text-xs text-muted">Creates empty draft tests. You add the questions next.</span>
          </div>
        </div>
      )}
      {created > 0 && <p className="rounded-2xl bg-pastel-sage px-4 py-3 text-sm font-semibold text-pastel-sage-ink">{created} draft test{created === 1 ? "" : "s"} created from the outline. Continue to configure them and add questions.</p>}
    </div>
  );
}

export function StartSourceStep({ method, series, onChange }) {
  const title = method === "csv" ? "Import questions from CSV" : "AI-assisted outline";
  const sub = method === "csv"
    ? "Upload a file, review the validation report, fix or remove problem rows, then import the valid ones."
    : "Describe what you need and review a suggested outline. You decide what to keep.";
  return (
    <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
      <span className="eyebrow">{SOURCE_LABEL[method]}</span>
      <h2 className="mt-1 text-lg font-bold text-text">{title}</h2>
      <p className="mb-5 mt-1 text-sm text-muted">{sub}</p>
      {method === "csv" ? <CsvSource series={series} onChange={onChange} /> : <AiSource series={series} onChange={onChange} />}
    </section>
  );
}
