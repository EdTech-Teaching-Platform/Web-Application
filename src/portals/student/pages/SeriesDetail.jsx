// Test series detail. Student mode: student_get_series (enrolment + per-test
// status) and student_enroll. Public mode (/test-series/:id): public_get_series,
// with every action going through login first.
import { useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatCard from "../../../components/ui/StatCard";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ErrorState, LoadingState, PAGE, PageHeader } from "../components/PageState";
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

function TestRow({ test, enrolled, onOpen, onReport }) {
  const state = testState(test, enrolled);
  const latest = ATTEMPT_STATUS[test.latest_status];
  const actionable = ["resume", "start"].includes(state.kind);
  return (
    <li className="flex flex-col gap-3 rounded-2xl bg-white p-4 ring-1 ring-text/10 sm:flex-row sm:items-center">
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-text">{test.title}</p>
        <p className="mt-1 text-xs text-text/60">
          {test.questions_count} questions · {test.total_marks} marks · {formatMinutes(test.time_limit_mins)} · pass {formatPercent(test.passing_percentage)}
        </p>
        {enrolled && (
          <p className="mt-1 text-xs text-text/60">
            Attempts {test.attempts_used}/{test.attempts_allowed}
            {test.best_percentage !== null && test.best_percentage !== undefined && <> · best {formatPercent(test.best_percentage, 1)}</>}
          </p>
        )}
      </div>
      <div className="flex shrink-0 flex-wrap items-center gap-2">
        {test.passed && <StatusBadge status="success">Passed</StatusBadge>}
        {!test.passed && latest && test.latest_status !== "in_progress" && <StatusBadge status={latest.tone}>{latest.label}</StatusBadge>}
        {enrolled && test.latest_attempt_id && test.latest_status !== "in_progress" && (
          <Button variant="secondary" fullWidth={false} onClick={() => onReport(test.latest_attempt_id)}>Report</Button>
        )}
        <Button fullWidth={false} disabled={!actionable && state.kind !== "locked"} onClick={() => onOpen(test, state)}>
          {state.label}
        </Button>
      </div>
    </li>
  );
}

export default function SeriesDetail({ publicMode = false }) {
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

  if (loading) return <div className={PAGE}><LoadingState label="Loading test series" /></div>;
  if (error) {
    return (
      <div className={PAGE}>
        <ErrorState
          error={isNotFound(error) ? { message: "This test series isn't available." } : error}
          onRetry={isNotFound(error) ? undefined : reload}
          title={isNotFound(error) ? "Test series not found" : "Couldn't load this test series"}
        />
        <Link to={publicMode ? "/test-series" : "/student/test-series"} className="text-sm font-medium text-primary hover:underline">
          Back to all test series
        </Link>
      </div>
    );
  }

  const enrolled = Boolean(series.is_enrolled);
  const tests = series.tests ?? [];

  return (
    <div className={PAGE}>
      <Link to={publicMode ? "/test-series" : "/student/test-series"} className="text-sm font-medium text-primary hover:underline">
        ← All test series
      </Link>
      <PageHeader
        eyebrow={[series.exam, series.subject, series.level].filter(Boolean).join(" · ") || "Test series"}
        title={series.title}
        subtitle={series.description}
        actions={
          enrolled ? (
            <StatusBadge status="success">Enrolled</StatusBadge>
          ) : (
            <Button fullWidth={false} onClick={enroll} disabled={enrolling}>
              {enrolling ? "Enrolling…" : series.is_free ? "Enrol free" : `Enrol · ${priceLabel(series)}`}
            </Button>
          )
        }
      />

      {notice && <p role="status" className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-text">{notice}</p>}

      <section className="grid grid-cols-2 gap-4 sm:grid-cols-4" aria-label="Series facts">
        <StatCard value={series.tests_count ?? tests.length} label="Tests" />
        <StatCard value={series.questions_count ?? 0} label="Questions" />
        <StatCard value={formatMinutes(series.total_duration_mins)} label="Total time" />
        <StatCard value={priceLabel(series)} label="Price" />
      </section>

      {(series.available_until || series.enrollment?.expires_at) && (
        <p className="text-sm text-text/60">
          {series.available_until && <>Available until {formatDate(series.available_until)}. </>}
          {series.enrollment?.expires_at && <>Your access ends {formatDate(series.enrollment.expires_at)}.</>}
        </p>
      )}

      {series.instructions && (
        <section className="rounded-2xl bg-white p-5 ring-1 ring-text/10">
          <h2 className="font-display text-lg font-semibold text-text">Instructions</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-text/70">{series.instructions}</p>
        </section>
      )}

      <section>
        <h2 className="font-display text-xl font-semibold text-text">Tests</h2>
        {tests.length === 0 ? (
          <p className="mt-3 text-sm text-text/60">No tests have been published in this series yet.</p>
        ) : (
          <ol className="mt-4 space-y-3">
            {tests.map((t) => (
              <TestRow key={t.id} test={t} enrolled={enrolled && !publicMode} onOpen={openTest}
                onReport={(attemptId) => navigate(`/student/report/${attemptId}`)} />
            ))}
          </ol>
        )}
      </section>
    </div>
  );
}
