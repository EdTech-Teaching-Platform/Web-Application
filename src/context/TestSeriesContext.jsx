import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../hooks/useAuth";
import {
  SEED_TEACHERS,
  SEED_SERIES,
  SEED_TS_SUBMISSIONS,
  resolveTeacher,
  newSeries,
  normalizeSeries,
  computeBuilderProgress,
  publishBlockers,
  makeId,
  isStructureLocked,
} from "../portals/teacher/data/testSeriesData";
import { nowIso } from "../portals/teacher/data/testSeriesDeadlines";

// TestSeriesContext — the one shared store behind the admin "Grant Test
// Series Creator access" screen AND the teacher Test Series section.
// Mounted in App.jsx ABOVE AppRoutes (inside AuthProvider, since it reads
// useAuth()), so it sits above both the /admin and /teacher route trees: a
// grant toggled in Admin is reflected in the teacher sidebar immediately,
// and series/grading state survives navigating between portals.
//
// PUBLIC API (stable -- the per-series Performance tab builds on it):
//   series[]                  every series (all teachers), normalized (see normalizeSeries)
//   currentTeacher / hasAccess
//   createSeries(teacherId, opts) -> id      opts: { origin, scope, courseId, assignment, startMethod, init }
//   updateSeries(id, patchOrFn)              stamps updatedAt / lastSavedAt / builderProgress
//   transitionSeries(id, to) -> { ok, error? }   to: ready | published | final | drafting | archived
//   requestExtension / withdrawExtension / declineAssignment
//   deleteSeries(id) -> boolean (assigned series can't be deleted) / duplicateSeries(id) -> id
//   courseSeries(courseId)    series attached to a course
//   assignedActionCount       assigned series that still need the educator (sidebar badge)
//   submissions + grade* actions (Grading queue)
//   useTestSeriesSave()       { status: saved|saving|error, savedAt, flush(), retry() } (separate
//                             context so keystroke saves don't re-render every consumer)
//
// There's no backend, so state is mirrored to localStorage (debounced, flushed
// on step change / page leave via flush()) purely so a full page reload doesn't
// reset the demo. If storage is blocked entirely the store stays in memory and
// reports "saved" (nothing can fail that can't be attempted). Bump STORAGE_KEY
// when seeds change.
const STORAGE_KEY = "ul.testSeries.v7";
const SAVE_DEBOUNCE_MS = 600;

const TestSeriesContext = createContext(null);
const SaveContext = createContext({ status: "saved", savedAt: null, flush: () => true, retry: () => true });

function loadInitial() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.teachers) && Array.isArray(parsed.series) && Array.isArray(parsed.submissions)) {
        return { ...parsed, series: parsed.series.map(normalizeSeries) };
      }
    }
  } catch {
    /* storage unavailable -- fall through to seeds */
  }
  return { teachers: SEED_TEACHERS, series: SEED_SERIES, submissions: SEED_TS_SUBMISSIONS };
}

function storageWritable() {
  try {
    const k = "ul.testSeries.probe";
    window.localStorage.setItem(k, "1");
    window.localStorage.removeItem(k);
    return true;
  } catch {
    return false;
  }
}

export function TestSeriesProvider({ children }) {
  const { user } = useAuth();
  const [state, setState] = useState(loadInitial);
  const { teachers, series, submissions } = state;
  const [save, setSave] = useState({ status: "saved", savedAt: null });
  const stateRef = useRef(state);
  stateRef.current = state;
  const dirtyRef = useRef(false);
  const timerRef = useRef(null);
  const mountedRef = useRef(false);
  const memoryOnlyRef = useRef(null);

  const persist = useCallback(() => {
    if (memoryOnlyRef.current === null) memoryOnlyRef.current = !storageWritable();
    if (memoryOnlyRef.current) {
      dirtyRef.current = false;
      setSave({ status: "saved", savedAt: nowIso() });
      return true;
    }
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(stateRef.current));
      dirtyRef.current = false;
      setSave({ status: "saved", savedAt: nowIso() });
      return true;
    } catch {
      setSave((s) => ({ ...s, status: "error" }));
      return false;
    }
  }, []);

  const statusRef = useRef("saved");
  statusRef.current = save.status;
  const flush = useCallback(() => {
    clearTimeout(timerRef.current);
    if (!dirtyRef.current && statusRef.current !== "error") return true;
    return persist();
  }, [persist]);

  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      return undefined;
    }
    dirtyRef.current = true;
    setSave((s) => (s.status === "saving" ? s : { ...s, status: "saving" }));
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(persist, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [state, persist]);

  // Save on page leave / tab hide.
  useEffect(() => {
    const leave = () => {
      if (dirtyRef.current) persist();
    };
    const hidden = () => document.visibilityState === "hidden" && leave();
    window.addEventListener("pagehide", leave);
    document.addEventListener("visibilitychange", hidden);
    return () => {
      window.removeEventListener("pagehide", leave);
      document.removeEventListener("visibilitychange", hidden);
    };
  }, [persist]);

  const currentTeacher = useMemo(() => resolveTeacher(user, teachers), [user, teachers]);
  const hasAccess = Boolean(currentTeacher?.access);

  const setTeacherAccess = useCallback((ids, granted) => {
    const idSet = new Set(ids);
    const today = nowIso().slice(0, 10);
    setState((s) => ({
      ...s,
      teachers: s.teachers.map((t) => {
        if (!idSet.has(t.id) || t.access === granted) return t;
        return granted ? { ...t, access: true, grantedAt: today } : { ...t, access: false, revokedAt: today };
      }),
    }));
  }, []);

  const createSeries = useCallback((teacherId, opts = {}) => {
    const s = newSeries(teacherId, opts);
    setState((prev) => ({ ...prev, series: [s, ...prev.series] }));
    return s.id;
  }, []);

  const updateSeries = useCallback((id, patch) => {
    setState((prev) => ({
      ...prev,
      series: prev.series.map((s) => {
        if (s.id !== id) return s;
        const p = { ...(typeof patch === "function" ? patch(s) : patch) };
        // Final-published: structure, questions and marks are locked; metadata + deadline extensions still save.
        if (isStructureLocked(s)) {
          delete p.sections;
          delete p.negativeMarking;
        }
        const stamp = nowIso();
        const next = { ...s, ...p, updatedAt: stamp.slice(0, 10), lastSavedAt: stamp };
        if (!("builderProgress" in p)) next.builderProgress = computeBuilderProgress(next);
        return next;
      }),
    }));
  }, []);

  // Lifecycle moves. Returns { ok, error? } synchronously from the latest state.
  const transitionSeries = useCallback((id, to) => {
    const s = stateRef.current.series.find((x) => x.id === id);
    if (!s) return { ok: false, error: "Series not found." };
    const from = s.status;
    const stamp = nowIso();
    let extra = {};
    if (to === "ready") {
      if (from !== "drafting" && from !== "assigned") return { ok: false, error: "Only a draft can be submitted for review." };
      if (publishBlockers(s).length) return { ok: false, error: "Finish the required checklist items first." };
    } else if (to === "published") {
      if (from !== "ready") return { ok: false, error: "Submit the series for review before publishing." };
      if (publishBlockers(s).length) return { ok: false, error: "Finish the required checklist items first." };
      extra = { publishedAt: stamp.slice(0, 10) };
    } else if (to === "final") {
      if (from !== "published") return { ok: false, error: "Only a published series can be final published." };
      extra = { finalizedAt: stamp.slice(0, 10) };
    } else if (to === "drafting") {
      if (from === "final") return { ok: false, error: "A final published series is locked." };
    } else if (to === "archived") {
      if (s.origin === "assigned") return { ok: false, error: "Assigned series can't be archived. Decline it with a reason instead." };
    } else return { ok: false, error: "Unknown status." };
    setState((prev) => ({
      ...prev,
      series: prev.series.map((x) => {
        if (x.id !== id) return x;
        const next = { ...x, ...extra, status: to, updatedAt: stamp.slice(0, 10), lastSavedAt: stamp };
        if (to === "drafting") next.draftPayload = { ...x.draftPayload, stepIndex: Math.min(x.draftPayload?.stepIndex ?? 0, 4) };
        next.builderProgress = computeBuilderProgress(next);
        return next;
      }),
    }));
    return { ok: true };
  }, []);

  const requestExtension = useCallback(
    (id, { newDate, reason }) => updateSeries(id, { extensionRequest: { status: "pending", newDate, reason, requestedAt: nowIso() } }),
    [updateSeries]
  );
  const withdrawExtension = useCallback((id) => updateSeries(id, { extensionRequest: null }), [updateSeries]);
  const declineAssignment = useCallback(
    (id, reason) => updateSeries(id, { status: "archived", declined: { reason, at: nowIso() }, extensionRequest: null }),
    [updateSeries]
  );

  const deleteSeries = useCallback((id) => {
    const s = stateRef.current.series.find((x) => x.id === id);
    if (!s || s.origin === "assigned") return false;
    setState((prev) => ({ ...prev, series: prev.series.filter((x) => x.id !== id) }));
    return true;
  }, []);

  const duplicateSeries = useCallback((id) => {
    const src = stateRef.current.series.find((s) => s.id === id);
    if (!src) return null;
    const stamp = nowIso();
    const copy = normalizeSeries({
      ...JSON.parse(JSON.stringify(src)),
      id: makeId("ts"),
      title: `${src.title} (copy)`,
      origin: "own",
      assignment: null,
      status: "drafting",
      enrollments: 0,
      attempts: 0,
      declined: null,
      extensionRequest: null,
      deadlines: undefined,
      builderProgress: undefined,
      publishedAt: null,
      finalizedAt: null,
      createdAt: stamp.slice(0, 10),
      updatedAt: stamp.slice(0, 10),
      lastSavedAt: stamp,
      draftPayload: { startCompleted: true, stepIndex: 0, activeTestId: null, activeQuestionId: null },
    });
    setState((prev) => ({ ...prev, series: [copy, ...prev.series] }));
    return copy.id;
  }, []);

  // Grading actions for Test Series submissions -- same three outcomes as
  // TeacherCoursesContext's course grading (final grade / draft / send back).
  const patchSubmission = useCallback((id, patch) => {
    setState((prev) => ({ ...prev, submissions: prev.submissions.map((s) => (s.id === id ? { ...s, ...patch } : s)) }));
  }, []);
  const gradeTsSubmission = useCallback(
    (id, { score, feedback }) => patchSubmission(id, { score, feedback, status: "graded", gradedAt: nowIso().slice(0, 10), gradedBy: "Ansh Mehra" }),
    [patchSubmission]
  );
  const saveDraftTsGrade = useCallback((id, { score, feedback }) => patchSubmission(id, { score, feedback, status: "draft" }), [patchSubmission]);
  const requestTsResubmission = useCallback(
    (id, { feedback }) => patchSubmission(id, { feedback, status: "resubmission_requested", score: undefined }),
    [patchSubmission]
  );

  const courseSeries = useCallback(
    (courseId) => series.filter((s) => s.scope === "course" && s.courseId === courseId && s.teacherId === currentTeacher?.id && !s.declined),
    [series, currentTeacher]
  );

  // Assigned series that still need the educator to act (start / resume / submit / publish).
  const assignedActionCount = useMemo(
    () => series.filter((s) => s.teacherId === currentTeacher?.id && s.origin === "assigned" && !s.declined && ["assigned", "drafting", "ready"].includes(s.status)).length,
    [series, currentTeacher]
  );

  const value = useMemo(
    () => ({
      teachers,
      series,
      submissions,
      currentTeacher,
      hasAccess,
      assignedActionCount,
      setTeacherAccess,
      createSeries,
      updateSeries,
      transitionSeries,
      requestExtension,
      withdrawExtension,
      declineAssignment,
      deleteSeries,
      duplicateSeries,
      courseSeries,
      gradeTsSubmission,
      saveDraftTsGrade,
      requestTsResubmission,
    }),
    [teachers, series, submissions, currentTeacher, hasAccess, assignedActionCount, setTeacherAccess, createSeries, updateSeries, transitionSeries, requestExtension, withdrawExtension, declineAssignment, deleteSeries, duplicateSeries, courseSeries, gradeTsSubmission, saveDraftTsGrade, requestTsResubmission]
  );
  const saveValue = useMemo(() => ({ ...save, flush, retry: flush }), [save, flush]);

  return (
    <TestSeriesContext.Provider value={value}>
      <SaveContext.Provider value={saveValue}>{children}</SaveContext.Provider>
    </TestSeriesContext.Provider>
  );
}

export function useTestSeries() {
  const ctx = useContext(TestSeriesContext);
  if (!ctx) throw new Error("useTestSeries must be used within TestSeriesProvider");
  return ctx;
}

// Autosave state for the builder's "Saved just now / Saving… / Couldn't save — retry" indicator.
export function useTestSeriesSave() {
  return useContext(SaveContext);
}
