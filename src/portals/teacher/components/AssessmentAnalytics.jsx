// AssessmentAnalytics — Analytics hub Part 4: quiz performance, most-missed
// questions, assignment grading turnaround, and rubric context where it
// genuinely exists. All reused from real course/submission data
// (courseAnalytics().quizPerformance, submission submittedAt/gradedAt,
// lesson.rubric) — see data/analyticsData.js for exactly what's derived
// vs. approximated.
import { useMemo } from "react";
import StatCard from "../../../components/ui/StatCard";
import StatusBadge from "../../../components/ui/StatusBadge";
import { QuizIcon, CheckIcon, ClockIcon, AssignmentIcon, InfoIcon } from "../../../components/ui/icons";
import { quizAnalytics, gradingTurnaround, rubricCriteriaOnRecord } from "../data/analyticsData";

function Panel({ title, subtitle, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-white p-5 sm:p-6 ${className} shadow-soft`}>
      <h2 className="text-base font-bold text-text">{title}</h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function MostMissedList({ rows }) {
  if (!rows.length) return <p className="py-8 text-center text-sm text-muted">No quizzes recorded yet</p>;
  return (
    <div className="flex flex-col divide-y divide-text/[0.06]">
      {rows.slice(0, 6).map((r, i) => (
        <div key={`${r.courseId}-${i}`} className="flex items-start justify-between gap-3 py-3">
          <div className="min-w-0">
            <p className="text-sm text-text">{r.question}</p>
            <button
              type="button"
              className="mt-1 inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-0.5 text-[11px] font-semibold text-muted"
            >
              {r.courseTitle}
            </button>
          </div>
          <span className={`shrink-0 text-sm font-bold ${r.missPct >= 40 ? "text-danger" : r.missPct >= 20 ? "text-warning" : "text-muted"}`}>
            {r.missPct}% miss
          </span>
        </div>
      ))}
    </div>
  );
}

function TurnaroundDistribution({ distribution }) {
  const max = Math.max(...distribution.map((d) => d.count), 1);
  return (
    <div className="flex items-end gap-3">
      {distribution.map((d) => (
        <div key={d.label} className="flex flex-1 flex-col items-center gap-1.5">
          <span className="text-xs font-semibold text-text">{d.count}</span>
          <div className="flex h-24 w-full items-end rounded-lg bg-bg">
            <div
              className="w-full rounded-lg bg-primary transition-all duration-500"
              style={{ height: `${Math.max(4, (d.count / max) * 100)}%` }}
            />
          </div>
          <span className="text-center text-[10px] text-muted">{d.label}</span>
        </div>
      ))}
    </div>
  );
}

export default function AssessmentAnalytics({ courses }) {
  const quiz = useMemo(() => quizAnalytics(courses), [courses]);
  const turnaround = useMemo(() => gradingTurnaround(courses), [courses]);
  const rubrics = useMemo(() => rubricCriteriaOnRecord(courses), [courses]);

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard icon={QuizIcon} tone="lavender" label="Avg. quiz score (proxy)" value={quiz.totalQuestions ? `${quiz.avgScore}%` : "—"} ring={quiz.totalQuestions ? quiz.avgScore : undefined} />
        <StatCard icon={CheckIcon} tone="sage" label="Pass rate (proxy)" value={quiz.totalQuestions ? `${quiz.passRate}%` : "—"} ring={quiz.totalQuestions ? quiz.passRate : undefined} />
        <StatCard icon={ClockIcon} tone="orange" label="Avg. grading turnaround" value={turnaround.sampleSize ? `${turnaround.avgTurnaround}d` : "—"} />
      </div>

      <Panel title="Most-missed quiz questions" subtitle="Ranked by miss rate, across every course's tracked questions">
        {quiz.totalQuestions === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <QuizIcon className="h-6 w-6 text-text/20" />
            <p className="mt-2 text-sm text-muted">No quiz question data recorded for this portfolio yet</p>
          </div>
        ) : (
          <>
            <MostMissedList rows={quiz.mostMissed} />
            <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
              <InfoIcon className="mt-0.5 h-3 w-3 shrink-0" />
              Average score and pass rate above are a proxy read on the same per-question correctness data — the mock
              data doesn't yet carry a per-student quiz score record beyond a single sample submission.
            </p>
          </>
        )}
      </Panel>

      <Panel title="Assignment grading turnaround" subtitle="How long graded assignments sat before you graded them">
        {turnaround.sampleSize === 0 ? (
          <p className="py-8 text-center text-sm text-muted">No graded assignments yet</p>
        ) : (
          <>
            <TurnaroundDistribution distribution={turnaround.distribution} />
            {turnaround.trend.length > 1 && (
              <div className="mt-5 flex flex-col gap-1.5">
                <span className="text-xs font-semibold uppercase tracking-wide text-muted">Trend, avg. days by month graded</span>
                <div className="flex items-center gap-3 text-xs text-muted">
                  {turnaround.trend.map((t) => (
                    <span key={t.label} className="rounded-full bg-bg px-2.5 py-1">{t.label}: {t.avgDays}d</span>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </Panel>

      <Panel title="Rubric insight" subtitle="Where rubric criteria exist in your course data">
        {rubrics.length === 0 ? (
          <div className="flex items-start gap-2 rounded-xl bg-bg px-4 py-3 text-sm text-muted">
            <AssignmentIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
            Not applicable yet — no assignment in your courses has per-criterion student scores recorded, only a
            handful carry rubric criteria at all. A deeper "which criterion students struggle with" breakdown needs
            that data first.
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {rubrics.map((r) => (
              <div key={`${r.courseId}-${r.lessonTitle}`} className="rounded-xl bg-bg p-4">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-text">{r.lessonTitle}</p>
                  <StatusBadge status="neutral" showIcon={false} size="sm">{r.courseTitle}</StatusBadge>
                </div>
                <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
                  {r.criteria.map((c) => (
                    <li key={c.id} className="flex items-center justify-between">
                      <span>{c.label}</span>
                      <span className="font-semibold text-muted">{c.points} pts</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}
