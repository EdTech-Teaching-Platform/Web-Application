import { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  IconEye,
  IconEyeOff,
  IconGraduationCap,
  IconMail,
  IconLock,
  IconBook,
  IconPencil,
  IconCalculator,
  IconGlobe,
  IconAtom,
  IconLightbulb,
  IconChart,
  IconStar,
} from "../components/icons";
import "../adminTheme.css";
import "../../../auth/pages/AdminAuth.css";

// Moving study-themed characters drifting behind the card — the portal's
// own line-icon set (not emoji), spread across the page margins so they
// never sit under the opaque card itself. Position/size/timing are inline
// styles (not per-icon CSS classes) so the whole layout lives in one place,
// next to the render, with no cascade to fight.
const BG_ICONS = [
  { Icon: IconBook, size: 26, top: "8%", left: "6%", duration: 10, delay: 0 },
  { Icon: IconPencil, size: 20, top: "22%", left: "3%", duration: 12, delay: 1 },
  { Icon: IconCalculator, size: 22, top: "78%", left: "5%", duration: 13, delay: 2 },
  { Icon: IconGraduationCap, size: 30, top: "62%", left: "9%", duration: 11, delay: 0.5 },
  { Icon: IconAtom, size: 22, top: "40%", left: "4%", duration: 9, delay: 1.8 },
  { Icon: IconLightbulb, size: 20, top: "10%", left: "16%", duration: 10.5, delay: 0.9 },
  { Icon: IconGlobe, size: 26, top: "88%", left: "14%", duration: 11.5, delay: 1.4 },
  { Icon: IconStar, size: 16, top: "32%", left: "15%", duration: 9.5, delay: 2.2 },
  { Icon: IconBook, size: 24, top: "10%", left: "92%", duration: 10.5, delay: 0.3 },
  { Icon: IconPencil, size: 20, top: "26%", left: "95%", duration: 12.5, delay: 1.6 },
  { Icon: IconGraduationCap, size: 28, top: "60%", left: "93%", duration: 11, delay: 0.7 },
  { Icon: IconCalculator, size: 20, top: "80%", left: "90%", duration: 13, delay: 2.4 },
  { Icon: IconLightbulb, size: 22, top: "44%", left: "96%", duration: 9.5, delay: 1.1 },
  { Icon: IconAtom, size: 20, top: "90%", left: "84%", duration: 10, delay: 0.4 },
  { Icon: IconChart, size: 22, top: "6%", left: "82%", duration: 12, delay: 1.9 },
  { Icon: IconStar, size: 16, top: "70%", left: "97%", duration: 9, delay: 2.7 },
];

function FloatingIcons({ items, className }) {
  return (
    <div className={className} aria-hidden="true">
      {items.map(({ Icon, size, top, left, duration, delay }, i) => (
        <span
          key={i}
          className="ul-login__float-icon"
          style={{ top, left, animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
        >
          <Icon size={size} />
        </span>
      ))}
    </div>
  );
}

// Open-book-with-sprout brand mark for the left panel, echoing the
// reference lockup — built from shapes so no external image is needed.
function BrandLogo() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <path d="M20 10 C15 7 8 7 4 9 V29 C8 27 15 27 20 30 V10 Z" fill="var(--color-primary-dark)" />
      <path d="M20 10 C25 7 32 7 36 9 V29 C32 27 25 27 20 30 V10 Z" fill="var(--color-primary)" />
      <path d="M20 6 C20 6 21 2.5 24.5 2 C22.5 5 22 7 20 10 C18 7 17.5 5 15.5 2 C19 2.5 20 6 20 6 Z" fill="#d9a441" />
    </svg>
  );
}

function IconArrowRight({ size = 16, color = "currentColor" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  );
}

export default function AdminLogin() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [stage, setStage] = useState("credentials"); // "credentials" | "loading"
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (stage === "loading") {
      const timer = setTimeout(() => {
        setUser({ name: "Admin User", email: form.email.trim(), role: "admin" });
        navigate("/admin/logindashboard", { replace: true });
      }, 1600);
      return () => clearTimeout(timer);
    }
  }, [stage, form.email, navigate, setUser]);

  const handleCredentialsSubmit = (event) => {
    event.preventDefault();
    const email = form.email.trim();

    if (!email || !form.password) {
      setError("Enter your email and password to continue.");
      return;
    }

    setError("");
    setStage("loading");
  };

  return (
    <div className="ul-login">
      <div className="ul-login__card">
        <div className="ul-login__panel-left">
          <FloatingIcons items={BG_ICONS} className="ul-login__bg-icons" />
          <div className="ul-login__brand">
            <BrandLogo />
            <span className="ul-login__brand-name">
              <strong>Universal</strong>
              <em>Learning</em>
            </span>
          </div>
        </div>

        <div className="ul-login__panel-right">
          <span className="ul-login__blob ul-login__blob--top" aria-hidden="true" />
          <span className="ul-login__blob ul-login__blob--bottom" aria-hidden="true" />

          {stage === "credentials" && (
            <form className="ul-login__body" onSubmit={handleCredentialsSubmit} noValidate>
              <h1 className="ul-login__title">Admin Login</h1>

              <label className="ul-login__label" htmlFor="admin-email">Email Address</label>
              <div className="ul-login__field-wrap">
                <span className="ul-login__field-icon"><IconMail size={15} /></span>
                <input
                  id="admin-email"
                  type="email"
                  autoComplete="username"
                  className="ul-login__field ul-login__field--icon"
                  placeholder="Enter your email address"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </div>

              <label className="ul-login__label" htmlFor="admin-password">Password</label>
              <div className="ul-login__field-wrap">
                <span className="ul-login__field-icon"><IconLock size={15} /></span>
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  className="ul-login__field ul-login__field--icon ul-login__field--password"
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(event) => setForm({ ...form, password: event.target.value })}
                />
                <button
                  type="button"
                  className="ul-login__field-toggle"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <IconEyeOff size={15} /> : <IconEye size={15} />}
                </button>
              </div>

              {error && <p className="ul-login__error">{error}</p>}

              <button className="ul-login__submit" type="submit">
                Sign In <IconArrowRight size={16} />
              </button>
            </form>
          )}

          {stage === "loading" && (
            <div className="ul-login__body ul-login__loading" role="status" aria-live="polite">
              <span className="ul-login__loading-dots" aria-hidden="true">
                <span />
                <span />
                <span />
              </span>
              <p className="ul-login__loading-text">Signing you in…</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
