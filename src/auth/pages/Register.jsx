// Sign up: full name, email, password (Supabase Auth signUp with
// emailRedirectTo /auth/callback). With email confirmation off (development)
// the user is signed in at once; with it on, they confirm by email first.
// The profiles row is created by ensureProfile (role is always student).
import React, { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Checkbox from "../../components/ui/Checkbox";
import { GoogleIcon } from "../../components/ui/icons";
import { isEmail, isStrongPassword, passwordChecks, safeRedirect } from "../utils/validators";
import { register, signInWithGoogle } from "../services/authApi";
import { ensureProfile } from "../../services/profileService";
import { AuthSplitLayout } from "../components/AuthKit";

export function PasswordChecklist({ value }) {
  return (
    <ul className="mt-2 space-y-1 text-xs" aria-label="Password requirements">
      {passwordChecks(value).map((c) => (
        <li key={c.id} className={c.ok ? "text-success" : "text-text/50"}>
          <span aria-hidden="true">{c.ok ? "✓" : "•"}</span> {c.label}
          <span className="sr-only">{c.ok ? " (met)" : " (not met)"}</span>
        </li>
      ))}
    </ul>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const originPath = safeRedirect(searchParams.get("redirect"));
  const [fullName, setFullName] = useState("");
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
    if (!fullName.trim()) e.fullName = "Enter your full name.";
    else if (fullName.trim().length < 2) e.fullName = "Full name is too short.";
    if (!email.trim()) e.email = "Enter your email address.";
    else if (!isEmail(email)) e.email = "Enter a valid email address.";
    if (!password) e.password = "Create a password.";
    else if (!isStrongPassword(password)) e.password = "At least 8 characters, with 1 letter and 1 number.";
    if (!acceptedTerms) e.acceptedTerms = "Accept the Terms & Conditions to continue.";
    return e;
  }, [fullName, email, password, acceptedTerms]);

  const isValid = Object.keys(errors).length === 0;
  const shown = (field) => (touched[field] ? errors[field] : undefined);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true, acceptedTerms: true });
    if (!isValid) return;

    setSubmitting(true);
    setFormError("");
    try {
      const result = await register({ fullName, email, password, redirect: originPath });
      if (result.session && result.user) {
        await ensureProfile(result.user);
        navigate(originPath || "/student/dashboard", { replace: true });
        return;
      }
      setSentTo(email.trim());
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleSubmitting(true);
    setFormError("");
    try {
      await signInWithGoogle({ redirect: originPath });
    } catch (err) {
      setFormError(err.message);
      setGoogleSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout variant="signup">
      <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
        Create your account
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-text/60">Join Universal Learning and start practising today.</p>

      {sentTo ? (
        <div className="mt-6 rounded-2xl bg-primary/10 p-6 text-center" role="status">
          <p className="font-medium text-text">Check your inbox</p>
          <p className="mt-2 text-sm text-text/70">
            We sent a confirmation link to <strong>{sentTo}</strong>. Open it to finish creating your account.
          </p>
          <div className="mt-6">
            <Button as={Link} to="/login" variant="ink">Go to Log In</Button>
          </div>
        </div>
      ) : (
        <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
          {formError && (
            <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              {formError}{" "}
              {/already exists/.test(formError) && (
                <Link to="/login" className="font-medium underline">Log in</Link>
              )}
            </p>
          )}

          <Input
            label="Full Name"
            placeholder="Alex Student"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
            error={shown("fullName")}
            autoComplete="name"
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => setTouched((t) => ({ ...t, email: true }))}
            error={shown("email")}
            autoComplete="email"
          />

          <div>
            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              error={shown("password")}
              autoComplete="new-password"
            />
            <PasswordChecklist value={password} />
          </div>

          <div>
            <Checkbox
              label={
                <>
                  I agree to the{" "}
                  <Link to="/terms" className="font-medium text-primary hover:underline">
                    Terms &amp; Conditions
                  </Link>
                </>
              }
              checked={acceptedTerms}
              onChange={(e) => setAcceptedTerms(e.target.checked)}
              onBlur={() => setTouched((t) => ({ ...t, acceptedTerms: true }))}
            />
            {shown("acceptedTerms") && (
              <span className="mt-1.5 block text-xs text-danger">{shown("acceptedTerms")}</span>
            )}
          </div>

          <Button type="submit" variant="ink" disabled={!isValid || submitting}>
            {submitting ? "Creating account…" : "Sign Up"}
          </Button>

          <div className="flex items-center gap-3 text-xs uppercase tracking-wide text-text/40">
            <span className="h-px flex-1 bg-text/10" />
            Or continue with
            <span className="h-px flex-1 bg-text/10" />
          </div>

          <Button
            type="button"
            variant="social"
            onClick={handleGoogle}
            disabled={googleSubmitting}
            className="w-full justify-center"
          >
            <GoogleIcon /> {googleSubmitting ? "Connecting to Google…" : "Continue with Google"}
          </Button>
        </form>
      )}

      <p className="mt-6 text-center text-sm text-text/60">
        Already have an account?{" "}
        <Link
          to={originPath ? `/login?redirect=${encodeURIComponent(originPath)}` : "/login"}
          className="font-medium text-primary hover:underline"
        >
          Log in
        </Link>
      </p>
    </AuthSplitLayout>
  );
}
