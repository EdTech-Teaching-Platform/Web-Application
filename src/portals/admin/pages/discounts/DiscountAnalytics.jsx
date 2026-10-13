// Analytics & Reports — everything is aggregated from redemption records.
// Discounted vs. non-discounted comparison and student conversion are limited
// by the data the platform has (see the notes on those cards).
import { useMemo, useState } from "react";
import { useDiscountState, effectiveStatus, getCatalog, inr, HIDE_COURSES } from "../../data/discountsMock";
import { campaignMetrics, PageHeader, StatCards, LineChart, BarList, exportCsv, fmtDate } from "./DiscountsShared";

const dayKey = (d) => new Date(d).toISOString().slice(0, 10);

export default function DiscountAnalytics() {
  const st = useDiscountState();
  const catalog = getCatalog();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [campaign, setCampaign] = useState("all");
  const [product, setProduct] = useState("all");
  const [dtype, setDtype] = useState("all");

  // each row = one coupon applied in one purchase (so filters by campaign / type work)
  const lines = useMemo(() => {
    const f = from ? new Date(from).getTime() : null; const t = to ? new Date(to).getTime() + 86399999 : null;
    const out = [];
    st.redemptions.forEach((r) => {
      const ts = new Date(r.at).getTime();
      if ((f != null && ts < f) || (t != null && ts > t)) return;
      if (product !== "all" && !r.items.some((i) => i.type + i.id === product)) return;
      r.applied.forEach((a) => {
        const c = st.campaigns.find((x) => x.id === a.campaignId);
        if (campaign !== "all" && a.campaignId !== campaign) return;
        if (dtype !== "all" && a.terms.type !== dtype) return;
        out.push({ r, a, c, share: r.final / r.applied.length });
      });
    });
    return out;
  }, [st, from, to, campaign, product, dtype]);

  const totals = useMemo(() => {
    const discount = lines.reduce((s, l) => s + l.a.discount, 0);
    const revenue = lines.reduce((s, l) => s + l.share, 0);
    const issued = st.assignments.length;
    const redeemedAssigned = st.assignments.filter((a) => a.redeemedAt).length;
    return { discount, revenue, count: lines.length, issued, redeemedAssigned };
  }, [lines, st]);

  const byCampaign = useMemo(() => {
    const map = {};
    lines.forEach((l) => { const b = (map[l.a.campaignId] ||= { id: l.a.campaignId, name: l.a.campaignName, code: l.a.code, uses: 0, discount: 0, revenue: 0 }); b.uses += 1; b.discount += l.a.discount; b.revenue += l.share; });
    return Object.values(map);
  }, [lines]);
  const byCode = useMemo(() => {
    const map = {};
    lines.forEach((l) => { const k = l.c?.codeMode === "shared" ? l.a.code : `${l.c?.prefix}-… (unique)`; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value);
  }, [lines]);
  const redeemedCodes = new Set(byCode.map((x) => x.label));
  const unredeemed = st.campaigns.filter((c) => c.codeMode === "shared" && !redeemedCodes.has(c.code) && c.state !== "draft").map((c) => c.code);

  const byProduct = useMemo(() => {
    const map = {};
    lines.forEach((l) => l.a.perItem.forEach((p) => { const k = p.type + p.id; const b = (map[k] ||= { type: p.type, name: p.name, uses: 0, discount: 0, list: 0 }); b.uses += 1; b.discount += p.discount; b.list += p.original; }));
    return Object.values(map);
  }, [lines]);

  const trend = useMemo(() => {
    const keys = Array.from({ length: 30 }, (_, i) => dayKey(Date.now() - (29 - i) * 86400000));
    return {
      revenue: keys.map((k) => ({ x: k.slice(5), y: Math.round(lines.filter((l) => dayKey(l.r.at) === k).reduce((s, l) => s + l.share, 0)) })),
      discount: keys.map((k) => ({ x: k.slice(5), y: Math.round(lines.filter((l) => dayKey(l.r.at) === k).reduce((s, l) => s + l.a.discount, 0)) })),
    };
  }, [lines]);

  const avgList = lines.length ? lines.reduce((s, l) => s + l.r.original, 0) / lines.length : 0;
  const avgPaid = lines.length ? lines.reduce((s, l) => s + l.r.final, 0) / lines.length : 0;
  const courseRows = byProduct.filter((p) => p.type === "course").sort((a, b) => b.uses - a.uses);
  const seriesRows = byProduct.filter((p) => p.type === "test_series").sort((a, b) => b.uses - a.uses);
  const rate = st.assignments.length ? Math.round((totals.redeemedAssigned / st.assignments.length) * 100) : null;

  const exportReport = () => exportCsv("discount-performance.csv", [
    ["Discount", "Code", "Redemptions", "Discount given", "Revenue"], ...byCampaign.map((c) => [c.name, c.code, c.uses, c.discount.toFixed(2), c.revenue.toFixed(2)]),
    [], ["Redemptions in range"], ["Date", "Student", "Items", "Coupon", "Original", "Discount", "Final"],
    ...lines.map((l) => [fmtDate(l.r.at), l.r.studentName, l.r.items.map((i) => i.name).join("; "), l.a.code, l.r.original, l.a.discount, l.r.final]),
  ]);

  const table = (rows) => rows.length === 0 ? <p className="ul-dsc-empty">No discounted purchases in this range.</p> : (
    <div className="ul-edu-table-scroll"><table className="ul-edu-table ul-dsc-table" style={{ minWidth: 420 }}>
      <thead><tr><th>Item</th><th>Redemptions</th><th>Discount</th><th>Avg. discount</th></tr></thead>
      <tbody>{rows.map((p) => <tr key={p.name}><td>{p.name}</td><td>{p.uses}</td><td>{inr(p.discount)}</td><td>{p.list ? Math.round((p.discount / p.list) * 100) : 0}%</td></tr>)}</tbody>
    </table></div>
  );

  return (
    <div>
      <PageHeader title="Analytics & Reports" subtitle="What discounts cost, and what they earn.">
        <button type="button" className="ul-btn ul-btn--ghost" onClick={exportReport} disabled={!lines.length}>Export CSV</button>
      </PageHeader>

      <div className="ul-edu-toolbar ul-dsc-filters">
        <label className="ul-dsc-date"><span>From</span><input type="date" value={from} max={to || undefined} onChange={(e) => setFrom(e.target.value)} /></label>
        <label className="ul-dsc-date"><span>To</span><input type="date" value={to} min={from || undefined} onChange={(e) => setTo(e.target.value)} /></label>
        <select className="ul-edu-select" value={campaign} onChange={(e) => setCampaign(e.target.value)}><option value="all">Discount: All</option>{st.campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select className="ul-edu-select" value={product} onChange={(e) => setProduct(e.target.value)}><option value="all">Product: All</option>{catalog.map((p) => <option key={p.type + p.id} value={p.type + p.id}>{p.name}</option>)}</select>
        <select className="ul-edu-select" value={dtype} onChange={(e) => setDtype(e.target.value)}><option value="all">Type: All</option><option value="percent">Percentage</option><option value="fixed">Fixed amount</option></select>
        {(from || to || campaign !== "all" || product !== "all" || dtype !== "all") && <button type="button" className="ul-btn ul-btn--ghost ul-rh-btn" onClick={() => { setFrom(""); setTo(""); setCampaign("all"); setProduct("all"); setDtype("all"); }}>Clear</button>}
      </div>

      <StatCards items={[
        { label: "Revenue from discounted purchases", value: inr(totals.revenue), note: "After discounts" },
        { label: "Discount granted", value: inr(totals.discount), note: `${totals.count} coupon use(s)` },
        { label: "Assigned-coupon redemption rate", value: rate == null ? "—" : `${rate}%`, note: `${totals.redeemedAssigned} of ${totals.issued} assigned` },
        { label: "Avg. order (list → paid)", value: lines.length ? `${inr(Math.round(avgList))} → ${inr(Math.round(avgPaid))}` : "—", note: "Discounted orders" },
      ]} />

      <div className="ul-dsc-grid2">
        <div className="ul-card ul-dsc-card"><h3>Revenue trend</h3><p className="ul-dsc-card__sub">Paid amount from discounted purchases per day, last 30 days</p>{totals.count === 0 ? <p className="ul-dsc-empty">No data in this range.</p> : <LineChart points={trend.revenue} format={inr} label="Revenue" />}</div>
        <div className="ul-card ul-dsc-card"><h3>Discount trend</h3><p className="ul-dsc-card__sub">Discount amount granted per day, last 30 days</p>{totals.count === 0 ? <p className="ul-dsc-empty">No data in this range.</p> : <LineChart points={trend.discount} format={inr} label="Discount" />}</div>
        <div className="ul-card ul-dsc-card"><h3>Discount performance</h3><p className="ul-dsc-card__sub">Revenue by discount</p><BarList rows={[...byCampaign].sort((a, b) => b.revenue - a.revenue).map((c) => ({ label: c.name, value: Math.round(c.revenue), sub: `${c.uses} use(s) · ${inr(c.discount)} discount` }))} format={inr} empty="No discount has redemptions in this range." /></div>
        <div className="ul-card ul-dsc-card"><h3>Most &amp; least redeemed coupons</h3><p className="ul-dsc-card__sub">Most redeemed first</p><BarList rows={byCode.slice(0, 6)} empty="No redemptions in this range." />
          {unredeemed.length > 0 && <p className="ul-dsc-note"><strong>Never redeemed:</strong> {unredeemed.join(", ")}</p>}</div>
        {!HIDE_COURSES && <div className="ul-card ul-dsc-card"><h3>Course-wise performance</h3><p className="ul-dsc-card__sub">Discounted course purchases</p>{table(courseRows)}</div>}
        <div className="ul-card ul-dsc-card"><h3>Test-series-wise performance</h3><p className="ul-dsc-card__sub">Discounted test series purchases</p>{table(seriesRows)}</div>
      </div>
    </div>
  );
}
