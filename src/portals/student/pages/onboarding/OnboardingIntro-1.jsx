// Onboarding Intro / Welcome screen — LMS doc Sec 5.1/6.1 lists "...and an
// intro screen" as part of the onboarding flow. NOT counted in the numbered
// stepper (no ProgressSteps here) — it's a pure transition screen with a
// single CTA, no fields, so no validation gating.
//
// Reverted to the same centered-card shell (AuthCard) used by
// Register/Verify/Forgot/Reset, per request — the earlier full-bleed
// split-panel treatment with AuthBackdrop as placeholder hero art is gone.
import { useNavigate } from "react-router-dom";
import AuthCard from "../../../../auth/components/AuthCard";
import Button from "../../../../components/ui/Button";

export default function OnboardingIntro() {
  const navigate = useNavigate();

  return (
    <AuthCard
      title="Welcome to Universal Learning"
      subtitle="Let's personalize your learning experience — it only takes a minute."
    >
      <Button onClick={() => navigate("/student/onboarding/basics")}>Get Started</Button>
    </AuthCard>
  );
}
