// Admin Security Center
//
// Personal + platform security surface for the signed-in Admin: MFA status
// and management, active sessions/devices, recent login activity, failed
// login attempts, password/security policy settings, and security alerts.
// Separate from SettingsPermissions.jsx's platform-wide "Platform
// Configuration" toggles (maintenance mode, registration approval, etc.) —
// this page owns the Admin's own account-security surface instead, reached
// from AdminTopbar's Security shortcut, so neither page duplicates state.
//
// Mock data lives in data/securityMock.js pending the real Security & Access
// endpoints. All actions below (revoke session, regenerate backup codes,
// acknowledge/resolve alert, update policy) mutate local component state
// only — no backend calls yet.

import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  mfaStatus as mfaStatusSeed,
  passwordInfo,
  activeSessionSeeds,
} from "../data/securityMock";
import {
  IconLock,
  IconShield,
  IconAlert,
  IconClose,
  IconRefresh,
} from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./SecurityCenter.css";

const TABS = [
  { key: "mfa", label: "Password" },
  { key: "sessions", label: "Sessions & Devices" },
];

export default function SecurityCenter() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("mfa");
  const [mfa, setMfa] = useState(mfaStatusSeed);
  const [sessions, setSessions] = useState(activeSessionSeeds);
  const [toast, setToast] = useState("");
  const [confirmingSignOutAll, setConfirmingSignOutAll] = useState(false);
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const toggleMfa = () => {
    setMfa((current) => ({ ...current, enabled: !current.enabled }));
    setToast(mfa.enabled ? "MFA disabled for your account" : "MFA enabled for your account");
  };

  const regenerateBackupCodes = () => {
    setMfa((current) => ({ ...current, backupCodesRemaining: current.backupCodesTotal }));
    setToast("New backup codes generated");
  };

  const revokeSession = (id) => {
    setSessions((current) => current.filter((s) => s.id !== id));
    setToast("Session revoked");
  };

  const signOutAllOtherSessions = () => {
    setSessions((current) => current.filter((s) => s.current));
    setConfirmingSignOutAll(false);
    setToast("Signed out of all other sessions");
  };

  return (
    <div className="ul-sec-page">
      <div className="ul-dash-welcome">
        <h2 className="ul-dash-welcome__title">Security Center</h2>
        <p className="ul-dash-welcome__subtitle">Your account&rsquo;s authentication, sessions, activity, and security policy in one place.</p>
      </div>

      <div className="ul-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`ul-tab${tab === t.key ? " is-active" : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "mfa" && (
        <div className="ul-sec-grid">
          <div className="ul-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow"><IconLock size={12} color="var(--color-primary)" /> two-factor authentication</span>
              <h3>Password Management</h3>
            </div>

            <div className="ul-set-switch-row">
              <div className="ul-set-switch-row__body">
                <p className="ul-set-switch-row__label">Require MFA on sign-in</p>
                <p className="ul-set-switch-row__desc">{mfa.method} · enrolled {mfa.enrolledOn} · last verified {mfa.lastVerified}</p>
              </div>
              <button
                type="button"
                className={`ul-set-switch${mfa.enabled ? " is-on" : ""}`}
                aria-pressed={mfa.enabled}
                onClick={toggleMfa}
              />
            </div>

            <div className="ul-set-switch-row">
              <div className="ul-set-switch-row__body">
                <p className="ul-set-switch-row__label">SMS backup number</p>
                <p className="ul-set-switch-row__desc">Used if your authenticator app isn&rsquo;t available.</p>
              </div>
              <span className="ul-sec-value">{mfa.phoneBackup}</span>
            </div>

            <div className="ul-set-switch-row">
              <div className="ul-set-switch-row__body">
                <p className="ul-set-switch-row__label">Backup codes</p>
                <p className="ul-set-switch-row__desc">{mfa.backupCodesRemaining} of {mfa.backupCodesTotal} unused codes remaining.</p>
              </div>
              <button type="button" className="ul-btn ul-btn--ghost ul-sec-regen-btn" onClick={regenerateBackupCodes}>
                <IconRefresh size={13} /> Regenerate codes
              </button>
            </div>
          </div>

          <div className="ul-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow"><IconShield size={12} color="var(--color-primary)" /> password</span>
              <h3>Password</h3>
            </div>
            <div className="ul-set-switch-row">
              <div className="ul-set-switch-row__body">
                <p className="ul-set-switch-row__label">Current password strength</p>
                <p className="ul-set-switch-row__desc">Last changed {passwordInfo.lastChanged} ({passwordInfo.daysSinceChange} days ago).</p>
              </div>
              <span className="ul-status-badge is-approved">{passwordInfo.strength}</span>
            </div>
            <button type="button" className="ul-btn ul-btn--primary ul-sec-change-pw-btn" onClick={() => navigate("/admin/security/change-password")}>Change password</button>
          </div>

        </div>
      )}

      {tab === "sessions" && (
        <div className="ul-card ul-sec-panel">
          <div className="ul-audit-toolbar">
            <p className="ul-set-section-title" style={{ margin: 0 }}>Active sessions & devices</p>
            <button type="button" className="ul-btn ul-btn--danger" onClick={() => setConfirmingSignOutAll(true)} disabled={sessions.length <= 1}>
              Sign out all other sessions
            </button>
          </div>
          <div className="ul-sec-session-list">
            {sessions.map((s) => (
              <div className="ul-sec-session-row" key={s.id}>
                <div className="ul-sec-session-row__main">
                  <strong>{s.device}{s.current && <span className="ul-status-badge is-approved ul-sec-session-row__current">This device</span>}</strong>
                  <small>{s.browser} · {s.os}</small>
                </div>
                <div className="ul-sec-session-row__meta">
                  <span>{s.location} · {s.ip}</span>
                  <small>Signed in {s.signedIn} · {s.lastActive}</small>
                </div>
                {!s.current ? (
                  <button type="button" className="ul-btn ul-btn--ghost ul-sec-revoke-btn" onClick={() => revokeSession(s.id)}>
                    <IconClose size={13} /> Revoke
                  </button>
                ) : (
                  <span className="ul-sec-session-row__note">Active</span>
                )}
              </div>
            ))}
            {!sessions.length && <p className="ul-audit-empty">No active sessions.</p>}
          </div>
        </div>
      )}

      {confirmingSignOutAll && (
        <div className="ul-audit-modal-backdrop" role="presentation" onMouseDown={() => setConfirmingSignOutAll(false)}>
          <div className="ul-audit-modal" onMouseDown={(event) => event.stopPropagation()}>
            <div className="ul-audit-modal__head">
              <div>
                <span className="ul-card__eyebrow ul-card__eyebrow--warning"><IconAlert size={12} color="var(--color-warning-accent)" /> confirm</span>
                <h3>Sign out all other sessions?</h3>
              </div>
            </div>
            <p className="ul-audit-detail-copy">
              This immediately ends every session except this device ({sessions.length - 1} session{sessions.length - 1 === 1 ? "" : "s"} will be signed out).
            </p>
            <div className="ul-audit-modal__actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setConfirmingSignOutAll(false)}>Cancel</button>
              <button type="button" className="ul-btn ul-btn--danger" onClick={signOutAllOtherSessions}>Sign out all</button>
            </div>
          </div>
        </div>
      )}

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}
