// Admin Dashboard
//
// Ported from the reference Admin implementation's Dashboard.jsx (bento
// grid layout, LineChart, split bar, dark "approvals handled" card, task
// list, quick actions, monthly progress). Chrome (sidebar/topbar) is
// supplied by src/layouts/AdminLayout.jsx — this component renders only
// the dashboard's own content, reached at /admin/logindashboard after
// Login -> MFA.

import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../../../hooks/useAuth";
import {
  platformStats,
  pendingApprovals,
  approvalsWeekly,
  moderators,
  revenueTrend,
  complianceNote,
  approvalTasks,
  quickActions,
  recentActivity,
} from "../data/dashboardMock";
import { IconPlus, IconClose } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";

const today = new Date().toLocaleDateString("en-US", {
  weekday: "long",
  year: "numeric",
  month: "long",
  day: "numeric",
});

function LineChart({ data, valueKeyA, valueKeyB, colorA, colorB }) {
  const width = 260;
  const height = 92;
  const max = Math.max(...data.map((d) => Math.max(d[valueKeyA], d[valueKeyB ?? valueKeyA]))) || 1;
  const stepX = width / (data.length - 1);

  const toPoints = (key) => data.map((d, i) => `${i * stepX},${height - (d[key] / max) * height}`).join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="ul-linechart" preserveAspectRatio="none">
      <polyline points={toPoints(valueKeyA)} fill="none" stroke={colorA} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      {valueKeyB && (
        <polyline points={toPoints(valueKeyB)} fill="none" stroke={colorB} strokeWidth="2" strokeDasharray="4 4" strokeLinecap="round" strokeLinejoin="round" />
      )}
    </svg>
  );
}

const NOTEPAD_STORAGE_KEY = "ul-admin-notepad";

// Inline scratchpad card, boxed beside Revenue Trend. Plain textarea,
// autosaved to this browser's localStorage — same pattern as any other
// admin-only client-side convenience with no backend endpoint to call.
function NotepadCard({ onAddNote }) {
  const [text, setText] = useState("");
  const [savedAt, setSavedAt] = useState(null);
  const saveTimer = useRef(null);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(NOTEPAD_STORAGE_KEY);
      if (stored !== null) setText(stored);
    } catch {
      // localStorage unavailable (private browsing, blocked storage, etc.)
      // — the notepad still works for this session, it just won't persist.
    }
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, []);

  const persist = (value) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      try {
        window.localStorage.setItem(NOTEPAD_STORAGE_KEY, value);
        setSavedAt(new Date());
      } catch {
        // ignore — best-effort persistence only
      }
    }, 400);
  };

  const handleChange = (event) => {
    const value = event.target.value;
    setText(value);
    persist(value);
  };

  // Enter submits the current note as a new Admin Note bullet (Shift+Enter
  // still inserts a newline for anyone jotting a longer, multi-line note).
  const handleKeyDown = (event) => {
    if (event.key !== "Enter" || event.shiftKey) return;
    event.preventDefault();
    const value = text.trim();
    if (!value) return;
    onAddNote?.(value);
    setText("");
    persist("");
  };

  return (
    <div className="ul-card ul-notepad-card">
      <div className="ul-card__head">
        <span className="ul-card__eyebrow">Scratchpad</span>
        <h3>Notepad</h3>
      </div>
      <textarea
        className="ul-notepad-card__area"
        placeholder="Jot a quick note and press Enter to add it to Admin Notes."
        value={text}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
      />
      <div className="ul-notepad-card__foot">
        {savedAt
          ? `Saved ${savedAt.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : "Press Enter to add to Admin Notes"}
      </div>
    </div>
  );
}

export default function LoginDashboard() {
  const { user } = useAuth();
  const totalApprovals = pendingApprovals.educators.length + pendingApprovals.courses.length;
  const [noteItems, setNoteItems] = useState(() =>
    complianceNote.checklist.map((item, i) => ({ ...item, id: `seed-${i}` }))
  );
  const addNoteItem = (label) => {
    setNoteItems((prev) => [...prev, { id: `note-${Date.now()}`, label, done: false }]);
  };
  const removeNoteItem = (id) => {
    setNoteItems((prev) => prev.filter((item) => item.id !== id));
  };

  return (
    <>
      <div className="ul-dash-welcome">
        <h2 className="ul-dash-welcome__title">Welcome back, {user?.name?.split(" ")[0] || "Admin"}.</h2>
        <p className="ul-dash-welcome__subtitle">{today} · Here&rsquo;s what needs your attention</p>
      </div>

      {/* ---- platform stat row ---- */}
      <div className="ul-stats ul-stats--dash">
        {platformStats.map((s) => (
          <div className="ul-stat-card ul-stat-card--dash" key={s.key}>
            <span className="ul-stat-card__label">{s.label.toUpperCase()}</span>
            <span className="ul-stat-card__value">{s.value}</span>
            <span className={`ul-stat-card__trend ${s.trendUp ? "is-up" : "is-down"}`}>
              {s.trend} <em>{s.note}</em>
            </span>
          </div>
        ))}
      </div>

      {/* ---- bento grid ---- */}
      <div className="ul-bento">
        {/* column 1 */}
        <div className="ul-bento__col">
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
              {pendingApprovals.courses.map((c) => (
                <div className="ul-approval-row ul-approval-row--course" key={c.id}>
                  <div className="ul-approval-row__body">
                    <span className="ul-approval-row__name">{c.title}</span>
                    <span className="ul-approval-row__meta">by {c.author}</span>
                  </div>
                  <div className="ul-approval-row__actions">
                    <button className="ul-btn ul-btn--primary" type="button">Approve</button>
                    <button className="ul-btn ul-btn--danger" type="button">Reject</button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ul-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Last 7 days</span>
              <h3>Revenue Trend</h3>
            </div>
            <LineChart data={revenueTrend} valueKeyA="revenue" valueKeyB="refunds" colorA="var(--color-primary)" colorB="var(--color-financial-cyan)" />
            <div className="ul-legend">
              <span><i style={{ background: "var(--color-primary)" }} /> Revenue</span>
              <span><i style={{ background: "var(--color-financial-cyan)" }} /> Refunds</span>
            </div>
          </div>
        </div>

        {/* column 2 */}
        <div className="ul-bento__col">
          <div className="ul-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Today</span>
              <h3>New Enrollments</h3>
            </div>
            <div className="ul-big-number">
              3,482 <span className="ul-big-number__trend">+18%</span>
            </div>
            <div className="ul-split-bar">
              <div className="ul-split-bar__seg" style={{ width: "68%", background: "var(--color-primary)" }} />
              <div className="ul-split-bar__seg" style={{ width: "32%", background: "var(--color-soft-pink)" }} />
            </div>
            <div className="ul-split-bar__labels">
              <span><i style={{ background: "var(--color-primary)" }} /> Completed checkout · 68%</span>
              <span><i style={{ background: "var(--color-soft-pink)" }} /> Abandoned · 32%</span>
            </div>
          </div>

          <div className="ul-card ul-card--warning">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow ul-card__eyebrow--warning">ADMIN NOTE</span>
              <h3>{complianceNote.title}</h3>
            </div>
            <p className="ul-card__body-text">{complianceNote.body}</p>
            <div className="ul-checklist">
              {noteItems.map((item) => (
                <div className="ul-checklist__item" key={item.id}>
                  <span className="ul-checklist__bullet" aria-hidden="true" />
                  <span className="ul-checklist__label">{item.label}</span>
                  <button
                    type="button"
                    className="ul-checklist__dismiss"
                    aria-label={`Dismiss note: ${item.label}`}
                    onClick={() => removeNoteItem(item.id)}
                  >
                    <IconClose size={11} />
                  </button>
                </div>
              ))}
            </div>
            <span className="ul-pill ul-pill--warning">{complianceNote.due}</span>
          </div>

          <NotepadCard onAddNote={addNoteItem} />
        </div>

        {/* column 3 */}
        <div className="ul-bento__col">
          <div className="ul-card ul-card--dark">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow ul-card__eyebrow--light">This week</span>
              <h3 className="is-light">Approvals Handled</h3>
            </div>
            <div className="ul-big-number is-light">
              {approvalsWeekly.reduce((sum, d) => sum + d.value, 0)}
              <span className="ul-big-number__trend">{totalApprovals} awaiting</span>
            </div>
            <div className="ul-bars">
              {approvalsWeekly.map((d) => (
                <div className="ul-bars__col" key={d.day}>
                  <div
                    className="ul-bars__fill"
                    style={{
                      height: `${d.value}%`,
                      background: d.value >= 80 ? "var(--color-financial-cyan)" : "rgba(255,255,255,0.35)",
                    }}
                  />
                </div>
              ))}
            </div>
            <div className="ul-bars__labels">
              {approvalsWeekly.map((d) => (
                <span key={d.day}>{d.day[0]}</span>
              ))}
            </div>
            <div className="ul-avatar-row">
              {moderators.map((m, i) => (
                <div
                  className="ul-avatar-chip ul-avatar-chip--stacked"
                  style={{ background: m.color, zIndex: moderators.length - i }}
                  key={m.initials}
                >
                  {m.initials}
                </div>
              ))}
              <span className="ul-avatar-row__label">handled by {moderators.length} moderators today</span>
            </div>
          </div>

          <div className="ul-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">In progress</span>
              <h3>Approval Tasks</h3>
            </div>
            <div className="ul-task-list">
              {approvalTasks.map((t) => (
                <div className="ul-task" key={t.id}>
                  <div className="ul-task__top">
                    <span className={t.done ? "is-done-text" : ""}>{t.label}</span>
                    <span className="ul-task__meta">{t.meta}</span>
                  </div>
                  <div className="ul-task__bar">
                    <div className="ul-task__fill" style={{ width: `${t.progress}%`, background: t.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ul-card ul-activity-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Recent</span>
              <h3>Today's Activity</h3>
            </div>
            <div className="ul-activity-list">
              {recentActivity.slice(0, 3).map((a) => (
                <div className="ul-activity-item" key={a.id}>
                  <span className="ul-activity-item__text">
                    <strong>{a.actor}</strong> {a.text}
                  </span>
                  <span className="ul-activity-item__time">{a.time}</span>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* ---- quick actions ---- */}
      <div className="ul-quick-actions">
        {quickActions.map((qa) => (
          <Link className="ul-quick-action" key={qa.key} style={{ background: qa.color }} to={qa.to}>
            <IconPlus size={16} color="#fff" />
            <span>{qa.label}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
