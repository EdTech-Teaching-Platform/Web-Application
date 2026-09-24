import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ClockIcon } from "../../../components/ui/icons";
import { QUIZ, getQuizState, saveQuizDraft, submitQuizAttempt } from "../data/assessmentMock";

export default function Quiz() {
  const navigate = useNavigate();
  const [state, setState] = useState(getQuizState);
  const [submitted, setSubmitted] = useState(Boolean(getQuizState().lastResult));
  const [review, setReview] = useState(false);
  const [notice, setNotice] = useState("");
  const question = QUIZ.questions[state.currentIndex] || QUIZ.questions[0];

  useEffect(() => {
    if (submitted || state.remainingSeconds <= 0) return undefined;
    const timer = window.setInterval(() => {
      setState((current) => {
        const next = { ...current, remainingSeconds: current.remainingSeconds - 1 };
        saveQuizDraft(next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(timer);
  }, [submitted, state.remainingSeconds]);

  const answeredCount = Object.keys(state.answers).length;
  const flaggedCount = state.flagged.length;
  const time = `${Math.floor(state.remainingSeconds / 60).toString().padStart(2, "0")}:${(state.remainingSeconds % 60).toString().padStart(2, "0")}`;
  const result = state.lastResult;
  const attemptCount = state.attempts.length;
  const canAttempt = attemptCount < QUIZ.attemptLimit;
  const questionStatus = useMemo(() => QUIZ.questions.map((item) => ({ ...item, answered: state.answers[item.id] !== undefined, flagged: state.flagged.includes(item.id) })), [state]);

  function chooseAnswer(index) {
    const next = { ...state, answers: { ...state.answers, [question.id]: index } };
    setState(next);
    saveQuizDraft(next);
  }

  function toggleFlag() {
    const flagged = state.flagged.includes(question.id) ? state.flagged.filter((id) => id !== question.id) : [...state.flagged, question.id];
    const next = { ...state, flagged };
    setState(next);
    saveQuizDraft(next);
  }

  function submit() {
    if (state.remainingSeconds <= 0 || !canAttempt) {
      setNotice(!canAttempt ? "The server has rejected this attempt because the attempt limit has been reached." : "Time is up. Your saved answers can be reviewed, but no new attempt was accepted.");
      return;
    }
    const response = submitQuizAttempt();
    if (!response.ok) setNotice("The server rejected this attempt because the attempt limit has been reached.");
    else {
      setState(response.state);
      setSubmitted(true);
    }
  }

  if (submitted && result) return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="rounded-3xl bg-white p-7 sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Attempt {state.attempts.length} of {QUIZ.attemptLimit}</p><h1 className="mt-2 font-display text-3xl font-bold text-text">Quiz result</h1><p className="mt-2 text-sm text-text/60">{QUIZ.title}</p></div><StatusBadge status={result.passed ? "success" : "danger"}>{result.passed ? "Passed" : "Not passed"}</StatusBadge></div>
        <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-primary p-5 text-white"><p className="text-sm text-white/70">Score</p><p className="mt-1 font-display text-3xl font-bold text-white">{result.score}/{result.total}</p></div><div className="rounded-2xl bg-rotation-1 p-5"><p className="text-sm text-text/60">Percentage</p><p className="mt-1 font-display text-3xl font-bold text-text">{result.percentage}%</p></div><div className="rounded-2xl bg-rotation-3 p-5"><p className="text-sm text-text/60">Feedback</p><p className="mt-1 text-sm text-text">Review flagged questions and revisit the lesson.</p></div></div>
        <button type="button" onClick={() => setReview(!review)} className="mt-7 text-sm font-semibold text-primary">{review ? "Hide answer review" : "Review answers"} →</button>
        {review && <div className="mt-4 space-y-3">{QUIZ.questions.map((item, index) => <div key={item.id} className="rounded-2xl bg-text/5 p-4"><p className="font-medium text-text">{index + 1}. {item.prompt}</p><p className="mt-2 text-sm text-text/65">Your answer: {item.options[result.answers[item.id]] || "Not answered"}</p><p className="mt-1 text-sm text-success">Correct answer: {item.options[item.answer]}</p></div>)}</div>}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row">{canAttempt && <Button onClick={() => { setState({ ...getQuizState(), answers: {}, flagged: [], currentIndex: 0, remainingSeconds: QUIZ.durationMinutes * 60, lastResult: null }); setSubmitted(false); }}>Start another attempt</Button>}<Button variant="secondary" onClick={() => navigate("/student/courseplayer?course=c1&lesson=l6")}>Back to course</Button></div>
      </div>
    </div>
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Quiz attempt</p><h1 className="mt-2 font-display text-3xl font-bold text-text">{QUIZ.title}</h1><p className="mt-2 text-sm text-text/60">Attempt {attemptCount + 1} of {QUIZ.attemptLimit} · Answers autosave automatically.</p></div><div className="flex items-center gap-3 rounded-full bg-primary/10 px-4 py-2 text-sm font-semibold text-primary"><ClockIcon /> {time}</div></div>
      {notice && <div className="mb-5 rounded-2xl bg-warning/15 px-4 py-3 text-sm text-warning">{notice}</div>}
      <div className="grid gap-6 lg:grid-cols-[240px_1fr]">
        <aside className="rounded-2xl bg-white p-4"><p className="text-xs font-semibold uppercase tracking-[0.16em] text-text/45">Questions</p><div className="mt-4 grid grid-cols-4 gap-2 lg:grid-cols-3">{questionStatus.map((item, index) => <button type="button" key={item.id} onClick={() => { const next = { ...state, currentIndex: index }; setState(next); saveQuizDraft(next); }} className={`relative rounded-xl p-3 text-sm font-semibold ${index === state.currentIndex ? "bg-primary text-white" : item.answered ? "bg-success/15 text-success" : "bg-text/5 text-text/60"}`}>{index + 1}{item.flagged && <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-warning" />}</button>)}</div><p className="mt-5 text-xs text-text/50">{answeredCount}/{QUIZ.questions.length} answered · {flaggedCount} flagged</p></aside>
        <main className="rounded-2xl bg-white p-6 sm:p-8"><div className="flex items-start justify-between gap-4"><p className="text-sm font-semibold text-text/50">Question {state.currentIndex + 1} of {QUIZ.questions.length}</p><button type="button" onClick={toggleFlag} className={`flex items-center gap-2 text-sm font-semibold ${state.flagged.includes(question.id) ? "text-warning" : "text-text/50"}`}><span aria-hidden="true">⚑</span> {state.flagged.includes(question.id) ? "Flagged" : "Flag for review"}</button></div><h2 className="mt-6 font-display text-2xl font-semibold text-text">{question.prompt}</h2><div className="mt-7 space-y-3">{question.options.map((option, index) => <button type="button" key={option} onClick={() => chooseAnswer(index)} className={`flex w-full items-center gap-3 rounded-2xl p-4 text-left text-sm ${state.answers[question.id] === index ? "bg-primary text-white" : "bg-text/5 text-text hover:bg-primary/5"}`}><span className="flex h-7 w-7 items-center justify-center rounded-full bg-white/70 text-xs font-bold text-text">{String.fromCharCode(65 + index)}</span>{option}</button>)}</div><div className="mt-8 flex flex-wrap justify-between gap-3 border-t border-text/10 pt-5"><Button fullWidth={false} variant="secondary" disabled={state.currentIndex === 0} onClick={() => { const next = { ...state, currentIndex: state.currentIndex - 1 }; setState(next); saveQuizDraft(next); }}>Previous</Button>{state.currentIndex < QUIZ.questions.length - 1 ? <Button fullWidth={false} onClick={() => { const next = { ...state, currentIndex: state.currentIndex + 1 }; setState(next); saveQuizDraft(next); }}>Next question</Button> : <Button fullWidth={false} onClick={submit}>Submit quiz</Button>}</div><p className="mt-4 text-xs text-text/45">Draft saved automatically {state.draftSavedAt ? `at ${new Date(state.draftSavedAt).toLocaleTimeString()}` : ""}.</p></main>
      </div>
    </div>
  );
}
