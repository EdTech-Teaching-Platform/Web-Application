// Reset Password (set new) — LMS doc Sec 5.1. This is what the emailed
// link opens: a fresh page load, no prior form state assumed, so the
// token itself lives in the URL (?token=...) rather than any local state.
import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import ConfirmationCard from "../../components/ui/ConfirmationCard";
import { isStrongPassword } from "../utils/validators";
import { resetPassword } from "../services/authApi";

export default function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [status, setStatus] = useState(token ? "form" : "expired"); // "form" | "expired" | "success"
  const [error, setError] = useState("");

  const errors = useMemo(() => {
    const e = {};
    if (!password) e.password = "Create a new password.";
    else if (!isStrongPassword(password)) e.password = "At least 8 characters, with 1 letter and 1 number.";
    if (!confirmPassword) e.confirmPassword = "Confirm your new password.";
    else if (confirmPassword !== password) e.confirmPassword = "Passwords don't match.";
    return e;
  }, [password, confirmPassword]);

  const isValid = Object.keys(errors).length === 0;
  const shown = (field) => (touched[field] ? errors[field] : undefined);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    if (!isValid) return;

    setSubmitting(true);
    setError("");
    try {
      await resetPassword({ token, password });
      setStatus("success");
    } catch {
      setStatus("expired");
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "expired") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <ConfirmationCard
          state="failure"
          heading="This link has expired"
          message="Password reset links are single-use and time-limited for your security."
          primaryAction={
            <Link to="/forgot-password">
              <Button>Request a new link</Button>
            </Link>
          }
        />
      </div>
    );
  }

  if (status === "success") {
    return (
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <ConfirmationCard
          state="success"
          heading="Password updated"
          message="You can now log in with your new password."
          primaryAction={
            <Link to="/login">
              <Button>Log In</Button>
            </Link>
          }
        />
      </div>
    );
  }

  return (
    <AuthCard
      eyebrow="Reset password"
      title="Set a new password"
      subtitle="Choose a new password for your account."
    >
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error && <p className="text-sm text-danger">{error}</p>}
        <Input
          label="New Password"
          type="password"
          placeholder="At least 8 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, password: true }))}
          error={shown("password")}
          autoComplete="new-password"
        />
        <Input
          label="Confirm New Password"
          type="password"
          placeholder="Re-enter your new password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          onBlur={() => setTouched((t) => ({ ...t, confirmPassword: true }))}
          error={shown("confirmPassword")}
          autoComplete="new-password"
        />
        <Button type="submit" disabled={!isValid || submitting}>
          {submitting ? "Resetting…" : "Reset Password"}
        </Button>
      </form>
    </AuthCard>
  );
}
