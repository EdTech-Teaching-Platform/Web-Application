import RadarChart from "./RadarChart";
import { BarRow, MiniChip, fmtPct, fmtClock } from "./perfUi";

export function Block({ title, hint, children }) {
  return (
    <section className="rounded-3xl bg-surface p-5 shadow-soft">
      <h3 className="text-sm font-bold text-text">{title}</h3>
      {hint && <p className="mt-0.5 text-xs text-muted">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}

export function ScoreHistory({ history }) {
  return (
    <Block title="Score and percentile history" hint="Score per test with the student's percentile and rank among those who took it.">
      <ul className="flex flex-col gap-3">
        {history.map((h) => (
          <li key={h.id} className="text-xs">
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate font-medium text-text">{h.short} · {h.title}</span>
              {h.pct === null ? <span className="text-muted">Not taken</span> : <span className="shrink-0 font-semibold text-text">{fmtPct(h.pct)} <span className="font-medium text-muted">· P{h.percentile} · #{h.rank} of {h.of}</span></span>}
            </div>
            <div className="h-2.5 rounded-full bg-primary/[0.08]" role="img" aria-label={`${h.title}: ${h.pct === null ? "not taken" : `${h.pct}%`}`}>
              {h.pct !== null && <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, h.pct)}%` }} />}
            </div>
          </li>
        ))}
      </ul>
    </Block>
  );
}

export function SectionBlock({ sections }) {
  const axes = sections.map((s) => ({ label: s.title, mine: s.mine, cohort: s.cohort }));
  return (
    <Block title="Section-wise performance" hint="Marks earned per section against the cohort average.">
      {axes.length >= 3 ? <RadarChart axes={axes} /> : (
        <div className="flex flex-col gap-3">
          {sections.map((s) => <BarRow key={s.id} label={s.title} value={s.mine} marker={s.cohort} />)}
          <p className="text-[11px] text-muted">Gold tick = cohort average.</p>
        </div>
      )}
    </Block>
  );
}

export function TopicBlock({ topics }) {
  return (
    <Block title="Topic mastery" hint="Accuracy on attempted questions. Gold tick = cohort average.">
      {topics.length === 0 ? <p className="text-xs text-muted">No topic-tagged objective questions answered yet.</p> : (
        <div className="flex flex-col gap-2.5">
          {topics.map((t) => <BarRow key={t.topic} label={t.topic} value={t.mine} marker={t.cohort} tone={t.mine !== null && t.mine < 50 ? "bg-chart-6" : "bg-chart-3"} />)}
        </div>
      )}
    </Block>
  );
}

export function DifficultyBlock({ difficulty }) {
  return (
    <Block title="Accuracy by difficulty" hint="Gold tick = cohort average.">
      <div className="flex flex-col gap-2.5">
        {difficulty.map((d) => <BarRow key={d.label} label={d.label} value={d.mine} marker={d.cohort} />)}
      </div>
    </Block>
  );
}

export function TimeBlock({ timing }) {
  const max = Math.max(1, ...timing.flatMap((t) => [t.mine || 0, t.cohort || 0]));
  return (
    <Block title="Time per question" hint="Seconds spent on each question against the cohort average. Slow flags mark 1.5x or more.">
      {timing.length === 0 ? <p className="text-xs text-muted">No timed answers yet.</p> : (
        <ul className="flex max-h-72 flex-col gap-2 overflow-y-auto pr-1">
          {timing.map((t) => {
            const slow = t.cohort && t.mine / t.cohort >= 1.5;
            return (
              <li key={t.id} className="grid grid-cols-[3.2rem_1fr_auto] items-center gap-2 text-xs" title={t.full}>
                <span className="font-semibold text-text">{t.label}</span>
                <span className="flex flex-col gap-1" role="img" aria-label={`${t.full}: student ${t.mine} seconds, cohort average ${t.cohort ?? "unknown"} seconds`}>
                  <span className="h-1.5 rounded-full bg-primary" style={{ width: `${(t.mine / max) * 100}%` }} />
                  <span className="h-1.5 rounded-full bg-chart-5/70" style={{ width: `${((t.cohort || 0) / max) * 100}%` }} />
                </span>
                <span className="flex items-center gap-1.5 tabular-nums text-muted">{fmtClock(t.mine)} / {fmtClock(t.cohort)}{slow && <MiniChip tone="bg-pastel-orange text-pastel-orange-ink">Slow</MiniChip>}</span>
              </li>
            );
          })}
        </ul>
      )}
      <div className="mt-2 flex gap-4 text-[11px] font-medium text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-primary" /> This student</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-3 rounded-full bg-chart-5/70" /> Cohort average</span>
      </div>
    </Block>
  );
}
