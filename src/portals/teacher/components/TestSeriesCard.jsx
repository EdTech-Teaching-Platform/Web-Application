import { NavLink, useNavigate } from "react-router-dom";
import { QuizIcon, EyeIcon, DuplicateIcon, ArchiveIcon, TrashIcon, ClockIcon, ArrowRightIcon, CheckIcon, FlagIcon } from "../../../components/ui/icons";
import { SeriesStatusBadge, DeadlineChip, isOverdue } from "./TestSeriesStatus";
import { primaryAction, seriesQuestionCount, seriesTestCount, priceLabel } from "../data/testSeriesData";
import { timeAgo } from "../data/testSeriesDeadlines";

// TestSeriesCard — teacher-dashboard card for one series. Exactly two designs:
//  1. StartCard  — an assigned series the educator hasn't opened yet: shows the
//     whole build journey as a step list and one "Start building" button.
//  2. ResumeCard — everything else (drafting, ready, live, archived): progress,
//     the same step list with done / current states, and one next-step button.
// Behaviour (routes, actions, archive / duplicate / delete rules) is unchanged.

const BUILD_STEPS = [
  { key: "details", title: "Add details", hint: "Title, grades, subjects, pricing" },
  { key: "structure", title: "Structure tests", hint: "Sections, tests and durations" },
  { key: "questions", title: "Add questions", hint: "Write, import or pull from the bank" },
  { key: "publish", title: "Review & publish", hint: "Final check, then go live" },
];

// done / current / todo for each step, derived from status + builder progress.
function stepStates(series) {
  const pct = Math.round(series.builderProgress || 0);
  const live = series.status === "published" || series.status === "final";
  const done = [pct >= 15, pct >= 30, pct >= 100 || series.status === "ready" || live, live];
  if (series.status === "archived") return BUILD_STEPS.map(() => "todo");
  const firstOpen = done.indexOf(false);
  return done.map((d, i) => (d ? "done" : i === firstOpen ? "current" : "todo"));
}

function Steps({ series, muted = false }) {
  const states = stepStates(series);
  return (
    <ol className="mt-5 space-y-0">
      {BUILD_STEPS.map((s, i) => {
        const st = muted ? "todo" : states[i];
        const last = i === BUILD_STEPS.length - 1;
        return (
          <li key={s.key} className="relative flex gap-3 pb-4 last:pb-0">
            {!last && <span aria-hidden="true" className={`absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-px ${st === "done" ? "bg-(--lp-blue)" : "bg-(--lp-line)"}`} />}
            <span
              className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full text-[11px] font-bold ${
                st === "done"
                  ? "bg-(--lp-blue) text-white"
                  : st === "current"
                    ? "bg-(--lp-ink) text-white ring-4 ring-(--lp-blue-soft)"
                    : "bg-(--lp-grey) text-(--lp-muted) ring-1 ring-(--lp-line)"
              }`}
            >
              {st === "done" ? <CheckIcon className="h-3.5 w-3.5" /> : i + 1}
            </span>
            <span className="min-w-0 pt-0.5">
              <span className={`block text-sm font-semibold leading-tight ${st === "todo" ? "text-(--lp-ink)/80" : "text-(--lp-ink)"}`}>{s.title}</span>
              <span className="mt-0.5 block text-xs text-(--lp-muted)">{s.hint}</span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function Facts({ series }) {
  const items = [
    ["Questions", seriesQuestionCount(series)],
    ["Tests", seriesTestCount(series)],
    ["Price", priceLabel(series)],
  ];
  return (
    <dl className="mt-5 grid grid-cols-3 divide-x divide-(--lp-line) rounded-2xl bg-(--lp-grey) py-3 text-center">
      {items.map(([k, v]) => (
        <div key={k} className="px-2">
          <dt className="text-[10px] font-semibold uppercase tracking-wider text-(--lp-muted)">{k}</dt>
          <dd className="mt-0.5 truncate text-sm font-bold text-(--lp-ink)">{v}</dd>
        </div>
      ))}
    </dl>
  );
}

function IconBtn({ label, onClick, to, danger, children }) {
  const cls = `grid h-9 w-9 place-items-center rounded-full text-(--lp-muted) transition-colors ${danger ? "hover:bg-danger/10 hover:text-danger" : "hover:bg-(--lp-blue-tint) hover:text-(--lp-blue-deep)"}`;
  return to ? (
    <NavLink to={to} aria-label={label} title={label} className={cls}>{children}</NavLink>
  ) : (
    <button type="button" onClick={onClick} aria-label={label} title={label} className={cls}>{children}</button>
  );
}

export default function TestSeriesCard({ series, courseTitle, onArchiveToggle, onDuplicate, onDelete }) {
  const navigate = useNavigate();
  const isAssigned = series.origin === "assigned";
  const notStarted = series.status === "assigned";
  const act = primaryAction(series);
  const liveSeries = series.status === "published" || series.status === "final";
  const inReview = series.status === "ready";
  const label = liveSeries ? "Edit" : act.label;
  const to = liveSeries ? `/teacher/testseries/${series.id}/manage` : act.to;
  const pct = Math.round(series.builderProgress || 0);
  const overdue = isOverdue(series);
  const archived = series.status === "archived";
  const tags = [...series.grades.slice(0, 2), ...series.subjects.slice(0, 2)];
  const exp = series.assignment?.expected;

  return (
    <article
      className={`motion-safe:animate-[rise-in_0.4s_ease-out_both] relative flex h-full flex-col overflow-hidden rounded-[2rem] bg-white p-5 shadow-[0_20px_44px_-30px_rgba(15,17,21,0.35)] ring-1 transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_26px_50px_-28px_rgba(15,17,21,0.4)] sm:p-6 ${
        overdue ? "ring-2 ring-danger/40" : "ring-(--lp-line)"
      }`}
    >
      {/* Accent strip: yellow for "new", blue for "in progress" */}
      <span aria-hidden="true" className={`absolute inset-x-0 top-0 h-1.5 ${notStarted ? "bg-(--lp-yellow)" : "bg-(--lp-blue)"}`} />

      <div className="flex items-start justify-between gap-3 pt-1">
        {notStarted ? (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-yellow-soft) px-3 py-1 text-[11px] font-bold text-(--lp-ink)">
            <FlagIcon className="h-3 w-3" /> New · assigned by admin
          </span>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-blue-tint) px-3 py-1 text-[11px] font-bold text-(--lp-blue-deep)">
            <QuizIcon className="h-3 w-3" /> {isAssigned ? "Assigned" : "My own"} · {series.scope === "course" ? "Course-wise" : "Standalone"}
          </span>
        )}
        {!notStarted && <SeriesStatusBadge series={series} size="sm" />}
      </div>

      <NavLink to={`/teacher/testseries/${series.id}/detail`} className="mt-4 block">
        <h3 className="line-clamp-2 font-(family-name:--lp-font) text-lg font-bold leading-snug tracking-tight text-(--lp-ink) transition-colors hover:text-(--lp-blue-deep)">
          {series.title || "Untitled test series"}
        </h3>
      </NavLink>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {notStarted && <span className="rounded-full bg-(--lp-grey) px-2.5 py-0.5 text-[11px] font-semibold text-(--lp-muted)">{series.scope === "course" ? "Course-wise" : "Standalone"}</span>}
        {tags.map((t) => (
          <span key={t} className="rounded-full bg-(--lp-blue-tint) px-2.5 py-0.5 text-[11px] font-semibold text-(--lp-blue-deep)">{t}</span>
        ))}
      </div>
      {series.scope === "course" && courseTitle && <p className="mt-2 truncate text-xs text-(--lp-muted)">Course: {courseTitle}</p>}

      {!liveSeries && !inReview && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <DeadlineChip series={series} />
        </div>
      )}

      {notStarted ? (
        <>
          <div className="mt-5 flex items-center justify-between">
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)">Your build steps</span>
            {exp && (exp.tests || exp.questions) ? (
              <span className="text-[11px] font-semibold text-(--lp-muted)">
                Expected: {exp.tests || "—"} tests · {exp.questions || "—"} Qs
              </span>
            ) : null}
          </div>
          <Steps series={series} muted />
        </>
      ) : inReview ? (
        <p className="mt-4 flex items-center gap-2 rounded-2xl bg-(--lp-yellow-soft) px-4 py-3 text-sm font-semibold text-(--lp-ink)">
          <ClockIcon className="h-4 w-4 shrink-0" />
          Under review — we'll notify you once it's approved.
        </p>
      ) : liveSeries ? (
        <>
          <dl className="mt-4 grid grid-cols-3 divide-x divide-(--lp-line) rounded-2xl bg-(--lp-blue-tint) py-3 text-center">
            {[
              ["Tests", seriesTestCount(series)],
              ["Questions", seriesQuestionCount(series)],
              ["Enrolled", series.enrollments.toLocaleString()],
            ].map(([k, v]) => (
              <div key={k} className="px-2">
                <dt className="text-[10px] font-semibold uppercase tracking-wider text-(--lp-muted)">{k}</dt>
                <dd className="mt-0.5 truncate font-(family-name:--lp-font) text-lg font-bold text-(--lp-ink)">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 flex items-center gap-1.5 text-[11px] text-(--lp-muted)">
            <ClockIcon className="h-3 w-3" />
            {series.lastSavedAt ? `Updated ${timeAgo(series.lastSavedAt)}` : "Live for students"}
          </p>
        </>
      ) : (
        <>
          <div className="mt-5 rounded-2xl bg-(--lp-blue-tint) p-4">
            <div className="flex items-end justify-between">
              <span className="text-xs font-semibold text-(--lp-ink)">{archived ? "Archived" : "Builder progress"}</span>
              <span className="font-(family-name:--lp-font) text-2xl font-bold leading-none text-(--lp-blue-deep)">{pct}%</span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-white" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Builder progress">
              <div className="h-full rounded-full bg-(--lp-blue) transition-all duration-500" style={{ width: `${pct}%` }} />
            </div>
            <p className="mt-2 flex items-center gap-1.5 text-[11px] text-(--lp-muted)">
              <ClockIcon className="h-3 w-3" />
              {series.lastSavedAt ? `Saved ${timeAgo(series.lastSavedAt)}` : "Not saved yet"}
              <span aria-hidden="true">·</span>
              {series.enrollments.toLocaleString()} enrolled
            </p>
          </div>
          <Steps series={series} />
        </>
      )}

      {notStarted && <Facts series={series} />}

      <div className="mt-auto flex items-center gap-1 pt-4">
        <button
          type="button"
          onClick={() => navigate(to)}
          className={`inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-bold transition-transform duration-150 hover:-translate-y-0.5 ${
            notStarted ? "bg-(--lp-ink) text-white" : "bg-(--lp-blue-deep) text-white"
          }`}
        >
          {label}
          <ArrowRightIcon className="h-4 w-4" />
        </button>
        {!liveSeries && series.status !== "ready" && (
          <>
        <IconBtn label="Preview as Student" to={`/teacher/testseries/${series.id}/preview`}><EyeIcon className="h-4 w-4" /></IconBtn>
        <IconBtn label="Duplicate series" onClick={onDuplicate}><DuplicateIcon className="h-4 w-4" /></IconBtn>
        {!isAssigned && series.status !== "final" && (
          <IconBtn label={archived ? "Unarchive series" : "Archive series"} onClick={onArchiveToggle}><ArchiveIcon className="h-4 w-4" /></IconBtn>
        )}
        {!isAssigned && (
          <IconBtn label="Delete series" onClick={onDelete} danger><TrashIcon className="h-4 w-4" /></IconBtn>
        )}
          </>
        )}
      </div>
    </article>
  );
}
