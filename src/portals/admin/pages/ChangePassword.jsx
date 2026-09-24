// Dedicated "Change Password" page for the signed-in Admin — split out of
// SecurityCenter.jsx's MFA & Password tab so the actual password-change
// flow has its own focused screen instead of a placeholder toast. Reuses
// passwordInfo from data/securityMock.js; no backend call yet, this only
// updates local component state and shows a success toast.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { passwordInfo } from "../data/securityMock";
import { IconChevronLeft, IconShield } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./ChangePassword.css";

export default function ChangePassword() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ current: "", next: "", confirm: "" });
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const handleChange = (field, value) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.current || !form.next || !form.confirm) {
      setError("Fill in all three fields.");
      return;
    }
    if (form.next.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (form.next !== form.confirm) {
      setError("New password and confirmation don't match.");
      return;
    }
    setError("");
    setForm({ current: "", next: "", confirm: "" });
    setToast("Password updated successfully.");
  };

  return (
    <div className="ul-cpw-page">
      <button type="button" className="ul-cpw-back" onClick={() => navigate("/admin/security")}>
        <IconChevronLeft size={14} /> Back to Security Center
      </button>

      <div className="ul-dash-welcome">
        <h2 className="ul-dash-welcome__title">Change Password</h2>
        <p className="ul-dash-welcome__subtitle">Update the password for your own Admin account.</p>
      </div>

      <div className="ul-card ul-cpw-card">
        <div className="ul-card__head">
          <span className="ul-card__eyebrow"><IconShield size={12} color="var(--color-primary)" /> current password</span>
          <h3>Password strength: {passwordInfo.strength}</h3>
        </div>
        <p className="ul-cpw-meta">Last changed {passwordInfo.lastChanged} ({passwordInfo.daysSinceChange} days ago).</p>

        <form onSubmit={handleSubmit} className="ul-cpw-form">
          <label className="ul-cpw-field">
            <span>Current password</span>
            <input
              type="password"
              value={form.current}
              onChange={(e) => handleChange("current", e.target.value)}
              placeholder="Enter your current password"
              autoComplete="current-password"
            />
          </label>
          <label className="ul-cpw-field">
            <span>New password</span>
            <input
              type="password"
              value={form.next}
              onChange={(e) => handleChange("next", e.target.value)}
              placeholder="At least 8 characters"
              autoComplete="new-password"
            />
          </label>
          <label className="ul-cpw-field">
            <span>Confirm new password</span>
            <input
              type="password"
              value={form.confirm}
              onChange={(e) => handleChange("confirm", e.target.value)}
              placeholder="Re-enter the new password"
              autoComplete="new-password"
            />
          </label>

          {error && <p className="ul-cpw-error">{error}</p>}

          <div className="ul-cpw-actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => navigate("/admin/security")}>
              Cancel
            </button>
            <button type="submit" className="ul-btn ul-btn--primary">
              Update password
            </button>
          </div>
        </form>
      </div>

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}
