import { Fragment, useMemo, useState } from "react";
import { useRegionHead } from "../hooks/useRegionHead";
import { Tabs } from "../../admin/pages/discounts/DiscountsShared";
import "../../admin/pages/AdminDashboard.css";
import "../../admin/pages/EducatorVerification.css";

const S_FILTERS = [
  { key: "all", label: "All progress" },
  { key: "behind", label: "Behind (under 30%)" },
  { key: "track", label: "On track (30–99%)" },
  { key: "done", label: "Completed (100%)" },
  { key: "none", label: "Not enrolled" },
];
const T_FILTERS = [
  { key: "all", label: "All teachers" },
  { key: "active", label: "Active" },
  { key: "attention", label: "Needs attention" },
  { key: "low", label: "Low engagement (under 50)" },
];

function Bar({ value, max = 100 }) {
  return (
    <div className="ul-rhp-bar-row" style={{ gridTemplateColumns: "1fr 44px", margin: 0 }}>
      <div className="ul-rhp-track"><div className="ul-rhp-fill" style={{ width: `${Math.min(100, Math.round((value / max) * 100))}%` }} /></div>
      <strong>{value}{max === 100 ? "%" : ""}</strong>
    </div>
  );
}

export default function RHProgress() {
  const { region, data } = useRegionHead();
  const [kind, setKind] = useState("student");
  const isStudent = kind === "student";
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [expanded, setExpanded] = useState(null);
  const switchKind = (k) => { setKind(k); setQ(""); setFilter("all"); setExpanded(null); };

  const sSummary = useMemo(() => {
    const enrolled = data.students.filter((s) => s.courses.length > 0);
    const courses = data.students.reduce((n, s) => n + s.courses.length, 0);
    const completed = data.students.reduce((n, s) => n + s.courses.filter((c) => c.progress >= 100).length, 0);
    const avg = enrolled.length ? Math.round(enrolled.reduce((n, s) => n + s.progress, 0) / enrolled.length) : 0;
    return { enrolled: enrolled.length, courses, completed, avg, behind: enrolled.filter((s) => s.progress < 30).length };
  }, [data.students]);

  const tSummary = useMemo(() => {
    const t = data.teachers;
    const active = t.filter((x) => !x.attention).length;
    const avg = t.length ? Math.round(t.reduce((n, x) => n + (x.engagement || 0), 0) / t.length) : 0;
    return { total: t.length, active, attention: t.length - active, avg, students: t.reduce((n, x) => n + (x.students || 0), 0) };
  }, [data.teachers]);

  const match = (s) => !q.trim() || `${s.name} ${s.id}`.toLowerCase().includes(q.trim().toLowerCase());
  const sRows = data.students.filter((s) => {
    if (!match(s)) return false;
    if (filter === "none") return s.courses.length === 0;
    if (filter === "behind") return s.courses.length > 0 && s.progress < 30;
    if (filter === "track") return s.courses.length > 0 && s.progress >= 30 && s.progress < 100;
    if (filter === "done") return s.courses.length > 0 && s.progress >= 100;
    return true;
  });
  const tRows = data.teachers.filter((s) => {
    if (!match(s)) return false;
    if (filter === "active") return !s.attention;
    if (filter === "attention") return s.attention;
    if (filter === "low") return (s.engagement || 0) < 50;
    return true;
  });

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Progress &amp; Activity</h2>
          <p className="ul-edu-header__subtitle">How students and teachers in {region} are doing.</p>
        </div>
      </div>

      <Tabs value={kind} onChange={switchKind} tabs={[{ key: "student", label: `Students (${data.students.length})` }, { key: "teacher", label: `Teachers (${data.teachers.length})` }]} />
      <div style={{ height: 12 }} />

      {isStudent ? (
        <div className="ul-rhp-stats">
          <div className="ul-rhp-stat"><span>Average progress</span><strong>{sSummary.avg}%</strong><small>Students with a course</small></div>
          <div className="ul-rhp-stat"><span>Students enrolled</span><strong>{sSummary.enrolled}</strong><small>of {data.students.length} in region</small></div>
          <div className="ul-rhp-stat"><span>Courses completed</span><strong>{sSummary.completed}</strong><small>of {sSummary.courses} enrolments</small></div>
          <div className="ul-rhp-stat"><span>Falling behind</span><strong>{sSummary.behind}</strong><small>Under 30% progress</small></div>
        </div>
      ) : (
        <div className="ul-rhp-stats">
          <div className="ul-rhp-stat"><span>Teachers</span><strong>{tSummary.total}</strong><small>Onboarded in region</small></div>
          <div className="ul-rhp-stat"><span>Active teachers</span><strong>{tSummary.active}</strong><small>Verified and recently active</small></div>
          <div className="ul-rhp-stat"><span>Need attention</span><strong>{tSummary.attention}</strong><small>Inactive, unverified or suspended</small></div>
          <div className="ul-rhp-stat"><span>Avg. engagement</span><strong>{tSummary.avg}</strong><small>{tSummary.students} students taught</small></div>
        </div>
      )}

      <div className="ul-rhp-toolbar">
        <input placeholder={isStudent ? "Search student" : "Search teacher"} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {(isStudent ? S_FILTERS : T_FILTERS).map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </div>

      <div className="ul-card ul-edu-table-card">
        <div className="ul-rhp-table-wrap">
          {isStudent ? (
            <table className="ul-edu-table">
              <thead><tr><th>Student</th><th>Courses</th><th style={{ minWidth: 180 }}>Overall progress</th><th>Last active</th><th aria-label="Details" /></tr></thead>
              <tbody>
                {sRows.length === 0 && <tr><td colSpan={5} style={{ padding: 24 }}>No students match.</td></tr>}
                {sRows.map((s) => (
                  <Fragment key={s.id}>
                    <tr className="ul-edu-row--clickable" onClick={() => setExpanded(expanded === s.id ? null : s.id)}>
                      <td><strong>{s.name}</strong><span className="ul-rhp-sub">{s.id}</span></td>
                      <td>{s.courses.length || "—"}</td>
                      <td><Bar value={s.progress} /></td>
                      <td>{s.lastActive}</td>
                      <td><button type="button" className="ul-btn ul-btn--ghost" onClick={(e) => { e.stopPropagation(); setExpanded(expanded === s.id ? null : s.id); }}>{expanded === s.id ? "Hide" : "Courses"}</button></td>
                    </tr>
                    {expanded === s.id && (
                      <tr>
                        <td colSpan={5} style={{ background: "#fcf9f8", padding: "12px 18px" }}>
                          {s.courses.length === 0 ? "Not enrolled in any course yet." : s.courses.map((c) => (
                            <div className="ul-rhp-bar-row" key={c.title} style={{ gridTemplateColumns: "minmax(160px, 1.4fr) 1fr 44px" }}>
                              <span>{c.title}</span>
                              <div className="ul-rhp-track"><div className="ul-rhp-fill" style={{ width: `${c.progress}%` }} /></div>
                              <strong>{c.progress}%</strong>
                            </div>
                          ))}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="ul-edu-table ul-rhp-lastleft">
              <thead><tr><th>Teacher</th><th>Students</th><th>Courses</th><th style={{ minWidth: 180 }}>Engagement</th><th>Last active</th><th>Status</th></tr></thead>
              <tbody>
                {tRows.length === 0 && <tr><td colSpan={6} style={{ padding: 24 }}>No teachers match.</td></tr>}
                {tRows.map((t) => (
                  <tr key={t.id}>
                    <td><strong>{t.name}</strong><span className="ul-rhp-sub">{t.id} · {(t.subjects || []).join(", ")}</span></td>
                    <td>{t.students || "—"}</td>
                    <td>{t.courses || "—"}</td>
                    <td><Bar value={t.engagement || 0} /></td>
                    <td>{t.lastActive}</td>
                    <td style={{ whiteSpace: "normal" }}>
                      {t.attention
                        ? <><span className="ul-status-badge is-rejected">Needs attention</span><span className="ul-rhp-sub">{t.attentionReason}</span></>
                        : <span className="ul-status-badge is-approved">Active</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
