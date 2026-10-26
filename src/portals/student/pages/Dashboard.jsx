// Student dashboard (student_dashboard): continue where you left off,
// enrolled test series, recent history, stats and recommended series.
//
// Presentation-only redesign: every value, handler, route and API call is the
// same as before — only the markup/classes changed. Cards are local to this
// page so the shared ColorBlockCard / ListRow / SeriesCard stay untouched for
// the other screens that use them.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { rotationClassFor } from "../../../components/ui/ColorBlockCard";
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
import PageHero from "../components/PageHero";
import StatBlock, { STAT_BLOCK_LABEL, STAT_BLOCK_VALUE_COMPACT } from "../components/StatBlock";
import { ErrorState, LoadingState, PAGE } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { attemptStatus, formatClock, formatMinutes, formatPercent, formatScore, formatSeconds, formatDate } from "../utils/format";
import { attemptTarget } from "./History";

// ---------------------------------------------------------------- layout bits

function Section({ title, action, children }) {
  return (
    <section className="space-y-5">
      <div className="flex items-center gap-4">
        <h2 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">{title}</h2>
        <span className="hidden h-px flex-1 bg-text/10 sm:block" aria-hidden="true" />
        <span className="ml-auto sm:ml-0">{action}</span>
      </div>
      {children}
    </section>
  );
}

function PillLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-semibold text-primary shadow-[0_1px_2px_rgb(15_17_21/0.05)] ring-1 ring-(--lp-line) transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-(--lp-blue-tint) hover:shadow-[0_8px_20px_rgb(37_87_214/0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {children}
      <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
    </button>
  );
}

function Empty({ children, icon: Icon = BookOpenIcon }) {
  return (
    <div className="flex items-center gap-4 rounded-3xl border border-dashed border-(--lp-line) bg-white/70 px-6 py-7">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-(--lp-blue-tint) text-primary" aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <p className="text-sm text-text/60">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------- stats

// ---------------------------------------------------------------- series card

// Text-free decorative cover that sits on the rotation colour block.
function CoverArt() {
  return (
    <svg className="absolute inset-0 h-full w-full text-white" viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
      <circle cx="270" cy="30" r="86" fill="currentColor" fillOpacity="0.16" />
      <circle cx="270" cy="30" r="52" fill="currentColor" fillOpacity="0.18" />
      <circle cx="40" cy="170" r="70" fill="currentColor" fillOpacity="0.14" />
      <circle cx="210" cy="150" r="7" fill="currentColor" fillOpacity="0.7" />
      <circle cx="238" cy="132" r="3.5" fill="currentColor" fillOpacity="0.55" />
      <path d="M0 140c60-26 110 22 180-6s100-30 140-8" stroke="currentColor" strokeOpacity="0.35" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function DashSeriesCard({ series, index = 0, progress, onOpen, onResume, actionLabel, onAction }) {
  const meta = [
    `${series.tests_count ?? 0} ${series.tests_count === 1 ? "test" : "tests"}`,
    series.total_duration_mins ? formatMinutes(series.total_duration_mins) : null,
    series.level,
  ].filter(Boolean).join(" · ");
  const badge = series.exam || series.subject || undefined;
  const hasProgress = typeof progress === "number";
  const pct = Math.min(Math.max(progress || 0, 0), 100);
  const price = series.is_free ? 0 : Number(series.price_inr);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") onOpen(e); }}
      className="group flex w-full cursor-pointer flex-col overflow-hidden rounded-3xl bg-white ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-1 hover:shadow-[0_18px_40px_rgb(15_17_21/0.12)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className={`relative aspect-[2/1] w-full overflow-hidden ${rotationClassFor(index)}`}>
        <CoverArt />
        {badge && (
          <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-primary shadow-sm">
            {badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-5">
        <h3 className="line-clamp-2 min-h-[2.75rem] font-display text-lg font-bold leading-snug tracking-tight text-text">{series.title}</h3>
        {series.subject && <p className="line-clamp-1 text-sm font-medium text-text/70">{series.subject}</p>}
        {meta && (
          <p className="flex items-center gap-1.5 text-xs text-(--lp-muted)">
            <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{meta}</span>
          </p>
        )}
        {series.description && <p className="line-clamp-2 text-xs leading-relaxed text-text/55">{series.description}</p>}

        <div className="mt-auto pt-4">
          {hasProgress ? (
            <div className="flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-(--lp-grey)"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <div className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onResume?.(); }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--lp-ink) px-4 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
              >
                Open
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="font-display text-lg font-bold text-text">{price === 0 ? "Free" : `₹${price}`}</span>
              {actionLabel && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onAction?.(); }}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary px-5 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-(--lp-blue-deep)/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
                >
                  {actionLabel}
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
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
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-3xl bg-white p-4 text-left ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgb(15_17_21/0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5"
    >
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-(--lp-yellow) text-(--lp-ink)" aria-hidden="true">
        <PlayIcon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-text">{attempt.test_title}</p>
        <p className="truncate text-sm text-(--lp-muted)">{`${attempt.series_title ?? ""} · ${attempt.answered} of ${attempt.questions_count} answered`}</p>
        <div className="mt-2.5 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-(--lp-grey)" aria-hidden="true">
          <div className="h-full rounded-full bg-(--lp-blue)" style={{ width: `${done}%` }} />
        </div>
      </div>
      <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-(--lp-grey) px-3 py-1.5 text-xs font-semibold text-text/70 sm:inline-flex">
        <ClockIcon className="h-3.5 w-3.5" aria-hidden="true" />
        {left !== null ? `${formatClock(left)} left` : "Untimed"}
      </span>
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white transition-transform duration-200 ease-out group-hover:translate-x-0.5">
        Resume
        <ChevronRightIcon className="h-3.5 w-3.5" />
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
  // Same three values as before (score, percentage, time taken), now shown as labelled figures.
  const figures = finished
    ? [
        { label: "Score", value: formatScore(item.score, item.max_score) },
        { label: "Percentage", value: formatPercent(item.percentage, 1) },
        ...(item.time_taken_secs ? [{ label: "Time taken", value: formatSeconds(item.time_taken_secs) }] : []),
      ]
    : null;
  const pct = Math.min(Math.max(Number(item.percentage) || 0, 0), 100);
  const iconTone = passed ? "bg-success/15 text-success" : finished ? "bg-(--lp-blue-soft) text-primary" : "bg-(--lp-grey) text-(--lp-muted)";
  const Icon = passed ? CheckIcon : finished ? FileTextIcon : ClockIcon;
  const Wrapper = target ? "button" : "div";
  return (
    <Wrapper
      type={target ? "button" : undefined}
      onClick={target ? () => onOpen(target) : undefined}
      className={`group flex w-full items-center gap-4 rounded-3xl bg-white p-4 text-left ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-200 ease-out sm:px-5 ${
        target ? "cursor-pointer hover:-translate-y-0.5 hover:shadow-[0_14px_32px_rgb(15_17_21/0.1)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" : ""
      }`}
    >
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${iconTone}`} aria-hidden="true">
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-base font-bold text-text">{item.test_title}</p>
        <p className="truncate text-sm text-(--lp-muted)">{subtitle}</p>
      </div>
      {figures && (
        <div className="hidden shrink-0 flex-col items-end gap-2 md:flex">
          <dl className="flex items-start gap-5">
            {figures.map((f) => (
              <div key={f.label} className="flex flex-col items-end gap-0.5">
                <dd className="text-sm font-bold leading-none text-text">{f.value}</dd>
                <dt className="text-[10px] font-semibold uppercase tracking-[0.12em] text-(--lp-muted)">{f.label}</dt>
              </div>
            ))}
          </dl>
          <span className="h-1.5 w-full overflow-hidden rounded-full bg-(--lp-grey)" aria-hidden="true">
            <span className={`block h-full rounded-full ${passed ? "bg-success" : "bg-(--lp-blue)"}`} style={{ width: `${pct}%` }} />
          </span>
        </div>
      )}
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

  if (loading) return <div className={PAGE}><LoadingState label="Loading your dashboard" rows={4} /></div>;
  if (error) return <div className={PAGE}><ErrorState error={error} onRetry={reload} title="Couldn't load your dashboard" /></div>;

  const { continue_learning: resume, enrolled_series: enrolled, recent_history: recent, stats, recommended_series: recommended } = data;

  return (
    <div className={`${PAGE} space-y-8 pb-10`}>
      <PageHero
        theme="yellow"
        art="study"
        compact
        eyebrow="Dashboard"
        title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
        subtitle="Pick up a test, check your latest report, or find a new series."
      />

      <Section title="Continue where you left off">
        {resume.length === 0 ? (
          <Empty icon={PlayIcon}>No test in progress. Start one from your series below.</Empty>
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

      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5" aria-label="Your stats">
        <StatBlock compact icon={FileTextIcon} tone="blue">
          <StatCard value={stats.tests_taken ?? 0} label="Tests taken" valueClassName={STAT_BLOCK_VALUE_COMPACT} labelClassName={STAT_BLOCK_LABEL} className="gap-1.5" />
        </StatBlock>
        <StatBlock compact icon={AwardIcon} tone="yellow">
          <StatCard value={stats.tests_passed ?? 0} label="Passed" valueClassName={STAT_BLOCK_VALUE_COMPACT} labelClassName={STAT_BLOCK_LABEL} className="gap-1.5" />
        </StatBlock>
        <StatBlock compact icon={TargetIcon} tone="sky">
          <StatCard value={formatPercent(stats.average_percentage, 1)} label="Average" valueClassName={STAT_BLOCK_VALUE_COMPACT} labelClassName={STAT_BLOCK_LABEL} className="gap-1.5" />
        </StatBlock>
        <StatBlock compact icon={FlameIcon} tone="ink">
          <StatCard value={stats.current_streak ?? 0} suffix={stats.current_streak === 1 ? " day" : " days"} label="Streak" valueClassName={STAT_BLOCK_VALUE_COMPACT} labelClassName={STAT_BLOCK_LABEL} className="gap-1.5" />
        </StatBlock>
        <StatBlock compact icon={BookOpenIcon} tone="peach">
          <StatCard value={stats.series_enrolled ?? 0} label="Series" valueClassName={STAT_BLOCK_VALUE_COMPACT} labelClassName={STAT_BLOCK_LABEL} className="gap-1.5" />
        </StatBlock>
      </section>

      <Section
        title="Your test series"
        action={enrolled.length > 0 && <PillLink onClick={() => navigate("/student/my-tests")}>See all</PillLink>}
      >
        {enrolled.length === 0 ? (
          <Empty>You haven't enrolled in a test series yet. Recommended series are below.</Empty>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {enrolled.map((s, i) => (
              <DashSeriesCard key={s.id} series={s} index={i} progress={Number(s.progress_percentage) || 0}
                onResume={() => navigate(`/student/my-tests/${s.id}`)} onOpen={() => navigate(`/student/my-tests/${s.id}`)} />
            ))}
          </div>
        )}
      </Section>

      <Section
        title="Recent results"
        action={recent.length > 0 && <PillLink onClick={() => navigate("/student/history")}>Full history</PillLink>}
      >
        {recent.length === 0 ? (
          <Empty icon={FileTextIcon}>Your results appear here after your first test.</Empty>
        ) : (
          <ul className="space-y-3">
            {recent.map((item) => (
              <li key={item.attempt_id}><ResultRow item={item} onOpen={navigate} /></li>
            ))}
          </ul>
        )}
      </Section>

      {recommended.length > 0 && (
        <Section
          title="Recommended for you"
          action={<PillLink onClick={() => navigate("/student/test-series")}>Browse all</PillLink>}
        >
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {recommended.map((s, i) => (
              <DashSeriesCard key={s.id} series={s} index={i} actionLabel="View" onAction={() => navigate(`/student/dashboard/series/${s.id}`)}
                onOpen={() => navigate(`/student/dashboard/series/${s.id}`)} />
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
