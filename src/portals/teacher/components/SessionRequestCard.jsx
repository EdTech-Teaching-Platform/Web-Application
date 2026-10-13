import StatusBadge from "../../../components/ui/StatusBadge";
import { REQUEST_STATUS_META, initials } from "../data/sessionRequestsData";
import { formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import { relativeDate } from "./CoursePortfolioCard";
import { ClockIcon, BookIcon, ChevronRightIcon } from "../../../components/ui/icons";
import IconBadge, { ICON_TONES, toneForKey } from "../../../components/ui/IconBadge";

// SessionRequestCard — one row in the Requests inbox, matching
// MentorshipApplicationCard's exact shape/hover treatment (avatar, name,
// course, a session-type tag, StatusBadge) so Requests reads as the same
// visual family as Mentorship Hub's queue rather than a new pattern.
export default function SessionRequestCard({ request, onOpen }) {
  const meta = REQUEST_STATUS_META[request.status] ?? REQUEST_STATUS_META.pending;

  return (
    <button
      type="button"
      onClick={() => onOpen(request)}
      className="flex w-full flex-col gap-3 rounded-3xl bg-surface p-4 text-left shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card sm:flex-row sm:items-center sm:gap-4"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <IconBadge tone={toneForKey(request.studentName)} className="text-sm font-bold">
          {initials(request.studentName)}
        </IconBadge>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{request.studentName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
            <BookIcon className="h-3 w-3 shrink-0" />
            {request.courseTitle}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 sm:shrink-0">
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${ICON_TONES[toneForKey(request.sessionType)]}`}>{request.sessionType}</span>
        <span className="flex items-center gap-1.5 text-xs text-muted">
          <ClockIcon className="h-3.5 w-3.5" />
          {request.flexible
            ? `${formatDateLabel(request.requestedDate)} · flexible`
            : `${formatDateLabel(request.requestedDate)} · ${formatTime12(request.requestedStart)}`}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3 sm:ml-2">
        <span className="text-[11px] text-muted">Sent {relativeDate(request.submittedAt.slice(0, 10))}</span>
        <StatusBadge status={meta.badge} size="sm" showIcon={false}>
          {meta.label}
        </StatusBadge>
        <ChevronRightIcon className="hidden h-4 w-4 text-text/25 sm:block" />
      </div>
    </button>
  );
}
