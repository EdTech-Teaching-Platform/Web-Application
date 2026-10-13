import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useRegionHead } from "../hooks/useRegionHead";
import { fmtDate } from "../../admin/data/regionalOnboardingMock";
import { Modal, Tabs } from "../../admin/pages/discounts/DiscountsShared";
import { QUERY_STATUS_LABEL } from "../../admin/data/regionalPortalMock";
import "../../admin/pages/AdminDashboard.css";
import "../../admin/pages/EducatorVerification.css";

const FILTERS = [
  { key: "all", label: "All students" },
  { key: "active", label: "Active" },
  { key: "attention", label: "Needs attention" },
  { key: "mine", label: "Onboarded by me" },
];

export default function RHStudents() {
  const { region, data } = useRegionHead();
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("all");
  const [openId, setOpenId] = useState(null);
  const [kind, setKind] = useState("student");
  const isStudent = kind === "student";
  const switchKind = (k) => { setKind(k); setQ(""); setFilter("all"); setOpenId(null); };

  const people = isStudent ? data.students : data.teachers;
  const rows = useMemo(() => people.filter((s) => {
    const text = `${s.name} ${s.email} ${s.id} ${(s.subjects || []).join(" ")}`.toLowerCase();
    if (q.trim() && !text.includes(q.trim().toLowerCase())) return false;
    if (filter === "active") return !s.blocked && !s.inactive;
    if (filter === "attention") return s.blocked || s.inactive || s.openQueries > 0;
    if (filter === "mine") return s.onboardedByHead;
    return true;
  }), [people, q, filter]);

  const open = people.find((s) => s.id === openId) || null;
  const studentQueries = open ? data.queries.filter((x) => x.studentId === open.id) : [];

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Manage People</h2>
          <p className="ul-edu-header__subtitle">Students and teachers in {region}. Blocking, suspending or verifying accounts is done by Admin, so escalate those cases.</p>
        </div>
      </div>

      <Tabs value={kind} onChange={switchKind} tabs={[{ key: "student", label: `Students (${data.students.length})` }, { key: "teacher", label: `Teachers (${data.teachers.length})` }]} />
      <div style={{ height: 12 }} />
      <div className="ul-rhp-toolbar">
        <input placeholder={isStudent ? "Search by name, email or ID" : "Search by name, email, subject or ID"} value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          {FILTERS.map((f) => <option key={f.key} value={f.key}>{f.label}</option>)}
        </select>
      </div>

      <div className="ul-card ul-edu-table-card">
        <div className="ul-rhp-table-wrap">
          <table className="ul-edu-table">
            <thead>
              {isStudent
                ? <tr><th>Student</th><th>Grade</th><th>Onboarded</th><th>Last active</th><th>Status</th><th>Open queries</th><th aria-label="Details" /></tr>
                : <tr><th>Teacher</th><th>Subjects</th><th>Onboarded</th><th>Last active</th><th>Status</th><th>Open queries</th><th aria-label="Details" /></tr>}
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={7} style={{ padding: 24 }}>Nobody matches.</td></tr>}
              {rows.map((s) => (
                <tr key={s.id} className="ul-edu-row--clickable" onClick={() => setOpenId(s.id)}>
                  <td><strong>{s.name}</strong><span className="ul-rhp-sub">{s.id} · {s.email}</span></td>
                  <td>{isStudent ? (s.grade || "—") : ((s.subjects || []).join(", ") || "—")}</td>
                  <td>{s.onboardedAt ? fmtDate(s.onboardedAt) : <span className="ul-rhp-sub">Joined directly</span>}</td>
                  <td>{s.lastActive}</td>
                  <td>{s.blocked ? <span className="ul-status-badge is-rejected">{isStudent ? "Blocked" : String(s.accountStatus || "inactive").replace(/^./, (c) => c.toUpperCase())}</span> : s.inactive ? <span className="ul-status-badge is-pending">Inactive</span> : <span className="ul-status-badge is-approved">Active</span>}</td>
                  <td>{s.openQueries || "—"}</td>
                  <td><button type="button" className="ul-btn ul-btn--ghost" onClick={(e) => { e.stopPropagation(); setOpenId(s.id); }}>View</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {open && (
        <Modal title={open.name} subtitle={`${open.id} · ${region}`} onClose={() => setOpenId(null)} hideClose
          footer={<><Link className="ul-btn ul-btn--ghost" to="/regionalhead/queries">Open Query Resolution</Link><button type="button" className="ul-btn ul-btn--primary" onClick={() => setOpenId(null)}>Close</button></>}>
          {isStudent ? (
            <ul className="ul-rhp-list">
              <li><span>Email</span><strong>{open.email}</strong></li>
              <li><span>Phone</span><strong>{open.phone || "—"}</strong></li>
              <li><span>Grade</span><strong>{open.grade || "—"}</strong></li>
              <li><span>City</span><strong>{open.city || "—"}</strong></li>
              <li><span>Registered</span><strong>{open.registeredDate}</strong></li>
              <li><span>Last active</span><strong>{open.lastActive}</strong></li>
              <li><span>Account</span><strong>{open.blocked ? `Blocked${open.blockedReason ? ` — ${open.blockedReason}` : ""}` : "Active"}</strong></li>
            </ul>
          ) : (
            <ul className="ul-rhp-list">
              <li><span>Email</span><strong>{open.email}</strong></li>
              <li><span>Phone</span><strong>{open.phone || "—"}</strong></li>
              <li><span>Subjects</span><strong>{(open.subjects || []).join(", ") || "—"}</strong></li>
              <li><span>Qualification</span><strong>{open.qualification || "—"}</strong></li>
              <li><span>Experience</span><strong>{open.years ? `${open.years} years` : "—"}</strong></li>
              <li><span>Onboarded</span><strong>{fmtDate(open.onboardedAt)}</strong></li>
              <li><span>Last active</span><strong>{open.lastActive}</strong></li>
              <li><span>Account</span><strong>{String(open.accountStatus).replace(/^./, (c) => c.toUpperCase())}</strong></li>
              <li><span>Verification</span><strong>{String(open.verificationStatus || "—").replace(/_/g, " ")}</strong></li>
              <li><span>Students · Courses</span><strong>{open.students} · {open.courses}</strong></li>
            </ul>
          )}
          <h4 style={{ margin: "16px 0 8px" }}>Queries</h4>
          {studentQueries.length === 0 ? <p>No queries from this student.</p> : (
            <ul className="ul-rhp-list">
              {studentQueries.map((x) => <li key={x.id}><span>{x.subject}</span><small>{QUERY_STATUS_LABEL[x.status]}</small></li>)}
            </ul>
          )}
        </Modal>
      )}
    </div>
  );
}
