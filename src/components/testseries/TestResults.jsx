// TestResults — results screen for one finished attempt. Pure presentation
// of the `result` produced by scoreAttempt() (+ the raw `answers`); it never
// writes anything. `mode` only changes how SUBJECTIVE answers are shown:
//   live    -> "Awaiting grading" (the educator grades them later)
//   preview -> the educator sees the model answer + rubric criteria instead
// Props: series, test, result, mode, banner?, onBack?, onRetry?, onExit?,
//   exitLabel?, footerNote?
import ProgressRing from "../ui/ProgressRing";
import StatusBadge from "../ui/StatusBadge";
import Button from "../ui/Button";
import QuestionImage from "./QuestionImage";
import { CheckIcon, XIcon, ClockIcon } from "../ui/icons";
import { isSubjective, questionTypeMeta } from "../../portals/teacher/data/testSeriesData";
import { describeAnswer, describeCorrect, formatDuration, stripTags } from "./scoreAttempt";

const STATUS_META = {
  correct: { label: "Correct", tone: "success" },
  wrong: { label: "Wrong", tone: "danger" },
  unattempted: { label: "Not attempted", tone: "neutral" },
  pending: { label: "Awaiting grading", tone: "warning" },
};
const fmt = (n) => (Math.round(n * 100) / 100).toString();

function Stat({ label, value, tone }) {
  const tones = {
    sage: "bg-pastel-sage text-pastel-sage-ink",
    pink: "bg-pastel-pink text-pastel-pink-ink",
    lavender: "bg-pastel-lavender text-pastel-lavender-ink",
    orange: "bg-pastel-orange text-pastel-orange-ink",
    blue: "bg-pastel-blue text-pastel-blue-ink",
  };
  return (
    <div className={`rounded-2xl px-3 py-3 text-center ${tones[tone]}`}>
      <dd className="text-xl font-bold tabular-nums">{value}</dd>
      <dt className="text-[11px] font-semibold">{label}</dt>
    </div>
  );
}

function ReviewItem({ q, row, answers, mode }) {
  const meta = STATUS_META[row.status];
  const subj = isSubjective(q.type);
  const mine = describeAnswer(q, answers?.[q.id]);
  const correct = describeCorrect(q);
  const rubric = Array.isArray(q.rubric) ? q.rubric : [];
  return (
    <li className="rounded-2xl bg-bg p-4">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-bold text-text">Q{row.index + 1}</span>
        <span className="rounded-full bg-primary/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-primary">{questionTypeMeta(q.type).short}</span>
        <StatusBadge status={meta.tone} size="sm">
          {meta.label}
        </StatusBadge>
        <span className="ml-auto text-xs font-semibold text-muted">
          {subj ? `${row.maxMarks} marks` : `${row.marks > 0 ? "+" : ""}${fmt(row.marks)} / ${row.maxMarks}`}
        </span>
      </div>
      <div className="mt-2 text-sm text-text [&_p]:mb-1" dangerouslySetInnerHTML={{ __html: stripTags(q.text) ? q.text : "<p><em>Question text not written yet.</em></p>" }} />
      {q.image && <QuestionImage image={q.image} className="mt-2" />}

      <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
        <div className="min-w-0 rounded-xl bg-surface px-3 py-2">
          <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Your answer</dt>
          <dd className={`mt-0.5 whitespace-pre-wrap break-words ${mine ? "text-text" : "italic text-muted"}`}>{mine || "No answer"}</dd>
        </div>
        {!subj && (
          <div className="min-w-0 rounded-xl bg-surface px-3 py-2">
            <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted">Correct answer</dt>
            <dd className="mt-0.5 break-words text-text">{correct || <span className="italic text-muted">Not set</span>}</dd>
          </div>
        )}
      </dl>

      {subj && mode !== "preview" && <p className="mt-3 rounded-xl bg-pastel-orange px-3 py-2 text-xs font-semibold text-pastel-orange-ink">Awaiting grading. Your educator will review this answer and add feedback.</p>}
      {subj && mode === "preview" && (
        <div className="mt-3 rounded-xl bg-surface px-3 py-3 text-sm">
          <p className="eyebrow mb-1">Educator view (preview only)</p>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">Model answer</p>
          <div className="mt-0.5 text-text [&_p]:mb-1" dangerouslySetInnerHTML={{ __html: stripTags(q.modelAnswer) ? q.modelAnswer : "<p><em>No model answer written yet.</em></p>" }} />
          <p className="mt-3 text-[11px] font-semibold uppercase tracking-wide text-muted">Rubric</p>
          {rubric.length === 0 ? (
            <p className="mt-0.5 text-xs italic text-muted">No rubric criteria set.</p>
          ) : (
            <ul className="mt-1 divide-y divide-line">
              {rubric.map((r) => (
                <li key={r.id || r.label} className="flex items-start justify-between gap-3 py-1.5 text-xs">
                  <span className="text-text">{r.label || "Untitled criterion"}</span>
                  <span className="shrink-0 font-bold text-muted">{r.points} pts</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {stripTags(q.explanation) && (
        <div className="mt-3 rounded-xl bg-pastel-blue px-3 py-2 text-xs text-pastel-blue-ink">
          <span className="font-bold">Explanation: </span>
          <span dangerouslySetInnerHTML={{ __html: q.explanation }} />
        </div>
      )}
    </li>
  );
}

export default function TestResults({ series, test, result, answers, mode = "live", banner, onBack, onRetry, onExit, exitLabel = "Done", footerNote }) {
  const ans = answers || result.answers || {};
  const { counts } = result;
  const pct = result.percentage ?? 0;
  const byId = new Map(test.questions.map((q) => [q.id, q]));
  const showNeg = result.negativeScheme?.enabled;

  return (
    <div className="flex flex-col gap-5 pb-12">
      {banner}

      <section className="rounded-3xl bg-surface p-5 shadow-card sm:p-7">
        <p className="eyebrow">{series.title || "Test series"}</p>
        <h1 className="mt-1 text-xl font-bold text-text sm:text-2xl">{test.title || "Untitled test"} — Results</h1>
        {result.autoSubmitted && <p className="mt-1 text-xs font-semibold text-pastel-orange-ink">Time ran out, so this attempt was submitted automatically.</p>}

        <div className="mt-5 flex flex-col items-center gap-6 sm:flex-row sm:items-center">
          <ProgressRing value={pct} size={128} stroke={11} label={`Score ${Math.round(pct)} percent`} />
          <div className="flex min-w-0 flex-1 flex-col items-center gap-2 text-center sm:items-start sm:text-left">
            <p className="text-3xl font-bold tabular-nums text-text">
              {fmt(result.score)} <span className="text-base font-semibold text-muted">/ {fmt(result.objectiveMax)} auto-graded marks</span>
            </p>
            {result.passed === null ? (
              <StatusBadge status="neutral" showIcon={false}>
                No auto-graded questions
              </StatusBadge>
            ) : (
              <StatusBadge status={result.passed ? "success" : "danger"} icon={result.passed ? CheckIcon : XIcon}>
                {result.passed ? "Passed" : "Not passed"} · pass mark {result.passingPct}%{result.provisional ? " (provisional)" : ""}
              </StatusBadge>
            )}
            {result.provisional && result.subjectiveMax > 0 && (
              <p className="text-xs text-muted">
                {fmt(result.subjectiveMax)} marks from written answers are not included{mode === "preview" ? " (preview attempts aren't graded)." : " until your educator grades them."}
              </p>
            )}
          </div>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <Stat label="Correct" value={counts.correct} tone="sage" />
          <Stat label="Wrong" value={counts.wrong} tone="pink" />
          <Stat label="Not attempted" value={counts.unattempted} tone="lavender" />
          <Stat label={`Pending (written)`} value={counts.pending} tone="orange" />
        </dl>
        <p className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-muted">
          <span className="inline-flex items-center gap-1.5">
            <ClockIcon className="h-3.5 w-3.5" />
            Time taken {formatDuration(result.timeTakenSec)}
          </span>
          <span>
            Negative marks: {showNeg ? `−${fmt(result.negativeMarks)}` : "none"}
            {showNeg && !result.negativeScheme.parsed ? " (scheme text couldn't be read, so none were applied)" : ""}
          </span>
        </p>
        {footerNote && <p className="mt-4 rounded-2xl bg-pastel-orange px-4 py-3 text-sm font-semibold text-pastel-orange-ink">{footerNote}</p>}

        <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          {onBack && (
            <Button variant="secondary" fullWidth={false} className="min-h-11 px-6" onClick={onBack}>
              Back to tests
            </Button>
          )}
          {onRetry && (
            <Button variant="secondary" fullWidth={false} className="min-h-11 px-6" onClick={onRetry}>
              Retake
            </Button>
          )}
          {onExit && (
            <Button fullWidth={false} className="min-h-11 px-6 sm:ml-auto" onClick={onExit}>
              {exitLabel}
            </Button>
          )}
        </div>
      </section>

      <section className="rounded-3xl bg-surface p-5 shadow-soft sm:p-7">
        <h2 className="text-base font-bold text-text">Topic-wise accuracy</h2>
        {result.topics.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No auto-graded questions to break down by topic.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3">
            {result.topics.map((t) => (
              <li key={t.topic}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="min-w-0 truncate font-semibold text-text">{t.topic}</span>
                  <span className="shrink-0 text-xs text-muted">
                    {t.correct}/{t.total} correct · {t.accuracy}%
                  </span>
                </div>
                <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-primary/[0.09]" role="img" aria-label={`${t.topic} accuracy ${t.accuracy} percent`}>
                  <div className="h-full rounded-full" style={{ width: `${t.accuracy}%`, background: t.accuracy >= 75 ? "var(--color-pastel-sage-ink)" : t.accuracy >= 40 ? "var(--color-chart-5)" : "var(--color-pastel-pink-ink)" }} />
                </div>
              </li>
            ))}
          </ul>
        )}
        {Object.keys(result.difficulty).length > 0 && (
          <div className="mt-5 flex flex-wrap gap-2">
            {Object.entries(result.difficulty).map(([d, r]) => (
              <span key={d} className="rounded-full bg-bg px-3 py-1 text-xs font-semibold text-muted">
                {d}: {r.correct}/{r.total} correct
              </span>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-3xl bg-surface p-5 shadow-soft sm:p-7">
        <h2 className="text-base font-bold text-text">Question review</h2>
        <ul className="mt-3 flex flex-col gap-3">
          {result.perQuestion.map((row) => {
            const q = byId.get(row.id);
            return q ? <ReviewItem key={row.id} q={q} row={row} answers={ans} mode={mode} /> : null;
          })}
        </ul>
      </section>
    </div>
  );
}
