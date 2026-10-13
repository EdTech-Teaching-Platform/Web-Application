import { Link } from "react-router-dom";
import StatusBadge from "../../../components/ui/StatusBadge";
import { InfoIcon, FlagIcon, CheckIcon, XIcon } from "../../../components/ui/icons";
import { EDUCATOR_STATUS, EDUCATOR_STATUS_META } from "../data/educatorAccountStore";

// EducatorStatusBanner — the account-level counterpart of LifecycleBanner
// (same rounded-2xl tinted strip, icon + bold line + softer second line, one
// tone per state). TeacherLayout renders it above every /teacher/* page, so
// the verification state stays visible until it's resolved:
//   pending            -> info strip: "Profile under verification…" + submitted date
//   changes_requested  -> danger strip with the admin's feedback + "Update profile"
//   rejected           -> danger strip with the admin's reason
//   approved           -> one-time success strip (dismissible), then gone
function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

const actionClass =
  "inline-flex shrink-0 items-center rounded-full bg-white/70 px-4 py-2 text-xs font-semibold transition-colors hover:bg-white";

export default function EducatorStatusBanner({ account, onDismissApproved, className = "" }) {
  if (!account) return null;
  const meta = EDUCATOR_STATUS_META[account.status];
  const submitted = formatDate(account.submittedAt);

  if (account.status === EDUCATOR_STATUS.PENDING) {
    return (
      <div
        role="status"
        className={`flex flex-col gap-3 rounded-2xl bg-pastel-blue px-5 py-4 text-sm text-pastel-blue-ink sm:flex-row sm:items-center ${className}`}
      >
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <InfoIcon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
          <div>
            <p className="font-semibold">
              Profile under verification — you'll be able to access your dashboard once you're approved.
            </p>
            <p className="mt-0.5 text-pastel-blue-ink/80">
              Submitted on {submitted}. Our team usually reviews educator applications within 2–3 business days, and
              we'll let you know the moment it's done.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <StatusBadge status={meta.badgeStatus}>{meta.label}</StatusBadge>
          <Link to="/teacher/profilesetup" className={actionClass}>
            View Digital ID Card
          </Link>
        </div>
      </div>
    );
  }

  if (account.status === EDUCATOR_STATUS.CHANGES_REQUESTED) {
    return (
      <div className={`flex flex-col gap-3 rounded-2xl bg-danger/10 px-5 py-4 text-sm text-danger sm:flex-row sm:items-center ${className}`}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <FlagIcon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
          <div>
            <p className="font-semibold">Changes requested — update your profile and resubmit to continue.</p>
            {account.adminFeedback ? (
              <p className="mt-1 rounded-lg bg-white/60 px-3 py-2 text-danger/90">"{account.adminFeedback}"</p>
            ) : (
              <p className="mt-0.5 text-danger/80">Our team left no extra notes — review your details and resubmit.</p>
            )}
            <p className="mt-1 text-xs text-danger/70">Submitted on {submitted}. Your dashboard unlocks once the updated profile is approved.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <StatusBadge status={meta.badgeStatus}>{meta.label}</StatusBadge>
          <Link to="/teacher/registration?resubmit=1" className={actionClass}>
            Update &amp; resubmit
          </Link>
        </div>
      </div>
    );
  }

  if (account.status === EDUCATOR_STATUS.REJECTED) {
    return (
      <div className={`flex flex-col gap-3 rounded-2xl bg-danger/10 px-5 py-4 text-sm text-danger sm:flex-row sm:items-center ${className}`}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <XIcon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
          <div>
            <p className="font-semibold">We couldn't approve your educator profile.</p>
            {account.adminFeedback && (
              <p className="mt-1 rounded-lg bg-white/60 px-3 py-2 text-danger/90">"{account.adminFeedback}"</p>
            )}
            <p className="mt-1 text-xs text-danger/70">You can correct the details and resubmit for another review.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 sm:flex-col sm:items-end">
          <StatusBadge status={meta.badgeStatus}>{meta.label}</StatusBadge>
          <Link to="/teacher/registration?resubmit=1" className={actionClass}>
            Update &amp; resubmit
          </Link>
        </div>
      </div>
    );
  }

  // approved — shown once, until dismissed
  if (account.status === EDUCATOR_STATUS.APPROVED && !account.approvedNoticeSeen) {
    return (
      <div className={`flex flex-col gap-3 rounded-2xl bg-pastel-sage px-5 py-4 text-sm text-pastel-sage-ink sm:flex-row sm:items-center ${className}`}>
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <CheckIcon className="mt-0.5 h-4.5 w-4.5 shrink-0" />
          <div>
            <p className="font-semibold">You're verified — your dashboard is now unlocked.</p>
            <p className="mt-0.5 text-pastel-sage-ink/80">Your Digital ID Card is live and ready to download or share.</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Link to="/teacher/profilesetup" className={actionClass}>
            View Digital ID Card
          </Link>
          <button type="button" onClick={onDismissApproved} className={actionClass}>
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  return null;
}
