// Step 5 — Review. Publish checklist + a final preview that lists the same
// facts as the admin wizard's review step.
import ProgressRing from "../../../components/ui/ProgressRing";
import { AlertTriangleIcon, CheckIcon, ArrowRightIcon, XIcon } from "../../../components/ui/icons";
import { LifecycleStepper } from "./TestSeriesStatus";
import { completenessChecklist, isStructureLocked, allTests, derivedTestLabel, formatDate } from "../data/testSeriesData";
import { effectiveBuildDeadline } from "../data/testSeriesDeadlines";

export default function TestSeriesReviewStep({ series, onChange, onFix }) {
  const items = completenessChecklist(series);
  const required = items.filter((i) => i.required);
  const doneRequired = required.filter((i) => i.ok).length;
  const blocked = required.length - doneRequired;
  const locked = isStructureLocked(series);
  const d = series.deadlines;
  const tests = allTests(series);
  const qs = tests.flatMap((t) => t.questions);
  const marks = qs.reduce((n, q) => n + (Number(q.points) || 0), 0);
  const mins = tests.reduce((n, t) => n + (Number(t.duration) || 0), 0);
  const build = effectiveBuildDeadline(series);
  const list = (a) => (a && a.length ? a.join(", ") : "");
  const facts = [
    ["Offered as", series.pricing.model === "paid" ? "Paid" : "Free"],
    ["Target audience", series.audienceLevel],
    ["Subject", list(series.subjects)],
    ["Class / Grade", list(series.grades)],
    ["Exam / Goal", list(series.exams)],
    ["Difficulty", series.difficulty],
    ["Language", list(series.languages)],
    ["Test type", derivedTestLabel(series)],
    ["Tests", String(tests.length)],
    ["Questions", String(qs.length)],
    ["Total marks", String(marks)],
    ["Total duration", `${mins} min`],
    ["Pricing", series.pricing.model === "paid" ? `₹${series.pricing.price || 0}` : "Free"],
    ["Publishing", d.publishMode === "scheduled" && d.goLiveAt ? `Scheduled · ${String(d.goLiveAt).replace("T", " ")}` : "Publish now"],
    ["Student availability", d.windowMode === "window" && d.windowOpen && d.windowClose ? `${formatDate(d.windowOpen)} – ${formatDate(d.windowClose)}` : "Always open"],
    ["Days of access", d.accessLimited ? `${d.accessDays} days` : "Lifetime"],
    ["Monthly access limit", d.monthlyLimited ? `${d.monthlyLimit} tests / month` : "Unlimited"],
    ["Late submissions", d.late.policy === "none" ? "Not allowed" : `Grace ${d.late.graceMinutes} min`],
    ["Build deadline", build ? formatDate(build) : ""],
  ];

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

      <section className="rounded-3xl bg-surface p-6 shadow-soft sm:p-7">
        <h2 className="text-lg font-bold text-text">Final preview</h2>
        <p className="mt-1 text-sm text-muted">Everything students and admins will see for this series.</p>
        <dl className="mt-5 grid gap-x-8 gap-y-3 sm:grid-cols-2">
          {facts.map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-4 border-b border-text/[0.06] pb-2">
              <dt className="text-xs font-semibold uppercase tracking-wide text-muted">{k}</dt>
              <dd className="text-right text-sm font-semibold text-text">{v || "—"}</dd>
            </div>
          ))}
        </dl>
      </section>
    </div>
  );
}
