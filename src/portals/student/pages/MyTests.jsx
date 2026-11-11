// My Tests (student_my_series): the series the student is enrolled in, with progress.
//
// Presentation-only redesign: same data, routes and handlers as before. Calm,
// professional look — white page header, hairline-bordered series cards with a
// progress bar and a tidy figures grid, no decorative covers.
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { BookOpenIcon, ChevronRightIcon, ClockIcon, FileTextIcon, TargetIcon } from "../../../components/ui/icons";
import { Rise } from "../components/StudentKit";
import { EmptyPanel, ErrorState, LoadingState } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { formatDate, formatMinutes, formatPercent } from "../utils/format";

const WIDE = "mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8";
const SURFACE = "rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)]";
const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)";

// Icon tiles cycle through the same three quiet tints, in a fixed order.
const TINTS = [
  "bg-(--lp-blue-soft) text-(--lp-blue-deep)",
  "bg-(--lp-yellow-soft) text-(--lp-ink)",
  "bg-(--lp-grey) text-(--lp-ink)",
];

function Figure({ label, children }) {
  return (
    <div className="min-w-0">
      <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)">{label}</dt>
      <dd className="mt-1 truncate text-sm font-semibold tabular-nums text-(--lp-ink)">{children}</dd>
    </div>
  );
}

function MySeriesCard({ s, index, onOpen }) {
  const pct = Math.min(Math.max(Number(s.progress_percentage) || 0, 0), 100);
  const badge = s.exam || s.subject || undefined;
  const hasBest = s.best_percentage !== null && s.best_percentage !== undefined;
  const facts = [
    { icon: FileTextIcon, text: `${s.tests_count ?? 0} ${s.tests_count === 1 ? "test" : "tests"}` },
    s.total_duration_mins ? { icon: ClockIcon, text: formatMinutes(s.total_duration_mins) } : null,
    s.level ? { icon: TargetIcon, text: s.level } : null,
  ].filter(Boolean);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(e); }}
      className={`group flex h-full w-full cursor-pointer flex-col p-5 ${SURFACE} transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(15_17_21/0.28)] ${FOCUS}`}
    >
      <div className="flex items-start gap-3.5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${TINTS[index % TINTS.length]}`} aria-hidden="true">
          <BookOpenIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {badge && <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)">{badge}</p>}
          <h3 className="mt-0.5 line-clamp-2 font-display text-[17px] font-semibold leading-snug tracking-tight text-(--lp-ink)">{s.title}</h3>
        </div>
      </div>

      <div className="mt-4 space-y-2">
        {s.subject && <p className="line-clamp-1 text-sm font-medium text-text/75">{s.subject}</p>}
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-(--lp-muted)">
          {facts.map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-1.5">
              <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              {text}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-5">
        <div className="mb-2 flex items-center justify-between text-xs">
          <span className="font-medium text-(--lp-muted)">Progress</span>
          <span className="font-semibold tabular-nums text-(--lp-ink)">{Math.round(pct)}%</span>
        </div>
        <div
          className="h-1.5 w-full overflow-hidden rounded-full bg-(--lp-grey)"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(pct)}
        >
          <div className="h-full rounded-full bg-(--lp-blue-deep) transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-(--lp-line) pt-4">
        <Figure label="Tests taken">{s.tests_attempted} of {s.tests_count}</Figure>
        {hasBest && <Figure label="Best score">{formatPercent(s.best_percentage, 1)}</Figure>}
        {s.latest_attempt_at && <Figure label="Last attempt">{formatDate(s.latest_attempt_at)}</Figure>}
        {s.expires_at && <Figure label="Access until">{formatDate(s.expires_at)}</Figure>}
      </dl>

      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onOpen(e); }}
        className={`mt-5 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-(--lp-grey) px-4 py-2.5 text-[13px] font-semibold text-(--lp-ink) transition-colors duration-200 group-hover:bg-(--lp-ink) group-hover:text-white ${FOCUS}`}
      >
        Open
        <ChevronRightIcon className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </div>
  );
}

export default function MyTests() {
  const navigate = useNavigate();
  const { data, error, loading, reload } = useStudentData(() => studentSeriesApi.mySeries(), "my-series");
  const count = !loading && !error && Array.isArray(data) ? data.length : null;

  return (
    <div className={`${WIDE} pb-12`}>
      <Rise>
        <header className={`${SURFACE} flex flex-col gap-5 p-5 sm:p-8 md:flex-row md:items-center md:justify-between`}>
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--lp-muted)">
              Enrolled{count ? ` · ${count} ${count === 1 ? "series" : "series"}` : ""}
            </p>
            <h1 className="mt-2 font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-(--lp-ink) sm:text-[2.25rem]">My tests</h1>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-(--lp-muted) sm:text-[15px]">Your test series and how far you've got in each.</p>
          </div>
          <button
            type="button"
            onClick={() => navigate("/student/test-series")}
            className={`group inline-flex items-center justify-center gap-2 rounded-full bg-(--lp-ink) px-5 py-2.5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-(--lp-blue-deep) md:shrink-0 ${FOCUS}`}
          >
            Find more
            <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        </header>
      </Rise>

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
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((s, i) => (
            <Rise key={s.id} delay={Math.min(i, 8) * 50} className="h-full">
              <MySeriesCard s={s} index={i} onOpen={() => navigate(`/student/my-tests/${s.id}`)} />
            </Rise>
          ))}
        </div>
      )}
    </div>
  );
}
