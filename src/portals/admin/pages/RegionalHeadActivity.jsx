// "Activity Tracking" section of Manage Regional Heads: pick any student or
// teacher onboarded by a Regional Head and see how they are doing — last
// active, account status, course progress (students) or their students,
// courses and engagement (teachers). Everything is read live from Student
// and Educator Management through data/regionalOnboardingMock.js.

import { useMemo, useState } from "react";
import { IconSearch, IconClose } from "../components/icons";
import { useStudents, STUDENT_STATUS } from "../data/studentsMock";
import { useEducators } from "../data/educatorsMock";
import { useRegionalState } from "../data/regionalHeadsMock";
import { useRegionalOnboarding, fmtDate } from "../data/regionalOnboardingMock";
import { Modal, Tabs, Pager, pageSlice } from "./discounts/DiscountsShared";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./EducatorProfile.css";
import "./RegionalHeads.css";

const PAGE_SIZE = 8;
const LABEL = (v) => String(v || "—").replace(/_/g, " ");

function Field({ label, children }) {
  return (
    <div className="ul-rh-fact">
      <span className="ul-rh-fact__label">{label}</span>
      <span className="ul-rh-fact__value">{children}</span>
    </div>
  );
}

function Progress({ value }) {
  return (
    <div className="ul-edp-progress">
      <div className="ul-edp-progress__track"><div className="ul-edp-progress__fill" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>
      <span>{value}%</span>
    </div>
  );
}

function StudentDetail({ row, student, head, onClose }) {
  const courses = student ? student.enrolledCourses || [] : [];
  return (
    <Modal wide hideClose title={row.name} subtitle="Student activity" onClose={onClose}
      footer={<button type="button" className="ul-btn ul-btn--primary" onClick={onClose}>Close</button>}>
      {!student ? <p className="ul-rh-sub">This student account no longer exists in Student Management.</p> : (
        <>
          <div className="ul-rh-facts">
            <Field label="Onboarded by">{head ? `${head.name} (${head.region})` : "Former Regional Head"}</Field>
            <Field label="Onboarded on">{fmtDate(row.onboardedAt)}</Field>
            <Field label="Last active">{student.lastActive}</Field>
            <Field label="Account">{student.status === STUDENT_STATUS.BLOCKED ? <span className="ul-status-badge is-account-suspended">Blocked</span> : <span className="ul-status-badge is-account-active">Active</span>}</Field>
            <Field label="Grade">{student.grade || "—"}</Field>
            <Field label="City">{student.city || "—"}</Field>
            <Field label="Email">{student.email}</Field>
            <Field label="Registered">{student.registeredDate}</Field>
          </div>
          {student.status === STUDENT_STATUS.BLOCKED && student.blockedReason && (
            <div className="ul-ts-errors"><strong>Blocked:</strong> {student.blockedReason}</div>
          )}
          <h4 className="ul-rh-h4">Course progress</h4>
          {courses.length === 0 ? <p className="ul-rh-sub">Not enrolled in any course yet.</p> : (
            <div className="ul-edu-table-scroll">
              <table className="ul-edu-table">
                <thead><tr><th>Course</th><th style={{ width: "40%" }}>Progress</th></tr></thead>
                <tbody>{courses.map((c) => <tr key={c.title}><td>{c.title}</td><td><Progress value={c.progress || 0} /></td></tr>)}</tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

function TeacherDetail({ row, teacher, head, onClose }) {
  const p = teacher ? teacher.performance || {} : {};
  return (
    <Modal wide hideClose title={row.name} subtitle="Teacher activity" onClose={onClose}
      footer={<button type="button" className="ul-btn ul-btn--primary" onClick={onClose}>Close</button>}>
      {!teacher ? <p className="ul-rh-sub">This teacher account no longer exists in Educator Management.</p> : (
        <>
          <div className="ul-rh-facts">
            <Field label="Onboarded by">{head ? `${head.name} (${head.region})` : "Former Regional Head"}</Field>
            <Field label="Onboarded on">{fmtDate(row.onboardedAt)}</Field>
            <Field label="Last active">{teacher.lastActive}</Field>
            <Field label="Account"><span className={`ul-status-badge ${teacher.accountStatus === "active" ? "is-account-active" : "is-account-suspended"}`}>{LABEL(teacher.accountStatus)}</span></Field>
            <Field label="Verification"><span style={{ textTransform: "capitalize" }}>{LABEL(teacher.verificationStatus)}</span></Field>
            <Field label="Subjects">{(teacher.subjects || []).join(", ") || "—"}</Field>
            <Field label="Rating">{teacher.rating ? `${teacher.rating} / 5` : "—"}</Field>
            <Field label="Email">{teacher.email}</Field>
          </div>

          <div className="ul-rh-studentsum">
            <span><strong>{p.totalStudents || 0}</strong> students</span>
            <span><strong>{p.activeStudents || 0}</strong> active</span>
            <span><strong>{p.completedStudents || 0}</strong> completed</span>
            <span className={p.atRiskStudents ? "is-warn" : ""}><strong>{p.atRiskStudents || 0}</strong> at risk / inactive</span>
            <span><strong>{p.sessionsConducted || 0}</strong> sessions</span>
            <span><strong>{p.engagementScore || 0}</strong> engagement</span>
            <span><strong>{p.assignmentCompletionRate || 0}%</strong> assignments done</span>
          </div>

          <h4 className="ul-rh-h4">Courses</h4>
          {(teacher.courses || []).length === 0 ? <p className="ul-rh-sub">No courses yet.</p> : (
            <div className="ul-edu-table-scroll">
              <table className="ul-edu-table">
                <thead><tr><th>Course</th><th>Students</th><th>Completion rate</th><th>Avg score</th><th>Rating</th></tr></thead>
                <tbody>{teacher.courses.map((c) => <tr key={c.id}><td>{c.title}</td><td>{c.students}</td><td>{c.completionRate}%</td><td>{c.avgScore}</td><td>{c.rating || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          )}

          <h4 className="ul-rh-h4">Their students</h4>
          {(teacher.students || []).length === 0 ? <p className="ul-rh-sub">No students yet.</p> : (
            <div className="ul-edu-table-scroll">
              <table className="ul-edu-table">
                <thead><tr><th>Student</th><th>Course</th><th style={{ width: "26%" }}>Progress</th><th>Last active</th><th>Status</th></tr></thead>
                <tbody>
                  {teacher.students.map((s) => (
                    <tr key={s.id}><td>{s.name}</td><td>{s.course}</td><td><Progress value={s.progress} /></td><td>{s.lastActive}</td><td style={{ textTransform: "capitalize" }}>{LABEL(s.status)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </Modal>
  );
}

export default function RegionalHeadActivity() {
  const { studentRows, teacherRows } = useRegionalOnboarding();
  const students = useStudents();
  const educators = useEducators();
  const regional = useRegionalState();
  const [kind, setKind] = useState("students");
  const [search, setSearch] = useState("");
  const [headId, setHeadId] = useState("all");
  const [status, setStatus] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);

  const headOf = (id) => regional.heads.find((h) => h.id === id) || null;
  const base = kind === "students" ? studentRows : teacherRows;
  const q = search.trim().toLowerCase();
  const list = useMemo(() => base.filter((r) =>
    (headId === "all" || r.headId === headId)
    && (status === "all" || (status === "attention" ? r.attention : !r.attention))
    && (!q || r.name.toLowerCase().includes(q) || r.email.toLowerCase().includes(q) || r.personId.toLowerCase().includes(q)))
    .sort((a, b) => Number(b.attention) - Number(a.attention) || a.name.localeCompare(b.name)), [base, headId, status, q]);

  const reset = () => setPage(1);
  const heads = regional.heads.filter((h) => h.status === "active" || base.some((r) => r.headId === h.id));
  const openRow = open ? base.find((r) => r.id === open) : null;

  return (
    <div>
      <div className="ul-dsc-tabs">
        <Tabs value={kind} onChange={(k) => { setKind(k); setPage(1); setOpen(null); }} tabs={[{ key: "students", label: `Students (${studentRows.length})` }, { key: "teachers", label: `Teachers (${teacherRows.length})` }]} />
      </div>
      <div className="ul-edu-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input type="text" placeholder={`Search ${kind === "students" ? "student" : "teacher"} by name, email or ID…`} value={search} onChange={(e) => { setSearch(e.target.value); reset(); }} />
          {search && <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search"><IconClose size={12} /></button>}
        </label>
        <select className="ul-edu-select" value={headId} onChange={(e) => { setHeadId(e.target.value); reset(); }}>
          <option value="all">Onboarded by: All</option>
          {heads.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.region}</option>)}
        </select>
        <select className="ul-edu-select" value={status} onChange={(e) => { setStatus(e.target.value); reset(); }}>
          <option value="all">Activity: All</option>
          <option value="attention">Needs attention</option>
          <option value="ok">Active / on track</option>
        </select>
      </div>

      <div className="ul-card ul-edu-table-card">
        {list.length === 0 ? <div className="ul-edu-empty">No {kind} match these filters.</div> : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-rh-acttable">
              <thead>
                <tr>
                  <th>{kind === "students" ? "Student" : "Teacher"}</th><th>Onboarded by</th><th>Onboarded</th><th>Last active</th>
                  <th>{kind === "students" ? "Courses · progress" : "Students · courses"}</th><th>Status</th><th aria-label="Details" />
                </tr>
              </thead>
              <tbody>
                {pageSlice(list, page, PAGE_SIZE).map((r) => {
                  const h = headOf(r.headId);
                  return (
                    <tr key={r.id} className="ul-edu-row--clickable" onClick={() => setOpen(r.id)}>
                      <td><span className="ul-rh-strong">{r.name}</span><span className="ul-rh-sub">{r.personId}</span></td>
                      <td>{h ? h.name : "Former head"}{h && <span className="ul-rh-sub">{h.region}</span>}</td>
                      <td>{fmtDate(r.onboardedAt)}</td>
                      <td>{r.lastActive}</td>
                      <td>{kind === "students" ? (r.courses ? `${r.courses} · ${r.progress}%` : "—") : `${r.students} · ${r.courses}`}</td>
                      <td>{r.attention ? <><span className="ul-status-badge is-rejected">Needs attention</span><span className="ul-rh-sub">{r.attentionReason}</span></> : <span className="ul-status-badge is-approved">Active</span>}</td>
                      <td><button type="button" className="ul-btn ul-btn--ghost" onClick={(e) => { e.stopPropagation(); setOpen(r.id); }}>View activity</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} setPage={setPage} total={list.length} size={PAGE_SIZE} />
      </div>

      {openRow && kind === "students" && <StudentDetail row={openRow} student={students.find((s) => s.id === openRow.personId)} head={headOf(openRow.headId)} onClose={() => setOpen(null)} />}
      {openRow && kind === "teachers" && <TeacherDetail row={openRow} teacher={educators.find((e) => e.id === openRow.personId)} head={headOf(openRow.headId)} onClose={() => setOpen(null)} />}
    </div>
  );
}
