// Student-facing preview of a test series: the CARD (as it would appear in
// the public browse grid) and the DETAIL view (about, who it's for, sections
// with locked/unlocked tests, topics covered, quick-facts sidebar). Both are
// pure functions of `series`, so they update live as the educator edits.
// Also exports QuickFactsList + TopicsGrid, reused by the Review step.
import { useState } from "react";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import IconBadge, { toneForKey } from "../../../components/ui/IconBadge";
import { LockIcon, CheckIcon, QuizIcon, ClockIcon, CertificateIcon } from "../../../components/ui/icons";
import { derivedTestTypes, durationRange, formatDate, priceLabel, questionTypesUsed, seriesPoints, seriesQuestionCount, seriesTestCount, topicsCovered } from "../data/testSeriesData";

export function quickFacts(series) {
  const range = durationRange(series);
  const s = series.settings;
  const types = questionTypesUsed(series);
  return [
    { label: "Tests", value: seriesTestCount(series) },
    { label: "Total questions", value: seriesQuestionCount(series) },
    { label: "Total marks", value: seriesPoints(series) },
    { label: "Question types", value: types.length ? types.map((t) => t.short).join(", ") : "—" },
    { label: "Languages", value: series.languages.length ? series.languages.join(", ") : "—" },
    { label: "Test duration", value: range ? (range.min === range.max ? `${range.min} min` : `${range.min}–${range.max} min`) : "—" },
    { label: "Passing score", value: `${s.passingPct}%` },
    { label: "Attempts", value: s.attemptsUnlimited ? "Unlimited" : `${s.attemptLimit} per test` },
    { label: "Access", value: s.access === "scheduled" ? (s.startDate ? `Starts ${formatDate(s.startDate)}` : "Scheduled (date needed)") : "On demand" },
    { label: "Negative marking", value: series.negativeMarking.enabled ? series.negativeMarking.scheme || "Yes" : "None" },
    { label: "Certificate", value: s.certificate ? "On completion" : "Not offered" },
  ];
}

export function QuickFactsList({ series, className = "" }) {
  return (
    <dl className={`divide-y divide-line ${className}`}>
      {quickFacts(series).map((f) => (
        <div key={f.label} className="flex items-start justify-between gap-4 py-2.5 text-sm">
          <dt className="text-muted">{f.label}</dt>
          <dd className="text-right font-semibold text-text">{f.value}</dd>
        </div>
      ))}
    </dl>
  );
}

export function TopicsGrid({ series }) {
  const topics = topicsCovered(series);
  if (topics.length === 0) {
    return <p className="rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">Topics appear here as you tag questions with a topic or concept.</p>;
  }
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
      {topics.map((t) => (
        <div key={t.topic} className="flex items-center justify-between gap-2 rounded-2xl bg-bg px-3.5 py-2.5">
          <span className="truncate text-sm font-semibold text-text">{t.topic}</span>
          <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-bold text-primary">{t.count}</span>
        </div>
      ))}
    </div>
  );
}

export function StudentSeriesCard({ series }) {
  const tone = toneForKey(series.subjects[0] || series.title || "x");
  const range = durationRange(series);
  const meta = [series.grades.slice(0, 2).join(", "), series.subjects.slice(0, 2).join(", ")].filter(Boolean).join(" · ");
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-3xl bg-surface shadow-card">
      <div className="relative flex h-28 items-end bg-gradient-to-br from-primary/90 to-primary/60 p-4">
        <div className="flex flex-wrap gap-1.5">
          {series.badges.slice(0, 3).map((b) => (
            <span key={b} className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              {b}
            </span>
          ))}
        </div>
        <IconBadge icon={QuizIcon} tone={tone} size="sm" className="absolute right-4 top-4" />
      </div>
      <div className="p-5">
        <p className="text-xs font-semibold text-muted">{meta || "Class · Subject"}</p>
        <h3 className="mt-1 line-clamp-2 text-base font-bold leading-snug text-text">{series.title || "Your test series title"}</h3>
        <p className="mt-1.5 line-clamp-2 text-xs text-muted">{series.shortDescription || "Your short description appears here."}</p>
        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-bg px-3 py-2.5 text-center">
          <div>
            <div className="text-sm font-bold text-text">{seriesTestCount(series)}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Tests</div>
          </div>
          <div>
            <div className="text-sm font-bold text-text">{seriesQuestionCount(series)}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Questions</div>
          </div>
          <div>
            <div className="text-sm font-bold text-text">{range ? (range.min === range.max ? `${range.min}m` : `${range.min}–${range.max}m`) : "—"}</div>
            <div className="text-[10px] uppercase tracking-wide text-muted">Per test</div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between">
          <span className={`text-lg font-bold ${series.pricing.model === "paid" ? "text-text" : "text-success"}`}>{priceLabel(series)}</span>
          <span className="rounded-full bg-primary px-4 py-1.5 text-xs font-semibold text-white">{series.pricing.model === "paid" ? "Enroll" : "Start free"}</span>
        </div>
      </div>
    </div>
  );
}

export function StudentSeriesDetail({ series }) {
  const types = derivedTestTypes(series);
  return (
    <div className="overflow-hidden rounded-3xl bg-surface shadow-card">
      <div className="bg-gradient-to-br from-primary to-primary/75 px-6 py-8 text-white sm:px-8">
        <div className="flex flex-wrap gap-1.5">
          {[...series.badges, series.difficulty].map((b) => (
            <span key={b} className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-primary">
              {b}
            </span>
          ))}
        </div>
        <h2 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{series.title || "Your test series title"}</h2>
        <p className="mt-2 max-w-2xl text-sm text-white/80">{series.shortDescription || "Your short description appears here."}</p>
        <p className="mt-3 text-xs text-white/70">{[...series.grades, ...series.subjects, ...series.exams].join(" · ")}</p>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_18rem]">
        <div className="flex min-w-0 flex-col gap-8">
          <section>
            <h3 className="text-base font-bold text-text">About this test series</h3>
            {series.about && stripped(series.about) ? (
              <div className="prose prose-sm mt-2 max-w-none text-sm leading-relaxed text-muted [&_a]:text-primary [&_h3]:mt-3 [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5" dangerouslySetInnerHTML={{ __html: series.about }} />
            ) : (
              <p className="mt-2 text-sm text-muted">The description you write in Step 1 appears here.</p>
            )}
          </section>

          {series.whoFor && (
            <section>
              <h3 className="text-base font-bold text-text">Who it's for</h3>
              <p className="mt-2 text-sm text-muted">{series.whoFor}</p>
            </section>
          )}

          <section>
            <h3 className="text-base font-bold text-text">What's inside</h3>
            {series.sections.length === 0 ? (
              <p className="mt-2 rounded-2xl bg-bg px-4 py-5 text-center text-sm text-muted">Sections and tests you add in Step 2 are listed here.</p>
            ) : (
              <div className="mt-3 flex flex-col gap-4">
                {series.sections.map((s) => (
                  <div key={s.id} className="overflow-hidden rounded-2xl ring-1 ring-text/[0.07]">
                    <div className="bg-bg px-4 py-2.5 text-sm font-bold text-text">
                      {s.title || "Untitled section"} <span className="font-normal text-muted">· {s.tests.length} test{s.tests.length === 1 ? "" : "s"}</span>
                    </div>
                    {s.tests.length === 0 ? (
                      <p className="px-4 py-3 text-xs text-muted">No tests in this section yet.</p>
                    ) : (
                      <ul className="divide-y divide-line">
                        {s.tests.map((t) => (
                          <li key={t.id} className="flex items-center gap-3 px-4 py-3">
                            <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${t.locked ? "bg-text/[0.06] text-muted" : "bg-pastel-sage text-pastel-sage-ink"}`}>
                              {t.locked ? <LockIcon className="h-3.5 w-3.5" /> : <CheckIcon className="h-3.5 w-3.5" />}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-text">{t.title || "Untitled test"}</p>
                              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted">
                                <span>{t.type}</span>
                                <span>{t.questions.length} questions</span>
                                <span className="inline-flex items-center gap-1">
                                  <ClockIcon className="h-3 w-3" />
                                  {t.duration || 0} min
                                </span>
                              </p>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-bold ${t.locked ? "bg-text/[0.06] text-muted" : "bg-pastel-sage text-pastel-sage-ink"}`}>{t.locked ? "Locked" : "Free"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>

          <section>
            <h3 className="mb-3 text-base font-bold text-text">Topics covered</h3>
            <TopicsGrid series={series} />
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <div className="rounded-3xl bg-bg p-5">
            <div className="flex items-end justify-between">
              <span className={`text-3xl font-bold ${series.pricing.model === "paid" ? "text-text" : "text-success"}`}>{priceLabel(series)}</span>
              {types.length > 0 && <span className="text-xs text-muted">{types.join(" · ")}</span>}
            </div>
            <span className="mt-3 block w-full rounded-full bg-primary py-2.5 text-center text-sm font-semibold text-white">{series.pricing.model === "paid" ? "Enroll now" : "Start for free"}</span>
            {series.settings.certificate && (
              <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                <CertificateIcon className="h-3.5 w-3.5 text-primary" />
                Certificate on completion
              </p>
            )}
            <div className="mt-3 border-t border-line pt-1">
              <p className="eyebrow-muted pt-3">Quick facts</p>
              <QuickFactsList series={series} />
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

function stripped(html) {
  return String(html).replace(/<[^>]*>/g, "").trim();
}

export default function TestSeriesPreview({ series }) {
  const [view, setView] = useState("Card");
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">This is how students will see your series. It updates live.</p>
        <SegmentedControl options={["Card", "Detail page"]} value={view} onChange={setView} />
      </div>
      {view === "Card" ? (
        <div className="rounded-3xl bg-bg px-4 py-8">
          <StudentSeriesCard series={series} />
        </div>
      ) : (
        <StudentSeriesDetail series={series} />
      )}
    </div>
  );
}
