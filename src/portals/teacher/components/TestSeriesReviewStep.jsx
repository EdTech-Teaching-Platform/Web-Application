// Step 4 — Review & Publish: series-level settings (passing %, attempts,
// access rules, certificate), auto-generated Quick Facts, live "Topics
// covered" grid (topicsCovered(series) is recomputed from the current
// questions on every render), the student-facing preview and the list of
// blocking errors that must be cleared before Publish enables.
import Input from "../../../components/ui/Input";
import Switch from "../../../components/ui/Switch";
import TestSeriesPreview, { QuickFactsList, TopicsGrid } from "./TestSeriesPreview";
import TestSeriesQuestionPreview from "./TestSeriesQuestionPreview";
import ProgressRing from "../../../components/ui/ProgressRing";
import { AlertTriangleIcon, CheckIcon, ArrowRightIcon, XIcon, } from "../../../components/ui/icons";
import { LifecycleStepper } from "./TestSeriesStatus";
import { completenessChecklist, topicsCovered, isStructureLocked, formatDate, visibilityNote } from "../data/testSeriesData";

const STEP_NAMES = ["Details", "Structure", "Questions", "Review"];

function Card({ title, description, children, className = "" }) {
  return (
    <section className={`rounded-3xl bg-surface p-6 shadow-soft sm:p-7 ${className}`}>
      <h2 className="text-lg font-bold text-text">{title}</h2>
      {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      <div className="mt-5">{children}</div>
    </section>
  );
}

export default function TestSeriesReviewStep({ series, onChange, onFix }) {
  const s = series.settings;
  const items = completenessChecklist(series);
  const required = items.filter((i) => i.required);
  const doneRequired = required.filter((i) => i.ok).length;
  const blocked = required.length - doneRequired;
  const locked = isStructureLocked(series);
  const d = series.deadlines;
  const set = (patch) => onChange({ settings: { ...s, ...patch } });
  const topicCount = topicsCovered(series).length;

  return (
    <div className="flex flex-col gap-6">
      <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7" aria-labelledby="ts-checklist-h">
        <div className="flex flex-wrap items-center gap-4">
          <ProgressRing value={required.length ? (doneRequired / required.length) * 100 : 100} size={64} stroke={7} label={`${doneRequired} of ${required.length} required items done`} />
          <div className="min-w-0 flex-1">
            <span className="eyebrow">Completeness</span>
            <h2 id="ts-checklist-h" className="mt-0.5 text-lg font-bold text-text">Publish checklist</h2>
            <p className="text-sm text-muted">{blocked === 0 ? "Everything required is done. You're ready to move forward." : `${blocked} required item${blocked === 1 ? "" : "s"} still blocking publishing.`}</p>
          </div>
        </div>
        <div className="mt-5 overflow-x-auto"><LifecycleStepper series={series} /></div>
        <ul className="mt-5 flex flex-col divide-y divide-text/[0.06]">
          {items.map((i) => (
            <li key={i.id} className="flex items-start gap-3 py-3">
              <span className={`mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${i.ok ? "bg-pastel-sage text-pastel-sage-ink" : i.required ? "bg-pastel-pink text-pastel-pink-ink" : "bg-pastel-orange text-pastel-orange-ink"}`}>
                {i.ok ? <CheckIcon className="h-3.5 w-3.5" /> : i.required ? <XIcon className="h-3.5 w-3.5" /> : <AlertTriangleIcon className="h-3.5 w-3.5" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-text">
                  {i.label}
                  {!i.required && <span className="ml-2 rounded-full bg-text/[0.06] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Optional</span>}
                </p>
                {!i.ok && i.detail && <p className="mt-0.5 text-xs text-muted">{i.detail}</p>}
              </div>
              {!i.ok && !locked && (
                <button type="button" onClick={() => onFix(i.fix)} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-primary/[0.07] px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-primary/[0.12]">
                  Fix this <ArrowRightIcon className="h-3 w-3" />
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <fieldset disabled={locked} className="contents">
        <Card title="Series settings" description={locked ? "Final published: these rules are locked." : "Rules that apply to every test in this series."}>
          <div className="flex flex-col gap-5">
            <div>
              <div className="mb-1.5 flex items-center justify-between text-sm">
                <span className="font-medium text-text">Passing score</span>
                <span className="font-semibold text-primary">{s.passingPct}%</span>
              </div>
              <input type="range" min={0} max={100} step={5} value={s.passingPct} onChange={(e) => set({ passingPct: Number(e.target.value) })} aria-label="Passing score percentage" className="w-full accent-[color:var(--color-primary)]" />
            </div>

            <div>
              <Switch checked={s.attemptsUnlimited} onChange={(v) => set({ attemptsUnlimited: v })} label="Unlimited attempts" description="Students can retake any test" />
              {!s.attemptsUnlimited && (
                <Input
                  containerClassName="mt-3 block"
                  label="Attempts per test"
                  type="number"
                  min={1}
                  value={s.attemptLimit}
                  onChange={(e) => set({ attemptLimit: e.target.value === "" ? "" : Number(e.target.value) })}
                  error={!(Number(s.attemptLimit) >= 1) ? "Enter at least 1 attempt." : undefined}
                  shape="rect"
                />
              )}
            </div>

            <div>
              <span className="mb-2 block text-sm font-medium text-text">Timing</span>
              <ul className="flex flex-col gap-1 rounded-2xl bg-bg px-4 py-3 text-xs text-muted">
                <li>{d.publishMode === "scheduled" && d.goLiveAt ? `Goes live ${formatDate(d.goLiveAt)}` : "Goes live as soon as you publish"}</li>
                <li>{d.windowMode === "window" && d.windowOpen && d.windowClose ? `Students can take tests ${formatDate(d.windowOpen)} to ${formatDate(d.windowClose)}` : "Open to students at any time"}</li>
                <li>{d.late.policy === "penalty" ? `Late submissions: ${d.late.penaltyPct}% penalty, accepted for ${d.late.graceHours} h` : "Late submissions are not allowed"}</li>
                <li>Status: {visibilityNote(series)}</li>
              </ul>
              <button type="button" onClick={() => onFix({ step: 0, anchor: "ts-deadlines" })} className="mt-2 text-xs font-bold text-primary underline">Edit deadlines</button>
            </div>

            <Switch checked={s.certificate} onChange={(v) => set({ certificate: v })} label="Certificate on completion" description="Issued when a student finishes every test" />
          </div>
        </Card>
        </fieldset>

        <Card title="Quick facts" description="Generated automatically from what you've built.">
          <QuickFactsList series={series} />
        </Card>
      </div>

      <Card title="Topics covered" description={topicCount ? `${topicCount} topic${topicCount === 1 ? "" : "s"}, aggregated live from your question tags.` : "Aggregated live from your question tags."}>
        <TopicsGrid series={series} />
      </Card>

      <Card title="Question preview" description="Every question as students will see it, including any images. The keyed answer is marked for you.">
        <TestSeriesQuestionPreview series={series} />
      </Card>

      <Card title="Student preview">
        <TestSeriesPreview series={series} />
      </Card>
    </div>
  );
}
