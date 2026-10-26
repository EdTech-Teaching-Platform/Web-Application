// Login: email + password, or Google (Supabase Auth). After sign-in the user
// is routed by role (student -> /student/dashboard, admin / super_admin ->
// /admin/logindashboard), or to a same-site ?redirect=.
import React, { useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import { GoogleIcon } from "../../components/ui/icons";
import { isEmail, safeRedirect } from "../utils/validators";
import { login, signInWithGoogle } from "../services/authApi";
import { ensureProfile } from "../../services/profileService";
import { useAuth } from "../../hooks/useAuth";
import { toAppUser } from "../../context/AuthContext";
import { homePathForUser } from "../../utils/roles";
import { AuthSplitLayout } from "../components/AuthKit";

function RoleSwitch({ isEducator, redirect }) {
  const query = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
  const base = "rounded-full px-5 py-2 text-sm font-semibold transition-colors duration-150";
  return (
    <nav aria-label="Sign in as" className="inline-flex rounded-full bg-(--lp-grey) p-1">
      <Link
        to={`/login${query}`}
        aria-current={isEducator ? undefined : "page"}
        className={`${base} ${isEducator ? "text-(--lp-muted) hover:text-(--lp-ink)" : "bg-(--lp-ink) text-white"}`}
      >
        Student
      </Link>
      <Link
        to={`/teacher/login${query}`}
        aria-current={isEducator ? "page" : undefined}
        className={`${base} ${isEducator ? "bg-(--lp-ink) text-white" : "text-(--lp-muted) hover:text-(--lp-ink)"}`}
      >
        Educator
      </Link>
    </nav>
  );
}

export default function Login({ role = "student" }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirect = safeRedirect(searchParams.get("redirect"));
  const { user, loading, error: sessionError } = useAuth();
  const isEducator = role === "teacher";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const errors = useMemo(() => {
    const e = {};
    if (!email.trim()) e.email = "Enter your email address.";
    else if (!isEmail(email)) e.email = "Enter a valid email address.";
    if (!password) e.password = "Enter your password.";
    return e;
  }, [email, password]);

  const isValid = Object.keys(errors).length === 0;
  const shown = (field) => (touched[field] ? errors[field] : undefined);

  // Already signed in (e.g. back button after login): go home.
  if (!loading && user && !submitting) {
    return <Navigate to={redirect || homePathForUser(user)} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ email: true, password: true });
    if (!isValid) return;

    setSubmitting(true);
    setFormError("");
    try {
      const data = await login({ email, password });
      const profile = await ensureProfile(data.user);
      navigate(redirect || homePathForUser(toAppUser(data.user, profile)), { replace: true });
    } catch (err) {
      setFormError(err.message || "Incorrect email or password.");
      setSubmitting(false);
    }
  };

  const handleGoogle = async () => {
    setGoogleSubmitting(true);
    setFormError("");
    try {
      await signInWithGoogle({ redirect });
    } catch (err) {
      setFormError(err.message);
      setGoogleSubmitting(false);
    }
  };

  const shownError = formError || sessionError;

  return (
    <AuthSplitLayout variant={isEducator ? "educator" : "student"}>
      <RoleSwitch isEducator={isEducator} redirect={redirect} />

      <h1 className="mt-8 font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
        {isEducator ? "Welcome back, Educator." : "Hi, welcome back."}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-text/60">
        {isEducator ? (
          <>
            Sign in to manage your test series and students. New here?{" "}
            <Link to="/teacher/registration" className="font-medium text-primary hover:underline">
              Create an educator account
            </Link>
          </>
        ) : (
          <>
            New to Universal Learning?{" "}
            <Link
              to={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : "/register"}
              className="font-medium text-primary hover:underline"
            >
              Create a free account
            </Link>
          </>
        )}
      </p>

      <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
        {shownError && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{shownError}</p>
        )}

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

        <Input
          label="Password"
          type="password"
          placeholder="Your password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={shown("password")}
          autoComplete="current-password"
        />
        <div className="flex justify-end">
          <Link to="/forgot-password" className="text-sm font-medium text-primary hover:underline">
            Forgot password?
          </Link>
        </div>

        <Button type="submit" variant="ink" disabled={!isValid || submitting}>
          {submitting ? "Logging in…" : "Log In"}
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

      <p className="mt-6 text-center text-xs text-text/40">
        By continuing, you agree to our{" "}
        <Link to="/terms" className="underline hover:text-text/60">
          Terms of Service
        </Link>{" "}
        and{" "}
        <Link to="/privacy" className="underline hover:text-text/60">
          Privacy Policy
        </Link>
        .
      </p>
    </AuthSplitLayout>
  );
}
