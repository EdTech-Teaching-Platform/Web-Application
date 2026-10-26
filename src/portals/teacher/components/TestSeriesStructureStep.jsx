// Step 2 — Structure. Same as the admin wizard's Structure step: a flat list of
// tests (no sections). Each test has a name, duration, passing %, attempts
// allowed and topics, and holds its questions: add a question, import a CSV,
// edit, reorder or remove. Questions are written in a modal (TestQuestionEditor).
import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import TestQuestionEditor from "./TestQuestionEditor";
import TestCsvImport from "./TestCsvImport";
import { PlusIcon, TrashIcon, PencilIcon, ChevronDownIcon, XIcon } from "../../../components/ui/icons";
import { allTests, difficultyLabel, isSubjective, newSection, newTest, questionErrors, quizPoints, seriesPoints, seriesQuestionCount, stripHtml } from "../data/testSeriesData";

const field = "w-full rounded-2xl border border-text/12 bg-surface px-4 py-2.5 text-sm text-text outline-none transition-colors placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:opacity-60";

function regroup(sections, flat) {
  let k = 0;
  return sections.map((sec) => {
    const n = sec.tests.length;
    const out = flat.slice(k, k + n);
    k += n;
    return { ...sec, tests: out };
  });
}
function moved(list, i, d) {
  const j = i + d;
  if (j < 0 || j >= list.length) return list;
  const next = [...list];
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}

function Label({ children }) {
  return <span className="mb-1.5 block text-xs font-semibold text-text">{children}</span>;
}

export default function TestSeriesStructureStep({ series, onChange, readOnly = false, focus, onPointer }) {
  const tests = allTests(series);
  // What the admin asked for when assigning this series (absent for the educator's own series).
  const exp = series.assignment?.expected || {};
  const wantTests = Number(exp.tests) || 0;
  const perTest = wantTests && Number(exp.questions) ? Math.ceil(Number(exp.questions) / wantTests) : 0;
  const [editor, setEditor] = useState(null); // { testId, questionId|null }
  const [csvFor, setCsvFor] = useState(null); // testId
  const [confirmTest, setConfirmTest] = useState(null);
  const [touched, setTouched] = useState({});

  // "Fix this" / "Resume": scroll to the test and open the question that needs attention.
  useEffect(() => {
    if (!focus?.testId) return undefined;
    if (focus.questionId) setEditor({ testId: focus.testId, questionId: focus.questionId });
    const id = setTimeout(() => document.getElementById(`ts-test-${focus.testId}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 80);
    return () => clearTimeout(id);
  }, [focus?.nonce]); // eslint-disable-line react-hooks/exhaustive-deps

  const setSections = (sections) => onChange({ sections });
  const patchTest = (id, patch) => setSections(series.sections.map((sec) => ({ ...sec, tests: sec.tests.map((t) => (t.id === id ? { ...t, ...patch } : t)) })));
  function addTest() {
    const t = { ...newTest(), title: `Test ${tests.length + 1}`, plannedQuestions: perTest };
    if (series.sections.length === 0) setSections([{ ...newSection("Tests"), tests: [t] }]);
    else setSections(series.sections.map((sec, i) => (i === series.sections.length - 1 ? { ...sec, tests: [...sec.tests, t] } : sec)));
  }
  const removeTest = (id) => {
    setSections(series.sections.map((sec) => ({ ...sec, tests: sec.tests.filter((t) => t.id !== id) })));
    setConfirmTest(null);
  };
  const moveTest = (i, d) => setSections(regroup(series.sections, moved(tests, i, d)));
  const setQuestions = (testId, questions) => patchTest(testId, { questions });
  const touch = (k) => setTouched((t) => ({ ...t, [k]: true }));

  const editorTest = editor ? tests.find((t) => t.id === editor.testId) : null;
  const editingQuestion = editorTest && editor.questionId ? editorTest.questions.find((q) => q.id === editor.questionId) : null;
  const csvTest = csvFor ? tests.find((t) => t.id === csvFor) : null;

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
        <span className="eyebrow">Structure</span>
        <h2 className="mt-1 text-lg font-bold text-text">Build the structure</h2>
        <p className="mt-1 text-sm text-muted">Add tests, then add or import the questions for each one.</p>
        {wantTests > 0 && (
          <div className="mt-4 rounded-2xl bg-pastel-blue/60 p-4 text-pastel-blue-ink">
            <p className="text-sm font-bold">The admin asked for {wantTests} test{wantTests === 1 ? "" : "s"}{perTest ? `, about ${perTest} question${perTest === 1 ? "" : "s"} each` : ""}.</p>
            <div className="mt-3 grid grid-cols-3 gap-2 text-center">
              {[["Tests", tests.length, wantTests], ["Questions", seriesQuestionCount(series), exp.questions], ["Marks", seriesPoints(series), exp.marks]].map(([l, built, want]) => (
                <div key={l} className="rounded-xl bg-white/70 px-2 py-2">
                  <div className="text-[10px] font-bold uppercase tracking-wide opacity-80">{l}</div>
                  <div className="text-sm font-bold">{built}{want ? <span className="font-medium opacity-70"> / {want}</span> : null}</div>
                </div>
              ))}
            </div>
            {tests.length > wantTests && <p className="mt-2 text-xs font-semibold">You have {tests.length - wantTests} more test{tests.length - wantTests === 1 ? "" : "s"} than the admin asked for.</p>}
          </div>
        )}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <Button fullWidth={false} className="px-5 py-2.5" disabled={readOnly} onClick={addTest}>
            <PlusIcon className="h-4 w-4" />
            Add test
          </Button>
          <span className="ml-auto text-sm font-medium text-muted">{tests.length} test(s) · {seriesQuestionCount(series)} question(s) · {seriesPoints(series)} marks</span>
        </div>
      </section>

      {tests.length === 0 && <p className="rounded-3xl border border-dashed border-text/20 bg-surface px-6 py-10 text-center text-sm text-muted">No tests yet. Add your first test.</p>}

      <div inert={readOnly} className={`flex flex-col gap-5 ${readOnly ? "opacity-70" : ""}`}>
        {tests.map((t, ti) => {
          const marks = quizPoints(t.questions);
          const nameEmpty = !String(t.title || "").trim();
          const durBad = !(Number(t.duration) > 0);
          return (
            <section key={t.id} id={`ts-test-${t.id}`} className="scroll-mt-24 rounded-3xl bg-surface p-5 shadow-soft ring-1 ring-text/[0.06] sm:p-6">
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{ti + 1}</span>
                <div className="min-w-0 flex-1">
                  {wantTests > 0 && (
                    <span className={`mb-1 inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wide ${ti < wantTests ? "bg-primary/10 text-primary" : "bg-pastel-orange text-pastel-orange-ink"}`}>
                      {ti < wantTests ? `Test ${ti + 1} of ${wantTests}` : `Extra test · admin asked for ${wantTests}`}
                    </span>
                  )}
                  <input
                    aria-label="Test name"
                    placeholder="Test name"
                    className={`${field} ${touched[`n-${t.id}`] && nameEmpty ? "!border-danger" : ""}`}
                    value={t.title}
                    onChange={(e) => patchTest(t.id, { title: e.target.value })}
                    onBlur={() => touch(`n-${t.id}`)}
                  />
                  {touched[`n-${t.id}`] && nameEmpty && <span className="mt-1 block text-xs text-danger">Test {ti + 1} needs a name.</span>}
                </div>
                <button type="button" disabled={ti === 0} onClick={() => moveTest(ti, -1)} aria-label="Move test up" className="mt-1.5 rounded-full p-1.5 text-muted hover:bg-bg disabled:opacity-30"><ChevronDownIcon className="h-4 w-4 rotate-180" /></button>
                <button type="button" disabled={ti === tests.length - 1} onClick={() => moveTest(ti, 1)} aria-label="Move test down" className="mt-1.5 rounded-full p-1.5 text-muted hover:bg-bg disabled:opacity-30"><ChevronDownIcon className="h-4 w-4" /></button>
                <button type="button" onClick={() => (t.questions.length ? setConfirmTest(t) : removeTest(t.id))} aria-label="Remove test" className="mt-1.5 rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"><TrashIcon className="h-4 w-4" /></button>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <label className="block">
                  <Label>Duration (min)</Label>
                  <input type="number" min="1" className={`${field} ${durBad ? "!border-danger" : ""}`} value={t.duration} onChange={(e) => patchTest(t.id, { duration: e.target.value === "" ? "" : Number(e.target.value) })} />
                </label>
                <label className="block">
                  <Label>Passing %</Label>
                  <input type="number" min="0" max="100" className={field} value={t.passingPct ?? 40} onChange={(e) => patchTest(t.id, { passingPct: e.target.value === "" ? "" : Number(e.target.value) })} />
                </label>
                <label className="block">
                  <Label>Attempts allowed</Label>
                  <input type="number" min="1" className={field} value={t.attemptLimit ?? 1} onChange={(e) => patchTest(t.id, { attemptLimit: e.target.value === "" ? "" : Number(e.target.value) })} />
                </label>
                <label className="block">
                  <Label>Topics</Label>
                  <input className={field} placeholder="comma separated" defaultValue={(t.topics || []).join(", ")} onBlur={(e) => patchTest(t.id, { topics: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} />
                </label>
              </div>

              <p className="mt-4 text-xs font-semibold text-muted">{t.questions.length} question{t.questions.length === 1 ? "" : "s"} · {marks} marks{(t.plannedQuestions || perTest) > 0 && ` · planned ${t.plannedQuestions || perTest}${t.questions.length < (t.plannedQuestions || perTest) ? ` (${(t.plannedQuestions || perTest) - t.questions.length} to go)` : " ✓"}`}</p>

              {t.questions.length > 0 && (
                <ul className="mt-2 flex flex-col divide-y divide-text/[0.06] rounded-2xl bg-bg px-3">
                  {t.questions.map((q, qi) => {
                    const bad = questionErrors(q).length > 0;
                    return (
                      <li key={q.id} className="flex items-center gap-2 py-2.5">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-bold text-primary">{qi + 1}</span>
                        <span className="min-w-0 flex-1 truncate text-sm text-text">{stripHtml(q.text) || <em className="text-muted">(no text)</em>}</span>
                        {bad && <span className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-[10px] font-bold text-danger">Fix</span>}
                        <span className="hidden shrink-0 text-xs text-muted sm:inline">{isSubjective(q.type) ? "Subj." : "MCQ"} · {difficultyLabel(q.difficulty)} · {q.points}m</span>
                        <button type="button" onClick={() => { onPointer?.(t.id, q.id); setEditor({ testId: t.id, questionId: q.id }); }} aria-label="Edit question" className="rounded-full p-1.5 text-muted hover:bg-surface hover:text-primary"><PencilIcon className="h-3.5 w-3.5" /></button>
                        <button type="button" disabled={qi === 0} onClick={() => setQuestions(t.id, moved(t.questions, qi, -1))} aria-label="Move question up" className="rounded-full p-1.5 text-muted hover:bg-surface disabled:opacity-30"><ChevronDownIcon className="h-3.5 w-3.5 rotate-180" /></button>
                        <button type="button" disabled={qi === t.questions.length - 1} onClick={() => setQuestions(t.id, moved(t.questions, qi, 1))} aria-label="Move question down" className="rounded-full p-1.5 text-muted hover:bg-surface disabled:opacity-30"><ChevronDownIcon className="h-3.5 w-3.5" /></button>
                        <button type="button" onClick={() => setQuestions(t.id, t.questions.filter((x) => x.id !== q.id))} aria-label="Remove question" className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"><XIcon className="h-3.5 w-3.5" /></button>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={() => { onPointer?.(t.id, null); setEditor({ testId: t.id, questionId: null }); }} className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.05]">
                  <PlusIcon className="h-3.5 w-3.5" />
                  Add question
                </button>
                <button type="button" onClick={() => setCsvFor(t.id)} className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.05]">
                  Import CSV
                </button>
              </div>
            </section>
          );
        })}
      </div>

      {editor && editorTest && (
        <TestQuestionEditor
          key={`${editor.testId}-${editor.questionId || "new"}`}
          initial={editingQuestion}
          defaults={{ subject: series.subjects[0] || "", topic: (editorTest.topics || [])[0] || "" }}
          onClose={() => setEditor(null)}
          onSave={(q) => {
            setQuestions(editorTest.id, editingQuestion ? editorTest.questions.map((x) => (x.id === q.id ? q : x)) : [...editorTest.questions, q]);
            setEditor(null);
          }}
        />
      )}
      {csvTest && (
        <TestCsvImport
          testTitle={csvTest.title}
          existingQuestions={csvTest.questions}
          onClose={() => setCsvFor(null)}
          onImport={(qs) => setQuestions(csvTest.id, [...csvTest.questions, ...qs])}
        />
      )}

      <Modal
        open={Boolean(confirmTest)}
        onClose={() => setConfirmTest(null)}
        title="Remove test?"
        footer={
          <>
            <Button fullWidth={false} className="!bg-danger px-6" onClick={() => removeTest(confirmTest.id)}>Confirm remove</Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setConfirmTest(null)}>Keep</Button>
          </>
        }
      >
        <p className="text-sm text-muted">"{confirmTest?.title || "Untitled test"}" and its {confirmTest?.questions.length ?? 0} question(s) will be removed.</p>
      </Modal>
    </div>
  );
}
