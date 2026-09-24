// Registration (email/phone signup) — LMS doc Sec 5.1.
// Doubles as Student + Educator signup (doc: registration is used by
// both roles) — see the required role Chip below.
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Chip from "../../components/ui/Chip";
import Checkbox from "../../components/ui/Checkbox";
import { GoogleIcon, AppleIcon } from "../../components/ui/icons";
import { isEmailOrPhone, isStrongPassword } from "../utils/validators";
import { register } from "../services/authApi";

const initialForm = {
  fullName: "",
  role: "", // "student" | "educator" — no default, force an explicit choice
  identifier: "",
  password: "",
  confirmPassword: "",
  acceptedTerms: false,
};

export default function Register() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const errors = useMemo(() => {
    const e = {};
    if (!form.fullName.trim()) e.fullName = "Enter your full name.";
    else if (form.fullName.trim().length < 2) e.fullName = "Full name is too short.";

    if (!form.role) e.role = "Choose whether you're a Student or an Educator.";

    if (!form.identifier.trim()) e.identifier = "Enter your email or phone number.";
    else if (!isEmailOrPhone(form.identifier)) e.identifier = "Enter a valid email or phone number.";

    if (!form.password) e.password = "Create a password.";
    else if (!isStrongPassword(form.password))
      e.password = "At least 8 characters, with 1 letter and 1 number.";

    if (!form.confirmPassword) e.confirmPassword = "Confirm your password.";
    else if (form.confirmPassword !== form.password) e.confirmPassword = "Passwords don't match.";

    if (!form.acceptedTerms) e.acceptedTerms = "You must accept the Terms to continue.";

    return e;
  }, [form]);

  const isValid = Object.keys(errors).length === 0;

  const update = (field) => (e) => {
    const value = field === "acceptedTerms" ? e.target.checked : e.target.value;
    setForm((f) => ({ ...f, [field]: value }));
  };

  const markTouched = (field) => () => setTouched((t) => ({ ...t, [field]: true }));
  const shown = (field) => (touched[field] ? errors[field] : undefined);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({
      fullName: true,
      role: true,
      identifier: true,
      password: true,
      confirmPassword: true,
      acceptedTerms: true,
    });
    if (!isValid) return;

    setSubmitting(true);
    setSubmitError("");
    try {
      await register({
        fullName: form.fullName.trim(),
        role: form.role,
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

  return (
    <AuthCard
      eyebrow="Get started"
      title="Create your account"
      subtitle="Join Universal Learning as a student or an educator."
      footer={
        <p className="text-center text-sm text-text/60">
          Already have an account?{" "}
          <Link to="/login" className="font-medium text-primary hover:underline">
            Log In
          </Link>
        </p>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {submitError && <p className="text-sm text-danger">{submitError}</p>}

        <Input
          label="Full Name"
          placeholder="Jordan Lee"
          value={form.fullName}
          onChange={update("fullName")}
          onBlur={markTouched("fullName")}
          error={shown("fullName")}
          autoComplete="name"
        />

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">I am a...</span>
          <div className="flex gap-3">
            <Chip active={form.role === "student"} onClick={() => setForm((f) => ({ ...f, role: "student" }))}>
              Student
            </Chip>
            <Chip active={form.role === "educator"} onClick={() => setForm((f) => ({ ...f, role: "educator" }))}>
              Educator
            </Chip>
          </div>
          {shown("role") && <span className="mt-1.5 block text-xs text-danger">{shown("role")}</span>}
        </div>

        <Input
          label="Email or Phone"
          placeholder="you@example.com or +1 555 000 0000"
          value={form.identifier}
          onChange={update("identifier")}
          onBlur={markTouched("identifier")}
          error={shown("identifier")}
          autoComplete="username"
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 8 characters"
          value={form.password}
          onChange={update("password")}
          onBlur={markTouched("password")}
          error={shown("password")}
          autoComplete="new-password"
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Re-enter your password"
          value={form.confirmPassword}
          onChange={update("confirmPassword")}
          onBlur={markTouched("confirmPassword")}
          error={shown("confirmPassword")}
          autoComplete="new-password"
        />

        <div>
          <Checkbox
            label={
              <>
                I agree to the{" "}
                <Link to="/terms" className="font-medium text-primary hover:underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link to="/privacy" className="font-medium text-primary hover:underline">
                  Privacy Policy
                </Link>
              </>
            }
            checked={form.acceptedTerms}
            onChange={update("acceptedTerms")}
            onBlur={markTouched("acceptedTerms")}
          />
          {shown("acceptedTerms") && (
            <span className="mt-1.5 block text-xs text-danger">{shown("acceptedTerms")}</span>
          )}
        </div>

        <Button type="submit" disabled={!isValid || submitting}>
          {submitting ? "Creating account…" : "Create Account"}
        </Button>

        {form.role !== "educator" && (
          <>
            <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-text/40">
              <span className="h-px flex-1 bg-text/10" />
              Or continue with
              <span className="h-px flex-1 bg-text/10" />
            </div>
            <div className="flex gap-3">
              <Button type="button" variant="social" onClick={() => {}}>
                <GoogleIcon /> Google
              </Button>
              <Button type="button" variant="social" onClick={() => {}}>
                <AppleIcon /> Apple
              </Button>
            </div>
          </>
        )}
        {/* LMS doc Sec 5.1 parenthesizes social login as "(Students)" —
            hidden once Educator is chosen. Before role is chosen, it's
            still shown (matches the mockup default state); confirm this
            reading with backend before shipping. */}
      </form>
    </AuthCard>
  );
}
