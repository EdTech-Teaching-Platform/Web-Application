import StatusBadge from "../../../components/ui/StatusBadge";
import { initials } from "../data/studentDirectory";
import { relativeDate } from "./CoursePortfolioCard";
import { UsersIcon, BookIcon, ChevronRightIcon } from "../../../components/ui/icons";

export const APPLICATION_STATUS_META = {
  new: { label: "New", status: "neutral" },
  under_review: { label: "Under Review", status: "warning" },
  accepted: { label: "Accepted", status: "success" },
  declined: { label: "Declined", status: "danger" },
};

// MentorshipApplicationCard — one row in the Applications queue. Shows the
// roster avatar/name when the applicant is a genuinely enrolled student
// (relatedRosterEntry resolved it) and a distinct "Prospective applicant"
// treatment otherwise, matching StudentRosterCard's visual language rather
// than forking a new card shape.
export default function MentorshipApplicationCard({ application, rosterEntry, onOpen }) {
  const meta = APPLICATION_STATUS_META[application.status] ?? APPLICATION_STATUS_META.new;

  return (
    <button
      type="button"
      onClick={() => onOpen(application)}
      className="flex w-full flex-col gap-3 rounded-3xl bg-white p-4 text-left transition-shadow duration-200 hover:shadow-[0_6px_24px_-10px_rgba(26,26,26,0.18)] sm:flex-row sm:items-center sm:gap-4 shadow-soft"
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
          {initials(application.studentName)}
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-text">{application.studentName}</p>
          <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs text-muted">
            {rosterEntry ? (
              <>
                <BookIcon className="h-3 w-3 shrink-0" />
                {application.courseTitle}
              </>
            ) : (
              <>
                <UsersIcon className="h-3 w-3 shrink-0" />
                Prospective applicant
              </>
            )}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 sm:w-auto">
        {application.focusAreas?.slice(0, 2).map((f) => (
          <span key={f} className="rounded-full bg-primary/[0.06] px-2.5 py-1 text-[11px] font-semibold text-primary">
            {f}
          </span>
        ))}
      </div>

      <div className="flex shrink-0 items-center justify-between gap-3 sm:w-auto sm:justify-end">
        <span className="text-xs text-muted">Applied {relativeDate(application.appliedAt)}</span>
        <StatusBadge status={meta.status} size="sm" showIcon={false}>
          {meta.label}
        </StatusBadge>
        <ChevronRightIcon className="h-4 w-4 shrink-0 text-muted" />
      </div>
    </button>
  );
}
