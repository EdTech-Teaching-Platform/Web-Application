// "Student Acquisition" section of Manage Regional Heads: for every Regional
// Head, how many students they have onboarded and which students those are.
// Data is joined live from Student Management / Regional Heads (see
// data/studentAcquisitionMock.js).

import { useMemo, useState } from "react";
import { IconSearch, IconClose } from "../components/icons";
import { useRegionalState, REGIONS } from "../data/regionalHeadsMock";
import {
  CHANNEL, METHOD_LABEL, ONBOARDING, ONBOARDING_LABEL, ONBOARDING_BADGE,
  useAcquisitions, summarize, fmtDate,
} from "../data/studentAcquisitionMock";
import { Modal, Pager, pageSlice } from "./discounts/DiscountsShared";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./RegionalHeads.css";

const PAGE_SIZE = 8;

function Stat({ label, value, hint }) {
  return (
    <div className="ul-stat-card ul-rh-acqstat">
      <span className="ul-stat-card__label">{label}</span>
      <span className="ul-stat-card__value">{value}</span>
      <span className="ul-stat-card__trend">{hint}</span>
    </div>
  );
}

export default function RegionalHeadStudents() {
  const { rows } = useAcquisitions();
  const state = useRegionalState();
  const [search, setSearch] = useState("");
  const [region, setRegion] = useState("all");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null); // head id

  const viaHeads = useMemo(() => rows.filter((r) => r.channel === CHANNEL.HEAD), [rows]);
  const totals = useMemo(() => summarize(viaHeads), [viaHeads]);

  const heads = useMemo(() => {
    // every active head, plus removed heads that still have students attributed
    const withRows = new Set(viaHeads.map((r) => r.attributorId));
    return state.heads
      .filter((h) => h.status === "active" || withRows.has(h.id))
      .map((h) => {
        const mine = viaHeads.filter((r) => r.attributorId === h.id);
        const sum = summarize(mine);
        return { head: h, mine, ...sum, last: mine.map((r) => r.acquiredAt).sort().pop() || "" };
      })
      .sort((a, b) => b.onboarded - a.onboarded || a.head.name.localeCompare(b.head.name));
  }, [state.heads, viaHeads]);

  const q = search.trim().toLowerCase();
  const list = heads.filter((x) => (region === "all" || x.head.region === region)
    && (!q || x.head.name.toLowerCase().includes(q) || x.head.region.toLowerCase().includes(q)));
  const openHead = open ? heads.find((x) => x.head.id === open) : null;

  return (
    <div>
      <div className="ul-rh-acqstats">
        <Stat label="TOTAL ONBOARDED" value={totals.onboarded} hint="Through Regional Heads" />
        <Stat label="ACTIVE STUDENTS" value={totals.active} hint="Onboarded and not blocked" />
        <Stat label="PENDING ONBOARDING" value={totals.pending} hint="Awaiting account setup" />
        <Stat label="ACQUIRED THIS MONTH" value={totals.thisMonth} hint={new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })} />
      </div>

      <div className="ul-edu-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input type="text" placeholder="Search by Regional Head or region…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
          {search && <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search"><IconClose size={12} /></button>}
        </label>
        <select className="ul-edu-select" value={region} onChange={(e) => { setRegion(e.target.value); setPage(1); }}>
          <option value="all">Region: All</option>
          {REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </div>

      <div className="ul-card ul-edu-table-card">
        {list.length === 0 ? <div className="ul-edu-empty">No Regional Heads match these filters.</div> : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table ul-rh-table">
              <thead>
                <tr><th>Regional Head</th><th>Region</th><th>Students onboarded</th><th>Active</th><th>Pending</th><th>This month</th><th>Last acquired</th><th aria-label="Students" /></tr>
              </thead>
              <tbody>
                {pageSlice(list, page, PAGE_SIZE).map((x) => (
                  <tr key={x.head.id} className="ul-edu-row--clickable" onClick={() => setOpen(x.head.id)}>
                    <td className="ul-rh-strong">{x.head.name}{x.head.status !== "active" && <span className="ul-rh-sub"> (former)</span>}</td>
                    <td><span className="ul-rh-region-chip">{x.head.region}</span></td>
                    <td><strong>{x.onboarded}</strong></td>
                    <td>{x.active}</td>
                    <td>{x.pending}</td>
                    <td>{x.thisMonth}</td>
                    <td>{x.last ? fmtDate(x.last) : "—"}</td>
                    <td><button type="button" className="ul-btn ul-btn--ghost" onClick={(e) => { e.stopPropagation(); setOpen(x.head.id); }}>View students</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} setPage={setPage} total={list.length} size={PAGE_SIZE} />
      </div>

      {openHead && (
        <Modal wide title={`Students managed by ${openHead.head.name}`} subtitle={`${openHead.head.region} · Regional Head`} onClose={() => setOpen(null)}
          footer={<button type="button" className="ul-btn ul-btn--ghost" onClick={() => setOpen(null)}>Close</button>}>
          <div className="ul-rh-studentsum">
            <span><strong>{openHead.onboarded}</strong> onboarded</span>
            <span><strong>{openHead.active}</strong> active</span>
            <span><strong>{openHead.pending}</strong> pending</span>
            <span><strong>{openHead.thisMonth}</strong> this month</span>
          </div>
          {openHead.mine.length === 0 ? <p className="ul-rh-sub">No students have been attributed to this Regional Head yet.</p> : (
            <div className="ul-edu-table-scroll">
              <table className="ul-edu-table">
                <thead><tr><th>Student</th><th>Grade</th><th>Method</th><th>Acquired</th><th>Onboarding</th><th>Account</th></tr></thead>
                <tbody>
                  {[...openHead.mine].sort((a, b) => b.acquiredAt.localeCompare(a.acquiredAt)).map((a) => (
                    <tr key={a.id}>
                      <td><span className="ul-rh-strong">{a.name}</span><span className="ul-rh-sub">{a.studentId || a.email}</span></td>
                      <td>{a.grade || "—"}</td>
                      <td>{METHOD_LABEL[a.method]}</td>
                      <td>{fmtDate(a.acquiredAt)}</td>
                      <td><span className={`ul-status-badge ${ONBOARDING_BADGE[a.onboarding]}`}>{ONBOARDING_LABEL[a.onboarding]}</span></td>
                      <td>{a.onboarding !== ONBOARDING.ONBOARDED ? "—" : a.accountBlocked ? "Blocked" : "Active"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Modal>
      )}
    </div>
  );
}
