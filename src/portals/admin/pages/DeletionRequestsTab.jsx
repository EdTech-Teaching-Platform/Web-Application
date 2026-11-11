import { useCallback, useEffect, useState } from "react";
import { accountDeletionsApi } from "../services/accountDeletionsApi";
import { useRpc } from "../hooks/useRpc";
import { IconSearch } from "../components/icons";
import PageToast from "../../../components/feedback/Toast";

// Help Desk > Deletion Requests (QA #21, 20261111090000): students' and
// educators' delete-account requests. Approve blocks the account in SQL
// (student blocked / educator suspended), then bans its sign-in with
// set-user-ban (a failure is a warning with Retry). Reject notifies the user.
// The data deletion itself is done by hand afterwards.
const PAGE_SIZE = 8;
const STATUSES = ["pending", "approved", "rejected", "cancelled", "all"];
const label = (value) => String(value || "").replaceAll("_", " ").replace(/\b\w/g, (c) => c.toUpperCase());
const when = (d, withTime) => (d ? (withTime ? new Date(d).toLocaleString() : new Date(d).toLocaleDateString()) : "—");

export default function DeletionRequestsTab({ api = accountDeletionsApi }) {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("pending");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const listRequest = useCallback(() => api.list({ search, status, page, size: PAGE_SIZE }), [api, search, status, page]);
  const list = useRpc(listRequest);
  useEffect(() => { setPage(1); }, [search, status]);

  const ban = (row) => Promise.resolve()
    .then(() => api.ban(row.userId, "Account deletion approved"))
    .then(() => true)
    .catch((e) => {
      setToast({
        tone: "warning",
        message: `${row.name || "The account"} is blocked in the app, but the sign-in ban failed: ${e?.message || "unknown error"}`,
        actionLabel: "Retry",
        onAction: () => ban(row).then((ok) => ok && setToast({ tone: "success", message: "Sign-in ban applied." })),
      });
      return false;
    });

  const decide = async (decision) => {
    if (busy || !selected) return;
    setBusy(true);
    const row = selected;
    try {
      await api.resolve(row.id, decision, note);
      setSelected(null);
      list.refetch().catch(() => {});
      if (decision === "approved") {
        if (await ban(row)) setToast({ tone: "success", message: `Approved. ${row.name || "The account"} can no longer sign in; delete its data next.` });
      } else {
        setToast({ tone: "success", message: "Request rejected. The user has been notified." });
      }
    } catch (e) {
      setToast(e);
    } finally {
      setBusy(false);
    }
  };

  const rows = list.data?.rows || [];
  return <>
    <div className="ul-set-filters">
      <label className="ul-set-search"><IconSearch size={14} /><input placeholder="Search by name or email…" value={search} onChange={(e) => setSearch(e.target.value)} /></label>
      <select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Request status">
        {STATUSES.map((v) => <option key={v} value={v}>{v === "all" ? "All statuses" : label(v)}</option>)}
      </select>
    </div>
    {list.error && <div className="ul-set-error">{list.error.message} <button type="button" onClick={() => list.refetch()}>Retry</button></div>}
    <div className="ul-card"><div className="ul-set-table">
      <div className="ul-set-table__head"><span>Account</span><span>Role</span><span>Status</span><span>Requested</span><span /></div>
      {list.loading ? <p className="ul-audit-empty">Loading…</p> : !rows.length ? <p className="ul-audit-empty">No deletion requests.</p> : rows.map((row) => (
        <div className="ul-set-table__row" key={row.id}>
          <span><strong>{row.name || "Unknown"}</strong><small>{row.email}{row.reason ? ` · "${row.reason}"` : ""}</small></span>
          <span>{row.role === "educator" ? "Educator" : "Student"}</span>
          <span className="ul-status-badge">{label(row.status)}</span>
          <span>{when(row.createdAt)}</span>
          <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { setSelected(row); setNote(""); }}>View</button>
        </div>
      ))}
    </div></div>
    <div className="ul-sup-export-row">
      <button type="button" className="ul-btn ul-btn--ghost" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
      <span>Page {page} · {list.data?.total || 0}</span>
      <button type="button" className="ul-btn ul-btn--ghost" disabled={!list.data || page * PAGE_SIZE >= list.data.total} onClick={() => setPage(page + 1)}>Next</button>
    </div>
    {selected && <div className="ul-audit-modal-backdrop" role="presentation"><div className="ul-audit-modal" role="dialog" aria-modal="true" aria-label="Deletion request">
      <h3>{selected.name || "Unknown"} · {selected.role === "educator" ? "Educator" : "Student"}</h3>
      <p>{selected.email} · requested {when(selected.createdAt, true)} · {label(selected.status)}</p>
      <p>{selected.reason ? `Reason: ${selected.reason}` : "No reason given."}</p>
      {selected.status === "pending" ? <>
        <p>Approving blocks the account at once (a student is blocked, an educator suspended) and bans its sign-in. Delete the account's data afterwards.</p>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note (shown to the user if rejected)" maxLength={1000} />
      </> : <p>
        {selected.decidedAt ? `Decided ${when(selected.decidedAt, true)}${selected.decidedByName ? ` by ${selected.decidedByName}` : ""}` : ""}
        {selected.decisionNote ? ` · ${selected.decisionNote}` : ""}
      </p>}
      <div className="ul-audit-modal__actions">
        {selected.status === "pending" && <button type="button" className="ul-btn ul-btn--primary" disabled={busy} onClick={() => decide("approved")}>Approve and block</button>}
        {selected.status === "pending" && <button type="button" className="ul-btn ul-btn--ghost" disabled={busy} onClick={() => decide("rejected")}>Reject</button>}
        <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setSelected(null)}>Close</button>
      </div>
    </div></div>}
    <PageToast message={toast} onDone={() => setToast("")} />
  </>;
}
