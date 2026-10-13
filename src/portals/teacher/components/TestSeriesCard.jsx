import { NavLink, useNavigate } from "react-router-dom";
import IconBadge, { toneForKey } from "../../../components/ui/IconBadge";
import { QuizIcon, EyeIcon, PencilIcon, DuplicateIcon, ArchiveIcon, TrashIcon, UsersIcon, ClockIcon, BookIcon, ArrowRightIcon } from "../../../components/ui/icons";
import { SeriesStatusBadge, OriginTags, DeadlineChip, isOverdue } from "./TestSeriesStatus";
import { priceLabel, primaryAction, seriesQuestionCount, seriesTestCount, visibilityNote } from "../data/testSeriesData";
import { timeAgo } from "../data/testSeriesDeadlines";

// TestSeriesCard — the teacher-dashboard card for one series (management
// view: lifecycle status, origin/scope, builder progress, last-saved time and
// a Resume / next-step button). The STUDENT-facing card lives in
// TestSeriesPreview.jsx.
export default function TestSeriesCard({ series, courseTitle, onArchiveToggle, onDuplicate, onDelete }) {
  const navigate = useNavigate();
  const tags = [...series.grades.slice(0, 2), ...series.subjects.slice(0, 2)];
  const extra = series.grades.length + series.subjects.length - tags.length;
  const archived = series.status === "archived";
  const isAssigned = series.origin === "assigned";
  const act = primaryAction(series);
  const label = series.status === "published" ? "Edit" : act.label;
  const to = series.status === "published" ? `/teacher/testseries/${series.id}` : act.to;
  const inProgress = series.status === "assigned" || series.status === "drafting";
  const pct = Math.round(series.builderProgress || 0);
  const overdue = isOverdue(series);

  return (
    <div className={`motion-safe:animate-[rise-in_0.4s_ease-out_both] flex h-full flex-col rounded-3xl bg-surface p-5 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card sm:p-6 ${overdue ? "ring-2 ring-danger/30" : ""}`}>
      <div className="flex items-start justify-between gap-3">
        <IconBadge icon={QuizIcon} tone={toneForKey(series.subjects[0] || series.title)} />
        <SeriesStatusBadge series={series} />
      </div>

      <NavLink to={`/teacher/testseries/${series.id}/detail`} className="mt-4 block">
        <h3 className="line-clamp-2 text-base font-bold leading-snug text-text hover:text-primary">{series.title || "Untitled test series"}</h3>
      </NavLink>

      <OriginTags series={series} className="mt-2" />
      {series.scope === "course" && courseTitle && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-muted">
          <BookIcon className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Course: {courseTitle}</span>
        </p>
      )}

      <div className="mt-2 flex flex-wrap gap-1.5">
        {tags.length === 0 && <span className="text-xs text-muted">No tags yet</span>}
        {tags.map((t) => (
          <span key={t} className="rounded-full bg-primary/[0.07] px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            {t}
          </span>
        ))}
        {extra > 0 && <span className="rounded-full bg-text/[0.06] px-2.5 py-0.5 text-[11px] font-semibold text-muted">+{extra}</span>}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        <DeadlineChip series={series} />
        {!inProgress && series.status !== "archived" && <span className="text-[11px] font-medium text-muted">{visibilityNote(series)}</span>}
      </div>

      <dl className="mt-4 grid grid-cols-3 gap-2 rounded-2xl bg-bg px-3 py-3 text-center">
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Questions</dt>
          <dd className="text-sm font-bold text-text">{seriesQuestionCount(series)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Tests</dt>
          <dd className="text-sm font-bold text-text">{seriesTestCount(series)}</dd>
        </div>
        <div>
          <dt className="text-[10px] font-semibold uppercase tracking-wide text-muted">Price</dt>
          <dd className="text-sm font-bold text-text">{priceLabel(series)}</dd>
        </div>
      </dl>

      <div className="mt-3">
        <div className="flex items-center justify-between text-xs">
          <span className="font-semibold text-text">Builder progress</span>
          <span className="font-bold text-primary">{pct}%</span>
        </div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-text/[0.08]" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Builder progress">
          <div className="h-full rounded-full bg-primary transition-all duration-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span className="inline-flex items-center gap-1">
          <UsersIcon className="h-3.5 w-3.5" />
          {series.enrollments.toLocaleString()} enrolled · {series.attempts.toLocaleString()} attempts
        </span>
        <span className="inline-flex items-center gap-1">
          <ClockIcon className="h-3.5 w-3.5" />
          {series.lastSavedAt ? `Saved ${timeAgo(series.lastSavedAt)}` : "Not started"}
        </span>
      </div>

      <div className="mt-auto flex items-center gap-1 pt-4">
        <button
          type="button"
          onClick={() => navigate(to)}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-2 text-xs font-semibold text-white shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-glow-primary"
        >
          {act.key === "view" ? <EyeIcon className="h-3.5 w-3.5" /> : act.key === "resume" || act.key === "start" ? <ArrowRightIcon className="h-3.5 w-3.5" /> : <PencilIcon className="h-3.5 w-3.5" />}
          {label}
        </button>
        {/* Preview as Student -- CSS-only tooltip, shown on hover AND keyboard focus. */}
        <span className="group relative ml-auto inline-flex">
          <NavLink
            to={`/teacher/testseries/${series.id}/preview`}
            aria-label="Preview as Student"
            aria-describedby={`ts-preview-tip-${series.id}`}
            className="rounded-full p-2 text-muted transition-colors hover:bg-bg hover:text-primary focus-visible:bg-bg focus-visible:text-primary"
          >
            <EyeIcon className="h-4 w-4" />
          </NavLink>
          <span
            id={`ts-preview-tip-${series.id}`}
            role="tooltip"
            className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-text px-3 py-1 text-[11px] font-semibold text-white opacity-0 transition-opacity duration-150 group-focus-within:opacity-100 group-hover:opacity-100"
          >
            Preview as Student
          </span>
        </span>
        <button type="button" onClick={onDuplicate} aria-label="Duplicate series" title="Duplicate" className="rounded-full p-2 text-muted transition-colors hover:bg-bg hover:text-primary">
          <DuplicateIcon className="h-4 w-4" />
        </button>
        {!isAssigned && series.status !== "final" && (
          <button
            type="button"
            onClick={onArchiveToggle}
            aria-label={archived ? "Unarchive series" : "Archive series"}
            title={archived ? "Unarchive" : "Archive"}
            className="rounded-full p-2 text-muted transition-colors hover:bg-bg hover:text-primary"
          >
            <ArchiveIcon className="h-4 w-4" />
          </button>
        )}
        {!isAssigned && (
          <button type="button" onClick={onDelete} aria-label="Delete series" title="Delete" className="rounded-full p-2 text-muted transition-colors hover:bg-danger/10 hover:text-danger">
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  );
}
