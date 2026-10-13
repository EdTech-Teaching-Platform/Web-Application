// Test Series Builder — 4 steps (Details, Structure, Questions, Review)
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
import TestSeriesQuestionsStep from "../components/TestSeriesQuestionsStep";
import TestSeriesReviewStep from "../components/TestSeriesReviewStep";
import TestQuestionBuilder from "../components/TestQuestionBuilder";
import SaveIndicator from "../components/SaveIndicator";
import UnsavedChangesModal from "../components/UnsavedChangesModal";
import { ExtensionRequestModal } from "../components/AssignedSeriesActions";
import { LifecycleStepper, OriginTags, OverdueBanner, SeriesStatusBadge } from "../components/TestSeriesStatus";
import useUnsavedGuard from "../hooks/useUnsavedGuard";
import { detailsErrors, formatDate, isStructureLocked, publishBlockers, questionsStepErrors, structureErrors, topicSuggestions, visibilityNote } from "../data/testSeriesData";

const STEPS = ["Details", "Structure", "Questions", "Review"];
const STEP_PARAM = { details: 0, structure: 1, questions: 2, review: 3 };

function useSteps(series) {
  return useMemo(() => {
    if (!series) return [false, false, false];
    return [
      Object.keys(detailsErrors(series)).length === 0,
      structureErrors(series).length === 0,
      questionsStepErrors(series).length === 0,
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
    return `Questions · ${test.title || "Untitled test"}${qi >= 0 ? ` · Question ${qi + 1}` : ""}`;
  }
  return `${STEPS[Math.min(series.lastEditedStep ?? 0, 3)]} step`;
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
    if (autoResume) return 2;
    return Math.min(series?.draftPayload?.stepIndex ?? series?.lastEditedStep ?? 0, 3);
  });
  const [showErrors, setShowErrors] = useState(false);
  const [activeTestId, setActiveTestId] = useState(() => (autoResume ? series.lastEditedPointer.testId : null));
  const [focusQuestionId, setFocusQuestionId] = useState(() => (autoResume ? series.lastEditedPointer.questionId || null : null));
  const [done, setDone] = useState(null); // "ready" | "published" | "final"
  const [confirmFinal, setConfirmFinal] = useState(false);
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

  // An assigned series that hasn't been started moves straight to drafting (origin stays locked).
  const needsAutoStart = Boolean(series && !series.declined && series.origin === "assigned" && series.status === "assigned" && !series.draftPayload?.startCompleted);
  const autoStartId = needsAutoStart ? series.id : null;
  useEffect(() => {
    if (!autoStartId) return;
    updateSeries(autoStartId, {
      startMethod: "scratch",
      status: "drafting",
      stepReached: 0,
      lastEditedStep: 0,
      draftPayload: { startCompleted: true, stepIndex: 0, activeTestId: null, activeQuestionId: null },
    });
    setStepIndex(0);
  }, [autoStartId, updateSeries]);

  const dirty = saveStatus !== "saved";
  const guard = useUnsavedGuard(dirty);

  const patch = useCallback(
    (p) => {
      setResumeDismissed(true);
      updateSeries(seriesId, (s) => ({ ...p, lastEditedStep: stepIndex, draftPayload: { ...s.draftPayload, stepIndex } }));
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

  if (needsAutoStart) return null; // the effect above flips it to drafting on the next render

  const locked = isStructureLocked(series);
  const activeSection = activeTestId ? series.sections.find((s) => s.tests.some((t) => t.id === activeTestId)) : null;
  const activeTest = activeSection ? activeSection.tests.find((t) => t.id === activeTestId) : null;
  const blockers = publishBlockers(series);
  const canContinue = stepIndex < 3 && stepValid[stepIndex];
  const isAssigned = series.origin === "assigned";
  const showResume = !resumeDismissed && !locked && ["assigned", "drafting"].includes(series.status) && (series.lastEditedStep > 0 || series.lastEditedPointer);

  function goTo(i) {
    setStepIndex(i);
    setShowErrors(false);
    setActionError("");
    updateSeries(series.id, (s) => ({
      stepReached: Math.max(s.stepReached ?? 0, i),
      lastEditedStep: i,
      draftPayload: { ...s.draftPayload, stepIndex: i, activeTestId: null },
    }));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function openTest(testId, questionId = null) {
    pointerRef.current = { questionId };
    setFocusQuestionId(questionId);
    setActiveTestId(testId);
    if (!locked) {
      updateSeries(series.id, (s) => ({
        lastEditedStep: 2,
        lastEditedPointer: { sectionId: s.sections.find((sec) => sec.tests.some((t) => t.id === testId))?.id ?? null, testId, questionId },
        draftPayload: { ...s.draftPayload, stepIndex: 2, activeTestId: testId, activeQuestionId: questionId },
      }));
    }
  }
  function closeTest() {
    setActiveTestId(null);
    updateSeries(series.id, (s) => ({ draftPayload: { ...s.draftPayload, activeTestId: null } }));
    flush();
  }
  function changeQuestions(testId, questions) {
    setResumeDismissed(true);
    updateSeries(series.id, (s) => {
      const sectionId = s.sections.find((sec) => sec.tests.some((t) => t.id === testId))?.id ?? null;
      return {
        sections: s.sections.map((sec) => ({ ...sec, tests: sec.tests.map((t) => (t.id === testId ? { ...t, questions } : t)) })),
        lastEditedStep: 2,
        lastEditedPointer: { sectionId, testId, questionId: pointerRef.current.questionId },
        draftPayload: { ...s.draftPayload, stepIndex: 2, activeTestId: testId, activeQuestionId: pointerRef.current.questionId },
      };
    });
  }
  // "Fix this": jump to the step (and test / question / section of the page) that needs attention.
  function fix(f) {
    goTo(f.step);
    if (f.anchor) setAnchor(f.anchor);
    if (f.step === 2 && f.testId) openTest(f.testId, f.questionId || null);
  }
  function jumpToPointer() {
    const ptr = series.lastEditedPointer;
    setResumeDismissed(true);
    if (ptr?.testId && series.sections.some((s) => s.tests.some((t) => t.id === ptr.testId))) {
      setStepIndex(2);
      openTest(ptr.testId, ptr.questionId || null);
    } else {
      goTo(Math.min(series.lastEditedStep ?? 0, 3));
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

  if (confirmFinal) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center pb-16">
        <ConfirmationCard
          state="warning"
          heading="Final publish this series?"
          message="This locks the structure: sections, tests, questions and marks become read-only for good. You can still edit the title, description, tags and pricing, and extend deadlines. Students who already enrolled keep their access."
          primaryAction={
            <Button
              onClick={() => {
                if (move("final")) {
                  setConfirmFinal(false);
                  setDone("final");
                }
              }}
            >
              Yes, final publish
            </Button>
          }
          secondaryAction={<Button variant="secondary" onClick={() => setConfirmFinal(false)}>Not yet</Button>}
        />
      </div>
    );
  }

  if (done) {
    const copy = {
      ready: { heading: "Submitted for review", message: `"${series.title}" is ready for review. When you're happy with it, publish it to make it visible to students.` },
      published: { heading: "Your test series is published!", message: `"${series.title}" is published. ${visibilityNote(series)}. Final publish it later to lock the structure.` },
      final: { heading: "Final published", message: `"${series.title}" is live and its structure is locked. You can still extend deadlines and edit its details.` },
    }[done];
    return (
      <div className="flex min-h-[60vh] items-center justify-center pb-16">
        <ConfirmationCard
          state="success"
          heading={copy.heading}
          message={copy.message}
          primaryAction={
            done === "ready" ? (
              <Button
                onClick={() => {
                  if (move("published")) setDone("published");
                }}
              >
                Publish now
              </Button>
            ) : (
              <Button onClick={() => navigate(isAssigned ? "/teacher/testseries/assigned" : "/teacher/testseries")}>Back to Test Series</Button>
            )
          }
          secondaryAction={
            <Button variant="secondary" onClick={() => (done === "ready" ? navigate("/teacher/testseries") : setDone(null))}>
              {done === "ready" ? "Back to Test Series" : "Keep editing"}
            </Button>
          }
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
            <p className="text-sm font-semibold">Final published{series.finalizedAt ? ` on ${formatDate(series.finalizedAt)}` : ""}. Sections, tests, questions and marks are locked. You can still edit details and extend deadlines.</p>
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
        <ProgressSteps steps={STEPS} currentIndex={stepIndex} />
      </div>
      <div className="mt-4 rounded-3xl bg-surface px-5 py-4 shadow-soft sm:hidden">
        <div className="flex items-center justify-between text-sm">
          <span className="font-semibold text-text">
            Step {stepIndex + 1} of {STEPS.length}
          </span>
          <span className="text-muted">{STEPS[stepIndex]}</span>
        </div>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-text/[0.08]">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
        </div>
      </div>

      <div className="mt-8">
        {stepIndex === 0 && <TestSeriesDetailsStep series={series} onChange={patch} showErrors={showErrors} onRequestExtension={() => setExtOpen(true)} />}
        {stepIndex === 1 && (
          <div inert={locked} className={locked ? "opacity-70" : undefined}>
            <TestSeriesStructureStep series={series} onChange={patch} onOpenQuestions={(id) => openTest(id)} />
          </div>
        )}
        {stepIndex === 2 && <TestSeriesQuestionsStep series={series} onOpenQuestions={(id) => openTest(id)} onGoStep={goTo} readOnly={locked} />}
        {stepIndex === 3 && <TestSeriesReviewStep series={series} onChange={patch} onFix={fix} />}
      </div>

      {actionError && <p role="alert" className="mt-6 rounded-2xl bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">{actionError}</p>}

      <div className="mt-8 flex flex-col-reverse gap-3 border-t border-text/[0.07] pt-6 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => (stepIndex === 0 ? guard.go(isAssigned ? "/teacher/testseries/assigned" : "/teacher/testseries") : goTo(stepIndex - 1))}>
          {stepIndex === 0 ? "Back to dashboard" : "Back"}
        </Button>
        {stepIndex < 3 ? (
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
                <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => move("drafting")}>Back to drafting</Button>
                <Button fullWidth={false} className="px-8" disabled={blockers.length > 0} onClick={() => { if (move("published")) setDone("published"); }}>Publish</Button>
              </>
            )}
            {status === "published" && (
              <>
                <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => move("drafting")}>Revert to draft</Button>
                <Button fullWidth={false} className="px-8" onClick={() => setConfirmFinal(true)}>Final publish…</Button>
              </>
            )}
            {(status === "final" || status === "archived") && <Button variant="secondary" fullWidth={false} className="px-6" onClick={saveAndExit}>Save &amp; exit</Button>}
            {blockers.length > 0 && (status === "assigned" || status === "drafting" || status === "ready") && <span className="text-xs text-muted">{blockers.length} item{blockers.length === 1 ? "" : "s"} to fix first.</span>}
          </div>
        )}
      </div>

      {activeTest && (
        <TestQuestionBuilder
          key={activeTest.id}
          test={activeTest}
          sectionTitle={activeSection.title}
          topics={topicSuggestions(series)}
          readOnly={locked}
          initialExpandedId={focusQuestionId}
          onFocusQuestion={(qid) => {
            pointerRef.current = { questionId: qid };
          }}
          onChangeQuestions={(qs) => changeQuestions(activeTest.id, qs)}
          onClose={closeTest}
        />
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
