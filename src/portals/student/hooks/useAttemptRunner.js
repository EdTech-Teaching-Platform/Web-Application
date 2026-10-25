import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import { attemptApi as defaultApi, answerPayload, PROCTOR_EVENTS } from "../services/attemptApi";

// Attempt runner state machine. Pure parts (reducer, timing helpers) are
// exported for tests; useAttemptRunner wires them to the RPCs.
//
// phases: loading -> running <-> warning -> submitting -> submitted
//         loading -> error         (start refused, e.g. attempts used up)
// The deadline comes from the SERVER (started_at + time limit); the client
// only corrects for its own clock offset (server_now - local now).

export const SAVE_DEBOUNCE_MS = 700;

export function clockOffsetMs(serverNow, clientNow = Date.now()) {
  const server = new Date(serverNow).getTime();
  return Number.isFinite(server) ? server - clientNow : 0;
}

// Seconds left, or null for an untimed test.
export function secondsLeft(deadline, offsetMs, clientNow = Date.now()) {
  if (!deadline) return null;
  return Math.max(0, Math.floor((new Date(deadline).getTime() - (clientNow + offsetMs)) / 1000));
}

function answersFromSaved(saved = []) {
  const out = {};
  for (const a of saved) {
    const ids = Array.isArray(a.selected_option_ids) ? a.selected_option_ids : [];
    out[a.question_id] = ids.length ? ids : a.answer_text ?? "";
  }
  return out;
}

export function isAnswered(value) {
  return Array.isArray(value) ? value.length > 0 : typeof value === "string" && value.trim() !== "";
}

export const initialState = {
  phase: "loading",
  attempt: null,
  questions: [],
  answers: {},
  marked: {},
  saving: {},       // questionId -> "saving" | "saved" | "error"
  current: 0,
  offsetMs: 0,
  violations: 0,
  limit: 3,
  warning: null,    // { type, remaining }
  report: null,
  reason: null,     // auto-submit reason: "time_up" | "proctor_limit" | null
  error: null,
};

export function runnerReducer(state, action) {
  switch (action.type) {
    case "started": {
      const a = action.attempt;
      return {
        ...state,
        phase: "running",
        attempt: a,
        questions: a.questions ?? [],
        answers: answersFromSaved(a.saved_answers),
        offsetMs: clockOffsetMs(a.server_now, action.clientNow),
        violations: a.violations_count ?? 0,
        limit: a.violation_limit ?? 3,
        error: null,
      };
    }
    case "failed":
      return { ...state, phase: "error", error: action.error };
    case "answer":
      if (state.phase !== "running" && state.phase !== "warning") return state;
      return {
        ...state,
        answers: { ...state.answers, [action.questionId]: action.value },
        saving: { ...state.saving, [action.questionId]: "saving" },
      };
    case "saved":
      return { ...state, saving: { ...state.saving, [action.questionId]: "saved" } };
    case "saveFailed":
      return { ...state, saving: { ...state.saving, [action.questionId]: "error" } };
    case "toggleMark":
      return { ...state, marked: { ...state.marked, [action.questionId]: !state.marked[action.questionId] } };
    case "goto":
      return { ...state, current: Math.min(Math.max(action.index, 0), Math.max(state.questions.length - 1, 0)) };
    case "violation": {
      const r = action.result;
      if (r.auto_submitted) return { ...state, violations: r.violations_count, phase: "submitting", reason: r.auto_submit_reason };
      if (!r.counted) return { ...state, violations: r.violations_count };
      return {
        ...state,
        violations: r.violations_count,
        limit: r.violation_limit,
        phase: state.phase === "submitting" ? state.phase : "warning",
        warning: { type: action.eventType, remaining: r.remaining },
      };
    }
    case "ackWarning":
      return state.phase === "warning" ? { ...state, phase: "running", warning: null } : state;
    case "submitting":
      return state.phase === "submitted" ? state : { ...state, phase: "submitting", reason: action.reason ?? state.reason };
    case "submitted":
      return { ...state, phase: "submitted", report: action.report, reason: action.reason ?? state.reason };
    case "submitFailed":
      return { ...state, phase: "running", error: action.error };
    default:
      return state;
  }
}

export function useAttemptRunner(testId, { api = defaultApi, onFinished } = {}) {
  const [state, dispatch] = useReducer(runnerReducer, initialState);
  const [now, setNow] = useState(() => Date.now());
  const stateRef = useRef(state);
  const timers = useRef({});       // questionId -> timeout id
  const pending = useRef({});      // questionId -> value awaiting save
  const finishing = useRef(false);
  const onFinishedRef = useRef(onFinished);
  // Callbacks read the latest state / handler through refs (kept in sync after each render).
  useEffect(() => {
    stateRef.current = state;
    onFinishedRef.current = onFinished;
  });

  const save = useCallback(async (questionId) => {
    const s = stateRef.current;
    const question = s.questions.find((q) => q.id === questionId);
    if (!question || !s.attempt || !(questionId in pending.current)) return;
    const value = pending.current[questionId];
    delete pending.current[questionId];
    try {
      await api.saveAnswer(s.attempt.attempt_id, questionId, answerPayload(question, value));
      dispatch({ type: "saved", questionId });
    } catch (error) {
      dispatch({ type: "saveFailed", questionId, error });
    }
  }, [api]);

  const flush = useCallback(async () => {
    Object.values(timers.current).forEach(clearTimeout);
    timers.current = {};
    await Promise.all(Object.keys(pending.current).map((id) => save(id)));
  }, [save]);

  const submit = useCallback(async (reason = null) => {
    if (finishing.current || !stateRef.current.attempt) return;
    finishing.current = true;
    dispatch({ type: "submitting", reason });
    await flush();
    try {
      const report = await api.submit(stateRef.current.attempt.attempt_id);
      dispatch({ type: "submitted", report, reason });
      onFinishedRef.current?.(stateRef.current.attempt.attempt_id, report);
    } catch (error) {
      finishing.current = false;
      dispatch({ type: "submitFailed", error });
    }
  }, [api, flush]);

  // Start or resume on mount (a refresh lands here again and resumes).
  useEffect(() => {
    let alive = true;
    api.start(testId).then(
      (attempt) => {
        if (!alive) return;
        dispatch({ type: "started", attempt, clientNow: Date.now() });
        if (attempt.resumed) api.logEvent(attempt.attempt_id, PROCTOR_EVENTS.attemptResumed).catch(() => null);
      },
      (error) => alive && dispatch({ type: "failed", error }),
    );
    return () => {
      alive = false;
    };
  }, [api, testId]);

  // 1-second clock; at zero the attempt is submitted (the server records timed_out if late).
  useEffect(() => {
    if (state.phase !== "running" && state.phase !== "warning") return undefined;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [state.phase]);

  const remaining = secondsLeft(state.attempt?.deadline, state.offsetMs, now);
  useEffect(() => {
    if (remaining === 0 && (state.phase === "running" || state.phase === "warning")) submit("time_up");
  }, [remaining, state.phase, submit]);

  useEffect(() => () => Object.values(timers.current).forEach(clearTimeout), []);

  const answer = useCallback((questionId, value) => {
    dispatch({ type: "answer", questionId, value });
    pending.current[questionId] = value;
    clearTimeout(timers.current[questionId]);
    timers.current[questionId] = setTimeout(() => {
      delete timers.current[questionId];
      save(questionId);
    }, SAVE_DEBOUNCE_MS);
  }, [save]);

  const reportViolation = useCallback(async (eventType, meta = {}) => {
    const s = stateRef.current;
    if (!s.attempt || finishing.current || (s.phase !== "running" && s.phase !== "warning")) return null;
    try {
      const result = await api.logEvent(s.attempt.attempt_id, eventType, meta);
      dispatch({ type: "violation", eventType, result });
      if (result.auto_submitted) {
        finishing.current = true;
        await flush();
        const report = await api.report(s.attempt.attempt_id);
        dispatch({ type: "submitted", report, reason: result.auto_submit_reason });
        onFinishedRef.current?.(s.attempt.attempt_id, report);
      }
      return result;
    } catch {
      return null;   // a failed log never blocks the student; the server is the record
    }
  }, [api, flush]);

  return {
    state,
    remaining,
    answer,
    submit,
    reportViolation,
    toggleMark: (questionId) => dispatch({ type: "toggleMark", questionId }),
    goTo: (index) => dispatch({ type: "goto", index }),
    ackWarning: () => dispatch({ type: "ackWarning" }),
  };
}

export default useAttemptRunner;
