import { rotationClassFor } from "../../../components/ui/ColorBlockCard";
import { BookOpenIcon, CheckIcon, ChevronRightIcon, ClockIcon, FileTextIcon, TargetIcon } from "../../../components/ui/icons";
import { formatMinutes, priceLabel } from "../utils/format";

// Presentation-only card for the "Find a test series" grid. Same props and
// behaviour as SeriesCard (series, index, onOpen, actionLabel, onAction,
// actionDisabled) — only the look differs. Text-free decorative covers sit on
// the fixed rotation colour order.

export const COVER_ART = [
  // rings + dots
  (
    <>
      <circle cx="280" cy="20" r="96" fill="currentColor" fillOpacity="0.16" />
      <circle cx="280" cy="20" r="58" fill="currentColor" fillOpacity="0.18" />
      <circle cx="30" cy="190" r="74" fill="currentColor" fillOpacity="0.14" />
      <circle cx="200" cy="120" r="7" fill="currentColor" fillOpacity="0.7" />
      <circle cx="228" cy="100" r="3.5" fill="currentColor" fillOpacity="0.55" />
    </>
  ),
  // waves
  (
    <>
      <circle cx="40" cy="30" r="70" fill="currentColor" fillOpacity="0.16" />
      <path d="M0 130c60-30 110 20 180-8s100-32 140-10" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2.5" strokeLinecap="round" />
      <path d="M0 158c60-30 110 20 180-8s100-32 140-10" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx="260" cy="48" r="26" fill="currentColor" fillOpacity="0.22" />
    </>
  ),
  // grid dots + quarter circle
  (
    <>
      <circle cx="300" cy="190" r="110" fill="currentColor" fillOpacity="0.16" />
      <circle cx="300" cy="190" r="66" fill="currentColor" fillOpacity="0.18" />
      {[0, 1, 2, 3].flatMap((r) => [0, 1, 2, 3, 4].map((c) => (
        <circle key={`${r}-${c}`} cx={28 + c * 16} cy={28 + r * 16} r="2.4" fill="currentColor" fillOpacity="0.6" />
      )))}
    </>
  ),
  // concentric rings
  (
    <>
      <circle cx="250" cy="90" r="30" stroke="currentColor" strokeOpacity="0.5" strokeWidth="2" fill="none" />
      <circle cx="250" cy="90" r="62" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" fill="none" />
      <circle cx="250" cy="90" r="98" stroke="currentColor" strokeOpacity="0.22" strokeWidth="2" fill="none" />
      <circle cx="40" cy="170" r="60" fill="currentColor" fillOpacity="0.14" />
    </>
  ),
];

export function MetaChip({ icon: Icon, children }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-grey) px-2.5 py-1 text-[11px] font-semibold text-text/70">
      <Icon className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      {children}
    </span>
  );
}

export default function SeriesShowcaseCard({ series, index = 0, onOpen, actionLabel, onAction, actionDisabled = false }) {
  const badge = series.exam || series.subject || undefined;
  const enrolled = Boolean(series.is_enrolled);
  const testsLabel = `${series.tests_count ?? 0} ${series.tests_count === 1 ? "test" : "tests"}`;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(e); }}
      className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[1.75rem] bg-white ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_22px_48px_rgb(15_17_21/0.13)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className={`relative aspect-[2/1] w-full overflow-hidden ${rotationClassFor(index)}`}>
        <svg className="absolute inset-0 h-full w-full text-white transition-transform duration-500 ease-out group-hover:scale-105" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
          {COVER_ART[index % COVER_ART.length]}
        </svg>
        {badge && (
          <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary shadow-sm">
            {badge}
          </span>
        )}
        <span className="absolute -bottom-5 right-5 grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary shadow-[0_8px_20px_rgb(15_17_21/0.14)]" aria-hidden="true">
          <BookOpenIcon className="h-6 w-6" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-5 pt-6">
        <div className="space-y-1">
          <h3 className="line-clamp-2 min-h-[3rem] pr-12 font-display text-lg font-bold leading-snug tracking-tight text-text">{series.title}</h3>
          {series.subject && <p className="line-clamp-1 text-sm font-medium text-text/60">{series.subject}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <MetaChip icon={FileTextIcon}>{testsLabel}</MetaChip>
          {series.total_duration_mins ? <MetaChip icon={ClockIcon}>{formatMinutes(series.total_duration_mins)}</MetaChip> : null}
          {series.level ? <MetaChip icon={TargetIcon}>{series.level}</MetaChip> : null}
        </div>

        {series.description && <p className="line-clamp-2 text-xs leading-relaxed text-text/55">{series.description}</p>}

        <div className="mt-auto flex items-center justify-between gap-3 border-t border-(--lp-line) pt-4">
          <span className="font-display text-xl font-bold tracking-tight text-text">{priceLabel(series)}</span>
          {actionLabel && (
            <button
              type="button"
              disabled={actionDisabled}
              onClick={(e) => { e.stopPropagation(); onAction?.(); }}
              className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition-[background-color,transform] duration-200 ease-out focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary ${
                actionDisabled
                  ? "cursor-not-allowed bg-(--lp-grey) text-(--lp-muted)"
                  : enrolled
                    ? "bg-success/15 text-success hover:bg-success/25"
                    : "bg-primary text-white hover:bg-(--lp-ink)"
              }`}
            >
              {enrolled && !actionDisabled && <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />}
              {actionLabel}
              {!actionDisabled && <ChevronRightIcon className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
