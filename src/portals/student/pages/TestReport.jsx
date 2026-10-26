// Attempt report (student_get_report): the stored snapshot written at submit.
// Charts are plain CSS / SVG (ProgressRing, DonutChart); no chart library.
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import Chip from "../../../components/ui/Chip";
import DonutChart from "../../../components/ui/DonutChart";
import StatCard from "../../../components/ui/StatCard";
import StatusBadge from "../../../components/ui/StatusBadge";
import { AlertTriangleIcon, AwardIcon, CheckIcon, ClockIcon, StarIcon, TargetIcon, UsersIcon, XIcon } from "../../../components/ui/icons";
import { ErrorState, LoadingState, PAGE } from "../components/PageState";
import PageHero, { HERO_BTN_LIGHT, HERO_BTN_YELLOW } from "../components/PageHero";
import { useStudentData } from "../hooks/useStudentData";
import { attemptApi } from "../services/attemptApi";
import { isRuleError } from "../services/studentRpc";
import { formatDate, formatMinutes, formatPercent, formatScore, formatSeconds } from "../utils/format";
import { FeedbackForm } from "../components/FeedbackForm";

const STATUS = {
  correct: { label: "Correct", tone: "success" },
  incorrect: { label: "Incorrect", tone: "danger" },
  skipped: { label: "Skipped", tone: "neutral" },
  pending: { label: "Pending review", tone: "warning" },
};

const CARD = "rounded-3xl bg-white p-6 ring-1 ring-(--lp-line)";

function CardTitle({ icon: Icon, tone = "bg-(--lp-blue-soft) text-primary", children, as: Tag = "h2" }) {
  return (
    <div className="flex items-center gap-3">
      {Icon && (
        <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`} aria-hidden="true">
          <Icon className="h-[18px] w-[18px]" />
        </span>
      )}
      <Tag className="font-display text-lg font-bold tracking-tight text-text">{children}</Tag>
    </div>
  );
}

function Bar({ label, value, max = 100, suffix = "%", tone = "bg-primary" }) {
  const width = max > 0 ? Math.min(100, Math.max(0, (Number(value) / max) * 100)) : 0;
  return (
    <div>
      <div className="flex justify-between gap-3 text-xs text-text/70">
        <span className="truncate">{label}</span>
        <span className="font-bold text-text">{Math.round(Number(value) * 10) / 10}{suffix}</span>
      </div>
      <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-(--lp-grey)" role="img" aria-label={`${label}: ${Math.round(Number(value))}${suffix}`}>
        <div className={`h-full rounded-full transition-[width] duration-500 ease-out ${tone}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

// Score ring with explicit colours (the shared ProgressRing references colour
// tokens that aren't defined in this theme, so its arc was invisible here).
function ScoreRing({ value, label, passed, size = 148, stroke = 14 }) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  return (
    <div role="img" aria-label={label} className="relative inline-flex shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} stroke="var(--lp-grey)" />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth={stroke} strokeLinecap="round"
          stroke={passed ? "var(--color-success)" : "var(--lp-blue)"}
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct / 100)}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-display text-3xl font-bold tracking-tight text-text">
        {Math.round(pct)}%
      </span>
    </div>
  );
}

function Breakdown({ title, buckets }) {
  if (!buckets?.length) return null;
  return (
    <div className={CARD}>
      <CardTitle as="h3">{title}</CardTitle>
      <div className="mt-5 space-y-4">
        {buckets.map((b) => (
          <div key={b.name}>
            <Bar label={`${b.name} (${b.correct}/${b.graded || 0} graded${b.pending ? `, ${b.pending} pending` : ""})`} value={b.accuracy} tone="bg-(--lp-blue)" />
            {b.skipped > 0 && <p className="mt-1 text-[11px] text-text/50">{b.skipped} skipped</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

const Q_TONE = {
  correct: "bg-success/15 text-success",
  incorrect: "bg-danger/15 text-danger",
  skipped: "bg-(--lp-grey) text-(--lp-muted)",
  pending: "bg-warning/15 text-warning",
};

export function QuestionReview({ question, hidden }) {
  const s = STATUS[question.status] ?? STATUS.skipped;
  return (
    <li className={`${CARD} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`grid h-9 min-w-9 place-items-center rounded-xl px-2 text-sm font-bold ${Q_TONE[question.status] ?? Q_TONE.skipped}`}>Q{question.position}</span>
        <StatusBadge status={s.tone}>{s.label}</StatusBadge>
        <span className="ml-auto rounded-full bg-(--lp-grey) px-3 py-1 text-xs font-semibold text-text/70">
          {question.status === "pending" ? `${question.points} marks, awaiting review` : `${question.points_earned ?? 0} / ${question.points}`}
        </span>
      </div>
      <p className="mt-4 whitespace-pre-line text-[15px] leading-relaxed text-text">{question.text}</p>
      {question.options?.length > 0 ? (
        <ul className="mt-4 space-y-2">
          {question.options.map((o) => (
            <li key={o.id}
              className={`flex items-center gap-3 rounded-2xl px-4 py-3 text-sm ring-1 ${o.is_correct ? "bg-success/10 ring-success/40" : o.selected ? "bg-danger/10 ring-danger/40" : "bg-white ring-(--lp-line)"}`}>
              <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-full ${o.is_correct ? "bg-success text-white" : o.selected ? "bg-danger text-white" : "ring-1 ring-(--lp-line)"}`} aria-hidden="true">
                {o.is_correct ? <CheckIcon className="h-3 w-3" /> : o.selected ? <XIcon className="h-3 w-3" /> : null}
              </span>
              <span className="min-w-0">
                {o.text}
                {o.selected && <span className="ml-2 text-xs font-semibold text-text/70">(your answer)</span>}
                {o.is_correct && <span className="ml-2 text-xs font-semibold text-success">(correct)</span>}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <dl className="mt-4 space-y-2 rounded-2xl bg-(--lp-grey) px-4 py-3 text-sm">
          <div><dt className="inline font-medium text-text/70">Your answer: </dt><dd className="inline text-text">{question.student_answer || "Not answered"}</dd></div>
          {question.correct_answer && (
            <div><dt className="inline font-medium text-text/70">{question.status === "pending" ? "Model answer: " : "Accepted answer: "}</dt><dd className="inline text-text">{question.correct_answer}</dd></div>
          )}
        </dl>
      )}
      {question.explanation && <p className="mt-4 rounded-2xl bg-(--lp-blue-tint) px-4 py-3 text-sm leading-relaxed text-text/80"><strong>Explanation:</strong> {question.explanation}</p>}
      {hidden && !question.options?.length && <p className="mt-3 text-xs text-text/50">Answers are hidden for this test.</p>}
      <p className="mt-3 text-[11px] font-medium uppercase tracking-[0.1em] text-text/40">{[question.section, question.topic, question.difficulty].filter(Boolean).join(" · ")}</p>
    </li>
  );
}

function Notice({ children }) {
  return (
    <p role="status" className="flex items-start gap-3 rounded-2xl bg-warning/10 px-5 py-4 text-sm text-text ring-1 ring-warning/30">
      <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0 text-warning" aria-hidden="true" />
      <span>{children}</span>
    </p>
  );
}

const TILE = "rounded-3xl bg-(--lp-grey) p-4";
const STAT_VALUE = "font-display text-2xl font-bold leading-none tracking-tight text-text sm:text-3xl";
const STAT_LABEL = "text-[11px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)";

function Tile({ icon: Icon, tone, children }) {
  return (
    <div className={TILE}>
      <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`} aria-hidden="true"><Icon className="h-[18px] w-[18px]" /></span>
      <div className="mt-4">{children}</div>
    </div>
  );
}

export default function TestReport() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
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
    <div className={`${PAGE} space-y-8 pb-10`}>
      <PageHero
        compact
        showEyebrow
        theme="blue"
        art="chart"
        eyebrow={report.series_title || "Report"}
        title={report.test_title}
        subtitle={`Attempt ${s.attempt_number} · submitted ${formatDate(s.submitted_at, true)}`}
      >
        {report.series_id && (
          <button type="button" onClick={() => navigate(`/student/test-series/${report.series_id}`)} className={HERO_BTN_LIGHT}>
            Back to series
          </button>
        )}
        {canRetake && (
          <button type="button" onClick={() => navigate(`/student/test/${report.test_id}`)} className={HERO_BTN_YELLOW}>
            Retake
          </button>
        )}
      </PageHero>

      {s.auto_submitted && (
        <Notice>
          {s.auto_submit_reason === "proctor_limit"
            ? `This test was submitted automatically after ${s.violations_count} violations (limit ${s.violation_limit}).`
            : "This test was submitted automatically when time ran out."}
        </Notice>
      )}
      {s.pending_count > 0 && (
        <Notice>
          {s.pending_count} written {s.pending_count === 1 ? "answer is" : "answers are"} pending review ({s.pending_marks} marks).
          Your score below leaves them out, so it may change once they're graded.
        </Notice>
      )}

      <section className={`${CARD} grid gap-8 p-6 sm:p-8 md:grid-cols-[auto_1fr] md:items-center`}>
        <div className="flex flex-col items-center gap-3">
          <ScoreRing value={s.percentage} passed={s.passed} label={`Score ${formatPercent(s.percentage, 1)}`} />
          <StatusBadge status={s.passed ? "success" : "danger"}>
            {s.passed ? "Passed" : "Not passed"}{s.provisional ? " (provisional)" : ""}
          </StatusBadge>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Tile icon={AwardIcon} tone="bg-(--lp-blue-soft) text-primary">
            <StatCard value={formatScore(s.score, s.max_score)} label="Score" valueClassName={STAT_VALUE} labelClassName={STAT_LABEL} className="gap-2" />
          </Tile>
          <Tile icon={StarIcon} tone="bg-(--lp-yellow-soft) text-(--lp-ink)">
            <StatCard value={`#${s.rank}`} label={`Rank of ${s.total_attempts}`} valueClassName={STAT_VALUE} labelClassName={STAT_LABEL} className="gap-2" />
          </Tile>
          <Tile icon={UsersIcon} tone="bg-rotation-3/25 text-primary">
            <StatCard value={formatPercent(s.percentile)} label="Percentile" valueClassName={STAT_VALUE} labelClassName={STAT_LABEL} className="gap-2" />
          </Tile>
          <Tile icon={TargetIcon} tone="bg-(--lp-ink) text-(--lp-yellow)">
            <StatCard value={formatPercent(s.passing_percentage)} label="Pass mark" valueClassName={STAT_VALUE} labelClassName={STAT_LABEL} className="gap-2" />
          </Tile>
        </div>
      </section>

      <section className={`${CARD} flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between`} aria-label="Feedback">
        <div>
          <h2 className="font-display text-lg font-bold tracking-tight text-text">Something to tell us about this test?</h2>
          <p className="text-sm text-text/60">Rate it, ask a question, or report a wrong answer or a problem.</p>
        </div>
        <button type="button" onClick={() => setFeedbackOpen(true)} className={HERO_BTN_YELLOW}>
          Give feedback or report an issue
        </button>
      </section>
      <FeedbackForm open={feedbackOpen} onClose={() => setFeedbackOpen(false)} attemptId={report.attempt_id ?? attemptId} questions={questions} />

      <section className="grid gap-6 lg:grid-cols-3">
        <div className={CARD}>
          <CardTitle icon={CheckIcon} tone="bg-success/15 text-success">Answers</CardTitle>
          <DonutChart
            className="mt-4"
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
        <div className={CARD}>
          <CardTitle icon={ClockIcon} tone="bg-(--lp-yellow-soft) text-(--lp-ink)">Time</CardTitle>
          <p className="mt-5 font-display text-4xl font-bold tracking-tight text-text">{formatSeconds(s.time_taken_secs)}</p>
          <p className="text-sm text-(--lp-muted)">of {formatMinutes(s.time_limit_mins)}</p>
          {s.time_limit_mins > 0 && (
            <div className="mt-5">
              <Bar label="Time used" value={(s.time_taken_secs / (s.time_limit_mins * 60)) * 100} tone="bg-(--lp-blue)" />
            </div>
          )}
          {questions.length > 0 && (
            <p className="mt-4 rounded-2xl bg-(--lp-grey) px-4 py-3 text-xs text-text/70">About {formatSeconds(s.time_taken_secs / questions.length)} per question.</p>
          )}
        </div>
        <div className={CARD}>
          <CardTitle icon={UsersIcon} tone="bg-(--lp-blue-soft) text-primary">Compared with others</CardTitle>
          <div className="mt-5 space-y-4">
            <Bar label="You" value={c.your_percentage} tone="bg-(--lp-blue)" />
            <Bar label="Average" value={c.average_percentage} tone="bg-text/40" />
            <Bar label="Topper" value={c.topper_percentage} tone="bg-success" />
          </div>
          <p className="mt-4 rounded-2xl bg-(--lp-grey) px-4 py-3 text-xs text-text/70">
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
          <div className="rounded-3xl bg-success/10 p-6 ring-1 ring-success/20">
            <CardTitle icon={CheckIcon} tone="bg-success text-white">Strengths</CardTitle>
            {report.strengths?.length ? (
              <ul className="mt-4 space-y-2 text-sm font-medium text-text">{report.strengths.map((t) => <li key={t.topic} className="rounded-2xl bg-white/70 px-4 py-2.5">{t.topic}: {formatPercent(t.accuracy)}</li>)}</ul>
            ) : <p className="mt-4 text-sm text-text/60">Keep practising to build a strong topic.</p>}
          </div>
          <div className="rounded-3xl bg-danger/10 p-6 ring-1 ring-danger/20">
            <CardTitle icon={TargetIcon} tone="bg-danger text-white">Work on</CardTitle>
            {report.weaknesses?.length ? (
              <ul className="mt-4 space-y-2 text-sm font-medium text-text">{report.weaknesses.map((t) => <li key={t.topic} className="rounded-2xl bg-white/70 px-4 py-2.5">{t.topic}: {formatPercent(t.accuracy)}</li>)}</ul>
            ) : <p className="mt-4 text-sm text-text/60">No weak topics in this attempt.</p>}
          </div>
        </section>
      )}

      <section className="space-y-5">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="mr-auto font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">Question review</h2>
          <Chip active={filter === "all"} onClick={() => setFilter("all")}>All ({questions.length})</Chip>
          {Object.entries(counts).filter(([, n]) => n > 0).map(([k, n]) => (
            <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{STATUS[k].label} ({n})</Chip>
          ))}
        </div>
        {s.answers_hidden && <p className="text-sm text-text/60">Correct answers and explanations are hidden for this test.</p>}
        <ol className="space-y-4">
          {shown.map((q) => <QuestionReview key={q.question_id} question={q} hidden={s.answers_hidden} />)}
        </ol>
      </section>
    </div>
  );
}
