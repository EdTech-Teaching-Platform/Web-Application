// Step 04 — Review. Reverted to match the reference mockup exactly: three
// cards (Basics, Contact Details, Learning Profile), no Terms & Conditions
// card — the mockup doesn't show one, since the Terms step was removed from
// this flow. Every prior step already gated its own Continue, so "Go to
// Dashboard" doesn't re-validate — it's always enabled once Review is
// reached.
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import { register } from "../../../../auth/services/authApi";
import { useOnboarding } from "../../context/OnboardingContext";
import OnboardingLayout from "../../components/OnboardingLayout";

function ReviewCard({ title, onEdit, children, className = "" }) {
  return (
    <div className={`rounded-xl bg-bg px-5 py-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text/50">{title}</span>
        {onEdit && (
          <button type="button" onClick={onEdit} className="text-xs font-semibold text-primary hover:underline">
            Edit
          </button>
        )}
      </div>
      <div className="space-y-1 text-sm text-text">{children}</div>
    </div>
  );
}

function ReviewLine({ label, value }) {
  return (
    <p>
      <span className="font-semibold">{label}:</span> {value || "—"}
    </p>
  );
}

export default function OnboardingReview() {
  const navigate = useNavigate();
  const { form } = useOnboarding();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const goTo = (path) => navigate(`/student/onboarding/${path}`);

  const handleSubmit = async () => {
    setSubmitting(true);
    setError("");
    try {
      // This flow no longer collects email/phone + password (see
      // OnboardingContext) — using the contact phone number as a stand-in
      // identifier for the demo-mode register() call. Needs reconciling
      // with wherever real credentials actually get collected.
      await register({
        fullName: form.fullName.trim(),
        role: "student",
        identifier: form.phone.trim(),
        password: "",
      });
      // No OTP step after registration — per request, OTP verification is
      // only needed at login, not here. Straight to the dashboard once the
      // account is created.
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
      stepIndex={3}
      continueLabel={submitting ? "Creating account…" : "Go to Dashboard"}
      submitting={submitting}
      error={error}
      onBack={() => goTo("interests")}
      onContinue={handleSubmit}
    >
      <div className="space-y-4">
        <h2 className="font-display text-lg text-text">Review your details</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <ReviewCard title="Basics" onEdit={() => goTo("basics")}>
            <ReviewLine label="Name" value={form.fullName} />
            <ReviewLine label="Age" value={form.age} />
            <ReviewLine label="Grade" value={form.grade} />
            <ReviewLine label="School" value={[form.city, form.school].filter(Boolean).join(", ")} />
          </ReviewCard>
          <ReviewCard title="Contact Details" onEdit={() => goTo("details")}>
            <ReviewLine label="Phone" value={form.phone} />
            <ReviewLine label="Parent Phone" value={form.parentPhone} />
            <ReviewLine label="ID Uploaded" value={form.idFile ? "Yes" : "No"} />
          </ReviewCard>
          <ReviewCard title="Learning Profile" onEdit={() => goTo("interests")} className="sm:col-span-2">
            <ReviewLine label="Interests" value={form.interests.join(", ")} />
            <ReviewLine label="Goal" value={form.goal} />
          </ReviewCard>
        </div>
      </div>
    </OnboardingLayout>
  );
}
