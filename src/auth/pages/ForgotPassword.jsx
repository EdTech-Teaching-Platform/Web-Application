// Forgot Password (request) — LMS doc Sec 5.1:
// Sends a single-use reset link via Supabase Auth resetPasswordForEmail; the
// link opens /reset-password. Supabase answers the same whether or not the
// email has an account, so the confirmation never reveals that.
import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { AuthFrame } from "../components/AuthKit";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import ConfirmationCard from "../../components/ui/ConfirmationCard";
import { isEmail, maskDestination } from "../utils/validators";
import { requestPasswordReset } from "../services/authApi";

const RESEND_SECONDS = 60;

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
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
    if (!email.trim()) return "Enter your email address.";
    if (!isEmail(email)) return "Enter a valid email address.";
    return undefined;
  }, [email]);

  const isValid = !fieldError;

  const send = async () => {
    setSubmitting(true);
    setError("");
    try {
      await requestPasswordReset({ email });
      setSent(true);
      setCooldown(RESEND_SECONDS);
    } catch (err) {
      setError(err.message);
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
      <AuthFrame>
        <ConfirmationCard
          state="success"
          heading="Check your inbox"
          message={`If ${maskDestination(email.trim())} has an account, a password reset link is on its way. The link works once and expires after a while.`}
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
      </AuthFrame>
    );
  }

  return (
    <AuthCard
      showBackToHome={false}
      eyebrow="Reset password"
      title="Forgot your password?"
      subtitle="Enter the email associated with your account and we'll send you a reset link."
      footer={
        <Link to="/login" className="block text-center text-sm font-medium text-primary hover:underline">
          Back to Login
        </Link>
      }
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
        )}
        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={() => setTouched(true)}
          error={touched ? fieldError : undefined}
          autoComplete="email"
        />
        <Button type="submit" variant="ink" disabled={!isValid || submitting}>
          {submitting ? "Sending…" : "Send Reset Link"}
        </Button>
      </form>
    </AuthCard>
  );
}
