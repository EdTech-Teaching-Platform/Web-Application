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
import loginStudentsImg from "../../assets/illustrations/login-students.png";
import AuthBackdrop from "../../components/ui/AuthBackdrop";

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
      const { data } = await login({ identifier: trimmed, password });
      // Password verified — now send the mandatory one-time code and hold
      // off on dashboard access until OtpVerification confirms it.
      await requestLoginOtp({ identifier: trimmed });
      const otpParams = new URLSearchParams({ mode: "login", destination: trimmed, role: data.role });
      if (redirect?.startsWith("/") && !redirect.startsWith("//")) otpParams.set("redirect", redirect);
      navigate(`/verify-otp?${otpParams.toString()}`);
    } catch {
      setFormError("Incorrect email/phone or password.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative grid min-h-screen bg-bg lg:grid-cols-[1.9fr_1fr]">
      {/* Same decorative doodle backdrop as Onboarding/Register, added for
          visual consistency across all three auth-style screens. */}
      <AuthBackdrop />
      {/* Left panel — text sits upper-left, the illustration is grounded on a
          baseline near the bottom and sized to be the dominant visual element
          (roughly half the panel's height, spanning most of its width). */}
      <div className="relative z-10 hidden flex-col border-r border-[#e5ded9] p-10 lg:flex lg:p-14">
        <Link to="/" className="font-display text-sm font-semibold tracking-tight text-primary">
          Universal Learning
        </Link>

        <div className="flex flex-1 flex-col items-start justify-between">
          <div className="max-w-xs -translate-x-1 pt-2">
            <h2 className="font-display text-3xl leading-tight tracking-tight text-text">
              Learn anything.
              <br />
              From anyone.
            </h2>
            <p className="mt-3 text-sm text-text/60">
              Courses, live classes and mentors — all in one place, right where you left off.
            </p>
          </div>

          {/* Reference-image illustration — static, no animation. */}
          <img
            src={loginStudentsImg}
            alt=""
            aria-hidden="true"
            className="h-[50vh] max-h-[520px] min-h-[300px] w-full object-contain object-bottom"
          />
        </div>
      </div>

      {/* Right panel — form */}
      <div className="flex flex-col justify-center px-6 py-12 sm:px-12">
        <div className="mx-auto w-full max-w-sm">
          <Link to="/" className="mb-6 block text-center font-display text-lg tracking-tight text-primary lg:hidden">
            Universal Learning
          </Link>

          <div className="mx-auto mb-6 flex h-11 w-11 items-center justify-center rounded-2xl bg-primary font-display text-sm font-bold text-white">
            UL
          </div>

          <h1 className="text-center font-display text-2xl text-text">
            {isEducator ? "Welcome back, Educator." : "Hi, welcome back."}
          </h1>
          <p className="mt-2 text-center text-sm text-text/60">
            {isEducator ? (
              "Sign in to manage your courses and learners."
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

            <Button type="submit" disabled={!isValid || submitting}>
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
        </div>
      </div>
    </div>
  );
}
