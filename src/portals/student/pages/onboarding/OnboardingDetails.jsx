// Step 02 — Details (Contact). Parent/Guardian Number is required per the
// doc (listed as a captured field in the core onboarding flow, not marked
// optional anywhere) — ID Card Upload is the one optional field on this
// step and does not gate Continue.
import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Input from "../../../../components/ui/Input";
import FileDropzone from "../../../../components/ui/FileDropzone";
import { isPhone } from "../../../../auth/utils/validators";
import { useOnboarding } from "../../context/OnboardingContext";
import OnboardingLayout from "../../components/OnboardingLayout";

function FieldLabel({ children }) {
  return <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text/60">{children}</span>;
}

export default function OnboardingDetails() {
  const navigate = useNavigate();
  const { form, set } = useOnboarding();

  const isValid = useMemo(
    () => isPhone(form.phone) && isPhone(form.parentPhone),
    [form.phone, form.parentPhone]
  );

  return (
    <OnboardingLayout
      title="Welcome, let's get you set up."
      stepIndex={1}
      continueDisabled={!isValid}
      onBack={() => navigate("/student/onboarding/basics")}
      onContinue={() => navigate("/student/onboarding/interests")}
    >
      <div className="space-y-6">
        <h2 className="font-display text-lg text-text">Your contact details.</h2>

        <div>
          <FieldLabel>Phone Number</FieldLabel>
          <Input placeholder="(555) 123-4567" value={form.phone} onChange={(e) => set("phone")(e.target.value)} />
        </div>

        <div>
          <FieldLabel>Parent/Guardian Number</FieldLabel>
          <Input
            placeholder="(555) 987-6543"
            value={form.parentPhone}
            onChange={(e) => set("parentPhone")(e.target.value)}
          />
        </div>

        <div>
          <FieldLabel>ID Card Upload</FieldLabel>
          <FileDropzone label="Upload ID card (optional)" file={form.idFile} onFileSelect={set("idFile")} />
        </div>
      </div>
    </OnboardingLayout>
  );
}
