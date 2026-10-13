import StatusBadge from "../../../components/ui/StatusBadge";
import { LIFECYCLE_META } from "./contentData";
import { PencilIcon, ClockIcon, CheckIcon, FlagIcon, ArchiveIcon } from "../../../components/ui/icons";

const LIFECYCLE_ICONS = {
  draft: PencilIcon,
  pending_review: ClockIcon,
  published: CheckIcon,
  changes_requested: FlagIcon,
  archived: ArchiveIcon,
};

// CourseStatusBadge — the one place a lifecycle status becomes a
// <StatusBadge>. Used in the Course Builder header, the My Courses list
// row preview, and anywhere else a course's state needs to be legible at a
// glance, so every context shows the exact same color/icon/label per state
// instead of each screen re-deciding it.
export default function CourseStatusBadge({ status, className = "" }) {
  const meta = LIFECYCLE_META[status] ?? LIFECYCLE_META.draft;
  return (
    <StatusBadge status={meta.badgeStatus} icon={LIFECYCLE_ICONS[status]} className={className}>
      {meta.label}
    </StatusBadge>
  );
}
