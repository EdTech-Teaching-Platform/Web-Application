// Regional Growth Analytics
// Jira: Day 14 — Regional growth analytics
// August 2026 addition "Regional growth analytics (India-focused)".
// A newer, backend-undetailed addition; this screen is UI-only
// illustrative reporting on top of ../data/regionalAnalyticsMock.js, in
// the same spirit as FinancialAnalytics.jsx / ReportsBuilder.jsx.
//
// India state-by-state revenue growth, a trend chart (All
// India or a single region), a revenue-by-region bar chart, and a
// full region comparison table.
//
// Reuses .ul-card/.ul-stats/.ul-stat-card/.ul-status-badge from
// AdminDashboard.css & EducatorVerification.css (also reused for its
// table/search/filter classes), and .ul-report-bars from
// ReportsBuilder.css — page-specific layout only lives in
// RegionalAnalytics.css (.ul-reg-*).

import { useEffect, useMemo, useRef, useState } from "react";
import {
  REGIONS,
  TIME_PERIOD_OPTIONS,
  getRegionTrend,
  getRegionTotals,
  getAverageGrowth,
} from "../data/regionalAnalyticsMock";
import { IconChart, IconGlobe, IconReport, IconSearch, IconClose } from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./ReportsBuilder.css";
import "./SettingsPermissions.css";
import "./UserManagement.css";
import "./RegionalAnalytics.css";


const REGION_PAGE_SIZE = 8;

const money = (value) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;
const pct = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;


function scoreClass(score) {
  if (score >= 85) return "is-high";
  if (score >= 65) return "is-mid";
  return "is-low";
}

// Smooth curve through a set of [x, y] coordinates using a horizontal-tangent
// cubic-bezier between each pair of points (see FinancialAnalytics.jsx for the
// same helper) — avoids overshoot/ringing on non-monotonic trend data.
function smoothRegPath(coords) {
  if (coords.length === 0) return "";
  if (coords.length === 1) return `M ${coords[0][0]},${coords[0][1]}`;
  let d = `M ${coords[0][0]},${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  return d;
}

// Picks an evenly-spaced subset of points to actually label under the
// x-axis (always including the first and last), so a dense daily series
// (up to 30 points for "Last 30 Days") doesn't render 30 overlapping
// labels — a sparser monthly series (3/6/9 points) just gets all of them
// labeled since there's room.
function pickAxisLabels(points, maxLabels = 6) {
  if (points.length <= maxLabels) return points;
  const step = (points.length - 1) / (maxLabels - 1);
  const seen = new Set();
  const indices = Array.from({ length: maxLabels }, (_, i) => Math.round(i * step)).filter((i) => {
    if (seen.has(i)) return false;
    seen.add(i);
    return true;
  });
  return indices.map((i) => points[i]);
}

function TrendChart({ points }) {
  const width = 640;
  const height = 190;
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const range = Math.max(1, max - min);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const [hover, setHover] = useState(null);
  const coords = points.map((p, i) => [i * step, height - 16 - ((p.value - min) / range) * (height - 32)]);
  const linePath = smoothRegPath(coords);
  const areaPath = `${linePath} L ${coords[coords.length - 1]?.[0] ?? width},${height} L 0,${height} Z`;
  const showDots = points.length <= 31;

  return (
    <div className="ul-reg-chart-wrap">
      <svg className="ul-reg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue growth trend">
        <defs>
          <linearGradient id="ulRegAreaFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="30" x2={width} y2="30" className="ul-reg-gridline" />
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="ul-reg-gridline" />
        <line x1="0" y1={height - 16} x2={width} y2={height - 16} className="ul-reg-gridline" />
        <path d={areaPath} fill="url(#ulRegAreaFill)" className="ul-reg-area" />
        <path d={linePath} className="ul-reg-line" />
        {showDots &&
          coords.map(([x, y], i) => (
            <circle
              key={points[i].label + i}
              cx={x}
              cy={y}
              r={hover === i ? 5.5 : 3.5}
              className="ul-reg-chart-dot"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover((h) => (h === i ? null : h))}
            />
          ))}
        {hover !== null && (
          <g className="ul-reg-chart-tooltip" style={{ transform: `translate(${coords[hover][0]}px, ${coords[hover][1] - 14}px)` }}>
            <foreignObject x="-52" y="-38" width="104" height="34">
              <div className="ul-reg-chart-tooltip__box">
                <strong>{points[hover].label}</strong>
                <span>{money(points[hover].value)}</span>
              </div>
            </foreignObject>
          </g>
        )}
      </svg>
      <div className="ul-reg-chart-labels">
        {pickAxisLabels(points).map((point, i) => <span key={point.label + i}>{point.label}</span>)}
      </div>
    </div>
  );
}

function RegionBarChart({ regions }) {
  const max = Math.max(1, ...regions.map((r) => r.revenue));
  return (
    <div className="ul-report-bars" aria-label="Revenue by region">
      {regions.map((r) => (
        <div className="ul-report-bar-group" key={r.id}>
          <div className="ul-report-bar-value">{money(r.revenue)}</div>
          <div className="ul-report-bar-track">
            <div className="ul-report-bar" style={{ height: `${Math.max(8, (r.revenue / max) * 100)}%` }} />
          </div>
          <span>{r.state}</span>
        </div>
      ))}
    </div>
  );
}

export default function RegionalAnalytics() {
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  return (
    <div className="ul-reg-page">
      <div className="ul-dash-welcome ul-reg-welcome">
        <div>
          <h2 className="ul-dash-welcome__title">Regional Growth</h2>
          <p className="ul-dash-welcome__subtitle">
            State-by-state revenue growth across India.
          </p>
        </div>
      </div>

      <RegionalGrowthTab onToast={setToast} />

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}

/* ============================== Tab 1 ============================== */

function RegionalGrowthTab() {
  const [selectedRegion, setSelectedRegion] = useState("all");
  const [timePeriod, setTimePeriod] = useState("30d");
  const [customStart, setCustomStart] = useState("2026-09-01");
  const [customEnd, setCustomEnd] = useState("2026-09-25");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const totals = useMemo(() => getRegionTotals(), []);
  const avgGrowth = useMemo(() => getAverageGrowth(), []);
  const trend = useMemo(() => getRegionTrend(selectedRegion, timePeriod, customStart, customEnd), [selectedRegion, timePeriod, customStart, customEnd]);
  const sortedByRevenue = useMemo(() => [...REGIONS].sort((a, b) => b.revenue - a.revenue), []);
  const topRevenueRegion = sortedByRevenue[0];
  const periodRevenueMultiplier = useMemo(() => {
    if (timePeriod === "10d") return 10 / 30;
    if (timePeriod === "20d") return 20 / 30;
    if (timePeriod === "3m") return 3;
    if (timePeriod === "6m") return 6;
    if (timePeriod === "year") return 9;
    if (timePeriod === "custom") {
      const start = new Date(`${customStart}T00:00:00`);
      const end = new Date(`${customEnd}T00:00:00`);
      return start <= end ? (Math.round((end - start) / 86400000) + 1) / 30 : 1;
    }
    return 1;
  }, [timePeriod, customStart, customEnd]);
  const periodRevenue = totals.revenue * periodRevenueMultiplier;

  useEffect(() => setPage(1), [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedByRevenue;
    return sortedByRevenue.filter((r) => `${r.state} ${r.city}`.toLowerCase().includes(q));
  }, [sortedByRevenue, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / REGION_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * REGION_PAGE_SIZE, currentPage * REGION_PAGE_SIZE);

  return (
    <div>
      <div className="ul-stats ul-reg-stats">
        <div className="ul-stat-card"><span className="ul-stat-card__label">REGIONS TRACKED</span><span className="ul-stat-card__value">{REGIONS.length}</span><span className="ul-stat-card__trend">{totals.institutions} institutions</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">TOTAL REGIONAL REVENUE</span><span className="ul-stat-card__value">{money(periodRevenue)}</span><span className="ul-stat-card__trend is-up">Selected time period</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">TOP REVENUE REGION</span><span className="ul-stat-card__value ul-reg-stat-value-text">{topRevenueRegion.state}</span><span className="ul-stat-card__trend">{money(topRevenueRegion.revenue)} baseline</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">AVG. REVENUE GROWTH</span><span className="ul-stat-card__value">{pct(avgGrowth)}</span><span className="ul-stat-card__trend is-up">Revenue-weighted</span></div>
      </div>

      <div className="ul-reg-grid">
        <section className="ul-card">
          <div className="ul-reg-chart-head">
            <div className="ul-card__head" style={{ marginBottom: 0 }}>
              <span className="ul-card__eyebrow"><IconChart size={13} /> Performance over time</span>
              <h3>Revenue Growth Trend</h3>
            </div>
            <div className="ul-reg-chart-filters">
              <select className="ul-reg-region-select" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
                <option value="all">All India</option>
                {REGIONS.map((r) => <option key={r.id} value={r.id}>{r.state}</option>)}
              </select>
              <select className="ul-reg-region-select" value={timePeriod} onChange={(e) => setTimePeriod(e.target.value)} aria-label="Time period">
                {TIME_PERIOD_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
          </div>
          {timePeriod === "custom" && <div className="ul-reg-custom-range"><label>From<input type="date" value={customStart} onChange={(e) => setCustomStart(e.target.value)} /></label><label>To<input type="date" value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} /></label></div>}
          <TrendChart points={trend} />
        </section>

        <section className="ul-card">
          <div className="ul-card__head">
            <span className="ul-card__eyebrow"><IconGlobe size={13} /> By region</span>
            <h3>Revenue by Region</h3>
          </div>
          <RegionBarChart regions={sortedByRevenue} />
        </section>
      </div>

      <section className="ul-card ul-set-table-card" style={{ marginTop: 18 }}>
        <div className="ul-card__head" style={{ padding: "16px 16px 0" }}>
          <span className="ul-card__eyebrow"><IconReport size={13} /> State-by-state comparison</span>
          <h3>Region Comparison</h3>
        </div>
        <div style={{ padding: "0 16px" }}>
          <div className="ul-reg-toolbar">
            <label className="ul-set-search">
              <IconSearch size={14} color="var(--color-text-muted)" />
              <input
                type="text"
                placeholder="Search by state or city…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              {search && (
                <button type="button" className="ul-usr-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
                  <IconClose size={12} />
                </button>
              )}
            </label>
          </div>
        </div>

        {pageItems.length === 0 ? (
          <div className="ul-set-empty">No regions match this search.</div>
        ) : (
          <div className="ul-set-table-scroll ul-reg-table-scroll">
            <table className="ul-set-table">
              <colgroup>
                <col style={{ width: "24%" }} />
                <col style={{ width: "20%" }} />
                <col style={{ width: "22%" }} />
                <col style={{ width: "17%" }} />
                <col style={{ width: "17%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Region</th>
                  <th className="ul-reg-growth-col">Institutions</th>
                  <th className="ul-reg-growth-col">Revenue</th>
                  <th className="ul-reg-growth-col">MoM</th>
                  <th className="ul-reg-growth-col">YoY</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <span className="ul-reg-region-name">{r.state}</span>
                      <span className="ul-reg-region-sub">{r.city}</span>
                    </td>
                    <td className="ul-reg-growth-col">{r.institutions}</td>
                    <td className="ul-reg-growth-col">{money(r.revenue)}</td>
                    <td className="ul-reg-growth-col"><span className={`ul-reg-growth ${r.momGrowthPct >= 0 ? "is-up" : "is-down"}`}>{pct(r.momGrowthPct)}</span></td>
                    <td className="ul-reg-growth-col"><span className={`ul-reg-growth ${r.yoyGrowthPct >= 0 ? "is-up" : "is-down"}`}>{pct(r.yoyGrowthPct)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="ul-usr-pagination">
            <span className="ul-usr-pagination__info">
              Showing {(currentPage - 1) * REGION_PAGE_SIZE + 1}–{Math.min(currentPage * REGION_PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ul-usr-pagination__controls">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Prev</button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
