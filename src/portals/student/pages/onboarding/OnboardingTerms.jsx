// Step 04 — Terms & Conditions Acceptance. LMS doc Sec 5.1 + the August 2026
// Data Privacy & Consent Management addition. This step cannot be bypassed:
// Continue stays disabled until the required consent(s) are given, and on
// submit we record acceptance with a timestamp and the document version
// accepted — for minors, alongside a separate, explicitly-tracked parent-
// acknowledgment flag (never merged into the main Terms checkbox). That
// event is what Section 5.1's "Terms & Conditions Acceptance" and the Data
// Privacy addition both key off of.
import { useNavigate, Link } from "react-router-dom";
import Checkbox from "../../../../components/ui/Checkbox";
import { useOnboarding, CURRENT_TERMS_VERSION } from "../../context/OnboardingContext";
import OnboardingLayout from "../../components/OnboardingLayout";

// Plain-language summary only — not the full legal document. The two
// standalone pages linked below carry the actual Terms/Privacy content.
const SUMMARY_POINTS = [
  "What we collect: your profile, course activity and progress, assessment records, and payment history.",
  "How it's used: to run your courses, live classes and certificates — and, only if you opt in later, for product analytics or marketing.",
  "We don't sell your data, ever.",
  "You can request an export or deletion of your data any time from Account Settings once your account exists.",
];

// LMS doc: age 5–19 is the onboarding range; anyone under 18 needs the
// separate parent-acknowledgment consent alongside the main checkbox.
const isMinor = (age) => {
  const n = Number(age);
  return Number.isFinite(n) && n < 18;
};

export default function OnboardingTerms() {
  const navigate = useNavigate();
  const { form, set } = useOnboarding();
  const minor = isMinor(form.age);

  const canContinue = form.termsAccepted && (!minor || form.parentAcknowledged);

  const handleContinue = () => {
    // Record the acceptance event itself — timestamp + version accepted —
    // at the moment the user actually moves on, not when the checkbox is
    // first ticked (they could still go Back and uncheck it before this).
    set("termsAcceptedAt")(new Date().toISOString());
    set("termsVersion")(CURRENT_TERMS_VERSION);
    navigate("/student/onboarding/review");
  };

  return (
    <OnboardingLayout
      title="Terms & Privacy"
      stepIndex={3}
      continueDisabled={!canContinue}
      onBack={() => navigate("/student/onboarding/interests")}
      onContinue={handleContinue}
    >
      <div className="space-y-6">
        <div>
          <h2 className="font-display text-lg text-text">Terms &amp; Privacy</h2>
          <p className="mt-1 text-sm text-text/60">
            A quick summary of what you're agreeing to before we create your account.
          </p>
        </div>

        <div className="max-h-56 overflow-y-auto rounded-xl bg-bg px-5 py-4 text-sm leading-relaxed text-text/70">
          <ul className="space-y-2.5">
            {SUMMARY_POINTS.map((point) => (
              <li key={point} className="flex gap-2.5">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" aria-hidden="true" />
                <span>{point}</span>
              </li>
            ))}
          </ul>
        </div>

        <p className="text-sm text-text/60">
          Read the full{" "}
          <Link
            to="/terms"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Terms &amp; Conditions
          </Link>{" "}
          and{" "}
          <Link
            to="/privacy"
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            Privacy Policy
          </Link>
          .
        </p>

        <Checkbox
          label="I agree to the Terms & Conditions and Privacy Policy."
          checked={form.termsAccepted}
          onChange={(e) => set("termsAccepted")(e.target.checked)}
        />

        {/* Under-18 only — its own explicit, separately-tracked consent, tied
            to the parent/guardian phone number already captured in Details.
            Deliberately never merged into the checkbox above. */}
        {minor && (
          <Checkbox
            label={
              <>
                My parent/guardian has reviewed this with me
                {form.parentPhone ? ` (contacted at ${form.parentPhone}).` : "."}
              </>
            }
            checked={form.parentAcknowledged}
            onChange={(e) => set("parentAcknowledged")(e.target.checked)}
          />
        )}
      </div>
    </OnboardingLayout>
  );
}
