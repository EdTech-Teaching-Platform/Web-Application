import { CheckIcon, XIcon, ClockIcon } from "./icons";

// ConfirmationCard — design.md Section 4: single reusable, multi-state
// component (success/failure/pending/warning). Only icon, color, heading,
// message and CTA labels change between states; never redesign per use.
// Used here for: Forgot Password "check your inbox", Reset Password
// expired-link and success states.
const STATE_STYLES = {
  success: { Icon: CheckIcon, iconBg: "bg-pastel-sage", iconColor: "text-pastel-sage-ink" },
  failure: { Icon: XIcon, iconBg: "bg-pastel-pink", iconColor: "text-pastel-pink-ink" },
  warning: { Icon: ClockIcon, iconBg: "bg-pastel-orange", iconColor: "text-pastel-orange-ink" },
};

export default function ConfirmationCard({ state = "success", heading, message, primaryAction, secondaryAction }) {
  if (state === "pending") {
    return (
      <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-3xl bg-surface shadow-soft px-8 py-10 text-center">
        <span className="mb-5 h-3 w-3 animate-pulse rounded-full bg-primary/60" aria-hidden="true" />
        <h2 className="font-display text-xl text-text">{heading}</h2>
        {message && <p className="mt-2 text-sm text-muted">{message}</p>}
      </div>
    );
  }

  const { Icon, iconBg, iconColor } = STATE_STYLES[state] ?? STATE_STYLES.success;

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col items-center rounded-3xl bg-surface px-8 py-10 text-center shadow-card">
      <span
        className={`mb-5 flex h-14 w-14 items-center justify-center rounded-full motion-safe:animate-[celebrate-pop_0.5s_ease-out] ${iconBg} ${iconColor}`}
      >
        <Icon />
      </span>
      <h2 className="font-display text-xl text-text">{heading}</h2>
      {message && <p className="mt-2 text-sm text-muted">{message}</p>}
      {(primaryAction || secondaryAction) && (
        <div className="mt-6 flex w-full flex-col gap-3">
          {primaryAction}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
