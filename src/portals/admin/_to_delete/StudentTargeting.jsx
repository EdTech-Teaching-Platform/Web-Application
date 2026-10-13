// Student targeting & distribution, plus a "record a purchase" tool that runs
// the real redemption engine (there is no student checkout in the Admin portal).
import { useMemo, useState } from "react";
import { useStudents } from "../../data/studentsMock";
import { useCourses } from "../../data/coursesMock";
import {
  useDiscountState, effectiveStatus, matchGroup, describeGroup, assignCoupons, assignmentStatus, sendExpiryReminders,
  validateCoupons, redeemCoupons, getCatalog, studentStats, studentRegion, GROUP_RULES_UNAVAILABLE, inr,
} from "../../data/discountsMock";
import { PageHeader, Tabs, useActor, useToast, fmtDate, fmtDateTime } from "./DiscountsShared";
import { IconSearch } from "../../components/icons";

const emptyRules = { minAvgProgress: "", completedAny: false, enrolledInCourses: [], newWithinDays: "", inactiveForDays: "", neverPurchased: false, minPurchases: "", regions: [], grades: [] };
const PRESETS = [
  { label: "High performers", rules: { minAvgProgress: 60 } },
  { label: "New students (30 days)", rules: { newWithinDays: 30 } },
  { label: "Inactive (14+ days)", rules: { inactiveForDays: 14 } },
  { label: "Never purchased", rules: { neverPurchased: true } },
  { label: "Loyal (2+ purchases)", rules: { minPurchases: 2 } },
];
const cleanRules = (r) => Object.fromEntries(Object.entries(r).filter(([, v]) => (Array.isArray(v) ? v.length : v !== "" && v !== false && v != null)));

export default function StudentTargeting() {
  const st = useDiscountState();
  const students = useStudents();
  const courses = useCourses();
  const actor = useActor();
  const [, setToast, toastEl] = useToast();
  const [tab, setTab] = useState("assign");

  const usable = st.campaigns.filter((c) => !["archived", "expired", "exhausted"].includes(effectiveStatus(c, st)));
  /* ---- assign ---- */
  const [campaignId, setCampaignId] = useState("");
  const [mode, setMode] = useState("individual");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState([]);
  const [rules, setRules] = useState(emptyRules);
  const [notify, setNotify] = useState(true);
  const [summary, setSummary] = useState(null);
  const campaign = st.campaigns.find((c) => c.id === campaignId) || null;

  const groupMatches = useMemo(() => matchGroup(cleanRules(rules), students, st), [rules, students, st]);
  const found = q.trim() ? students.filter((s) => `${s.name} ${s.email} ${s.id}`.toLowerCase().includes(q.trim().toLowerCase())).slice(0, 8) : [];
  const regionOptions = useMemo(() => [...new Set(students.map(studentRegion).filter(Boolean))].sort(), [students]);
  const gradeOptions = useMemo(() => [...new Set(students.map((s) => s.grade).filter(Boolean))].sort(), [students]);
  const courseTitles = useMemo(() => [...new Set(courses.map((c) => c.title))], [courses]);
  const targets = mode === "individual" ? students.filter((s) => picked.includes(s.id)) : groupMatches;
  const already = (sid) => st.assignments.some((a) => a.campaignId === campaignId && a.studentId === sid);
  const toggleArr = (key, v) => setRules((r) => ({ ...r, [key]: r[key].includes(v) ? r[key].filter((x) => x !== v) : [...r[key], v] }));

  const doAssign = () => {
    if (!campaign) { setToast("Choose a discount first."); return; }
    if (!targets.length) { setToast("No students selected."); return; }
    const r = assignCoupons({ campaignId, studentIds: targets.map((s) => s.id), notify, actor });
    if (!r.ok) { setToast(r.error); return; }
    setSummary(r);
    setPicked([]);
    setToast(`${r.assigned.length} coupon(s) assigned${notify ? " and notifications queued" : ""}.`);
  };

  /* ---- student coupons ---- */
  const [sq, setSq] = useState("");
  const [viewId, setViewId] = useState("");
  const sFound = sq.trim() ? students.filter((s) => `${s.name} ${s.email} ${s.id}`.toLowerCase().includes(sq.trim().toLowerCase())).slice(0, 6) : [];
  const viewed = students.find((s) => s.id === viewId);
  const viewedAssignments = st.assignments.filter((a) => a.studentId === viewId);

  /* ---- record purchase ---- */
  const catalog = getCatalog();
  const [buyer, setBuyer] = useState("");
  const [cartIds, setCartIds] = useState([]);
  const [codeText, setCodeText] = useState("");
  const [result, setResult] = useState(null);
  const cart = catalog.filter((x) => cartIds.includes(x.type + x.id));
  const codes = codeText.split(/[\s,]+/).filter(Boolean);
  const check = buyer && cart.length && codes.length ? validateCoupons({ codes, studentId: buyer, items: cart }) : null;
  const doBuy = () => {
    const r = redeemCoupons({ codes, studentId: buyer, items: cart, actor });
    setResult(r);
    if (r.ok) { setToast(`Purchase recorded: ${inr(r.final)} paid, ${inr(r.totalDiscount)} discount.`); setCodeText(""); setCartIds([]); }
  };

  /* ---- reminders ---- */
  const [days, setDays] = useState("3");
  const due = st.assignments.filter((a) => { const c = st.campaigns.find((x) => x.id === a.campaignId); return c && !a.redeemedAt && !a.reminderSentAt && effectiveStatus(c, st) === "active" && new Date(c.endAt).getTime() <= Date.now() + Number(days || 0) * 86400000; });

  const canEdit = actor.can("edit");
  return (
    <div>
      <PageHeader title="Share Discount" subtitle="Send discounts to individual students or groups, remind them before expiry, and track who received and used them." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { key: "assign", label: "Assign coupons" }, { key: "tracking", label: "Received & used" }, { key: "reminders", label: "Expiry reminders" },
      ]} />

      {tab === "assign" && (
        <div className="ul-dsc-grid2" style={{ marginTop: 14 }}>
          <div className="ul-card ul-dsc-card">
            <h3>1. Discount</h3>
            <div className="ul-dsc-field"><label>Discount</label>
              <select value={campaignId} onChange={(e) => { setCampaignId(e.target.value); setSummary(null); }}>
                <option value="">Select a discount…</option>
                {usable.map((c) => <option key={c.id} value={c.id}>{c.name} {c.codeMode === "shared" ? `(${c.code})` : "(unique codes)"}</option>)}
              </select>
            </div>
            {campaign && <p className="ul-dsc-hint">{campaign.codeMode === "unique" ? "Each student gets their own single-use code." : `Everyone receives code ${campaign.code}.`} Students who already hold this coupon are skipped.</p>}
            <h3 style={{ marginTop: 16 }}>2. Audience</h3>
            <div className="ul-dsc-seg">
              <button type="button" className={mode === "individual" ? "is-on" : ""} onClick={() => setMode("individual")}>Individual students</button>
              <button type="button" className={mode === "group" ? "is-on" : ""} onClick={() => setMode("group")}>Student group</button>
            </div>

            {mode === "individual" ? (
              <div style={{ marginTop: 12 }}>
                <label className="ul-edu-search"><IconSearch size={14} color="var(--color-text-muted)" />
                  <input type="text" placeholder="Search by name, email or student ID…" value={q} onChange={(e) => setQ(e.target.value)} />
                </label>
                {found.map((s) => (
                  <label key={s.id} className="ul-dsc-studentrow">
                    <input type="checkbox" checked={picked.includes(s.id)} onChange={() => setPicked((p) => (p.includes(s.id) ? p.filter((x) => x !== s.id) : [...p, s.id]))} />
                    <span className="grow"><strong>{s.name}</strong><span className="ul-dsc-sub">{s.id} · {s.email}{s.status === "blocked" ? " · blocked" : ""}</span></span>
                    {campaignId && already(s.id) && <span className="ul-dsc-sub">already has it</span>}
                  </label>
                ))}
                <p className="ul-dsc-hint">{picked.length} student(s) selected</p>
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <div className="ul-dsc-quick">{PRESETS.map((p) => <button key={p.label} type="button" className="ul-btn ul-btn--ghost ul-rh-btn" onClick={() => setRules({ ...emptyRules, ...p.rules })}>{p.label}</button>)}
                  <button type="button" className="ul-btn ul-btn--ghost ul-rh-btn" onClick={() => setRules(emptyRules)}>Clear</button></div>
                <div className="ul-dsc-row" style={{ marginTop: 10 }}>
                  <div className="ul-dsc-field"><label>Avg. course progress ≥ (%)</label><input type="number" min="0" max="100" value={rules.minAvgProgress} onChange={(e) => setRules({ ...rules, minAvgProgress: e.target.value })} /></div>
                  <div className="ul-dsc-field"><label>Joined within (days)</label><input type="number" min="1" value={rules.newWithinDays} onChange={(e) => setRules({ ...rules, newWithinDays: e.target.value })} /></div>
                  <div className="ul-dsc-field"><label>Inactive for at least (days)</label><input type="number" min="1" value={rules.inactiveForDays} onChange={(e) => setRules({ ...rules, inactiveForDays: e.target.value })} /></div>
                  <div className="ul-dsc-field"><label>Purchases ≥ (loyalty)</label><input type="number" min="1" value={rules.minPurchases} onChange={(e) => setRules({ ...rules, minPurchases: e.target.value })} /></div>
                </div>
                <label className="ul-dsc-check"><input type="checkbox" checked={rules.completedAny} onChange={(e) => setRules({ ...rules, completedAny: e.target.checked })} />Completed at least one course</label>
                <label className="ul-dsc-check"><input type="checkbox" checked={rules.neverPurchased} onChange={(e) => setRules({ ...rules, neverPurchased: e.target.checked })} />Has never purchased a course</label>
                <div className="ul-dsc-field"><label>Enrolled in (any of)</label><div className="ul-dsc-pick">{courseTitles.map((t) => <label key={t} className="ul-dsc-check"><input type="checkbox" checked={rules.enrolledInCourses.includes(t)} onChange={() => toggleArr("enrolledInCourses", t)} />{t}</label>)}</div></div>
                <div className="ul-dsc-row">
                  <div className="ul-dsc-field"><label>Regions</label><div className="ul-dsc-pick">{regionOptions.map((r) => <label key={r} className="ul-dsc-check"><input type="checkbox" checked={rules.regions.includes(r)} onChange={() => toggleArr("regions", r)} />{r}</label>)}</div></div>
                  <div className="ul-dsc-field"><label>Grades</label><div className="ul-dsc-pick">{gradeOptions.map((g) => <label key={g} className="ul-dsc-check"><input type="checkbox" checked={rules.grades.includes(g)} onChange={() => toggleArr("grades", g)} />{g}</label>)}</div></div>
                </div>
                <div className="ul-dsc-note"><strong>Not available yet</strong> (needs data the platform doesn't collect):<ul style={{ margin: "4px 0 0", paddingLeft: 18 }}>{GROUP_RULES_UNAVAILABLE.map((t) => <li key={t}>{t}</li>)}</ul></div>
              </div>
            )}
          </div>

          <div className="ul-card ul-dsc-card">
            <h3>3. Review &amp; send</h3>
            <p className="ul-dsc-card__sub">{mode === "group" ? describeGroup(cleanRules(rules)) : "Selected students"}</p>
            {targets.length === 0 ? <p className="ul-dsc-empty">{mode === "group" ? "No active student matches these conditions." : "Search and tick students on the left."}</p> : (
              <div className="ul-dsc-pick" style={{ maxHeight: 260 }}>
                {targets.map((s) => (
                  <div key={s.id} className="ul-dsc-studentrow">
                    <span className="grow"><strong>{s.name}</strong><span className="ul-dsc-sub">{s.id} · {studentRegion(s)} · {s.grade}</span></span>
                    {campaignId && already(s.id) && <span className="ul-dsc-sub">already assigned</span>}
                  </div>
                ))}
              </div>
            )}
            <p className="ul-dsc-hint" style={{ marginTop: 8 }}>{targets.length} student(s){campaignId ? `, ${targets.filter((s) => !already(s.id)).length} will receive a new coupon` : ""}. Blocked students are never included.</p>
            <label className="ul-dsc-check"><input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} />Notify students (queued in the student inbox; no email service is connected yet)</label>
            <div className="ul-dsc-formbar"><button type="button" className="ul-btn ul-btn--primary" disabled={!canEdit || !campaign || !targets.length} onClick={doAssign}>Assign coupons</button></div>
            {summary && (
              <div className="ul-dsc-result is-ok">
                <strong>{summary.assigned.length} assigned.</strong>{summary.duplicates.length > 0 && ` ${summary.duplicates.length} skipped (already had it).`}{summary.blocked.length > 0 && ` ${summary.blocked.length} skipped (blocked).`}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "tracking" && (
        <div className="ul-card ul-edu-table-card" style={{ marginTop: 14 }}>
          {st.assignments.length === 0 ? <div className="ul-edu-empty">No discounts have been shared yet.</div> : (
            <div className="ul-edu-table-scroll ul-dsc-scroll">
              <table className="ul-edu-table ul-dsc-table">
                <thead><tr><th>Student</th><th>Discount</th><th>Code</th><th>Sent</th><th>Used</th><th>Status</th></tr></thead>
                <tbody>
                  {st.assignments.map((a) => (
                    <tr key={a.id}>
                      <td className="ul-rh-strong">{a.studentName}</td>
                      <td>{(st.campaigns.find((c) => c.id === a.campaignId) || {}).name || "—"}</td>
                      <td><span className="ul-dsc-code">{a.code}</span></td>
                      <td>{fmtDateTime(a.assignedAt)}</td>
                      <td>{a.redeemedAt ? fmtDateTime(a.redeemedAt) : "—"}</td>
                      <td><span className={`ul-status-badge ${{ redeemed: "is-approved", delivered: "is-verified", assigned: "is-pending", expired: "is-rejected" }[assignmentStatus(a, st)]}`}>{{ redeemed: "Used", delivered: "Sent", assigned: "Assigned", expired: "Expired" }[assignmentStatus(a, st)]}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {tab === "reminders" && (
        <div className="ul-card ul-dsc-card" style={{ marginTop: 14, maxWidth: 640 }}>
          <h3>Expiry reminders</h3>
          <p className="ul-dsc-card__sub">Remind students who still hold an unused coupon that is about to expire. Each assignment is reminded once.</p>
          <div className="ul-dsc-field"><label>Coupons expiring within (days)</label><input type="number" min="1" value={days} onChange={(e) => setDays(e.target.value)} /></div>
          <p className="ul-dsc-hint">{due.length} student(s) would be reminded.</p>
          <div className="ul-dsc-formbar"><button type="button" className="ul-btn ul-btn--primary" disabled={!canEdit || due.length === 0} onClick={() => { const r = sendExpiryReminders(Number(days), actor); setToast(r.ok ? `${r.sent} reminder(s) queued.` : r.error); }}>Send reminders</button></div>
        </div>
      )}
      {toastEl}
    </div>
  );
}
