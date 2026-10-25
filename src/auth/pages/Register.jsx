// Sign Up — standalone page that mirrors Login.jsx's layout/design exactly
// (same illustrated left panel + form-focused right panel split, same
// AuthCard-adjacent styling), per explicit user direction: the sign-up
// screen should look like a sibling of the login page, not like an
// onboarding-wizard step.
//
// Flow: this page collects the actual signup credentials (Full name,
// Email, Password) and Terms acceptance. On submit it does NOT call the
// register API directly — it stashes {fullName, email, password} in
// sessionStorage (read by OnboardingContext, see
// PENDING_SIGNUP_STORAGE_KEY) and sends the user into the existing,
// unchanged onboarding wizard, whose final step (Interests) creates the
// account using these credentials. This keeps a single source of truth for
// account creation and keeps onboarding's own design/flow untouched.
import { useMemo, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../components/ui/Button";
import Input from "../../components/ui/Input";
import Checkbox from "../../components/ui/Checkbox";
import { GoogleIcon, AppleIcon } from "../../components/ui/icons";
import { isEmail, isStrongPassword } from "../utils/validators";
import { PENDING_SIGNUP_STORAGE_KEY } from "../../portals/student/context/OnboardingContext";
import { AuthSplitLayout } from "../components/AuthKit";

export default function Register() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Only set when the person arrived here mid-flow — e.g. clicked "Enroll
  // Now" on a course details page while logged out, got bounced to
  // /login?redirect=<course path>, then chose "Create a free account"
  // from there (Login.jsx forwards its own `redirect` param through).
  // Deliberately NOT shown for a direct /register visit or the landing
  // page's "I'm a Student"/"Get Started Now" CTAs, which never set this
  // param — this back button is conditional on that specific origin only.
  const rawRedirect = searchParams.get("redirect") || "";
  const originPath =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") && !rawRedirect.includes("\\")
      ? rawRedirect
      : "";
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [touched, setTouched] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const errors = useMemo(() => {
    const e = {};
    if (!fullName.trim()) e.fullName = "Enter your full name.";
    else if (fullName.trim().length < 2) e.fullName = "Full name is too short.";

    if (!email.trim()) e.email = "Enter your email address.";
    else if (!isEmail(email)) e.email = "Enter a valid email address.";

    if (!password) e.password = "Create a password.";
    else if (!isStrongPassword(password)) e.password = "At least 8 characters, with 1 letter and 1 number.";

    if (!acceptedTerms) e.acceptedTerms = "You must accept the Terms & Conditions to continue.";

    return e;
  }, [fullName, email, password, acceptedTerms]);

  const isValid = Object.keys(errors).length === 0;

  const shown = (field) => (touched[field] ? errors[field] : undefined);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setTouched({ fullName: true, email: true, password: true, acceptedTerms: true });
    if (!isValid) return;

    setSubmitting(true);
    setFormError("");
    try {
      // No backend signup endpoint is hit here — account creation happens
      // at the end of the existing onboarding wizard. This just carries
      // the collected credentials forward.
      sessionStorage.setItem(
        PENDING_SIGNUP_STORAGE_KEY,
        JSON.stringify({ fullName: fullName.trim(), email: email.trim(), password })
      );
      navigate("/student/onboarding");
    } catch {
      setFormError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthSplitLayout variant="signup">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-text sm:text-4xl">Create your account</h1>
          <p className="mt-3 text-sm leading-relaxed text-text/60">
            Join Universal Learning and start learning today.
          </p>

          <form className="mt-6 space-y-5" onSubmit={handleSubmit} noValidate>
            {formError && (
              <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{formError}</p>
            )}

            <Input
              label="Full Name"
              placeholder="Alex Student"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, fullName: true }))}
              error={shown("fullName")}
              autoComplete="name"
            />

            <Input
              label="Email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, email: true }))}
              error={shown("email")}
              autoComplete="email"
            />

            <Input
              label="Password"
              type="password"
              placeholder="At least 8 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onBlur={() => setTouched((t) => ({ ...t, password: true }))}
              error={shown("password")}
              autoComplete="new-password"
            />

            <div>
              <Checkbox
                label={
                  <>
                    I agree to the{" "}
                    <Link to="/terms" className="font-medium text-primary hover:underline">
                      Terms &amp; Conditions
                    </Link>
                  </>
                }
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                onBlur={() => setTouched((t) => ({ ...t, acceptedTerms: true }))}
              />
              {shown("acceptedTerms") && (
                <span className="mt-1.5 block text-xs text-danger">{shown("acceptedTerms")}</span>
              )}
            </div>

            <Button type="submit" variant="ink" disabled={!isValid || submitting}>
              {submitting ? "Creating account…" : "Sign Up"}
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

          <p className="mt-6 text-center text-sm text-text/60">
            Already have an account?{" "}
            <Link
              to={originPath ? `/login?redirect=${encodeURIComponent(originPath)}` : "/login"}
              className="font-medium text-primary hover:underline"
            >
              Log in
            </Link>
          </p>
    </AuthSplitLayout>
  );
}
