import { CheckIcon, XIcon, ClockIcon } from "./icons";

// ConfirmationCard — design.md Section 4: single reusable, multi-state
// component (success/failure/pending/warning). Only icon, color, heading,
// message and CTA labels change between states; never redesign per use.
// Used here for: Forgot Password "check your inbox", Reset Password
// expired-link and success states.
const STATE_STYLES = {
  success: { Icon: CheckIcon, iconBg: "bg-success/15", iconColor: "text-success" },
  failure: { Icon: XIcon, iconBg: "bg-danger/15", iconColor: "text-danger" },
  warning: { Icon: ClockIcon, iconBg: "bg-warning/15", iconColor: "text-warning" },
};

export default function ConfirmationCard({ state = "success", heading, message, primaryAction, secondaryAction }) {
  if (state === "pending") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-2xl bg-bg px-8 py-10 text-center">
        <span className="mb-5 h-3 w-3 animate-pulse rounded-full bg-primary/60" aria-hidden="true" />
        <h2 className="font-display text-xl text-text">{heading}</h2>
        {message && <p className="mt-2 text-sm text-text/60">{message}</p>}
      </div>
    );
  }

  const { Icon, iconBg, iconColor } = STATE_STYLES[state] ?? STATE_STYLES.success;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-2xl bg-bg px-8 py-10 text-center">
      <span className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full ${iconBg} ${iconColor}`}>
        <Icon />
      </span>
      <h2 className="font-display text-xl text-text">{heading}</h2>
      {message && <p className="mt-2 text-sm text-text/60">{message}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex w-full flex-col gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
