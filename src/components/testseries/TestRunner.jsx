// TestRunner — the student-facing test interface (timer, question area,
// palette, confirm-submit). MODE-AGNOSTIC and storage-free: it holds the
// in-progress attempt in component state (mirrored to sessionStorage, keyed
// by mode + series + test, only so a refresh doesn't lose a running attempt)
// and calls `onSubmit(result)` exactly once when the attempt ends (manual
// submit or timer reaching 0). It never imports or calls any persistence
// function: whether a result is recorded is entirely the HOST's decision
// (the teacher "Preview as Student" host records nothing).
//
// Props: series, test, sectionTitle?, mode ("live" | "preview"),
//   onSubmit(result), onDirtyChange?(hasAnswers), banner? (node rendered on
//   top, e.g. the Preview Mode banner), durationSeconds? (override, for tests).
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Button from "../ui/Button";
import QuestionImage from "./QuestionImage";
import Modal from "../ui/Modal";
import { ArrowLeftIcon, ArrowRightIcon, ClockIcon, FlagIcon, GridIcon, XIcon } from "../ui/icons";
import { questionTypeMeta, isSubjective } from "../../portals/teacher/data/testSeriesData";
import { formatDuration, isAnswered, parseNegativeMarking, penaltyFor, scoreAttempt, stripTags, validateTestForRun, wordCount } from "./scoreAttempt";

const draftKey = (mode, seriesId, testId) => `ul.testrun.${mode}.${seriesId}.${testId}`;

function readDraft(key) {
  try {
    const raw = window.sessionStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
function writeDraft(key, value) {
  try {
    window.sessionStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage blocked -- the attempt still works from state */
  }
}
export function clearTestDraft(mode, seriesId, testId) {
  try {
    window.sessionStorage.removeItem(draftKey(mode, seriesId, testId));
  } catch {
    /* ignore */
  }
}

const INPUT =
  "w-full rounded-2xl border border-text/[0.14] bg-surface px-4 py-3 text-sm text-text placeholder:text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20";

// ---- palette -------------------------------------------------------------
const PALETTE_STYLES = {
  unvisited: "bg-bg text-muted ring-1 ring-text/10",
  unanswered: "bg-pastel-pink text-pastel-pink-ink",
  answered: "bg-pastel-sage text-pastel-sage-ink",
  marked: "bg-pastel-lavender text-pastel-lavender-ink",
};
const LEGEND = [
  ["unvisited", "Not visited"],
  ["unanswered", "Not answered"],
  ["answered", "Answered"],
  ["marked", "Marked for review"],
];

function Palette({ questions, current, statusOf, onJump }) {
  return (
    <div>
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-6 lg:grid-cols-5">
        {questions.map((q, i) => {
          const st = statusOf(q, i);
          return (
            <button
              key={q.id}
              type="button"
              onClick={() => onJump(i)}
              aria-label={`Question ${i + 1}, ${LEGEND.find(([k]) => k === st.key)?.[1].toLowerCase()}${st.markedAnswered ? ", answered" : ""}${i === current ? ", current" : ""}`}
              aria-current={i === current ? "step" : undefined}
              className={`relative flex h-11 min-w-11 items-center justify-center rounded-2xl text-sm font-bold transition-all duration-150 hover:-translate-y-0.5 ${PALETTE_STYLES[st.key]} ${
                i === current ? "ring-2 ring-primary ring-offset-2 ring-offset-surface" : ""
              }`}
            >
              {i + 1}
              {st.markedAnswered && <span aria-hidden="true" className="absolute right-1 top-1 h-2 w-2 rounded-full bg-pastel-sage-ink" />}
            </button>
          );
        })}
      </div>
      <ul className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-[11px] text-muted">
        {LEGEND.map(([k, label]) => (
          <li key={k} className="flex items-center gap-2">
            <span className={`h-3.5 w-3.5 rounded-md ${PALETTE_STYLES[k]}`} />
            {label}
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---- answer inputs -------------------------------------------------------
function OptionList({ q, value, onChange }) {
  const multi = q.type === "mcq_multi";
  const selected = multi ? (Array.isArray(value) ? value : []) : value;
  const name = `q-${q.id}`;
  return (
    <fieldset className="mt-5">
      <legend className="sr-only">{multi ? "Select all that apply" : "Select one answer"}</legend>
      {multi && <p className="mb-2 text-xs font-semibold text-muted">Select all that apply</p>}
      <div className="flex flex-col gap-2.5">
        {(q.options || []).map((o, i) => {
          const checked = multi ? selected.includes(o.id) : selected === o.id;
          return (
            <label
              key={o.id}
              className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 text-sm transition-colors duration-150 focus-within:ring-2 focus-within:ring-primary/30 ${
                checked ? "border-primary bg-primary/[0.05]" : "border-text/[0.12] bg-surface hover:border-primary/40"
              }`}
            >
              <input
                type={multi ? "checkbox" : "radio"}
                name={name}
                checked={checked}
                onChange={() => (multi ? onChange(checked ? selected.filter((id) => id !== o.id) : [...selected, o.id]) : onChange(o.id))}
                className="mt-0.5 h-4 w-4 shrink-0 accent-primary"
              />
              <span className="flex min-w-0 gap-2">
                {q.type !== "true_false" && <span className="font-bold text-muted">{String.fromCharCode(65 + i)}.</span>}
                <span className="flex min-w-0 flex-col gap-2 break-words text-text">
                  {(o.text || !o.image) && <span>{o.text || <em className="text-muted">Option text not written yet</em>}</span>}
                  {o.image && <QuestionImage image={o.image} variant="option" />}
                </span>
              </span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function AnswerInput({ q, value, onChange }) {
  if (q.type === "mcq_single" || q.type === "mcq_multi" || q.type === "true_false") return <OptionList q={q} value={value} onChange={onChange} />;
  if (q.type === "numerical") {
    const v = value ?? "";
    const bad = v !== "" && Number.isNaN(Number(String(v).trim()));
    return (
      <div className="mt-5">
        <label htmlFor={`a-${q.id}`} className="mb-1.5 block text-xs font-semibold text-muted">
          Your answer (number)
        </label>
        <input id={`a-${q.id}`} type="text" inputMode="decimal" autoComplete="off" value={v} onChange={(e) => onChange(e.target.value)} placeholder="e.g. 12.5" aria-invalid={bad} className={`${INPUT} sm:max-w-xs`} />
        {bad && <p className="mt-1.5 text-xs text-danger">Enter a valid number.</p>}
      </div>
    );
  }
  if (q.type === "fill_blank") {
    return (
      <div className="mt-5">
        <label htmlFor={`a-${q.id}`} className="mb-1.5 block text-xs font-semibold text-muted">
          Fill in the blank
        </label>
        <input id={`a-${q.id}`} type="text" autoComplete="off" value={value ?? ""} onChange={(e) => onChange(e.target.value)} placeholder="Type your answer" className={`${INPUT} sm:max-w-md`} />
      </div>
    );
  }
  // short_answer / long_answer
  const text = value ?? "";
  const words = wordCount(text);
  const limit = Number(q.wordLimit) || 0;
  const over = limit > 0 && words > limit;
  return (
    <div className="mt-5">
      <label htmlFor={`a-${q.id}`} className="mb-1.5 block text-xs font-semibold text-muted">
        Your answer
      </label>
      <textarea
        id={`a-${q.id}`}
        rows={q.type === "long_answer" ? 10 : 5}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write your answer here"
        aria-describedby={`wc-${q.id}`}
        className={`${INPUT} resize-y`}
      />
      <p id={`wc-${q.id}`} className={`mt-1.5 text-right text-xs font-semibold ${over ? "text-danger" : "text-muted"}`}>
        {words}
        {limit > 0 ? ` / ${limit}` : ""} words{over ? " (over the suggested limit)" : ""}
      </p>
    </div>
  );
}

// ---- runner --------------------------------------------------------------
export default function TestRunner({ series, test, sectionTitle, mode = "live", onSubmit, onDirtyChange, banner, durationSeconds }) {
  // Throws for malformed data on purpose: the host wraps this in an error state.
  validateTestForRun(test);
  const questions = test.questions;
  const key = draftKey(mode, series.id, test.id);
  const total = durationSeconds ?? Math.max(1, Math.round((Number(test.duration) || 1) * 60));
  const neg = useMemo(() => parseNegativeMarking(series.negativeMarking), [series.negativeMarking]);

  const [init] = useState(() => {
    const d = readDraft(key);
    const ok = d && typeof d === "object" && d.answers && typeof d.startedAt === "number";
    return ok ? d : { answers: {}, marked: {}, visited: { 0: true }, current: 0, startedAt: Date.now() };
  });
  const [answers, setAnswers] = useState(init.answers);
  const [marked, setMarked] = useState(init.marked || {});
  const [visited, setVisited] = useState(init.visited || { 0: true });
  const [current, setCurrent] = useState(Math.min(init.current || 0, Math.max(0, questions.length - 1)));
  const startedAt = init.startedAt;
  const [remaining, setRemaining] = useState(() => Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000)));
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const submittedRef = useRef(false);

  // Countdown: real time via setInterval; remaining is recomputed from the
  // wall clock every tick so a throttled background tab can't drift.
  useEffect(() => {
    const id = setInterval(() => setRemaining(Math.max(0, total - Math.floor((Date.now() - startedAt) / 1000))), 1000);
    return () => clearInterval(id);
  }, [total, startedAt]);

  useEffect(() => {
    writeDraft(key, { answers, marked, visited, current, startedAt });
  }, [key, answers, marked, visited, current, startedAt]);

  const hasAnswers = useMemo(() => questions.some((q) => isAnswered(q, answers[q.id])), [questions, answers]);
  useEffect(() => {
    onDirtyChange?.(hasAnswers);
  }, [hasAnswers, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  useEffect(() => {
    if (!hasAnswers) return undefined;
    const handler = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [hasAnswers]);

  useEffect(() => {
    if (!paletteOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setPaletteOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [paletteOpen]);

  const finish = useCallback(
    (auto) => {
      if (submittedRef.current) return;
      submittedRef.current = true;
      const elapsed = Math.min(total, Math.floor((Date.now() - startedAt) / 1000));
      const result = scoreAttempt({ series, test, answers, timeTakenSec: elapsed });
      clearTestDraft(mode, series.id, test.id);
      setConfirmOpen(false);
      onSubmit?.({ ...result, answers, autoSubmitted: Boolean(auto) });
    },
    [series, test, answers, mode, onSubmit, total, startedAt]
  );

  useEffect(() => {
    if (remaining <= 0) finish(true);
  }, [remaining, finish]);

  const goTo = useCallback(
    (i) => {
      const next = Math.max(0, Math.min(questions.length - 1, i));
      setCurrent(next);
      setVisited((v) => (v[next] ? v : { ...v, [next]: true }));
      setPaletteOpen(false);
    },
    [questions.length]
  );

  if (questions.length === 0) {
    return (
      <div className="rounded-3xl bg-surface p-8 text-center shadow-soft">
        <p className="font-bold text-text">No questions added yet</p>
        <p className="mt-1 text-sm text-muted">This test can't be started until it has at least one question.</p>
      </div>
    );
  }

  const q = questions[current];
  const meta = questionTypeMeta(q.type);
  const answered = isAnswered(q, answers[q.id]);
  const isLast = current === questions.length - 1;
  const penalty = !isSubjective(q.type) ? penaltyFor(q, neg) : 0;

  const statusOf = (qq, i) => {
    const a = isAnswered(qq, answers[qq.id]);
    if (marked[qq.id]) return { key: "marked", markedAnswered: a };
    if (a) return { key: "answered" };
    return { key: visited[i] ? "unanswered" : "unvisited" };
  };
  const counts = questions.reduce(
    (acc, qq) => {
      if (isAnswered(qq, answers[qq.id])) acc.answered += 1;
      if (marked[qq.id]) acc.marked += 1;
      return acc;
    },
    { answered: 0, marked: 0 }
  );
  const unanswered = questions.length - counts.answered;

  const setAnswer = (val) => setAnswers((a) => ({ ...a, [q.id]: val }));
  const clearResponse = () => setAnswers((a) => ({ ...a, [q.id]: undefined }));
  const unmark = () => setMarked((m) => ({ ...m, [q.id]: false }));
  const markAndNext = () => {
    setMarked((m) => ({ ...m, [q.id]: true }));
    if (!isLast) goTo(current + 1);
  };
  const saveAndNext = () => {
    unmark();
    if (!isLast) goTo(current + 1);
  };

  const low = remaining <= 300;
  const palette = <Palette questions={questions} current={current} statusOf={statusOf} onJump={goTo} />;

  return (
    <div className="flex flex-col gap-4 pb-10">
      {banner}

      <div className="sticky top-2 z-20 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-3xl bg-surface px-5 py-3 shadow-card">
        <div className="min-w-0 flex-1">
          <p className="eyebrow truncate">{series.title || "Test series"}</p>
          <h1 className="truncate text-base font-bold text-text sm:text-lg">{test.title || "Untitled test"}</h1>
        </div>
        <div
          role="timer"
          aria-label={`Time remaining ${formatDuration(remaining)}`}
          className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-bold tabular-nums ${low ? "bg-pastel-pink text-pastel-pink-ink" : "bg-bg text-text"}`}
        >
          <ClockIcon className="h-4 w-4" />
          {formatDuration(remaining)}
        </div>
        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-primary/25 bg-surface px-4 text-sm font-semibold text-text lg:hidden"
        >
          <GridIcon className="h-4 w-4" />
          Questions
          <span className="text-muted">
            {counts.answered}/{questions.length}
          </span>
        </button>
        <Button fullWidth={false} className="min-h-11 px-6" onClick={() => setConfirmOpen(true)}>
          Submit
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1fr_17rem] lg:items-start">
        <section aria-labelledby="q-heading" className="min-w-0 rounded-3xl bg-surface p-5 shadow-soft sm:p-7">
          <div className="flex flex-wrap items-center gap-2">
            <h2 id="q-heading" className="eyebrow mr-1">
              Question {current + 1} of {questions.length}
            </h2>
            <span className="rounded-full bg-primary/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-primary">{meta.label}</span>
            {q.difficulty && <span className="rounded-full bg-pastel-orange px-2.5 py-0.5 text-[11px] font-semibold text-pastel-orange-ink">{q.difficulty}</span>}
            {q.topic && <span className="rounded-full bg-text/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-muted">{q.topic}</span>}
            <span className="ml-auto text-xs font-semibold text-muted">
              {Number(q.points) || 0} mark{Number(q.points) === 1 ? "" : "s"}
              {penalty > 0 ? ` · −${Math.round(penalty * 100) / 100} if wrong` : ""}
            </span>
          </div>
          {sectionTitle && <p className="mt-1.5 text-xs text-muted">{sectionTitle}</p>}

          <div
            className="mt-4 text-[15px] leading-relaxed text-text [&_p]:mb-2 [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: stripTags(q.text) ? q.text : "<p><em>Question text not written yet.</em></p>" }}
          />
          {q.image && <QuestionImage image={q.image} className="mt-4" />}

          <AnswerInput key={q.id} q={q} value={answers[q.id]} onChange={setAnswer} />

          <div className="mt-7 flex flex-wrap items-center gap-2 border-t border-line pt-5">
            <Button variant="secondary" fullWidth={false} className="min-h-11 px-4" onClick={() => goTo(current - 1)} disabled={current === 0}>
              <ArrowLeftIcon className="h-4 w-4" />
              Previous
            </Button>
            <Button variant="tertiary" fullWidth={false} className="min-h-11 px-4" onClick={clearResponse} disabled={!answered}>
              Clear response
            </Button>
            <div className="flex w-full flex-wrap gap-2 sm:ml-auto sm:w-auto">
              <Button variant="secondary" fullWidth={false} className="min-h-11 flex-1 px-4 sm:flex-none" onClick={markAndNext}>
                <FlagIcon className="h-4 w-4" />
                Mark for review &amp; next
              </Button>
              <Button fullWidth={false} className="min-h-11 flex-1 px-5 sm:flex-none" onClick={saveAndNext}>
                {isLast ? "Save" : "Save & next"}
                {!isLast && <ArrowRightIcon className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </section>

        <aside className="hidden rounded-3xl bg-surface p-5 shadow-soft lg:sticky lg:top-24 lg:block" aria-label="Question palette">
          <p className="eyebrow-muted mb-3">Question palette</p>
          {palette}
        </aside>
      </div>

      {paletteOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Close question palette" onClick={() => setPaletteOpen(false)} className="absolute inset-0 bg-text/45" />
          <div role="dialog" aria-modal="true" aria-label="Question palette" className="absolute inset-x-0 bottom-0 max-h-[75vh] overflow-y-auto rounded-t-3xl bg-surface p-5 shadow-elevated">
            <div className="mb-3 flex items-center justify-between">
              <p className="eyebrow-muted">Question palette</p>
              <button type="button" onClick={() => setPaletteOpen(false)} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-primary/[0.07] hover:text-text">
                <XIcon className="h-5 w-5" />
              </button>
            </div>
            {palette}
          </div>
        </div>
      )}

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Submit this test?"
        footer={
          <>
            <Button fullWidth={false} className="min-h-11 px-6" onClick={() => finish(false)}>
              Submit test
            </Button>
            <Button variant="secondary" fullWidth={false} className="min-h-11 px-6" onClick={() => setConfirmOpen(false)}>
              Keep working
            </Button>
          </>
        }
      >
        <dl className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-2xl bg-pastel-sage px-2 py-3 text-pastel-sage-ink">
            <dd className="text-xl font-bold">{counts.answered}</dd>
            <dt className="text-[11px] font-semibold">Answered</dt>
          </div>
          <div className="rounded-2xl bg-pastel-pink px-2 py-3 text-pastel-pink-ink">
            <dd className="text-xl font-bold">{unanswered}</dd>
            <dt className="text-[11px] font-semibold">Unanswered</dt>
          </div>
          <div className="rounded-2xl bg-pastel-lavender px-2 py-3 text-pastel-lavender-ink">
            <dd className="text-xl font-bold">{counts.marked}</dd>
            <dt className="text-[11px] font-semibold">Marked for review</dt>
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted">
          {unanswered > 0 ? `${unanswered} question${unanswered === 1 ? " is" : "s are"} still unanswered. ` : ""}Once you submit you can't change your answers.
        </p>
      </Modal>
    </div>
  );
}
