// Student Acquisition — part of Regional Head Management (Admin).
// Mounted at /admin/regionalheads/acquisition. Shows how students joined the
// platform and who brought them: Regional Heads (outreach / admissions) and
// Teachers (referrals / networks). Everything is joined live from Student
// Management, Regional Heads and Educator Management (see
// data/studentAcquisitionMock.js) — nothing is duplicated here.

import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { IconSearch, IconClose, IconPlus, IconDownload } from "../components/icons";
import { REGIONS } from "../data/regionalHeadsMock";
import { GRADE_OPTIONS } from "../data/studentsMock";
import {
  CHANNEL, CHANNEL_LABEL, METHOD_LABEL, METHODS_BY_CHANNEL, ONBOARDING, ONBOARDING_LABEL, ONBOARDING_BADGE,
  useAcquisitions, recordAcquisition, markOnboarded, setNotProceeding, validateAcquisition,
  summarize, groupByAttributor, monthlySeries, groupBy, fmtDate, todayIso,
} from "../data/studentAcquisitionMock";
import { Tabs, Modal, RowMenu, Pager, pageSlice, useToast, exportCsv } from "./discounts/DiscountsShared";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./EducatorProfile.css";
import "./RegionalHeads.css";
import "./StudentAcquisition.css";

const PAGE_SIZE = 8;
const TABS = [
  { key: "records", label: "Student records" },
  { key: "heads", label: "Regional Heads" },
  { key: "teachers", label: "Teachers" },
  { key: "analytics", label: "Analytics" },
];
const EMPTY_FORM = {
  mode: "new", studentId: "", name: "", email: "", phone: "", grade: "", city: "",
  channel: CHANNEL.HEAD, attributorId: "", method: "outreach", region: "", acquiredAt: "", onboardNow: false,
};

function Stat({ label, value, hint, tone }) {
  return (
    <div className="ul-stat-card ul-sac-stat">
      <span className="ul-stat-card__label">{label}</span>
      <span className={`ul-stat-card__value${tone ? ` is-${tone}` : ""}`}>{value}</span>
      <span className="ul-stat-card__trend">{hint}</span>
    </div>
  );
}

function AttributorName({ r }) {
  return <>{r.attributorName}{r.attributorFormer && <span className="ul-sac-former"> (former)</span>}</>;
}

export default function StudentAcquisition() {
  const navigate = useNavigate();
  const { rows, ctx, unattributed } = useAcquisitions();
  const [toast, setToast, toastEl] = useToast();
  const [tab, setTab] = useState("records");
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("all");
  const [region, setRegion] = useState("all");
  const [status, setStatus] = useState("all");
  const [period, setPeriod] = useState("all");
  const [who, setWho] = useState(null); // {id, name} drill-down from the Heads / Teachers tabs
  const [page, setPage] = useState(1);
  const [form, setForm] = useState(null);
  const [errors, setErrors] = useState([]);

  useEffect(() => setPage(1), [search, channel, region, status, period, who, tab]);

  const stats = useMemo(() => summarize(rows), [rows]);
  const months = useMemo(() => monthlySeries(rows, 6), [rows]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const now = new Date();
    const from = period === "month" ? new Date(now.getFullYear(), now.getMonth(), 1)
      : period === "quarter" ? new Date(now.getFullYear(), now.getMonth() - 2, 1) : null;
    return rows
      .filter((r) => (channel === "all" || r.channel === channel)
        && (region === "all" || r.region === region)
        && (status === "all" || r.onboarding === status)
        && (!who || r.attributorId === who.id)
        && (!from || new Date(`${r.acquiredAt}T00:00:00`) >= from)
        && (!q || [r.name, r.email, r.studentId, r.id, r.attributorName, r.region, r.city].some((v) => String(v || "").toLowerCase().includes(q))))
      .sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt));
  }, [rows, search, channel, region, status, period, who]);

  const heads = useMemo(() => {
    const groups = groupByAttributor(rows, CHANNEL.HEAD);
    // include active heads with no acquisitions yet so every head is visible
    const known = new Set(groups.map((g) => g.id));
    const empty = ctx.heads.filter((h) => h.status === "active" && !known.has(h.id)).map((h) => ({ id: h.id, name: h.name, former: false, regions: [h.region], rows: [], ...summarize([]), last: "" }));
    return [...groups, ...empty].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  }, [rows, ctx.heads]);
  const teachers = useMemo(() => groupByAttributor(rows, CHANNEL.TEACHER).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name)), [rows]);

  const drill = (g, target) => { setWho({ id: g.id, name: g.name }); setChannel("all"); setTab(target); };
  const clearFilters = () => { setSearch(""); setChannel("all"); setRegion("all"); setStatus("all"); setPeriod("all"); setWho(null); };

  // ---- record form
  const set = (p) => setForm((f) => ({ ...f, ...p }));
  const openForm = () => { setForm({ ...EMPTY_FORM, acquiredAt: todayIso() }); setErrors([]); };
  const setChannelField = (ch) => set({ channel: ch, attributorId: "", method: METHODS_BY_CHANNEL[ch][0] });
  const chooseAttributor = (id) => {
    const head = form.channel === CHANNEL.HEAD ? ctx.heads.find((h) => h.id === id) : null;
    set({ attributorId: id, region: head ? head.region : form.region });
  };
  const chooseStudent = (id) => {
    const s = ctx.students.find((x) => x.id === id);
    set({ studentId: id, ...(s ? { name: s.name, email: s.email } : {}) });
  };
  const formErrors = form ? validateAcquisition(form, ctx) : [];
  const submit = () => {
    const res = recordAcquisition(form, ctx);
    if (!res.ok) { setErrors(res.errors); return; }
    setForm(null);
    setToast(res.record.onboarding === ONBOARDING.ONBOARDED ? "Acquisition recorded and student onboarded." : "Acquisition recorded as pending onboarding.");
  };

  const rowMenu = (r) => {
    const items = [];
    if (r.onboarding === ONBOARDING.PENDING) {
      items.push({ label: "Mark onboarded", onClick: () => { const res = markOnboarded(r.id); setToast(res.ok ? `${r.name} onboarded — account created in Student Management.` : res.error); } });
      items.push({ label: "Mark not proceeding", onClick: () => { setNotProceeding(r.id, true); setToast(`${r.name} marked as not proceeding.`); } });
    }
    if (r.onboarding === ONBOARDING.DROPPED) items.push({ label: "Reopen as pending", onClick: () => { setNotProceeding(r.id, false); setToast(`${r.name} reopened.`); } });
    if (r.studentId) items.push({ label: "Open Student Management", onClick: () => navigate("/admin/usermanagement") });
    return items;
  };

  const exportRows = () => exportCsv("student-acquisition.csv", [
    ["Record", "Student", "Email", "Grade", "Region", "Channel", "Acquired by", "Method", "Acquisition date", "Onboarding", "Account"],
    ...filtered.map((r) => [r.id, r.name, r.email, r.grade, r.region, CHANNEL_LABEL[r.channel], r.attributorName, METHOD_LABEL[r.method], r.acquiredAt, ONBOARDING_LABEL[r.onboarding], r.onboarding === ONBOARDING.ONBOARDED ? (r.accountBlocked ? "Blocked" : "Active") : "—"]),
  ]);

  const activeHeads = ctx.heads.filter((h) => h.status === "active");
  const activeTeachers = ctx.educators.filter((e) => e.accountStatus === "active");
  const maxMonth = Math.max(1, ...months.map((m) => m.total));
  const regionCounts = groupBy(rows, (r) => r.region);
  const methodCounts = groupBy(rows, (r) => METHOD_LABEL[r.method]);
  const maxRegion = Math.max(1, ...regionCounts.map((x) => x.count));
  const maxMethod = Math.max(1, ...methodCounts.map((x) => x.count));
  const filtersOn = search || channel !== "all" || region !== "all" || status !== "all" || period !== "all" || who;

  return (
    <div className="ul-sac">
      <div className="ul-sac-actions">
        <p className="ul-sac-intro">Students brought onto the platform by Regional Heads (outreach and admissions) and by Teachers (referrals and their own networks). Incentives are not part of this view.</p>
        <div className="ul-rh-header-actions">
          <button type="button" className="ul-btn ul-btn--ghost" onClick={exportRows}><span className="ul-sac-inline"><IconDownload size={13} /> Export CSV</span></button>
          <button type="button" className="ul-btn ul-btn--primary ul-edu-add-btn" onClick={openForm}><IconPlus size={13} /><span>Record acquisition</span></button>
        </div>
      </div>

      <div className="ul-sac-stats">
        <Stat label="TOTAL ONBOARDED" value={stats.onboarded} hint={`${stats.conversion}% of ${stats.total} acquired`} />
        <Stat label="ACTIVE STUDENTS" value={stats.active} hint="Onboarded and not blocked" />
        <Stat label="PENDING ONBOARDING" value={stats.pending} hint={stats.dropped ? `${stats.dropped} not proceeding` : "Awaiting account setup"} />
        <Stat label="ACQUIRED THIS MONTH" value={stats.thisMonth} hint={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
        <Stat label="VIA REGIONAL HEADS" value={stats.viaHeads} hint="Outreach + admissions" />
        <Stat label="VIA TEACHERS" value={stats.viaTeachers} hint="Referrals + networks" />
      </div>

      <div className="ul-dsc-tabs"><Tabs tabs={TABS} value={tab} onChange={setTab} /></div>

      {tab === "records" && (
        <>
          <div className="ul-edu-toolbar">
            <label className="ul-edu-search">
              <IconSearch size={14} color="var(--color-text-muted)" />
              <input type="text" placeholder="Search by student, email, ID, region or who acquired…" value={search} onChange={(e) => setSearch(e.target.value)} />
              {search && <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search"><IconClose size={12} /></button>}
            </label>
            <select className="ul-edu-select" value={channel} onChange={(e) => setChannel(e.target.value)}>
              <option value="all">Acquired by: All</option>
              <option value={CHANNEL.HEAD}>Regional Heads</option>
              <option value={CHANNEL.TEACHER}>Teachers</option>
            </select>
            <select className="ul-edu-select" value={region} onChange={(e) => setRegion(e.target.value)}>
              <option value="all">Region: All</option>
              {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className="ul-edu-select" value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="all">Onboarding: All</option>
              {Object.values(ONBOARDING).map((s) => <option key={s} value={s}>{ONBOARDING_LABEL[s]}</option>)}
            </select>
            <select className="ul-edu-select" value={period} onChange={(e) => setPeriod(e.target.value)}>
              <option value="all">Date: All time</option>
              <option value="month">This month</option>
              <option value="quarter">Last 3 months</option>
            </select>
          </div>
          {who && (
            <div className="ul-sac-filterchip">Showing students acquired by <strong>{who.name}</strong>
              <button type="button" onClick={() => setWho(null)} aria-label="Remove filter"><IconClose size={11} /></button>
            </div>
          )}
          <div className="ul-card ul-edu-table-card">
            {filtered.length === 0 ? (
              <div className="ul-edu-empty">{rows.length === 0 ? "No acquisitions recorded yet." : "No records match these filters."} {filtersOn && <button type="button" className="ul-sac-link" onClick={clearFilters}>Clear filters</button>}</div>
            ) : (
              <div className="ul-edu-table-scroll">
                <table className="ul-edu-table ul-sac-table">
                  <thead>
                    <tr><th>Student</th><th>Region</th><th>Acquired by</th><th>Method</th><th>Acquisition date</th><th>Onboarding</th><th>Account</th><th aria-label="Actions" /></tr>
                  </thead>
                  <tbody>
                    {pageSlice(filtered, page, PAGE_SIZE).map((r) => (
                      <tr key={r.id}>
                        <td><span className="ul-rh-strong">{r.name}</span><span className="ul-rh-sub">{r.studentId || r.id} · {r.grade || "—"}</span></td>
                        <td><span className="ul-rh-region-chip">{r.region}</span></td>
                        <td><span className="ul-rh-strong"><AttributorName r={r} /></span><span className="ul-rh-sub">{CHANNEL_LABEL[r.channel]}</span></td>
                        <td>{METHOD_LABEL[r.method]}</td>
                        <td>{fmtDate(r.acquiredAt)}{r.onboardedAt && r.onboardedAt !== r.acquiredAt && <span className="ul-rh-sub">Onboarded {fmtDate(r.onboardedAt)}</span>}</td>
                        <td><span className={`ul-status-badge ${ONBOARDING_BADGE[r.onboarding]}`}>{ONBOARDING_LABEL[r.onboarding]}</span></td>
                        <td>{r.onboarding !== ONBOARDING.ONBOARDED ? "—" : r.accountBlocked ? <span className="ul-status-badge is-account-suspended">Blocked</span> : <span className="ul-status-badge is-account-active">Active</span>}</td>
                        <td className="ul-edu-actions-cell"><div className="ul-edu-actions-inner"><RowMenu items={rowMenu(r)} /></div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Pager page={page} setPage={setPage} total={filtered.length} size={PAGE_SIZE} />
          </div>
        </>
      )}

      {(tab === "heads" || tab === "teachers") && (() => {
        const list = tab === "heads" ? heads : teachers;
        const noun = tab === "heads" ? "Regional Head" : "Teacher";
        return (
          <div className="ul-card ul-edu-table-card">
            {list.length === 0 ? <div className="ul-edu-empty">No {noun.toLowerCase()} has acquired a student yet.</div> : (
              <div className="ul-edu-table-scroll">
                <table className="ul-edu-table ul-sac-table">
                  <thead>
                    <tr><th>{noun}</th><th>{tab === "heads" ? "Region" : "Regions"}</th><th>Total acquired</th><th>Onboarded</th><th>Active</th><th>Pending</th><th>This month</th><th>Last acquired</th></tr>
                  </thead>
                  <tbody>
                    {list.map((g) => (
                      <tr key={g.id} className="ul-edu-row--clickable" onClick={() => g.total && drill(g, "records")}>
                        <td><span className="ul-rh-strong">{g.name}{g.former && <span className="ul-sac-former"> (former)</span>}</span><span className="ul-rh-sub">{g.id}</span></td>
                        <td>{g.regions.map((r) => <span key={r} className="ul-rh-region-chip ul-sac-chipgap">{r}</span>)}</td>
                        <td><strong>{g.total}</strong></td>
                        <td>{g.onboarded}</td>
                        <td>{g.active}</td>
                        <td>{g.pending}</td>
                        <td>{g.thisMonth}</td>
                        <td>{g.last ? fmtDate(g.last) : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <p className="ul-sac-foot">{tab === "heads" ? `${activeHeads.length} active Regional Head${activeHeads.length === 1 ? "" : "s"}. ` : `Only teachers with at least one acquisition are listed (${activeTeachers.length} active teachers in total). `}Click a row to see that person’s students.</p>
          </div>
        );
      })()}

      {tab === "analytics" && (
        <div className="ul-sac-analytics">
          <div className="ul-card ul-sac-card ul-sac-wide">
            <h4>Monthly acquisition</h4>
            <p className="ul-sac-note">Students acquired per month, last 6 months, split by who brought them.</p>
            <div className="ul-sac-bars" role="img" aria-label="Monthly acquisition chart">
              {months.map((m) => (
                <div key={m.key} className="ul-sac-bar">
                  <span className="ul-sac-bar__val">{m.total}</span>
                  <div className="ul-sac-bar__col" style={{ height: `${(m.total / maxMonth) * 100}%` }}>
                    {m.heads > 0 && <span className="is-head" style={{ flex: m.heads }} title={`${m.heads} via Regional Heads`} />}
                    {m.teachers > 0 && <span className="is-teacher" style={{ flex: m.teachers }} title={`${m.teachers} via Teachers`} />}
                  </div>
                  <span className="ul-sac-bar__lbl">{m.label}</span>
                </div>
              ))}
            </div>
            <div className="ul-sac-legend"><span><i className="is-head" /> Regional Heads</span><span><i className="is-teacher" /> Teachers</span></div>
          </div>

          <div className="ul-card ul-sac-card">
            <h4>Onboarding status</h4>
            <p className="ul-sac-note">{stats.conversion}% of acquired students are onboarded.</p>
            {Object.values(ONBOARDING).map((s) => {
              const n = rows.filter((r) => r.onboarding === s).length;
              return (
                <div key={s} className="ul-sac-hrow"><span>{ONBOARDING_LABEL[s]}</span><div className="ul-sac-track"><div className={`ul-sac-fill is-${s}`} style={{ width: `${rows.length ? (n / rows.length) * 100 : 0}%` }} /></div><strong>{n}</strong></div>
              );
            })}
            <p className="ul-sac-note" style={{ marginTop: 12 }}>
              {unattributed.length} student{unattributed.length === 1 ? "" : "s"} in Student Management {unattributed.length === 1 ? "has" : "have"} no attribution (direct sign-ups or not yet recorded).
            </p>
          </div>

          <div className="ul-card ul-sac-card">
            <h4>By region</h4>
            {regionCounts.length === 0 && <p className="ul-sac-note">No data yet.</p>}
            {regionCounts.map((x) => (
              <div key={x.key} className="ul-sac-hrow"><span>{x.key}</span><div className="ul-sac-track"><div className="ul-sac-fill" style={{ width: `${(x.count / maxRegion) * 100}%` }} /></div><strong>{x.count}</strong></div>
            ))}
          </div>

          <div className="ul-card ul-sac-card">
            <h4>By method</h4>
            {methodCounts.length === 0 && <p className="ul-sac-note">No data yet.</p>}
            {methodCounts.map((x) => (
              <div key={x.key} className="ul-sac-hrow"><span>{x.key}</span><div className="ul-sac-track"><div className="ul-sac-fill" style={{ width: `${(x.count / maxMethod) * 100}%` }} /></div><strong>{x.count}</strong></div>
            ))}
          </div>
        </div>
      )}

      {form && (
        <Modal
          title="Record acquisition"
          subtitle="Attribute a student to the Regional Head or Teacher who brought them in."
          onClose={() => setForm(null)}
          footer={<>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setForm(null)}>Cancel</button>
            <button type="button" className="ul-btn ul-btn--primary" disabled={formErrors.length > 0} onClick={submit}>Save acquisition</button>
          </>}
        >
          <div className="ul-ts-form">
            {errors.length > 0 && <div className="ul-ts-errors"><ul>{errors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
            <div className="ul-ts-form-row">
              <label>Student</label>
              <div className="ul-ts-pill-toggle">
                <button type="button" className={form.mode === "new" ? "is-active" : ""} onClick={() => set({ mode: "new", studentId: "" })}>New prospect</button>
                <button type="button" className={form.mode === "existing" ? "is-active" : ""} onClick={() => set({ mode: "existing" })}>Existing student</button>
              </div>
            </div>
            {form.mode === "existing" ? (
              <div className="ul-ts-form-row">
                <label>Student without attribution</label>
                <select value={form.studentId} onChange={(e) => chooseStudent(e.target.value)}>
                  <option value="">Select a student…</option>
                  {unattributed.map((s) => <option key={s.id} value={s.id}>{s.name} — {s.email}</option>)}
                </select>
                {unattributed.length === 0 && <small className="ul-sac-note">Every student in Student Management already has an attribution.</small>}
              </div>
            ) : (
              <>
                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row"><label>Full name</label><input type="text" value={form.name} onChange={(e) => set({ name: e.target.value })} /></div>
                  <div className="ul-ts-form-row"><label>Email</label><input type="email" value={form.email} onChange={(e) => set({ email: e.target.value })} /></div>
                  <div className="ul-ts-form-row"><label>Phone (optional)</label><input type="text" value={form.phone} onChange={(e) => set({ phone: e.target.value })} /></div>
                  <div className="ul-ts-form-row"><label>Grade</label>
                    <select value={form.grade} onChange={(e) => set({ grade: e.target.value })}><option value="">Select grade…</option>{GRADE_OPTIONS.map((g) => <option key={g}>{g}</option>)}</select>
                  </div>
                </div>
                <div className="ul-ts-form-row"><label>City (optional)</label><input type="text" value={form.city} onChange={(e) => set({ city: e.target.value })} /></div>
                <label className="ul-sac-check"><input type="checkbox" checked={form.onboardNow} onChange={(e) => set({ onboardNow: e.target.checked })} /> Already onboarded — create the student account now</label>
              </>
            )}
            <div className="ul-ts-form-row">
              <label>Acquired by</label>
              <div className="ul-ts-pill-toggle">
                <button type="button" className={form.channel === CHANNEL.HEAD ? "is-active" : ""} onClick={() => setChannelField(CHANNEL.HEAD)}>Regional Head</button>
                <button type="button" className={form.channel === CHANNEL.TEACHER ? "is-active" : ""} onClick={() => setChannelField(CHANNEL.TEACHER)}>Teacher</button>
              </div>
            </div>
            <div className="ul-ts-form-grid-2">
              <div className="ul-ts-form-row">
                <label>{form.channel === CHANNEL.HEAD ? "Regional Head" : "Teacher"}</label>
                <select value={form.attributorId} onChange={(e) => chooseAttributor(e.target.value)}>
                  <option value="">Select…</option>
                  {form.channel === CHANNEL.HEAD
                    ? activeHeads.map((h) => <option key={h.id} value={h.id}>{h.name} — {h.region}</option>)
                    : activeTeachers.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
                </select>
              </div>
              <div className="ul-ts-form-row">
                <label>Method</label>
                <select value={form.method} onChange={(e) => set({ method: e.target.value })}>
                  {METHODS_BY_CHANNEL[form.channel].map((m) => <option key={m} value={m}>{METHOD_LABEL[m]}</option>)}
                </select>
              </div>
              <div className="ul-ts-form-row">
                <label>Region</label>
                <select value={form.region} onChange={(e) => set({ region: e.target.value })} disabled={form.channel === CHANNEL.HEAD && !!form.attributorId}>
                  <option value="">Select region…</option>
                  {REGIONS.map((r) => <option key={r}>{r}</option>)}
                </select>
                {form.channel === CHANNEL.HEAD && form.attributorId && <small className="ul-sac-note">Taken from the Regional Head’s region.</small>}
              </div>
              <div className="ul-ts-form-row"><label>Acquisition date</label><input type="date" max={todayIso()} value={form.acquiredAt} onChange={(e) => set({ acquiredAt: e.target.value })} /></div>
            </div>
            {formErrors.length > 0 && <small className="ul-sac-note">To save: {formErrors[0]}</small>}
          </div>
        </Modal>
      )}
      {toastEl}
    </div>
  );
}
