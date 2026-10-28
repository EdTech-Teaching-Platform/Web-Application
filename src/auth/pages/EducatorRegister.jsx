// /teacher/register: educator sign-up (email + password, or Google).
// The sign-up is marked as an educator one before it starts (sessionStorage
// intent + user_metadata.signup_role), so the first profile is created by the
// server RPC educator_start_onboarding with the educator role, never as a
// student. Then the onboarding wizard (/teacher/onboarding) collects the
// application.
import React, { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Checkbox from "../../components/ui/Checkbox";
import { GoogleIcon } from "../../components/ui/icons";
import { isEmail, isStrongPassword } from "../utils/validators";
import { register, signInWithGoogle } from "../services/authApi";
import { ensureProfile } from "../../services/profileService";
import { AuthSplitLayout } from "../components/AuthKit";
import { PasswordChecklist } from "./Register";
import { clearEducatorIntent, setEducatorIntent, validateOnboarding } from "../../portals/teacher/utils/onboarding";

const ONBOARDING_PATH = "/teacher/onboarding";

export default function EducatorRegister() {
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [sentTo, setSentTo] = useState("");

  const errors = useMemo(() => {
    const e = {};
    const onboardingErrors = validateOnboarding({ full_name: fullName, phone: phone || "0000000", location: "xx" }, 1);
    if (onboardingErrors.full_name) e.fullName = onboardingErrors.full_name;
    if (phone.trim() && onboardingErrors.phone) e.phone = onboardingErrors.phone;
    if (!email.trim()) e.email = "Enter your email address.";
    else if (!isEmail(email)) e.email = "Enter a valid email address.";
    if (!password) e.password = "Create a password.";
    else if (!isStrongPassword(password)) e.password = "At least 8 characters, with 1 letter and 1 number.";
    if (!acceptedTerms) e.acceptedTerms = "Accept the Terms & Conditions to continue.";
    return e;
  }, [fullName, phone, email, password, acceptedTerms]);

  const isValid = Object.keys(errors).length === 0;
  const shown = (field) => (touched[field] ? errors[field] : undefined);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ fullName: true, phone: true, email: true, password: true, acceptedTerms: true });
    if (!isValid || submitting) return;
    setSubmitting(true);
    setFormError("");
    setEducatorIntent();
    try {
      const result = await register({ fullName, email, password, phone, role: "educator", redirect: ONBOARDING_PATH });
      if (result.session && result.user) {
        const profile = await ensureProfile(result.user);   // educator_start_onboarding (see profileService)
        clearEducatorIntent();
        if (profile?.role && profile.role !== "educator") {
          setFormError(`This email is registered as a ${profile.role} account. Use a different email to register as an educator.`);
          return;
        }
        navigate(ONBOARDING_PATH, { replace: true });
        return;
      }
      setSentTo(email.trim());   // confirm by email; the link comes back through /auth/callback
    } catch (err) {
      clearEducatorIntent();
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleSubmitting(true);
    setFormError("");
    setEducatorIntent();
    try {
      await signInWithGoogle({ redirect: ONBOARDING_PATH });
    } catch (err) {
      clearEducatorIntent();
      setFormError(err.message);
      setGoogleSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout variant="educator">
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
        Become an educator
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-text/60">
        Create your account, then tell us about your teaching and verify your ID. Our team reviews every application.
      </p>

      {sentTo ? (
        <div className="mt-6 rounded-2xl bg-primary/10 p-6 text-center" role="status">
          <p className="font-medium text-text">Check your inbox</p>
          <p className="mt-2 text-sm text-text/70">
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it to continue your educator application.
          </p>
          <div className="mt-6">
            <Button as={Link} to="/teacher/login" variant="ink">Go to Log In</Button>
          </div>
        </div>
      ) : (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          {formError && (
            <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {formError}{" "}
              {/already exists/.test(formError) && <Link to="/teacher/login" className="font-medium underline">Log in</Link>}
            </p>
          )}

          <Input label="Full Name" placeholder="Dr. Asha Rao" value={fullName} onChange={(e) => setFullName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, fullName: true }))} error={shown("fullName")} autoComplete="name" />
          <Input label="Phone (optional)" type="tel" placeholder="+91 98765 43210" value={phone} onChange={(e) => setPhone(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, phone: true }))} error={shown("phone")} autoComplete="tel" />
          <Input label="Email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))} error={shown("email")} autoComplete="email" />
          <div>
            <Input label="Password" type="password" placeholder="At least 8 characters" value={password}
              onChange={(e) => setPassword(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              error={shown("password")} autoComplete="new-password" />
            <PasswordChecklist value={password} />
          </div>
          <div>
            <Checkbox
              label={<>I agree to the <Link to="/terms" className="font-medium text-primary hover:underline">Terms &amp; Conditions</Link></>}
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              onBlur={() => setTouched((t) => ({ ...t, acceptedTerms: true }))}
            />
            {shown("acceptedTerms") && <span className="mt-1.5 block text-xs text-danger">{shown("acceptedTerms")}</span>}
          </div>

          <Button type="submit" variant="ink" disabled={!isValid || submitting}>
            {submitting ? "Creating account…" : "Create educator account"}
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-text/40">
            <span className="h-px flex-1 bg-text/10" />
            Or continue with
            <span className="h-px flex-1 bg-text/10" />
          </div>
          <Button type="button" variant="social" onClick={handleGoogle} disabled={googleSubmitting} className="w-full justify-center">
            <GoogleIcon /> {googleSubmitting ? "Connecting to Google…" : "Continue with Google"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-text/60">
        Already an educator? <Link to="/teacher/login" className="font-medium text-primary hover:underline">Log in</Link>
      </p>
    </AuthSplitLayout>
  );
}
