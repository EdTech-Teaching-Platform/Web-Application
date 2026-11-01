// /auth/callback: where Supabase sends the browser back after email
// confirmation and Google sign-in. supabase-js reads the session from the URL;
// this page waits for AuthContext, then routes by role (or to ?redirect=).
import React, { useEffect, useState } from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthFrame, BrandMark } from "../components/AuthKit";
import Button from "../../components/ui/Button";
import ConfirmationCard from "../../components/ui/ConfirmationCard";
import { useAuth } from "../../hooks/useAuth";
import { homePathForUser } from "../../utils/roles";
import { safeRedirect } from "../utils/validators";
import { authErrorMessage } from "../services/authApi";
import { needsGoogleOnboarding } from "../../portals/student/utils/onboarding";
import { clearEducatorIntent, hasEducatorIntent } from "../../portals/teacher/utils/onboarding";

const ROLE_NAME = { student: "student", admin: "admin", regionalhead: "regional head" };

// Supabase puts errors in the query (PKCE) or the hash (implicit flow).
export function readAuthUrlError(location) {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  const description = params.get("error_description") || hash.get("error_description");
  const code = params.get("error_code") || hash.get("error_code") || params.get("error") || hash.get("error");
  if (!description && !code) return null;
  return { code, description: description ? description.replace(/\+/g, " ") : "" };
}

const SIGNIN_CSS = `
@keyframes ul-si-orbit { to { transform: rotate(360deg); } }
@keyframes ul-si-bar { 0% { transform: translateX(-100%); } 100% { transform: translateX(260%); } }
@keyframes ul-si-tip { 0%, 30% { opacity: 1; transform: translateY(0); } 36%, 94% { opacity: 0; transform: translateY(-6px); } 100% { opacity: 0; } }
@keyframes ul-si-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
.ul-si-orbit { animation: ul-si-orbit 1.6s linear infinite; }
.ul-si-bar { animation: ul-si-bar 1.4s ease-in-out infinite; }
.ul-si-tip { opacity: 0; animation: ul-si-tip 9s ease-in-out infinite; }
.ul-si-float { animation: ul-si-float 3.2s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) {
  .ul-si-orbit, .ul-si-bar, .ul-si-float { animation: none; }
  .ul-si-tip { animation: none; opacity: 0; }
  .ul-si-tip:first-child { opacity: 1; }
}
`;
const SIGNIN_TIPS = [
  "Timed mock tests that feel like the real exam",
  "Instant scores and detailed reports",
  "Track every attempt and watch your progress grow",
];

function SigningInCard() {
  return (
    <div className="flex flex-col items-center px-6 py-10 text-center" role="status" aria-live="polite">
      <style>{SIGNIN_CSS}</style>
      <div className="ul-si-float relative grid h-24 w-24 place-items-center">
        <span className="absolute inset-0 rounded-full border-2 border-(--lp-blue)/15" aria-hidden="true" />
        <span className="ul-si-orbit absolute inset-0" aria-hidden="true">
          <span className="absolute -top-1 left-1/2 h-3 w-3 -translate-x-1/2 rounded-full bg-(--lp-yellow) shadow-[0_0_0_4px_rgba(255,216,77,0.35)]" />
        </span>
        <BrandMark className="h-16 w-16 drop-shadow-[0_10px_18px_rgba(61,123,247,0.35)]" />
      </div>
      <h1 className="mt-7 font-(family-name:--lp-font) text-2xl font-bold tracking-tight text-(--lp-ink)">Signing you in</h1>
      <p className="mt-1.5 text-sm text-(--lp-muted)">Getting your test series ready…</p>
      <div className="mt-6 h-1.5 w-48 overflow-hidden rounded-full bg-(--lp-blue-soft)" aria-hidden="true">
        <div className="ul-si-bar h-full w-2/5 rounded-full bg-(--lp-blue)" />
      </div>
      <div className="relative mt-6 h-6 w-full max-w-xs" aria-hidden="true">
        {SIGNIN_TIPS.map((t, i) => (
          <span key={t} className="ul-si-tip absolute inset-x-0 text-xs font-semibold text-(--lp-ink)/70" style={{ animationDelay: `${i * 3}s` }}>{t}</span>
        ))}
      </div>
    </div>
  );
}

export default function AuthCallback() {
  const location = useLocation();
  const { user, loading, error } = useAuth();
  const urlError = readAuthUrlError(location);
  const redirect = safeRedirect(new URLSearchParams(location.search).get("redirect"));

  // New Google students go through onboarding before landing on the dashboard.
  // null = still checking; the check never throws and falls back to false.
  const [needsOnboarding, setNeedsOnboarding] = useState(null);
  useEffect(() => {
    if (loading || user?.role !== "student") return undefined;
    let cancelled = false;
    needsGoogleOnboarding(user).then((needs) => {
      if (!cancelled) setNeedsOnboarding(needs);
    });
    return () => { cancelled = true; };
  }, [loading, user]);

  if (urlError || (!loading && !user)) {
    const message = urlError
      ? authErrorMessage({ message: `${urlError.code ?? ""} ${urlError.description}` }, "We couldn't sign you in.")
      : error || "We couldn't sign you in. The link may have expired or already been used.";
    return (
      <AuthFrame>
        <ConfirmationCard
          state="failure"
          heading="Sign-in didn't complete"
          message={message}
          primaryAction={
            <Link to="/login">
              <Button>Back to Log In</Button>
            </Link>
          }
        />
      </AuthFrame>
    );
  }

  // A teacher sign-up (email link or Google started on /teacher/register) that
  // landed on an account with another role: the role is never changed.
  const educatorIntent = hasEducatorIntent(null);
  if (!loading && user && educatorIntent) {
    clearEducatorIntent();
    if (user.role !== "teacher") {
      return (
        <AuthFrame>
          <ConfirmationCard
            state="failure"
            heading="This email already has an account"
            message={`This email is registered as a ${ROLE_NAME[user.role] || user.role} account, so it can't be used for an educator account. Sign out and register as an educator with a different email.`}
            primaryAction={<Link to={homePathForUser(user)}><Button>Go to my account</Button></Link>}
          />
        </AuthFrame>
      );
    }
    return <Navigate to="/teacher" replace />;
  }

  const checkingOnboarding = !loading && user?.role === "student" && needsOnboarding === null;
  if (loading || checkingOnboarding) {
    return (
      <AuthFrame>
        <SigningInCard />
      </AuthFrame>
    );
  }

  if (user?.role === "student" && needsOnboarding) {
    const next = redirect ? `?redirect=${encodeURIComponent(redirect)}` : "";
    return <Navigate to={`/student/onboarding${next}`} replace />;
  }

  return <Navigate to={redirect || homePathForUser(user)} replace />;
}
