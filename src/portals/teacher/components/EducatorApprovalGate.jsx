import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { InfoIcon } from "../../../components/ui/icons";
import { AUTH_THEME_VARS, AuthShapes } from "../../../auth/components/AuthKit";
import DigitalIDCard from "./DigitalIDCard";
import { EDUCATOR_STATUS, EDUCATOR_STATUS_META, toIdCardProfile } from "../data/educatorAccountStore";

// EducatorApprovalGate — what a signed-in educator sees INSTEAD of the
// dashboard until an admin approves their application. TeacherLayout renders
// it for every status except "approved", so no portal screen is reachable
// while the application is pending, needs changes, or was declined. It is
// reactive: when the admin approves (even from another tab), the layout
// re-renders and the dashboard opens, no reload needed.
const COPY = {
  [EDUCATOR_STATUS.PENDING]: {
    title: "Your application is under review",
    body: "We've sent your details and documents to our admin team. Your dashboard opens as soon as they approve your profile, usually within 2–3 business days. There's nothing more you need to do right now.",
  },
  [EDUCATOR_STATUS.CHANGES_REQUESTED]: {
    title: "A few updates are needed",
    body: "Our team reviewed your application and needs some changes before approving it. Update your details and resubmit. Your dashboard opens once it's approved.",
  },
  [EDUCATOR_STATUS.REJECTED]: {
    title: "Your application wasn't approved",
    body: "Our team couldn't approve this application. You can update your details and submit it again.",
  },
};

function formatDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function EducatorApprovalGate({ account, onLogout }) {
  const meta = EDUCATOR_STATUS_META[account.status] ?? EDUCATOR_STATUS_META.pending;
  const copy = COPY[account.status] ?? COPY[EDUCATOR_STATUS.PENDING];
  const canResubmit = account.status === EDUCATOR_STATUS.CHANGES_REQUESTED || account.status === EDUCATOR_STATUS.REJECTED;
  const submitted = formatDate(account.submittedAt);

  return (
    <div style={AUTH_THEME_VARS} className="relative isolate min-h-screen w-full overflow-hidden bg-white font-body text-text">
      <AuthShapes />
      <div className="relative z-10 flex min-h-screen items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl rounded-[36px] bg-white px-5 py-7 shadow-[0_30px_80px_rgba(37,87,214,0.18)] ring-1 ring-(--lp-line) sm:px-8">
          <div className="grid gap-7 sm:grid-cols-[260px_1fr] sm:items-center">
            <DigitalIDCard profile={toIdCardProfile(account)} maxWidthClass="max-w-[260px]" />
            <div>
              <StatusBadge status={meta.badgeStatus}>{meta.label}</StatusBadge>
              <h1 className="mt-2 font-display text-xl text-text">{copy.title}</h1>
              <p className="mt-2 text-sm text-muted">{copy.body}</p>
              {submitted && account.status === EDUCATOR_STATUS.PENDING && (
                <p className="mt-2 text-xs font-medium text-muted">Submitted on {submitted}</p>
              )}

              {canResubmit && account.adminFeedback && (
                <div role="note" className="mt-3 rounded-2xl bg-danger/10 px-4 py-3 text-sm text-danger">
                  <p className="font-semibold">Note from our team</p>
                  <p className="mt-0.5 text-danger/90">"{account.adminFeedback}"</p>
                </div>
              )}

              <div className="mt-3 flex items-start gap-2.5 rounded-2xl bg-pastel-blue px-4 py-3 text-xs text-pastel-blue-ink">
                <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
                <span>This Digital ID Card is provisional. It becomes your verified, shareable credential after approval.</span>
              </div>

              <div className="mt-5 flex flex-wrap items-center gap-3">
                {canResubmit && (
                  <Button as={Link} to="/teacher/registration?resubmit=1" variant="ink" shape="rect" fullWidth={false} className="px-6">
                    Update my application
                  </Button>
                )}
                <Link to="/" className="text-sm font-semibold text-primary hover:underline">Back to home</Link>
                <button type="button" onClick={onLogout} className="text-sm font-semibold text-muted hover:text-text hover:underline">
                  Log out
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
