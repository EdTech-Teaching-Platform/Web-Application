import { Link } from "react-router-dom";
import Button from "../../../components/ui/Button";
import OnboardingStepper from "./OnboardingStepper";
import AuthBackdrop from "../../../components/ui/AuthBackdrop";
import { ArrowLeftIcon } from "../../../components/ui/icons";

// Shared chrome for the 4 numbered onboarding steps (Basics…Review) — one
// bounded outer card (logo row, heading, stepper, the step's own blush
// panel, and the footer nav all inside it) sitting on top of the decorative
// AuthBackdrop doodles. A hairline border lifts the white/cream card off
// the busy background per design.md's shadow guidance (a soft border
// instead of a shadow, not both).
export default function OnboardingLayout({
  title,
  stepIndex,
  children,
  onBack,
  onContinue,
  continueDisabled = false,
  continueLabel = "Continue",
  submitting = false,
  error = "",
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center px-4 py-10">
      <AuthBackdrop />
      <div className="relative z-10 w-full max-w-2xl rounded-2xl border border-text/10 bg-bg px-8 py-10 sm:px-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg tracking-tight text-primary">
            Universal Learning
          </Link>
          <Link to="/" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-text/10 bg-white px-3 py-2 text-xs font-semibold text-text/65 shadow-sm transition-colors hover:border-primary/30 hover:text-primary">
            <ArrowLeftIcon className="h-4 w-4" /> Back to home
          </Link>
        </div>

        {title && <h1 className="font-display text-2xl text-text">{title}</h1>}

        <div className="mt-6">
          <OnboardingStepper currentIndex={stepIndex} />
        </div>

        <div className="mt-8 rounded-2xl p-6 sm:p-8" style={{ background: "var(--color-blush)" }}>
          {children}
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        {/* The per-step "Back" (previous step) control has been removed
            from the onboarding flow per request — steps only move
            forward now. OnboardingStepper above is left untouched: it's
            just a progress indicator, not a navigation control. `onBack`
            is still accepted as a prop (harmless no-op) so step files
            don't need to be touched individually. */}
        <div className="mt-8 flex items-center justify-end">
          <Button
            fullWidth={false}
            className="px-8"
            disabled={continueDisabled || submitting}
            onClick={onContinue}
          >
            {submitting ? "Please wait…" : continueLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
