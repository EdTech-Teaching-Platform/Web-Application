import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { AlertTriangleIcon, CheckCircleIcon, ClockIcon } from "../../../components/ui/icons";
import { COURSE_QUIZZES, TEST_SERIES, getDraft, getSavedAttempts, removeDraft, saveAttempts, saveDraft } from "../data/assessmentCatalog";

// Presentational — there's no per-question marks field in the schema yet,
// so every question is weighted evenly. Matches the flat 4-marks-per-
// question convention already used on AssessmentResultDetail's summary.
const MARKS_PER_QUESTION = 4;

function resolveAssessment(id, sourceQuery) {
  const quiz = COURSE_QUIZZES.find((item) => item.id === id);
  if (quiz) return { id: quiz.id, title: quiz.title, questions: quiz.items, durationMinutes: quiz.durationMinutes, attemptsAllowed: 3, passingScore: 70, certificateEligible: false, source: "quiz", skills: [], courseId: quiz.courseId, type: "Assignment", topics: quiz.items.map((item) => item.topic) };
  const test = TEST_SERIES.find((item) => item.id === id);
  if (!test) return null;
  return { ...test, source: sourceQuery === "skill" ? "skill" : "test" };
}

function formatTime(seconds) {
  return Math.floor(seconds / 60).toString().padStart(2, "0") + ":" + (seconds % 60).toString().padStart(2, "0");
}

function initialDraft(assessment, resume) {
  const now = Date.now();
  if (resume && resume.endsAt > now) return { visited: [0], ...resume };
  return { answers: {}, flagged: [], visited: [0], currentIndex: 0, startedAt: new Date(now).toISOString(), endsAt: now + assessment.durationMinutes * 60 * 1000 };
}

// Pre-test instructions/confirmation screen — spec: never jump straight
// into a fresh attempt. A resumed in-progress draft skips this (the
// student already confirmed once for that attempt).
function StartConfirmation({ assessment, attemptsRemainingLabel, onBack, onStart }) {
  const [acknowledged, setAcknowledged] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const maxMarks = assessment.questions.length * MARKS_PER_QUESTION;
  const suggestedSecondsPerQuestion = Math.round((assessment.durationMinutes * 60) / Math.max(1, assessment.questions.length));
  const negativeMarking = assessment.negativeMarking;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">{assessment.title}</p>
      <h1 className="mt-2 font-display text-2xl font-bold text-text sm:text-3xl">Ready to begin?</h1>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[
          [assessment.questions.length, "Questions"],
          [assessment.durationMinutes + " min", "Duration"],
          [assessment.questionType || "Multiple Choice", "Question Types"],
          [maxMarks, "Maximum Marks"],
          [negativeMarking?.enabled ? `−${negativeMarking.incorrect} for incorrect` : "None", "Negative Marking"],
          [assessment.passingScore + "%", "Passing Score"],
          [attemptsRemainingLabel, "Attempts"],
          [formatTime(suggestedSecondsPerQuestion), "Suggested Time / Question"],
        ].map(([value, label]) => (
          <div key={label} className="rounded-xl border border-text/10 bg-white p-3">
            <strong className="block text-sm font-bold text-text">{value}</strong>
            <span className="mt-1 block text-[11px] text-text/45">{label}</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-2xl border border-text/10 bg-white p-5">
        <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary"><AlertTriangleIcon className="h-4 w-4" />Important instructions</p>
        <ul className="mt-3 space-y-2 text-sm leading-6 text-text/65">
          <li>• The timer starts as soon as you begin.</li>
          <li>• The test must be completed within the allotted time.</li>
          <li>• Your answers are saved automatically as you go.</li>
          <li>• You can navigate between questions freely.</li>
          <li>• Unanswered questions remain unanswered in your result.</li>
          {negativeMarking?.enabled && <li>• Negative marking applies to incorrect responses.</li>}
          <li>• You can mark questions for review and revisit them before submitting.</li>
          <li>• Once submitted, the test cannot be resumed.</li>
        </ul>
      </div>

      <label className="mt-5 inline-flex cursor-pointer items-center gap-2.5 text-sm select-none text-text/70">
        <input
          type="checkbox"
          checked={acknowledged}
          onChange={(event) => setAcknowledged(event.target.checked)}
          className="h-4 w-4 shrink-0 rounded accent-primary cursor-pointer"
        />
        <span>I have read and understood the instructions.</span>
      </label>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button fullWidth={false} variant="secondary" onClick={onBack}>Go Back</Button>
        <Button fullWidth={false} disabled={!acknowledged} onClick={() => setConfirmOpen(true)}>Start Test</Button>
      </div>

      {confirmOpen && (
        <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <section role="dialog" aria-modal="true" aria-labelledby="start-confirm-title" className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-xl">
            <span className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8e8df] text-primary"><AlertTriangleIcon className="h-5 w-5" /></span>
            <h2 id="start-confirm-title" className="mt-4 font-display text-lg font-bold text-text">Are you sure you want to start the test?</h2>
            <p className="mt-2 text-sm leading-6 text-text/55">Once started, the timer begins immediately and you can't go back to this screen.</p>
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button fullWidth={false} variant="secondary" onClick={() => setConfirmOpen(false)}>Cancel</Button>
              <Button fullWidth={false} onClick={onStart}>Yes, Start Test</Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export default function AssessmentRunner() {
  const navigate = useNavigate();
  const { assessmentId } = useParams();
  const [searchParams] = useSearchParams();
  const sourceQuery = searchParams.get("source");
  const retake = searchParams.get("retake") === "1";
  // `resolveAssessment` builds a fresh object every call (it spreads the
  // catalog record), so without memoizing it here the timer effect below
  // saw a new `assessment` reference on every render and kept tearing down
  // and rebuilding the interval — this is the actual bug behind the
  // "timer isn't working" report. Memoizing keeps the reference stable
  // across re-renders that don't change which assessment is loaded.
  const assessment = useMemo(() => resolveAssessment(assessmentId, sourceQuery), [assessmentId, sourceQuery]);
  const previousAttempts = getSavedAttempts().filter((attempt) => attempt.assessmentId === assessmentId);
  const storageId = assessmentId + (sourceQuery === "skill" ? "-skill" : "");
  const existingDraft = assessment && !retake ? getDraft(storageId) : null;
  const limitReached = assessment && assessment.attemptsAllowed !== "Unlimited" && previousAttempts.length >= assessment.attemptsAllowed && !existingDraft;
  const [draft, setDraft] = useState(() => assessment ? initialDraft(assessment, existingDraft) : null);
  // A resumed in-progress attempt skips the confirmation screen — the
  // student already confirmed once to reach that draft.
  const [started, setStarted] = useState(() => Boolean(existingDraft));
  const [secondsLeft, setSecondsLeft] = useState(() => assessment && draft ? Math.max(0, Math.ceil((draft.endsAt - Date.now()) / 1000)) : 0);
  const [saveStatus, setSaveStatus] = useState("saved");
  const [submitOpen, setSubmitOpen] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [timesUp, setTimesUp] = useState(false);
  const submitRef = useRef(null);

  const questions = assessment?.questions || [];
  const currentIndex = Math.min(draft?.currentIndex || 0, Math.max(0, questions.length - 1));
  const currentQuestion = questions[currentIndex];
  const unanswered = questions.filter((question) => draft && draft.answers[question.id] === undefined).length;
  const answer = currentQuestion ? draft?.answers[currentQuestion.id] : undefined;

  useEffect(() => {
    if (!assessment || !draft || limitReached || !started) return undefined;
    const endsAt = draft.endsAt;
    // Tick immediately so the displayed time is correct as soon as the
    // interval (re)starts, then recompute from `endsAt` every second —
    // deriving from the fixed end timestamp (not decrementing previous
    // state) avoids drift and any stale-closure staleness.
    setSecondsLeft(Math.max(0, Math.ceil((endsAt - Date.now()) / 1000)));
    const timerId = window.setInterval(() => {
      const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining <= 0) {
        window.clearInterval(timerId);
        setTimesUp(true);
      }
    }, 1000);
    return () => window.clearInterval(timerId);
  }, [assessment, draft?.endsAt, limitReached, started]);

  useEffect(() => {
    if (!assessment || !draft || limitReached || !started) return undefined;
    saveDraft(storageId, draft);
    setSaveStatus("saving");
    const timeoutId = window.setTimeout(() => setSaveStatus("saved"), 450);
    return () => window.clearTimeout(timeoutId);
  }, [assessment, draft, limitReached, started, storageId]);

  function finalize(autoSubmitted = false) {
    if (!assessment || !draft || limitReached) return;
    const correctQuestions = questions.filter((question) => draft.answers[question.id] === question.answer);
    const timeTakenSeconds = Math.min(assessment.durationMinutes * 60, Math.max(0, assessment.durationMinutes * 60 - secondsLeft));
    const topicMap = new Map();
    questions.forEach((question) => {
      const current = topicMap.get(question.topic) || { topic: question.topic, correct: 0, total: 0 };
      current.total += 1;
      if (draft.answers[question.id] === question.answer) current.correct += 1;
      topicMap.set(question.topic, current);
    });
    const topicBreakdown = Array.from(topicMap.values()).map((topic) => ({ ...topic, percentage: Math.round(topic.correct / topic.total * 100) }));
    const percentage = Math.round(correctQuestions.length / questions.length * 100);
    const attempt = {
      id: "attempt-" + Date.now() + "-" + Math.random().toString(36).slice(2, 6),
      assessmentId: assessment.id, source: assessment.source, assessmentTitle: assessment.title,
      answers: draft.answers, questions, flagged: draft.flagged, submittedAt: new Date().toISOString(),
      startedAt: draft.startedAt, timeTakenSeconds, attemptNumber: previousAttempts.length + 1,
      total: questions.length, correct: correctQuestions.length, incorrect: questions.length - correctQuestions.length - unanswered,
      skipped: unanswered, percentage, passed: percentage >= assessment.passingScore, passingScore: assessment.passingScore,
      topicBreakdown, topics: assessment.topics || [], skills: assessment.skills || [],
      certificateEligible: assessment.certificateEligible, autoSubmitted,
    };
    const attempts = getSavedAttempts();
    saveAttempts([attempt, ...attempts]);
    removeDraft(storageId);
    navigate("/student/assessments/results/" + attempt.id);
  }
  submitRef.current = finalize;

  const progress = questions.length ? ((currentIndex + 1) / questions.length) * 100 : 0;
  const answeredCount = questions.filter((question) => draft?.answers[question.id] !== undefined).length;
  const visitedCount = draft ? new Set(draft.visited || []).size : 0;
  const sourcePath = assessment?.source === "quiz" ? "/student/assessments/course-quizzes" : assessment?.source === "skill" ? "/student/assessments/skill-assessments" : "/student/assessments/test-series/" + assessmentId;
  const questionLabel = useMemo(() => questions.map((item, index) => ({ ...item, number: index + 1 })), [assessmentId]);

  if (!assessment) return <div className="mx-auto max-w-3xl px-4 py-16 text-center"><h1 className="font-display text-2xl font-bold text-text">Assessment not found</h1><Link className="mt-4 inline-block text-sm font-semibold text-primary" to="/student/assessments/course-quizzes">Back to Assignments</Link></div>;
  if (limitReached) return <div className="mx-auto max-w-xl px-4 py-16 text-center"><p className="text-xs font-bold uppercase tracking-widest text-primary">Attempt limit reached</p><h1 className="mt-2 font-display text-2xl font-bold text-text">You’ve used all available attempts</h1><p className="mt-2 text-sm leading-6 text-text/55">Review your previous result and learning insights before continuing.</p><Button className="mt-5" onClick={() => navigate("/student/assessments/results/" + previousAttempts[0]?.id)}>View Latest Result</Button></div>;

  if (!started) {
    const attemptsRemainingLabel = assessment.attemptsAllowed === "Unlimited" ? "Unlimited" : `${Math.max(0, assessment.attemptsAllowed - previousAttempts.length)} remaining`;
    return <StartConfirmation assessment={assessment} attemptsRemainingLabel={attemptsRemainingLabel} onBack={() => navigate(sourcePath)} onStart={() => setStarted(true)} />;
  }

  if (timesUp) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-[#f8e8df] text-primary"><ClockIcon className="h-6 w-6" /></span>
        <h1 className="mt-4 font-display text-2xl font-bold text-text">Time's Up</h1>
        <p className="mt-2 text-sm leading-6 text-text/55">Your test has been submitted automatically because the allotted time has ended.</p>
        <Button className="mt-5" onClick={() => finalize(true)}>View Result</Button>
      </div>
    );
  }

  function chooseOption(optionIndex) {
    setDraft((current) => ({ ...current, answers: { ...current.answers, [currentQuestion.id]: optionIndex } }));
  }

  function clearResponse() {
    setDraft((current) => {
      const answers = { ...current.answers };
      delete answers[currentQuestion.id];
      return { ...current, answers };
    });
  }

  function goTo(index) {
    setDraft((current) => ({ ...current, currentIndex: index, visited: current.visited?.includes(index) ? current.visited : [...(current.visited || []), index] }));
    setNavigatorOpen(false);
  }

  function moveNext() {
    if (currentIndex < questions.length - 1) goTo(currentIndex + 1);
    else setSubmitOpen(true);
  }

  return <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
    <header className="rounded-2xl border border-text/10 bg-white p-4 shadow-sm sm:p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><Link to={sourcePath} className="text-xs font-semibold text-primary">← Back to {assessment.source === "quiz" ? "Assignments" : assessment.source === "skill" ? "Skill Assessments" : "Test Overview"}</Link><h1 className="mt-2 truncate font-display text-lg font-bold text-text sm:text-xl">{assessment.title}</h1></div><div className="flex items-center gap-3"><span className="hidden text-xs text-text/45 sm:inline-flex">{saveStatus === "saving" ? "Auto-saving…" : "Saved ✓"}</span><div className={"flex items-center gap-2 rounded-xl px-3 py-2 font-mono text-sm font-bold " + (secondsLeft < 60 ? "bg-danger/10 text-danger" : "bg-[#f8e8df] text-primary")}><ClockIcon className="h-4 w-4" />{formatTime(secondsLeft)}</div></div></div><div className="mt-4 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-text/55">Question {currentIndex + 1} of {questions.length}</p><button type="button" onClick={() => setNavigatorOpen(true)} className="rounded-lg border border-text/10 px-3 py-2 text-xs font-semibold text-text/65 lg:hidden">Question Navigator · {answeredCount}/{questions.length}</button></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-text/10"><div className="h-full rounded-full bg-primary transition-[width]" style={{ width: progress + "%" }} /></div></header>
    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]"><main className="min-h-[500px] rounded-2xl border border-text/10 bg-white p-5 shadow-sm sm:p-8"><div className="flex flex-wrap items-start justify-between gap-3"><p className="text-xs font-semibold uppercase tracking-[0.14em] text-text/40">{assessment.subject || assessment.title}</p><button type="button" onClick={() => setDraft((current) => ({ ...current, flagged: current.flagged.includes(currentQuestion.id) ? current.flagged.filter((id) => id !== currentQuestion.id) : [...current.flagged, currentQuestion.id] }))} className={"rounded-lg px-3 py-2 text-xs font-semibold " + (draft.flagged.includes(currentQuestion.id) ? "bg-[#f7f0dc] text-[#8a6a2a]" : "bg-bg text-text/55")}>{draft.flagged.includes(currentQuestion.id) ? "⚑ Marked for Review" : "⚑ Mark for Review"}</button></div><h2 className="mt-6 max-w-3xl font-display text-xl font-bold leading-relaxed text-text sm:text-2xl">{currentQuestion.prompt}</h2><p className="mt-2 text-xs text-text/40">Choose one answer.</p><div className="mt-6 grid gap-3">{currentQuestion.options.map((option, index) => <button type="button" key={option} onClick={() => chooseOption(index)} className={"flex w-full items-center gap-3 rounded-xl border p-4 text-left text-sm transition " + (answer === index ? "border-primary bg-primary/5 text-text ring-1 ring-primary/20" : "border-text/10 bg-white text-text/75 hover:border-primary/30 hover:bg-[#fcfbfa]")}><span className={"flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold " + (answer === index ? "bg-primary text-white" : "bg-bg text-text/55")}>{String.fromCharCode(65 + index)}</span><span>{option}</span></button>)}</div><div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-text/10 pt-5"><Button fullWidth={false} variant="secondary" disabled={currentIndex === 0} onClick={() => goTo(currentIndex - 1)}>Previous</Button><div className="flex flex-wrap gap-2"><Button fullWidth={false} variant="secondary" onClick={clearResponse} disabled={answer === undefined}>Clear Response</Button><Button fullWidth={false} variant="secondary" onClick={() => setSubmitOpen(true)}>Submit Test</Button><Button fullWidth={false} onClick={moveNext}>{currentIndex === questions.length - 1 ? "Review & Submit" : "Save & Next"}</Button></div></div></main>
      <aside className="hidden h-fit rounded-2xl border border-text/10 bg-white p-4 shadow-sm lg:block"><div className="flex items-center justify-between"><h2 className="font-display font-bold text-text">Question Navigator</h2><span className="text-[11px] text-text/45">{answeredCount}/{questions.length}</span></div><div className="mt-4 grid grid-cols-5 gap-2">{questionLabel.map((question, index) => { const answered = draft.answers[question.id] !== undefined; const flagged = draft.flagged.includes(question.id); const visited = (draft.visited || []).includes(index); return <button type="button" key={question.id} onClick={() => goTo(index)} aria-label={"Question " + question.number + (answered ? ", answered" : visited ? ", unanswered" : ", not visited") + (flagged ? ", marked for review" : "")} className={"relative flex h-10 items-center justify-center rounded-lg text-xs font-bold " + (index === currentIndex ? "bg-primary text-white ring-2 ring-primary/20 ring-offset-2" : flagged ? "bg-[#f7f0dc] text-[#8a6a2a]" : answered ? "bg-[#1f9d55] text-white" : visited ? "bg-[#e0453c] text-white" : "bg-bg text-text/50")}>{question.number}{flagged && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#d6a43c]" />}</button>; })}</div><div className="mt-4 flex flex-wrap gap-x-3 gap-y-1 border-t border-text/10 pt-3 text-[10px] text-text/50"><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#1f9d55]"/>Answered</span><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#e0453c]"/>Skipped / Unanswered</span><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-[#f7f0dc]"/>Marked</span><span className="inline-flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-bg"/>Not visited</span></div><div className="mt-3 space-y-1 border-t border-text/10 pt-3 text-[11px] text-text/50"><p>Answered: {answeredCount} · Unanswered: {visitedCount - answeredCount}</p><p>Marked: {draft.flagged.length} · Not visited: {questions.length - visitedCount}</p></div><Button className="mt-4" onClick={() => setSubmitOpen(true)}>Submit Test</Button></aside>
    </div>
    {navigatorOpen && <div className="fixed inset-0 z-40 bg-black/35 lg:hidden" onClick={() => setNavigatorOpen(false)}><section className="absolute inset-x-0 bottom-0 max-h-[70vh] overflow-y-auto rounded-t-3xl bg-white p-5 pb-8" onClick={(event) => event.stopPropagation()}><div className="flex items-center justify-between"><h2 className="font-display text-lg font-bold text-text">Question Navigator</h2><button type="button" onClick={() => setNavigatorOpen(false)} className="text-sm font-semibold text-primary">Close</button></div><div className="mt-4 grid grid-cols-5 gap-3 sm:grid-cols-7">{questionLabel.map((question, index) => { const answered = draft.answers[question.id] !== undefined; const visited = (draft.visited || []).includes(index); return <button key={question.id} type="button" onClick={() => goTo(index)} className={"relative flex h-11 items-center justify-center rounded-lg text-sm font-bold " + (index === currentIndex ? "bg-primary text-white" : answered ? "bg-[#1f9d55] text-white" : visited ? "bg-[#e0453c] text-white" : "bg-bg text-text/50")}>{question.number}{draft.flagged.includes(question.id) && <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full bg-[#d6a43c]" />}</button>; })}</div><p className="mt-4 text-xs text-text/50">{answeredCount} answered · {questions.length - answeredCount} unanswered · {draft.flagged.length} for review</p></section></div>}
    {submitOpen && <div role="presentation" className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"><section role="dialog" aria-modal="true" aria-labelledby="submit-title" className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl"><span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#f8e8df] text-primary"><AlertTriangleIcon className="h-5 w-5" /></span><h2 id="submit-title" className="mt-4 font-display text-xl font-bold text-text">Submit Test?</h2><div className="mt-4 grid grid-cols-2 gap-2 rounded-xl bg-bg p-3 text-xs sm:grid-cols-3">{[[questions.length, "Total"], [answeredCount, "Attempted"], [visitedCount - answeredCount, "Unanswered"], [draft.flagged.length, "Marked"], [questions.length - visitedCount, "Not Visited"], [formatTime(secondsLeft), "Time Remaining"]].map(([value, label]) => <div key={label}><strong className="block text-sm font-bold text-text">{value}</strong><span className="text-[10px] text-text/45">{label}</span></div>)}</div><p className="mt-4 text-sm leading-6 text-text/55">{unanswered ? "You still have " + unanswered + " unanswered " + (unanswered === 1 ? "question." : "questions.") : "You’ve answered every question."} If you submit now, you won’t be able to change your answers.</p><div className="mt-5 flex flex-wrap justify-end gap-2"><Button fullWidth={false} variant="secondary" onClick={() => setSubmitOpen(false)}>Continue Test</Button><Button fullWidth={false} onClick={() => finalize(false)}>Submit Test</Button></div></section></div>}
    <div className="fixed inset-x-0 bottom-0 z-20 border-t border-text/10 bg-white/95 p-3 backdrop-blur lg:hidden"><div className="mx-auto flex max-w-7xl items-center justify-between gap-3"><button type="button" onClick={() => setNavigatorOpen(true)} className="text-xs font-semibold text-text/60">Questions {answeredCount}/{questions.length}</button><div className="flex gap-2"><Button fullWidth={false} variant="secondary" className="px-3 py-2" onClick={() => setSubmitOpen(true)}>Submit</Button><Button fullWidth={false} className="px-4 py-2" onClick={moveNext}>{currentIndex === questions.length - 1 ? "Finish" : "Next"}</Button></div></div></div>
  </div>;
}
