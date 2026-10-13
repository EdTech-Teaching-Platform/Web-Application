import StatusBadge from "../../../components/ui/StatusBadge";
import { initials } from "../data/studentDirectory";
import { relativeDate } from "./CoursePortfolioCard";
import ProgressRing from "../../../components/ui/ProgressRing";
import { currentMilestone, mentorshipProgress, nextCheckInLabel } from "../data/mentorshipData";
import { formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import { VideoIcon, CalendarIcon } from "../../../components/ui/icons";

export const MENTORSHIP_STATUS_META = {
  active: { label: "Active", status: "success" },
  paused: { label: "Paused", status: "warning" },
  completed: { label: "Completed", status: "success" },
  ended_early: { label: "Ended Early", status: "danger" },
};

// MentorshipMenteeCard — one roster tile/row for the Dashboard's mentee
// list, sharing StudentRosterCard's visual language (avatar, progress bar,
// quick actions row) but scoped to a single mentorship program instead of
// a cross-course student entry.
export default function MentorshipMenteeCard({ mentorship, slots, viewMode, onOpen, onSchedule }) {
  const meta = MENTORSHIP_STATUS_META[mentorship.status] ?? MENTORSHIP_STATUS_META.active;
  const progress = mentorshipProgress(mentorship);
  const current = currentMilestone(mentorship);
  const nextCheckIn = nextCheckInLabel(mentorship, slots);

  const quickActions = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onSchedule(mentorship);
        }}
        aria-label={`Schedule a check-in with ${mentorship.studentName}`}
        title="Schedule check-in"
        className="rounded-full p-1.5 text-muted hover:bg-primary/[0.08] hover:text-primary"
      >
        <VideoIcon className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onOpen(mentorship)}
        className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.06]"
      >
        View Program
      </button>
    </div>
  );

  if (viewMode === "list") {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={() => onOpen(mentorship)}
        onKeyDown={(e) => e.key === "Enter" && onOpen(mentorship)}
        className="flex cursor-pointer flex-col gap-3 rounded-3xl bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_-10px_rgba(26,26,26,0.18)] sm:flex-row sm:items-center sm:gap-4 shadow-soft"
      >
        <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(mentorship.studentName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{mentorship.studentName}</p>
            <p className="truncate text-xs text-muted">{mentorship.focusArea}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-xs text-muted">
            {current ? `Current: ${current.title}` : "All milestones complete"}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:w-36 sm:shrink-0">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
          <span className="shrink-0 text-xs font-medium text-muted">{progress}%</span>
        </div>

        <div className="sm:w-24 sm:shrink-0">
          <StatusBadge status={meta.status} size="sm" showIcon={false}>
            {meta.label}
          </StatusBadge>
        </div>

        <div className="shrink-0">{quickActions}</div>
      </div>
    );
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpen(mentorship)}
      onKeyDown={(e) => e.key === "Enter" && onOpen(mentorship)}
      className="flex cursor-pointer flex-col gap-3.5 rounded-3xl bg-white p-4 transition-shadow hover:shadow-[0_6px_24px_-10px_rgba(26,26,26,0.18)] shadow-soft"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials(mentorship.studentName)}
          </span>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{mentorship.studentName}</p>
            <p className="truncate text-xs text-muted">{mentorship.focusArea}</p>
          </div>
        </div>
        <StatusBadge status={meta.status} size="sm" showIcon={false}>
          {meta.label}
        </StatusBadge>
      </div>

      <p className="truncate text-xs text-muted">
        {current ? `Current: ${current.title}` : "All milestones complete"}
      </p>

      <div className="flex items-center gap-3">
        <ProgressRing value={progress} size={52} stroke={6} label={`Program progress ${progress}%`} />
        <div className="min-w-0 flex-1">
          <div className="eyebrow-muted mb-1.5">Program progress</div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-text/[0.06] pt-3">
        <span className="flex min-w-0 items-center gap-1.5 truncate text-xs text-muted">
          <CalendarIcon className="h-3.5 w-3.5 shrink-0" />
          {nextCheckIn ? (
            <span className="truncate">
              Next check-in {formatDateLabel(nextCheckIn.date, { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(nextCheckIn.start)}
            </span>
          ) : (
            <span>No check-in scheduled · Started {relativeDate(mentorship.startDate)}</span>
          )}
        </span>
      </div>

      <div className="flex justify-end border-t border-text/[0.06] pt-3">{quickActions}</div>
    </div>
  );
}
