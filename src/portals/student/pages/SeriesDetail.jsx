// Test series detail. Student mode: student_get_series (enrolment + per-test
// status) and student_enroll. Public mode (/test-series/:id): public_get_series,
// with every action going through login first.
//
// Presentation-only redesign: same data, routes and handlers as before. Calm,
// professional look shared with the other student pages.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRightIcon, ClockIcon, FileTextIcon, BookOpenIcon, TargetIcon } from "../../../components/ui/icons";
import StatusBadge from "../../../components/ui/StatusBadge";
import { EmptyPanel, ErrorState, LoadingState } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { isNotAvailable, isNotFound } from "../services/studentRpc";
import LoginPrompt from "../../../public/components/LoginPrompt";
import { ATTEMPT_STATUS, formatDate, formatMinutes, formatPercent, priceLabel } from "../utils/format";
import { MyFeedbackList } from "../components/FeedbackForm";
import { SeriesBanner } from "../components/TestImages";

function testState(test, enrolled) {
  const now = Date.now();
  if (!enrolled) return { kind: "locked", label: "Enrol to start" };
  if (test.in_progress_attempt_id) return { kind: "resume", label: "Resume" };
  if (test.opens_at && new Date(test.opens_at).getTime() > now) return { kind: "later", label: `Opens ${formatDate(test.opens_at, true)}` };
  if (test.closes_at && new Date(test.closes_at).getTime() <= now) return { kind: "closed", label: "Closed" };
  if (test.attempts_remaining <= 0) return { kind: "done", label: "No attempts left" };
  if (!test.questions_count) return { kind: "empty", label: "Coming soon" };
  return { kind: "start", label: test.attempts_used > 0 ? "Retake" : "Start" };
}

const WIDE = "mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8";
const SURFACE = "rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)";

const BACK_LINK =
  `inline-flex w-fit items-center gap-2 rounded-full py-1 text-sm font-semibold text-(--lp-muted) transition-colors duration-150 hover:text-(--lp-ink) ${FOCUS}`;

function FactCell({ icon: Icon, value, label }) {
  return (
    <div className="flex items-center gap-3.5 bg-white p-4 sm:p-5">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-(--lp-blue-tint) text-(--lp-blue-deep)" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0">
        <p className="truncate font-display text-xl font-semibold leading-none tabular-nums tracking-tight text-(--lp-ink) sm:text-2xl">{value}</p>
        <p className="mt-1.5 text-xs font-medium text-(--lp-muted)">{label}</p>
      </div>
    </div>
  );
}

function TestRow({ test, enrolled, onOpen, onReport, index }) {
  const state = testState(test, enrolled);
  const latest = ATTEMPT_STATUS[test.latest_status];
  const actionable = ["resume", "start"].includes(state.kind);
  const disabled = !actionable && state.kind !== "locked";
  const facts = [`${test.questions_count} questions`, `${test.total_marks} marks`, formatMinutes(test.time_limit_mins), `pass ${formatPercent(test.passing_percentage)}`];
  return (
    <li className="flex flex-col gap-4 p-4 transition-colors duration-150 hover:bg-(--lp-grey)/50 sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-(--lp-blue-soft) font-display text-base font-semibold text-(--lp-blue-deep)" aria-hidden="true">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="font-display text-[15px] font-semibold leading-snug text-(--lp-ink)">{test.title}</p>
          <p className="mt-1 text-xs text-(--lp-muted)">{facts.join(" · ")}</p>
          {enrolled && (
            <p className="mt-1 text-xs font-medium text-text/70">
              Attempts {test.attempts_used}/{test.attempts_allowed}
              {test.best_percentage !== null && test.best_percentage !== undefined && <> · best {formatPercent(test.best_percentage, 1)}</>}
            </p>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2 sm:justify-end">
        {test.passed && <StatusBadge status="success">Passed</StatusBadge>}
        {!test.passed && latest && test.latest_status !== "in_progress" && <StatusBadge status={latest.tone}>{latest.label}</StatusBadge>}
        {enrolled && test.latest_attempt_id && test.latest_status !== "in_progress" && (
          <button type="button" onClick={() => onReport(test.latest_attempt_id)}
            className={`inline-flex items-center rounded-full bg-white px-4 py-2 text-[13px] font-semibold text-(--lp-ink) ring-1 ring-(--lp-line) transition-colors hover:bg-(--lp-grey) ${FOCUS}`}>
            Report
          </button>
        )}
        <button type="button" disabled={disabled} onClick={() => onOpen(test, state)}
          className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2 text-[13px] font-semibold transition-colors duration-200 ${FOCUS} ${
            disabled
              ? "cursor-not-allowed bg-(--lp-grey) text-text/40"
              : actionable
                ? "bg-(--lp-ink) text-white hover:bg-(--lp-blue-deep)"
                : "bg-(--lp-blue-deep) text-white hover:bg-(--lp-ink)"
          }`}>
          {state.label}
          {actionable && <ChevronRightIcon className="h-4 w-4" />}
        </button>
      </div>
    </li>
  );
}

// `from` says which screen the student opened this series from, so the page
// sits under that tab and "back" returns there: "browse" (Test Series list),
// "mine" (My Tests) or "dashboard".
const BACK = {
  browse: { to: "/student/test-series", label: "← All test series", errLabel: "Back to all test series" },
  mine: { to: "/student/my-tests", label: "← My tests", errLabel: "Back to my tests" },
  dashboard: { to: "/student/dashboard", label: "← Dashboard", errLabel: "Back to dashboard" },
};

export default function SeriesDetail({ publicMode = false, from = "browse" }) {
  const { seriesId } = useParams();
  const navigate = useNavigate();
  const [enrolling, setEnrolling] = useState(false);
  const [notice, setNotice] = useState("");
  const [loginOpen, setLoginOpen] = useState(false);
  const { data: series, error, loading, reload } = useStudentData(
    () => (publicMode ? studentSeriesApi.publicGet(seriesId) : studentSeriesApi.get(seriesId)),
    `${publicMode}|${seriesId}`,
  );

  const loginFirst = () => setLoginOpen(true);

  const enroll = async () => {
    if (publicMode) return loginFirst();
    setEnrolling(true);
    setNotice("");
    try {
      await studentSeriesApi.enroll(seriesId);
      await reload();
    } catch (err) {
      setNotice(isNotAvailable(err) ? "Paid test series can't be bought yet. Free series are open now." : err.message);
    } finally {
      setEnrolling(false);
    }
    return undefined;
  };

  const openTest = (test, state) => {
    if (publicMode || state.kind === "locked") return publicMode ? loginFirst() : enroll();
    navigate(state.kind === "resume" ? `/student/test/${test.id}/take` : `/student/test/${test.id}`);
    return undefined;
  };

  const back = publicMode ? { to: "/test-series", label: "← All test series", errLabel: "Back to all test series" } : (BACK[from] ?? BACK.browse);
  const backTo = back.to;

  if (loading) return <div className={WIDE}><LoadingState label="Loading test series" /></div>;
  if (error) {
    return (
      <div className={WIDE}>
        <ErrorState
          error={isNotFound(error) ? { message: "This test series isn't available." } : error}
          onRetry={isNotFound(error) ? undefined : reload}
          title={isNotFound(error) ? "Test series not found" : "Couldn't load this test series"}
        />
        <Link to={backTo} className={BACK_LINK}>{back.errLabel}</Link>
      </div>
    );
  }

  const enrolled = Boolean(series.is_enrolled);
  const tests = series.tests ?? [];
  const eyebrow = [series.exam, series.subject, series.level].filter(Boolean).join(" · ") || "Test series";
  const hasAccessNote = Boolean(series.available_until || series.enrollment?.expires_at);
  const hasRail = Boolean(series.instructions || hasAccessNote);

  return (
    <div className={`${WIDE} pb-12`}>
      <Link to={backTo} className={BACK_LINK}>{back.label}</Link>

      <SeriesBanner path={series.cover_path} className="rounded-2xl" />

      <header className={`${SURFACE} flex flex-col gap-5 p-5 sm:p-8 md:flex-row md:items-center md:justify-between md:gap-8`}>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--lp-muted)">{eyebrow}</p>
          <h1 className="mt-2 break-words font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-(--lp-ink) sm:text-[2.25rem]">{series.title}</h1>
          {series.description && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-(--lp-muted) sm:text-[15px]">{series.description}</p>}
        </div>
        <div className="shrink-0">
          {enrolled ? (
            <span className="inline-flex items-center gap-2 rounded-full bg-success/10 px-5 py-2.5 text-sm font-semibold text-success ring-1 ring-success/20">Enrolled</span>
          ) : (
            <button type="button" onClick={enroll} disabled={enrolling}
              className={`inline-flex items-center justify-center gap-2 rounded-full bg-(--lp-ink) px-6 py-3 text-sm font-semibold text-white transition-colors duration-200 hover:bg-(--lp-blue-deep) disabled:opacity-60 ${FOCUS}`}>
              {enrolling ? "Enrolling…" : series.is_free ? "Enrol free" : `Enrol · ${priceLabel(series)}`}
            </button>
          )}
        </div>
      </header>

      {notice && <p role="status" className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-text">{notice}</p>}

      <section className={`${SURFACE} grid grid-cols-2 gap-px overflow-hidden bg-(--lp-line) lg:grid-cols-4`} aria-label="Series facts">
        <FactCell icon={FileTextIcon} value={series.tests_count ?? tests.length} label="Tests" />
        <FactCell icon={BookOpenIcon} value={series.questions_count ?? 0} label="Questions" />
        <FactCell icon={ClockIcon} value={formatMinutes(series.total_duration_mins)} label="Total time" />
        <FactCell icon={TargetIcon} value={priceLabel(series)} label="Price" />
      </section>

      <div className={`grid gap-6 lg:gap-8 ${hasRail ? "lg:grid-cols-[minmax(0,1fr)_21rem] lg:items-start" : ""}`}>
        <div className="min-w-0 space-y-8">
          <section className="space-y-4">
            <h2 className="font-display text-lg font-semibold tracking-tight text-(--lp-ink) sm:text-xl">Tests</h2>
            {tests.length === 0 ? (
              <EmptyPanel heading="No tests yet" message="Tests will appear here as soon as they're published in this series." />
            ) : (
              <ol className={`${SURFACE} divide-y divide-(--lp-line) overflow-hidden`}>
                {tests.map((t, i) => (
                  <TestRow key={t.id} test={t} index={i} enrolled={enrolled && !publicMode} onOpen={openTest}
                    onReport={(attemptId) => navigate(`/student/report/${attemptId}`)} />
                ))}
              </ol>
            )}
          </section>

          {!publicMode && enrolled && <MyFeedbackList seriesId={seriesId} />}
        </div>

        {hasRail && (
          <aside className="min-w-0 space-y-6">
            {series.instructions && (
              <section className={`${SURFACE} p-5 sm:p-6`}>
                <h2 className="font-display text-base font-semibold tracking-tight text-(--lp-ink)">Instructions</h2>
                <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-(--lp-muted)">{series.instructions}</p>
              </section>
            )}
            {hasAccessNote && (
              <section className={`${SURFACE} p-5 sm:p-6`}>
                <h2 className="font-display text-base font-semibold tracking-tight text-(--lp-ink)">Access</h2>
                <p className="mt-3 text-sm leading-relaxed text-(--lp-muted)">
                  {series.available_until && <>Available until {formatDate(series.available_until)}. </>}
                  {series.enrollment?.expires_at && <>Your access ends {formatDate(series.enrollment.expires_at)}.</>}
                </p>
              </section>
            )}
          </aside>
        )}
      </div>

      {publicMode && (
        <LoginPrompt
          open={loginOpen}
          onClose={() => setLoginOpen(false)}
          redirect={`/student/test-series/${seriesId}`}
          title="Log in to enrol"
        />
      )}
    </div>
  );
}
