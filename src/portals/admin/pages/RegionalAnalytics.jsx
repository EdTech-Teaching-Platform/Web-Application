import { useEffect, useMemo, useState } from "react";
import { IconChart, IconGlobe, IconReport, IconSearch } from "../components/icons";
import { regionalApi } from "../services/regionalApi";
import { useRpc } from "../hooks/useRpc";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./ReportsBuilder.css";
import "./RegionalAnalytics.css";

const ranges = [
  ["last_7_days", "Last 7 days"], ["last_30_days", "Last 30 days"], ["last_90_days", "Last 90 days"],
  ["this_month", "This month"], ["last_month", "Last month"], ["this_year", "This year"], ["all_time", "All time"],
];
const money = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const pct = (n) => `${Number(n || 0) >= 0 ? "+" : ""}${Number(n || 0).toFixed(1)}%`;

export default function RegionalAnalytics() {
  const [filters, setFilters] = useState({ range: "last_30_days", state: "", search: "", page: 1, size: 8 });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => { const t = setTimeout(() => setDebouncedSearch(filters.search), 300); return () => clearTimeout(t); }, [filters.search]);
  const request = useMemo(() => ({ ...filters, search: debouncedSearch }), [filters, debouncedSearch]);
  const summary = useRpc(() => regionalApi.summary(request), { immediate: true });
  const trend = useRpc(() => regionalApi.trend(request), { immediate: true });
  const bars = useRpc(() => regionalApi.byRegion(request), { immediate: true });
  const table = useRpc(() => regionalApi.comparison(request), { immediate: true });
  const set = (key, value) => setFilters((f) => ({ ...f, [key]: value, ...(key === "search" ? { page: 1 } : {}) }));
  const retry = () => [summary, trend, bars, table].forEach((x) => x.refetch().catch(() => {}));
  const s = summary.data || {};
  const rows = table.data?.rows || [];
  const points = Array.isArray(trend.data) ? trend.data : [];
  const regions = Array.isArray(bars.data) ? bars.data : [];
  return <div className="ul-reg-page">
    <div className="ul-dash-welcome ul-reg-welcome"><div><h2 className="ul-dash-welcome__title">Regional Growth</h2><p className="ul-dash-welcome__subtitle">State-by-state revenue growth across India.</p></div></div>
    <div className="ul-reg-toolbar"><label>Date range<select value={filters.range} onChange={(e) => set("range", e.target.value)}>{ranges.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select></label><label>State<select value={filters.state} onChange={(e) => set("state", e.target.value)}><option value="">All India</option>{regions.map((r) => <option key={r.state_code} value={r.state_code}>{r.region}</option>)}</select></label></div>
    {(summary.error || trend.error || bars.error || table.error) && <div className="ul-set-error">Unable to load regional analytics. <button type="button" onClick={retry}>Retry</button></div>}
    <div className="ul-stats ul-reg-stats">
      <div className="ul-stat-card"><span className="ul-stat-card__label">REGIONS TRACKED</span><span className="ul-stat-card__value">{s.regions_tracked ?? "—"}</span><span className="ul-stat-card__trend">{s.institutions ?? 0} institutions</span></div>
      <div className="ul-stat-card"><span className="ul-stat-card__label">TOTAL REGIONAL REVENUE</span><span className="ul-stat-card__value">{money(s.total_revenue_inr)}</span><span className="ul-stat-card__trend">Selected time period</span></div>
      <div className="ul-stat-card"><span className="ul-stat-card__label">TOP REVENUE REGION</span><span className="ul-stat-card__value">{s.top_region?.name || "—"}</span><span className="ul-stat-card__trend">{money(s.top_region?.revenue_inr)}</span></div>
      <div className="ul-stat-card"><span className="ul-stat-card__label">AVG. REVENUE GROWTH</span><span className="ul-stat-card__value">{s.avg_growth_pct == null ? "—" : pct(s.avg_growth_pct)}</span><span className="ul-stat-card__trend">Revenue-weighted</span></div>
    </div>
    <div className="ul-reg-grid"><section className="ul-card"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconChart size={13} /> Performance over time</span><h3>Revenue Growth Trend</h3></div><div className="ul-reg-chart-wrap"><div className="ul-reg-chart-labels">{points.map((p) => <span key={p.bucket}>{p.bucket}</span>)}</div><div className="ul-set-table-scroll"><table className="ul-set-table"><tbody><tr>{points.map((p) => <td key={p.bucket}>{money(p.revenue_inr)}</td>)}</tr></tbody></table></div></div></section>
      <section className="ul-card"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconGlobe size={13} /> By region</span><h3>Revenue by Region</h3></div><div className="ul-report-bars">{regions.map((r) => <div className="ul-report-bar-group" key={r.state_code}><div className="ul-report-bar-value">{money(r.revenue_inr)}</div><div className="ul-report-bar-track"><div className="ul-report-bar" style={{ height: `${Math.max(8, Number(r.pct_of_max) || 0)}%` }} /></div><span>{r.region}</span></div>)}</div></section></div>
    <section className="ul-card ul-set-table-card" style={{ marginTop: 18 }}><div className="ul-card__head"><span className="ul-card__eyebrow"><IconReport size={13} /> State-by-state comparison</span><h3>Region Comparison</h3></div><label className="ul-set-search" style={{ margin: 16 }}><IconSearch size={14} /><input placeholder="Search by state or city…" value={filters.search} onChange={(e) => set("search", e.target.value)} /></label>{table.loading ? <div className="ul-set-empty">Loading…</div> : rows.length === 0 ? <div className="ul-set-empty">No regions match this search.</div> : <div className="ul-set-table-scroll"><table className="ul-set-table"><thead><tr><th>Region</th><th>Institutions</th><th>Revenue</th><th>MoM</th><th>YoY</th></tr></thead><tbody>{rows.map((r) => <tr key={r.state_code}><td><strong>{r.region}</strong><small>{r.city}</small></td><td>{r.institutions}</td><td>{money(r.revenue_inr)}</td><td>{pct(r.mom_pct)}</td><td>{pct(r.yoy_pct)}</td></tr>)}</tbody></table></div>}<div className="ul-usr-pagination"><span>Showing {rows.length} of {table.data?.total || 0}</span><button type="button" disabled={filters.page <= 1} onClick={() => set("page", filters.page - 1)}>Previous</button><button type="button" disabled={(filters.page * 8) >= (table.data?.total || 0)} onClick={() => set("page", filters.page + 1)}>Next</button></div></section>
  </div>;
}
