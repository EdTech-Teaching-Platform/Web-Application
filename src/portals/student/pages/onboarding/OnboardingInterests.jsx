// Step 03 (final) — Interests & Goals. The Review step has been removed
// per request — this is now the last step, so its Continue button creates
// the account directly instead of navigating to a Review screen.
// Cardinality: interests is multi-select (a student can reasonably want to
// learn more than one subject), goal is single-select. Confirm with
// product/backend before finalizing the data shape — the doc itself
// doesn't state cardinality explicitly.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Chip from "../../../../components/ui/Chip";
import { register } from "../../../../auth/services/authApi";
import { useOnboarding, PENDING_SIGNUP_STORAGE_KEY } from "../../context/OnboardingContext";
import OnboardingLayout from "../../components/OnboardingLayout";

const SUBJECTS = ["Programming", "Math", "Science", "Languages", "Music", "Design", "Business", "Other"];
const GOALS = ["Exam Prep", "Skill Building", "Hobby Learning", "Career Growth"];

export default function OnboardingInterests() {
  const navigate = useNavigate();
  const { form, toggleInterest, set } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const isValid = useMemo(
    () => form.interests.length > 0 && Boolean(form.goal),
    [form.interests, form.goal]
  );

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      // form.email/form.password were carried over from the standalone
      // Sign Up page (src/auth/pages/Register.jsx) via OnboardingContext's
      // sessionStorage bridge — that's the real signup credential, so use
      // it as the identifier/password here instead of the old phone-as-
      // identifier / empty-password stand-in. Falls back to the contact
      // phone number if onboarding was somehow reached without going
      // through Sign Up first (defensive, shouldn't normally happen).
      await register({
        fullName: form.fullName.trim(),
        role: "student",
        identifier: form.email.trim() || form.phone.trim(),
        password: form.password || "",
      });
      try {
        sessionStorage.removeItem(PENDING_SIGNUP_STORAGE_KEY);
      } catch {
        // best-effort cleanup only
      }
      // No OTP step after registration — OTP is only needed at login.
      navigate("/student/dashboard");
    } catch {
      setError("Something went wrong creating your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <OnboardingLayout
      title="Welcome, let's get you set up."
      stepIndex={2}
      continueDisabled={!isValid}
      continueLabel={submitting ? "Creating account…" : "Go to Dashboard"}
      submitting={submitting}
      error={error}
      onBack={() => navigate("/student/onboarding/details")}
      onContinue={handleSubmit}
    >
      <div className="space-y-8">
        <div>
          <h2 className="mb-3 font-display text-lg text-text">What do you want to learn?</h2>
          <div className="flex flex-wrap gap-3">
            {SUBJECTS.map((s) => (
              <Chip key={s} active={form.interests.includes(s)} onClick={() => toggleInterest(s)}>
                {s}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <h2 className="mb-3 font-display text-lg text-text">What's your learning goal?</h2>
          <div className="flex flex-wrap gap-3">
            {GOALS.map((g) => (
              <Chip key={g} active={form.goal === g} onClick={() => set("goal")(g)}>
                {g}
              </Chip>
            ))}
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
