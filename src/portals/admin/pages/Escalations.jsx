// Escalations from Regional Heads: Admin sees the reason, replies, and the
// Regional Head is notified. Full history is kept per escalation.
import { useMemo, useState } from "react";
import { Modal, Tabs } from "./discounts/DiscountsShared";
import {
  useEscalations, adminRespond, ESC_STATUS_LABEL, ESC_STATUS_BADGE, PRIORITY_LABEL,
  QUERY_CATEGORY_LABEL, PERSON_LABEL, fmtDateTime, timeAgo,
} from "../data/regionalPortalMock";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./SettingsPermissions.css";
import "../../regionalhead/regionalhead.css";

const TABS = [
  { key: "active", label: "Needs action" },
  { key: "closed", label: "Closed" },
  { key: "all", label: "All" },
];

export default function Escalations() {
  const list = useEscalations();
  const [tab, setTab] = useState("active");
  const [region, setRegion] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [response, setResponse] = useState("");
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");

  const regions = useMemo(() => [...new Set(list.map((e) => e.region))], [list]);
  const isActive = (e) => e.status === "pending" || e.status === "in_review";
  const rows = list.filter((e) => (region === "all" || e.region === region) && (tab === "all" || (tab === "active" ? isActive(e) : !isActive(e))));
  const open = list.find((e) => e.id === openId) || null;

  const flash = (m) => { setToast(m); setTimeout(() => setToast(""), 2600); };
  const close = () => { setOpenId(null); setResponse(""); setErr(""); };
  const act = (action) => {
    const res = adminRespond({ escalationId: open.id, action, response });
    if (!res.ok) { setErr(res.error); return; }
    flash(action === "review" ? "Marked in review. The Regional Head was notified." : "Response sent. The Regional Head was notified.");
    if (action === "review") { setErr(""); } else close();
  };

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Regional Head Escalations</h2>
          <p className="ul-edu-header__subtitle">Issues Regional Heads could not resolve themselves. Reply to notify them.</p>
        </div>
      </div>

      <div className="ul-rhp-stats">
        <div className="ul-rhp-stat"><span>Pending</span><strong>{list.filter((e) => e.status === "pending").length}</strong><small>Not yet opened</small></div>
        <div className="ul-rhp-stat"><span>In review</span><strong>{list.filter((e) => e.status === "in_review").length}</strong><small>Being handled</small></div>
        <div className="ul-rhp-stat"><span>Resolved</span><strong>{list.filter((e) => e.status === "resolved").length}</strong><small>Closed by Admin</small></div>
        <div className="ul-rhp-stat"><span>Returned</span><strong>{list.filter((e) => e.status === "returned").length}</strong><small>Sent back to heads</small></div>
      </div>

      <Tabs value={tab} onChange={setTab} tabs={TABS} />
      <div style={{ height: 12 }} />
      <div className="ul-rhp-toolbar">
        <select value={region} onChange={(e) => setRegion(e.target.value)}>
          <option value="all">All regions</option>
          {regions.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="ul-card ul-edu-table-card"><div className="ul-rhp-table-wrap">
        <table className="ul-edu-table">
          <thead><tr><th>Escalation</th><th>Region · Head</th><th>Raised by</th><th>Priority</th><th>Status</th><th>Updated</th><th aria-label="Open" /></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 24 }}>No escalations here.</td></tr>}
            {rows.map((e) => (
              <tr key={e.id} className="ul-edu-row--clickable" onClick={() => setOpenId(e.id)}>
                <td><strong>{e.subject}</strong><span className="ul-rhp-sub">{e.id} · {QUERY_CATEGORY_LABEL[e.category]}</span></td>
                <td>{e.region}<span className="ul-rhp-sub">{e.headName}</span></td>
                <td>{e.studentName}<span className="ul-rhp-sub">{PERSON_LABEL[e.personType || "student"]}</span></td>
                <td>{PRIORITY_LABEL[e.priority]}</td>
                <td><span className={`ul-status-badge ${ESC_STATUS_BADGE[e.status]}`}>{ESC_STATUS_LABEL[e.status]}</span></td>
                <td>{timeAgo(e.updatedAt)}</td>
                <td><button type="button" className="ul-btn ul-btn--ghost" onClick={(ev) => { ev.stopPropagation(); setOpenId(e.id); }}>Open</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>

      {open && (
        <Modal title={open.subject} subtitle={`${open.id} · ${open.region} · ${open.headName}`} onClose={close} wide hideClose={!isActive(open)}
          footer={isActive(open) ? (
            <>
              {open.status === "pending" && <button type="button" className="ul-btn ul-btn--ghost" onClick={() => act("review")}>Mark in review</button>}
              <button type="button" className="ul-btn ul-btn--ghost" disabled={response.trim().length < 5} onClick={() => act("return")}>Return to Regional Head</button>
              <button type="button" className="ul-btn ul-btn--primary" disabled={response.trim().length < 5} onClick={() => act("resolve")}>Resolve</button>
            </>
          ) : <button type="button" className="ul-btn ul-btn--primary" onClick={close}>Close</button>}>
          <p><span className={`ul-status-badge ${ESC_STATUS_BADGE[open.status]}`}>{ESC_STATUS_LABEL[open.status]}</span> · {PERSON_LABEL[open.personType || "student"]}: {open.studentName} · Priority {PRIORITY_LABEL[open.priority]}</p>
          <div className="ul-rhp-note"><strong>Reason from Regional Head:</strong> {open.reason}</div>
          {open.adminResponse && <div className="ul-rhp-note"><strong>Admin response:</strong> {open.adminResponse}</div>}
          {isActive(open) && (
            <div className="ul-rhp-field">
              <label htmlFor="adm-resp">Your response (the Regional Head is notified)</label>
              <textarea id="adm-resp" className="ul-rhp-textarea" value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Explain the decision or what the Regional Head should do next." />
            </div>
          )}
          {err && <p className="ul-rhp-err">{err}</p>}
          <h4 style={{ margin: "14px 0 8px" }}>Complete history</h4>
          <ul className="ul-rhp-timeline">
            {open.history.map((h, i) => (
              <li key={i}><strong>{h.action}</strong> · {h.by} ({h.role}){h.note && <div>{h.note}</div>}<small>{fmtDateTime(h.at)}</small></li>
            ))}
          </ul>
        </Modal>
      )}
      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}
