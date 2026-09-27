import { useMemo, useState } from "react";
import {
  TOP_PERFORMING_COURSES,
  financialAnalyticsTransactions,
  getAnalyticsMetrics,
  getAnalyticsTrend,
} from "../data/financialAnalyticsMock";
import { IconChart } from "../components/icons";
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

// Smooth curve through a set of [x, y] coordinates using a horizontal-tangent
// cubic-bezier between each pair of points — simple, monotone-safe (no
// overshoot/ringing on this kind of data) and cheap to compute per render.
function smoothPath(coords) {
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

function TrendChart({ points }) {
  const width = 680;
  const height = 210;
  const max = Math.max(1, ...points.flatMap((point) => [point.revenue, point.refunds]));
  const [hover, setHover] = useState(null);
  const toCoords = (key) => points.map((point, index) => [(index / Math.max(1, points.length - 1)) * width, height - (point[key] / max) * (height - 18)]);
  const revenueCoords = toCoords("revenue");
  const refundsCoords = toCoords("refunds");
  const revenuePath = smoothPath(revenueCoords);
  const refundsPath = smoothPath(refundsCoords);
  const areaPath = `${revenuePath} L ${revenueCoords[revenueCoords.length - 1]?.[0] ?? width},${height} L 0,${height} Z`;

  return (
    <div className="ul-fin-chart-wrap">
      <svg className="ul-fin-chart" viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Revenue and refunds trend">
        <defs>
          <linearGradient id="ulFinRevenueFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.16" />
            <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <line x1="0" y1="35" x2={width} y2="35" className="ul-fin-gridline" />
        <line x1="0" y1="105" x2={width} y2="105" className="ul-fin-gridline" />
        <line x1="0" y1="175" x2={width} y2="175" className="ul-fin-gridline" />
        <path d={areaPath} fill="url(#ulFinRevenueFill)" className="ul-fin-area" />
        <path d={refundsPath} className="ul-fin-line ul-fin-line--refunds" />
        <path d={revenuePath} className="ul-fin-line ul-fin-line--revenue" />
        {revenueCoords.map(([x, y], i) => (
          <circle
            key={`r-${points[i].label}`}
            cx={x}
            cy={y}
            r={hover === i ? 5.5 : 3.5}
            className="ul-fin-chart-dot ul-fin-chart-dot--revenue"
            onMouseEnter={() => setHover(i)}
            onMouseLeave={() => setHover((h) => (h === i ? null : h))}
          />
        ))}
        {refundsCoords.map(([x, y], i) => (
          <circle key={`f-${points[i].label}`} cx={x} cy={y} r={hover === i ? 4.5 : 2.5} className="ul-fin-chart-dot ul-fin-chart-dot--refunds" />
        ))}
        {hover !== null && (
          <g className="ul-fin-chart-tooltip" style={{ transform: `translate(${revenueCoords[hover][0]}px, ${Math.min(revenueCoords[hover][1], refundsCoords[hover][1]) - 14}px)` }}>
            <foreignObject x="-58" y="-46" width="116" height="42">
              <div className="ul-fin-chart-tooltip__box">
                <strong>{points[hover].label}</strong>
                <span><i className="is-revenue" /> {money(points[hover].revenue)}</span>
                <span><i className="is-refund" /> {money(points[hover].refunds)}</span>
              </div>
            </foreignObject>
          </g>
        )}
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

  return (
    <div className="ul-fin-page">
      <div className="ul-dash-welcome ul-fin-welcome">
        <div><h2 className="ul-dash-welcome__title">Financial Analytics</h2><p className="ul-dash-welcome__subtitle">Detailed revenue, payout and payment performance across the platform.</p></div>
      </div>

      <div className="ul-stats ul-fin-stats">
        <div className="ul-stat-card"><span className="ul-stat-card__label">GROSS REVENUE</span><span className="ul-stat-card__value">{money(metrics.grossRevenue)}</span><span className="ul-stat-card__trend is-up">{filtered.length} <em>transactions</em></span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">NET REVENUE</span><span className="ul-stat-card__value">{money(metrics.netRevenue)}</span><span className="ul-stat-card__trend">After payouts & refunds</span></div>
      </div>

      <div className="ul-fin-grid ul-fin-grid--single">
        <section className="ul-card ul-fin-chart-card">
          <div className="ul-card__head ul-fin-chart-head">
            <div><span className="ul-card__eyebrow">Performance over time</span><h3>Revenue Trend</h3></div>
            <label className="ul-fin-range">Date range<select value={range} onChange={(event) => setRange(event.target.value)}>{RANGE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
          </div>
          <div className="ul-fin-legend"><span><i className="is-revenue" /> Revenue</span><span><i className="is-refund" /> Refunds</span></div>
          <TrendChart points={points} />
        </section>
      </div>

      <section className="ul-card ul-fin-top-courses"><div className="ul-card__head"><span className="ul-card__eyebrow"><IconChart size={14} /> Best sellers</span><h3>Top Performing Courses</h3></div><div className="ul-edu-table-scroll"><table className="ul-edu-table ul-fin-top-courses-table"><thead><tr><th>Course</th><th>Category</th><th>Enrollments</th><th>Revenue</th><th>Performance</th></tr></thead><tbody>{TOP_PERFORMING_COURSES.map((course, index) => <tr key={course.name}><td><span className="ul-fin-course-rank">{index + 1}</span><strong>{course.name}</strong></td><td><span className="ul-fin-course-category">{course.category}</span></td><td>{course.enrollments.toLocaleString("en-IN")}</td><td className="ul-fin-course-revenue">{money(course.revenue)}</td><td><div className="ul-fin-course-perf"><div className="ul-progress-track ul-fin-course-perf-track"><div className="ul-progress-fill" style={{ width: `${course.performance}%` }} /></div><span>{course.performance}%</span></div></td></tr>)}</tbody></table></div></section>
    </div>
  );
}
