// OTP / Email Verification + mandatory post-login one-time code — LMS doc
// Sec 5.1. Two modes, sharing one screen since the UI is otherwise
// identical — both send a platform code to the user's email/phone, so both
// show the masked destination and have a resend timer:
//   mode=register — verifying a brand-new account right after Register.
//   mode=login    — mandatory second step after password login, for every
//     role (Student, Educator, Admin, Super Admin). Dashboard access is
//     only granted once this code is verified; see Login.jsx.
// mode=login-otp (OTP as an alternative way to log in, instead of
// password) and mode=mfa (an authenticator-app-only step for Admin/Super
// Admin) have both been superseded by this single mandatory-for-everyone
// "login" mode, per request.
import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import Button from "../../components/ui/Button";
import OtpInput from "../../components/ui/OtpInput";
import { identifierKind, maskDestination } from "../utils/validators";
import { verifyAccountOtp, verifyLoginOtp, resendOtp } from "../services/authApi";
import { useAuth } from "../../hooks/useAuth";

const RESEND_SECONDS = 60;

export default function OtpVerification() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const mode = params.get("mode") === "login" ? "login" : "register";
  const destination = params.get("destination") || "";
  const role = params.get("role") || "student";
  const requestedRedirect = params.get("redirect") || "";

  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const kind = identifierKind(destination) || "email";
  const masked = destination ? maskDestination(destination) : kind === "email" ? "your email" : "your phone";
  const isLogin = mode === "login";

  const handleVerify = async (e) => {
    e.preventDefault();
    if (code.length !== 6) return;
    setSubmitting(true);
    setError("");
    try {
      if (isLogin) {
        await verifyLoginOtp({ identifier: destination, code });
        setUser({
          id: destination.toLowerCase(),
          name: destination.includes("@") ? destination.split("@")[0] : destination,
          identifier: destination,
          role,
          onboardingComplete: true,
        });
        // Only now — after password AND this code both check out — does
        // the person actually reach a dashboard.
        const safeStudentRedirect = role === "student"
          && requestedRedirect.startsWith("/")
          && !requestedRedirect.startsWith("//")
          && !requestedRedirect.includes("\\")
          ? requestedRedirect
          : "";
        navigate(role === "admin" || role === "super_admin" ? "/admin" : safeStudentRedirect || "/student/dashboard");
      } else {
        await verifyAccountOtp({ identifier: destination, code });
        setUser({
          id: destination.toLowerCase(),
          name: destination.includes("@") ? destination.split("@")[0] : destination,
          identifier: destination,
          role: "student",
          onboardingComplete: true,
        });
        // Onboarding happens before verification, not after — this
        // completes account creation, so route straight to the dashboard.
        navigate("/student/dashboard");
      }
    } catch {
      setError("That code didn't work — check and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setError("");
    try {
      await resendOtp({ identifier: destination, purpose: mode });
      setCooldown(RESEND_SECONDS);
    } catch {
      setError("Couldn't resend the code. Please try again in a moment.");
    }
  };

  const backHref = isLogin ? "/login" : "/student/onboarding";
  const backLabel = isLogin
    ? "Back to login"
    : kind === "email"
      ? "Use a different email"
      : "Use a different phone number";

  return (
    <AuthCard
      eyebrow="Verify"
      title={`Verify your ${kind}`}
      subtitle={`We sent a code to ${masked}.`}
      footer={
        <Link to={backHref} className="block text-center text-sm font-medium text-primary hover:underline">
          {backLabel}
        </Link>
      }
    >
      <form className="space-y-6" onSubmit={handleVerify} noValidate>
        <OtpInput length={6} value={code} onChange={setCode} error={Boolean(error)} disabled={submitting} />
        {error && <p className="text-center text-sm text-danger">{error}</p>}

        <Button type="submit" disabled={code.length !== 6 || submitting}>
          {submitting ? "Verifying…" : "Verify"}
        </Button>

        <div className="text-center text-sm text-text/60">
          {cooldown > 0 ? (
            <span>Resend in 0:{String(cooldown).padStart(2, "0")}</span>
          ) : (
            <button type="button" onClick={handleResend} className="font-medium text-primary hover:underline">
              Resend code
            </button>
          )}
        </div>
      </form>
    </AuthCard>
  );
}
