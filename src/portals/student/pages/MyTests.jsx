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
    <div className="min-w-0 rounded-2xl bg-(--lp-grey) px-3.5 py-3 last:odd:col-span-2">
      <p className="text-sm font-bold leading-snug text-text">{children}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase leading-tight tracking-[0.1em] text-(--lp-muted)">{label}</p>
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
      className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[1.75rem] bg-white shadow-[0_1px_0_rgb(15_17_21/0.04),0_24px_40px_-30px_rgb(15_17_21/0.4)] ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-24px_rgb(15_17_21/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className={`relative aspect-[16/8] w-full overflow-hidden ${rotationClassFor(index)}`}>
        <svg className="absolute inset-0 h-full w-full text-white transition-transform duration-500 ease-out group-hover:scale-105" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
          {COVER_ART[index % COVER_ART.length]}
        </svg>
        <CoverDots />
        <CoverGlyph className="right-24">{glyphFor(s, index)}</CoverGlyph>
        {badge && (
          <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary shadow-sm">
            {badge}
          </span>
        )}
        <span className="absolute -bottom-5 right-5 grid h-14 w-14 place-items-center rounded-2xl bg-white text-primary shadow-[0_8px_20px_rgb(15_17_21/0.14)]" aria-hidden="true">
          <BookOpenIcon className="h-6 w-6" />
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-4 p-5 pt-6">
        <div className="space-y-1">
          <h3 className="line-clamp-2 min-h-[3rem] pr-12 font-display text-lg font-bold leading-snug tracking-tight text-text">{s.title}</h3>
          {s.subject && <p className="line-clamp-1 text-sm font-medium text-text/60">{s.subject}</p>}
        </div>

        <div className="flex flex-wrap gap-2">
          <MetaChip icon={FileTextIcon}>{`${s.tests_count ?? 0} ${s.tests_count === 1 ? "test" : "tests"}`}</MetaChip>
          {s.total_duration_mins ? <MetaChip icon={ClockIcon}>{formatMinutes(s.total_duration_mins)}</MetaChip> : null}
          {s.level ? <MetaChip icon={TargetIcon}>{s.level}</MetaChip> : null}
        </div>

        <div className="flex items-center gap-3">
          <div
            className="h-2.5 flex-1 overflow-hidden rounded-full bg-(--lp-grey)"
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
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--lp-ink) px-4 py-2.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-(--lp-blue-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          >
            Open
            <ChevronRightIcon className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
          </button>
        </div>

        <div className="mt-auto grid grid-cols-2 gap-2 border-t border-(--lp-line) pt-4">
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
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
