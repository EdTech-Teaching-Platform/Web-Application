import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import OnboardingStepper from "./OnboardingStepper";
import { AuthFrame, BrandMark } from "../../../auth/components/AuthKit";

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
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  return (
    <AuthFrame top>
      <div className="relative w-full max-w-2xl rounded-[36px] bg-white px-6 py-8 shadow-[0_30px_80px_rgba(37,87,214,0.18)] ring-1 ring-(--lp-line) sm:px-10 sm:py-10">
        {/* Brand mark still links home (same rule as before); no back
            control anywhere in the flow. */}
        <div className="mb-7 flex items-center justify-between gap-3">
          <button type="button" onClick={goBack} className="inline-flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-(--lp-ink)">
            <BrandMark className="h-9 w-9" />
            Universal Learning
          </button>
          <span className="rounded-full bg-(--lp-yellow) px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-(--lp-ink)">Student setup</span>
        </div>

        {title && <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-(--lp-ink)">{title}</h1>}

        <div className="mt-6 rounded-3xl bg-(--lp-grey) px-4 py-4 sm:px-6">
          <OnboardingStepper currentIndex={stepIndex} />
        </div>

        <div className="mt-6 rounded-3xl bg-(--lp-blue-tint) p-6 ring-1 ring-(--lp-blue-soft) sm:p-8" style={{ "--color-blush": "var(--lp-blue-tint)" }}>
          {children}
        </div>

        {error && <p className="mt-4 text-sm text-danger">{error}</p>}

        {/* Steps only move forward; `onBack` stays accepted as a no-op prop. */}
        <div className="mt-8 flex items-center justify-end">
          <Button
            variant="ink"
            fullWidth={false}
            className="px-8"
            disabled={continueDisabled || submitting}
            onClick={onContinue}
          >
            {submitting ? "Please wait…" : continueLabel}
          </Button>
        </div>
      </div>
    </AuthFrame>
  );
}
