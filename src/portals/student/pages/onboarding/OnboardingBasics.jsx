// Step 01 — Basics. Per LMS doc Sec 5.1 Student Onboarding field list:
// name/age/city/school plus grade/class (1st–12th). Grade is now a full
// 1st–12th dropdown — a 12-option chip row doesn't fit well, and a Select
// matches the doc's full range better than the 4-chip 9th–12th-only version
// used earlier. Age is back too. Email/Phone/Password/Confirm Password are
// still not collected here — the doc's field list for this step doesn't
// include them.
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../../../components/ui/Input";
import { useOnboarding } from "../../context/OnboardingContext";
import OnboardingLayout from "../../components/OnboardingLayout";

const ORDINAL = (n) => {
  if (n === 11 || n === 12 || n === 13) return `${n}th`;
  const last = n % 10;
  if (last === 1) return `${n}st`;
  if (last === 2) return `${n}nd`;
  if (last === 3) return `${n}rd`;
  return `${n}th`;
};
const GRADES = Array.from({ length: 12 }, (_, i) => `${ORDINAL(i + 1)} Grade`);

function FieldLabel({ children }) {
  return <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text/60">{children}</span>;
}

export default function OnboardingBasics() {
  const navigate = useNavigate();
  const { form, set } = useOnboarding();

  const isValid = useMemo(
    () =>
      form.fullName.trim().length >= 2 &&
      form.age.trim().length > 0 &&
      Boolean(form.grade) &&
      form.city.trim().length > 0 &&
      form.school.trim().length > 0,
    [form]
  );

  return (
    <OnboardingLayout
      title="Welcome, let's get you set up."
      stepIndex={0}
      continueDisabled={!isValid}
      onContinue={() => navigate("/student/onboarding/details")}
    >
      <div className="space-y-6">
        <h2 className="font-display text-lg text-text">Basic Information</h2>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <FieldLabel>Full Name</FieldLabel>
            <Input placeholder="Alex Student" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Age</FieldLabel>
            <Input
              type="number"
              min="1"
              placeholder="e.g. 14"
              value={form.age}
              onChange={(e) => set("age")(e.target.value)}
            />
          </div>
        </div>

        <div>
          <FieldLabel>Grade Level</FieldLabel>
          <select
            className="w-full rounded-xl border border-text/15 bg-bg px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none"
            value={form.grade}
            onChange={(e) => set("grade")(e.target.value)}
          >
            <option value="">Select grade</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>
                {g}
              </option>
            ))}
          </select>
        </div>

        <div className="grid gap-6 sm:grid-cols-2">
          <div>
            <FieldLabel>City</FieldLabel>
            <Input placeholder="e.g. Seattle" value={form.city} onChange={(e) => set("city")(e.target.value)} />
          </div>
          <div>
            <FieldLabel>Current School</FieldLabel>
            <Input placeholder="e.g. Lincoln High" value={form.school} onChange={(e) => set("school")(e.target.value)} />
          </div>
        </div>
      </div>
    </OnboardingLayout>
  );
}
