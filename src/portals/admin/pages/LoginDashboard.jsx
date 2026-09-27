// Admin Dashboard
//
// Visual layout matched to the reference design: welcome hero (quote +
// date pill), four stat cards, Platform Revenue chart + Transaction
// Overview, and Top Performing Courses + Students by Region + My
// Notepad. Chrome (sidebar/topbar) is supplied by AdminLayout.jsx — this
// component renders only the dashboard's own content, reached at
// /admin/logindashboard after Login -> MFA. All data below is sourced
// from the existing mock modules (financialAnalyticsMock / regionalAnalyticsMock)
// or from dashboardMock.js — no routes, permissions or other pages change.

import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import {
  dashboardQuote,
  dashboardStatCards,
  dashboardRevenuePoints,
  dashboardNetRevenue,
  dashboardNotepadSeed,
  pendingApprovals,
} from "../data/dashboardMock";
import { TOP_PERFORMING_COURSES } from "../data/financialAnalyticsMock";
import { REGIONS } from "../data/regionalAnalyticsMock";
import { IconUsers, IconTeach, IconCourse, IconReport, IconGraduationCap, IconClose, IconSend } from "../components/icons";
import dashboardHeroImg from "../../../assets/illustrations/dashboard-hero.png";
import dashboardMapImg from "../../../assets/illustrations/dashboard-map.png";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";

const today = new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

const money = (value) => `₹${Math.round(value || 0).toLocaleString("en-IN")}`;

const STAT_ICONS = { users: IconUsers, teach: IconTeach, course: IconCourse, report: IconReport };

// Tiny inline sparkline used inside each stat card — a smooth curve
// through a short run of values, sized to sit beside the number.
function Sparkline({ values, color }) {
  const width = 72;
  const height = 32;
  const max = Math.max(...values, 1);
  const min = Math.min(...values, 0);
  const range = Math.max(1, max - min);
  const coords = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * width, height - 4 - ((v - min) / range) * (height - 8)]);
  let d = `M ${coords[0][0]},${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const cx = (x0 + x1) / 2;
    d += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const area = `${d} L ${coords[coords.length - 1][0]},${height} L 0,${height} Z`;
  return (
    <svg className="ul-dash2-spark" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={color} opacity="0.16" />
      <path d={d} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

// Graduation-cap-on-books hero mark — cropped straight from the reference
// image (see src/assets/illustrations/dashboard-hero.png) rather than
// approximated in shapes, so it matches exactly.
function HeroIllustration() {
  return <img className="ul-dash2-hero-art" src={dashboardHeroImg} alt="" aria-hidden="true" />;
}

function RevenueChart({ points }) {
  const width = 640;
  const height = 220;
  const max = Math.max(...points.map((p) => p.value), 1);
  const [hover, setHover] = useState(points.length - 1);
  const coords = points.map((p, i) => [(i / Math.max(1, points.length - 1)) * width, height - 24 - (p.value / max) * (height - 40)]);
  let linePath = `M ${coords[0][0]},${coords[0][1]}`;
  for (let i = 0; i < coords.length - 1; i++) {
    const [x0, y0] = coords[i];
    const [x1, y1] = coords[i + 1];
    const cx = (x0 + x1) / 2;
    linePath += ` C ${cx},${y0} ${cx},${y1} ${x1},${y1}`;
  }
  const areaPath = `${linePath} L ${coords[coords.length - 1][0]},${height} L 0,${height} Z`;
  const ticks = [0, 0.25, 0.5, 0.75, 1];

  return (
    <div className="ul-dash2-chart-wrap">
      <div className="ul-dash2-chart-yaxis">
        {ticks.slice().reverse().map((t) => (
          <span key={t}>{t === 0 ? "0" : `${Math.round((max * t) / 1000)}k`}</span>
        ))}
      </div>
      <div className="ul-dash2-chart-plot">
        <svg viewBox={`0 0 ${width} ${height}`} className="ul-dash2-chart" preserveAspectRatio="none" role="img" aria-label="Platform revenue trend">
          <defs>
            <linearGradient id="ulDash2RevenueFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.22" />
              <stop offset="100%" stopColor="var(--color-primary)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {ticks.map((t) => (
            <line key={t} x1="0" y1={height - 24 - t * (height - 40)} x2={width} y2={height - 24 - t * (height - 40)} className="ul-dash2-gridline" />
          ))}
          <path d={areaPath} fill="url(#ulDash2RevenueFill)" />
          <path d={linePath} fill="none" stroke="var(--color-primary)" strokeWidth="3" strokeLinecap="round" />
          {coords.map(([x, y], i) => (
            <circle
              key={points[i].label}
              cx={x}
              cy={y}
              r={hover === i ? 6 : 4.5}
              className="ul-dash2-chart-dot"
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(points.length - 1)}
            />
          ))}
          {hover !== null && (
            <g style={{ transform: `translate(${coords[hover][0]}px, ${coords[hover][1] - 16}px)` }}>
              <foreignObject x="-46" y="-34" width="92" height="30">
                <div className="ul-dash2-chart-tooltip">{money(points[hover].value)}</div>
              </foreignObject>
            </g>
          )}
        </svg>
        <div className="ul-dash2-chart-labels">
          {points.map((p) => <span key={p.label}>{p.label}</span>)}
        </div>
      </div>
    </div>
  );
}

const NOTEPAD_STORAGE_KEY = "ul-admin-notepad-v2";

function NotepadCard() {
  const [items, setItems] = useState(() => {
    try {
      const stored = window.localStorage.getItem(NOTEPAD_STORAGE_KEY);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore — fall back to the seed list below
    }
    return dashboardNotepadSeed.map((label, i) => ({ id: `seed-${i}`, label, done: false }));
  });
  const [draft, setDraft] = useState("");

  useEffect(() => {
    try {
      window.localStorage.setItem(NOTEPAD_STORAGE_KEY, JSON.stringify(items));
    } catch {
      // best-effort persistence only
    }
  }, [items]);

  const toggleItem = (id) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, done: !item.done } : item)));
  };
  const removeItem = (id) => {
    setItems((prev) => prev.filter((item) => item.id !== id));
  };
  const addNote = () => {
    const value = draft.trim();
    if (!value) return;
    setItems((prev) => [...prev, { id: `note-${Date.now()}`, label: value, done: false }]);
    setDraft("");
  };

  return (
    <div className="ul-card ul-dash2-notepad">
      <div className="ul-card__head">
        <span className="ul-card__eyebrow">Scratchpad</span>
        <h3>My Notepad</h3>
      </div>
      <div className="ul-dash2-notepad-list">
        {items.map((item) => (
          <label className="ul-dash2-notepad-item" key={item.id}>
            <input type="checkbox" checked={item.done} onChange={() => toggleItem(item.id)} />
            <span className={item.done ? "is-done" : ""}>{item.label}</span>
            <button type="button" className="ul-dash2-notepad-remove" onClick={() => removeItem(item.id)} aria-label="Remove note">
              <IconClose size={11} />
            </button>
          </label>
        ))}
      </div>
      <div className="ul-dash2-notepad-input">
        <input
          type="text"
          placeholder="Add a note…"
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") addNote();
          }}
        />
        <button type="button" className="ul-dash2-notepad-send" onClick={addNote} aria-label="Add">
          <IconSend size={14} />
        </button>
      </div>
    </div>
  );
}

export default function LoginDashboard() {
  const { user } = useAuth();
  const firstName = user?.name?.split(" ")[0] || "Admin";
  const topCourses = useMemo(() => TOP_PERFORMING_COURSES.slice(0, 5), []);
  const topRegions = useMemo(() => [...REGIONS].sort((a, b) => b.students - a.students).slice(0, 6), []);
  const regionTotal = useMemo(() => REGIONS.reduce((sum, r) => sum + r.students, 0), []);

  return (
    <>
      {/* ---- welcome hero ---- */}
      <div className="ul-card ul-dash2-hero">
        <div className="ul-dash2-hero-text">
          <p className="ul-dash2-hero-eyebrow">Welcome back,</p>
          <h2 className="ul-dash2-hero-title">{firstName}! 👋</h2>
          <p className="ul-dash-welcome__subtitle">Here&rsquo;s what&rsquo;s happening on your Universal Learning platform today.</p>
        </div>
        <HeroIllustration />
        <p className="ul-dash2-hero-quote">&ldquo;{dashboardQuote}&rdquo;</p>
        <div className="ul-dash2-hero-date">
          <span>Today</span>
          <strong>{today}</strong>
        </div>
      </div>

      {/* ---- stat row ---- */}
      <div className="ul-stats ul-stats--dash">
        {dashboardStatCards.map((s) => {
          const Icon = STAT_ICONS[s.icon] || IconGraduationCap;
          return (
            <div className={`ul-stat-card ul-stat-card--dash ul-stat-card--${s.accent}`} key={s.key}>
              <span className="ul-dash2-stat-icon"><Icon size={17} /></span>
              <span className="ul-stat-card__label">{s.label}</span>
              <span className="ul-stat-card__value">{s.value}</span>
              <span className="ul-stat-card__trend is-up">{s.trend} <em>{s.note}</em></span>
              <Sparkline values={s.spark} color="var(--color-primary)" />
            </div>
          );
        })}
      </div>

      {/* ---- revenue + transactions ---- */}
      <div className="ul-dash2-row ul-dash2-row--split">
        <div className="ul-card">
          <div className="ul-dash2-chart-head">
            <div>
              <div className="ul-card__head"><span className="ul-card__eyebrow">Platform Revenue</span></div>
              <p className="ul-card__body-text">Total revenue generated across courses, test series and other products.</p>
            </div>
            <div className="ul-dash2-chart-summary">
              <span className="ul-dash2-net-value">{dashboardNetRevenue.value}</span>
              <span className="ul-stat-card__trend is-up">{dashboardNetRevenue.trend}</span>
            </div>
          </div>
          <RevenueChart points={dashboardRevenuePoints} />
        </div>

        <div className="ul-card ul-card--tall">
          <div className="ul-card__head">
            <span className="ul-card__eyebrow">High-priority approvals</span>
            <h3>Pending Review</h3>
          </div>

          <div className="ul-card__group-head">
            <span className="ul-card__group-label">EDUCATOR VERIFICATIONS</span>
            <Link className="ul-card__see-all" to="/admin/educatorverification">See all</Link>
          </div>
          <div className="ul-approval-list">
            {pendingApprovals.educators.map((e) => (
              <div className="ul-approval-row" key={e.id}>
                <div className="ul-avatar-chip">{e.initials}</div>
                <div className="ul-approval-row__body">
                  <span className="ul-approval-row__name">{e.name}</span>
                  <span className="ul-approval-row__meta">Submitted {e.submitted}</span>
                </div>
                <Link className="ul-btn ul-btn--ghost" to="/admin/educatorverification">
                  Review
                </Link>
              </div>
            ))}
          </div>

          <div className="ul-card__group-head">
            <span className="ul-card__group-label">COURSE APPROVALS</span>
            <Link className="ul-card__see-all" to="/admin/courseapproval">See all</Link>
          </div>
          <div className="ul-approval-list">
            {pendingApprovals.courses.map((cItem) => (
              <div className="ul-approval-row ul-approval-row--course" key={cItem.id}>
                <div className="ul-approval-row__body">
                  <span className="ul-approval-row__name">{cItem.title}</span>
                  <span className="ul-approval-row__meta">by {cItem.author}</span>
                </div>
                <div className="ul-approval-row__actions">
                  <button className="ul-btn ul-btn--primary" type="button">Approve</button>
                  <button className="ul-btn ul-btn--danger" type="button">Reject</button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ---- courses + region + notepad ---- */}
      <div className="ul-dash2-row ul-dash2-row--triple">
        <div className="ul-card">
          <div className="ul-card__head">
            <span className="ul-card__eyebrow"><span className="ul-dash2-trophy" aria-hidden="true">🏆</span>Top Performing Courses</span>
            <Link className="ul-card__see-all" to="/admin/financialanalytics">View all</Link>
          </div>
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-dash2-courses-table">
              <thead><tr><th>Course Name</th><th>Enrollments</th><th>Revenue</th><th>Growth</th></tr></thead>
              <tbody>
                {topCourses.map((c) => (
                  <tr key={c.name}>
                    <td><strong>{c.name}</strong></td>
                    <td>{c.enrollments.toLocaleString("en-IN")}</td>
                    <td>{money(c.revenue)}</td>
                    <td><span className="ul-status-badge is-approved">↑ {c.performance}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="ul-card">
          <div className="ul-card__head">
            <span className="ul-card__eyebrow">Students by Region</span>
            <Link className="ul-card__see-all" to="/admin/regionalanalytics">View all</Link>
          </div>
          <div className="ul-dash2-region-body">
            <img className="ul-dash2-region-map" src={dashboardMapImg} alt="" aria-hidden="true" />
            <div className="ul-dash2-region-list">
              {topRegions.map((r) => (
                <div className="ul-dash2-region-row" key={r.id}>
                  <span>{r.state}</span>
                  <strong>{r.students.toLocaleString("en-IN")}</strong>
                </div>
              ))}
            </div>
          </div>
          <div className="ul-dash2-region-legend">
            <span><i className="is-hi" /> 2,000+</span>
            <span><i className="is-mid" /> 500-2,000</span>
            <span><i className="is-low" /> 100-500</span>
            <span><i className="is-min" /> &lt;100</span>
          </div>
          <p className="ul-dash2-region-total">{regionTotal.toLocaleString("en-IN")} students across {REGIONS.length} regions</p>
        </div>

        <NotepadCard />
      </div>
    </>
  );
}
