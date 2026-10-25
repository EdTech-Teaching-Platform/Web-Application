// /auth/callback: where Supabase sends the browser back after email
// confirmation and Google sign-in. supabase-js reads the session from the URL;
// this page waits for AuthContext, then routes by role (or to ?redirect=).
import React from "react";
import { Link, Navigate, useLocation } from "react-router-dom";
import { AuthFrame } from "../components/AuthKit";
import Button from "../../components/ui/Button";
import ConfirmationCard from "../../components/ui/ConfirmationCard";
import { useAuth } from "../../hooks/useAuth";
import { homePathForUser } from "../../utils/roles";
import { safeRedirect } from "../utils/validators";
import { authErrorMessage } from "../services/authApi";

// Supabase puts errors in the query (PKCE) or the hash (implicit flow).
export function readAuthUrlError(location) {
  const params = new URLSearchParams(location.search);
  const hash = new URLSearchParams((location.hash || "").replace(/^#/, ""));
  const description = params.get("error_description") || hash.get("error_description");
  const code = params.get("error_code") || hash.get("error_code") || params.get("error") || hash.get("error");
  if (!description && !code) return null;
  return { code, description: description ? description.replace(/\+/g, " ") : "" };
}

export default function AuthCallback() {
  const location = useLocation();
  const { user, loading, error } = useAuth();
  const urlError = readAuthUrlError(location);
  const redirect = safeRedirect(new URLSearchParams(location.search).get("redirect"));

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

  if (loading) {
    return (
      <AuthFrame>
        <div className="flex flex-col items-center justify-center p-8 text-center" role="status">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="mt-4 text-sm text-text/60">Signing you in…</p>
        </div>
      </AuthFrame>
    );
  }

  return <Navigate to={redirect || homePathForUser(user)} replace />;
}
