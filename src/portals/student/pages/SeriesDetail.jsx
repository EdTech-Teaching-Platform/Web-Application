// Test series detail. Student mode: student_get_series (enrolment + per-test
// status) and student_enroll. Public mode (/test-series/:id): public_get_series,
// with every action going through login first.
//
// Presentation-only redesign: same data, routes and handlers as before.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ChevronRightIcon, ClockIcon, FileTextIcon, BookOpenIcon, TargetIcon } from "../../../components/ui/icons";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ErrorState, LoadingState, PAGE } from "../components/PageState";
import PageHero, { HERO_BTN_YELLOW } from "../components/PageHero";
import StatBlock, { STAT_BLOCK_LABEL, STAT_BLOCK_VALUE_COMPACT } from "../components/StatBlock";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { isNotAvailable, isNotFound } from "../services/studentRpc";
import { ATTEMPT_STATUS, formatDate, formatMinutes, formatPercent, priceLabel } from "../utils/format";

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

const BACK_LINK =
  "inline-flex w-fit items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-[0_8px_20px_rgb(15_17_21/0.1)]";

function Fact({ children }) {
  return <span className="rounded-full bg-(--lp-grey) px-3 py-1 text-xs font-semibold text-text/70">{children}</span>;
}

function TestRow({ test, enrolled, onOpen, onReport, index }) {
  const state = testState(test, enrolled);
  const latest = ATTEMPT_STATUS[test.latest_status];
  const actionable = ["resume", "start"].includes(state.kind);
  const disabled = !actionable && state.kind !== "locked";
  return (
    <li className="flex flex-col gap-4 rounded-[1.5rem] bg-white p-4 ring-1 ring-(--lp-line) transition-shadow duration-200 hover:shadow-[0_14px_32px_rgb(15_17_21/0.08)] sm:flex-row sm:items-center sm:p-5">
      <div className="flex min-w-0 flex-1 items-center gap-4">
        <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-(--lp-blue-soft) font-display text-lg font-bold text-primary" aria-hidden="true">
          {index + 1}
        </span>
        <div className="min-w-0">
          <p className="font-display text-base font-bold leading-snug text-text">{test.title}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <Fact>{test.questions_count} questions</Fact>
            <Fact>{test.total_marks} marks</Fact>
            <Fact>{formatMinutes(test.time_limit_mins)}</Fact>
            <Fact>pass {formatPercent(test.passing_percentage)}</Fact>
          </div>
          {enrolled && (
            <p className="mt-2 text-xs font-medium text-text/60">
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
            className="inline-flex items-center rounded-full bg-white px-4 py-2.5 text-sm font-semibold text-primary ring-1 ring-(--lp-line) transition-colors hover:bg-(--lp-blue-tint)">
            Report
          </button>
        )}
        <button type="button" disabled={disabled} onClick={() => onOpen(test, state)}
          className={`inline-flex items-center gap-1.5 rounded-full px-5 py-2.5 text-sm font-semibold transition-[transform,box-shadow] duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
            disabled
              ? "cursor-not-allowed bg-(--lp-grey) text-text/40"
              : actionable
                ? "bg-(--lp-ink) text-white hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgb(15_17_21/0.25)]"
                : "bg-(--lp-yellow) text-(--lp-ink) hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgb(15_17_21/0.18)]"
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
  const { data: series, error, loading, reload } = useStudentData(
    () => (publicMode ? studentSeriesApi.publicGet(seriesId) : studentSeriesApi.get(seriesId)),
    `${publicMode}|${seriesId}`,
  );

  const loginFirst = () => navigate(`/login?redirect=${encodeURIComponent(`/student/test-series/${seriesId}`)}`);

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

  if (loading) return <div className={PAGE}><LoadingState label="Loading test series" /></div>;
  if (error) {
    return (
      <div className={PAGE}>
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

  return (
    <div className={PAGE}>
      <Link to={backTo} className={BACK_LINK}>{back.label}</Link>

      <PageHero
        compact
        theme="blue"
        art="shelf"
        eyebrow={[series.exam, series.subject, series.level].filter(Boolean).join(" · ") || "Test series"}
        title={series.title}
        subtitle={series.description}
      >
        {enrolled ? (
          <span className="inline-flex items-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-success">Enrolled</span>
        ) : (
          <button type="button" onClick={enroll} disabled={enrolling} className={`${HERO_BTN_YELLOW} disabled:opacity-60`}>
            {enrolling ? "Enrolling…" : series.is_free ? "Enrol free" : `Enrol · ${priceLabel(series)}`}
          </button>
        )}
      </PageHero>

      {notice && <p role="status" className="rounded-2xl bg-warning/10 px-4 py-3 text-sm text-text">{notice}</p>}

      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4" aria-label="Series facts">
        <StatBlock compact tone="blue" icon={FileTextIcon}>
          <p className={STAT_BLOCK_VALUE_COMPACT}>{series.tests_count ?? tests.length}</p>
          <p className={`mt-2 ${STAT_BLOCK_LABEL}`}>Tests</p>
        </StatBlock>
        <StatBlock compact tone="yellow" icon={BookOpenIcon}>
          <p className={STAT_BLOCK_VALUE_COMPACT}>{series.questions_count ?? 0}</p>
          <p className={`mt-2 ${STAT_BLOCK_LABEL}`}>Questions</p>
        </StatBlock>
        <StatBlock compact tone="sky" icon={ClockIcon}>
          <p className={STAT_BLOCK_VALUE_COMPACT}>{formatMinutes(series.total_duration_mins)}</p>
          <p className={`mt-2 ${STAT_BLOCK_LABEL}`}>Total time</p>
        </StatBlock>
        <StatBlock compact tone="ink" icon={TargetIcon}>
          <p className={STAT_BLOCK_VALUE_COMPACT}>{priceLabel(series)}</p>
          <p className={`mt-2 ${STAT_BLOCK_LABEL}`}>Price</p>
        </StatBlock>
      </section>

      {(series.available_until || series.enrollment?.expires_at) && (
        <p className="text-sm font-medium text-text/60">
          {series.available_until && <>Available until {formatDate(series.available_until)}. </>}
          {series.enrollment?.expires_at && <>Your access ends {formatDate(series.enrollment.expires_at)}.</>}
        </p>
      )}

      {series.instructions && (
        <section className="rounded-[1.75rem] bg-(--lp-yellow-soft) p-6 ring-1 ring-(--lp-line)">
          <h2 className="font-display text-xl font-bold tracking-tight text-text">Instructions</h2>
          <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-text/75">{series.instructions}</p>
        </section>
      )}

      <section>
        <div className="flex items-center gap-4">
          <h2 className="font-display text-3xl font-bold tracking-tight text-text">Tests</h2>
          <span className="h-px flex-1 bg-(--lp-line)" aria-hidden="true" />
        </div>
        {tests.length === 0 ? (
          <p className="mt-4 text-sm text-text/60">No tests have been published in this series yet.</p>
        ) : (
          <ol className="mt-5 space-y-3">
            {tests.map((t, i) => (
              <TestRow key={t.id} test={t} index={i} enrolled={enrolled && !publicMode} onOpen={openTest}
                onReport={(attemptId) => navigate(`/student/report/${attemptId}`)} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
