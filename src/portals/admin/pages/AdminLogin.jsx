import { useState, useEffect } from "react";
import { useAuth } from "../../../hooks/useAuth";
import { useNavigate } from "react-router-dom";
import {
  IconEye,
  IconEyeOff,
  IconMail,
  IconLock,
  IconBook,
  IconPencil,
  IconCalculator,
  IconGlobe,
  IconAtom,
  IconLightbulb,
  IconChart,
  IconGraduationCap,
} from "../components/icons";
import brandLogo from "../../../assets/brand-logo.png";
import "../adminTheme.css";
import "../../../auth/pages/AdminAuth.css";

// Faint line icons drifting across the open cream page background, kept
// well outside the card's max-width so they read as ambient page texture
// behind it, never competing with the form.
const PAGE_BG_ICONS = [
  { Icon: IconBook, size: 30, top: "10%", left: "6%", duration: 16, delay: 0 },
  { Icon: IconLightbulb, size: 26, top: "21%", left: "13%", duration: 17, delay: 1.2 },
  { Icon: IconPencil, size: 27, top: "78%", left: "9%", duration: 18, delay: 0.6 },
  { Icon: IconGlobe, size: 31, top: "88%", left: "17%", duration: 17, delay: 1.6 },
  { Icon: IconGraduationCap, size: 32, top: "12%", left: "90%", duration: 18, delay: 0.4 },
  { Icon: IconChart, size: 27, top: "27%", left: "85%", duration: 16, delay: 1.4 },
  { Icon: IconCalculator, size: 26, top: "80%", left: "88%", duration: 19, delay: 0.8 },
  { Icon: IconBook, size: 27, top: "91%", left: "80%", duration: 17, delay: 2 },
  { Icon: IconAtom, size: 24, top: "48%", left: "5%", duration: 18, delay: 1 },
  { Icon: IconLightbulb, size: 24, top: "46%", left: "94%", duration: 16, delay: 1.8 },
  { Icon: IconPencil, size: 22, top: "6%", left: "45%", duration: 20, delay: 2.4 },
  { Icon: IconGraduationCap, size: 24, top: "95%", left: "47%", duration: 18, delay: 3 },
];

// Soft corner blobs + a scattering of drifting line icons, confined to the
// open background around the centered brandmark + card (never under it).
function PageBackdrop() {
  return (
    <div className="ul-login__page-bg" aria-hidden="true">
      <span className="ul-login__page-glow ul-login__page-glow--tr-big" />
      <span className="ul-login__page-glow ul-login__page-glow--tr-small" />
      <span className="ul-login__page-glow ul-login__page-glow--bl-big" />
      <span className="ul-login__page-glow ul-login__page-glow--bl-small" />
      {PAGE_BG_ICONS.map(({ Icon, size, top, left, duration, delay }, i) => (
        <span
          key={i}
          className="ul-login__page-icon"
          style={{ top, left, animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
        >
          <Icon size={size} />
        </span>
      ))}
    </div>
  );
}

// Brand logomark — the real Universal Learning mark (open book + leaf),
// not a hand-drawn approximation.
function LogoMark({ size = 56 }) {
  return <img src={brandLogo} alt="Universal Learning" width={size} height={size} className="ul-login__logo-img" />;
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
        setStage("leaving");
      }, 700);
      return () => clearTimeout(timer);
    }
    if (stage === "leaving") {
      // Let the exit animation (see .ul-login--leaving in AdminAuth.css)
      // play out before the route swap, so the dashboard's own slide-in
      // (AdminLayout.jsx's .ul-main__page) picks up right where this
      // leaves off — no blank/paused frame in between.
      const timer = setTimeout(() => {
        navigate("/admin/logindashboard", { replace: true });
      }, 220);
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
    <div className={`ul-login${stage === "leaving" ? " ul-login--leaving" : ""}`}>
      <PageBackdrop />

      <div className="ul-login__content">
        <div className="ul-login__brandmark">
          <LogoMark size={58} />
          <h1 className="ul-login__wordmark">
            <span className="ul-login__wordmark-dark">Universal</span>{" "}
            <span className="ul-login__wordmark-accent">Learning</span>
          </h1>
          <p className="ul-login__subtitle">Welcome back. Sign in to your admin portal.</p>
        </div>

        <div className="ul-login__card">
          {stage === "credentials" && (
            <form className="ul-login__body" onSubmit={handleCredentialsSubmit} noValidate>
              <label className="ul-login__label" htmlFor="admin-email">Email Address</label>
              <div className="ul-login__field-wrap">
                <span className="ul-login__field-icon"><IconMail size={16} /></span>
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
                <span className="ul-login__field-icon"><IconLock size={16} /></span>
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
                  {showPassword ? <IconEyeOff size={16} /> : <IconEye size={16} />}
                </button>
              </div>

              {error && <p className="ul-login__error">{error}</p>}

              <button className="ul-login__submit" type="submit">
                Sign In <IconArrowRight size={16} />
              </button>
            </form>
          )}

          {(stage === "loading" || stage === "leaving") && (
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
