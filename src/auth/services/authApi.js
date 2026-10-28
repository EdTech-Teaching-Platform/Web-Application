import { supabase } from "../../services/supabaseClient";
import { safeRedirect } from "../utils/validators";

// Supabase Auth calls for the auth screens. Every function throws an Error
// whose message is safe to show to the user (see authErrorMessage).
//
// All redirects (email confirmation, Google, password recovery) come back to
// the app; /auth/callback then routes by role (src/auth/pages/AuthCallback.jsx).

export const AUTH_CALLBACK_PATH = "/auth/callback";
export const RESET_PASSWORD_PATH = "/reset-password";

export const GOOGLE_NOT_CONFIGURED =
  "Google sign-in isn't set up for this site yet. Please use your email and password.";

function origin() {
  return typeof window === "undefined" ? "" : window.location.origin;
}

export function callbackUrl(redirect) {
  const next = safeRedirect(redirect);
  return `${origin()}${AUTH_CALLBACK_PATH}${next ? `?redirect=${encodeURIComponent(next)}` : ""}`;
}

// Maps Supabase Auth errors to messages a student can act on.
export function authErrorMessage(error, fallback = "Something went wrong. Please try again.") {
  const message = String(error?.message ?? "");
  const status = error?.status;
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Confirm your email first: open the link we sent to your inbox.";
  if (/already registered|already been registered|user_already_exists/i.test(message)) {
    return "An account with this email already exists. Log in instead.";
  }
  if (status === 429 || /rate limit|for security purposes|too many/i.test(message)) {
    return "Too many attempts. Please wait a minute and try again.";
  }
  if (/provider is not enabled|unsupported provider/i.test(message)) return GOOGLE_NOT_CONFIGURED;
  if (/error sending|smtp|confirmation email|recovery email/i.test(message)) {
    return "We couldn't send the email right now. Email delivery may not be set up yet; please contact support.";
  }
  if (/failed to fetch|network|load failed/i.test(message)) return "Can't reach the server. Check your connection and try again.";
  if (/password should|weak password|password is too/i.test(message)) return message;
  if (/session.*(missing|expired)|auth session missing|token.*expired|otp_expired/i.test(message)) {
    return "Your link has expired. Please request a new one.";
  }
  return message || fallback;
}

function fail(error, fallback) {
  const wrapped = new Error(authErrorMessage(error, fallback));
  wrapped.cause = error;
  wrapped.status = error?.status;
  throw wrapped;
}

/** Sign up with email + password. Returns { user, session, needsConfirmation }. */
// role "educator" (teacher register page) marks the sign-up so the first
// profile is created through educator_start_onboarding (profileService).
export async function register({ email, password, fullName, redirect, role, phone }) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: {
      data: {
        full_name: fullName?.trim() || "",
        ...(role === "educator" ? { signup_role: "educator", phone: phone?.trim() || null } : {}),
      },
      emailRedirectTo: callbackUrl(redirect),
    },
  });
  if (error) fail(error, "We couldn't create your account. Please try again.");
  // With email confirmation on, an existing address comes back as a user with
  // no identities (Supabase hides whether the email exists).
  if (data?.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    fail({ message: "User already registered" });
  }
  return { user: data?.user ?? null, session: data?.session ?? null, needsConfirmation: !data?.session };
}

/** Sign in with email + password. */
export async function login({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) fail(error, "We couldn't sign you in. Please try again.");
  return data;
}

// The provider list is public (GET /auth/v1/settings). null = couldn't tell.
export async function isGoogleEnabled() {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  try {
    const res = await fetch(`${url}/auth/v1/settings`, { headers: { apikey: key } });
    if (!res.ok) return null;
    const settings = await res.json();
    return Boolean(settings?.external?.google);
  } catch {
    return null;
  }
}

/**
 * Google sign-in. Checks that the provider is enabled first, so an
 * unconfigured project shows a message instead of Supabase's raw error page.
 */
export async function signInWithGoogle({ redirect } = {}) {
  if ((await isGoogleEnabled()) === false) fail({ message: "Unsupported provider: provider is not enabled" });
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callbackUrl(redirect), skipBrowserRedirect: true },
  });
  if (error) fail(error, "Google sign-in failed. Please try again.");
  if (!data?.url) fail({ message: "Google sign-in failed. Please try again." });
  window.location.assign(data.url);
  return data;
}

/** Sends the recovery email. Supabase answers the same whether or not the email exists. */
export async function requestPasswordReset({ email }) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: `${origin()}${RESET_PASSWORD_PATH}`,
  });
  if (error) fail(error, "We couldn't send the reset link. Please try again.");
}

/** Sets a new password for the current (recovery) session. */
export async function updatePassword({ password }) {
  const { data, error } = await supabase.auth.updateUser({ password });
  if (error) fail(error, "We couldn't update your password. Please try again.");
  return data;
}

/** Ends the session (admin auth events are recorded by record_logout for admins only). */
export async function logout(scope = "local") {
  // Best effort: logging out must never fail because of the audit call. The
  // builder is only thenable, so wrap it before catching.
  await Promise.resolve(supabase.rpc("record_logout", { p_scope: scope })).catch(() => null);
  const { error } = await supabase.auth.signOut({ scope });
  if (error && scope !== "local") fail(error, "We couldn't sign you out everywhere. Please try again.");
  if (error) await supabase.auth.signOut({ scope: "local" });
}
