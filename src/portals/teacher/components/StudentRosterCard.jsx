import { useNavigate } from "react-router-dom";
import ProgressRing from "../../../components/ui/ProgressRing";
import StatusBadge from "../../../components/ui/StatusBadge";
import { COURSE_SEGMENT_COLORS, initials } from "../data/studentDirectory";
import { relativeDate } from "./CoursePortfolioCard";
import { AlertTriangleIcon, CertificateIcon } from "../../../components/ui/icons";

const STATUS_META = {
  completed: { label: "Completed", status: "success" },
  "in-progress": { label: "In Progress", status: "warning" },
  "not-started": { label: "Not Started", status: "neutral" },
};

// Compact multi-segment progress bar — one segment per enrolled course,
// so the educator can see per-course standing at a glance without opening
// the profile, rather than one flattened average number.
function SegmentedProgressBar({ entry }) {
  return (
    <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-bg">
      {entry.enrollments.map((enr, i) => (
        <div
          key={enr.courseId}
          className={`h-full ${COURSE_SEGMENT_COLORS[i % COURSE_SEGMENT_COLORS.length]}`}
          style={{ width: `${100 / entry.enrollments.length}%`, opacity: 0.35 + (enr.progress / 100) * 0.65 }}
          title={`${enr.courseTitle}: ${enr.progress}%`}
        />
      ))}
    </div>
  );
}

// StudentRosterCard — the one row/card renderer for the cross-course
// roster, shared between grid and list view (same data, same actions,
// just different chrome) so the two view modes can never drift apart.
export default function StudentRosterCard({
  entry,
  viewMode,
  selected,
  onToggleSelect,
  onViewProfile,
}) {
  const navigate = useNavigate();
  const statusMeta = STATUS_META[entry.overallStatus] ?? STATUS_META["not-started"];

  function goToCourse(enr) {
    navigate(`/teacher/coursemanagement/${enr.courseId}?tab=students&student=${encodeURIComponent(entry.name)}`);
  }

  const courseChips = (
    <div className="flex flex-wrap gap-1.5">
      {entry.enrollments.map((enr) => (
        <button
          key={enr.courseId}
          type="button"
          onClick={() => goToCourse(enr)}
          title={`Open ${enr.courseTitle} — Students`}
          className="max-w-[160px] truncate rounded-full bg-primary/[0.07] px-2.5 py-1 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/15"
        >
          {enr.courseTitle}
        </button>
      ))}
    </div>
  );

  const quickActions = (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => onViewProfile(entry)}
        className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.06]"
      >
        View Profile
      </button>
    </div>
  );

  if (viewMode === "list") {
    return (
      <div className={`flex flex-col gap-3 rounded-3xl bg-white p-4 sm:flex-row sm:items-center sm:gap-4 ${entry.atRisk ? "ring-danger/25 bg-danger/[0.02]" : ""} shadow-soft`}>
        <div className="flex items-center gap-3 sm:w-56 sm:shrink-0">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(entry.key)}
            className="h-4 w-4 shrink-0 accent-primary"
            aria-label={`Select ${entry.name}`}
          />
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {initials(entry.name)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-text">
              {entry.name}
              {entry.atRisk && <AlertTriangleIcon className="h-3.5 w-3.5 shrink-0 text-danger" title="At risk — inactive 14+ days" />}
            </p>
            <p className="truncate text-xs text-muted">Active {relativeDate(entry.lastActive)}</p>
          </div>
        </div>

        <div className="min-w-0 flex-1">{courseChips}</div>

        <div className="flex items-center gap-2 sm:w-40 sm:shrink-0">
          <SegmentedProgressBar entry={entry} />
          <span className="shrink-0 text-xs font-medium text-muted">{entry.overallProgress}%</span>
        </div>

        <div className="flex items-center gap-2 sm:w-28 sm:shrink-0">
          <StatusBadge status={statusMeta.status} size="sm" showIcon={false}>
            {statusMeta.label}
          </StatusBadge>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-muted sm:w-16 sm:shrink-0">
          {entry.certificateCount > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <CertificateIcon className="h-3.5 w-3.5" /> {entry.certificateCount}
            </span>
          ) : (
            <span className="text-muted">—</span>
          )}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-1 sm:w-auto">{quickActions}</div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-3.5 rounded-3xl bg-surface p-4 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${entry.atRisk ? "ring-danger/25 bg-danger/[0.02]" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={() => onToggleSelect(entry.key)}
            className="h-4 w-4 shrink-0 accent-primary"
            aria-label={`Select ${entry.name}`}
          />
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {initials(entry.name)}
          </span>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-semibold text-text">{entry.name}</p>
            <p className="truncate text-xs text-muted">Active {relativeDate(entry.lastActive)}</p>
          </div>
        </div>
        {entry.atRisk ? (
          <span className="flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-2.5 py-1 text-[11px] font-bold text-danger">
            <AlertTriangleIcon className="h-3 w-3" />
            At Risk
          </span>
        ) : (
          <StatusBadge status={statusMeta.status} size="sm" showIcon={false}>
            {statusMeta.label}
          </StatusBadge>
        )}
      </div>

      {courseChips}

      <div className="flex items-center gap-3">
        <ProgressRing value={entry.overallProgress} size={52} stroke={6} label={`Overall progress ${entry.overallProgress}%`} />
        <div className="min-w-0 flex-1">
          <div className="eyebrow-muted mb-1.5">Overall progress</div>
          <SegmentedProgressBar entry={entry} />
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-text/[0.06] pt-3">
        <span className="flex items-center gap-1 text-xs text-muted">
          {entry.certificateCount > 0 ? (
            <span className="inline-flex items-center gap-1 font-semibold text-success">
              <CertificateIcon className="h-3.5 w-3.5" /> {entry.certificateCount} certificate{entry.certificateCount === 1 ? "" : "s"}
            </span>
          ) : (
            <span className="text-muted">No certificates yet</span>
          )}
        </span>
        {quickActions}
      </div>
    </div>
  );
}

export { STATUS_META };
