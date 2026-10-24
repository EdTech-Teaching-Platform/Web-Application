import { useCallback, useState } from "react";
import { useNavigate } from "react-router-dom";
import { securityApi } from "../services/securityApi";
import { useRpc } from "../hooks/useRpc";
import { IconShield } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./SecurityCenter.css";

export default function SecurityCenter() {
  const navigate = useNavigate(); const [tab, setTab] = useState("password"); const [toast, setToast] = useState("");
  const sessions = useRpc(securityApi.sessions);
  const revoke = async (userId) => { try { await securityApi.revoke(userId); setToast("Sessions revoked."); sessions.refetch().catch(() => {}); } catch (e) { setToast(e.message); } };
  const signOutAll = async () => { try { await securityApi.signOutOtherDevices(); setToast("Signed out of all other sessions."); sessions.refetch().catch(() => {}); } catch (e) { setToast(e.message); } };
  return <div className="ul-sec-page"><div className="ul-dash-welcome"><h2 className="ul-dash-welcome__title">Security Center</h2><p className="ul-dash-welcome__subtitle">Your account authentication and active devices.</p></div>
    <div className="ul-tabs"><button className={`ul-tab${tab === "password" ? " is-active" : ""}`} onClick={() => setTab("password")}>Password</button><button className={`ul-tab${tab === "sessions" ? " is-active" : ""}`} onClick={() => setTab("sessions")}>Sessions &amp; Devices</button></div>
    {tab === "password" ? <div className="ul-sec-grid"><div className="ul-card"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconShield size={12}/> password</span><h3>Account password</h3></div><p>Change the password for your Admin account.</p><button className="ul-btn ul-btn--primary" onClick={() => navigate("/admin/security/change-password")}>Change password</button></div></div> :
      <div className="ul-card ul-sec-panel"><div className="ul-audit-toolbar"><p className="ul-set-section-title" style={{ margin: 0 }}>Active sessions &amp; devices</p><button className="ul-btn ul-btn--danger" onClick={signOutAll}>Sign out all other sessions</button></div>{sessions.error ? <p className="ul-audit-empty">{sessions.error.message} <button onClick={() => sessions.refetch().catch(() => {})}>Retry</button></p> : sessions.loading ? <p className="ul-audit-empty">Loading…</p> : !sessions.data?.length ? <p className="ul-audit-empty">No active sessions.</p> : <div className="ul-sec-session-list">{sessions.data.map((s) => <div className="ul-sec-session-row" key={s.session_id}><div className="ul-sec-session-row__main"><strong>{s.user_agent || "Unknown device"}</strong><small>{s.role || "—"}</small></div><div className="ul-sec-session-row__meta"><small>Last active {new Date(s.last_seen_at).toLocaleString()}</small></div><button className="ul-btn ul-btn--ghost" onClick={() => revoke(s.user_id)}>Revoke user sessions</button></div>)}</div>}</div>}
    {toast && <div className="ul-set-toast">{toast}</div>}</div>;
}
