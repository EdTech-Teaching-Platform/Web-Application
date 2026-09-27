import ProgressSteps from "../../../components/ui/ProgressSteps";

// Trimmed to 3 steps per request: Basics → Details → Interests. The Review
// step is gone — Interests is now the final step and creates the account.
const STEPS = ["Basics", "Details", "Interests"];

// currentIndex is 0-based (0 = Basics … 2 = Interests).
export default function OnboardingStepper({ currentIndex }) {
  return <ProgressSteps steps={STEPS} currentIndex={currentIndex} />;
}
