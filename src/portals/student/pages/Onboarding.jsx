// Student Onboarding — LMS doc Sec 5.1 / Sec 6.1: "Multi-step flow:
// grade/class (1st–12th), interests and learning goals, name/age/city/
// school, phone and a parent contact number, optional ID upload, and an
// intro screen." Comes right after OTP verification in the Student
// Journey (Register → Verify → Onboard → ...).
//
// Reworked per explicit instruction: the standalone Registration screen is
// gone. This wizard is now the entry point for new students — Basics
// (step 1) absorbs the account-creation fields (Email/Phone, Password,
// Confirm Password, Terms) that used to live on /register, so there's one
// continuous flow instead of two. OTP verification still happens, but now
// AFTER onboarding: Review's final button creates the account, then routes
// to /verify-otp. Educator sign-up isn't handled here — see
// src/portals/teacher/pages/Registration.jsx (still a TODO stub) — since
// this wizard collects student-specific fields (grade, school, parent
// contact) that don't apply to educators.
//
// Basics/Details/Interests/Review structure, copy, and layout are
// unchanged from the original 4 mockups — only Basics gained the account
// fields.
import { useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Chip from "../../../components/ui/Chip";
import Checkbox from "../../../components/ui/Checkbox";
import FileDropzone from "../../../components/ui/FileDropzone";
import ProgressSteps from "../../../components/ui/ProgressSteps";
import { isEmailOrPhone, isStrongPassword } from "../../../auth/utils/validators";
import { register } from "../../../auth/services/authApi";
import AuthBackdrop from "../../../components/ui/AuthBackdrop";

const STEPS = ["Basics", "Details", "Interests", "Review"];
const GRADES = ["9th Grade", "10th Grade", "11th Grade", "12th Grade"];
const SUBJECTS = ["Programming", "Math", "Science", "Languages", "Music", "Design", "Business", "Other"];
const GOALS = ["Exam Prep", "Skill Building", "Hobby Learning", "Career Growth"];

const initialForm = {
  fullName: "",
  identifier: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
  grade: "",
  city: "",
  school: "",
  phone: "",
  parentPhone: "",
  idFile: null,
  interest: "",
  goal: "",
};

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const set = (field) => (value) => setForm((f) => ({ ...f, [field]: value }));

  // Same disabled-until-valid rule as every other form in the product —
  // Continue only enables once the current step's required fields are
  // filled. ID card upload is explicitly optional per the mockup's own
  // label, so it's excluded from the Details-step check.
  const stepValid = useMemo(() => {
    switch (step) {
      case 0:
        return (
          form.fullName.trim().length >= 2 &&
          isEmailOrPhone(form.identifier) &&
          isStrongPassword(form.password) &&
          form.confirmPassword.length > 0 &&
          form.confirmPassword === form.password &&
          form.acceptedTerms &&
          Boolean(form.grade) &&
          form.city.trim().length > 0 &&
          form.school.trim().length > 0
        );
      case 1:
        return form.phone.trim().length > 0 && form.parentPhone.trim().length > 0;
      case 2:
        return Boolean(form.interest) && Boolean(form.goal);
      default:
        return true;
    }
  }, [step, form]);

  const goNext = async () => {
    if (!stepValid) return;
    if (step < STEPS.length - 1) {
      setStep((s) => s + 1);
      return;
    }
    // Final step: create the account, then hand off to OTP verification —
    // onboarding now happens before verification, not after.
    setSubmitting(true);
    setSubmitError("");
    try {
      await register({
        fullName: form.fullName.trim(),
        role: "student",
        identifier: form.identifier.trim(),
        password: form.password,
      });
      navigate(`/verify-otp?mode=register&destination=${encodeURIComponent(form.identifier.trim())}`);
    } catch {
      setSubmitError("Something went wrong creating your account. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };
  const goBack = () => setStep((s) => Math.max(0, s - 1));
  const goBackToLastPage = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-bg">
      <AuthBackdrop />

      <header className="relative flex items-center justify-between border-b border-text/10 px-6 py-4 sm:px-10">
        <button type="button" onClick={goBackToLastPage} className="font-display text-lg tracking-tight text-primary">Universal Learning</button>
        <span className="text-xs font-semibold uppercase tracking-wide text-text/40">Onboarding</span>
      </header>

      <div className="relative mx-auto max-w-3xl px-6 py-10 sm:px-10">
        <h1 className="font-display text-2xl text-text">Welcome, let's get you set up.</h1>

        <div className="mt-8 max-w-xl">
          <ProgressSteps steps={STEPS} currentIndex={step} />
        </div>

        <div className="mt-8 rounded-2xl p-6 sm:p-8" style={{ background: "var(--color-blush)" }}>
          {step === 0 && <BasicsStep form={form} set={set} />}
          {step === 1 && <DetailsStep form={form} set={set} />}
          {step === 2 && <InterestsStep form={form} set={set} />}
          {step === 3 && <ReviewStep form={form} onEdit={setStep} />}
        </div>

        {submitError && <p className="mt-4 text-sm text-danger">{submitError}</p>}

        <div className="mt-8 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="secondary" fullWidth={false} className="px-7" onClick={goBack}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <Button fullWidth={false} className="px-8" disabled={!stepValid || submitting} onClick={goNext}>
            {submitting
              ? "Creating account…"
              : step === STEPS.length - 1
                ? "Create Account"
                : "Continue"}
          </Button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text/60">{children}</span>;
}

function BasicsStep({ form, set }) {
  return (
    <div className="space-y-6">
      <h2 className="font-display text-lg text-text">Basic Information</h2>

      <div>
        <FieldLabel>Full Name</FieldLabel>
        <Input placeholder="Alex Student" value={form.fullName} onChange={(e) => set("fullName")(e.target.value)} />
      </div>

      <div>
        <FieldLabel>Email or Phone</FieldLabel>
        <Input
          placeholder="you@example.com or +1 555 000 0000"
          value={form.identifier}
          onChange={(e) => set("identifier")(e.target.value)}
          autoComplete="username"
        />
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        <div>
          <FieldLabel>Password</FieldLabel>
          <Input
            type="password"
            placeholder="At least 8 characters"
            value={form.password}
            onChange={(e) => set("password")(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div>
          <FieldLabel>Confirm Password</FieldLabel>
          <Input
            type="password"
            placeholder="Re-enter your password"
            value={form.confirmPassword}
            onChange={(e) => set("confirmPassword")(e.target.value)}
            autoComplete="new-password"
          />
        </div>
      </div>

      <Checkbox
        label="I agree to the Terms of Service and Privacy Policy"
        checked={form.acceptedTerms}
        onChange={(e) => set("acceptedTerms")(e.target.checked)}
      />

      <div>
        <FieldLabel>Grade Level</FieldLabel>
        <div className="flex flex-wrap gap-3">
          {GRADES.map((g) => (
            <Chip key={g} active={form.grade === g} onClick={() => set("grade")(g)}>
              {g}
            </Chip>
          ))}
        </div>
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
  );
}

function DetailsStep({ form, set }) {
  return (
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
  );
}

function InterestsStep({ form, set }) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="mb-3 font-display text-lg text-text">What do you want to learn?</h2>
        <div className="flex flex-wrap gap-3">
          {SUBJECTS.map((s) => (
            <Chip key={s} active={form.interest === s} onClick={() => set("interest")(s)}>
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
  );
}

function ReviewStep({ form, onEdit }) {
  return (
    <div className="space-y-4">
      <h2 className="font-display text-lg text-text">Review your details</h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <ReviewCard title="Basics" onEdit={() => onEdit(0)}>
          <ReviewLine label="Name" value={form.fullName} />
          <ReviewLine label="Email/Phone" value={form.identifier} />
          <ReviewLine label="Grade" value={form.grade} />
          <ReviewLine label="School" value={[form.city, form.school].filter(Boolean).join(", ")} />
        </ReviewCard>
        <ReviewCard title="Contact Details" onEdit={() => onEdit(1)}>
          <ReviewLine label="Phone" value={form.phone} />
          <ReviewLine label="Parent Phone" value={form.parentPhone} />
          <ReviewLine label="ID Uploaded" value={form.idFile ? "Yes" : "No"} />
        </ReviewCard>
        <ReviewCard title="Learning Profile" onEdit={() => onEdit(2)} className="sm:col-span-2">
          <ReviewLine label="Interests" value={form.interest} />
          <ReviewLine label="Goal" value={form.goal} />
        </ReviewCard>
      </div>
    </div>
  );
}

function ReviewCard({ title, onEdit, children, className = "" }) {
  return (
    <div className={`rounded-xl bg-bg px-5 py-4 ${className}`}>
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-text/50">{title}</span>
        <button type="button" onClick={onEdit} className="text-xs font-semibold text-primary hover:underline">
          Edit
        </button>
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
