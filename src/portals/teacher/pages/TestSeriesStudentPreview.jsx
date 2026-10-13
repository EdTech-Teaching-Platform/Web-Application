// TestSeriesStudentPreview — host for "Preview as Student" (teacher portal).
// Routes (see routes.jsx, inside TestSeriesGuard):
//   /teacher/testseries/:seriesId/preview            -> test selection
//   /teacher/testseries/:seriesId/preview/:testId    -> taking + results
//
// It renders the SAME reusable student components the real student flow will
// use (src/components/testseries/*) with mode="preview".
//
// DATA ISOLATION -- this file is READ-ONLY with respect to the Test Series
// store. It only destructures { series, currentTeacher } from
// useTestSeries() and never imports or calls updateSeries / createSeries /
// deleteSeries / duplicateSeries / gradeTsSubmission / saveDraftTsGrade /
// requestTsResubmission / setTeacherAccess, nor touches localStorage, the
// seeded submissions / Grading queue, analyticsData or earningsData. The
// attempt result lives in this component's useState only (gone on leaving),
// "simulated enrolment" unlocks are local state only, and the in-progress
// answers live in sessionStorage under `ul.testrun.preview.*` (cleared on
// Exit / fresh start / submit) -- never in `ul.testSeries.v1`.
import { useEffect, useMemo, useRef, useState } from "react";
import { Navigate, NavLink, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { useAuth } from "../../../hooks/useAuth";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import EmptyState from "../../../components/ui/EmptyState";
import { AlertTriangleIcon, LockIcon, QuizIcon } from "../../../components/ui/icons";
import TestSeriesSelection from "../../../components/testseries/TestSeriesSelection";
import TestRunner, { clearTestDraft } from "../../../components/testseries/TestRunner";
import TestResults from "../../../components/testseries/TestResults";
import { validateTestForRun } from "../../../components/testseries/scoreAttempt";
import TestSeriesPreviewBanner from "../components/TestSeriesPreviewBanner";
import { TS_STATUS_META, visibilityNote } from "../data/testSeriesData";

const pill =
  "inline-flex min-h-11 items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-glow-primary";

function PreviewSkeleton() {
  return (
    <div className="flex animate-pulse flex-col gap-4 pb-12" aria-busy="true" aria-label="Loading preview">
      <div className="h-24 rounded-3xl bg-text/[0.06]" />
      <div className="h-44 rounded-3xl bg-text/[0.06]" />
      <div className="h-24 rounded-3xl bg-text/[0.06]" />
      <div className="h-24 rounded-3xl bg-text/[0.06]" />
    </div>
  );
}

// Lifecycle status line for the preview banner (drafts stay previewable).
function previewStatusNote(series) {
  const label = TS_STATUS_META[series.status]?.label || "Draft";
  return `Status: ${label}. ${visibilityNote(series)}.`;
}

function findTest(series, testId) {
  for (const section of series.sections) {
    const test = section.tests.find((t) => t.id === testId);
    if (test) return { test, section };
  }
  return null;
}

export default function TestSeriesStudentPreview() {
  const params = useParams();
  const { pathname } = useLocation();
  const seriesId = params.seriesId;
  const testId = params.testId ?? pathname.match(/\/preview\/([^/]+)/)?.[1] ?? null;
  const [search] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { series: allSeries, currentTeacher } = useTestSeries(); // read-only

  const fromBuilder = search.get("from") === "builder";
  const suffix = fromBuilder ? "?from=builder" : "";
  const exitTo = fromBuilder ? `/teacher/testseries/${seriesId}` : "/teacher/testseries";
  const baseTo = `/teacher/testseries/${seriesId}/preview${suffix}`;

  const [ready, setReady] = useState(false);
  const [retry, setRetry] = useState(0);
  const [unlocked, setUnlocked] = useState([]); // simulated enrolment, local only
  const [results, setResults] = useState({}); // { [testId]: result } -- local only, never persisted
  const [runKey, setRunKey] = useState(0);
  const [exitOpen, setExitOpen] = useState(false);
  const dirtyRef = useRef(false);
  const setDirty = useRef((v) => {
    dirtyRef.current = v;
  }).current;

  useEffect(() => {
    setReady(false);
    const id = setTimeout(() => setReady(true), 250);
    return () => clearTimeout(id);
  }, [seriesId, retry]);

  const series = allSeries.find((s) => s.id === seriesId) || null;
  const isAdmin = user?.role === "admin";
  // With the demo-auth fallback currentTeacher is the demo educator, so they
  // own their own series; everyone else is denied (admins may preview any).
  const allowed = Boolean(series) && (isAdmin || (currentTeacher && series.teacherId === currentTeacher.id));

  // Structural check of the series + selected test (try/catch -> error state).
  const problem = useMemo(() => {
    if (!series || !allowed) return null;
    try {
      if (!Array.isArray(series.sections) || series.sections.some((s) => !s || !Array.isArray(s.tests))) throw new Error("This series has malformed section data.");
      series.sections.forEach((s) => s.tests.forEach((t) => validateTestForRun(t)));
      return null;
    } catch (e) {
      return e instanceof Error ? e.message : "Something went wrong loading this preview.";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [series, allowed, retry]);

  function dropResult(id) {
    setResults((r) => {
      const next = { ...r };
      delete next[id];
      return next;
    });
  }
  function leave() {
    if (testId) clearTestDraft("preview", seriesId, testId);
    navigate(exitTo);
  }
  function requestExit() {
    if (testId && !results[testId] && dirtyRef.current) setExitOpen(true);
    else leave();
  }

  if (!ready) return <PreviewSkeleton />;

  if (!series) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState icon={QuizIcon} heading="Test series not found" message="It may have been deleted. Head back to your test series." action={<NavLink to="/teacher/testseries" className={pill}>Back to Test Series</NavLink>} />
      </div>
    );
  }
  if (!allowed) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState icon={LockIcon} heading="You can't preview this series" message="Only the educator who owns a test series (or an admin) can preview it." action={<NavLink to="/teacher/testseries" className={pill}>Back to Test Series</NavLink>} />
      </div>
    );
  }
  if (problem) {
    return (
      <div className="mx-auto max-w-lg pt-10">
        <EmptyState
          icon={AlertTriangleIcon}
          heading="This preview couldn't be loaded"
          message={problem}
          action={
            <div className="flex flex-wrap justify-center gap-2">
              <Button fullWidth={false} className="min-h-11 px-6" onClick={() => setRetry((n) => n + 1)}>
                Retry
              </Button>
              <Button variant="secondary" fullWidth={false} className="min-h-11 px-6" onClick={() => navigate(exitTo)}>
                Back
              </Button>
            </div>
          }
        />
      </div>
    );
  }

  const paid = series.pricing?.model === "paid";
  const banner = <TestSeriesPreviewBanner paid={paid} onExit={requestExit} statusNote={previewStatusNote(series)} />;

  // No tests at all -> explain, with a way back to the builder.
  const hasTests = series.sections.some((s) => s.tests.length > 0);
  if (!hasTests) {
    return (
      <div className="flex flex-col gap-5 pb-12">
        {banner}
        <EmptyState
          icon={QuizIcon}
          heading="No tests to preview yet"
          message="Add sections and tests to this series in the builder, then come back to preview them as a student."
          action={<NavLink to={`/teacher/testseries/${series.id}`} className={pill}>Open builder</NavLink>}
        />
      </div>
    );
  }

  const found = testId ? findTest(series, testId) : null;
  if (testId && !found) {
    return (
      <div className="flex flex-col gap-5 pb-12">
        {banner}
        <EmptyState icon={QuizIcon} heading="Test not found" message="This test may have been removed from the series." action={<NavLink to={baseTo} className={pill}>Back to tests</NavLink>} />
      </div>
    );
  }

  // Selection screen
  if (!found) {
    return (
      <TestSeriesSelection
        series={series}
        banner={banner}
        unlockedTestIds={unlocked}
        onUnlock={(t) => setUnlocked((u) => (u.includes(t.id) ? u : [...u, t.id]))}
        onUnlockAll={() => setUnlocked(series.sections.flatMap((s) => s.tests.map((t) => t.id)))}
        onStartTest={(t) => {
          clearTestDraft("preview", series.id, t.id); // every start from the list is a fresh attempt
          dropResult(t.id);
          setRunKey((k) => k + 1);
          navigate(`/teacher/testseries/${series.id}/preview/${t.id}${suffix}`);
        }}
      />
    );
  }

  const { test, section } = found;
  // Direct URL to a locked / empty test: send back to the list (as a
  // non-enrolled student would be).
  if ((test.locked && !unlocked.includes(test.id)) || test.questions.length === 0) {
    return <Navigate to={baseTo} replace />;
  }

  const result = results[test.id];
  if (result) {
    return (
      <TestResults
        series={series}
        test={test}
        result={result}
        answers={result.answers}
        mode="preview"
        banner={banner}
        footerNote="This was a preview attempt and has not been recorded."
        onBack={() => navigate(baseTo)}
        onRetry={() => {
          clearTestDraft("preview", series.id, test.id);
          dropResult(test.id);
          setRunKey((k) => k + 1);
        }}
        onExit={leave}
        exitLabel="Exit Preview"
      />
    );
  }

  return (
    <>
      <TestRunner
        key={`${test.id}-${runKey}`}
        series={series}
        test={test}
        sectionTitle={section.title}
        mode="preview"
        banner={banner}
        onDirtyChange={setDirty}
        // Preview submit: keep the result in LOCAL state only. Nothing is persisted.
        onSubmit={(r) => setResults((prev) => ({ ...prev, [test.id]: r }))}
      />
      <Modal
        open={exitOpen}
        onClose={() => setExitOpen(false)}
        title="Leave preview?"
        footer={
          <>
            <Button fullWidth={false} className="min-h-11 px-6" onClick={leave}>
              Leave preview
            </Button>
            <Button variant="secondary" fullWidth={false} className="min-h-11 px-6" onClick={() => setExitOpen(false)}>
              Keep going
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">Leave preview? Your preview answers will be discarded.</p>
      </Modal>
    </>
  );
}
