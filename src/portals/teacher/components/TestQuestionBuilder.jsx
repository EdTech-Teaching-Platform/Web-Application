// Step 3 — Question Builder for ONE test. Opens as a dedicated panel: a
// full-screen sheet on small viewports and a large slide-over on desktop
// (same backdrop + translate-in convention as the other slide-overs).
// Objective types mirror LessonContentPanel's QuizEditor (option rows with
// correct-answer marking, live count + points totals). Subjective types add
// a rich-text model answer, a suggested word limit and a rubric whose shape
// ({ id, label, points }) is IDENTICAL to Assignment rubrics, so the same
// GradingPanel can grade a Test Series submission with it.
import { useEffect, useMemo, useState } from "react";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import Select from "../../../components/ui/Select";
import Input from "../../../components/ui/Input";
import Button from "../../../components/ui/Button";
import QuestionImageUpload, { OptionImageUpload } from "./QuestionImageUpload";
import { XIcon, PlusIcon, TrashIcon, DuplicateIcon, GripIcon, ChevronDownIcon, AlertTriangleIcon, QuizIcon, LockIcon } from "../../../components/ui/icons";
import {
  QUESTION_TYPES,
  TS_DIFFICULTIES,
  isSubjective,
  makeId,
  newQuestion,
  questionErrors,
  questionTypeMeta,
  quizPoints,
  stripHtml,
} from "../data/testSeriesData";

function reorder(list, from, to) {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

// Switching type keeps the shared fields and resets the type-specific ones.
function retype(q, type) {
  const fresh = newQuestion(type);
  const keepPoints = isSubjective(q.type) === isSubjective(type);
  // The question image belongs to the stem, so it survives a type change (option images do not).
  return { ...fresh, id: q.id, text: q.text, ...(q.image ? { image: q.image } : {}), difficulty: q.difficulty, topic: q.topic, explanation: q.explanation, points: keepPoints ? q.points : fresh.points };
}

function FieldError({ children }) {
  if (!children) return null;
  return <span className="mt-1.5 block text-xs text-danger">{children}</span>;
}

function QuestionCard({ question: q, index, total, topicListId, expanded, readOnly = false, onToggle, onUpdate, onDuplicate, onDelete, onMove, dragProps, dragging, dragOver, arm, disarm }) {
  const [dirty, setDirty] = useState(false);
  const errs = questionErrors(q);
  const shown = dirty ? errs : [];
  const meta = questionTypeMeta(q.type);
  const subjective = isSubjective(q.type);
  const textErr = shown.find((e) => e.startsWith("Question text"));
  const pointsErr = shown.find((e) => e.startsWith("Points"));
  const answerErrs = shown.filter((e) => e !== textErr && e !== pointsErr);

  function update(patch) {
    setDirty(true);
    onUpdate(patch);
  }
  function setOption(oid, patch) {
    update({ options: q.options.map((o) => (o.id === oid ? { ...o, ...patch } : o)) });
  }
  function markCorrect(oid) {
    if (q.type === "mcq_multi") setOption(oid, { correct: !q.options.find((o) => o.id === oid).correct });
    else update({ options: q.options.map((o) => ({ ...o, correct: o.id === oid })) });
  }
  const rubric = q.rubric || [];
  const rubricTotal = rubric.reduce((s, r) => s + (Number(r.points) || 0), 0);
  function setCriterion(cid, patch) {
    update({ rubric: rubric.map((r) => (r.id === cid ? { ...r, ...patch } : r)) });
  }

  return (
    <div
      {...dragProps}
      className={`rounded-3xl bg-surface shadow-soft ring-1 transition-all duration-200 ${dragging ? "opacity-40" : "ring-text/[0.06]"} ${dragOver ? "ring-2 ring-primary/40" : ""}`}
    >
      <div className="flex items-center gap-2.5 px-3.5 py-3">
        <span onMouseDown={arm} onMouseUp={disarm} className="cursor-grab text-text/25 hover:text-text/50 active:cursor-grabbing" title="Drag to reorder" aria-label="Drag to reorder question">
          <GripIcon />
        </span>
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">{index + 1}</span>
        <button type="button" onClick={onToggle} className="min-w-0 flex-1 text-left" aria-expanded={expanded}>
          <p className="truncate text-sm font-semibold text-text">{stripHtml(q.text) || "Untitled question"}</p>
          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted">
            <span className="font-semibold text-primary">{meta.short}</span>
            <span>{Number(q.points) || 0} pt{Number(q.points) === 1 ? "" : "s"}</span>
            <span>{q.difficulty}</span>
            {(q.image || (q.options || []).some((o) => o.image)) && <span className="rounded-full bg-primary/[0.07] px-2 py-0.5 text-[10px] font-semibold text-primary">Image</span>}
            {q.topic && <span className="truncate">· {q.topic}</span>}
            {errs.length > 0 && (
              <span className="inline-flex items-center gap-1 font-semibold text-danger">
                <AlertTriangleIcon className="h-3 w-3" />
                {errs.length} to fix
              </span>
            )}
          </p>
        </button>
        {!readOnly && (
          <div className="flex shrink-0 items-center">
            <button type="button" onClick={() => onMove(-1)} disabled={index === 0} aria-label="Move question up" className="rounded-full p-1.5 text-muted hover:bg-bg disabled:opacity-30">
              <ChevronDownIcon className="h-4 w-4 rotate-180" />
            </button>
            <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} aria-label="Move question down" className="rounded-full p-1.5 text-muted hover:bg-bg disabled:opacity-30">
              <ChevronDownIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={onDuplicate} aria-label="Duplicate question" className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
              <DuplicateIcon className="h-4 w-4" />
            </button>
            <button type="button" onClick={onDelete} aria-label="Delete question" className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>

      <div className={`grid transition-all duration-300 ease-out ${expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"}`}>
        <div className="min-h-0 overflow-hidden">
          {expanded && (
            <div inert={readOnly} className="flex flex-col gap-5 border-t border-text/[0.06] px-4 pb-5 pt-4">
              <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
                <label className="block">
                  <span className="mb-1.5 block text-sm font-medium text-text">Question type</span>
                  <Select
                    wrapperClassName="block w-full"
                    value={q.type}
                    onChange={(e) => {
                      setDirty(false);
                      onUpdate(retype(q, e.target.value));
                    }}
                    className="w-full rounded-full border border-text/15 bg-bg px-4 py-3 pr-10 text-sm"
                  >
                    {QUESTION_TYPES.map((t) => (
                      <option key={t.key} value={t.key}>
                        {t.label}
                      </option>
                    ))}
                  </Select>
                </label>
                <Input label="Points" type="number" min={0} value={q.points} onChange={(e) => update({ points: e.target.value === "" ? "" : Number(e.target.value) })} error={pointsErr} shape="rect" />
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-text">Question</span>
                <RichTextEditor key={`${q.id}-text`} value={q.text} onChange={(html) => update({ text: html })} placeholder="Type the question…" minHeight={100} />
                <FieldError>{textErr}</FieldError>
                <div className="mt-3">
                  <span className="mb-1.5 block text-sm font-medium text-text">Image <span className="font-normal text-muted">(optional)</span></span>
                  <QuestionImageUpload image={q.image} onChange={(image) => update({ image })} disabled={readOnly} />
                </div>
              </div>

              {(q.type === "mcq_single" || q.type === "mcq_multi") && (
                <div className="flex flex-col gap-2">
                  <span className="text-sm font-medium text-text">
                    Options <span className="font-normal text-muted">— {q.type === "mcq_multi" ? "tick every correct answer" : "select the correct answer"}</span>
                  </span>
                  {q.options.map((o, oi) => (
                    <div key={o.id} className="flex items-center gap-2">
                      <input
                        type={q.type === "mcq_multi" ? "checkbox" : "radio"}
                        name={`correct-${q.id}`}
                        checked={o.correct}
                        onChange={() => markCorrect(o.id)}
                        aria-label={`Mark option ${oi + 1} as correct`}
                        className="h-4 w-4 shrink-0 accent-[var(--color-primary)]"
                      />
                      <input
                        value={o.text}
                        onChange={(e) => setOption(o.id, { text: e.target.value })}
                        placeholder={`Option ${oi + 1}`}
                        className={`min-w-0 flex-1 rounded-xl border bg-bg px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 ${o.correct ? "border-success/50" : "border-text/15"}`}
                      />
                      <OptionImageUpload image={o.image} onChange={(image) => setOption(o.id, { image })} disabled={readOnly} label={`option ${oi + 1}`} />
                      <button
                        type="button"
                        onClick={() => update({ options: q.options.filter((x) => x.id !== o.id) })}
                        disabled={q.options.length <= 2}
                        aria-label="Remove option"
                        className="text-muted hover:text-danger disabled:opacity-30"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => update({ options: [...q.options, { id: makeId("o"), text: "", correct: false }] })}
                    disabled={q.options.length >= 8}
                    className="flex items-center justify-center gap-1.5 rounded-full border border-dashed border-text/25 py-2 text-xs font-semibold text-primary hover:border-primary hover:bg-primary/[0.04] disabled:opacity-40"
                  >
                    <PlusIcon className="h-3.5 w-3.5" /> Add option
                  </button>
                </div>
              )}

              {q.type === "true_false" && (
                <div>
                  <span className="mb-2 block text-sm font-medium text-text">Correct answer</span>
                  <SegmentedControl
                    options={["True", "False"]}
                    value={q.options.find((o) => o.correct)?.text}
                    onChange={(v) => update({ options: q.options.map((o) => ({ ...o, correct: o.text === v })) })}
                  />
                </div>
              )}

              {q.type === "numerical" && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <Input label="Correct answer" type="number" step="any" value={q.correctAnswer} onChange={(e) => update({ correctAnswer: e.target.value })} shape="rect" />
                  <Input label="Accepted tolerance (±)" type="number" min={0} step="any" value={q.tolerance} onChange={(e) => update({ tolerance: e.target.value === "" ? 0 : Number(e.target.value) })} helperText="0 means an exact match" shape="rect" />
                </div>
              )}

              {q.type === "fill_blank" && (
                <Input label="Accepted answer" value={q.correctAnswer} onChange={(e) => update({ correctAnswer: e.target.value })} helperText="Use a comma to accept more than one spelling, e.g. velocity, speed" shape="rect" />
              )}

              {subjective && (
                <>
                  <div>
                    <span className="mb-1.5 block text-sm font-medium text-text">Model answer <span className="font-normal text-muted">(teacher reference, not shown to students)</span></span>
                    <RichTextEditor key={`${q.id}-model`} value={q.modelAnswer} onChange={(html) => update({ modelAnswer: html })} placeholder="What a full-marks answer looks like…" minHeight={100} />
                  </div>
                  <Input
                    label={q.type === "long_answer" ? "Suggested word limit" : "Suggested word limit"}
                    type="number"
                    min={0}
                    value={q.wordLimit}
                    onChange={(e) => update({ wordLimit: e.target.value === "" ? "" : Number(e.target.value) })}
                    helperText="Shown to students as guidance; not enforced"
                    shape="rect"
                  />
                  <div className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold uppercase tracking-wide text-muted">Rubric (optional)</span>
                      <span className={`text-xs font-semibold ${rubric.length && rubricTotal !== Number(q.points) ? "text-danger" : "text-primary"}`}>
                        {rubricTotal} / {Number(q.points) || 0} pts
                      </span>
                    </div>
                    {rubric.length === 0 && <p className="text-xs text-muted">Without a rubric, you'll give one overall score when grading.</p>}
                    {rubric.map((r) => (
                      <div key={r.id} className="flex items-center gap-2">
                        <input
                          value={r.label}
                          onChange={(e) => setCriterion(r.id, { label: e.target.value })}
                          placeholder="Criterion — e.g. States the law with its condition"
                          className="flex-1 rounded-lg border border-text/15 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                        />
                        <input
                          type="number"
                          min={0}
                          value={r.points}
                          onChange={(e) => setCriterion(r.id, { points: Number(e.target.value) })}
                          aria-label="Criterion points"
                          className="w-20 rounded-lg border border-text/15 bg-white px-2.5 py-2 text-sm outline-none"
                        />
                        <button type="button" onClick={() => update({ rubric: rubric.filter((x) => x.id !== r.id) })} aria-label="Remove criterion" className="text-muted hover:text-danger">
                          <TrashIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => update({ rubric: [...rubric, { id: makeId("r"), label: "", points: 1 }] })}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-dashed border-text/25 py-2 text-xs font-semibold text-primary hover:border-primary hover:bg-primary/[0.04]"
                      >
                        <PlusIcon className="h-3.5 w-3.5" /> Add criterion
                      </button>
                      {rubric.length > 0 && rubricTotal !== Number(q.points) && rubricTotal > 0 && (
                        <button type="button" onClick={() => update({ points: rubricTotal })} className="rounded-full bg-primary/10 px-4 py-2 text-xs font-semibold text-primary hover:bg-primary/15">
                          Set points to {rubricTotal}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              <FieldError>{answerErrs.length ? answerErrs.join(" ") : undefined}</FieldError>

              <div className="grid gap-4 border-t border-text/[0.06] pt-4 sm:grid-cols-2">
                <div>
                  <span className="mb-2 block text-sm font-medium text-text">Difficulty</span>
                  <SegmentedControl options={TS_DIFFICULTIES} value={q.difficulty} onChange={(difficulty) => update({ difficulty })} className="max-w-full flex-wrap" />
                </div>
                <Input
                  label="Topic / concept"
                  list={topicListId}
                  value={q.topic}
                  onChange={(e) => update({ topic: e.target.value })}
                  placeholder="e.g. Projectile Motion"
                  helperText="Feeds the “Topics covered” grid"
                  shape="rect"
                />
              </div>

              <div>
                <span className="mb-1.5 block text-sm font-medium text-text">Explanation <span className="font-normal text-muted">(optional)</span></span>
                <textarea
                  rows={2}
                  value={q.explanation}
                  onChange={(e) => update({ explanation: e.target.value })}
                  placeholder="Why is this the right answer? Shown to students after they submit."
                  className="w-full rounded-2xl border border-text/12 bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TestQuestionBuilder({ test, sectionTitle, topics, onChangeQuestions, onClose, readOnly = false, initialExpandedId = null, onFocusQuestion }) {
  const [entered, setEntered] = useState(false);
  const [expandedId, setExpandedId] = useState(test.questions.find((q) => q.id === initialExpandedId)?.id ?? test.questions[0]?.id ?? null);
  const [newType, setNewType] = useState("mcq_single");
  const [dragIdx, setDragIdx] = useState(null);
  const [overIdx, setOverIdx] = useState(null);
  const [armedIdx, setArmedIdx] = useState(null);

  useEffect(() => {
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, []);
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const questions = test.questions;
  const total = quizPoints(questions);
  const problems = useMemo(() => questions.filter((q) => questionErrors(q).length > 0).length, [questions]);
  const listId = `topics-${test.id}`;

  function add() {
    const q = newQuestion(newType);
    onChangeQuestions([...questions, q]);
    setExpandedId(q.id);
    onFocusQuestion?.(q.id);
  }
  function update(qid, patch) {
    onFocusQuestion?.(qid);
    onChangeQuestions(questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)));
  }
  function duplicate(q) {
    const copy = { ...JSON.parse(JSON.stringify(q)), id: makeId("q") };
    if (copy.options) copy.options = copy.options.map((o) => ({ ...o, id: makeId("o") }));
    if (copy.rubric) copy.rubric = copy.rubric.map((r) => ({ ...r, id: makeId("r") }));
    const i = questions.findIndex((x) => x.id === q.id);
    const next = [...questions];
    next.splice(i + 1, 0, copy);
    onChangeQuestions(next);
    setExpandedId(copy.id);
  }
  function drop() {
    if (dragIdx !== null && overIdx !== null && dragIdx !== overIdx) onChangeQuestions(reorder(questions, dragIdx, overIdx));
    setDragIdx(null);
    setOverIdx(null);
    setArmedIdx(null);
  }

  return (
    <div className="fixed inset-0 z-50">
      <button type="button" aria-label="Close question builder" onClick={onClose} className={`absolute inset-0 bg-text/45 transition-opacity duration-300 ease-out ${entered ? "opacity-100" : "opacity-0"}`} />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Questions for ${test.title || "test"}`}
        className={`absolute inset-0 flex flex-col bg-bg shadow-elevated transition-transform duration-300 ease-out lg:left-auto lg:w-[min(56rem,92vw)] lg:rounded-l-3xl ${entered ? "translate-x-0" : "translate-x-full"}`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-text/[0.07] bg-surface px-5 py-4 sm:px-6 lg:rounded-tl-3xl">
          <div className="min-w-0">
            <div className="eyebrow mb-1">{sectionTitle || "Questions"}</div>
            <h2 className="truncate text-lg font-bold text-text">{test.title || "Untitled test"}</h2>
            <p className="mt-0.5 text-xs text-muted">
              {test.type} · {test.duration || 0} min
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-bg hover:text-text">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          <div className="mx-auto flex max-w-3xl flex-col gap-4">
            <div className="flex items-center justify-between rounded-2xl bg-primary/[0.06] px-4 py-2.5">
              <span className="text-sm font-semibold text-text">
                {questions.length} question{questions.length === 1 ? "" : "s"}
                {problems > 0 && <span className="ml-2 text-xs font-semibold text-danger">{problems} need fixing</span>}
              </span>
              <span className="text-sm font-semibold text-primary">{total} pts total</span>
            </div>

            {readOnly && (
              <p className="flex items-center gap-2 rounded-2xl bg-pastel-lavender px-4 py-2.5 text-xs font-semibold text-pastel-lavender-ink">
                <LockIcon className="h-3.5 w-3.5" />
                This series is final published, so questions and marks are locked and can only be viewed.
              </p>
            )}

            <datalist id={listId}>
              {topics.map((t) => (
                <option key={t} value={t} />
              ))}
            </datalist>

            {questions.length === 0 ? (
              <div className="flex flex-col items-center rounded-3xl border border-dashed border-text/20 bg-surface px-6 py-12 text-center">
                <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
                  <QuizIcon className="h-6 w-6" />
                </span>
                <p className="mt-3 text-sm font-semibold text-text">No questions in this test yet</p>
                <p className="mt-1 max-w-xs text-xs text-muted">Pick a question type below and add your first one.</p>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {questions.map((q, i) => (
                  <QuestionCard
                    key={q.id}
                    question={q}
                    index={i}
                    total={questions.length}
                    topicListId={listId}
                    expanded={expandedId === q.id}
                    readOnly={readOnly}
                    onToggle={() => {
                      setExpandedId(expandedId === q.id ? null : q.id);
                      if (expandedId !== q.id) onFocusQuestion?.(q.id);
                    }}
                    onUpdate={(patch) => update(q.id, patch)}
                    onDuplicate={() => duplicate(q)}
                    onDelete={() => onChangeQuestions(questions.filter((x) => x.id !== q.id))}
                    onMove={(dir) => onChangeQuestions(reorder(questions, i, i + dir))}
                    arm={() => setArmedIdx(i)}
                    disarm={() => setArmedIdx(null)}
                    dragging={dragIdx === i}
                    dragOver={overIdx === i && dragIdx !== null && dragIdx !== i}
                    dragProps={{
                      draggable: !readOnly && armedIdx === i,
                      onDragStart: () => setDragIdx(i),
                      onDragOver: (e) => {
                        if (dragIdx === null) return;
                        e.preventDefault();
                        setOverIdx(i);
                      },
                      onDrop: drop,
                      onDragEnd: () => {
                        setDragIdx(null);
                        setOverIdx(null);
                        setArmedIdx(null);
                      },
                    }}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex shrink-0 flex-col gap-3 border-t border-text/[0.07] bg-surface px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          {!readOnly ? (
            <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                wrapperClassName="block w-full sm:w-64"
                aria-label="New question type"
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                className="w-full rounded-full border border-text/15 bg-bg px-4 py-2.5 pr-10 text-sm"
              >
                {QUESTION_TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </Select>
              <Button variant="secondary" fullWidth={false} className="px-5 py-2.5" onClick={add}>
                <PlusIcon className="h-4 w-4" />
                Add question
              </Button>
            </div>
          ) : (
            <div className="flex-1" />
          )}
          <Button fullWidth={false} className="px-8" onClick={onClose}>
            Done
          </Button>
        </div>
      </div>
    </div>
  );
}
