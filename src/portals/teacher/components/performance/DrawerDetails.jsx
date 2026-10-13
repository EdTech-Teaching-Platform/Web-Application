import StatusBadge from "../../../../components/ui/StatusBadge";
import ProgressRing from "../../../../components/ui/ProgressRing";
import { Block } from "./DrawerCharts";
import { fmtPct, fmtDate, MiniChip } from "./perfUi";

export function AttemptHistory({ attempts }) {
  return (
    <Block title="Attempt history" hint={`${attempts.length} attempt${attempts.length === 1 ? "" : "s"} in this view, newest first.`}>
      {attempts.length === 0 ? <p className="text-xs text-muted">No attempts yet.</p> : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[420px] text-left text-xs">
            <thead><tr className="eyebrow-muted"><th scope="col" className="pb-2">Test</th><th scope="col" className="pb-2">Try</th><th scope="col" className="pb-2">Date</th><th scope="col" className="pb-2 text-right">Score</th><th scope="col" className="pb-2 text-right">Time</th><th scope="col" className="pb-2 pl-2">Flags</th></tr></thead>
            <tbody className="divide-y divide-text/[0.06]">
              {attempts.map((a) => (
                <tr key={a.id}>
                  <td className="max-w-[10rem] truncate py-2 font-medium text-text">{a.test}</td>
                  <td className="py-2 text-muted">#{a.no}</td>
                  <td className="py-2 text-muted">{fmtDate(a.date)}</td>
                  <td className="py-2 text-right font-semibold tabular-nums text-text">{a.finished ? fmtPct(a.pct) : "Unfinished"}</td>
                  <td className="py-2 text-right tabular-nums text-muted">{a.timeMin} min</td>
                  <td className="py-2 pl-2"><span className="flex flex-wrap gap-1">{a.late && <MiniChip tone="bg-pastel-pink text-pastel-pink-ink">Late</MiniChip>}{a.fast && <MiniChip tone="bg-pastel-orange text-pastel-orange-ink">Very fast</MiniChip>}{!a.finished && <MiniChip>Abandoned</MiniChip>}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Block>
  );
}

export function NegativeBlock({ negative }) {
  if (!negative.enabled) {
    return <Block title="Negative-marking impact"><p className="text-xs text-muted">Negative marking is switched off for this series, so wrong answers never cost marks.</p></Block>;
  }
  const diff = negative.withoutPenalty !== null && negative.withPenalty !== null ? Math.round((negative.withoutPenalty - negative.withPenalty) * 10) / 10 : null;
  return (
    <Block title="Negative-marking impact" hint={negative.scheme || "Wrong answers deduct marks."}>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-2xl bg-pastel-pink p-3"><div className="text-lg font-bold text-pastel-pink-ink">-{negative.lost}</div><div className="text-[11px] text-pastel-pink-ink">marks lost</div></div>
        <div className="rounded-2xl bg-pastel-blue p-3"><div className="text-lg font-bold text-pastel-blue-ink">{fmtPct(negative.withPenalty)}</div><div className="text-[11px] text-pastel-blue-ink">actual score</div></div>
        <div className="rounded-2xl bg-pastel-sage p-3"><div className="text-lg font-bold text-pastel-sage-ink">{fmtPct(negative.withoutPenalty)}</div><div className="text-[11px] text-pastel-sage-ink">without penalty</div></div>
      </div>
      {diff !== null && <p className="mt-3 text-xs text-muted">Negative marking cost this student {diff} percentage points on average.</p>}
    </Block>
  );
}

export function GuessSkipBlock({ student, cohortGuess, cohortSkip }) {
  const item = (label, value, cohort, tip) => (
    <div className="flex items-center gap-3">
      <ProgressRing value={value} size={64} tone="brand" label={`${label} ${value}%`} />
      <div className="text-xs">
        <div className="font-semibold text-text">{label}</div>
        <div className="text-muted">Cohort {cohort}%</div>
        <div className="mt-0.5 max-w-[11rem] text-muted">{tip}</div>
      </div>
    </div>
  );
  return (
    <Block title="Guess vs skip rate" hint="Guesses are answers given far faster than the expected time. Skips are objective questions left blank.">
      <div className="grid gap-4 sm:grid-cols-2">
        {item("Guess rate", student.guessRate, cohortGuess, student.guessRate > cohortGuess + 5 ? "Above the cohort. Fast, low-confidence answers." : "In line with the cohort.")}
        {item("Skip rate", student.skipRate, cohortSkip, student.skipRate > cohortSkip + 5 ? "Skips more than most. May be avoiding hard topics." : "In line with the cohort.")}
      </div>
    </Block>
  );
}

export function SubjectiveBlock({ items }) {
  return (
    <Block title="Subjective answers and feedback" hint="Rubric scores and the grader's written feedback.">
      {items.length === 0 ? <p className="text-xs text-muted">This student has no graded written answers in this view.</p> : (
        <ul className="flex flex-col gap-4">
          {items.map((it) => (
            <li key={`${it.qid}-${it.date}`} className="rounded-2xl bg-bg p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="eyebrow-muted truncate">{it.test}{it.topic ? ` · ${it.topic}` : ""}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium text-text">{it.question}</p>
                </div>
                <StatusBadge status={it.score / it.max >= 0.6 ? "success" : it.score / it.max >= 0.4 ? "warning" : "danger"} size="sm" showIcon={false}>{it.score}/{it.max}</StatusBadge>
              </div>
              <ul className="mt-3 flex flex-col gap-1.5">
                {it.rubric.map((r) => (
                  <li key={r.id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-xs">
                    <span className="min-w-0">
                      <span className="block truncate text-muted">{r.label}</span>
                      <span className="mt-1 block h-1.5 rounded-full bg-primary/[0.08]"><span className="block h-full rounded-full bg-chart-3" style={{ width: `${r.max ? (r.score / r.max) * 100 : 0}%` }} /></span>
                    </span>
                    <span className="font-semibold tabular-nums text-text">{r.score}/{r.max}</span>
                  </li>
                ))}
              </ul>
              <blockquote className="mt-3 border-l-2 border-secondary pl-3 text-xs text-text">
                {it.feedback}
                <footer className="mt-1 text-[11px] text-muted">Graded by {it.gradedBy}</footer>
              </blockquote>
            </li>
          ))}
        </ul>
      )}
    </Block>
  );
}
