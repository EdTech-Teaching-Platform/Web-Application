// Test Series Builder — the admin wizard's steps: Start, (Source for CSV / AI), Details, Structure, Classification, Availability, Review
// behind ProgressSteps (collapsing to a compact mobile stepper). Series state
// lives in TestSeriesContext (above the route tree) and every edit writes
// straight through by :seriesId, so nothing is lost navigating away and back.
//
// Reached at /teacher/testseries/:seriesId. /testseries/new has no "how do you
// want to build this?" choice any more: every series is built manually, from
// scratch, so it creates a blank standalone draft and lands in step 1. An
// assigned series that hasn't been started is moved to drafting the same way.
//
// Part 6D: debounced autosave lives in TestSeriesContext (indicator below),
// flushed on every step change, "Save & exit" and page leave; the builder also
// records the last edited step / test / question so "Resume" lands exactly
// where the educator stopped, and guards in-app navigation while unsaved.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NavLink, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTestSeries, useTestSeriesSave } from "../../../context/TestSeriesContext";
import ProgressSteps from "../../../components/ui/ProgressSteps";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import { QuizIcon, EyeIcon, XIcon, ArrowRightIcon, LockIcon } from "../../../components/ui/icons";
import TestSeriesDetailsStep from "../components/TestSeriesDetailsStep";
import TestSeriesStructureStep from "../components/TestSeriesStructureStep";
import { StartMethodStep, StartSourceStep, SOURCE_LABEL } from "../components/TestSeriesStartStep";
import TestSeriesClassificationStep from "../components/TestSeriesClassificationStep";
import TestSeriesAvailabilityStep from "../components/TestSeriesAvailabilityStep";
import TestSeriesReviewStep from "../components/TestSeriesReviewStep";
import SaveIndicator from "../components/SaveIndicator";
import UnsavedChangesModal from "../components/UnsavedChangesModal";
import { ExtensionRequestModal } from "../components/AssignedSeriesActions";
import { LifecycleStepper, OriginTags, OverdueBanner, SeriesStatusBadge } from "../components/TestSeriesStatus";
import useUnsavedGuard from "../hooks/useUnsavedGuard";
import { allTests, classificationErrors, detailsErrors, formatDate, isStructureLocked, publishBlockers, stripHtml, structureErrors } from "../data/testSeriesData";
import { deadlineErrors } from "../data/testSeriesDeadlines";

const STEPS = ["Details", "Structure", "Classification", "Availability", "Review"];
const STEP_PARAM = { details: 0, structure: 1, classification: 2, availability: 3, review: 4 };
const LAST = STEPS.length - 1;

function useSteps(series) {
  return useMemo(() => {
    if (!series) return [false, false, false, false];
    return [
      Object.keys(detailsErrors(series)).length === 0,
      structureErrors(series).length === 0,
      Object.keys(classificationErrors(series)).length === 0,
      deadlineErrors(series).length === 0,
    ];
  }, [series]);
}

// /teacher/testseries/new -- straight into the manual builder (no method picker).
export function NewTestSeries() {
  const navigate = useNavigate();
  const { createSeries, currentTeacher } = useTestSeries();
  const createdRef = useRef(null);
  useEffect(() => {
    if (!currentTeacher || createdRef.current) return;
    createdRef.current = createSeries(currentTeacher.id, { origin: "own", scope: "standalone", startMethod: "scratch" });
    navigate(`/teacher/testseries/${createdRef.current}`, { replace: true });
  }, [currentTeacher, createSeries, navigate]);
  if (!currentTeacher) return null;
  return (
    <div role="status" aria-live="polite" className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-sm text-muted">
      <span className="h-6 w-6 animate-spin rounded-full border-2 border-primary/25 border-t-primary" aria-hidden="true" />
      Setting up your test series…
    </div>
  );
}

function resumeSummary(series) {
  const ptr = series.lastEditedPointer;
  const tests = series.sections.flatMap((s) => s.tests);
  const test = ptr?.testId ? tests.find((t) => t.id === ptr.testId) : null;
  if (test) {
    const qi = ptr.questionId ? test.questions.findIndex((q) => q.id === ptr.questionId) : -1;
    return `Structure · ${test.title || "Untitled test"}${qi >= 0 ? ` · Question ${qi + 1}` : ""}`;
  }
  return `${STEPS[Math.min(series.lastEditedStep ?? 0, LAST)]} step`;
}

export default function TestSeriesBuilder() {
  const { seriesId } = useParams();
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { series: all, currentTeacher, updateSeries, transitionSeries, requestExtension } = useTestSeries();
  const { status: saveStatus, savedAt, flush, retry } = useTestSeriesSave();
  const series = all.find((s) => s.id === seriesId && s.teacherId === currentTeacher?.id) || null;

  const autoResume = Boolean(search.get("resume")) && Boolean(series?.lastEditedPointer?.testId);
  const [stepIndex, setStepIndex] = useState(() => {
    const p = search.get("step");
    if (p && p in STEP_PARAM) return STEP_PARAM[p];
    if (autoResume) return 1;
    return Math.min(series?.draftPayload?.stepIndex ?? series?.lastEditedStep ?? 0, LAST);
  });
  // Start / Source stage (same as the admin wizard). A series that has never been started
  // opens here; every series can come back to it with Back from the Details step.
  const [pre, setPre] = useState(() => {
    if (search.get("step") || autoResume || !series) return null;
    const started = series.draftPayload?.startCompleted || Math.round(series.builderProgress || 0) > 0;
    return !started && ["assigned", "drafting"].includes(series.status) ? "method" : null;
  });
  const [method, setMethod] = useState(() => series?.startMethod || "scratch");
  const [showErrors, setShowErrors] = useState(false);
  const [focus, setFocus] = useState(() => (autoResume ? { testId: series.lastEditedPointer.testId, questionId: series.lastEditedPointer.questionId || null, nonce: 1 } : null));
  const [done, setDone] = useState(null); // "ready" once submitted for review
    const [actionError, setActionError] = useState("");
  const [extOpen, setExtOpen] = useState(false);
  const [resumeDismissed, setResumeDismissed] = useState(autoResume);
  const [anchor, setAnchor] = useState(null);
  const pointerRef = useRef({ questionId: null });
  const stepValid = useSteps(series);

  // Autosave is debounced in the context; flush on every step change and when leaving.
  useEffect(() => {
    flush();
  }, [stepIndex, flush]);
  useEffect(() => () => flush(), [flush]);
  useEffect(() => {
    if (anchor === null) return undefined;
    const id = setTimeout(() => {
      document.getElementById(anchor)?.scrollIntoView({ behavior: "smooth", block: "start" });
      setAnchor(null);
    }, 80);
    return () => clearTimeout(id);
  }, [anchor, stepIndex]);

  const dirty = saveStatus !== "saved";
  const guard = useUnsavedGuard(dirty);

  const patch = useCallback(
    (p) => {
      setResumeDismissed(true);
      const extra = p.about !== undefined ? { shortDescription: stripHtml(p.about).slice(0, 140) } : {};
      updateSeries(seriesId, (s) => ({ ...p, ...extra, lastEditedStep: stepIndex, draftPayload: { ...s.draftPayload, stepIndex } }));
    },
    [updateSeries, seriesId, stepIndex]
  );

  if (!series) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          icon={QuizIcon}
          heading="Test series not found"
          message="It may have been deleted, or it belongs to another educator."
          action={
            <NavLink to="/teacher/testseries" className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft">
              Back to Test Series
            </NavLink>
          }
        />
      </div>
    );
  }

  if (series.declined) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          icon={LockIcon}
          heading="You declined this assignment"
          message={`"${series.title}" is closed. Your reason: ${series.declined.reason}`}
          action={<NavLink to="/teacher/testseries/assigned" className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft">Back to Assigned to me</NavLink>}
        />
      </div>
    );
  }

  const locked = isStructureLocked(series);
  const blockers = publishBlockers(series);
  const canContinue = stepIndex < LAST && stepValid[stepIndex];
  const isAssigned = series.origin === "assigned";
  const showResume = !pre && !resumeDismissed && !locked && ["assigned", "drafting"].includes(series.status) && (series.lastEditedStep > 0 || series.lastEditedPointer);

  function goTo(i) {
    setStepIndex(i);
    setShowErrors(false);
    setActionError("");
    updateSeries(series.id, (s) => ({
      stepReached: Math.max(s.stepReached ?? 0, i),
      lastEditedStep: i,
      draftPayload: { ...s.draftPayload, stepIndex: i },
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  const hasSource = method !== "scratch";
  const labels = ["Start", ...(hasSource ? [SOURCE_LABEL[method]] : []), ...STEPS];
  const off = labels.length - STEPS.length;
  const shownIndex = pre === "method" ? 0 : pre === "source" ? 1 : off + stepIndex;
  const questionTotal = allTests(series).reduce((n, t) => n + t.questions.length, 0);
  const sourceReady = method === "csv" ? questionTotal > 0 : allTests(series).length > 0;

  function chooseMethod(m) {
    setMethod(m);
    updateSeries(series.id, { startMethod: m });
  }
  // Leave the Start / Source stage and begin the Details step (assigned series move to drafting).
  function beginBuilding() {
    updateSeries(series.id, (s) => ({
      startMethod: method,
      ...(s.status === "assigned" ? { status: "drafting" } : {}),
      draftPayload: { ...s.draftPayload, startCompleted: true, stepIndex: 0, activeTestId: null, activeQuestionId: null },
      lastEditedStep: 0,
    }));
    setPre(null);
    setStepIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  // Remember the test / question being edited so "Resume" lands back on it.
  function recordPointer(testId, questionId = null) {
    pointerRef.current = { questionId };
    if (locked) return;
    updateSeries(series.id, (s) => ({
      lastEditedStep: 1,
      lastEditedPointer: { sectionId: s.sections.find((sec) => sec.tests.some((t) => t.id === testId))?.id ?? null, testId, questionId },
      draftPayload: { ...s.draftPayload, stepIndex: 1, activeTestId: testId, activeQuestionId: questionId },
    }));
  }
  function openTest(testId, questionId = null) {
    recordPointer(testId, questionId);
    setFocus({ testId, questionId, nonce: Date.now() });
  }
  // "Fix this": jump to the step (and test / question / section of the page) that needs attention.
  function fix(f) {
    goTo(f.step);
    if (f.anchor) setAnchor(f.anchor);
    if (f.step === 1 && f.testId) openTest(f.testId, f.questionId || null);
  }
  function jumpToPointer() {
    const ptr = series.lastEditedPointer;
    setResumeDismissed(true);
    if (ptr?.testId && series.sections.some((s) => s.tests.some((t) => t.id === ptr.testId))) {
      setStepIndex(1);
      openTest(ptr.testId, ptr.questionId || null);
    } else {
      goTo(Math.min(series.lastEditedStep ?? 0, LAST));
    }
  }

  function move(to) {
    const r = transitionSeries(series.id, to);
    if (!r.ok) {
      setActionError(r.error);
      return false;
    }
    setActionError("");
    return true;
  }
  function saveAndExit() {
    if (flush()) navigate(isAssigned ? "/teacher/testseries/assigned" : "/teacher/testseries");
  }

  if (done) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pb-16">
        <ConfirmationCard
          state="success"
          heading="Submitted for review"
          message={`"${series.title}" is now under review. The admin will check it and approve it, and it goes live for students once approved. You'll find it under Test Series → Under review.`}
          primaryAction={<Button onClick={() => navigate("/teacher/testseries")}>Go to Under review</Button>}
          secondaryAction={<Button variant="secondary" onClick={() => navigate(isAssigned ? "/teacher/testseries/assigned" : "/teacher/testseries")}>{isAssigned ? "Back to Assigned to me" : "Back to Test Series"}</Button>}
        />
      </div>
    );
  }

  const status = series.status;
  return (
    <div className="pb-16">
      <div className="flex flex-col gap-4 border-b border-text/[0.07] pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <div className="eyebrow mb-1.5">Create</div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Test Series Builder</h1>
            <SeriesStatusBadge series={series} />
          </div>
          <p className="mt-1.5 truncate text-sm text-muted">{series.title || "Untitled test series"}</p>
          <OriginTags series={series} className="mt-2" />
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <SaveIndicator status={saveStatus} savedAt={savedAt || series.lastSavedAt} onRetry={retry} />
          <NavLink
            to={`/teacher/testseries/${series.id}/preview?from=builder`}
            className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-surface px-4 py-2 text-xs font-semibold text-text transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-card"
          >
            <EyeIcon className="h-3.5 w-3.5" />
            Preview as Student
          </NavLink>
          <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" onClick={saveAndExit}>
            Save &amp; exit
          </Button>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-4">
        <OverdueBanner series={series} onRequest={() => setExtOpen(true)} />
        {showResume && (
          <div role="region" aria-label="Resume where you left off" className="flex flex-col gap-3 rounded-3xl bg-pastel-blue px-5 py-4 text-pastel-blue-ink sm:flex-row sm:items-center">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold">Resume where you left off</p>
              <p className="text-xs opacity-90">Last edit: {resumeSummary(series)}{series.lastSavedAt ? ` (saved ${new Date(series.lastSavedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })})` : ""}</p>
            </div>
            <Button fullWidth={false} className="px-5 py-2 text-xs" onClick={jumpToPointer}>
              Pick up here <ArrowRightIcon className="h-3.5 w-3.5" />
            </Button>
            <button type="button" aria-label="Dismiss" onClick={() => setResumeDismissed(true)} className="self-end rounded-full p-1.5 hover:bg-white/50 sm:self-auto"><XIcon className="h-4 w-4" /></button>
          </div>
        )}
        {status === "final" && (
          <div className="flex items-start gap-3 rounded-3xl bg-pastel-lavender px-5 py-4 text-pastel-lavender-ink">
            <LockIcon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="text-sm font-semibold">Final published{series.finalizedAt ? ` on ${formatDate(series.finalizedAt)}` : ""}. Tests, questions and marks are locked. You can still edit details and extend deadlines.</p>
          </div>
        )}
        {status === "archived" && (
          <div className="flex flex-wrap items-center gap-3 rounded-3xl bg-pastel-orange px-5 py-4 text-pastel-orange-ink">
            <p className="flex-1 text-sm font-semibold">This series is archived and hidden from students. It's read-only until you unarchive it.</p>
            {!isAssigned && <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" onClick={() => move("drafting")}>Unarchive to draft</Button>}
          </div>
        )}
      </div>

      <div className="mt-6 rounded-3xl bg-surface px-5 py-5 shadow-soft sm:px-8">
        <span className="eyebrow mb-3 block">Series status</span>
        <LifecycleStepper series={series} />
      </div>

      {/* Desktop: full ProgressSteps. Mobile: compact stepper with a progress bar. */}
      <div className="mt-4 hidden overflow-x-auto rounded-3xl bg-surface px-5 py-5 shadow-soft sm:block sm:px-8">
        <ProgressSteps steps={labels} currentIndex={shownIndex} />
      </div>
      <div className="mt-4 rounded-3xl bg-surface px-5 py-4 shadow-soft sm:hidden">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-text">
            Step {shownIndex + 1} of {labels.length}
          </span>
          <span className="text-muted">{labels[shownIndex]}</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-text/[0.08]">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((shownIndex + 1) / labels.length) * 100}%` }} />
        </div>
      </div>

      <div className="mt-8">
        {pre === "method" && <StartMethodStep value={method} onChange={chooseMethod} />}
        {pre === "source" && <StartSourceStep method={method} series={series} onChange={patch} />}
        {!pre && stepIndex === 0 && <TestSeriesDetailsStep series={series} onChange={patch} showErrors={showErrors} />}
        {!pre && stepIndex === 1 && (
          <div inert={locked} className={locked ? "opacity-70" : undefined}>
            <TestSeriesStructureStep series={series} onChange={patch} readOnly={locked} focus={focus} onPointer={recordPointer} />
          </div>
        )}
        {!pre && stepIndex === 2 && <TestSeriesClassificationStep series={series} onChange={patch} showErrors={showErrors} />}
        {!pre && stepIndex === 3 && <TestSeriesAvailabilityStep series={series} onChange={patch} onRequestExtension={() => setExtOpen(true)} />}
        {!pre && stepIndex === 4 && <TestSeriesReviewStep series={series} onChange={patch} onFix={fix} />}
      </div>

      {actionError && <p role="alert" className="mt-6 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{actionError}</p>}

      {pre ? (
        <div className="mt-8 flex flex-col-reverse gap-3 border-t border-text/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => (pre === "source" ? setPre("method") : guard.go(isAssigned ? "/teacher/testseries/assigned" : "/teacher/testseries"))}>
            {pre === "source" ? "Back" : "Back to dashboard"}
          </Button>
          {pre === "method" && (
            <Button fullWidth={false} className="px-8" onClick={() => (hasSource ? setPre("source") : beginBuilding())}>
              Continue to {hasSource ? SOURCE_LABEL[method] : "Details"}
            </Button>
          )}
          {pre === "source" && (
            <div className="flex flex-col items-stretch gap-2 sm:items-end">
              <Button fullWidth={false} className="px-8" disabled={!sourceReady} onClick={beginBuilding}>Continue to Details</Button>
              {!sourceReady && <span className="text-xs text-muted">{method === "csv" ? "Import at least one question to continue." : "Create an outline to continue."}</span>}
            </div>
          )}
        </div>
      ) : (
      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-text/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => (stepIndex === 0 ? setPre(hasSource ? "source" : "method") : goTo(stepIndex - 1))}>
          Back
        </Button>
        {stepIndex < LAST ? (
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            {/* Wrapper catches clicks on the (pointer-events-none) disabled
                button so a blocked Continue reveals the inline field errors. */}
            <div onClick={() => !canContinue && setShowErrors(true)}>
              <Button fullWidth={false} className={`w-full px-8 sm:w-auto ${canContinue ? "" : "pointer-events-none"}`} disabled={!canContinue} onClick={() => goTo(stepIndex + 1)}>
                Continue to {STEPS[stepIndex + 1]}
              </Button>
            </div>
            {!canContinue && <span className="text-xs text-muted">Complete the required items on this step to continue.</span>}
          </div>
        ) : (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            {(status === "assigned" || status === "drafting") && (
              <>
                <Button variant="secondary" fullWidth={false} className="px-6" onClick={saveAndExit}>Save &amp; exit</Button>
                <Button fullWidth={false} className="px-8" disabled={blockers.length > 0} onClick={() => { if (move("ready")) setDone("ready"); }}>Submit for review</Button>
              </>
            )}
            {status === "ready" && (
              <>
                <span className="text-sm font-semibold text-pastel-orange-ink">Waiting for admin approval</span>
                <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => move("drafting")}>Withdraw &amp; keep editing</Button>
              </>
            )}
            {status === "published" && <Button variant="secondary" fullWidth={false} className="px-6" onClick={saveAndExit}>Save &amp; exit</Button>}
            {status === "archived" && <Button variant="secondary" fullWidth={false} className="px-6" onClick={saveAndExit}>Save &amp; exit</Button>}
            {blockers.length > 0 && (status === "assigned" || status === "drafting") && <span className="text-xs text-muted">{blockers.length} item{blockers.length === 1 ? "" : "s"} to fix first.</span>}
          </div>
        )}
      </div>
      )}

      <ExtensionRequestModal key={`ext-${extOpen}`} open={extOpen} series={series} onClose={() => setExtOpen(false)} onSubmit={(p) => requestExtension(series.id, p)} />
      <UnsavedChangesModal
        open={Boolean(guard.pending)}
        saveFailed={saveStatus === "error"}
        onSaveAndLeave={() => {
          if (flush()) guard.leave();
        }}
        onLeave={guard.leave}
        onStay={guard.stay}
      />
    </div>
  );
}
