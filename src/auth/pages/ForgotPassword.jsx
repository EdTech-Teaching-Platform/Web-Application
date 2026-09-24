// Forgot Password (request) — LMS doc Sec 5.1: "time-boxed, single-use
// reset link sent to the registered email." First of the 2 screens this
// flow needs (see ResetPassword.jsx for the second).
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import ConfirmationCard from "../../components/ui/ConfirmationCard";
import { isEmailOrPhone, maskDestination } from "../utils/validators";
import { requestPasswordReset } from "../services/authApi";

const RESEND_SECONDS = 60;
const LINK_EXPIRY_MINUTES = 15;

export default function ForgotPassword() {
  const [identifier, setIdentifier] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const fieldError = useMemo(() => {
    if (!identifier.trim()) return "Enter your email or phone number.";
    if (!isEmailOrPhone(identifier)) return "Enter a valid email or phone number.";
    return undefined;
  }, [identifier]);

  const isValid = !fieldError;

  const send = async () => {
    setSubmitting(true);
    setError("");
    try {
      await requestPasswordReset({ identifier: identifier.trim() });
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch {
      setError("Couldn't send the reset link. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setTouched(true);
    if (!isValid) return;
    send();
  };

  if (sent) {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <ConfirmationCard
          state="success"
          heading="Check your inbox"
          message={`We've sent a password reset link to ${maskDestination(
            identifier.trim()
          )}. It expires in ${LINK_EXPIRY_MINUTES} minutes.`}
          primaryAction={
            <Link to="/login">
              <Button>Back to Login</Button>
            </Link>
          }
          secondaryAction={
            <Button variant="secondary" onClick={send} disabled={cooldown > 0 || submitting}>
              {cooldown > 0 ? `Resend link (0:${String(cooldown).padStart(2, "0")})` : "Resend link"}
            </Button>
          }
        />
      </div>
    );
  }

  return (
    <AuthCard
      eyebrow="Reset password"
      title="Forgot your password?"
      subtitle="Enter the email or phone number on your account and we'll send you a reset link."
      footer={
        <Link to="/login" className="block text-center text-sm font-medium text-primary hover:underline">
          Back to Login
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Input
          label="Email or Phone"
          placeholder="you@example.com or +1 555 000 0000"
          value={identifier}
          onChange={(e) => setIdentifier(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? fieldError : undefined}
          autoComplete="username"
        />
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting ? "Sending…" : "Send Reset Link"}
        </Button>
      </form>
    </AuthCard>
  );
}
