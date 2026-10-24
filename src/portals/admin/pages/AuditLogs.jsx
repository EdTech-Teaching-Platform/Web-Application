import { useCallback, useEffect, useState } from "react";
import { securityApi } from "../services/securityApi";
import { useRpc } from "../hooks/useRpc";
import { IconSearch } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./AuditLogs.css";

export default function AuditLogs() {
  const [event, setEvent] = useState("all"); const [page, setPage] = useState(1); const [query, setQuery] = useState("");
  const request = useCallback(() => securityApi.events({ event, page, size: 20 }), [event, page]);
  const logs = useRpc(request); useEffect(() => setPage(1), [event]);
  const rows = (logs.data?.rows || []).filter((r) => !query || `${r.user} ${r.email} ${r.event_type} ${r.role}`.toLowerCase().includes(query.toLowerCase()));
  return <div className="ul-audit-page"><div className="ul-dash-welcome"><div><h2 className="ul-dash-welcome__title">Audit Logs</h2><p className="ul-dash-welcome__subtitle">Authentication events recorded by the platform.</p></div></div>
    <div className="ul-card ul-audit-panel"><div className="ul-audit-toolbar"><label className="ul-edu-search"><IconSearch size={14}/><input placeholder="Search user or event…" value={query} onChange={(e) => setQuery(e.target.value)}/></label><select value={event} onChange={(e) => setEvent(e.target.value)}><option value="all">All events</option><option value="login">Login</option><option value="logout">Logout</option><option value="logout_all">Logout all</option><option value="session_revoked">Session revoked</option><option value="login_blocked">Login blocked</option></select></div>
    {logs.error ? <p className="ul-audit-empty">{logs.error.message} <button onClick={() => logs.refetch().catch(() => {})}>Retry</button></p> : logs.loading ? <p className="ul-audit-empty">Loading…</p> : !rows.length ? <p className="ul-audit-empty">No authentication events found.</p> : <div className="ul-notification-table"><div className="ul-notification-table__head"><span>User</span><span>Event</span><span>Role</span><span>At</span></div>{rows.map((row) => <div className="ul-notification-row" key={row.id}><div className="ul-notification-row__main"><strong>{row.user || "Deleted user"}</strong><p>{row.email || "—"}</p></div><span>{row.event_type}</span><span>{row.role || "—"}</span><span>{row.at ? new Date(row.at).toLocaleString() : "—"}</span></div>)}</div>}
    <div className="ul-sup-export-row"><button className="ul-btn ul-btn--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {logs.data?.total || 0}</span><button className="ul-btn ul-btn--ghost" disabled={!logs.data || page * 20 >= logs.data.total} onClick={() => setPage(page + 1)}>Next</button></div></div></div>;
}
