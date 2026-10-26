// Student dashboard (student_dashboard): continue where you left off,
// enrolled test series, recent history, stats and recommended series.
//
// Presentation-only redesign (landing-page look: dark ticket hero with the stats
// built in, flip-style tiles, richer series covers, scroll-in motion). Every
// value, handler, route and API call is the same as before — only markup and
// classes changed. Cards are local to this page so the shared ColorBlockCard /
// ListRow / SeriesCard / PageHero / StatBlock stay untouched for other screens.
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
import { HERO_ART } from "../components/HeroArt";
import { MOTION_CSS as DASH_CSS, Rise, Squiggle, glyphFor } from "../components/StudentKit";
import { ErrorState, LoadingState, PAGE } from "../components/PageState";
import { useStudentData } from "../hooks/useStudentData";
import { studentSeriesApi } from "../services/studentSeriesApi";
import { attemptStatus, formatClock, formatMinutes, formatPercent, formatScore, formatSeconds, formatDate } from "../utils/format";
import { attemptTarget } from "./History";

// ---------------------------------------------------------------- layout bits

function Section({ eyebrow, title, action, delay = 0, children }) {
  return (
    <Rise delay={delay}>
      <section className="space-y-5">
        <div className="flex items-end gap-4">
          <div className="min-w-0">
            {eyebrow && (
              <p className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-(--lp-blue-deep)">
                <span className="h-[3px] w-6 rounded-full bg-(--lp-yellow)" aria-hidden="true" />
                {eyebrow}
              </p>
            )}
            <h2 className="relative inline-block font-display text-2xl font-bold tracking-tight text-text sm:text-[1.75rem]">
              {title}
              <Squiggle className="absolute -bottom-2.5 left-0 h-2 w-full text-(--lp-blue)/70" />
            </h2>
          </div>
          <span className="mb-1 hidden h-px flex-1 bg-text/10 sm:block" aria-hidden="true" />
          <span className="ml-auto sm:ml-0">{action}</span>
        </div>
        {children}
      </section>
    </Rise>
  );
}

function PillLink({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="group inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_24px_-12px_rgb(15_17_21/0.6)] transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:bg-(--lp-blue-deep) hover:shadow-[0_14px_28px_-12px_rgb(37_87_214/0.55)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      {children}
      <span className="grid h-5 w-5 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink)">
        <ChevronRightIcon className="h-3 w-3 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
      </span>
    </button>
  );
}

function Empty({ children, icon: Icon = BookOpenIcon }) {
  return (
    <div className="relative flex items-center gap-4 overflow-hidden rounded-[1.75rem] border-2 border-dashed border-(--lp-line) bg-white/80 px-6 py-7">
      <span
        className="pointer-events-none absolute inset-0 opacity-60"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(rgba(37,87,214,0.13) 1px, transparent 1.3px)",
          backgroundSize: "22px 22px",
          maskImage: "linear-gradient(to right, black, transparent 70%)",
          WebkitMaskImage: "linear-gradient(to right, black, transparent 70%)",
        }}
      />
      <span className="relative grid h-12 w-12 shrink-0 place-items-center" aria-hidden="true">
        <span className="absolute inset-0 rounded-2xl bg-(--lp-yellow)/60 motion-safe:animate-ping [animation-duration:2.6s]" />
        <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-(--lp-yellow) text-(--lp-ink)">
          <Icon className="h-5 w-5" />
        </span>
      </span>
      <p className="relative text-sm font-medium text-text/65">{children}</p>
    </div>
  );
}

// ---------------------------------------------------------------- hero + stats

// A stat as a flip-clock tile (same look as the landing countdown): hinge line,
// side pins, lighter top half. The number still counts up through StatCard.
function FlipTile({ icon: Icon, value, suffix, label, tone, className = "" }) {
  return (
    <div className={className}>
      <div className={`group relative overflow-hidden rounded-xl transition-transform duration-300 ease-out hover:-translate-y-0.5 ${tone}`}>
        <Icon className="pointer-events-none absolute -right-1.5 -top-1.5 h-10 w-10 opacity-[0.13] transition-transform duration-500 ease-out group-hover:-rotate-6 group-hover:scale-110" aria-hidden="true" />
        <div className="relative z-10 grid place-items-center px-2 py-2.5 sm:py-4">
          <StatCard
            value={value}
            suffix={suffix}
            label=""
            className="items-center gap-0"
            valueClassName="font-display text-xl font-extrabold leading-none tabular-nums tracking-tight sm:text-[1.75rem]"
            labelClassName="hidden"
          />
        </div>
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/[0.10]" aria-hidden="true" />
        <span className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/30" aria-hidden="true" />
        <span className="pointer-events-none absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-(--lp-ink)" aria-hidden="true" />
        <span className="pointer-events-none absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-(--lp-ink)" aria-hidden="true" />
      </div>
      <p className="mt-1 text-center text-[9px] font-semibold uppercase tracking-[0.12em] text-white/60 sm:mt-2 sm:text-[10px] sm:tracking-[0.16em]">{label}</p>
    </div>
  );
}

function HeroButton({ onClick, tone = "yellow", children }) {
  const look =
    tone === "yellow"
      ? "bg-(--lp-yellow) text-(--lp-ink) hover:shadow-[0_14px_30px_-10px_rgb(255_216_77/0.6)]"
      : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/15";
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group inline-flex items-center justify-center gap-1.5 rounded-full px-3 py-2.5 text-[13px] font-semibold transition-[transform,box-shadow,background-color] sm:justify-start sm:gap-2 sm:px-4 sm:text-sm duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-yellow) ${look}`}
    >
      {children}
      <ChevronRightIcon className="h-4 w-4 transition-transform duration-200 ease-out group-hover:translate-x-0.5" />
    </button>
  );
}

function DashHero({ firstName, stats, navigate }) {
  const Art = HERO_ART.study;
  const tiles = [
    { label: "Tests taken", icon: FileTextIcon, value: stats.tests_taken ?? 0, tone: "bg-(--lp-yellow) text-(--lp-ink) shadow-[0_0_60px_-12px_rgba(255,216,77,0.5)]" },
    { label: "Passed", icon: AwardIcon, value: stats.tests_passed ?? 0, tone: "bg-(--lp-ink-soft) text-white ring-1 ring-white/10" },
    { label: "Average", icon: TargetIcon, value: formatPercent(stats.average_percentage, 1), tone: "bg-(--lp-blue) text-white" },
    { label: "Streak", icon: FlameIcon, value: stats.current_streak ?? 0, suffix: stats.current_streak === 1 ? " day" : " days", tone: "bg-(--lp-ink-soft) text-white ring-1 ring-white/10" },
    { label: "Series", icon: BookOpenIcon, value: stats.series_enrolled ?? 0, tone: "bg-white text-(--lp-ink)" },
  ];

  return (
    <header className="relative isolate overflow-hidden rounded-[1.5rem] bg-(--lp-ink) sm:rounded-[2rem] text-white shadow-[0_30px_60px_-30px_rgb(15_17_21/0.55)]">
      {/* atmosphere: rings, blue disc, dotted grid, soft glow */}
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-32 -top-32 h-[26rem] w-[26rem] rounded-full border border-white/10" />
        <div className="absolute -right-16 -top-16 h-[18rem] w-[18rem] rounded-full border border-white/10" />
        <div className="ul-dash-drift absolute -right-6 -top-6 h-24 w-24 rounded-full sm:h-[9rem] sm:w-[9rem] bg-(--lp-blue)/80" style={{ "--dx": "-10px", "--dy": "12px", "--dur": "28s" }} />
        <div className="absolute -bottom-32 left-[28%] h-72 w-72 rounded-full bg-(--lp-blue)/20" />
        <div className="ul-dash-drift absolute -left-20 top-1/4 h-64 w-64 rounded-full bg-(--lp-yellow)/[0.09] blur-3xl" style={{ "--dx": "30px", "--dy": "20px", "--dur": "32s" }} />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1.2px)",
            backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to right, black, transparent 60%)",
            WebkitMaskImage: "linear-gradient(to right, black, transparent 60%)",
          }}
        />
        <span className="ul-dash-drift absolute left-[44%] top-[14%] max-sm:hidden font-display text-5xl font-bold italic text-white/[0.07]" style={{ "--r": "-6deg", "--dur": "26s" }}>E = mc²</span>
        <span className="ul-dash-drift absolute bottom-[40%] right-[40%] max-sm:hidden font-display text-6xl font-bold text-(--lp-yellow)/[0.12]" style={{ "--r": "8deg", "--dur": "30s", "--delay": "-9s" }}>π</span>
      </div>

      <div className="relative px-5 pb-5 pt-6 max-sm:px-4 max-sm:pb-4 max-sm:pt-5 sm:px-8 sm:pt-7">
        <div className="grid items-center gap-4 sm:gap-6 lg:grid-cols-[1.3fr_0.7fr]">
          <div>
            <h1 className="break-words font-display text-[1.75rem] font-bold leading-[1.1] tracking-tight sm:text-4xl lg:text-[2.6rem]">
              Welcome back
              {firstName && (
                <>
                  ,{" "}
                  <span className="relative inline-block text-(--lp-yellow)">
                    {firstName}
                    <Squiggle className="absolute -bottom-2 left-0 h-2 w-full text-(--lp-blue)" />
                  </span>
                </>
              )}
            </h1>
            <p className="mt-2.5 max-w-md text-[13px] leading-relaxed text-white/70 sm:mt-3 sm:text-[15px]">Pick up a test, check your latest report, or find a new series.</p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:mt-5 sm:flex sm:flex-wrap sm:gap-2.5">
              <HeroButton onClick={() => navigate("/student/test-series")}><span className="sm:hidden">Browse series</span><span className="hidden sm:inline">Browse test series</span></HeroButton>
              <HeroButton tone="ghost" onClick={() => navigate("/student/history")}>View history</HeroButton>
            </div>
          </div>

          {Art && (
            <div className="pointer-events-none relative hidden lg:block" aria-hidden="true">
              <div className="ml-auto max-w-[250px] rotate-2">
                <div className="ul-dash-float rounded-3xl bg-(--lp-yellow) p-2.5 shadow-[0_24px_44px_-22px_rgb(0_0_0/0.7)] ring-4 ring-white/10">
                  <Art className="h-auto w-full" />
                </div>
              </div>
              <span className="ul-dash-drift absolute -left-2 top-4 h-3 w-3 rounded-full bg-(--lp-yellow)" style={{ "--dx": "8px", "--dy": "14px", "--dur": "19s" }} />
              <span className="ul-dash-drift absolute bottom-6 -right-1 h-4 w-4 rounded-full ring-2 ring-(--lp-blue)" style={{ "--dx": "-8px", "--dy": "-12px", "--dur": "21s", "--delay": "-6s" }} />
            </div>
          )}
        </div>

        <div className="mt-4 border-t-2 border-dashed border-white/15 pt-3 sm:mt-5 sm:pt-4">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 sm:mb-2.5 sm:text-xs">Your progress</p>
          <section className="grid grid-cols-2 gap-2 sm:grid-cols-3 sm:gap-3 lg:grid-cols-5" aria-label="Your stats">
            {tiles.map((t) => (
              <FlipTile key={t.label} icon={t.icon} value={t.value} suffix={t.suffix} label={t.label} tone={t.tone} className="max-sm:last:col-span-2" />
            ))}
          </section>
        </div>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------- series card

// Decorative cover on the rotation colour block: dotted grid, soft discs, a wave
// and one big subject glyph that tilts on hover. No images, so nothing can 404.
function CoverArt({ glyph }) {
  return (
    <>
      <svg className="absolute inset-0 h-full w-full text-white" viewBox="0 0 320 160" preserveAspectRatio="xMidYMid slice" fill="none" aria-hidden="true">
        <defs>
          <pattern id="ul-cover-dots" width="16" height="16" patternUnits="userSpaceOnUse">
            <circle cx="2" cy="2" r="1.3" fill="currentColor" fillOpacity="0.28" />
          </pattern>
        </defs>
        <rect width="320" height="160" fill="url(#ul-cover-dots)" />
        <circle cx="272" cy="26" r="84" fill="currentColor" fillOpacity="0.15" />
        <circle cx="272" cy="26" r="50" fill="currentColor" fillOpacity="0.17" />
        <circle cx="34" cy="168" r="66" fill="currentColor" fillOpacity="0.14" />
        <path d="M0 128c60-26 110 22 180-6s100-30 140-8" stroke="currentColor" strokeOpacity="0.4" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <span
        className="pointer-events-none absolute -bottom-2 right-4 select-none font-display text-5xl font-extrabold sm:-bottom-3 sm:text-[5.5rem] italic leading-none tracking-tight text-(--lp-ink)/[0.14] transition-transform duration-500 ease-out group-hover:-translate-y-1.5 group-hover:-rotate-6"
        aria-hidden="true"
      >
        {glyph}
      </span>
    </>
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
      className="group flex h-full w-full cursor-pointer flex-col overflow-hidden rounded-[1.25rem] bg-white sm:rounded-[1.75rem] shadow-[0_1px_0_rgb(15_17_21/0.04),0_24px_40px_-30px_rgb(15_17_21/0.4)] ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1.5 hover:shadow-[0_28px_50px_-24px_rgb(15_17_21/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <div className={`relative h-16 w-full overflow-hidden sm:aspect-[2/1] sm:h-auto ${rotationClassFor(index)}`}>
        <CoverArt glyph={glyphFor(series, index)} />
        {badge && (
          <span className="absolute left-3 top-2.5 rounded-full bg-white px-2.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-primary sm:left-4 sm:top-4 sm:px-3 sm:py-1 sm:text-[10px] shadow-sm">
            {badge}
          </span>
        )}
        {hasProgress && (
          <span className="absolute right-3 top-2.5 rounded-full bg-(--lp-ink) px-2 py-0.5 text-[9px] sm:right-4 sm:top-4 sm:px-2.5 sm:py-1 sm:text-[10px] font-bold tabular-nums text-white shadow-sm">{Math.round(pct)}%</span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3.5 sm:gap-2 sm:p-5">
        <h3 className="line-clamp-2 font-display text-[15px] font-bold sm:min-h-[2.75rem] sm:text-lg leading-snug tracking-tight text-text">{series.title}</h3>
        {series.subject && <p className="line-clamp-1 text-[13px] font-medium text-text/70 sm:text-sm">{series.subject}</p>}
        {meta && (
          <p className="flex items-center gap-1.5 text-xs text-(--lp-muted)">
            <ClockIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{meta}</span>
          </p>
        )}
        {series.description && <p className="line-clamp-2 text-xs leading-relaxed text-text/55 max-sm:hidden">{series.description}</p>}

        <div className="mt-auto pt-2 sm:pt-4">
          {hasProgress ? (
            <div className="flex items-center gap-3">
              <div
                className="h-2 flex-1 overflow-hidden rounded-full bg-(--lp-grey)"
                role="progressbar"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={Math.round(pct)}
              >
                <div className="h-full rounded-full bg-(--lp-blue) transition-[width] duration-500 ease-out" style={{ width: `${pct}%` }} />
              </div>
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onResume?.(); }}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--lp-ink) px-3.5 py-1.5 text-xs font-semibold text-white transition-colors duration-200 hover:bg-(--lp-blue-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:px-4 sm:py-2"
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
                  className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-5 py-2 text-xs font-semibold text-white transition-colors duration-200 hover:bg-(--lp-blue-deep) focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
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
      className="group relative flex w-full items-center gap-4 overflow-hidden rounded-[1.75rem] bg-white p-4 text-left shadow-[0_24px_40px_-30px_rgb(15_17_21/0.4)] ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-300 ease-out hover:-translate-y-1 hover:shadow-[0_28px_50px_-24px_rgb(15_17_21/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary sm:p-5"
    >
      <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-(--lp-yellow)" aria-hidden="true" />
      <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-(--lp-yellow) text-(--lp-ink) transition-transform duration-300 ease-out group-hover:scale-105 group-hover:-rotate-3" aria-hidden="true">
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
      <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-(--lp-ink) px-4 py-2 text-xs font-semibold text-white transition-[transform,background-color] duration-200 ease-out group-hover:translate-x-0.5 group-hover:bg-(--lp-blue-deep)">
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
      className={`group flex w-full items-center gap-4 rounded-[1.75rem] bg-white p-4 text-left shadow-[0_20px_36px_-30px_rgb(15_17_21/0.4)] ring-1 ring-(--lp-line) transition-[transform,box-shadow] duration-300 ease-out sm:px-5 ${
        target ? "cursor-pointer hover:-translate-y-1 hover:shadow-[0_26px_44px_-26px_rgb(15_17_21/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary" : ""
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

  if (loading) {
    // Hero-shaped placeholder so the page doesn't jump when the data arrives.
    return (
      <div className={`${PAGE} space-y-8`}>
        <div className="h-[22rem] animate-pulse rounded-[2rem] bg-(--lp-ink)/90 sm:h-[20rem]" aria-hidden="true" />
        <LoadingState label="Loading your dashboard" rows={3} />
      </div>
    );
  }
  if (error) return <div className={PAGE}><ErrorState error={error} onRetry={reload} title="Couldn't load your dashboard" /></div>;

  const { continue_learning: resume, enrolled_series: enrolled, recent_history: recent, stats, recommended_series: recommended } = data;

  return (
    <div className={`${PAGE} space-y-8 pb-10`}>
      <style>{DASH_CSS}</style>

      <Rise>
        <DashHero firstName={firstName} stats={stats} navigate={navigate} />
      </Rise>

      <Section eyebrow="Resume" title="Continue where you left off">
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

      <Section
        eyebrow="Library"
        title="Your test series"
        action={enrolled.length > 0 && <PillLink onClick={() => navigate("/student/my-tests")}>See all</PillLink>}
      >
        {enrolled.length === 0 ? (
          <Empty>You haven't enrolled in a test series yet. Recommended series are below.</Empty>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {enrolled.map((s, i) => (
              <Rise key={s.id} delay={i * 80} className="h-full">
                <DashSeriesCard series={s} index={i} progress={Number(s.progress_percentage) || 0}
                  onResume={() => navigate(`/student/my-tests/${s.id}`)} onOpen={() => navigate(`/student/my-tests/${s.id}`)} />
              </Rise>
            ))}
          </div>
        )}
      </Section>

      <Section
        eyebrow="Results"
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
          eyebrow="Discover"
          title="Recommended for you"
          action={<PillLink onClick={() => navigate("/student/test-series")}>Browse all</PillLink>}
        >
          <div className="grid gap-3 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
            {recommended.map((s, i) => (
              <Rise key={s.id} delay={i * 80} className="h-full">
                <DashSeriesCard series={s} index={i} actionLabel="View" onAction={() => navigate(`/student/dashboard/series/${s.id}`)}
                  onOpen={() => navigate(`/student/dashboard/series/${s.id}`)} />
              </Rise>
            ))}
          </div>
        </Section>
      )}
    </div>
  );
}
