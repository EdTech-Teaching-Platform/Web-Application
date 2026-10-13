import { useMemo, useState } from "react";
import { useRegionHead } from "../hooks/useRegionHead";
import { PERSON_LABEL, fmtDateTime } from "../../admin/data/regionalPortalMock";
import "../../admin/pages/AdminDashboard.css";
import "../../admin/pages/EducatorVerification.css";

const KIND_LABEL = { onboarding: "Onboarding", query: "Query", escalation: "Escalation" };
const ADMIN_ACTION = /admin|escalated|returned/i;

// One timeline for the whole region: onboarding, query handling and escalations,
// for both students and teachers.
export default function RHHistory() {
  const { region, data } = useRegionHead();
  const [q, setQ] = useState("");
  const [person, setPerson] = useState("all");
  const [kind, setKind] = useState("all");

  const events = useMemo(() => {
    const out = [];
    [...data.students.filter((s) => s.onboardedByHead).map((s) => ({ ...s, type: "student" })), ...data.teachers.map((t) => ({ ...t, type: "teacher" }))]
      .filter((p) => p.onboardedAt)
      .forEach((p) => out.push({
        id: `onb-${p.id}`, at: new Date(`${p.onboardedAt}T12:00:00`).toISOString(), kind: "onboarding", type: p.type,
        who: p.name, ref: p.id, action: "Onboarded", by: "Regional Head", note: p.type === "student" ? p.grade || "" : (p.subjects || []).join(", "),
      }));
    data.queries.forEach((x) => x.history.forEach((h, i) => {
      if (i > 0 && ADMIN_ACTION.test(h.action)) return; // shown under the escalation instead
      out.push({ id: `q-${x.id}-${i}`, at: h.at, kind: "query", type: x.personType || "student", who: x.studentName, ref: x.id, action: h.action, by: h.by, note: h.note || x.subject });
    }));
    data.escalations.forEach((e) => e.history.forEach((h, i) => {
      out.push({ id: `e-${e.id}-${i}`, at: h.at, kind: "escalation", type: e.personType || "student", who: e.studentName, ref: e.id, action: h.action, by: `${h.by}${h.role ? ` (${h.role})` : ""}`, note: h.note });
    }));
    return out.sort((a, b) => new Date(b.at) - new Date(a.at));
  }, [data]);

  const rows = events.filter((e) => (person === "all" || e.type === person) && (kind === "all" || e.kind === kind)
    && (!q.trim() || `${e.who} ${e.ref} ${e.action} ${e.note}`.toLowerCase().includes(q.trim().toLowerCase())));

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">History</h2>
          <p className="ul-edu-header__subtitle">Everything that happened for students and teachers in {region}: onboarding, queries and escalations.</p>
        </div>
      </div>

      <div className="ul-rhp-toolbar">
        <input placeholder="Search name, ID or note" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={person} onChange={(e) => setPerson(e.target.value)}>
          <option value="all">Students &amp; teachers</option>
          <option value="student">Students only</option>
          <option value="teacher">Teachers only</option>
        </select>
        <select value={kind} onChange={(e) => setKind(e.target.value)}>
          <option value="all">All activity</option>
          {Object.entries(KIND_LABEL).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>

      <div className="ul-card ul-edu-table-card"><div className="ul-rhp-table-wrap">
        <table className="ul-edu-table ul-rhp-lastleft">
          <thead><tr><th>When</th><th>Person</th><th>Activity</th><th>By</th><th>Details</th></tr></thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={{ padding: 24 }}>No history matches.</td></tr>}
            {rows.map((e) => (
              <tr key={e.id}>
                <td style={{ whiteSpace: "nowrap" }}>{fmtDateTime(e.at)}</td>
                <td><strong>{e.who}</strong><span className="ul-rhp-sub">{PERSON_LABEL[e.type]} · {e.ref}</span></td>
                <td><span className="ul-status-badge is-verified">{KIND_LABEL[e.kind]}</span><span className="ul-rhp-sub">{e.action}</span></td>
                <td>{e.by}</td>
                <td style={{ whiteSpace: "normal", maxWidth: 320 }}>{e.note || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div></div>
    </div>
  );
}
