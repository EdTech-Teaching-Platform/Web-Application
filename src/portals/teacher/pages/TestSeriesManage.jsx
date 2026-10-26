// Manage Tests — what "Edit" opens for a published series.
//
// A one-to-one copy of the admin "Manage Tests" flow, nothing more and nothing
// less:
//   Series level : stats (tests, questions, enrollment, avg. performance), a
//                  table of tests with Manage Questions / Edit / More
//                  (Publish, Unpublish, Duplicate, View Details, Delete) and
//                  "Create Test" (name, instructions, duration, attempt limit,
//                  total / passing marks, schedule, shuffle questions / options).
//   Test level   : Preview Test, Publish / Unpublish, Add Question, a question
//                  table (Edit / Delete) and the same question editor the admin
//                  uses (Objective or Subjective).
// State lives in TestSeriesContext, written through updateSeries().
import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useParams } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import TestQuestionEditor from "../components/TestQuestionEditor";
import { SeriesStatusBadge } from "../components/TestSeriesStatus";
import { ArrowLeftIcon, PlusIcon, PencilIcon, EyeIcon, XIcon, CheckIcon, QuizIcon, LockIcon, CopyIcon, TrashIcon, EyeOffIcon } from "../../../components/ui/icons";
import { allTests, difficultyLabel, htmlToPlain, isLive, isStructureLocked, isSubjective, makeId, newSection, newTest, quizPoints } from "../data/testSeriesData";

const EMPTY_FORM = { name: "", instructions: "", duration: "", attemptLimit: "", totalMarks: "", passingMarks: "", scheduledAt: "", shuffleQuestions: false, shuffleOptions: false };
const input = "w-full rounded-xl border border-(--lp-line) bg-white px-3.5 py-2.5 text-sm text-(--lp-ink) outline-none transition-colors placeholder:text-(--lp-muted)/70 focus:border-(--lp-blue) focus:ring-2 focus:ring-(--lp-blue)/15";

// ---- test helpers (admin fields mapped onto the teacher test shape) ----
const totalMarksOf = (t) => Number(t.totalMarks) || quizPoints(t.questions);
const passingMarksOf = (t) => Number(t.passingMarks) || Math.round((totalMarksOf(t) * (Number(t.passingPct) || 40)) / 100);
const statusOf = (t, series) => t.status || (isLive(series) ? "published" : "draft");
function readiness(t) {
  const errors = [];
  if (!String(t.title || "").trim()) errors.push("Test name is required.");
  if (!(Number(t.duration) > 0)) errors.push("A valid duration (minutes) is required.");
  if (!(totalMarksOf(t) > 0)) errors.push("Total marks is required.");
  if (!(passingMarksOf(t) > 0)) errors.push("Passing marks is required.");
  if (passingMarksOf(t) > totalMarksOf(t)) errors.push("Passing marks cannot exceed total marks.");
  if (!t.scheduledAt) errors.push("A scheduled date/time is required.");
  if (!t.questions.length) errors.push("At least one question is required before publishing.");
  return { valid: errors.length === 0, errors };
}
const fmtWhen = (v) => (v ? new Date(v).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");

function Pill({ status }) {
  const live = status === "published";
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${live ? "bg-[#e3f5ec] text-[#1f9d6b]" : "bg-(--lp-yellow-soft) text-(--lp-ink)"}`}>{live ? "Published" : "Draft"}</span>;
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-(--lp-muted)">{label}</span>
      {children}
    </label>
  );
}

function Segmented({ value, onChange }) {
  return (
    <div className="inline-flex rounded-full bg-(--lp-grey) p-1 ring-1 ring-(--lp-line)">
      {[["Off", false], ["On", true]].map(([l, v]) => (
        <button key={l} type="button" onClick={() => onChange(v)} className={`rounded-full px-4 py-1.5 text-xs font-bold ${value === v ? "bg-(--lp-ink) text-white" : "text-(--lp-muted)"}`}>{l}</button>
      ))}
    </div>
  );
}

function Drawer({ title, subtitle, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-(--lp-ink)/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={title} className="relative flex h-full w-full max-w-lg flex-col bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-(--lp-line) px-6 py-5">
          <div className="min-w-0">
            <h3 className="font-(family-name:--lp-font) text-lg font-bold tracking-tight text-(--lp-ink)">{title}</h3>
            {subtitle && <p className="mt-0.5 text-sm text-(--lp-muted)">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-(--lp-muted) hover:bg-(--lp-grey)"><XIcon className="h-4 w-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap items-center justify-end gap-2 border-t border-(--lp-line) px-6 py-4">{footer}</div>}
      </div>
    </div>
  );
}

const btnGhost = "rounded-full px-4 py-2 text-sm font-semibold text-(--lp-ink) ring-1 ring-(--lp-line) transition-colors hover:bg-(--lp-grey) disabled:opacity-50";
const btnPrimary = "rounded-full bg-(--lp-ink) px-5 py-2 text-sm font-bold text-white transition-transform hover:-translate-y-0.5 disabled:opacity-50";

export default function TestSeriesManage() {
  const { seriesId } = useParams();
  const navigate = useNavigate();
  const { series: all, currentTeacher, updateSeries } = useTestSeries();
  const series = all.find((s) => s.id === seriesId && s.teacherId === currentTeacher?.id) || null;

  const [testId, setTestId] = useState(null);
  const [toast, setToast] = useState("");
  const [formOpen, setFormOpen] = useState(null); // null | "create" | "edit"
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [menuId, setMenuId] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [qEditor, setQEditor] = useState(null); // { questionId|null }
  const [deleteQ, setDeleteQ] = useState(null);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);
  useEffect(() => {
    if (!menuId) return undefined;
    const close = () => setMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [menuId]);

  const tests = useMemo(() => (series ? allTests(series) : []), [series]);
  const test = tests.find((t) => t.id === testId) || null;

  if (!series) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState icon={QuizIcon} heading="Test series not found" message="It may have been deleted, or it belongs to another educator." action={<NavLink to="/teacher/testseries" className="inline-flex rounded-full bg-(--lp-ink) px-6 py-3 text-sm font-semibold text-white">Back to Test Series</NavLink>} />
      </div>
    );
  }

  const locked = isStructureLocked(series);
  const totalQuestions = tests.reduce((n, t) => n + t.questions.length, 0);

  // ---- writes ----
  const writeTests = (fn) => {
    // fn: (flatTests) => flatTests, then regroup into the existing sections.
    const flat = fn(tests);
    if (series.sections.length === 0) {
      updateSeries(series.id, { sections: [{ ...newSection("Tests"), tests: flat }] });
      return;
    }
    let k = 0;
    const sections = series.sections.map((sec, i) => {
      const isLast = i === series.sections.length - 1;
      const n = sec.tests.length;
      const out = isLast ? flat.slice(k) : flat.slice(k, k + n);
      k += n;
      return { ...sec, tests: out };
    });
    updateSeries(series.id, { sections });
  };
  const patchTest = (id, patch) => writeTests((ts) => ts.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const setQuestions = (id, questions) => patchTest(id, { questions });

  // ---- test form ----
  const openCreate = () => { setForm(EMPTY_FORM); setEditingId(null); setFormErrors([]); setFormOpen("create"); };
  const openEdit = (t) => {
    setForm({
      name: t.title || "", instructions: t.instructions || "", duration: String(t.duration || ""), attemptLimit: String(t.attemptLimit || ""),
      totalMarks: String(totalMarksOf(t) || ""), passingMarks: String(passingMarksOf(t) || ""), scheduledAt: t.scheduledAt || "",
      shuffleQuestions: !!t.shuffleQuestions, shuffleOptions: !!t.shuffleOptions,
    });
    setEditingId(t.id);
    setFormErrors([]);
    setFormOpen("edit");
  };
  const closeForm = () => { setFormOpen(null); setFormErrors([]); };
  const payload = () => {
    const total = Number(form.totalMarks) || 0;
    const pass = Number(form.passingMarks) || 0;
    return {
      title: form.name.trim(), instructions: form.instructions.trim(), duration: Number(form.duration) || 0, attemptLimit: Number(form.attemptLimit) || 1,
      totalMarks: total, passingMarks: pass, passingPct: total ? Math.round((pass / total) * 100) : 40,
      scheduledAt: form.scheduledAt, shuffleQuestions: !!form.shuffleQuestions, shuffleOptions: !!form.shuffleOptions,
    };
  };
  const saveDraft = () => {
    const p = { ...payload(), status: "draft" };
    if (formOpen === "edit") { patchTest(editingId, p); setToast(`"${p.title || "Test"}" saved as draft.`); }
    else { writeTests((ts) => [...ts, { ...newTest(), ...p }]); setToast(`"${p.title || "Test"}" created as draft.`); }
    closeForm();
  };
  const saveAndManageQuestions = () => {
    const t = { ...newTest(), ...payload(), status: "draft" };
    writeTests((ts) => [...ts, t]);
    setToast(`"${t.title || "Test"}" created as draft. Now add Questions.`);
    closeForm();
    setTestId(t.id);
  };
  const saveAndPublish = () => {
    const existing = tests.find((t) => t.id === editingId);
    const candidate = { ...existing, ...payload(), status: "published" };
    const { valid, errors } = readiness(candidate);
    if (!valid) { setFormErrors(errors); return; }
    patchTest(editingId, { ...payload(), status: "published" });
    setToast(`"${candidate.title}" updated and published.`);
    closeForm();
  };

  // ---- row actions ----
  const publishTest = (t) => {
    if (statusOf(t, series) === "published") return;
    const r = readiness(t);
    if (!r.valid) { setToast(r.errors[0]); return; }
    patchTest(t.id, { status: "published" });
    setToast(`"${t.title}" published.`);
  };
  const unpublishTest = (t) => {
    if (statusOf(t, series) !== "published") return;
    patchTest(t.id, { status: "draft" });
    setToast(`"${t.title}" unpublished.`);
  };
  const duplicateTest = (t) => {
    const copy = { ...t, id: makeId("t"), title: `${t.title} (Copy)`, status: "draft", questions: t.questions.map((q) => ({ ...q, id: makeId("q"), options: q.options?.map((o) => ({ ...o, id: makeId("o") })) })) };
    writeTests((ts) => [...ts, copy]);
    setToast(`"${t.title}" duplicated.`);
  };
  const confirmDelete = () => {
    if (!deleteTarget) return;
    writeTests((ts) => ts.filter((t) => t.id !== deleteTarget.id));
    setToast(`"${deleteTarget.title}" deleted.`);
    setDeleteTarget(null);
  };

  const Back = ({ onClick, children }) => (
    <button type="button" onClick={onClick} className="mb-4 inline-flex items-center gap-2 text-sm font-semibold text-(--lp-muted) transition-colors hover:text-(--lp-ink)">
      <ArrowLeftIcon className="h-4 w-4" /> {children}
    </button>
  );
  const StatTile = ({ label, value, note }) => (
    <div className="bg-white px-5 py-4">
      <div className="text-[10px] font-bold uppercase tracking-wider text-(--lp-muted)">{label}</div>
      <div className="mt-1 font-(family-name:--lp-font) text-2xl font-bold leading-none text-(--lp-ink)">{value}</div>
      <div className="mt-1 text-[11px] text-(--lp-muted)">{note}</div>
    </div>
  );
  const Hero = ({ eyebrow, title, children }) => (
    <div className="relative overflow-hidden rounded-[2rem] bg-(--lp-ink) px-6 py-6 text-white shadow-[0_24px_50px_-28px_rgba(15,17,21,0.6)] sm:px-8">
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-52 w-52 rounded-full bg-(--lp-blue)/40 blur-2xl" />
      <div className="relative">
        <span className="inline-flex rounded-full bg-(--lp-yellow) px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-ink)">{eyebrow}</span>
        <h1 className="mt-3 font-(family-name:--lp-font) text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm text-white/75">{children}</div>
      </div>
    </div>
  );

  const toastEl = toast && <div role="status" className="fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-(--lp-ink) px-5 py-3 text-sm font-semibold text-white shadow-2xl">{toast}</div>;
  const lockedBanner = locked && (
    <div className="mb-5 flex items-start gap-3 rounded-2xl bg-(--lp-blue-tint) px-5 py-4 text-(--lp-blue-deep)">
      <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
      <p className="text-sm font-semibold">This series is locked.</p>
    </div>
  );

  // =========================================================== Test level
  if (test) {
    const questions = test.questions;
    const r = readiness(test);
    const st = statusOf(test, series);
    const marksUsed = quizPoints(questions);
    const editingQuestion = qEditor?.questionId ? questions.find((q) => q.id === qEditor.questionId) : null;
    return (
      <div className="pb-12">
        <Back onClick={() => setTestId(null)}>Back to {series.title || "test series"}</Back>
        {lockedBanner}
        <Hero eyebrow="Manage questions" title={test.title || "Untitled test"}>
          <span>{test.duration} min · {totalMarksOf(test)} marks · Passing: {passingMarksOf(test)}</span>
          <Pill status={st} />
        </Hero>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)">Overview</span>
          <div className="flex flex-wrap gap-2">
            <button type="button" className={btnGhost} onClick={() => setPreviewOpen(true)}><span className="inline-flex items-center gap-1.5"><EyeIcon className="h-3.5 w-3.5" /> Preview Test</span></button>
            <button type="button" className={btnGhost} disabled={locked} onClick={() => (st === "published" ? unpublishTest(test) : publishTest(test))}>{st === "published" ? "Unpublish" : "Publish"}</button>
            <button type="button" className={btnPrimary} disabled={locked} onClick={() => setQEditor({ questionId: null })}><span className="inline-flex items-center gap-1.5"><PlusIcon className="h-3.5 w-3.5" /> Add Question</span></button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[1.5rem] bg-(--lp-line) ring-1 ring-(--lp-line) lg:grid-cols-4">
          <StatTile label="Questions" value={questions.length} note="In this Test" />
          <StatTile label="Marks allocated" value={`${marksUsed} / ${totalMarksOf(test)}`} note={marksUsed === totalMarksOf(test) ? "Fully allocated" : "Set in test details"} />
          <StatTile label="Scheduled" value={<span className="text-sm">{test.scheduledAt ? new Date(test.scheduledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}</span>} note="Start date" />
          <StatTile label="Attempt limit" value={test.attemptLimit || 1} note="Attempts per student" />
        </div>

        {!r.valid && (
          <div className="mt-5 rounded-2xl bg-danger/10 px-5 py-4 text-sm text-danger">
            <strong>Not ready to publish yet:</strong>
            <ul className="mt-1 list-disc pl-5">{r.errors.map((e) => <li key={e}>{e}</li>)}</ul>
          </div>
        )}

        <div className="mt-5 rounded-[1.75rem] bg-white p-2 shadow-[0_18px_40px_-30px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line) sm:p-3">
          {questions.length === 0 ? (
            <p className="px-4 py-12 text-center text-sm text-(--lp-muted)">No Questions yet. Click "Add Question" to build this Test.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-(--lp-line) text-[10px] font-bold uppercase tracking-wider text-(--lp-muted)">
                    <th className="w-12 px-4 py-3">#</th><th className="px-3 py-3">Question</th><th className="px-3 py-3">Type</th><th className="px-3 py-3">Subject / Topic</th><th className="px-3 py-3">Marks</th><th className="px-3 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {questions.map((q, i) => (
                    <tr key={q.id} className="border-b border-(--lp-line) last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-(--lp-muted)">{i + 1}</td>
                      <td className="max-w-[22rem] px-3 py-3.5"><span className="line-clamp-2 font-medium text-(--lp-ink)">{htmlToPlain(q.text) || "—"}</span></td>
                      <td className="px-3 py-3.5">
                        <span className="rounded-full bg-(--lp-blue-tint) px-2.5 py-1 text-[11px] font-bold text-(--lp-blue-deep)">{isSubjective(q.type) ? "Subjective" : "Objective (MCQ)"}</span>
                        <div className="mt-1 text-[11px] text-(--lp-muted)">{difficultyLabel(q.difficulty)}</div>
                      </td>
                      <td className="px-3 py-3.5 text-(--lp-muted)">{[q.subject, q.topic].filter(Boolean).join(" · ") || "—"}</td>
                      <td className="px-3 py-3.5 font-semibold text-(--lp-ink)">{q.points}</td>
                      <td className="px-3 py-3.5">
                        <div className="flex justify-end gap-2">
                          <button type="button" disabled={locked} onClick={() => setQEditor({ questionId: q.id })} className={`${btnGhost} !px-3 !py-1.5 text-xs`}><span className="inline-flex items-center gap-1"><PencilIcon className="h-3 w-3" /> Edit</span></button>
                          <button type="button" disabled={locked} onClick={() => setDeleteQ(q)} className="rounded-full bg-danger/10 px-3 py-1.5 text-xs font-bold text-danger transition-colors hover:bg-danger/20 disabled:opacity-50">Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {qEditor && (
          <TestQuestionEditor
            key={qEditor.questionId || "new"}
            initial={editingQuestion}
            defaults={{ subject: series.subjects[0] || "", topic: (test.topics || [])[0] || "" }}
            onClose={() => setQEditor(null)}
            onSave={(q) => {
              setQuestions(test.id, editingQuestion ? questions.map((x) => (x.id === q.id ? q : x)) : [...questions, q]);
              setToast(editingQuestion ? "Question updated." : "Question added.");
              setQEditor(null);
            }}
          />
        )}

        {previewOpen && (
          <Drawer title={`Preview — ${test.title}`} subtitle="This is how the Test will appear to students." onClose={() => setPreviewOpen(false)}>
            {questions.length === 0 ? (
              <p className="py-10 text-center text-sm text-(--lp-muted)">No Questions to preview yet.</p>
            ) : (
              <ol className="space-y-4">
                {questions.map((q, i) => (
                  <li key={q.id} className="rounded-2xl bg-(--lp-grey) p-4">
                    <div className="text-sm font-bold text-(--lp-ink)">Q{i + 1}. {htmlToPlain(q.text)}</div>
                    {q.image && <img src={q.image} alt={`Question ${i + 1} attachment`} className="mt-2 max-h-48 rounded-xl" />}
                    {isSubjective(q.type) ? (
                      <p className="mt-2 rounded-xl border border-dashed border-(--lp-line) bg-white px-3 py-4 text-xs text-(--lp-muted)">Answer box shown to the student.</p>
                    ) : (
                      <ul className="mt-2 space-y-1.5">
                        {(q.options || []).map((o, oi) => (
                          <li key={o.id} className={`rounded-xl px-3 py-2 text-sm ${o.correct ? "bg-[#e3f5ec] font-semibold text-[#1f9d6b]" : "bg-white text-(--lp-ink)"}`}>{"ABCD"[oi]}. {o.text}</li>
                        ))}
                      </ul>
                    )}
                    <div className="mt-2 text-[11px] font-semibold text-(--lp-muted)">{q.points} marks{!isSubjective(q.type) && q.negativeMarks ? ` · −${q.negativeMarks} negative` : ""}</div>
                  </li>
                ))}
              </ol>
            )}
          </Drawer>
        )}

        <Modal
          open={Boolean(deleteQ)}
          onClose={() => setDeleteQ(null)}
          title="Delete this Question?"
          footer={
            <>
              <Button fullWidth={false} className="!bg-danger px-6" onClick={() => { setQuestions(test.id, questions.filter((x) => x.id !== deleteQ.id)); setToast("Question deleted."); setDeleteQ(null); }}>Delete Question</Button>
              <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setDeleteQ(null)}>Cancel</Button>
            </>
          }
        >
          <p className="text-sm text-(--lp-muted)">This Question will be permanently removed from the Test. This cannot be undone.</p>
        </Modal>
        {toastEl}
      </div>
    );
  }

  // =========================================================== Series level
  return (
    <div className="pb-12">
      <Back onClick={() => navigate("/teacher/testseries")}>Back to Test Series</Back>
      {lockedBanner}
      <Hero eyebrow="Manage tests" title={series.title || "Untitled test series"}>
        <span>{series.subjects[0] || "—"} · {series.audienceLevel || "All learners"}</span>
        <SeriesStatusBadge series={series} size="sm" />
      </Hero>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)">Overview</span>
        <button type="button" disabled={locked} onClick={openCreate} className={btnPrimary}><span className="inline-flex items-center gap-1.5"><PlusIcon className="h-3.5 w-3.5" /> Create Test</span></button>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-px overflow-hidden rounded-[1.5rem] bg-(--lp-line) ring-1 ring-(--lp-line) lg:grid-cols-4">
        <StatTile label="Total tests" value={tests.length} note="In this Test Series" />
        <StatTile label="Total questions" value={totalQuestions} note="Across all Tests" />
        <StatTile label="Enrollment" value={(series.enrollments || 0).toLocaleString("en-IN")} note="Students enrolled" />
        <StatTile label="Avg. performance" value={series.avgPerformance != null ? `${series.avgPerformance}%` : "—"} note="Across all attempts" />
      </div>

      <div className="mt-5 rounded-[1.75rem] bg-white p-2 shadow-[0_18px_40px_-30px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line) sm:p-3">
        {tests.length === 0 ? (
          <p className="px-4 py-12 text-center text-sm text-(--lp-muted)">No Tests in this Test Series yet. Create one to get started.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-(--lp-line) text-[10px] font-bold uppercase tracking-wider text-(--lp-muted)">
                  <th className="px-4 py-3">Test</th><th className="px-3 py-3">Questions</th><th className="px-3 py-3">Duration</th><th className="px-3 py-3">Marks</th><th className="px-3 py-3">Scheduled</th><th className="px-3 py-3">Status</th><th className="px-3 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t) => {
                  const st = statusOf(t, series);
                  return (
                    <tr key={t.id} className="border-b border-(--lp-line) last:border-0">
                      <td className="px-4 py-3.5 font-semibold text-(--lp-ink)">{t.title || "Untitled test"}</td>
                      <td className="px-3 py-3.5">{t.questions.length}</td>
                      <td className="px-3 py-3.5">{t.duration} min</td>
                      <td className="px-3 py-3.5">{passingMarksOf(t)} / {totalMarksOf(t)}</td>
                      <td className="px-3 py-3.5 text-xs text-(--lp-muted)">{fmtWhen(t.scheduledAt)}</td>
                      <td className="px-3 py-3.5"><Pill status={st} /></td>
                      <td className="px-3 py-3.5">
                        <div className="flex items-center justify-end gap-2">
                          <button type="button" onClick={() => setTestId(t.id)} className={`${btnGhost} !px-3 !py-1.5 text-xs`}>Manage Questions</button>
                          <button type="button" disabled={locked} onClick={() => openEdit(t)} aria-label="Edit test" className="grid h-8 w-8 place-items-center rounded-full text-(--lp-muted) transition-colors hover:bg-(--lp-blue-tint) hover:text-(--lp-blue-deep) disabled:opacity-40"><PencilIcon className="h-3.5 w-3.5" /></button>
                          <div className="relative">
                            <button type="button" onClick={(e) => { e.stopPropagation(); setMenuId(menuId === t.id ? null : t.id); }} aria-label="More actions" className="grid h-8 w-8 place-items-center rounded-full text-(--lp-muted) transition-colors hover:bg-(--lp-blue-tint)">
                              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor"><circle cx="5" cy="12" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="19" cy="12" r="1.6" /></svg>
                            </button>
                            {menuId === t.id && (
                              <div onClick={(e) => e.stopPropagation()} className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-2xl bg-white p-1.5 text-sm shadow-[0_20px_50px_-18px_rgba(15,17,21,0.45)] ring-1 ring-(--lp-line)">
                                {[
                                  { label: "Publish", icon: CheckIcon, run: () => publishTest(t), off: locked },
                                  { label: "Unpublish", icon: EyeOffIcon, run: () => unpublishTest(t), off: locked },
                                  { label: "Duplicate", icon: CopyIcon, run: () => duplicateTest(t), off: locked },
                                  { label: "View Details", icon: EyeIcon, run: () => setViewTarget(t) },
                                  { label: "Delete", icon: TrashIcon, run: () => setDeleteTarget(t), danger: true, off: locked },
                                ].map(({ label, icon: Icon, run, danger, off }) => (
                                  <button key={label} type="button" disabled={off} onClick={() => { run(); setMenuId(null); }} className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left font-medium transition-colors disabled:opacity-40 ${danger ? "text-danger hover:bg-danger/10" : "text-(--lp-ink) hover:bg-(--lp-blue-tint)"}`}>
                                    <Icon className="h-3.5 w-3.5" /> {label}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Create / Edit Test */}
      {formOpen && (
        <Drawer
          title={formOpen === "edit" ? "Edit Test" : "Create Test"}
          subtitle={formOpen === "create" ? "Fill in the test details, then add Questions next." : "Fill in the test details. You can save as a draft and publish later."}
          onClose={closeForm}
          footer={
            <>
              <button type="button" className={btnGhost} onClick={closeForm}>Cancel</button>
              {formOpen === "create" ? (
                <button type="button" className={btnPrimary} onClick={saveAndManageQuestions}>Next</button>
              ) : (
                <>
                  <button type="button" className={btnGhost} onClick={saveDraft}>Save as Draft</button>
                  <button type="button" className={btnPrimary} onClick={saveAndPublish}>Publish</button>
                </>
              )}
            </>
          }
        >
          <div className="space-y-4">
            {formErrors.length > 0 && (
              <div className="rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
                <strong>Fix the following before publishing:</strong>
                <ul className="mt-1 list-disc pl-5">{formErrors.map((e) => <li key={e}>{e}</li>)}</ul>
              </div>
            )}
            <Field label="Test Name"><input className={input} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Physics Full Mock Test 1" /></Field>
            <Field label="Instructions"><textarea rows={3} className={input} value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Instructions shown to students before starting this test" /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Duration (minutes)"><input type="number" min="1" className={input} value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 60" /></Field>
              <Field label="Attempt Limit"><input type="number" min="1" className={input} value={form.attemptLimit} onChange={(e) => setForm({ ...form, attemptLimit: e.target.value })} placeholder="e.g. 2" /></Field>
              <Field label="Total Marks"><input type="number" min="1" className={input} value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} placeholder="e.g. 40" /></Field>
              <Field label="Passing Marks"><input type="number" min="1" className={input} value={form.passingMarks} onChange={(e) => setForm({ ...form, passingMarks: e.target.value })} placeholder="e.g. 16" /></Field>
            </div>
            <Field label="Scheduled Date & Time"><input type="datetime-local" className={input} value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Shuffle Questions"><Segmented value={form.shuffleQuestions} onChange={(v) => setForm({ ...form, shuffleQuestions: v })} /></Field>
              <Field label="Shuffle Options"><Segmented value={form.shuffleOptions} onChange={(v) => setForm({ ...form, shuffleOptions: v })} /></Field>
            </div>
          </div>
        </Drawer>
      )}

      {/* View Details */}
      {viewTarget && (
        <Drawer
          title={viewTarget.title}
          subtitle={viewTarget.instructions || "No instructions provided."}
          onClose={() => setViewTarget(null)}
          footer={
            <>
              <button type="button" className={btnGhost} onClick={() => setViewTarget(null)}>Back</button>
              {!locked && <button type="button" className={btnPrimary} onClick={() => { const t = viewTarget; setViewTarget(null); openEdit(t); }}>Edit</button>}
            </>
          }
        >
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["Status", <Pill key="s" status={statusOf(viewTarget, series)} />],
              ["Questions", viewTarget.questions.length],
              ["Duration", `${viewTarget.duration} min`],
              ["Total Marks", totalMarksOf(viewTarget)],
              ["Passing Marks", passingMarksOf(viewTarget)],
              ["Attempt Limit", viewTarget.attemptLimit || 1],
              ["Scheduled", fmtWhen(viewTarget.scheduledAt)],
              ["Shuffle Questions", viewTarget.shuffleQuestions ? "On" : "Off"],
              ["Shuffle Options", viewTarget.shuffleOptions ? "On" : "Off"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-2xl bg-(--lp-grey) px-4 py-3">
                <dt className="text-[10px] font-bold uppercase tracking-wider text-(--lp-muted)">{k}</dt>
                <dd className="mt-1 text-sm font-semibold text-(--lp-ink)">{v}</dd>
              </div>
            ))}
          </dl>
        </Drawer>
      )}

      <Modal
        open={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        title="Delete this Test?"
        footer={
          <>
            <Button fullWidth={false} className="!bg-danger px-6" onClick={confirmDelete}>Delete Test</Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setDeleteTarget(null)}>Cancel</Button>
          </>
        }
      >
        <p className="text-sm text-(--lp-muted)">"{deleteTarget?.title}" and all of its Questions will be permanently deleted. This cannot be undone.</p>
      </Modal>
      {toastEl}
    </div>
  );
}
