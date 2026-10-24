import { useCallback, useEffect, useState } from "react";
import { callbacksApi } from "../services/callbacksApi";
import { useRpc } from "../hooks/useRpc";
import { IconDownload, IconSearch } from "../components/icons";
import "./AdminDashboard.css";
import "./SettingsPermissions.css";
import "./SupportTickets.css";

const PAGE_SIZE = 8;
const label = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());

function download(rows) {
  const keys = ["request_id", "name", "phone", "email", "organization", "source", "message", "status", "received_at"];
  const csv = [keys, ...rows.map((row) => keys.map((key) => row[key] ?? ""))]
    .map((row) => row.map((v) => `"${String(v).replaceAll('"', '""')}"`).join(",")).join("\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
  const link = document.createElement("a"); link.href = url; link.download = "callback-report.csv"; link.click(); URL.revokeObjectURL(url);
}

export default function SupportTickets() {
  const [search, setSearch] = useState(""); const [status, setStatus] = useState("all");
  const [source, setSource] = useState("all"); const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null); const [note, setNote] = useState("");
  const [toast, setToast] = useState("");
  const stats = useRpc(callbacksApi.stats);
  const listRequest = useCallback(() => callbacksApi.list({ search, status, source, page, size: PAGE_SIZE }), [search, status, source, page]);
  const list = useRpc(listRequest);
  useEffect(() => { setPage(1); }, [search, status, source]);
  const retry = () => { stats.refetch().catch(() => {}); list.refetch().catch(() => {}); };
  const open = async (row) => { try { const data = await callbacksApi.detail(row.id); setSelected(data); setNote(""); } catch (e) { setToast(e.message); } };
  const changeStatus = async (value) => { try { await callbacksApi.setStatus(selected.id, value, note); setSelected(null); setToast(`Marked ${label(value)}.`); list.refetch().catch(() => {}); stats.refetch().catch(() => {}); } catch (e) { setToast(e.message); } };
  const exportRows = async () => { try { download(await callbacksApi.export({ search, status, source })); } catch (e) { setToast(e.message); } };
  const s = stats.data || {};
  return <div className="ul-sup-page">
    <div className="ul-dash-welcome"><div><h2 className="ul-dash-welcome__title">Callback Requests</h2><p className="ul-dash-welcome__subtitle">Follow up on direct callback requests captured from the site.</p></div></div>
    <div className="ul-stats ul-sup-stats">{[["TOTAL REQUESTS", s.total], ["NEW", s.new], ["CONTACTED", s.contacted], ["CLOSED", s.closed]].map(([name, value]) => <div className="ul-stat-card" key={name}><span className="ul-stat-card__label">{name}</span><span className="ul-stat-card__value">{stats.loading ? "…" : value ?? 0}</span></div>)}</div>
    <div className="ul-set-filters"><label className="ul-set-search"><IconSearch size={14}/><input placeholder="Search by name, phone, email or message…" value={search} onChange={(e) => setSearch(e.target.value)} /></label><select value={status} onChange={(e) => setStatus(e.target.value)}><option value="all">All statuses</option><option value="new">New</option><option value="contacted">Contacted</option><option value="closed">Closed</option></select><select value={source} onChange={(e) => setSource(e.target.value)}><option value="all">All sources</option><option value="website_visitor">Website Visitor</option><option value="prospective_institution">Prospective Institution</option><option value="prospective_educator">Prospective Educator</option><option value="other">Other</option></select></div>
    {list.error && <div className="ul-set-error">{list.error.message} <button type="button" onClick={retry}>Retry</button></div>}
    <div className="ul-card"><div className="ul-set-table"><div className="ul-set-table__head"><span>Request</span><span>Source</span><span>Status</span><span>Received</span><span /></div>{list.loading ? <p className="ul-audit-empty">Loading…</p> : !list.data?.rows.length ? <p className="ul-audit-empty">No callback requests found.</p> : list.data.rows.map((row) => <div className="ul-set-table__row" key={row.id}><span><strong>{row.name}</strong><small>{row.phone_display || row.phone} · {row.email || "No email"}</small></span><span>{row.source_label || label(row.source)}</span><span className="ul-status-badge">{row.status_label || label(row.status)}</span><span>{row.created_at ? new Date(row.created_at).toLocaleDateString() : "—"}</span><button type="button" className="ul-btn ul-btn--ghost" onClick={() => open(row)}>View</button></div>)}</div></div>
    <div className="ul-sup-export-row"><button type="button" className="ul-btn ul-btn--ghost" onClick={exportRows}><IconDownload size={13}/> Export Callback Report</button><button type="button" className="ul-btn ul-btn--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button><span>Page {page} · {list.data?.total || 0}</span><button type="button" className="ul-btn ul-btn--ghost" disabled={!list.data || page * PAGE_SIZE >= list.data.total} onClick={() => setPage(page + 1)}>Next</button></div>
    {selected && <div className="ul-audit-modal-backdrop" role="presentation"><div className="ul-audit-modal"><h3>{selected.code} · {selected.name}</h3><p>{selected.message}</p><p>{selected.phone} · {selected.email || "No email"}</p><textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Follow-up note" /><div className="ul-audit-modal__actions">{["new", "contacted", "closed"].map((value) => <button type="button" className="ul-btn ul-btn--primary" key={value} onClick={() => changeStatus(value)}>{label(value)}</button>)}<button type="button" className="ul-btn ul-btn--ghost" onClick={() => setSelected(null)}>Close</button></div></div></div>}
    {toast && <div className="ul-set-toast">{toast}</div>}
  </div>;
}
