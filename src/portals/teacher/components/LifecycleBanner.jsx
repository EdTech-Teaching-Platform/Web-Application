import { ClockIcon, LockIcon, ArchiveIcon, FlagIcon } from "../../../components/ui/icons";

// LifecycleBanner — the frozen/locked/read-only strip every builder screen
// (Details, Curriculum, Content, Pricing, Review) renders at the top when
// the shared course.status makes it non-draft. One component so the
// wording and visual treatment per state can't drift screen to screen.
export default function LifecycleBanner({ status, adminFeedback, className = "" }) {
  if (status === "pending_review") {
    return (
      <div className={`flex items-start gap-3 rounded-2xl bg-warning/10 px-5 py-4 text-sm text-warning ${className}`}>
        <ClockIcon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
        <div>
          <p className="font-semibold">Your course is under review and can't be edited right now.</p>
          <p className="mt-0.5 text-warning/80">We'll notify you as soon as our team has made a decision.</p>
        </div>
      </div>
    );
  }

  if (status === "published") {
    return (
      <div className={`flex items-start gap-3 rounded-2xl bg-text/[0.05] px-5 py-4 text-sm text-muted ${className}`}>
        <LockIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted" />
        <div>
          <p className="font-semibold text-text">This course is live — curriculum is locked.</p>
          <p className="mt-0.5 text-muted">Price and description can still be updated at any time.</p>
        </div>
      </div>
    );
  }

  if (status === "archived") {
    return (
      <div className={`flex items-start gap-3 rounded-2xl bg-text/[0.05] px-5 py-4 text-sm text-muted ${className}`}>
        <ArchiveIcon className="mt-0.5 h-4.5 w-4.5 shrink-0 text-muted" />
        <div>
          <p className="font-semibold text-muted">This course is archived.</p>
          <p className="mt-0.5">It's read-only and no longer visible to new students.</p>
        </div>
      </div>
    );
  }

  if (status === "changes_requested") {
    return (
      <div className={`flex items-start gap-3 rounded-2xl bg-danger/10 px-5 py-4 text-sm text-danger ${className}`}>
        <FlagIcon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
        <div>
          <p className="font-semibold">Changes requested — editing is unlocked again.</p>
          {adminFeedback ? (
            <p className="mt-1 rounded-lg bg-white/60 px-3 py-2 text-danger/90">"{adminFeedback}"</p>
          ) : (
            <p className="mt-0.5 text-danger/80">See the feedback on the Review step, make the fix, then resubmit.</p>
          )}
        </div>
      </div>
    );
  }

  return null;
}
