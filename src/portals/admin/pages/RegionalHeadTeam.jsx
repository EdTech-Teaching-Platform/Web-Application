// "Students & teachers onboarded by <Regional Head>" — opened from the
// Manage Regional Heads table. Lists the students and teachers the head
// brought onto the platform, and tracks how active they are.
// All data is live
// from Student / Educator Management (see data/regionalOnboardingMock.js).

import { useState } from "react";
import { useRegionalOnboarding, fmtDate } from "../data/regionalOnboardingMock";
import { Modal, Tabs } from "./discounts/DiscountsShared";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./RegionalHeads.css";

function Sum({ label, value, warn }) {
  return <span className={warn ? "is-warn" : ""}><strong>{value}</strong> {label}</span>;
}

export default function RegionalHeadTeam({ head, onClose }) {
  const { forHead } = useRegionalOnboarding();
  const data = forHead(head.id);
  const [tab, setTab] = useState("students");
  return (
    <Modal wide hideClose title={`Onboarded by ${head.name}`} subtitle={`${head.region} · Regional Head`} onClose={onClose}
      footer={<button type="button" className="ul-btn ul-btn--primary" onClick={onClose}>Close</button>}>
      <div className="ul-rh-studentsum">
        <Sum label="students" value={data.students.length} />
        <Sum label="teachers" value={data.teachers.length} />
        <Sum label="students active" value={data.activeStudents} />
        <Sum label="teachers active" value={data.activeTeachers} />
        <Sum label="need attention" value={data.attention} warn={data.attention > 0} />
      </div>
      <p className="ul-rh-sub" style={{ marginBottom: 12 }}>Activity comes from Student and Educator Management. “Needs attention” means blocked or suspended, unverified, or inactive for 14+ days.</p>

      <div className="ul-dsc-tabs">
        <Tabs value={tab} onChange={setTab} tabs={[{ key: "students", label: `Students (${data.students.length})` }, { key: "teachers", label: `Teachers (${data.teachers.length})` }]} />
      </div>

      {tab === "students" && (data.students.length === 0 ? <p className="ul-rh-sub">No students onboarded by this Regional Head yet.</p> : (
        <div className="ul-edu-table-scroll">
          <table className="ul-edu-table">
            <thead><tr><th>Student</th><th>Grade</th><th>Onboarded</th><th>Last active</th><th>Courses</th><th>Avg progress</th><th>Status</th></tr></thead>
            <tbody>
              {[...data.students].sort((a, b) => b.onboardedAt.localeCompare(a.onboardedAt)).map((r) => (
                <tr key={r.id}>
                  <td><span className="ul-rh-strong">{r.name}</span><span className="ul-rh-sub">{r.personId}</span></td>
                  <td>{r.grade || "—"}</td>
                  <td>{fmtDate(r.onboardedAt)}</td>
                  <td>{r.lastActive}</td>
                  <td>{r.courses}</td>
                  <td>{r.courses ? `${r.progress}%` : "—"}</td>
                  <td>{r.attention ? <><span className="ul-status-badge is-rejected">Needs attention</span><span className="ul-rh-sub">{r.attentionReason}</span></> : <span className="ul-status-badge is-approved">Active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}

      {tab === "teachers" && (data.teachers.length === 0 ? <p className="ul-rh-sub">No teachers onboarded by this Regional Head yet.</p> : (
        <div className="ul-edu-table-scroll">
          <table className="ul-edu-table">
            <thead><tr><th>Teacher</th><th>Subjects</th><th>Onboarded</th><th>Last active</th><th>Students</th><th>Courses</th><th>Verification</th><th>Status</th></tr></thead>
            <tbody>
              {[...data.teachers].sort((a, b) => b.onboardedAt.localeCompare(a.onboardedAt)).map((r) => (
                <tr key={r.id}>
                  <td><span className="ul-rh-strong">{r.name}</span><span className="ul-rh-sub">{r.personId}</span></td>
                  <td>{r.subjects.join(", ") || "—"}</td>
                  <td>{fmtDate(r.onboardedAt)}</td>
                  <td>{r.lastActive}</td>
                  <td>{r.students}</td>
                  <td>{r.courses}</td>
                  <td style={{ textTransform: "capitalize" }}>{String(r.verificationStatus || "—").replace("_", " ")}</td>
                  <td>{r.attention ? <><span className="ul-status-badge is-rejected">Needs attention</span><span className="ul-rh-sub">{r.attentionReason}</span></> : <span className="ul-status-badge is-approved">Active</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </Modal>
  );
}
