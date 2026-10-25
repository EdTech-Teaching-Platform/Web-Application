// Attempt report (student_get_report): the stored snapshot written at submit.
// Charts are plain CSS / SVG (ProgressRing, DonutChart); no chart library.
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import DonutChart from "../../../components/ui/DonutChart";
import ProgressRing from "../../../components/ui/ProgressRing";
import StatCard from "../../../components/ui/StatCard";
import StatusBadge from "../../../components/ui/StatusBadge";
import { ErrorState, LoadingState, PAGE, PageHeader } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { attemptApi } from "../services/attemptApi";
import { isRuleError } from "../services/studentRpc";
import { formatDate, formatMinutes, formatPercent, formatScore, formatSeconds } from "../utils/format";

const STATUS = {
  correct: { label: "Correct", tone: "success" },
  incorrect: { label: "Incorrect", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
  pending: { label: "Pending review", tone: "warning" },
};

function Bar({ label, value, max = 100, suffix = "%", tone = "bg-primary" }) {
  const width = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between text-xs text-text/70">
        <span className="truncate">{label}</span>
        <span className="font-semibold text-text">{Math.round(Number(value) * 10) / 10}{suffix}</span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-text/10" role="img" aria-label={`${label}: ${Math.round(Number(value))}${suffix}`}>
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function Breakdown({ title, buckets }) {
  if (!buckets?.length) return null;
  return (
    <div className="rounded-2xl bg-white p-5 ring-1 ring-text/10">
      <h3 className="font-display text-base font-semibold text-text">{title}</h3>
      <div className="mt-4 space-y-3">
        {buckets.map((b) => (
          <div key={b.name}>
            <Bar label={`${b.name} (${b.correct}/${b.graded || 0} graded${b.pending ? `, ${b.pending} pending` : ""})`} value={b.accuracy} />
            {b.skipped > 0 && <p className="mt-0.5 text-[11px] text-text/50">{b.skipped} skipped</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

export function QuestionReview({ question, hidden }) {
  const s = STATUS[question.status] ?? STATUS.skipped;
  return (
    <li className="rounded-2xl bg-white p-5 ring-1 ring-text/10">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold text-text">Q{question.position}</span>
        <StatusBadge status={s.tone}>{s.label}</StatusBadge>
        <span className="ml-auto text-xs text-text/60">
          {question.status === "pending" ? `${question.points} marks, awaiting review` : `${question.points_earned ?? 0} / ${question.points}`}
        </span>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-text">{question.text}</p>
      {question.options?.length > 0 ? (
        <ul className="mt-3 space-y-1.5">
          {question.options.map((o) => (
            <li key={o.id}
              className={`rounded-xl px-3 py-2 text-sm ring-1 ${o.is_correct ? "bg-success/10 ring-success/40" : o.selected ? "bg-danger/10 ring-danger/40" : "ring-text/10"}`}>
              {o.text}
              {o.selected && <span className="ml-2 text-xs font-semibold text-text/70">(your answer)</span>}
              {o.is_correct && <span className="ml-2 text-xs font-semibold text-success">(correct)</span>}
            </li>
          ))}
        </ul>
      ) : (
        <dl className="mt-3 space-y-1 text-sm">
          <div><dt className="inline font-medium text-text/70">Your answer: </dt><dd className="inline text-text">{question.student_answer || "Not answered"}</dd></div>
          {question.correct_answer && (
            <div><dt className="inline font-medium text-text/70">{question.status === "pending" ? "Model answer: " : "Accepted answer: "}</dt><dd className="inline text-text">{question.correct_answer}</dd></div>
          )}
        </dl>
      )}
      {question.explanation && <p className="mt-3 rounded-xl bg-bg px-3 py-2 text-sm text-text/70"><strong>Explanation:</strong> {question.explanation}</p>}
      {hidden && !question.options?.length && <p className="mt-2 text-xs text-text/50">Answers are hidden for this test.</p>}
      <p className="mt-2 text-[11px] text-text/40">{[question.section, question.topic, question.difficulty].filter(Boolean).join(" · ")}</p>
    </li>
  );
}

export default function TestReport() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const { data: report, error, loading, reload } = useStudentData(() => attemptApi.report(attemptId), attemptId);
  const { data: intro } = useStudentData(
    () => (report?.test_id ? attemptApi.intro(report.test_id) : Promise.resolve(null)),
    report?.test_id ?? "none",
  );

  const questions = useMemo(() => report?.questions ?? [], [report]);
  const shown = useMemo(() => (filter === "all" ? questions : questions.filter((q) => q.status === filter)), [questions, filter]);

  if (loading) return <div className={PAGE}><LoadingState label="Loading your report" /></div>;
  if (error) {
    return (
      <div className={PAGE}>
        <ErrorState
          error={error}
          onRetry={isRuleError(error) ? undefined : reload}
          title={isRuleError(error) ? "This attempt is still open" : "Couldn't load the report"}
        />
        <Link to="/student/history" className="text-sm font-medium text-primary hover:underline">Back to history</Link>
      </div>
    );
  }

  const s = report.summary;
  const c = report.comparison;
  const b = report.breakdowns ?? {};
  const counts = { correct: s.correct_count, incorrect: s.incorrect_count, skipped: s.skipped_count, pending: s.pending_count };
  const canRetake = Boolean(intro?.can_start);

  return (
    <div className={PAGE}>
      <PageHeader
        eyebrow={report.series_title || "Report"}
        title={report.test_title}
        subtitle={`Attempt ${s.attempt_number} · submitted ${formatDate(s.submitted_at, true)}`}
        actions={
          <>
            {report.series_id && (
              <Button variant="secondary" fullWidth={false} onClick={() => navigate(`/student/test-series/${report.series_id}`)}>Back to series</Button>
            )}
            {canRetake && <Button fullWidth={false} onClick={() => navigate(`/student/test/${report.test_id}`)}>Retake</Button>}
          </>
        }
      />

      {s.auto_submitted && (
        <p role="status" className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-text">
          {s.auto_submit_reason === "proctor_limit"
            ? `This test was submitted automatically after ${s.violations_count} violations (limit ${s.violation_limit}).`
            : "This test was submitted automatically when time ran out."}
        </p>
      )}
      {s.pending_count > 0 && (
        <p role="status" className="rounded-xl bg-warning/10 px-4 py-3 text-sm text-text">
          {s.pending_count} written {s.pending_count === 1 ? "answer is" : "answers are"} pending review ({s.pending_marks} marks).
          Your score below leaves them out, so it may change once they're graded.
        </p>
      )}

      <section className="grid gap-6 rounded-3xl bg-white p-6 ring-1 ring-text/10 md:grid-cols-[auto_1fr] md:items-center">
        <div className="flex flex-col items-center gap-2">
          <ProgressRing value={s.percentage} size={132} stroke={12} label={`Score ${formatPercent(s.percentage, 1)}`} />
          <StatusBadge status={s.passed ? "success" : "danger"}>
            {s.passed ? "Passed" : "Not passed"}{s.provisional ? " (provisional)" : ""}
          </StatusBadge>
        </div>
        <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
          <StatCard value={formatScore(s.score, s.max_score)} label="Score" />
          <StatCard value={`#${s.rank}`} label={`Rank of ${s.total_attempts}`} />
          <StatCard value={formatPercent(s.percentile)} label="Percentile" />
          <StatCard value={formatPercent(s.passing_percentage)} label="Pass mark" />
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 ring-1 ring-text/10">
          <h2 className="font-display text-base font-semibold text-text">Answers</h2>
          <DonutChart
            className="mt-3"
            centerLabel={`${s.correct_count}/${questions.length}`}
            centerSub="correct"
            segments={[
              { label: "Correct", value: questions.length ? (s.correct_count / questions.length) * 100 : 0, colorClass: "stroke-success" },
              { label: "Incorrect", value: questions.length ? (s.incorrect_count / questions.length) * 100 : 0, colorClass: "stroke-danger" },
              { label: "Skipped", value: questions.length ? (s.skipped_count / questions.length) * 100 : 0, colorClass: "stroke-text/20" },
              { label: "Pending", value: questions.length ? (s.pending_count / questions.length) * 100 : 0, colorClass: "stroke-warning" },
            ]}
          />
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-text/10">
          <h2 className="font-display text-base font-semibold text-text">Time</h2>
          <p className="mt-3 font-display text-3xl font-bold text-text">{formatSeconds(s.time_taken_secs)}</p>
          <p className="text-sm text-text/60">of {formatMinutes(s.time_limit_mins)}</p>
          {s.time_limit_mins > 0 && (
            <div className="mt-4">
              <Bar label="Time used" value={(s.time_taken_secs / (s.time_limit_mins * 60)) * 100} />
            </div>
          )}
          {questions.length > 0 && (
            <p className="mt-3 text-xs text-text/60">About {formatSeconds(s.time_taken_secs / questions.length)} per question.</p>
          )}
        </div>
        <div className="rounded-2xl bg-white p-5 ring-1 ring-text/10">
          <h2 className="font-display text-base font-semibold text-text">Compared with others</h2>
          <div className="mt-4 space-y-3">
            <Bar label="You" value={c.your_percentage} />
            <Bar label="Average" value={c.average_percentage} tone="bg-text/40" />
            <Bar label="Topper" value={c.topper_percentage} tone="bg-success" />
          </div>
          <p className="mt-3 text-xs text-text/60">
            {c.difference_from_average >= 0 ? `${c.difference_from_average} points above` : `${Math.abs(c.difference_from_average)} points below`} the average,
            across {s.total_attempts} {s.total_attempts === 1 ? "attempt" : "attempts"}.
          </p>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <Breakdown title="By section" buckets={b.by_section} />
        <Breakdown title="By topic" buckets={b.by_topic} />
        <Breakdown title="By difficulty" buckets={b.by_difficulty} />
      </section>

      {(report.strengths?.length > 0 || report.weaknesses?.length > 0) && (
        <section className="grid gap-6 md:grid-cols-2">
          <div className="rounded-2xl bg-success/10 p-5">
            <h2 className="font-display text-base font-semibold text-text">Strengths</h2>
            {report.strengths?.length ? (
              <ul className="mt-2 space-y-1 text-sm text-text">{report.strengths.map((t) => <li key={t.topic}>{t.topic}: {formatPercent(t.accuracy)}</li>)}</ul>
            ) : <p className="mt-2 text-sm text-text/60">Keep practising to build a strong topic.</p>}
          </div>
          <div className="rounded-2xl bg-danger/10 p-5">
            <h2 className="font-display text-base font-semibold text-text">Work on</h2>
            {report.weaknesses?.length ? (
              <ul className="mt-2 space-y-1 text-sm text-text">{report.weaknesses.map((t) => <li key={t.topic}>{t.topic}: {formatPercent(t.accuracy)}</li>)}</ul>
            ) : <p className="mt-2 text-sm text-text/60">No weak topics in this attempt.</p>}
          </div>
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-xl font-semibold text-text">Question review</h2>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All ({questions.length})</Chip>
          {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{STATUS[k].label} ({n})</Chip>
          ))}
        </div>
        {s.answers_hidden && <p className="mt-2 text-sm text-text/60">Correct answers and explanations are hidden for this test.</p>}
        <ol className="mt-4 space-y-3">
          {shown.map((q) => <QuestionReview key={q.question_id} question={q} hidden={s.answers_hidden} />)}
        </ol>
      </section>
    </div>
  );
}
