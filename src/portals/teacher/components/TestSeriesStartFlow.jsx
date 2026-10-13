// UNUSED -- no longer imported anywhere. The "Build from Course" / "Question Bank" / Duplicate / CSV / AI start paths
// were removed: test series are now built manually from scratch. Safe to delete this file.
// "How do you want to build this?" — the first step of creating a test series
// (and of starting an assigned one). Two parts:
//   1. Type: Course-wise (tied to one of your courses) or My own (standalone).
//      Assigned series skip this; their origin and scope are locked.
//   2. Method: scratch, duplicate, import CSV, question bank, AI outline.
// Nothing is created until "Start building", so backing out leaves no stray drafts.
import { useMemo, useState } from "react";
import Button from "../../../components/ui/Button";
import Checkbox from "../../../components/ui/Checkbox";
import IconBadge from "../../../components/ui/IconBadge";
import UnsavedChangesModal from "./UnsavedChangesModal";
import useUnsavedGuard from "../hooks/useUnsavedGuard";
import { AdminAvatar, OriginTags } from "./TestSeriesStatus";
import { AiPanel, BankPanel, DuplicatePanel, ImportPanel } from "./BuildMethodPanels";
import { BookIcon, QuizIcon, PencilIcon, DuplicateIcon, UploadIcon, PackageIcon, SparkleIcon, UsersIcon, CheckIcon, FlagIcon } from "../../../components/ui/icons";
import { formatDate, makeId, newSection, newTest } from "../data/testSeriesData";
import { QUESTION_BANK, cloneBankQuestions } from "../data/questionBankData";
import { BUILD_METHODS, cloneSections, outlineToSections, structureFromCourse, suggestFromCourse } from "../data/testSeriesBuildTools";

const METHOD_ICONS = { scratch: PencilIcon, duplicate: DuplicateIcon, import: UploadIcon, bank: PackageIcon, ai: SparkleIcon };

function BigOption({ icon: Icon, tone, title, children, active, onSelect, disabled }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      disabled={disabled}
      onClick={onSelect}
      className={`flex w-full flex-col items-start gap-3 rounded-3xl border-2 p-5 text-left transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 sm:p-6 ${
        active ? "border-primary bg-primary/[0.05] shadow-card" : "border-transparent bg-surface shadow-soft hover:-translate-y-0.5 hover:shadow-card"
      }`}
    >
      <div className="flex w-full items-center justify-between">
        <IconBadge icon={Icon} tone={tone} />
        <span aria-hidden="true" className={`flex h-6 w-6 items-center justify-center rounded-full border ${active ? "border-primary bg-primary text-white" : "border-text/20"}`}>
          {active && <CheckIcon className="h-3.5 w-3.5" />}
        </span>
      </div>
      <div>
        <h3 className="text-base font-bold text-text">{title}</h3>
        <div className="mt-1 text-sm text-muted">{children}</div>
      </div>
    </button>
  );
}

function Panel({ eyebrow, title, children }) {
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-soft sm:p-7">
      <span className="eyebrow">{eyebrow}</span>
      <h2 className="mb-4 mt-1 text-lg font-bold text-text">{title}</h2>
      {children}
    </section>
  );
}

export default function TestSeriesStartFlow({ mode = "new", series = null, courses = [], teacherSeries = [], onComplete, onCancel }) {
  const assigned = mode === "assigned" && series;
  const [scope, setScope] = useState(assigned ? series.scope : null);
  const [courseId, setCourseId] = useState(assigned ? series.courseId : null);
  const [prefillModules, setPrefillModules] = useState(true);
  const [method, setMethod] = useState(null);
  const [dupId, setDupId] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [bankIds, setBankIds] = useState([]);
  const [outline, setOutline] = useState(null);

  const course = courses.find((c) => c.id === courseId) || null;
  const suggestion = useMemo(() => (course ? suggestFromCourse(course) : null), [course]);
  const liveCourses = courses.filter((c) => c.status !== "archived");
  const candidates = teacherSeries.filter((s) => s.id !== series?.id && s.status !== "assigned");

  const dirty = Boolean((importResult && importResult.okCount) || bankIds.length || outline);
  const guard = useUnsavedGuard(dirty);

  // What's still missing before "Start building" enables.
  const missing = [];
  if (!scope) missing.push("choose a series type");
  if (scope === "course" && !courseId) missing.push("pick a course");
  if (!method) missing.push("choose a building method");
  if (method === "duplicate" && !dupId) missing.push("pick a series to copy");
  if (method === "import" && !(importResult && importResult.okCount > 0)) missing.push("upload a CSV with at least one valid row");
  if (method === "bank" && bankIds.length === 0) missing.push("select at least one bank question");
  if (method === "ai" && !(outline && outline.sections.length > 0 && outline.sections.every((s) => s.title.trim() && s.tests.every((t) => t.title.trim())))) missing.push("generate an outline and name every section and test");

  function finish() {
    if (missing.length) return;
    let patch = {};
    if (scope === "course" && suggestion && !assigned) {
      patch = { title: suggestion.title, shortDescription: suggestion.shortDescription, subjects: suggestion.subjects, difficulty: suggestion.difficulty, languages: suggestion.languages, exams: suggestion.exams, grades: suggestion.grades };
    }
    if (scope === "course" && suggestion) patch.courseTopics = suggestion.topics;
    if (method === "scratch" && scope === "course" && course && prefillModules) patch.sections = structureFromCourse(course);
    if (method === "duplicate") {
      const src = teacherSeries.find((s) => s.id === dupId);
      if (src) {
        patch.sections = cloneSections(src.sections);
        if (!assigned) Object.assign(patch, { title: `${src.title} (copy)`, shortDescription: src.shortDescription, grades: [...src.grades], subjects: [...src.subjects], exams: [...src.exams], difficulty: src.difficulty, languages: [...src.languages] });
      }
    }
    if (method === "import") {
      const t = { ...newTest(), title: "Imported questions", type: "Topic", duration: 30, locked: false, questions: importResult.questions };
      const sec = newSection("Imported questions");
      sec.tests = [t];
      patch.sections = [sec];
    }
    if (method === "bank") {
      const picked = QUESTION_BANK.filter((q) => bankIds.includes(q.id));
      const t = { ...newTest(), title: "Question bank picks", type: "Topic", duration: Math.max(10, picked.length * 2), locked: false, questions: cloneBankQuestions(picked) };
      const sec = newSection("Practice Tests");
      sec.tests = [t];
      patch.sections = [sec];
    }
    if (method === "ai") {
      patch.sections = outlineToSections(outline);
      if (!assigned) {
        patch.difficulty = outline.difficulty;
        if (!patch.title) patch.title = `${outline.topicTags[0].replace(/ fundamentals$/, "")} — Test Series`;
      }
    }
    onComplete({ scope, courseId: scope === "course" ? courseId : null, method, patch, id: makeId("start") });
  }

  return (
    <div className="pb-16">
      <div className="border-b border-text/[0.07] pb-6">
        <div className="eyebrow mb-1.5">{assigned ? "Assigned series" : "Create"}</div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">How do you want to build this?</h1>
        <p className="mt-1.5 text-sm text-muted">{assigned ? "Pick how you'd like to get started. You can change anything later." : "Choose the kind of series, then how to start. Nothing is created until you press Start building."}</p>
      </div>

      <div className="mt-8 flex flex-col gap-6">
        {assigned ? (
          <section className="relative overflow-hidden rounded-3xl bg-surface p-5 shadow-soft ring-2 ring-secondary/40 sm:p-7">
            <span className="absolute right-0 top-0 inline-flex items-center gap-1.5 rounded-bl-2xl bg-secondary px-4 py-1.5 text-[11px] font-bold uppercase tracking-wide text-white">
              <FlagIcon className="h-3 w-3" />
              Assigned by admin
            </span>
            <span className="eyebrow">Locked</span>
            <h2 className="mt-1 pr-32 text-lg font-bold text-text">{series.title}</h2>
            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted">
              <span className="inline-flex items-center gap-2"><AdminAvatar name={series.assignment.assignedBy.name} size="h-7 w-7" />{series.assignment.assignedBy.name}</span>
              <span>Due {formatDate(series.assignment.requiredDeadline)}</span>
            </div>
            <OriginTags series={series} className="mt-3" />
            <p className="mt-3 text-sm text-muted">
              {series.scope === "course" ? `This series is tied to ${course?.title || "a course"}; enrolled students get access by default.` : "This is a standalone series with its own pricing and audience."} The admin set the type and deadline, so they can't be changed here.
            </p>
          </section>
        ) : (
          <Panel eyebrow="Step 1" title="What kind of series is it?">
            <div role="radiogroup" aria-label="Series type" className="grid gap-4 md:grid-cols-2">
              <BigOption icon={BookIcon} tone="blue" title="Course-wise test series" active={scope === "course"} onSelect={() => setScope("course")}>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Tied to one of your courses</li>
                  <li>Syllabus, modules and topic tags are suggested from the course</li>
                  <li>Enrolled students get access by default</li>
                </ul>
              </BigOption>
              <BigOption icon={QuizIcon} tone="lavender" title="My own test series" active={scope === "standalone"} onSelect={() => { setScope("standalone"); setCourseId(null); }}>
                <ul className="list-disc space-y-1 pl-4">
                  <li>Standalone, not linked to a course</li>
                  <li>Set your own pricing and audience</li>
                  <li>Students buy or join it independently</li>
                </ul>
              </BigOption>
            </div>

            {scope === "course" && (
              <div className="mt-6">
                <span className="mb-2 block text-sm font-medium text-text">Which course is it for?</span>
                {liveCourses.length === 0 ? (
                  <p className="rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">You don't have a course to attach it to yet. Choose "My own test series" instead.</p>
                ) : (
                  <div role="radiogroup" aria-label="Course" className="grid gap-2.5 md:grid-cols-2">
                    {liveCourses.map((c) => {
                      const active = courseId === c.id;
                      return (
                        <label key={c.id} className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors duration-150 ${active ? "border-primary bg-primary/[0.06]" : "border-text/12 bg-surface hover:border-primary/50"}`}>
                          <input type="radio" name="course" checked={active} onChange={() => setCourseId(c.id)} className="mt-1 accent-[var(--color-primary)]" />
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-text">{c.title}</span>
                            <span className="flex items-center gap-1 text-xs text-muted"><UsersIcon className="h-3 w-3" />{(c.students || []).length} enrolled · {(c.modules || []).length} modules</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                )}
                {suggestion && (
                  <div className="mt-4 rounded-2xl bg-pastel-blue/60 p-4 text-sm text-pastel-blue-ink">
                    <div className="flex items-center gap-2 font-bold"><SparkleIcon className="h-4 w-4" />Suggested from this course</div>
                    <p className="mt-1 text-xs">Subject: {suggestion.subjects.join(", ")} · Difficulty: {suggestion.difficulty} · Language: {suggestion.languages.join(", ")}.</p>
                    {suggestion.topics.length > 0 && <p className="mt-1 text-xs">Topic tags: {suggestion.topics.slice(0, 6).join(", ")}{suggestion.topics.length > 6 ? "…" : ""}.</p>}
                    <p className="mt-1 text-xs">{suggestion.enrolled} enrolled student{suggestion.enrolled === 1 ? "" : "s"} will get access automatically. You can edit everything in the next step.</p>
                    {method === "scratch" && suggestion.modules.length > 0 && (
                      <Checkbox className="mt-3 text-pastel-blue-ink" checked={prefillModules} onChange={(e) => setPrefillModules(e.target.checked)} label={`Create one test per course module (${suggestion.modules.length})`} />
                    )}
                  </div>
                )}
              </div>
            )}
          </Panel>
        )}

        <Panel eyebrow={assigned ? "Step 1" : "Step 2"} title="How would you like to start?">
          <div role="radiogroup" aria-label="Building method" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {BUILD_METHODS.map((m) => (
              <BigOption key={m.key} icon={METHOD_ICONS[m.key]} tone={m.key === "ai" ? "pink" : m.key === "import" ? "orange" : m.key === "bank" ? "sage" : "maroon"} title={m.title} active={method === m.key} onSelect={() => setMethod(m.key)}>
                {m.desc}
              </BigOption>
            ))}
          </div>

          {method && method !== "scratch" && (
            <div className="mt-6 rounded-3xl bg-bg p-4 sm:p-5">
              {method === "duplicate" && <DuplicatePanel candidates={candidates} selectedId={dupId} onSelect={setDupId} />}
              {method === "import" && <ImportPanel result={importResult} onResult={setImportResult} />}
              {method === "bank" && <BankPanel selectedIds={bankIds} onChange={setBankIds} />}
              {method === "ai" && <AiPanel outline={outline} onOutline={setOutline} defaultTopic={series?.subjects?.[0] || course?.title || ""} />}
            </div>
          )}
          {method === "scratch" && <p className="mt-5 rounded-2xl bg-bg px-4 py-3 text-sm text-muted">You'll start with an empty series and add sections, tests and questions yourself.</p>}
        </Panel>
      </div>

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-text/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => guard.go(onCancel.to)}>
          {onCancel.label}
        </Button>
        <div className="flex flex-col gap-2 sm:items-end">
          <Button fullWidth={false} className="px-8" disabled={missing.length > 0} onClick={finish}>
            Start building
          </Button>
          {missing.length > 0 && <span className="text-xs text-muted">To continue: {missing.join(", ")}.</span>}
        </div>
      </div>

      <UnsavedChangesModal open={Boolean(guard.pending)} onLeave={guard.leave} onStay={guard.stay} />
    </div>
  );
}
