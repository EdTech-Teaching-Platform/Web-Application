// Head Teacher / Regional Head Dashboard + Management Dashboards
// Jira: Day 7 — Head Teacher/Regional Head dashboards
// Institution & Organization Management — "Management Dashboards"
// addition. Head Teacher / Regional Head journey: Login scoped to org ->
// Staff Oversight -> Verification Visibility -> Roster Monitoring,
// "without visibility into any other organization's data". Dashboard
// Overview — Head Teacher / Regional Head Dashboard row: "Staff roster
// and educator verification status, scoped to their own organizational
// unit and its sub-units" / "Add a teacher; review scoped staff status" /
// "Staff count and verification status within their own scope only".
//
// Per the Section 2.1 "Portal Note": Head Teacher / Regional Head has no
// dedicated fifth portal shell — it operates inside this Admin Portal,
// scoped to one organizational unit. There's no separate HT/RH auth role
// wired up yet (useAuth only has a single admin role), so the
// "Viewing as" scope picker below stands in for that scoping — exactly
// the same organizational-unit + descendants model already built for
// Staff Assignment (Day 6, ../data/institutionsMock.js /
// ../data/staffAssignmentsMock.js), reused rather than re-invented.
//
// Chrome (sidebar/topbar) comes from src/layouts/AdminLayout.jsx. This
// page reuses the shared .ul-card / .ul-stat-card / .ul-bento / .ul-btn /
// .ul-status-badge / .ul-avatar-chip / .ul-quick-action / .ul-org-bar /
// .ul-confirm-backdrop / .ul-confirm-modal primitives already established
// by AdminDashboard.jsx, EducatorVerification.jsx, RegionBranchHierarchy.jsx
// and ConfirmModal.jsx so this screen looks and behaves like the rest of
// the Admin console — layout specific to this page lives in
// ManagementDashboards.css.
//
// Alerts / pending items and Recent Activity are NOT invented mock data —
// they're built from the same live stores Staff Assignments already uses
// (useStaffRequests / useAssignmentHistory from staffAssignmentsMock.js,
// plus the existing verification/course-approval status fields), just
// filtered down to this scope. Only Attendance % and Engagement % remain
// a small deterministic placeholder (seeded from the org unit id) since
// neither the LMS doc nor any mock store models those two metrics yet —
// same as before, unchanged.

import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useInstitutions, ORG_UNIT_TYPE } from "../data/institutionsMock";
import { useEducators } from "../data/educatorsMock";
import {
  useAssignments,
  useAssignmentHistory,
  useStaffRequests,
  getBranchMetrics,
  REQUEST_STATUS,
} from "../data/staffAssignmentsMock";
import { useCourses, COURSE_STATUS, COURSE_STATUS_LABEL } from "../data/coursesMock";
import {
  IconLayers,
  IconTeach,
  IconBranch,
  IconInstitution,
  IconCheck,
  IconPlus,
  IconAlert,
  IconRefresh,
  IconHistory,
  IconClose,
  IconChevronDown,
} from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./RegionBranchHierarchy.css";
import "../components/ConfirmModal.css";
import "./ManagementDashboards.css";

// ---------- small deterministic "mock metric" helpers (see file header) ----------
function seedFromId(id) {
  let h = 0;
  for (let i = 0; i < id.length; i += 1) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return h;
}
function attendanceForUnit(unitId) {
  const s = seedFromId(`${unitId}-att`);
  return 74 + (s % 22); // 74–95%
}
function engagementForUnit(unitId) {
  const s = seedFromId(`${unitId}-eng`);
  return 58 + (s % 33); // 58–90%
}
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
// `days` drives the date-filter on the Attendance Trend card (7/14/30).
// Labels stay single-letter weekday initials for any range so the bar
// strip stays compact — the range itself is what the filter controls.
function attendanceSeriesForUnit(unitId, days) {
  const base = attendanceForUnit(unitId);
  return Array.from({ length: days }, (_, idx) => {
    const dayLabel = WEEK_DAYS[idx % 7];
    const s = seedFromId(`${unitId}-${days}-${idx}`);
    const jitter = (s % 13) - 6; // +/-6
    return { key: `d${idx}`, day: dayLabel, value: Math.max(40, Math.min(100, base + jitter - (idx % 7))) };
  });
}
const TREND_RANGE_OPTIONS = [
  { value: 7, label: "Last 7 days" },
  { value: 14, label: "Last 14 days" },
  { value: 30, label: "Last 30 days" },
];

const VERIFICATION_BADGE_CLASS = {
  verified: "is-verified",
  pending: "is-pending",
  under_review: "is-pending",
  rejected: "is-rejected",
};
const VERIFICATION_LABEL = {
  verified: "Verified",
  pending: "Pending",
  under_review: "Under Review",
  rejected: "Rejected",
};
const COURSE_BADGE_CLASS = {
  pending: "is-pending",
  approved: "is-approved",
  rejected: "is-rejected",
};

function pctTone(pct) {
  if (pct >= 100) return "is-full";
  if (pct >= 70) return "is-high";
  if (pct >= 35) return "is-mid";
  return "is-low";
}

function OrgBar({ pct }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div className="ul-org-bar" title={`${clamped}%`}>
      <div className="ul-org-bar__track">
        <div className={`ul-org-bar__fill ${pctTone(clamped)}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="ul-org-bar__value">{clamped}%</span>
    </div>
  );
}

function initialsOf(name) {
  return (name || "")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function fmtWhen(iso) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return iso;
  return dt.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
function fmtTime(date) {
  if (!date) return "—";
  return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

// Flatten one institution's org units into a scope list (the unit itself
// plus every descendant), respecting the parentId hierarchy — same
// traversal shape RegionBranchHierarchy.jsx uses.
function collectScope(units, rootId) {
  const byParent = new Map();
  units.forEach((u) => {
    const key = u.parentId || "__root";
    if (!byParent.has(key)) byParent.set(key, []);
    byParent.get(key).push(u);
  });
  const root = units.find((u) => u.id === rootId);
  if (!root) return [];
  const out = [root];
  const walk = (id) => {
    (byParent.get(id) || []).forEach((child) => {
      out.push(child);
      walk(child.id);
    });
  };
  walk(rootId);
  return out;
}

// Ancestor chain from the institution's root org unit down to `unitId`
// (inclusive) — used only to render the "Institution › Region › Branch"
// scope breadcrumb, never to widen what's actually shown (that's still
// collectScope, unit + descendants only).
function ancestorPath(units, unitId) {
  const byId = new Map(units.map((u) => [u.id, u]));
  const path = [];
  let cur = byId.get(unitId);
  while (cur) {
    path.unshift(cur);
    cur = cur.parentId ? byId.get(cur.parentId) : null;
  }
  return path;
}

const HISTORY_VERB = {
  Assigned: "assigned to",
  Transferred: "transferred to",
  Removed: "removed from",
  "Role Changed": "role changed at",
};

export default function ManagementDashboards() {
  const institutions = useInstitutions();
  const educators = useEducators();
  useAssignments(); // subscribes so metrics/staffIds stay live
  const history = useAssignmentHistory();
  const requests = useStaffRequests();
  const courses = useCourses();

  const [institutionId, setInstitutionId] = useState(institutions[0]?.id || "");
  const institution = institutions.find((i) => i.id === institutionId) || institutions[0];

  // Default the scoped unit to a Region/Branch that has sub-units where
  // possible, so the "own unit + sub-units" aggregation actually has
  // something to demonstrate.
  const defaultUnitId = useMemo(() => {
    if (!institution) return "";
    const withChildren = institution.orgUnits.find((u) =>
      institution.orgUnits.some((c) => c.parentId === u.id)
    );
    return (withChildren || institution.orgUnits[0])?.id || "";
  }, [institution]);
  const [unitId, setUnitId] = useState(defaultUnitId);
  const [trendDays, setTrendDays] = useState(7);
  const [detailUnitId, setDetailUnitId] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(() => new Date());

  const currentInstitution = institution;
  const orgUnits = currentInstitution?.orgUnits || [];
  const effectiveUnitId = orgUnits.some((u) => u.id === unitId) ? unitId : defaultUnitId;
  const scopeUnits = useMemo(
    () => collectScope(orgUnits, effectiveUnitId),
    [orgUnits, effectiveUnitId]
  );
  const scopeUnit = scopeUnits[0];
  const scopeUnitIds = useMemo(() => new Set(scopeUnits.map((u) => u.id)), [scopeUnits]);
  const breadcrumb = useMemo(
    () => (currentInstitution ? ancestorPath(orgUnits, effectiveUnitId) : []),
    [currentInstitution, orgUnits, effectiveUnitId]
  );

  const metrics = useMemo(
    () => (currentInstitution ? getBranchMetrics(currentInstitution) : []),
    [currentInstitution]
  );
  const scopeMetrics = scopeUnits.map((u) => metrics.find((m) => m.unit.id === u.id) || {
    unit: u,
    totalStaff: 0,
    openPositions: u.targetStaff,
    staffAllocationPct: 0,
    teacherWorkloadPct: 0,
  });

  const totalStaff = scopeMetrics.reduce((sum, m) => sum + m.totalStaff, 0);
  const totalStudents = scopeUnits.reduce((sum, u) => sum + u.students, 0);
  const totalClasses = scopeUnits.reduce((sum, u) => sum + u.classesCount, 0);
  const totalOpenPositions = scopeMetrics.reduce((sum, m) => sum + m.openPositions, 0);
  const avgAllocation = scopeMetrics.length
    ? Math.round(scopeMetrics.reduce((sum, m) => sum + m.staffAllocationPct, 0) / scopeMetrics.length)
    : 0;

  const scopedStaffIds = useMemo(() => {
    const set = new Set();
    scopeUnits.forEach((u) => (u.staffIds || []).forEach((id) => set.add(id)));
    return Array.from(set);
  }, [scopeUnits]);

  const scopedEducators = scopedStaffIds
    .map((id) => educators.find((e) => e.id === id))
    .filter(Boolean);
  const verifiedCount = scopedEducators.filter((e) => e.verificationStatus === "verified").length;
  const verifiedPct = scopedEducators.length ? Math.round((verifiedCount / scopedEducators.length) * 100) : 0;

  const scopedCourses = courses.filter((c) => scopedStaffIds.includes(c.educatorId));

  const avgAttendance = scopeUnits.length
    ? Math.round(scopeUnits.reduce((sum, u) => sum + attendanceForUnit(u.id), 0) / scopeUnits.length)
    : 0;
  const avgEngagement = scopeUnits.length
    ? Math.round(scopeUnits.reduce((sum, u) => sum + engagementForUnit(u.id), 0) / scopeUnits.length)
    : 0;
  const attendanceSeries = scopeUnit ? attendanceSeriesForUnit(scopeUnit.id, trendDays) : [];

  // ---- alerts / pending items (real data, just filtered to scope) ----
  const pendingRequests = requests.filter(
    (r) =>
      r.institutionId === currentInstitution?.id &&
      r.status === REQUEST_STATUS.PENDING &&
      (scopeUnitIds.has(r.requestedOrgUnitId) || scopeUnitIds.has(r.currentOrgUnitId))
  );
  const pendingVerifications = scopedEducators.filter(
    (e) => e.verificationStatus === "pending" || e.verificationStatus === "under_review"
  );
  const pendingCourses = scopedCourses.filter((c) => c.status === COURSE_STATUS.PENDING);
  const understaffedUnits = scopeMetrics.filter((m) => m.openPositions > 0);

  const alertItems = [
    pendingRequests.length > 0 && {
      key: "requests",
      label: `Staff request${pendingRequests.length === 1 ? "" : "s"} awaiting review`,
      count: pendingRequests.length,
      to: "/admin/regionbranchhierarchy",
    },
    pendingVerifications.length > 0 && {
      key: "verifications",
      label: `Educator verification${pendingVerifications.length === 1 ? "" : "s"} pending`,
      count: pendingVerifications.length,
      to: "/admin/educatorverification",
    },
    pendingCourses.length > 0 && {
      key: "courses",
      label: `Course${pendingCourses.length === 1 ? "" : "s"} awaiting approval`,
      count: pendingCourses.length,
      to: "/admin/courseapproval",
    },
    understaffedUnits.length > 0 && {
      key: "staffing",
      label: `Sub-unit${understaffedUnits.length === 1 ? "" : "s"} under target staffing`,
      count: understaffedUnits.length,
      to: "/admin/regionbranchhierarchy",
    },
  ].filter(Boolean);
  const totalAlerts = alertItems.reduce((sum, a) => sum + a.count, 0);

  // ---- recent activity (real staff-assignment history, filtered to scope) ----
  const recentActivity = history
    .filter((h) => h.institutionId === currentInstitution?.id && (scopeUnitIds.has(h.newOrgUnitId) || scopeUnitIds.has(h.previousOrgUnitId)))
    .slice()
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 6);

  const detailUnit = scopeUnits.find((u) => u.id === detailUnitId) || null;
  const detailMetrics = detailUnit ? scopeMetrics.find((m) => m.unit.id === detailUnit.id) : null;
  const detailStaff = detailUnit
    ? (detailUnit.staffIds || []).map((id) => educators.find((e) => e.id === id)).filter(Boolean)
    : [];
  const detailCourses = detailUnit ? courses.filter((c) => (detailUnit.staffIds || []).includes(c.educatorId)) : [];
  const detailRequests = detailUnit
    ? requests.filter(
        (r) =>
          r.institutionId === currentInstitution?.id &&
          r.status === REQUEST_STATUS.PENDING &&
          (r.requestedOrgUnitId === detailUnit.id || r.currentOrgUnitId === detailUnit.id)
      )
    : [];

  if (!currentInstitution || !scopeUnit) {
    return (
      <div className="ul-card">
        <p className="ul-card__body-text">No institutions available to manage yet.</p>
      </div>
    );
  }

  const headName = scopeUnit.headTeacher && scopeUnit.headTeacher !== "Not yet assigned" ? scopeUnit.headTeacher : null;

  return (
    <>
      <div className="ul-dash-welcome ul-mgmt-welcome">
        <div>
          <h2 className="ul-dash-welcome__title">Management Dashboard</h2>
          <p className="ul-dash-welcome__subtitle">
            Everything happening within your organizational scope — staff, courses, attendance, and progress.
          </p>
        </div>
        <div className="ul-mgmt-updated">
          <span>Last updated {fmtTime(lastUpdated)}</span>
          <button type="button" className="ul-mgmt-refresh-btn" onClick={() => setLastUpdated(new Date())} title="Refresh">
            <IconRefresh size={13} />
          </button>
        </div>
      </div>

      {/* ---- identity strip: who is viewing this dashboard and what their scope is ---- */}
      <div className="ul-mgmt-identity">
        <div className="ul-avatar-chip ul-mgmt-identity__avatar">{initialsOf(headName || scopeUnit.name)}</div>
        <div className="ul-mgmt-identity__body">
          <span className="ul-mgmt-identity__name">
            {headName || "Head Teacher / Regional Head"}
            <span className="ul-mgmt-role-pill">
              <IconLayers size={11} /> {scopeUnit.type === ORG_UNIT_TYPE.REGION ? "Regional Head" : "Head Teacher"}
            </span>
          </span>
          <span className="ul-mgmt-identity__breadcrumb">
            {currentInstitution.name}
            {breadcrumb.map((u) => (
              <span key={u.id}> › {u.name}</span>
            ))}
          </span>
        </div>
      </div>

      {/* ---- scope picker: stands in for a logged-in Head Teacher / Regional Head's own org unit ---- */}
      <div className="ul-usr-toolbar ul-mgmt-scopebar">
        <select
          className="ul-usr-select"
          value={currentInstitution.id}
          onChange={(e) => {
            setInstitutionId(e.target.value);
            setUnitId("");
          }}
        >
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
        <select className="ul-usr-select" value={effectiveUnitId} onChange={(e) => setUnitId(e.target.value)}>
          {orgUnits.map((u) => (
            <option key={u.id} value={u.id}>
              {u.type === ORG_UNIT_TYPE.REGION ? "Region" : "Branch"} — {u.name}
            </option>
          ))}
        </select>
      </div>

      <div className="ul-mgmt-scope-note">
        {scopeUnit.type === ORG_UNIT_TYPE.REGION ? <IconGlobeAlias /> : <IconBranch size={15} color="var(--color-primary-dark)" />}
        <span>
          Viewing <strong>{scopeUnit.name}</strong>
          {scopeUnits.length > 1 ? ` and its ${scopeUnits.length - 1} sub-unit${scopeUnits.length - 1 === 1 ? "" : "s"}` : ""} only.
          A Head Teacher / Regional Head sees staff, verification status, and rosters scoped strictly to
          their own organizational unit — never another institution's or region's data.
        </span>
      </div>

      {/* ---- stat row (unchanged LMS-required metrics) ---- */}
      <div className="ul-stats ul-mgmt-stats">
        <div className="ul-stat-card">
          <span className="ul-stat-card__label">STAFF IN SCOPE</span>
          <span className="ul-stat-card__value">{totalStaff}</span>
          <span className="ul-stat-card__trend is-up">
            {totalOpenPositions} <em>open position{totalOpenPositions === 1 ? "" : "s"}</em>
          </span>
        </div>
        <div className="ul-stat-card">
          <span className="ul-stat-card__label">STUDENTS</span>
          <span className="ul-stat-card__value">{totalStudents.toLocaleString()}</span>
          <span className="ul-stat-card__trend is-up">
            {totalClasses} <em>classes / sections</em>
          </span>
        </div>
        <div className="ul-stat-card">
          <span className="ul-stat-card__label">EDUCATOR VERIFICATION</span>
          <span className="ul-stat-card__value">{verifiedPct}%</span>
          <span className="ul-stat-card__trend is-up">
            {verifiedCount} of {scopedEducators.length} <em>verified</em>
          </span>
        </div>
        <div className="ul-stat-card">
          <span className="ul-stat-card__label">AVG. ATTENDANCE</span>
          <span className="ul-stat-card__value">{avgAttendance}%</span>
          <span className="ul-stat-card__trend is-up">
            {avgEngagement}% <em>avg. engagement</em>
          </span>
        </div>
      </div>

      {/* ---- alerts / pending items ---- */}
      <div className={`ul-card ul-mgmt-alert-card${totalAlerts === 0 ? " is-clear" : ""}`}>
        <div className="ul-card__head">
          <span className={`ul-card__eyebrow${totalAlerts > 0 ? " ul-card__eyebrow--warning" : ""}`}>
            <IconAlert size={12} color={totalAlerts > 0 ? "var(--color-warning-accent)" : "var(--color-text-muted)"} /> Needs your attention
          </span>
          <h3>{totalAlerts > 0 ? `${totalAlerts} item${totalAlerts === 1 ? "" : "s"} pending in your scope` : "You're all caught up"}</h3>
        </div>
        {alertItems.length === 0 ? (
          <p className="ul-mgmt-empty">No pending approvals, requests, or staffing gaps in your scope right now.</p>
        ) : (
          <div className="ul-mgmt-alert-list">
            {alertItems.map((a) => (
              <div className="ul-mgmt-alert-row" key={a.key}>
                <span className="ul-mgmt-alert-row__count">{a.count}</span>
                <span className="ul-mgmt-alert-row__label">{a.label}</span>
                <Link className="ul-btn ul-btn--ghost ul-mgmt-alert-row__action" to={a.to}>Review</Link>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ---- bento grid ---- */}
      <div className="ul-bento">
        {/* column 1 */}
        <div className="ul-bento__col">
          <div className="ul-card ul-card--tall">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Roster monitoring · drill down for details</span>
              <h3>Sub-Units in Scope</h3>
            </div>
            {scopeUnits.map((u) => {
              const m = scopeMetrics.find((x) => x.unit.id === u.id);
              return (
                <div className="ul-mgmt-unit-row" key={u.id}>
                  <div className="ul-mgmt-unit-row__body">
                    <span className="ul-mgmt-unit-row__name">
                      <span className="ul-mgmt-type-tag">{u.type === ORG_UNIT_TYPE.REGION ? "Region" : "Branch"}</span>
                      {u.name}
                    </span>
                    <span className="ul-mgmt-unit-row__meta">
                      {m?.totalStaff ?? 0} staff · {u.students.toLocaleString()} students · {u.classesCount} classes
                      {u.headTeacher && u.headTeacher !== "Not yet assigned" ? ` · led by ${u.headTeacher}` : ""}
                    </span>
                  </div>
                  <div className="ul-mgmt-unit-row__bar">
                    <OrgBar pct={m?.staffAllocationPct ?? 0} />
                  </div>
                  <button type="button" className="ul-mgmt-detail-btn" onClick={() => setDetailUnitId(u.id)}>
                    Details <IconChevronDown size={12} />
                  </button>
                </div>
              );
            })}
          </div>

          <div className="ul-card">
            <div className="ul-card__head ul-mgmt-card-head-row">
              <div>
                <span className="ul-card__eyebrow">Date range</span>
                <h3>Attendance Trend</h3>
              </div>
              <select
                className="ul-usr-select ul-mgmt-range-select"
                value={trendDays}
                onChange={(e) => setTrendDays(Number(e.target.value))}
              >
                {TREND_RANGE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="ul-bars ul-mgmt-bars">
              {attendanceSeries.map((d) => (
                <div className="ul-bars__col" key={d.key}>
                  <div
                    className="ul-bars__fill"
                    style={{ height: `${d.value}%`, background: "var(--color-primary)" }}
                    title={`${d.day}: ${d.value}%`}
                  />
                </div>
              ))}
            </div>
            {trendDays === 7 && (
              <div className="ul-bars__labels ul-mgmt-bars__labels">
                {attendanceSeries.map((d) => (
                  <span key={d.key}>{d.day[0]}</span>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* column 2 */}
        <div className="ul-bento__col">
          <div className="ul-card ul-card--tall">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Verification visibility</span>
              <h3>Educator Verification Status</h3>
            </div>
            {scopedEducators.length === 0 && (
              <p className="ul-mgmt-empty">No staff assigned within this organizational unit yet.</p>
            )}
            <div className="ul-approval-list">
              {scopedEducators.map((e) => (
                <div className="ul-approval-row" key={e.id}>
                  <div className="ul-avatar-chip">{e.initials}</div>
                  <div className="ul-approval-row__body">
                    <span className="ul-approval-row__name">{e.name}</span>
                    <span className="ul-approval-row__meta">{(e.subjects || []).slice(0, 2).join(", ") || "—"}</span>
                  </div>
                  <span className={`ul-status-badge ${VERIFICATION_BADGE_CLASS[e.verificationStatus] || "is-pending"}`}>
                    {VERIFICATION_LABEL[e.verificationStatus] || e.verificationStatus}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="ul-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Engagement</span>
              <h3>Class Engagement</h3>
            </div>
            <div className="ul-split-bar">
              <div className="ul-split-bar__seg" style={{ width: `${avgEngagement}%`, background: "var(--color-primary)" }} />
              <div className="ul-split-bar__seg" style={{ width: `${100 - avgEngagement}%`, background: "var(--color-soft-pink)" }} />
            </div>
            <div className="ul-split-bar__labels">
              <span><i style={{ background: "var(--color-primary)" }} /> Actively engaged · {avgEngagement}%</span>
              <span><i style={{ background: "var(--color-soft-pink)" }} /> Low engagement · {100 - avgEngagement}%</span>
            </div>
          </div>

          <div className="ul-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow"><IconHistory size={12} /> Staff assignment history</span>
              <h3>Recent Activity</h3>
            </div>
            {recentActivity.length === 0 ? (
              <p className="ul-mgmt-empty">No staff-assignment activity in your scope yet.</p>
            ) : (
              <div className="ul-mgmt-activity-list">
                {recentActivity.map((h) => {
                  const who = educators.find((e) => e.id === h.educatorId);
                  const unit = orgUnits.find((u) => u.id === (h.newOrgUnitId || h.previousOrgUnitId));
                  return (
                    <div className="ul-mgmt-activity-row" key={h.id}>
                      <span className="ul-mgmt-activity-row__dot" />
                      <div className="ul-mgmt-activity-row__body">
                        <span className="ul-mgmt-activity-row__text">
                          <strong>{who?.name || h.educatorId}</strong> {HISTORY_VERB[h.action] || h.action.toLowerCase()}{" "}
                          {unit?.name || "this scope"}
                        </span>
                        <span className="ul-mgmt-activity-row__meta">{fmtWhen(h.timestamp)} · {h.performedBy}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* column 3 */}
        <div className="ul-bento__col">
          <div className="ul-card ul-card--tall">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Courses in scope</span>
              <h3>Courses by Scoped Staff</h3>
            </div>
            {scopedCourses.length === 0 && (
              <p className="ul-mgmt-empty">No courses authored by staff in this scope yet.</p>
            )}
            {scopedCourses.map((c) => (
              <div className="ul-mgmt-course-row" key={c.id}>
                <div>
                  <span className="ul-mgmt-course-row__title">{c.title}</span>
                  <span className="ul-mgmt-course-row__meta">by {c.educator}</span>
                </div>
                <span className={`ul-status-badge ${COURSE_BADGE_CLASS[c.status] || "is-pending"}`}>
                  {COURSE_STATUS_LABEL[c.status] || c.status}
                </span>
              </div>
            ))}
          </div>

          <div className="ul-card">
            <div className="ul-card__head">
              <span className="ul-card__eyebrow">Staffing health</span>
              <h3>Staff Allocation</h3>
            </div>
            <div className="ul-big-number">
              {avgAllocation}%
              <span className="ul-big-number__trend">of target staffing filled</span>
            </div>
            <div className="ul-checklist">
              {scopeMetrics.map((m) => (
                <div className="ul-checklist__item" key={m.unit.id}>
                  <span className={`ul-checklist__mark${m.openPositions === 0 ? " is-done" : ""}`}>
                    {m.openPositions === 0 && <IconCheck size={11} color="#fff" />}
                  </span>
                  <span className={m.openPositions === 0 ? "is-done-text" : ""}>
                    {m.unit.name} — {m.openPositions === 0 ? "fully staffed" : `${m.openPositions} open`}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ---- quick actions ---- */}
      <div className="ul-quick-actions ul-mgmt-quick-actions">
        <Link className="ul-quick-action" style={{ background: "var(--color-analytics-orange)" }} to="/admin/regionbranchhierarchy">
          <IconPlus size={16} color="#fff" />
          <span>Add a Teacher</span>
        </Link>
        <Link className="ul-quick-action" style={{ background: "var(--color-financial-cyan)" }} to="/admin/educatorverification">
          <IconTeach size={16} color="#fff" />
          <span>Review Scoped Staff Status</span>
        </Link>
        <Link className="ul-quick-action" style={{ background: "var(--color-regional-purple)" }} to="/admin/regionbranchhierarchy">
          <IconAlert size={16} color="#fff" />
          <span>Review Pending Requests{pendingRequests.length > 0 ? ` (${pendingRequests.length})` : ""}</span>
        </Link>
        <Link className="ul-quick-action" style={{ background: "var(--color-primary-dark)" }} to="/admin/regionbranchhierarchy">
          <IconBranch size={16} color="#fff" />
          <span>View Full Hierarchy</span>
        </Link>
      </div>

      {/* ---- drill-down detail modal ---- */}
      {detailUnit && (
        <div className="ul-confirm-backdrop" onClick={() => setDetailUnitId(null)}>
          <div className="ul-confirm-modal ul-mgmt-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-confirm-modal__header">
              <span className="ul-confirm-modal__icon">
                {detailUnit.type === ORG_UNIT_TYPE.REGION ? <IconGlobeAlias /> : <IconBranch size={16} color="var(--color-primary-dark)" />}
              </span>
              <button type="button" className="ul-confirm-modal__close" onClick={() => setDetailUnitId(null)} aria-label="Close">
                <IconClose size={15} />
              </button>
            </div>
            <h3 className="ul-confirm-modal__title">{detailUnit.name}</h3>
            <p className="ul-confirm-modal__desc">
              {detailUnit.type === ORG_UNIT_TYPE.REGION ? "Region" : "Branch"} · led by{" "}
              {detailUnit.headTeacher && detailUnit.headTeacher !== "Not yet assigned" ? detailUnit.headTeacher : "no one yet"}
            </p>

            <div className="ul-mgmt-detail-stats">
              <div><span>{detailMetrics?.totalStaff ?? 0}</span>Staff</div>
              <div><span>{detailUnit.students.toLocaleString()}</span>Students</div>
              <div><span>{detailUnit.classesCount}</span>Classes</div>
              <div><span>{detailMetrics?.openPositions ?? 0}</span>Open roles</div>
            </div>
            <OrgBar pct={detailMetrics?.staffAllocationPct ?? 0} />

            <span className="ul-mgmt-detail-subhead">Staff at this unit</span>
            {detailStaff.length === 0 ? (
              <p className="ul-mgmt-empty">No staff assigned here yet.</p>
            ) : (
              <div className="ul-mgmt-detail-list">
                {detailStaff.map((e) => (
                  <div className="ul-mgmt-detail-list__row" key={e.id}>
                    <span>{e.name}</span>
                    <span className={`ul-status-badge ${VERIFICATION_BADGE_CLASS[e.verificationStatus] || "is-pending"}`}>
                      {VERIFICATION_LABEL[e.verificationStatus] || e.verificationStatus}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <span className="ul-mgmt-detail-subhead">Courses from this unit's staff</span>
            {detailCourses.length === 0 ? (
              <p className="ul-mgmt-empty">No courses yet.</p>
            ) : (
              <div className="ul-mgmt-detail-list">
                {detailCourses.map((c) => (
                  <div className="ul-mgmt-detail-list__row" key={c.id}>
                    <span>{c.title}</span>
                    <span className={`ul-status-badge ${COURSE_BADGE_CLASS[c.status] || "is-pending"}`}>
                      {COURSE_STATUS_LABEL[c.status] || c.status}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {detailRequests.length > 0 && (
              <>
                <span className="ul-mgmt-detail-subhead">Pending requests for this unit</span>
                <div className="ul-mgmt-detail-list">
                  {detailRequests.map((r) => (
                    <div className="ul-mgmt-detail-list__row" key={r.id}>
                      <span>{r.requestType} · {r.requestedBy}</span>
                      <span className="ul-status-badge is-pending">Pending</span>
                    </div>
                  ))}
                </div>
              </>
            )}

            <div className="ul-confirm-modal__actions">
              <Link className="ul-btn ul-btn--ghost" to="/admin/regionbranchhierarchy" onClick={() => setDetailUnitId(null)}>
                Open in Hierarchy
              </Link>
              <button type="button" className="ul-btn ul-btn--primary" onClick={() => setDetailUnitId(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// Small local alias so the scope-note icon works even if IconGlobe isn't
// imported elsewhere on this page — keeps the icon set import list tight.
function IconGlobeAlias() {
  return <IconInstitution size={15} color="var(--color-primary-dark)" />;
}
