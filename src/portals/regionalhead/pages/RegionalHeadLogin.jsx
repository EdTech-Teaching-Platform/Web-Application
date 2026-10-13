import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import { activeHeadByEmail, getRegionalState } from "../../admin/data/regionalHeadsMock";
import { IconEye, IconEyeOff, IconMail, IconLock } from "../../admin/components/icons";
import brandLogo from "../../../assets/brand-logo.png";
import "../../admin/adminTheme.css";
import "../../../auth/pages/AdminAuth.css";

// Separate sign-in for Regional Heads. Only an ACTIVE Regional Head (created by an
// Admin invitation or promotion) can sign in, and the session is tied to that
// head's region. Demo build: there is no password service yet, so any non-empty
// password is accepted once the email matches an active Regional Head.
export default function RegionalHeadLogin() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [show, setShow] = useState(false);
  const [error, setError] = useState(location.state && location.state.denied ? "Your Regional Head access is no longer active. Contact Admin." : "");

  if (user && user.role === "regionalhead") return <Navigate to="/regionalhead" replace />;

  const submit = (e) => {
    e.preventDefault();
    const email = form.email.trim();
    if (!email || !form.password) { setError("Enter your email and password to continue."); return; }
    const head = activeHeadByEmail(email, getRegionalState());
    if (!head) { setError("This email is not an active Regional Head. Ask Admin to invite you."); return; }
    setError("");
    setUser({ name: head.name, email: head.email, role: "regionalhead", headId: head.id, region: head.region });
    navigate("/regionalhead", { replace: true });
  };

  return (
    <div className="ul-login">
      <div className="ul-login__content">
        <div className="ul-login__brandmark">
          <img src={brandLogo} alt="Universal Learning" width={58} height={58} className="ul-login__logo-img" />
          <h1 className="ul-login__wordmark">
            <span className="ul-login__wordmark-dark">Universal</span>{" "}
            <span className="ul-login__wordmark-accent">Learning</span>
          </h1>
          <p className="ul-login__subtitle">Regional Head sign in. You will only see your own region.</p>
        </div>
        <div className="ul-login__card">
          <form className="ul-login__body" onSubmit={submit} noValidate>
            <label className="ul-login__label" htmlFor="rh-email">Email Address</label>
            <div className="ul-login__field-wrap">
              <span className="ul-login__field-icon"><IconMail size={16} /></span>
              <input id="rh-email" type="email" autoComplete="username" className="ul-login__field ul-login__field--icon"
                placeholder="Enter your email address" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <label className="ul-login__label" htmlFor="rh-password">Password</label>
            <div className="ul-login__field-wrap">
              <span className="ul-login__field-icon"><IconLock size={16} /></span>
              <input id="rh-password" type={show ? "text" : "password"} autoComplete="current-password"
                className="ul-login__field ul-login__field--icon ul-login__field--password" placeholder="Enter your password"
                value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <button type="button" className="ul-login__field-toggle" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"}>
                {show ? <IconEyeOff size={16} /> : <IconEye size={16} />}
              </button>
            </div>
            {error && <p className="ul-login__error">{error}</p>}
            <button className="ul-login__submit" type="submit">Sign In</button>
            <p style={{ fontSize: 12, color: "#7a6f6c", margin: "12px 0 0" }}>
              Demo: sign in as alan.turing@example.com (Delhi) or meredith.chan@example.com (Bengaluru) with any password.
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
