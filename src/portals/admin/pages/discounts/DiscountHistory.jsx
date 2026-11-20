// Discount History — read-only audit trail of every discount action.
import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "../../components/icons";
import { useDiscountState, refreshExpiry } from "../../data/discountsMock";
import { PageHeader, Pager, pageSlice, fmtDateTime, exportCsv } from "./DiscountsShared";

const SIZE = 12;

export default function DiscountHistory() {
  const st = useDiscountState();
  const [q, setQ] = useState(""); const [action, setAction] = useState("all"); const [campaign, setCampaign] = useState("all");
  const [from, setFrom] = useState(""); const [to, setTo] = useState(""); const [page, setPage] = useState(1);
  useEffect(() => { refreshExpiry(); }, []);
  useEffect(() => { setPage(1); }, [q, action, campaign, from, to]);

  const actions = useMemo(() => [...new Set(st.audit.map((a) => a.action))].sort(), [st.audit]);
  const rows = useMemo(() => {
    const s = q.trim().toLowerCase(); const f = from ? new Date(from).getTime() : null; const t = to ? new Date(to).getTime() + 86399999 : null;
    return st.audit.filter((a) => {
      if (action !== "all" && a.action !== action) return false;
      if (campaign !== "all" && a.campaignId !== campaign) return false;
      const ts = new Date(a.at).getTime(); if ((f != null && ts < f) || (t != null && ts > t)) return false;
      if (s && !`${a.action} ${a.actor} ${a.campaignName} ${a.campaignId} ${a.detail}`.toLowerCase().includes(s)) return false;
      return true;
    });
  }, [st.audit, q, action, campaign, from, to]);
  const names = useMemo(() => { const m = new Map(); st.audit.forEach((a) => a.campaignId && m.set(a.campaignId, a.campaignName)); return [...m]; }, [st.audit]);

  return (
    <div>
      <PageHeader title="Discount History" subtitle="Every create, edit, assignment, redemption and expiry — newest first. This log is read-only.">
        <button type="button" className="ul-btn ul-btn--ghost" disabled={!rows.length} onClick={() => exportCsv("discount-history.csv", [["When", "Action", "Discount", "Done by", "Details"], ...rows.map((a) => [fmtDateTime(a.at), a.action, a.campaignName, a.actor, a.detail])])}>Export CSV</button>
      </PageHeader>
      <div className="ul-edu-toolbar ul-dsc-filters">
        <label className="ul-edu-search"><IconSearch size={14} color="var(--color-text-muted)" /><input type="text" placeholder="Search actions, people or details…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="ul-edu-select" value={action} onChange={(e) => setAction(e.target.value)}><option value="all">Action: All</option>{actions.map((a) => <option key={a} value={a}>{a}</option>)}</select>
        <select className="ul-edu-select" value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="all">Discount: All</option>{names.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
        <label className="ul-dsc-date"><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="ul-dsc-date"><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
      </div>
      <div className="ul-card ul-edu-table-card">
        {rows.length === 0 ? <div className="ul-edu-empty">No activity matches these filters.</div> : (
          <div className="ul-edu-table-scroll ul-dsc-scroll">
            <table className="ul-edu-table ul-dsc-table" style={{ minWidth: 860 }}>
              <thead><tr><th>When</th><th>Action</th><th>Discount</th><th>Done by</th><th>Details</th></tr></thead>
              <tbody>{pageSlice(rows, page, SIZE).map((a) => (
                <tr key={a.id}><td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(a.at)}</td><td><span className="ul-rh-strong">{a.action}</span></td>
                  <td>{a.campaignName || "—"}{a.campaignId && <span className="ul-dsc-sub">{a.campaignId}</span>}</td><td>{a.actor}<span className="ul-dsc-sub">{a.role}</span></td><td style={{ maxWidth: 360 }}>{a.detail || "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
        <Pager page={page} setPage={setPage} total={rows.length} size={SIZE} />
      </div>
    </div>
  );
}
