import { useCallback, useEffect, useRef, useState } from "react";
import { attemptApi } from "../services/attemptApi";

// Drives the AI evaluation of a report's written answers (20261115090000).
// When the report still has pending written answers and no AI section, it
// asks evaluate-subjective to run (idempotent: the server runs one job per
// attempt), then polls student_ai_eval_status until the job is done and
// calls onDone (the page reloads the report).
//   phase: idle | running | done | failed | unavailable
//   unavailable = the function isn't deployed / configured: the page keeps
//   the plain "pending review" notice.
export const AI_POLL_MS = 4000;
export const AI_MAX_POLLS = 60;   // ~4 minutes

export function needsAiEvaluation(report) {
  const s = report?.summary;
  return Boolean(s && s.pending_count > 0 && report?.ai?.status !== "done");
}

export function useAiEvaluation(report, attemptId, { onDone, api = attemptApi, pollMs = AI_POLL_MS, maxPolls = AI_MAX_POLLS } = {}) {
  const [state, setState] = useState({ phase: "idle", canRetry: false });
  const needed = needsAiEvaluation(report);
  const doneRef = useRef(onDone);
  useEffect(() => { doneRef.current = onDone; });
  const timer = useRef(null);
  const run = useRef(0);

  const stop = () => { clearTimeout(timer.current); timer.current = null; };

  const poll = useCallback((id, left) => {
    timer.current = setTimeout(async () => {
      if (run.current !== id) return;
      let status = null;
      try { status = await api.aiEvaluationStatus(attemptId); } catch { status = null; }
      if (run.current !== id) return;
      const s = status?.status;
      if (s === "done" || s === "not_needed") {
        setState({ phase: "done", canRetry: false });
        Promise.resolve(doneRef.current?.()).catch(() => {});
      } else if (s === "failed") {
        setState({ phase: "failed", canRetry: Boolean(status?.can_retry) });
      } else if (left <= 1) {
        setState({ phase: "failed", canRetry: true });
      } else {
        poll(id, left - 1);
      }
    }, pollMs);
  }, [api, attemptId, pollMs]);

  const start = useCallback(async () => {
    stop();
    const id = ++run.current;
    setState({ phase: "running", canRetry: false });
    let res;
    try {
      res = await api.requestAiEvaluation(attemptId);
    } catch (err) {
      if (run.current !== id) return;
      // 404 / not configured: no AI evaluation on this deployment yet
      if (err?.status === 404 && /not deployed|isn't available/i.test(err?.message || "")) setState({ phase: "unavailable", canRetry: false });
      else if (/OPENAI_API_KEY/i.test(err?.message || "")) setState({ phase: "unavailable", canRetry: false });
      else setState({ phase: "failed", canRetry: true });
      return;
    }
    if (run.current !== id) return;
    const s = res?.status;
    if (s === "done" || s === "not_needed") {
      setState({ phase: "done", canRetry: false });
      Promise.resolve(doneRef.current?.()).catch(() => {});
    } else if (s === "failed") {
      setState({ phase: "failed", canRetry: Boolean(res?.can_retry) });
    } else {
      poll(id, maxPolls);
    }
  }, [api, attemptId, maxPolls, poll]);

  useEffect(() => {
    if (needed) start();
    return () => { run.current += 1; stop(); };
    // start once per report that needs it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needed, attemptId]);

  return { ...state, needed, retry: start };
}

export default useAiEvaluation;
