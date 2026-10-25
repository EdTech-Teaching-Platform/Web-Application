// Test runner (/student/test/:testId/take). student_start_attempt starts or
// resumes the attempt; answers autosave (debounced); the timer counts down to
// the SERVER deadline and submits at zero; window changes are recorded as
// violations and the server auto-submits over the limit.
import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ErrorState, LoadingState, PAGE } from "../components/PageState";
import { isAnswered, useAttemptRunner } from "../hooks/useAttemptRunner";
import { useProctor } from "../hooks/useProctor";
import { formatClock } from "../utils/format";

const EVENT_TEXT = {
  visibility_hidden: "You switched away from the test tab.",
  window_blur: "The test window lost focus.",
  fullscreen_exit: "You left full screen.",
  copy: "Copying is not allowed during the test.",
  cut: "Cutting text is not allowed during the test.",
  paste: "Pasting is not allowed during the test.",
  contextmenu: "Right-click is not allowed during the test.",
};

function SaveIndicator({ status }) {
  if (!status) return null;
  const text = { saving: "Saving…", saved: "Saved", error: "Not saved: we'll retry when you change the answer" }[status];
  return <span className={`text-xs ${status === "error" ? "text-danger" : "text-text/50"}`} aria-live="polite">{text}</span>;
}

function QuestionInput({ question, value, onChange }) {
  const name = `q-${question.id}`;
  if (question.type === "multiple_choice" || question.type === "true_false") {
    const multi = Boolean(question.multi_select);
    const selected = Array.isArray(value) ? value : [];
    return (
      <fieldset className="space-y-2">
        <legend className="sr-only">{multi ? "Choose all that apply" : "Choose one answer"}</legend>
        {multi && <p className="text-xs font-medium text-text/60">Select all that apply.</p>}
        {question.options.map((opt) => {
          const checked = selected.includes(opt.id);
          return (
            <label key={opt.id}
              className={`flex cursor-pointer items-start gap-3 rounded-2xl px-4 py-3 ring-1 transition-colors duration-150 ${checked ? "bg-primary/5 ring-primary" : "bg-white ring-text/10 hover:bg-text/5"}`}>
              <input
                type={multi ? "checkbox" : "radio"}
                name={name}
                className="mt-0.5 accent-[var(--color-primary)]"
                checked={checked}
                onChange={() => onChange(multi ? (checked ? selected.filter((id) => id !== opt.id) : [...selected, opt.id]) : [opt.id])}
              />
              <span className="text-sm text-text">{opt.text}</span>
            </label>
          );
        })}
      </fieldset>
    );
  }
  const text = typeof value === "string" ? value : "";
  if (question.type === "fill_in_blank") {
    return (
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-text">Your answer</span>
        <input
          className="w-full rounded-full border border-text/15 bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          value={text}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }}
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    );
  }
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">Your answer</span>
      <textarea
        className="min-h-40 w-full rounded-2xl border border-text/15 bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />
      <span className="mt-1 block text-xs text-text/50">Written answers are reviewed by a teacher after you submit.</span>
    </label>
  );
}

export function Palette({ questions, answers, marked, current, onGoTo }) {
  return (
    <nav aria-label="Question palette">
      <ol className="grid grid-cols-6 gap-2 sm:grid-cols-8 lg:grid-cols-5">
        {questions.map((q, i) => {
          const answered = isAnswered(answers[q.id]);
          const isMarked = Boolean(marked[q.id]);
          const state = [answered ? "answered" : "not answered", isMarked ? "marked for review" : null].filter(Boolean).join(", ");
          return (
            <li key={q.id}>
              <button
                type="button"
                onClick={() => onGoTo(i)}
                aria-current={i === current ? "step" : undefined}
                aria-label={`Question ${i + 1}, ${state}`}
                className={`relative h-10 w-10 rounded-full text-sm font-semibold transition-colors duration-150 ${
                  answered ? "bg-primary text-white" : "bg-white text-text ring-1 ring-text/15"
                } ${i === current ? "outline outline-2 outline-offset-2 outline-primary" : ""}`}
              >
                {i + 1}
                {isMarked && <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-warning ring-2 ring-white" aria-hidden="true" />}
              </button>
            </li>
          );
        })}
      </ol>
      <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text/60">
        <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-primary" aria-hidden="true" />Answered</li>
        <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full ring-1 ring-text/30" aria-hidden="true" />Not answered</li>
        <li><span className="mr-1 inline-block h-2.5 w-2.5 rounded-full bg-warning" aria-hidden="true" />Marked for review</li>
      </ul>
    </nav>
  );
}

export default function TestRunner() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const [begun, setBegun] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const headingRef = useRef(null);
  const runner = useAttemptRunner(testId, {
    onFinished: (attemptId) => navigate(`/student/report/${attemptId}`, { replace: true }),
  });
  const { state, remaining } = runner;
  const live = state.phase === "running" || state.phase === "warning";
  const proctor = useProctor({ enabled: begun && live, onEvent: (type, meta) => runner.reportViolation(type, meta) });

  // Ask before leaving while the attempt is open (the timer keeps running).
  useEffect(() => {
    if (!live) return undefined;
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [live]);

  // Move focus to the question when it changes (keyboard / screen reader users).
  useEffect(() => {
    if (begun) headingRef.current?.focus();
  }, [state.current, begun]);

  if (state.phase === "loading") return <div className={PAGE}><LoadingState label="Opening your test" /></div>;
  if (state.phase === "error") {
    return (
      <div className={PAGE}>
        <ErrorState error={state.error} title="Couldn't open this test" />
        <Link to={`/student/test/${testId}`} className="text-sm font-medium text-primary hover:underline">Back to the instructions</Link>
      </div>
    );
  }

  const { attempt, questions, answers, marked, current } = state;
  const question = questions[current];
  if (!question) {
    return (
      <div className={PAGE}>
        <ErrorState error={{ message: "This test has no questions." }} title="Couldn't open this test" />
      </div>
    );
  }
  const answeredCount = questions.filter((q) => isAnswered(answers[q.id])).length;
  const markedCount = questions.filter((q) => marked[q.id]).length;
  const lowTime = remaining !== null && remaining <= 300;

  const begin = async () => {
    if (proctor.supported) await proctor.enterFullscreen();
    setBegun(true);
  };

  if (!begun && live) {
    return (
      <div className={PAGE}>
        <div className="mx-auto max-w-xl rounded-3xl bg-white p-8 text-center ring-1 ring-text/10">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{attempt.resumed ? "Resume" : "Ready"}</p>
          <h1 className="mt-2 font-display text-2xl font-bold text-text">{attempt.test_title}</h1>
          <p className="mt-3 text-sm text-text/70">
            {attempt.resumed ? "Your answers so far are saved. " : ""}
            {remaining !== null ? `Time left: ${formatClock(remaining)}. ` : ""}
            The test opens in full screen. Leaving it is recorded ({state.violations} of {state.limit} allowed so far).
          </p>
          <div className="mt-6 flex justify-center">
            <Button fullWidth={false} onClick={begin}>{attempt.resumed ? "Resume in full screen" : "Begin in full screen"}</Button>
          </div>
        </div>
      </div>
    );
  }

  const busy = state.phase === "submitting" || state.phase === "submitted";

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-4 sm:px-6 lg:px-8">
      <header className="sticky top-0 z-20 -mx-4 mb-4 flex flex-wrap items-center gap-3 bg-(--lp-grey) px-4 py-3 sm:-mx-6 sm:px-6">
        <h1 className="min-w-0 flex-1 truncate font-display text-lg font-semibold text-text">{attempt.test_title}</h1>
        <StatusBadge status={state.violations > 0 ? "warning" : "neutral"}>
          Violations {state.violations}/{state.limit}
        </StatusBadge>
        {remaining !== null && (
          <span
            role="timer"
            aria-label={`Time left ${formatClock(remaining)}`}
            className={`rounded-full px-4 py-1.5 font-mono text-sm font-semibold ${lowTime ? "bg-danger/15 text-danger" : "bg-white text-text ring-1 ring-text/10"}`}
          >
            {formatClock(remaining)}
          </span>
        )}
        <Button fullWidth={false} disabled={busy} onClick={() => setConfirming(true)}>Submit</Button>
      </header>
      {lowTime && remaining > 0 && remaining % 60 === 0 && (
        <p className="sr-only" aria-live="assertive">{Math.round(remaining / 60)} minutes left</p>
      )}

      {state.error && state.phase === "running" && (
        <p role="alert" className="mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {state.error.message} Your answers are saved; try submitting again.
        </p>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        <section aria-labelledby="question-heading" className="rounded-3xl bg-white p-5 ring-1 ring-text/10 sm:p-6">
          <div className="flex flex-wrap items-center gap-2 text-xs text-text/60">
            <span>{question.section}</span>
            {question.topic && <span>· {question.topic}</span>}
            <span className="ml-auto">
              {question.points} {Number(question.points) === 1 ? "mark" : "marks"}
              {Number(question.negative_marks) > 0 && <> · −{question.negative_marks} if wrong</>}
            </span>
          </div>
          <h2 id="question-heading" ref={headingRef} tabIndex={-1} className="mt-3 font-display text-base font-semibold text-text outline-none">
            Question {current + 1} of {questions.length}
          </h2>
          <p className="mt-2 whitespace-pre-line text-[15px] leading-relaxed text-text">{question.text}</p>
          {question.answer_instructions && <p className="mt-2 text-xs text-text/60">{question.answer_instructions}</p>}

          <div className="mt-5">
            <QuestionInput question={question} value={answers[question.id]} onChange={(v) => runner.answer(question.id, v)} />
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <Button variant="secondary" fullWidth={false} onClick={() => runner.toggleMark(question.id)} aria-pressed={Boolean(marked[question.id])}>
              {marked[question.id] ? "Unmark review" : "Mark for review"}
            </Button>
            {isAnswered(answers[question.id]) && (
              <Button variant="secondary" fullWidth={false} onClick={() => runner.answer(question.id, Array.isArray(answers[question.id]) ? [] : "")}>
                Clear answer
              </Button>
            )}
            <SaveIndicator status={state.saving[question.id]} />
            <div className="ml-auto flex gap-2">
              <Button variant="secondary" fullWidth={false} disabled={current === 0} onClick={() => runner.goTo(current - 1)}>Previous</Button>
              <Button fullWidth={false} disabled={current >= questions.length - 1} onClick={() => runner.goTo(current + 1)}>Next</Button>
            </div>
          </div>
        </section>

        <aside className="rounded-3xl bg-white p-5 ring-1 ring-text/10">
          <p className="mb-3 text-sm font-semibold text-text">
            {answeredCount} of {questions.length} answered{markedCount ? ` · ${markedCount} marked` : ""}
          </p>
          <Palette questions={questions} answers={answers} marked={marked} current={current} onGoTo={runner.goTo} />
        </aside>
      </div>

      <Modal
        open={confirming && !busy}
        onClose={() => setConfirming(false)}
        title="Submit your test?"
        footer={
          <>
            <Button onClick={() => { setConfirming(false); runner.submit(); }}>Submit now</Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>Keep working</Button>
          </>
        }
      >
        <p className="text-sm text-text/70">
          You answered {answeredCount} of {questions.length} questions
          {questions.length - answeredCount > 0 && <> ({questions.length - answeredCount} unanswered)</>}
          {markedCount > 0 && <>, and {markedCount} {markedCount === 1 ? "is" : "are"} marked for review</>}.
          You can't change answers after submitting.
        </p>
      </Modal>

      <Modal
        open={state.phase === "warning"}
        onClose={() => { runner.ackWarning(); proctor.enterFullscreen(); }}
        title="Violation recorded"
        footer={<Button onClick={() => { runner.ackWarning(); proctor.enterFullscreen(); }}>Return to the test</Button>}
      >
        <p className="text-sm text-text/80">{EVENT_TEXT[state.warning?.type] ?? "You left the test."} This has been recorded.</p>
        <p className="mt-2 text-sm font-semibold text-text">
          {state.warning?.remaining > 0
            ? `${state.warning.remaining} more ${state.warning.remaining === 1 ? "violation is" : "violations are"} allowed. After that your test is submitted automatically.`
            : "No more violations are allowed. The next one submits your test automatically."}
        </p>
      </Modal>

      {busy && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text/40 px-4" role="alertdialog" aria-modal="true" aria-label="Submitting">
          <div className="max-w-sm rounded-2xl bg-white p-6 text-center">
            <p className="font-display text-lg font-semibold text-text">
              {state.reason === "proctor_limit" ? "Test auto-submitted"
                : state.reason === "time_up" ? "Time's up"
                : "Submitting your test…"}
            </p>
            <p className="mt-2 text-sm text-text/70">
              {state.reason === "proctor_limit" ? "You went over the allowed number of violations, so your test was submitted automatically. Opening your report…"
                : state.reason === "time_up" ? "Your test was submitted automatically. Opening your report…"
                : "Saving your answers and scoring the test."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
