import { useMemo, useState } from "react";
import { useRegionHead } from "../hooks/useRegionHead";
import { useStudents, GRADE_OPTIONS } from "../../admin/data/studentsMock";
import { useEducators } from "../../admin/data/educatorsMock";
import { SUBJECT_OPTIONS } from "../../admin/data/testSeriesMock";
import { onboardStudent, onboardTeacher, validateStudent, validateTeacher, fmtDate } from "../../admin/data/regionalOnboardingMock";
import { logRegionActivity } from "../../admin/data/regionalPortalMock";
import { Tabs } from "../../admin/pages/discounts/DiscountsShared";
import "../../admin/pages/AdminDashboard.css";
import "../../admin/pages/EducatorVerification.css";

const EMPTY_S = { name: "", email: "", phone: "", grade: "" };
const EMPTY_T = { firstName: "", lastName: "", email: "", phone: "", subject: "", qualification: "", years: "" };

export default function RHOnboarding() {
  const { head, region, data } = useRegionHead();
  const [hq, setHq] = useState("");
  const [hType, setHType] = useState("all");
  const allStudents = useStudents();
  const allEducators = useEducators();
  const [kind, setKind] = useState("student");
  const [sForm, setSForm] = useState(EMPTY_S);
  const [tForm, setTForm] = useState(EMPTY_T);
  const [touched, setTouched] = useState({});
  const [done, setDone] = useState("");
  const [serverErr, setServerErr] = useState("");

  const isStudent = kind !== "teacher";
  const isHistory = kind === "history";
  const form = isStudent ? sForm : tForm;
  const errors = useMemo(
    () => (isStudent ? validateStudent(sForm, { students: allStudents }) : validateTeacher(tForm, { educators: allEducators })),
    [isStudent, sForm, tForm, allStudents, allEducators],
  );
  const errFor = (re) => errors.find((e) => re.test(e));
  const set = (k, v) => { (isStudent ? setSForm : setTForm)((f) => ({ ...f, [k]: v })); setDone(""); setServerErr(""); };
  const blur = (k) => setTouched((t) => ({ ...t, [k]: true }));
  const showErr = (k, re) => touched[k] && errFor(re) && <p className="ul-rhp-err">{errFor(re)}</p>;
  const switchKind = (k) => { setKind(k); setTouched({}); setDone(""); setServerErr(""); };

  const submit = (e) => {
    e.preventDefault();
    if (errors.length) { setTouched({ name: true, firstName: true, lastName: true, email: true, grade: true, subject: true, qualification: true }); return; }
    if (isStudent) {
      const res = onboardStudent(head.id, { ...sForm, name: sForm.name.trim(), city: region }, { students: allStudents });
      if (!res.ok) { setServerErr(res.errors.join(" ")); return; }
      logRegionActivity(region, "onboarding", `Onboarded student ${res.person.name}`);
      setDone(`${res.person.name} was onboarded to ${region} (${res.person.id}).`);
      setSForm(EMPTY_S);
    } else {
      const res = onboardTeacher(head.id, tForm, { educators: allEducators });
      if (!res.ok) { setServerErr(res.errors.join(" ")); return; }
      logRegionActivity(region, "onboarding", `Onboarded teacher ${res.person.name}`);
      setDone(`${res.person.name} was onboarded (${res.person.id}). Their verification stays pending until Admin verifies them.`);
      setTForm(EMPTY_T);
    }
    setTouched({});
  };

  const history = useMemo(() => [
    ...data.students.filter((s) => s.onboardedByHead).map((s) => ({ ...s, type: "student", attention: s.blocked || s.inactive, attentionReason: s.blocked ? "Account blocked" : s.inactive ? `Inactive ${s.lastActive}` : "" })),
    ...data.teachers.map((t) => ({ ...t, type: "teacher" })),
  ]
    .filter((p) => (hType === "all" || p.type === hType) && (!hq.trim() || `${p.name} ${p.id}`.toLowerCase().includes(hq.trim().toLowerCase())))
    .sort((a, b) => String(b.onboardedAt).localeCompare(String(a.onboardedAt))), [data, hq, hType]);

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Onboarding</h2>
          <p className="ul-edu-header__subtitle">Bring students and teachers onto the platform for {region}. They appear in Admin's management screens right away.</p>
        </div>
      </div>

      <Tabs value={kind} onChange={switchKind} tabs={[{ key: "student", label: "Student" }, { key: "teacher", label: "Teacher" }, { key: "history", label: "History" }]} />
      <div style={{ height: 12 }} />

      {!isHistory && <div className="ul-rhp-panel" style={{ marginBottom: 16 }}>
        {done && <div className="ul-rhp-ok" role="status">{done}</div>}
        <form className="ul-rhp-form" onSubmit={submit} noValidate>
          {isStudent ? (
            <>
              <div className="ul-rhp-field">
                <label htmlFor="ob-name">Full name</label>
                <input id="ob-name" value={form.name} onChange={(e) => set("name", e.target.value)} onBlur={() => blur("name")} placeholder="Student's full name" />
                {showErr("name", /name/i)}
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="ob-email">Email</label>
                <input id="ob-email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={() => blur("email")} placeholder="student@example.com" />
                {showErr("email", /email/i)}
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="ob-phone">Phone (optional)</label>
                <input id="ob-phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" />
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="ob-grade">Grade</label>
                <select id="ob-grade" value={form.grade} onChange={(e) => set("grade", e.target.value)} onBlur={() => blur("grade")}>
                  <option value="">Select grade</option>
                  {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                </select>
                {showErr("grade", /grade/i)}
              </div>
            </>
          ) : (
            <>
              <div className="ul-rhp-field">
                <label htmlFor="ob-first">First name</label>
                <input id="ob-first" value={form.firstName} onChange={(e) => set("firstName", e.target.value)} onBlur={() => blur("firstName")} />
                {showErr("firstName", /first name/i)}
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="ob-last">Last name</label>
                <input id="ob-last" value={form.lastName} onChange={(e) => set("lastName", e.target.value)} onBlur={() => blur("lastName")} />
                {showErr("lastName", /last name/i)}
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="ob-temail">Email</label>
                <input id="ob-temail" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} onBlur={() => blur("email")} placeholder="teacher@example.com" />
                {showErr("email", /email/i)}
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="ob-tphone">Phone (optional)</label>
                <input id="ob-tphone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="+91 …" />
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="ob-subject">Subject</label>
                <select id="ob-subject" value={form.subject} onChange={(e) => set("subject", e.target.value)} onBlur={() => blur("subject")}>
                  <option value="">Select subject</option>
                  {SUBJECT_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                </select>
                {showErr("subject", /subject/i)}
              </div>
              <div className="ul-rhp-field">
                <label htmlFor="ob-years">Years of experience (optional)</label>
                <input id="ob-years" type="number" min="0" value={form.years} onChange={(e) => set("years", e.target.value)} />
              </div>
              <div className="ul-rhp-field is-wide">
                <label htmlFor="ob-qual">Qualification</label>
                <input id="ob-qual" value={form.qualification} onChange={(e) => set("qualification", e.target.value)} onBlur={() => blur("qualification")} placeholder="e.g. M.Sc. in Physics" />
                {showErr("qualification", /qualification/i)}
              </div>
            </>
          )}
          <div className="ul-rhp-field">
            <label htmlFor="ob-region">Region</label>
            <input id="ob-region" value={region} disabled />
          </div>
          <div className="ul-rhp-field" style={{ display: "flex", alignItems: "flex-end" }}>
            <button type="submit" className="ul-btn ul-btn--primary" disabled={errors.length > 0}>{isStudent ? "Onboard student" : "Onboard teacher"}</button>
          </div>
          {serverErr && <p className="ul-rhp-err is-wide">{serverErr}</p>}
        </form>
      </div>}

      {isHistory && (
        <>
          <div className="ul-rhp-toolbar">
            <input placeholder="Search name or ID" value={hq} onChange={(e) => setHq(e.target.value)} />
            <select value={hType} onChange={(e) => setHType(e.target.value)}>
              <option value="all">Students &amp; teachers</option>
              <option value="student">Students only</option>
              <option value="teacher">Teachers only</option>
            </select>
          </div>
          <div className="ul-card ul-edu-table-card"><div className="ul-rhp-table-wrap">
            <table className="ul-edu-table ul-rhp-lastleft">
              <thead><tr><th>Onboarded</th><th>Person</th><th>Type</th><th>Grade / Subjects</th><th>Last active</th><th>Status</th></tr></thead>
              <tbody>
                {history.length === 0 && <tr><td colSpan={6} style={{ padding: 24 }}>No onboarding history yet.</td></tr>}
                {history.map((p) => (
                  <tr key={`${p.type}-${p.id}`}>
                    <td style={{ whiteSpace: "nowrap" }}>{fmtDate(p.onboardedAt)}</td>
                    <td><strong>{p.name}</strong><span className="ul-rhp-sub">{p.id} · {p.email}</span></td>
                    <td>{p.type === "student" ? "Student" : "Teacher"}</td>
                    <td>{p.type === "student" ? (p.grade || "—") : ((p.subjects || []).join(", ") || "—")}</td>
                    <td>{p.lastActive}</td>
                    <td>{p.attention ? <><span className="ul-status-badge is-rejected">Needs attention</span><span className="ul-rhp-sub">{p.attentionReason}</span></> : <span className="ul-status-badge is-approved">Active</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div></div>
        </>
      )}
    </div>
  );
}
