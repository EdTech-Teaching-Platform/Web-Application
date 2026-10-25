// Login (password + Google/Apple) — LMS doc Sec 5.1. The Password/One-Time
// Code toggle that used to live here is gone; OTP is no longer an
// alternative way to log in. Instead, login is now a mandatory two-step
// flow for every role: password first, then a one-time code sent to the
// user's email/phone — only once that code is verified does the person
// actually reach their dashboard (see OtpVerification.jsx's "login" mode).
//
// Full-bleed two-panel split: an illustrated left panel and a form-focused
// right panel, unchanged from before.
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Checkbox from "../../components/ui/Checkbox";
import { GoogleIcon, AppleIcon } from "../../components/ui/icons";
import { isEmailOrPhone } from "../utils/validators";
import { login, requestLoginOtp } from "../services/authApi";
import { AuthSplitLayout } from "../components/AuthKit";

// Student / Educator switch — plain links between the two existing login
// routes (the `redirect` param is carried across).
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
  const redirect = searchParams.get("redirect");
  const isEducator = role === "teacher";
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const errors = useMemo(() => {
    const e = {};
    if (!identifier.trim()) e.identifier = "Enter your email or phone number.";
    else if (!isEmailOrPhone(identifier)) e.identifier = "Enter a valid email or phone number.";
    if (!password) e.password = "Enter your password.";
    return e;
  }, [identifier, password]);

  // Presence validation only — actual credential correctness is a server
  // response, surfaced as formError on submit failure.
  const isValid = Object.keys(errors).length === 0;

  const shown = (field) => (touched[field] ? errors[field] : undefined);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ identifier: true, password: true });
    if (!isValid) return;

    setSubmitting(true);
    setFormError("");
    try {
      const trimmed = identifier.trim();
      const { data } = await login({ identifier: trimmed, password, role: isEducator ? "teacher" : "student" });
      const role = data.role === "educator" ? "teacher" : data.role;
      if (isEducator && role !== "teacher") throw new Error("wrong_role");
      // Password verified — now send the mandatory one-time code and hold
      // off on dashboard access until OtpVerification confirms it.
      await requestLoginOtp({ identifier: trimmed });
      const otpParams = new URLSearchParams({ mode: "login", destination: trimmed, role });
      if (redirect?.startsWith("/") && !redirect.startsWith("//")) otpParams.set("redirect", redirect);
      navigate(`/verify-otp?${otpParams.toString()}`);
    } catch {
      setFormError("Incorrect email/phone or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout variant={isEducator ? "educator" : "student"}>
          <RoleSwitch isEducator={isEducator} redirect={redirect} />

          <h1 className="mt-8 font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">
            {isEducator ? "Welcome back, Educator." : "Hi, welcome back."}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-text/60">
            {isEducator ? (
              <>
                Sign in to manage your courses and learners. New here?{" "}
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
            {formError && (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{formError}</p>
            )}

            <Input
              label="Email or Phone"
              placeholder="you@example.com or +1 555 000 0000"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, identifier: true }))}
              error={shown("identifier")}
              autoComplete="username"
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
            <div className="flex items-center justify-between">
              <Checkbox
                label="Remember this device"
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
              />
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

            <div className="flex gap-3">
              <Button type="button" variant="social" onClick={() => {}}>
                <GoogleIcon /> Google
              </Button>
              <Button type="button" variant="social" onClick={() => {}}>
                <AppleIcon /> Apple
              </Button>
            </div>
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
