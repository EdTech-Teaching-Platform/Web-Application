// Regional Growth Analytics
// Jira: Day 14 — Regional growth analytics
// August 2026 addition "Regional growth analytics (India-focused)".
// A newer, backend-undetailed addition; this screen is UI-only
// illustrative reporting on top of ../data/regionalAnalyticsMock.js, in
// the same spirit as FinancialAnalytics.jsx / ReportsBuilder.jsx.
//
// India state-by-state enrollment/revenue growth, a trend chart (All
// India or a single region), a students-by-region bar chart, and a
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
const number = (value) => Math.round(value || 0).toLocaleString("en-IN");
const pct = (value) => `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;


function scoreClass(score) {
  if (score >= 85) return "is-high";
  if (score >= 65) return "is-mid";
  return "is-low";
}

function TrendChart({ points }) {
  const width = 640;
  const height = 190;
  const max = Math.max(1, ...points.map((p) => p.value));
  const min = Math.min(...points.map((p) => p.value));
  const range = Math.max(1, max - min);
  const step = points.length > 1 ? width / (points.length - 1) : width;
  const coords = points.map((p, i) => [i * step, height - 16 - ((p.value - min) / range) * (height - 32)]);
  const linePoints = coords.map(([x, y]) => `${x},${y}`).join(" ");
  const areaPoints = `0,${height} ${linePoints} ${width},${height}`;

  return (
    <div className="ul-reg-chart-wrap">
      <svg className="ul-reg-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Enrollment growth trend">
        <line x1="0" y1="30" x2={width} y2="30" className="ul-reg-gridline" />
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} className="ul-reg-gridline" />
        <line x1="0" y1={height - 16} x2={width} y2={height - 16} className="ul-reg-gridline" />
        <polygon points={areaPoints} className="ul-reg-area" />
        <polyline points={linePoints} className="ul-reg-line" />
      </svg>
      <div className="ul-reg-chart-labels">
        {points.map((p) => <span key={p.label}>{p.label}</span>)}
      </div>
    </div>
  );
}

function RegionBarChart({ regions }) {
  const max = Math.max(1, ...regions.map((r) => r.students));
  return (
    <div className="ul-report-bars" aria-label="Students enrolled by region">
      {regions.map((r) => (
        <div className="ul-report-bar-group" key={r.id}>
          <div className="ul-report-bar-value">{number(r.students)}</div>
          <div className="ul-report-bar-track">
            <div className="ul-report-bar" style={{ height: `${Math.max(8, (r.students / max) * 100)}%` }} />
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
            State-by-state enrollment and revenue growth across India.
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
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const totals = useMemo(() => getRegionTotals(), []);
  const avgGrowth = useMemo(() => getAverageGrowth(), []);
  const trend = useMemo(() => getRegionTrend(selectedRegion), [selectedRegion]);
  const sortedByStudents = useMemo(() => [...REGIONS].sort((a, b) => b.students - a.students), []);

  useEffect(() => setPage(1), [search]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sortedByStudents;
    return sortedByStudents.filter((r) => `${r.state} ${r.city}`.toLowerCase().includes(q));
  }, [sortedByStudents, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / REGION_PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * REGION_PAGE_SIZE, currentPage * REGION_PAGE_SIZE);

  return (
    <div>
      <div className="ul-stats ul-reg-stats">
        <div className="ul-stat-card"><span className="ul-stat-card__label">REGIONS TRACKED</span><span className="ul-stat-card__value">{REGIONS.length}</span><span className="ul-stat-card__trend">{totals.institutions} institutions</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">TOTAL STUDENTS</span><span className="ul-stat-card__value">{number(totals.students)}</span><span className="ul-stat-card__trend is-up">Across all regions</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">TOTAL EDUCATORS</span><span className="ul-stat-card__value">{number(totals.educators)}</span><span className="ul-stat-card__trend">Active across India</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">AVG. GROWTH (MoM)</span><span className="ul-stat-card__value">{pct(avgGrowth)}</span><span className="ul-stat-card__trend is-up">Enrollment-weighted</span></div>
      </div>

      <div className="ul-reg-grid">
        <section className="ul-card">
          <div className="ul-reg-chart-head">
            <div className="ul-card__head" style={{ marginBottom: 0 }}>
              <span className="ul-card__eyebrow"><IconChart size={13} /> Performance over time</span>
              <h3>Enrollment Growth Trend</h3>
            </div>
            <select className="ul-reg-region-select" value={selectedRegion} onChange={(e) => setSelectedRegion(e.target.value)}>
              <option value="all">All India</option>
              {REGIONS.map((r) => (
                <option key={r.id} value={r.id}>{r.state}</option>
              ))}
            </select>
          </div>
          <TrendChart points={trend} />
        </section>

        <section className="ul-card">
          <div className="ul-card__head">
            <span className="ul-card__eyebrow"><IconGlobe size={13} /> By region</span>
            <h3>Students by Region</h3>
          </div>
          <RegionBarChart regions={sortedByStudents} />
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
                <col style={{ width: "15%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "11%" }} />
                <col style={{ width: "11%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Region</th>
                  <th className="ul-reg-growth-col">Institutions</th>
                  <th className="ul-reg-growth-col">Students</th>
                  <th className="ul-reg-growth-col">Educators</th>
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
                    <td className="ul-reg-growth-col">{number(r.students)}</td>
                    <td className="ul-reg-growth-col">{number(r.educators)}</td>
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
