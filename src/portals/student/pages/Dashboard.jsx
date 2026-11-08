// Student dashboard (student_dashboard): continue where you left off,
// enrolled test series, recent history, stats and recommended series.
//
// Presentation-only redesign: a calm, professional "learning platform" layout —
// neutral white surfaces with hairline borders, one blue accent, a single stats
// strip, a two-column body (main work on the left, discovery rail on the right)
// and no decorative illustration. Every value, handler, route and API call is
// the same as before — only markup and classes changed. Cards are local to this
// page so the shared ColorBlockCard / ListRow / SeriesCard / PageHero / StatBlock
// stay untouched for other screens.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import StatCard from "../../../components/ui/StatCard";
import StatusBadge from "../../../components/ui/StatusBadge";
import {
  AwardIcon,
  BookOpenIcon,
  CheckIcon,
  ChevronRightIcon,
  ClockIcon,
  FileTextIcon,
  FlameIcon,
  PlayIcon,
  TargetIcon,
} from "../../../components/ui/icons";
import { useAuth } from "../../../hooks/useAuth";
import { MOTION_CSS as DASH_CSS, Rise } from "../components/StudentKit";
import { ErrorState, LoadingState } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { attemptStatus, formatClock, formatMinutes, formatPercent, formatScore, formatSeconds, formatDate } from "../utils/format";
import { attemptTarget } from "./History";

// ---------------------------------------------------------------- shared bits

const DASH_PAGE = "mx-auto w-full max-w-7xl space-y-6 px-4 py-4 sm:space-y-8 sm:px-6 sm:py-6 lg:px-8";

// The one surface used everywhere: white, hairline border, 16px radius, almost no shadow.
const SURFACE = "rounded-2xl bg-white ring-1 ring-(--lp-line) shadow-[0_1px_2px_rgb(15_17_21/0.04)]";

const FOCUS = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-blue-deep)";

// Icon tiles on series cards cycle through the same three quiet tints, in a fixed order.
const TINTS = [
  "bg-(--lp-blue-soft) text-(--lp-blue-deep)",
  "bg-(--lp-yellow-soft) text-(--lp-ink)",
  "bg-(--lp-grey) text-(--lp-ink)",
];
const tintFor = (index) => TINTS[index % TINTS.length];

function Section({ title, subtitle, action, delay = 0, children }) {
  return (
    <Rise delay={delay}>
      <section className="space-y-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0">
            <h2 className="font-display text-lg font-semibold tracking-tight text-(--lp-ink) sm:text-xl">{title}</h2>
            {subtitle && <p className="mt-0.5 text-sm text-(--lp-muted)">{subtitle}</p>}
          </div>
          {action && <span className="shrink-0">{action}</span>}
        </div>
        {children}
      </section>
    </Rise>
  );
}

function TextLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center gap-1 rounded-md py-1 text-sm font-semibold text-(--lp-blue-deep) transition-colors duration-150 hover:text-(--lp-ink) ${FOCUS}`}
    >
      {children}
      <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

function Empty({ children, icon: Icon = BookOpenIcon, ctaLabel, onCta }) {
  return (
    <div className={`${SURFACE} flex flex-col items-start gap-4 p-5 sm:flex-row sm:items-center sm:p-6`}>
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-(--lp-blue-soft) text-(--lp-blue-deep)" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <p className="flex-1 text-sm leading-relaxed text-(--lp-muted)">{children}</p>
      {ctaLabel && (
        <button
          type="button"
          onClick={onCta}
          className={`inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--lp-ink) px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 hover:bg-(--lp-blue-deep) ${FOCUS}`}
        >
          {ctaLabel}
          <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- header + stats

function Stat({ icon: Icon, value, suffix, label, className = "" }) {
  return (
    <div className={`flex items-center gap-3.5 bg-white p-4 sm:p-5 ${className}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-(--lp-blue-tint) text-(--lp-blue-deep)" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <StatCard
        value={value}
        suffix={suffix}
        label={label}
        className="min-w-0 gap-0.5"
        valueClassName="font-display text-2xl font-semibold leading-none tabular-nums tracking-tight text-(--lp-ink)"
        labelClassName="truncate text-xs font-medium text-(--lp-muted)"
      />
    </div>
  );
}

function ActionButton({ onClick, primary = false, children }) {
  const look = primary
    ? "bg-(--lp-ink) text-white hover:bg-(--lp-blue-deep)"
    : "bg-white text-(--lp-ink) ring-1 ring-(--lp-line) hover:bg-(--lp-grey)";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-colors duration-200 sm:flex-none ${look} ${FOCUS}`}
    >
      {children}
      <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" aria-hidden="true" />
    </button>
  );
}

function DashHeader({ firstName, stats, navigate }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", day: "numeric", month: "long" });
  const tiles = [
    { label: "Tests taken", icon: FileTextIcon, value: stats.tests_taken ?? 0 },
    { label: "Passed", icon: AwardIcon, value: stats.tests_passed ?? 0 },
    { label: "Average score", icon: TargetIcon, value: formatPercent(stats.average_percentage, 1) },
    { label: "Current streak", icon: FlameIcon, value: stats.current_streak ?? 0, suffix: stats.current_streak === 1 ? " day" : " days" },
    { label: "Series enrolled", icon: BookOpenIcon, value: stats.series_enrolled ?? 0 },
  ];

  return (
    <header className={`${SURFACE} overflow-hidden`}>
      <div className="flex flex-col gap-5 p-5 sm:p-8 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--lp-muted)">{today}</p>
          <h1 className="mt-2 break-words font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-(--lp-ink) sm:text-[2.25rem]">
            Welcome back{firstName ? `, ${firstName}` : ""}
          </h1>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-(--lp-muted) sm:text-[15px]">Pick up a test, check your latest report, or find a new series.</p>
        </div>
        <div className="flex gap-3 md:shrink-0">
          <ActionButton primary onClick={() => navigate("/student/test-series")}>Browse test series</ActionButton>
          <ActionButton onClick={() => navigate("/student/history")}>View history</ActionButton>
        </div>
      </div>

      <section
        className="grid grid-cols-2 gap-px border-t border-(--lp-line) bg-(--lp-line) md:grid-cols-5"
        aria-label="Your stats"
      >
        {tiles.map((t) => (
          <Stat key={t.label} icon={t.icon} value={t.value} suffix={t.suffix} label={t.label} className="max-md:last:col-span-2" />
        ))}
      </section>
    </header>
  );
}

// ---------------------------------------------------------------- series cards

// Enrolled series: tinted icon tile, exam label, title, meta and a progress bar.
function DashSeriesCard({ series, index = 0, progress, onOpen, onResume }) {
  const meta = [
    `${series.tests_count ?? 0} ${series.tests_count === 1 ? "test" : "tests"}`,
    series.total_duration_mins ? formatMinutes(series.total_duration_mins) : null,
    series.level,
  ].filter(Boolean).join(" · ");
  const badge = series.exam || series.subject || undefined;
  const pct = Math.min(Math.max(progress || 0, 0), 100);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(e); }}
      className={`group flex h-full w-full cursor-pointer flex-col p-5 ${SURFACE} transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(15_17_21/0.28)] ${FOCUS}`}
    >
      <div className="flex items-start gap-3.5">
        <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tintFor(index)}`} aria-hidden="true">
          <BookOpenIcon className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          {badge && <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)">{badge}</p>}
          <h3 className="mt-0.5 line-clamp-2 font-display text-base font-semibold leading-snug tracking-tight text-(--lp-ink)">{series.title}</h3>
        </div>
      </div>

      <div className="mt-4 space-y-1.5">
        {series.subject && <p className="line-clamp-1 text-sm font-medium text-text/75">{series.subject}</p>}
        {meta && (
          <p className="flex items-center gap-1.5 text-xs text-(--lp-muted)">
            <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{meta}</span>
          </p>
        )}
      </div>

      <div className="mt-auto pt-5">
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
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onResume?.(); }}
          className={`mt-4 inline-flex w-full items-center justify-center gap-1.5 rounded-full bg-(--lp-grey) px-4 py-2.5 text-[13px] font-semibold text-(--lp-ink) transition-colors duration-200 group-hover:bg-(--lp-ink) group-hover:text-white ${FOCUS}`}
        >
          Open
          <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// Recommended series: compact row for the right-hand rail.
function RecommendedItem({ series, index = 0, actionLabel, onOpen, onAction }) {
  const meta = [
    `${series.tests_count ?? 0} ${series.tests_count === 1 ? "test" : "tests"}`,
    series.total_duration_mins ? formatMinutes(series.total_duration_mins) : null,
    series.level,
  ].filter(Boolean).join(" · ");
  const badge = series.exam || series.subject || undefined;
  const price = series.is_free ? 0 : Number(series.price_inr);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(e); }}
      className={`group flex cursor-pointer items-start gap-3.5 px-4 py-4 transition-colors duration-150 hover:bg-(--lp-grey)/70 sm:px-5 ${FOCUS} focus-visible:-outline-offset-2`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tintFor(index)}`} aria-hidden="true">
        <BookOpenIcon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        {badge && <p className="truncate text-[10px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)">{badge}</p>}
        <h3 className="line-clamp-2 text-sm font-semibold leading-snug text-(--lp-ink)">{series.title}</h3>
        {series.subject && <p className="mt-0.5 line-clamp-1 text-xs font-medium text-text/70">{series.subject}</p>}
        {meta && (
          <p className="mt-1 flex items-center gap-1.5 text-xs text-(--lp-muted)">
            <ClockIcon className="h-3 w-3 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{meta}</span>
          </p>
        )}
        <div className="mt-2.5 flex items-center justify-between gap-3">
          <span className="font-display text-sm font-semibold text-(--lp-ink)">{price === 0 ? "Free" : `₹${price}`}</span>
          {actionLabel && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onAction?.(); }}
              className={`inline-flex items-center gap-1 rounded-full bg-(--lp-ink) px-3.5 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-(--lp-blue-deep) ${FOCUS}`}
            >
              {actionLabel}
              <ChevronRightIcon className="h-3 w-3" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- rows

function ResumeRow({ attempt, openedAt, onOpen }) {
  const left = attempt.deadline ? Math.max(0, (new Date(attempt.deadline).getTime() - openedAt) / 1000) : null;
  const total = Number(attempt.questions_count) || 0;
  const done = total > 0 ? Math.min(100, Math.max(0, (Number(attempt.answered) / total) * 100)) : 0;
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group flex w-full flex-wrap items-center gap-x-4 gap-y-3 p-4 text-left sm:flex-nowrap sm:p-5 ${SURFACE} transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_30px_-18px_rgb(15_17_21/0.28)] ${FOCUS}`}
    >
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-(--lp-blue-soft) text-(--lp-blue-deep)" aria-hidden="true">
        <PlayIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-[15px] font-semibold text-(--lp-ink)">{attempt.test_title}</p>
        <p className="truncate text-sm text-(--lp-muted)">{`${attempt.series_title ?? ""} · ${attempt.answered} of ${attempt.questions_count} answered`}</p>
        <div className="mt-3 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-(--lp-grey)" aria-hidden="true">
          <div className="h-full rounded-full bg-(--lp-blue-deep)" style={{ width: `${done}%` }} />
        </div>
      </div>
      <span className="inline-flex shrink-0 items-center gap-1.5 text-xs font-medium text-(--lp-muted)">
        <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {left !== null ? `${formatClock(left)} left` : "Untimed"}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--lp-blue-deep) px-4 py-2 text-[13px] font-semibold text-white transition-colors duration-200 group-hover:bg-(--lp-ink)">
        Resume
        <ChevronRightIcon className="h-3.5 w-3.5" aria-hidden="true" />
      </span>
    </button>
  );
}

function ResultRow({ item, onOpen }) {
  const status = attemptStatus(item);
  const target = attemptTarget(item);
  const finished = item.status === "submitted" || item.status === "timed_out";
  const passed = finished && item.passed;
  const subtitle = [item.series_title, `Attempt ${item.attempt_number}`, formatDate(item.submitted_at || item.started_at, true)].filter(Boolean).join(" · ");
  // Same three values as before (score, percentage, time taken), shown as aligned labelled figures.
  const figures = finished
    ? [
        { label: "Score", value: formatScore(item.score, item.max_score) },
        { label: "Percentage", value: formatPercent(item.percentage, 1) },
        ...(item.time_taken_secs ? [{ label: "Time taken", value: formatSeconds(item.time_taken_secs) }] : []),
      ]
    : null;
  const iconTone = passed ? "bg-success/15 text-success" : finished ? "bg-(--lp-blue-soft) text-(--lp-blue-deep)" : "bg-(--lp-grey) text-(--lp-muted)";
  const Icon = passed ? CheckIcon : finished ? FileTextIcon : ClockIcon;
  const Wrapper = target ? "button" : "div";
  return (
    <Wrapper
      type={target ? "button" : undefined}
      onClick={target ? () => onOpen(target) : undefined}
      className={`group flex w-full items-center gap-4 px-4 py-4 text-left sm:px-5 ${
        target ? `cursor-pointer transition-colors duration-150 hover:bg-(--lp-grey)/70 ${FOCUS} focus-visible:-outline-offset-2` : ""
      }`}
    >
      <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${iconTone}`} aria-hidden="true">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-semibold text-(--lp-ink)">{item.test_title}</p>
        <p className="truncate text-sm text-(--lp-muted)">{subtitle}</p>
      </div>
      <div className="hidden w-[16.5rem] shrink-0 md:block">
        {figures && (
          <dl className="grid grid-cols-3 gap-3 text-right">
            {figures.map((f) => (
              <div key={f.label} className="flex flex-col gap-1">
                <dd className="text-sm font-semibold tabular-nums leading-none text-(--lp-ink)">{f.value}</dd>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.1em] text-(--lp-muted)">{f.label}</dt>
              </div>
            ))}
          </dl>
        )}
      </div>
      <span className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        {passed && <StatusBadge status="success">Passed</StatusBadge>}
        <StatusBadge status={status.tone}>{status.label}</StatusBadge>
      </span>
      {target && <ChevronRightIcon className="hidden h-4 w-4 shrink-0 text-text/30 transition-transform duration-200 ease-out group-hover:translate-x-0.5 sm:block" aria-hidden="true" />}
    </Wrapper>
  );
}

// ---------------------------------------------------------------- page

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data, error, loading, reload } = useStudentData(() => studentSeriesApi.dashboard(), "dashboard");
  const firstName = (user?.name || "").split(" ")[0];
  const [openedAt] = useState(() => Date.now());   // "time left" is a snapshot; the runner has the live timer

  if (loading) {
    // Header-shaped placeholder so the page doesn't jump when the data arrives.
    return (
      <div className={DASH_PAGE}>
        <div className={`${SURFACE} h-[17rem] animate-pulse sm:h-[15rem]`} aria-hidden="true" />
        <LoadingState label="Loading your dashboard" rows={3} />
      </div>
    );
  }
  if (error) return <div className={DASH_PAGE}><ErrorState error={error} onRetry={reload} title="Couldn't load your dashboard" /></div>;

  const { continue_learning: resume, enrolled_series: enrolled, recent_history: recent, stats, recommended_series: recommended } = data;
  const hasRail = recommended.length > 0;

  return (
    <div className={`${DASH_PAGE} pb-12`}>
      <style>{DASH_CSS}</style>

      <Rise>
        <DashHeader firstName={firstName} stats={stats} navigate={navigate} />
      </Rise>

      <div className={`grid gap-8 ${hasRail ? "lg:grid-cols-[minmax(0,1fr)_21.5rem] lg:items-start" : ""}`}>
        <div className="min-w-0 space-y-8">
          <Section title="Continue where you left off" subtitle="Pick up an unfinished attempt exactly where you stopped.">
            {resume.length === 0 ? (
              <Empty icon={PlayIcon} ctaLabel="Browse test series" onCta={() => navigate("/student/test-series")}>
                No test in progress. Start one from your series below.
              </Empty>
            ) : (
              <ul className="space-y-3">
                {resume.map((a) => (
                  <li key={a.attempt_id}>
                    <ResumeRow attempt={a} openedAt={openedAt} onOpen={() => navigate(`/student/test/${a.test_id}/take`)} />
                  </li>
                ))}
              </ul>
            )}
          </Section>

          <Section
            title="Your test series"
            subtitle="Series you are enrolled in and how far along you are."
            action={enrolled.length > 0 && <TextLink onClick={() => navigate("/student/my-tests")}>See all</TextLink>}
          >
            {enrolled.length === 0 ? (
              <Empty ctaLabel="Browse test series" onCta={() => navigate("/student/test-series")}>
                You haven't enrolled in a test series yet. Recommended series are alongside.
              </Empty>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 sm:gap-5">
                {enrolled.map((s, i) => (
                  <Rise key={s.id} delay={i * 60} className="h-full">
                    <DashSeriesCard series={s} index={i} progress={Number(s.progress_percentage) || 0}
                      onResume={() => navigate(`/student/my-tests/${s.id}`)} onOpen={() => navigate(`/student/my-tests/${s.id}`)} />
                  </Rise>
                ))}
              </div>
            )}
          </Section>

          <Section
            title="Recent results"
            subtitle="Your latest attempts and how you scored."
            action={recent.length > 0 && <TextLink onClick={() => navigate("/student/history")}>Full history</TextLink>}
          >
            {recent.length === 0 ? (
              <Empty icon={FileTextIcon}>Your results appear here after your first test.</Empty>
            ) : (
              <ul className={`${SURFACE} divide-y divide-(--lp-line) overflow-hidden`}>
                {recent.map((item) => (
                  <li key={item.attempt_id}><ResultRow item={item} onOpen={navigate} /></li>
                ))}
              </ul>
            )}
          </Section>
        </div>

        {hasRail && (
          <aside className="min-w-0" aria-label="Recommended series">
            <Section
              title="Recommended for you"
              action={<TextLink onClick={() => navigate("/student/test-series")}>Browse all</TextLink>}
              delay={80}
            >
              <div className={`${SURFACE} divide-y divide-(--lp-line) overflow-hidden`}>
                {recommended.map((s, i) => (
                  <RecommendedItem key={s.id} series={s} index={i} actionLabel="View"
                    onAction={() => navigate(`/student/dashboard/series/${s.id}`)}
                    onOpen={() => navigate(`/student/dashboard/series/${s.id}`)} />
                ))}
              </div>
            </Section>
          </aside>
        )}
      </div>
    </div>
  );
}
