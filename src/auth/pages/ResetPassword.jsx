// Reset Password (set new) — LMS doc Sec 5.1.
// Opened from the recovery email: supabase-js reads the recovery session from
// the URL (AuthContext reports it). States:
//   loading  waiting for the session
//   expired  the URL carries an error (expired / used link) or no session arrived
//   form     a session exists: choose a new password (strength rule + confirm)
//   success  updateUser({password}) succeeded
import React, { useMemo, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import AuthCard from "../components/AuthCard";
import { AuthFrame } from "../components/AuthKit";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import ConfirmationCard from "../../components/ui/ConfirmationCard";
import { isStrongPassword } from "../utils/validators";
import { updatePassword, authErrorMessage } from "../services/authApi";
import { useAuth } from "../../hooks/useAuth";
import { homePathForUser } from "../../utils/roles";
import { readAuthUrlError } from "./AuthCallback";
import { PasswordChecklist } from "./Register";

export default function ResetPassword() {
  const location = useLocation();
  const { user, loading, clearRecovery } = useAuth();
  const urlError = readAuthUrlError(location);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [expiredMessage, setExpiredMessage] = useState("");
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

  const status = done ? "success"
    : urlError || expiredMessage ? "expired"
    : loading ? "loading"
    : user ? "form"
    : "expired";

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ password: true, confirmPassword: true });
    if (!isValid) return;

    setSubmitting(true);
    setError("");
    try {
      await updatePassword({ password });
      clearRecovery?.();
      setDone(true);
    } catch (err) {
      if (/expired/i.test(err.message)) setExpiredMessage(err.message);
      else setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (status === "loading") {
    return (
      <AuthFrame>
        <div className="flex flex-col items-center justify-center p-8 text-center" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-text/60">Checking your reset link…</p>
        </div>
      </AuthFrame>
    );
  }

  if (status === "expired") {
    return (
      <AuthFrame>
        <ConfirmationCard
          state="failure"
          heading="This link has expired"
          message={
            expiredMessage ||
            (urlError ? authErrorMessage({ message: `${urlError.code ?? ""} ${urlError.description}` }) : "") ||
            "Password reset links work once and expire after a while. Request a new one."
          }
          primaryAction={<Button as={Link} to="/forgot-password">Request a new link</Button>}
        />
      </AuthFrame>
    );
  }

  if (status === "success") {
    return (
      <AuthFrame>
        <ConfirmationCard
          state="success"
          heading="Password updated"
          message="Your new password is set. You're signed in."
          primaryAction={<Button as={Link} to={homePathForUser(user)}>Continue</Button>}
        />
      </AuthFrame>
    );
  }

  return (
    <AuthCard eyebrow="Reset password" title="Set a new password" subtitle="Choose a new password for your account.">
      <form className="space-y-5" onSubmit={handleSubmit} noValidate>
        {error && (
          <p role="alert" className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p>
        )}
        <div>
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
          <PasswordChecklist value={password} />
        </div>
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
        <Button type="submit" variant="ink" disabled={!isValid || submitting}>
          {submitting ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </AuthCard>
  );
}
