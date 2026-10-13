import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useRegionHead } from "../hooks/useRegionHead";
import { Modal, Tabs } from "../../admin/pages/discounts/DiscountsShared";
import {
  QUERY_CATEGORY_LABEL, QUERY_STATUS_LABEL, QUERY_STATUS_BADGE, PRIORITY, PRIORITY_LABEL,
  ESC_STATUS_LABEL, ESC_STATUS_BADGE, PERSON_LABEL, isWithinAuthority, resolveQuery, addQueryNote, escalateQuery,
  fmtDateTime, timeAgo,
} from "../../admin/data/regionalPortalMock";
import "../../admin/pages/AdminDashboard.css";
import "../../admin/pages/EducatorVerification.css";
import "../../admin/pages/SettingsPermissions.css";

function Timeline({ items }) {
  return (
    <ul className="ul-rhp-timeline">
      {items.map((h, i) => (
        <li key={i}>
          <strong>{h.action}</strong> · {h.by}{h.role ? ` (${h.role})` : ""}
          {h.note && <div>{h.note}</div>}
          <small>{fmtDateTime(h.at)}</small>
        </li>
      ))}
    </ul>
  );
}

export default function RHQueries() {
  const { head, region, data } = useRegionHead();
  const [params, setParams] = useSearchParams();
  const tab = ["open", "history", "escalations"].includes(params.get("tab")) ? params.get("tab") : "open";
  const setTab = (t) => setParams({ tab: t }, { replace: true });

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [personType, setPersonType] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [escId, setEscId] = useState(null);
  const [mode, setMode] = useState("view"); // view | resolve | escalate
  const [note, setNote] = useState("");
  const [reason, setReason] = useState("");
  const [priority, setPriority] = useState(PRIORITY.MEDIUM);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const typeOf = (x) => x.personType || "student";
  const match = (x) => (category === "all" || x.category === category) && (personType === "all" || typeOf(x) === personType)
    && (!search.trim() || `${x.studentName} ${x.subject} ${x.id}`.toLowerCase().includes(search.trim().toLowerCase()));

  const openQ = useMemo(() => data.queries.filter((x) => x.status === "open" && match(x)), [data.queries, search, category, personType]); // eslint-disable-line react-hooks/exhaustive-deps
  const history = useMemo(() => data.queries.filter((x) => x.status === "resolved" && match(x))
    .sort((a, b) => new Date(b.resolution.at) - new Date(a.resolution.at)), [data.queries, search, category, personType]); // eslint-disable-line react-hooks/exhaustive-deps
  const escs = useMemo(() => data.escalations.filter((e) => match(e)), [data.escalations, search, category, personType]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = data.queries.find((x) => x.id === openId) || null;
  const esc = data.escalations.find((e) => e.id === escId) || null;

  const close = () => { setOpenId(null); setEscId(null); setMode("view"); setNote(""); setReason(""); setErr(""); setPriority(PRIORITY.MEDIUM); };
  const openQuery = (x, m = "view") => { close(); setOpenId(x.id); setMode(m); if (m === "escalate") setPriority(x.priority); };

  const doResolve = () => {
    const res = resolveQuery({ region, headName: head.name, queryId: query.id, note });
    if (!res.ok) { setErr(res.error); return; }
    flash(`${query.id} resolved.`); close();
  };
  const doEscalate = () => {
    const res = escalateQuery({ region, head, queryId: query.id, reason, priority });
    if (!res.ok) { setErr(res.error); return; }
    flash(`${query.id} escalated to Admin.`); close(); setTab("escalations");
  };
  const doNote = () => {
    const res = addQueryNote({ region, headName: head.name, queryId: query.id, note });
    if (!res.ok) { setErr(res.error); return; }
    setNote(""); setErr("");
  };

  const filters = (
    <div className="ul-rhp-toolbar">
      <input placeholder="Search name, subject or ID" value={search} onChange={(e) => setSearch(e.target.value)} />
      <select value={personType} onChange={(e) => setPersonType(e.target.value)}>
        <option value="all">Students &amp; teachers</option>
        <option value="student">Students only</option>
        <option value="teacher">Teachers only</option>
      </select>
      <select value={category} onChange={(e) => setCategory(e.target.value)}>
        <option value="all">All categories</option>
        {Object.entries(QUERY_CATEGORY_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
      </select>
    </div>
  );

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Query Resolution</h2>
          <p className="ul-edu-header__subtitle">Resolve student queries within your authority, or escalate to Admin. Only {region} queries appear here.</p>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "open", label: `Open (${data.queries.filter((x) => x.status === "open").length})` },
        { key: "history", label: `Resolution history (${data.queries.filter((x) => x.status === "resolved").length})` },
        { key: "escalations", label: `Escalations (${data.escalations.length})` },
      ]} />
      <div style={{ height: 12 }} />
      {filters}

      {tab === "open" && (
        <div className="ul-card ul-edu-table-card"><div className="ul-rhp-table-wrap">
          <table className="ul-edu-table">
            <thead><tr><th>Query</th><th>Raised by</th><th>Category</th><th>Priority</th><th>Raised</th><th aria-label="Actions" /></tr></thead>
            <tbody>
              {openQ.length === 0 && <tr><td colSpan={6} style={{ padding: 24 }}>No open queries.</td></tr>}
              {openQ.map((x) => (
                <tr key={x.id} className="ul-edu-row--clickable" onClick={() => openQuery(x)}>
                  <td><strong>{x.subject}</strong><span className="ul-rhp-sub">{x.id}</span></td>
                  <td>{x.studentName}<span className="ul-rhp-sub">{PERSON_LABEL[typeOf(x)]}</span></td>
                  <td>{QUERY_CATEGORY_LABEL[x.category]}{!isWithinAuthority(x.category) && <span className="ul-rhp-sub">Needs Admin</span>}</td>
                  <td>{PRIORITY_LABEL[x.priority]}</td>
                  <td>{timeAgo(x.createdAt)}</td>
                  <td>
                    <div className="ul-rhp-actions" style={{ justifyContent: "flex-end" }} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="ul-btn ul-btn--ghost" disabled={!isWithinAuthority(x.category)} title={isWithinAuthority(x.category) ? "" : "Outside your authority — escalate to Admin"} onClick={() => openQuery(x, "resolve")}>Resolve</button>
                      <button type="button" className="ul-btn ul-btn--primary" onClick={() => openQuery(x, "escalate")}>Escalate to Admin</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {tab === "history" && (
        <div className="ul-card ul-edu-table-card"><div className="ul-rhp-table-wrap">
          <table className="ul-edu-table">
            <thead><tr><th>Query</th><th>Raised by</th><th>Resolved by</th><th>Resolved</th><th aria-label="Details" /></tr></thead>
            <tbody>
              {history.length === 0 && <tr><td colSpan={5} style={{ padding: 24 }}>Nothing resolved yet.</td></tr>}
              {history.map((x) => (
                <tr key={x.id} className="ul-edu-row--clickable" onClick={() => openQuery(x)}>
                  <td><strong>{x.subject}</strong><span className="ul-rhp-sub">{x.id} · {QUERY_CATEGORY_LABEL[x.category]}</span></td>
                  <td>{x.studentName}<span className="ul-rhp-sub">{PERSON_LABEL[typeOf(x)]}</span></td>
                  <td>{x.resolution.by}</td>
                  <td>{fmtDateTime(x.resolution.at)}</td>
                  <td><button type="button" className="ul-btn ul-btn--ghost" onClick={(e) => { e.stopPropagation(); openQuery(x); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {tab === "escalations" && (
        <div className="ul-card ul-edu-table-card"><div className="ul-rhp-table-wrap">
          <table className="ul-edu-table">
            <thead><tr><th>Escalation</th><th>Raised by</th><th>Status</th><th>Admin response</th><th>Updated</th><th aria-label="Details" /></tr></thead>
            <tbody>
              {escs.length === 0 && <tr><td colSpan={6} style={{ padding: 24 }}>You have not escalated anything.</td></tr>}
              {escs.map((e) => (
                <tr key={e.id} className="ul-edu-row--clickable" onClick={() => { close(); setEscId(e.id); }}>
                  <td><strong>{e.subject}</strong><span className="ul-rhp-sub">{e.id} · {e.queryId}</span></td>
                  <td>{e.studentName}<span className="ul-rhp-sub">{PERSON_LABEL[e.personType || "student"]}</span></td>
                  <td><span className={`ul-status-badge ${ESC_STATUS_BADGE[e.status]}`}>{ESC_STATUS_LABEL[e.status]}</span></td>
                  <td style={{ maxWidth: 220, whiteSpace: "normal" }}>{e.adminResponse || <span className="ul-rhp-sub">Awaiting Admin</span>}</td>
                  <td>{timeAgo(e.updatedAt)}</td>
                  <td><button type="button" className="ul-btn ul-btn--ghost" onClick={(ev) => { ev.stopPropagation(); close(); setEscId(e.id); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div></div>
      )}

      {query && (
        <Modal title={query.subject} subtitle={`${query.id} · ${PERSON_LABEL[typeOf(query)]}: ${query.studentName} · ${QUERY_CATEGORY_LABEL[query.category]}`} onClose={close} wide hideClose={query.status !== "open"}
          footer={
            query.status === "open" && mode === "view" ? (
              <>
                <button type="button" className="ul-btn ul-btn--ghost" disabled={!isWithinAuthority(query.category)} onClick={() => setMode("resolve")}>Resolve</button>
                <button type="button" className="ul-btn ul-btn--primary" onClick={() => { setMode("escalate"); setPriority(query.priority); }}>Escalate to Admin</button>
              </>
            ) : query.status === "open" && mode === "resolve" ? (
              <>
                <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { setMode("view"); setErr(""); }}>Back</button>
                <button type="button" className="ul-btn ul-btn--primary" disabled={note.trim().length < 5} onClick={doResolve}>Mark resolved</button>
              </>
            ) : query.status === "open" && mode === "escalate" ? (
              <>
                <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { setMode("view"); setErr(""); }}>Back</button>
                <button type="button" className="ul-btn ul-btn--primary" disabled={reason.trim().length < 10} onClick={doEscalate}>Send to Admin</button>
              </>
            ) : <button type="button" className="ul-btn ul-btn--primary" onClick={close}>Close</button>
          }>
          <p>{query.description}</p>
          <p className="ul-rhp-sub">Priority: {PRIORITY_LABEL[query.priority]} · Status: <span className={`ul-status-badge ${QUERY_STATUS_BADGE[query.status]}`}>{QUERY_STATUS_LABEL[query.status]}</span></p>
          {query.status === "open" && !isWithinAuthority(query.category) && (
            <div className="ul-rhp-note">This kind of issue is outside a Regional Head's authority. Please escalate it to Admin.</div>
          )}
          {query.status === "resolved" && query.resolution && <div className="ul-rhp-note"><strong>Resolution:</strong> {query.resolution.note}</div>}
          {mode === "resolve" && (
            <div className="ul-rhp-field">
              <label htmlFor="res-note">Resolution note (visible in history)</label>
              <textarea id="res-note" className="ul-rhp-textarea" value={note} onChange={(e) => setNote(e.target.value)} placeholder="What did you do to fix this?" />
            </div>
          )}
          {mode === "escalate" && (
            <>
              <div className="ul-rhp-field" style={{ marginBottom: 10 }}>
                <label htmlFor="esc-pri">Priority</label>
                <select id="esc-pri" value={priority} onChange={(e) => setPriority(e.target.value)}>
                  {Object.values(PRIORITY).map((p) => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="esc-reason">Reason for escalation</label>
                <textarea id="esc-reason" className="ul-rhp-textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why does this need Admin? What have you already tried?" />
              </div>
            </>
          )}
          {mode === "view" && query.status === "open" && (
            <div className="ul-rhp-field" style={{ margin: "10px 0" }}>
              <label htmlFor="q-note">Add an internal note</label>
              <div className="ul-rhp-actions">
                <input id="q-note" style={{ flex: 1 }} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Note for the history" />
                <button type="button" className="ul-btn ul-btn--ghost" disabled={!note.trim()} onClick={doNote}>Add note</button>
              </div>
            </div>
          )}
          {err && <p className="ul-rhp-err">{err}</p>}
          <h4 style={{ margin: "14px 0 8px" }}>History</h4>
          <Timeline items={query.history} />
        </Modal>
      )}

      {esc && (
        <Modal title={esc.subject} subtitle={`${esc.id} · ${esc.studentName}`} onClose={close} wide hideClose
          footer={<button type="button" className="ul-btn ul-btn--primary" onClick={close}>Close</button>}>
          <p><span className={`ul-status-badge ${ESC_STATUS_BADGE[esc.status]}`}>{ESC_STATUS_LABEL[esc.status]}</span> · Priority {PRIORITY_LABEL[esc.priority]}</p>
          <div className="ul-rhp-note"><strong>Your reason:</strong> {esc.reason}</div>
          {esc.adminResponse && <div className="ul-rhp-note"><strong>Admin response:</strong> {esc.adminResponse}</div>}
          {esc.status === "returned" && <p className="ul-rhp-sub">This query is back in your Open list so you can follow up.</p>}
          <h4 style={{ margin: "14px 0 8px" }}>Complete history</h4>
          <Timeline items={esc.history} />
        </Modal>
      )}

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}
