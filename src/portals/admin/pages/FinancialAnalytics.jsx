import { useMemo, useState } from "react";
import {
  financialAnalyticsTransactions,
  getAnalyticsEducatorRows,
  getAnalyticsMetrics,
  getAnalyticsStatusRows,
  getAnalyticsTrend,
} from "../data/financialAnalyticsMock";
import { IconChart, IconWallet } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./FinancialAnalytics.css";

const RANGE_OPTIONS = [
  { value: "7", label: "Last 7 days" },
  { value: "30", label: "Last 30 days" },
  { value: "90", label: "Last 90 days" },
  { value: "all", label: "All time" },
];

const money = (value) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;

function TrendChart({ points }) {
  const width = 680;
  const height = 210;
  const max = Math.max(1, ...points.flatMap((point) => [point.revenue, point.commission, point.refunds]));
  const toPoints = (key) => points.map((point, index) => `${(index / Math.max(1, points.length - 1)) * width},${height - (point[key] / max) * (height - 18)}`).join(" ");

  return (
    <div className="ul-fin-chart-wrap">
      <svg className="ul-fin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue, commission and refunds trend">
        <line x1="0" y1="35" x2={width} y2="35" className="ul-fin-gridline" />
        <line x1="0" y1="105" x2={width} y2="105" className="ul-fin-gridline" />
        <line x1="0" y1="175" x2={width} y2="175" className="ul-fin-gridline" />
        <polyline points={toPoints("revenue")} className="ul-fin-line ul-fin-line--revenue" />
        <polyline points={toPoints("commission")} className="ul-fin-line ul-fin-line--commission" />
        <polyline points={toPoints("refunds")} className="ul-fin-line ul-fin-line--refunds" />
      </svg>
      <div className="ul-fin-chart-labels">
        {points.map((point) => <span key={point.label}>{point.label}</span>)}
      </div>
    </div>
  );
}

export default function FinancialAnalytics() {
  const transactions = financialAnalyticsTransactions;
  const [range, setRange] = useState("30");
  const latestTransactionTime = useMemo(
    () => transactions.reduce((latest, transaction) => Math.max(latest, new Date(`${transaction.date}T00:00:00`).getTime()), 0),
    [transactions]
  );
  const filtered = useMemo(() => {
    if (range === "all") return transactions;
    const cutoff = latestTransactionTime - Number(range) * 86400000;
    return transactions.filter((transaction) => new Date(`${transaction.date}T00:00:00`).getTime() >= cutoff);
  }, [transactions, range, latestTransactionTime]);

  const metrics = useMemo(() => {
    return getAnalyticsMetrics(filtered);
  }, [filtered]);

  const points = useMemo(() => getAnalyticsTrend(filtered, range, latestTransactionTime), [filtered, range, latestTransactionTime]);

  const statusRows = useMemo(() => getAnalyticsStatusRows(filtered), [filtered]);

  const educatorRows = useMemo(() => getAnalyticsEducatorRows(filtered), [filtered]);

  return (
    <div className="ul-fin-page">
      <div className="ul-dash-welcome ul-fin-welcome">
        <div><h2 className="ul-dash-welcome__title">Financial Analytics</h2><p className="ul-dash-welcome__subtitle">Detailed revenue, payout, commission and payment performance across the platform.</p></div>
        <label className="ul-fin-range">Date range<select value={range} onChange={(event) => setRange(event.target.value)}>{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
      </div>

      <div className="ul-stats ul-fin-stats">
        <div className="ul-stat-card"><span className="ul-stat-card__label">GROSS REVENUE</span><span className="ul-stat-card__value">{money(metrics.grossRevenue)}</span><span className="ul-stat-card__trend is-up">{filtered.length} <em>transactions</em></span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">PLATFORM COMMISSION</span><span className="ul-stat-card__value">{money(metrics.commission)}</span><span className="ul-stat-card__trend is-up">{metrics.grossRevenue ? Math.round((metrics.commission / metrics.grossRevenue) * 100) : 0}% <em>effective rate</em></span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">EDUCATOR PAYOUTS</span><span className="ul-stat-card__value">{money(metrics.educatorPayouts)}</span><span className="ul-stat-card__trend">Paid ledger volume</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">NET REVENUE</span><span className="ul-stat-card__value">{money(metrics.netRevenue)}</span><span className="ul-stat-card__trend">After payouts & refunds</span></div>
      </div>

      <div className="ul-fin-grid">
        <section className="ul-card ul-fin-chart-card"><div className="ul-card__head"><span className="ul-card__eyebrow">Performance over time</span><h3>Revenue Trend</h3></div><div className="ul-fin-legend"><span><i className="is-revenue" /> Revenue</span><span><i className="is-commission" /> Commission</span><span><i className="is-refund" /> Refunds</span></div><TrendChart points={points} /></section>
        <section className="ul-card"><div className="ul-card__head"><span className="ul-card__eyebrow">Operational health</span><h3>Payment Status</h3></div><div className="ul-fin-breakdown">{statusRows.map(({ status, label, count }) => <div className="ul-fin-breakdown-row" key={status}><span className={`ul-status-badge is-${status === "paid" ? "approved" : status === "failed" ? "rejected" : "pending"}`}>{label}</span><strong>{count}</strong><span>{Math.round((count / Math.max(1, filtered.length)) * 100)}%</span></div>)}</div></section>
      </div>

      <section className="ul-card ul-fin-table-card"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconChart size={14} /> Educator performance</span><h3>Educator Payouts & Commission</h3></div><div className="ul-edu-table-scroll"><table className="ul-edu-table"><thead><tr><th>Educator</th><th>Gross revenue</th><th>Commission</th><th>Net payout</th></tr></thead><tbody>{educatorRows.map((row) => <tr key={row.name}><td><strong>{row.name}</strong></td><td>{money(row.revenue)}</td><td>{money(row.commission)}</td><td>{money(row.payout)}</td></tr>)}{educatorRows.length === 0 && <tr><td colSpan="4" className="ul-edu-empty">No transactions in this date range.</td></tr>}</tbody></table></div></section>
    </div>
  );
}
