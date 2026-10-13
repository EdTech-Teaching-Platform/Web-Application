// TestSeriesSelection — the student's test-selection screen for one series:
// header, then each section with its tests (type chip, question count,
// duration, marks) and a per-test locked / startable state. Presentation
// only: `onStartTest(test)` is a callback, nothing is stored here.
//
// A test is locked when `test.locked` is true and its id is not in
// `unlockedTestIds`. Locked tests show a lock + "Unlocks after enrolment".
// When the host passes `onUnlock` / `onUnlockAll` (the teacher preview does,
// to simulate enrolment) an extra clearly-labelled control appears.
// Props: series, banner?, unlockedTestIds?, onStartTest, onUnlock?, onUnlockAll?,
//   unlockLabel?, headerNote?
import Button from "../ui/Button";
import { CheckIcon, ClockIcon, LockIcon, PlayIcon } from "../ui/icons";
import { derivedTestTypes, priceLabel, quizPoints, seriesQuestionCount, seriesTestCount } from "../../portals/teacher/data/testSeriesData";

export default function TestSeriesSelection({ series, banner, unlockedTestIds = [], onStartTest, onUnlock, onUnlockAll, unlockLabel = "Unlock in preview (simulates enrolment — payment skipped)", headerNote }) {
  const unlocked = new Set(unlockedTestIds);
  const isLocked = (t) => Boolean(t.locked) && !unlocked.has(t.id);
  const sections = Array.isArray(series.sections) ? series.sections : [];
  const anyLocked = sections.some((s) => s.tests.some(isLocked));
  const types = derivedTestTypes(series);
  const s = series.settings || {};

  return (
    <div className="flex flex-col gap-5 pb-12">
      {banner}

      <div className="overflow-hidden rounded-3xl bg-surface shadow-card">
        <div className="bg-gradient-to-br from-primary to-primary/75 px-6 py-7 text-white sm:px-8">
          <div className="flex flex-wrap gap-1.5">
            {[...(series.badges || []), series.difficulty].filter(Boolean).map((b) => (
              <span key={b} className="rounded-full bg-white/90 px-2.5 py-0.5 text-[11px] font-bold text-primary">
                {b}
              </span>
            ))}
          </div>
          <h1 className="mt-3 text-2xl font-bold leading-tight sm:text-3xl">{series.title || "Untitled test series"}</h1>
          {series.shortDescription && <p className="mt-2 max-w-2xl text-sm text-white/80">{series.shortDescription}</p>}
        </div>
        <dl className="grid grid-cols-2 gap-3 p-5 text-center sm:grid-cols-4 sm:p-6">
          {[
            ["Tests", seriesTestCount(series)],
            ["Questions", seriesQuestionCount(series)],
            ["Passing score", `${s.passingPct ?? 40}%`],
            ["Negative marking", series.negativeMarking?.enabled ? series.negativeMarking.scheme || "Yes" : "None"],
          ].map(([k, v]) => (
            <div key={k} className="rounded-2xl bg-bg px-3 py-3">
              <dd className="truncate text-sm font-bold text-text">{v}</dd>
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">{k}</dt>
            </div>
          ))}
        </dl>
        <p className="px-5 pb-5 text-xs text-muted sm:px-6">
          {types.length ? `${types.join(" · ")} · ` : ""}
          {s.attemptsUnlimited === false ? `${s.attemptLimit} attempts per test` : "Unlimited attempts"} · {priceLabel(series)}
        </p>
      </div>

      {headerNote}

      {anyLocked && onUnlockAll && (
        <div className="flex flex-col gap-3 rounded-3xl bg-surface p-4 shadow-soft sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <p className="text-sm text-muted">Some tests are locked until a student enrols, exactly as a non-enrolled student would see them.</p>
          <Button variant="secondary" fullWidth={false} className="min-h-11 shrink-0 px-5" onClick={onUnlockAll}>
            <LockIcon className="h-4 w-4" />
            Simulate enrolment (unlock all)
          </Button>
        </div>
      )}

      <div className="flex flex-col gap-4">
        {sections.map((sec) => (
          <section key={sec.id} aria-label={sec.title || "Untitled section"} className="overflow-hidden rounded-3xl bg-surface shadow-soft">
            <div className="px-5 py-3.5 text-sm font-bold text-text sm:px-6">
              {sec.title || "Untitled section"} <span className="font-normal text-muted">· {sec.tests.length} test{sec.tests.length === 1 ? "" : "s"}</span>
            </div>
            {sec.tests.length === 0 ? (
              <p className="border-t border-line px-5 py-4 text-sm text-muted sm:px-6">No tests in this section yet.</p>
            ) : (
              <ul className="divide-y divide-line border-t border-line">
                {sec.tests.map((t) => {
                  const locked = isLocked(t);
                  const empty = t.questions.length === 0;
                  return (
                    <li key={t.id} className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:px-6">
                      <div className="flex min-w-0 flex-1 items-start gap-3">
                        <span className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${locked ? "bg-text/[0.06] text-muted" : "bg-pastel-sage text-pastel-sage-ink"}`}>
                          {locked ? <LockIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-text">{t.title || "Untitled test"}</p>
                          <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
                            <span className="rounded-full bg-primary/[0.07] px-2 py-0.5 font-semibold text-primary">{t.type}</span>
                            <span>{t.questions.length} questions</span>
                            <span>{quizPoints(t.questions)} marks</span>
                            <span className="inline-flex items-center gap-1">
                              <ClockIcon className="h-3 w-3" />
                              {t.duration || 0} min
                            </span>
                          </p>
                          {empty && <p className="mt-1 text-xs font-semibold text-pastel-orange-ink">No questions added yet</p>}
                          {locked && <p className="mt-1 text-xs text-muted">Unlocks after enrolment</p>}
                        </div>
                      </div>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        {locked && onUnlock && (
                          <Button variant="tertiary" fullWidth={false} className="min-h-11 px-4 text-xs" onClick={() => onUnlock(t)}>
                            {unlockLabel}
                          </Button>
                        )}
                        <Button fullWidth={false} className="min-h-11 px-5" disabled={locked || empty} onClick={() => onStartTest?.(t)} aria-label={`Start ${t.title || "test"}`}>
                          <PlayIcon className="h-4 w-4" />
                          {locked ? "Locked" : "Start test"}
                        </Button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
