// My Tests (student_my_series): the series the student is enrolled in, with progress.
//
// Presentation-only redesign: same data, routes and handlers as before.
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { rotationClassFor } from "../../../components/ui/ColorBlockCard";
import { BookOpenIcon, ChevronRightIcon, ClockIcon, FileTextIcon, TargetIcon } from "../../../components/ui/icons";
import { COVER_ART, MetaChip } from "../components/SeriesShowcaseCard";
import { CoverDots, CoverGlyph, Rise, glyphFor } from "../components/StudentKit";
import { EmptyPanel, ErrorState, LoadingState, PAGE } from "../components/PageState";
import PageHero, { HERO_BTN_YELLOW } from "../components/PageHero";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { formatDate, formatMinutes, formatPercent } from "../utils/format";

function Stat({ label, children }) {
  return (
    <div className="min-w-0 rounded-xl bg-(--lp-grey) px-3 py-2 last:odd:col-span-2 sm:rounded-2xl sm:px-3.5 sm:py-3">
      <p className="text-[13px] font-bold leading-snug text-text sm:text-sm">{children}</p>
      <p className="mt-0.5 text-[9px] sm:mt-1 sm:text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-(--lp-muted)">{label}</p>
    </div>
  );
}

function MySeriesCard({ s, index, onOpen }) {
  const pct = Math.min(Math.max(Number(s.progress_percentage) || 0, 0), 100);
  const badge = s.exam || s.subject || undefined;
  const hasBest = s.best_percentage !== null && s.best_percentage !== undefined;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(e); }}
      className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[1.25rem] bg-white sm:rounded-[1.75rem] shadow-[0_1px_0_rgb(15_17_21/0.04),0_24px_40px_-30px_rgb(15_17_21/0.4)] ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-24px_rgb(15_17_21/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className={`relative h-24 w-full overflow-hidden sm:aspect-[16/8] sm:h-auto ${rotationClassFor(index)}`}>
        <svg className="absolute inset-0 h-full w-full text-white transition-transform duration-500 ease-out group-hover:scale-105" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
          {COVER_ART[index % COVER_ART.length]}
        </svg>
        <CoverDots />
        <CoverGlyph className="right-20 max-sm:text-6xl sm:right-24">{glyphFor(s, index)}</CoverGlyph>
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-white px-2.5 py-0.5 text-[9px] sm:left-4 sm:top-4 sm:px-3 sm:py-1 sm:text-[10px] font-bold uppercase tracking-[0.12em] text-primary shadow-sm">
            {badge}
          </span>
        )}
        <span className="absolute -bottom-4 right-4 grid h-11 w-11 place-items-center rounded-xl bg-white text-primary sm:-bottom-5 sm:right-5 sm:h-14 sm:w-14 sm:rounded-2xl shadow-[0_8px_20px_rgb(15_17_21/0.14)]" aria-hidden="true">
          <BookOpenIcon className="h-5 w-5 sm:h-6 sm:w-6" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4 pt-5 sm:gap-4 sm:p-5 sm:pt-6">
        <div className="space-y-1">
          <h3 className="line-clamp-2 pr-10 font-display text-base font-bold sm:min-h-[3rem] sm:pr-12 sm:text-lg leading-snug tracking-tight text-text">{s.title}</h3>
          {s.subject && <p className="line-clamp-1 text-[13px] font-medium text-text/60 sm:text-sm">{s.subject}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <MetaChip icon={FileTextIcon}>{`${s.tests_count ?? 0} ${s.tests_count === 1 ? "test" : "tests"}`}</MetaChip>
          {s.total_duration_mins ? <MetaChip icon={ClockIcon}>{formatMinutes(s.total_duration_mins)}</MetaChip> : null}
          {s.level ? <MetaChip icon={TargetIcon}>{s.level}</MetaChip> : null}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="h-2 flex-1 overflow-hidden sm:h-2.5 rounded-full bg-(--lp-grey)"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(pct)}
          >
            <div className="h-full rounded-full bg-(--lp-blue) transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
          </div>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpen(e); }}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--lp-ink) px-3.5 py-2 text-xs font-semibold text-white transition-colors sm:px-4 sm:py-2.5 duration-200 hover:bg-(--lp-blue-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Open
            <ChevronRightIcon className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-1.5 border-t border-(--lp-line) pt-3 sm:gap-2 sm:pt-4">
          <Stat label="Tests taken">{s.tests_attempted} of {s.tests_count}</Stat>
          {hasBest && <Stat label="Best">{formatPercent(s.best_percentage, 1)}</Stat>}
          {s.latest_attempt_at && <Stat label="Last">{formatDate(s.latest_attempt_at)}</Stat>}
          {s.expires_at && <Stat label="Access until">{formatDate(s.expires_at)}</Stat>}
        </div>
      </div>
    </div>
  );
}

export default function MyTests() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useStudentData(() => studentSeriesApi.mySeries(), "my-series");

  return (
    <div className={`${PAGE} space-y-8 pb-10`}>
      <PageHero
        compact
        theme="blue"
        art="shelf"
        eyebrow="Enrolled"
        title="My tests"
        subtitle="Your test series and how far you've got in each."
      >
        <button type="button" onClick={() => navigate("/student/test-series")} className={HERO_BTN_YELLOW}>
          Find more
          <ChevronRightIcon className="h-4 w-4" />
        </button>
      </PageHero>

      {loading ? (
        <LoadingState label="Loading your series" />
      ) : error ? (
        <ErrorState error={error} onRetry={reload} title="Couldn't load your series" />
      ) : data.length === 0 ? (
        <EmptyPanel
          heading="You haven't enrolled in a test series yet"
          message="Free series can be joined in one click."
          action={<Button fullWidth={false} onClick={() => navigate("/student/test-series")}>Browse test series</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
          {data.map((s, i) => (
            <Rise key={s.id} delay={Math.min(i, 8) * 80} className="h-full">
              <MySeriesCard s={s} index={i} onOpen={() => navigate(`/student/my-tests/${s.id}`)} />
            </Rise>
          ))}
        </div>
      )}
    </div>
  );
}
