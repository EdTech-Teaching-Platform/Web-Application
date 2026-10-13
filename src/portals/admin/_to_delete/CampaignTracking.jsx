// Campaign Tracking — per-campaign issued / redeemed / revenue figures with a
// drill-down of recipients and the purchases made with the coupon.
import { useEffect, useMemo, useState } from "react";
import { IconSearch } from "../../components/icons";
import { useDiscountState, effectiveStatus, STATUS_LABEL, assignmentStatus, audienceLabel, verifyRedemption, refreshExpiry, inr, KINDS, SCOPES } from "../../data/discountsMock";
import { PageHeader, useDiscountSearchParams, StatusBadge, Pager, pageSlice, Modal, Tabs, fmtDate, fmtDateTime, exportCsv } from "./DiscountsShared";

const SIZE = 8;

export function campaignMetrics(c, st) {
  const reds = st.redemptions.filter((r) => r.applied.some((a) => a.campaignId === c.id));
  const assigned = st.assignments.filter((a) => a.campaignId === c.id);
  const unique = st.coupons.filter((x) => x.campaignId === c.id);
  const issued = c.codeMode === "unique" ? Math.max(unique.length, assigned.length) : assigned.length;
  const discount = reds.reduce((a, r) => a + r.applied.filter((x) => x.campaignId === c.id).reduce((s, x) => s + x.discount, 0), 0);
  const revenue = reds.reduce((a, r) => a + r.final / r.applied.length, 0);
  const redeemed = reds.length;
  const rate = issued > 0 ? Math.round((redeemed / issued) * 100) : c.totalLimit ? Math.round((redeemed / c.totalLimit) * 100) : null;
  return { reds, assigned, issued, redeemed, discount, revenue, rate, remaining: c.totalLimit == null ? null : Math.max(0, c.totalLimit - redeemed) };
}

export default function CampaignTracking() {
  const st = useDiscountState();
  const [params, setParams] = useDiscountSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [sort, setSort] = useState("recent");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(params.get("campaign"));
  const [tab, setTab] = useState("redemptions");
  useEffect(() => { refreshExpiry(); }, []);
  useEffect(() => { setPage(1); }, [q, status, sort, from, to]);

  const rows = useMemo(() => {
    const s = q.trim().toLowerCase(); const f = from ? new Date(from).getTime() : null; const t = to ? new Date(to).getTime() + 86399999 : null;
    const list = st.campaigns.map((c) => ({ c, eff: effectiveStatus(c, st), m: campaignMetrics(c, st) })).filter(({ c, eff }) => {
      if (status !== "all" && eff !== status) return false;
      if (s && !`${c.name} ${c.code} ${c.prefix}`.toLowerCase().includes(s)) return false;
      const start = new Date(c.startAt).getTime(), end = new Date(c.endAt).getTime();
      if (f != null && end < f) return false; if (t != null && start > t) return false;
      return true;
    });
    const by = { recent: (a, b) => b.c.createdAt.localeCompare(a.c.createdAt), redeemed: (a, b) => b.m.redeemed - a.m.redeemed, revenue: (a, b) => b.m.revenue - a.m.revenue, discount: (a, b) => b.m.discount - a.m.discount, rate: (a, b) => (b.m.rate ?? -1) - (a.m.rate ?? -1) };
    return list.sort(by[sort]);
  }, [st, q, status, sort, from, to]);

  const open = openId ? st.campaigns.find((c) => c.id === openId) : null;
  const close = () => { setOpenId(null); if (params.get("campaign")) { const p = new URLSearchParams(params); p.delete("campaign"); setParams(p, { replace: true }); } };
  const m = open ? campaignMetrics(open, st) : null;

  const exportAll = () => exportCsv("campaign-tracking.csv", [
    ["Campaign", "Code", "Audience", "Starts", "Ends", "Issued", "Redeemed", "Remaining", "Redemption rate %", "Discount given", "Revenue", "Status"],
    ...rows.map(({ c, eff, m: x }) => [c.name, c.codeMode === "shared" ? c.code : `${c.prefix}-…`, audienceLabel(c), fmtDate(c.startAt), fmtDate(c.endAt), x.issued, x.redeemed, x.remaining ?? "Unlimited", x.rate ?? "", x.discount.toFixed(2), x.revenue.toFixed(2), STATUS_LABEL[eff]]),
  ]);

  return (
    <div>
      <PageHeader title="Campaign Tracking" subtitle="Follow each campaign from issue to redemption.">
        <button type="button" className="ul-btn ul-btn--ghost" onClick={exportAll} disabled={!rows.length}>Export CSV</button>
      </PageHeader>

      <div className="ul-edu-toolbar ul-dsc-filters">
        <label className="ul-edu-search"><IconSearch size={14} color="var(--color-text-muted)" /><input type="text" placeholder="Search campaign or code…" value={q} onChange={(e) => setQ(e.target.value)} /></label>
        <select className="ul-edu-select" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="all">Status: All</option>{Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="ul-edu-select" value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="recent">Sort: Newest</option><option value="redeemed">Most redeemed</option><option value="rate">Highest redemption rate</option><option value="revenue">Highest revenue</option><option value="discount">Most discount given</option>
        </select>
        <label className="ul-dsc-date"><span>Running from</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="ul-dsc-date"><span>to</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        {(q || status !== "all" || from || to) && <button type="button" className="ul-btn ul-btn--ghost ul-rh-btn" onClick={() => { setQ(""); setStatus("all"); setFrom(""); setTo(""); }}>Clear</button>}
      </div>

      <div className="ul-card ul-edu-table-card">
        {rows.length === 0 ? <div className="ul-edu-empty">No campaigns match these filters.</div> : (
          <div className="ul-edu-table-scroll ul-dsc-scroll">
            <table className="ul-edu-table ul-dsc-table" style={{ minWidth: 1180 }}>
              <thead><tr><th>Campaign</th><th>Audience</th><th>Applies to</th><th>Runs</th><th>Issued</th><th>Redeemed</th><th>Left</th><th>Rate</th><th>Discount</th><th>Revenue</th><th>Status</th></tr></thead>
              <tbody>
                {pageSlice(rows, page, SIZE).map(({ c, eff, m: x }) => (
                  <tr key={c.id} className="ul-edu-row--clickable" onClick={() => { setOpenId(c.id); setTab("redemptions"); }}>
                    <td><span className="ul-rh-strong">{c.name}</span><span className="ul-dsc-code">{c.codeMode === "shared" ? c.code : `${c.prefix}-…`}</span></td>
                    <td style={{ maxWidth: 190 }}>{audienceLabel(c)}</td>
                    <td style={{ maxWidth: 160 }}>{c.kind === "combo" ? "Combo" : SCOPES[c.scope]}</td>
                    <td>{fmtDate(c.startAt)}<span className="ul-dsc-sub">to {fmtDate(c.endAt)}</span></td>
                    <td>{c.codeMode === "shared" && x.issued === 0 ? "Public" : x.issued}</td>
                    <td>{x.redeemed}</td><td>{x.remaining ?? "∞"}</td><td>{x.rate == null ? "—" : `${x.rate}%`}</td>
                    <td>{inr(x.discount)}</td><td>{inr(x.revenue)}</td><td><StatusBadge status={eff} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} setPage={setPage} total={rows.length} size={SIZE} />
      </div>

      {open && (
        <Modal wide title={open.name} subtitle={`${open.id} · ${KINDS[open.kind]} · ${open.codeMode === "shared" ? open.code : open.prefix + "-…"}`} onClose={close}
          footer={<><button type="button" className="ul-btn ul-btn--ghost" onClick={() => exportCsv(`${open.name.replace(/\W+/g, "-")}-redemptions.csv`, [["Student", "Student ID", "Redeemed at", "Items", "Original price", "Discount applied", "Final amount", "Transaction"], ...m.reds.map((r) => [r.studentName, r.studentId, fmtDateTime(r.at), r.items.map((i) => i.name).join("; "), r.original, r.applied.filter((a) => a.campaignId === open.id).reduce((s, a) => s + a.discount, 0), r.final, r.txnRef])])} disabled={!m.reds.length}>Export redemptions</button></>}>
          <p className="ul-dsc-card__sub">{audienceLabel(open)} · {fmtDate(open.startAt)} → {fmtDate(open.endAt)} · <StatusBadge status={effectiveStatus(open, st)} /> · {m.redeemed} redeemed · {inr(m.discount)} discount · {inr(m.revenue)} revenue</p>
          <Tabs value={tab} onChange={setTab} tabs={[{ key: "redemptions", label: `Redeemed (${m.reds.length})` }, { key: "recipients", label: `Recipients (${m.assigned.length})` }]} />
          {tab === "redemptions" ? (
            m.reds.length === 0 ? <p className="ul-dsc-empty">Nobody has redeemed this coupon yet.</p> : (
              <div className="ul-edu-table-scroll"><table className="ul-edu-table ul-dsc-table" style={{ minWidth: 820 }}>
                <thead><tr><th>Student</th><th>Redeemed</th><th>Purchased</th><th>Original</th><th>Discount</th><th>Final paid</th><th>Check</th></tr></thead>
                <tbody>{m.reds.map((r) => (
                  <tr key={r.id}><td><span className="ul-rh-strong">{r.studentName}</span><span className="ul-dsc-sub">{r.studentId}</span></td><td>{fmtDateTime(r.at)}</td>
                    <td>{r.items.map((i) => i.name).join(", ")}<span className="ul-dsc-sub">{r.txnRef}</span></td><td>{inr(r.original)}</td>
                    <td>−{inr(r.applied.filter((a) => a.campaignId === open.id).reduce((s, a) => s + a.discount, 0))}</td><td className="ul-dsc-final">{inr(r.final)}</td>
                    <td>{verifyRedemption(r) ? "✓ matches" : "⚠ mismatch"}</td></tr>
                ))}</tbody></table></div>
            )
          ) : (
            m.assigned.length === 0 ? <p className="ul-dsc-empty">{open.audience.mode === "public" ? "This is a public coupon — it isn't assigned to individual students." : "No students have been assigned this coupon yet."}</p> : (
              <div className="ul-edu-table-scroll"><table className="ul-edu-table ul-dsc-table" style={{ minWidth: 640 }}>
                <thead><tr><th>Student</th><th>Code</th><th>Assigned</th><th>Delivered</th><th>Status</th></tr></thead>
                <tbody>{m.assigned.map((a) => { const s = assignmentStatus(a, st); return (
                  <tr key={a.id}><td>{a.studentName}<span className="ul-dsc-sub">{a.studentId}</span></td><td><span className="ul-dsc-code">{a.code}</span></td><td>{fmtDate(a.assignedAt)}</td><td>{a.deliveredAt ? fmtDateTime(a.deliveredAt) : "—"}</td>
                    <td><span className={`ul-status-badge ${{ redeemed: "is-approved", expired: "is-rejected", delivered: "is-verified", assigned: "is-pending" }[s]}`}>{s[0].toUpperCase() + s.slice(1)}</span></td></tr>
                ); })}</tbody></table></div>
            )
          )}
        </Modal>
      )}
    </div>
  );
}
