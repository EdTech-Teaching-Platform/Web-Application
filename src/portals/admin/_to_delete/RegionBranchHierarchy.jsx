// Region / Branch Hierarchy Builder + Staff Assignment
// Jira: Day 6 — Region/branch hierarchy + staff assignment
//
// Day 7 extension: the Hierarchy tab below is exactly the Day 6 tree +
// details editor (Add Region / Add Branch / Edit / Delete unchanged).
// Three new tabs sit alongside it, all backed by the richer
// ../data/staffAssignmentsMock.js store: Staff Assignments (branch
// metrics + who's assigned where, with Assign/Transfer/Remove), Requests
// (pending Assignment/Transfer requests an Admin can Approve/Reject) and
// History (the immutable Assigned/Transferred/Removed/Role Changed audit
// log). staffAssignmentsMock.js calls back into institutionsMock.js's
// assignStaffToUnit/unassignStaffFromUnit so each unit's staffIds roster
// (used by the Hierarchy tab's "staff count" chip) stays in sync
// automatically — nothing here has to update both stores by hand.
//
// Chrome (sidebar/topbar) comes from src/layouts/AdminLayout.jsx; this
// page reuses the same .ul-card / .ul-btn / .ul-status-badge /
// .ul-avatar-chip primitives, the .ul-usr-* toolbar/select/review-modal/
// reason-textarea/toast pattern and the .ul-edp-tabs tab pattern
// (EducatorProfile.jsx) so the look and interaction match exactly —
// layout specific to this screen lives in RegionBranchHierarchy.css.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInstitutions,
  addOrgUnit,
  updateOrgUnit,
  removeOrgUnit,
  ORG_UNIT_TYPE,
} from "../data/institutionsMock";
import { useEducators } from "../data/educatorsMock";
import {
  useAssignments,
  useAssignmentHistory,
  useStaffRequests,
  createAssignment,
  transferAssignment,
  endAssignment,
  createRequest,
  approveRequest,
  rejectRequest,
  hasActiveAssignment,
  getUnassignedEducators,
  getBranchMetrics,
  ASSIGNMENT_TYPE,
  ASSIGNMENT_STATUS,
  REQUEST_TYPE,
  REQUEST_STATUS,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_BADGE_CLASS,
  ROLE_OPTIONS,
  DEPARTMENT_OPTIONS,
} from "../data/staffAssignmentsMock";
import { useAuth } from "../../../hooks/useAuth";
import ConfirmModal from "../components/ConfirmModal";
import {
  IconSearch, IconClose, IconPlus, IconEdit, IconInstitution, IconBranch, IconUsers,
  IconChevronDown, IconRefresh, IconHistory, IconCheck, IconAlert,
} from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./InstitutionManagement.css";
import "./RegionBranchHierarchy.css";

const EMPTY_UNIT_FORM = { name: "", type: ORG_UNIT_TYPE.BRANCH, parentId: "", headTeacher: "" };

const TABS = [
  { key: "hierarchy", label: "Hierarchy" },
  { key: "assignments", label: "Staff Assignments" },
  { key: "requests", label: "Requests" },
  { key: "history", label: "History" },
];

function validateUnitForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Name is required.";
  return errors;
}

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtDate(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" });
}

function fmtDateTime(d) {
  if (!d) return "—";
  const dt = new Date(d);
  if (Number.isNaN(dt.getTime())) return d;
  return dt.toLocaleString(undefined, { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function pctTone(pct) {
  if (pct >= 100) return "is-full";
  if (pct >= 70) return "is-high";
  if (pct >= 35) return "is-mid";
  return "is-low";
}

function ProgressBar({ pct, label }) {
  const clamped = Math.max(0, Math.min(100, pct));
  return (
    <div className="ul-org-bar" title={`${label}: ${pct}%`}>
      <div className="ul-org-bar__track">
        <div className={`ul-org-bar__fill ${pctTone(clamped)}`} style={{ width: `${clamped}%` }} />
      </div>
      <span className="ul-org-bar__value">{pct}%</span>
    </div>
  );
}

// A unit row plus, recursively, its children (Branches nested under a
// Region) — the whole tree is just parentId lookups, no separate nested
// data structure to keep in sync.
function UnitNode({ unit, orgUnits, depth, selectedId, onSelect, staffCountOf }) {
  const children = orgUnits.filter((u) => u.parentId === unit.id);
  const [open, setOpen] = useState(true);
  const isSelected = selectedId === unit.id;

  return (
    <div className="ul-org-node">
      <button
        type="button"
        className={`ul-org-row${isSelected ? " is-selected" : ""}`}
        style={{ paddingLeft: 12 + depth * 20 }}
        onClick={() => onSelect(unit.id)}
      >
        {children.length > 0 ? (
          <span
            className={`ul-org-row__chevron${open ? " is-open" : ""}`}
            onClick={(e) => {
              e.stopPropagation();
              setOpen((v) => !v);
            }}
          >
            <IconChevronDown size={12} />
          </span>
        ) : (
          <span className="ul-org-row__chevron-spacer" />
        )}
        <span className="ul-org-row__icon">
          {unit.type === ORG_UNIT_TYPE.REGION ? <IconBranch size={13} /> : <IconInstitution size={13} />}
        </span>
        <span className="ul-org-row__body">
          <span className="ul-org-row__name">{unit.name}</span>
          <span className="ul-org-row__meta">{unit.type} · {unit.headTeacher}</span>
        </span>
        <span className="ul-org-row__staff">
          <IconUsers size={11} />
          {staffCountOf(unit)}
        </span>
      </button>

      {open && children.length > 0 && (
        <div className="ul-org-children">
          {children.map((child) => (
            <UnitNode
              key={child.id}
              unit={child}
              orgUnits={orgUnits}
              depth={depth + 1}
              selectedId={selectedId}
              onSelect={onSelect}
              staffCountOf={staffCountOf}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function RegionBranchHierarchy() {
  const { user } = useAuth();
  const performedBy = user?.name || "Admin User";

  const institutions = useInstitutions();
  const educators = useEducators();
  const assignments = useAssignments();
  const history = useAssignmentHistory();
  const requests = useStaffRequests();

  const [institutionId, setInstitutionId] = useState(institutions[0]?.id || "");
  const institution = institutions.find((i) => i.id === institutionId) || institutions[0] || null;

  const [activeTab, setActiveTab] = useState("hierarchy");

  const [selectedUnitId, setSelectedUnitId] = useState(null);

  const [unitFormMode, setUnitFormMode] = useState(null); // null | "add" | "edit"
  const [unitForm, setUnitForm] = useState(EMPTY_UNIT_FORM);
  const [unitFormTouched, setUnitFormTouched] = useState({});
  const [editingUnitId, setEditingUnitId] = useState(null);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  // ---- Assign Staff modal (two-step: pick educator -> assignment details) ----
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignUnitId, setAssignUnitId] = useState(null); // which unit this modal is assigning into
  const [assignStep, setAssignStep] = useState("pick"); // "pick" | "details"
  const [assignSearch, setAssignSearch] = useState("");
  const [assignDeptFilter, setAssignDeptFilter] = useState("");
  const [assignStatusFilter, setAssignStatusFilter] = useState(""); // "" | "unassigned" | "assigned"
  const [assignCandidate, setAssignCandidate] = useState(null); // educator object
  const [assignDetails, setAssignDetails] = useState(null);
  const [assignError, setAssignError] = useState("");

  // ---- Transfer Staff modal ----
  const [transferTarget, setTransferTarget] = useState(null); // assignment object
  const [transferForm, setTransferForm] = useState({ newOrgUnitId: "", effectiveDate: todayISO(), reason: "" });
  const [transferError, setTransferError] = useState("");

  // ---- Remove (end) assignment confirm ----
  const [removeTarget, setRemoveTarget] = useState(null); // assignment object
  const [removeReason, setRemoveReason] = useState("");

  // ---- Requests tab: reject reason + new-request form ----
  const [rejectTarget, setRejectTarget] = useState(null); // request object
  const [rejectReason, setRejectReason] = useState("");
  const [newRequestOpen, setNewRequestOpen] = useState(false);
  const [newRequestForm, setNewRequestForm] = useState(null);

  // ---- History tab search ----
  const [historySearch, setHistorySearch] = useState("");

  // Keep the selection valid as the institution switches or a unit is
  // removed elsewhere.
  useEffect(() => {
    setSelectedUnitId(null);
  }, [institutionId]);

  useEffect(() => {
    if (!institution || !selectedUnitId) return;
    if (!institution.orgUnits.some((u) => u.id === selectedUnitId)) setSelectedUnitId(null);
  }, [institution, selectedUnitId]);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const orgUnits = institution?.orgUnits || [];
  const topLevelUnits = orgUnits.filter((u) => !u.parentId);
  const regionOptions = orgUnits.filter((u) => u.type === ORG_UNIT_TYPE.REGION);
  const selectedUnit = orgUnits.find((u) => u.id === selectedUnitId) || null;
  const assignUnit = orgUnits.find((u) => u.id === assignUnitId) || null;

  const staffCountOf = (unit) => unit.staffIds.length;
  const unitLabel = (id) => orgUnits.find((u) => u.id === id)?.name || "—";

  const educatorById = useMemo(() => {
    const map = new Map();
    educators.forEach((e) => map.set(e.id, e));
    return map;
  }, [educators]);

  // Institution-scoped active assignments, newest first.
  const institutionAssignments = useMemo(() => {
    if (!institution) return [];
    return assignments.filter((a) => a.institutionId === institution.id && a.status === ASSIGNMENT_STATUS.ACTIVE);
  }, [assignments, institution]);

  const assignedStaff = useMemo(() => {
    if (!selectedUnit) return [];
    return institutionAssignments
      .filter((a) => a.orgUnitId === selectedUnit.id)
      .map((a) => ({ assignment: a, educator: educatorById.get(a.educatorId) }))
      .filter((r) => r.educator);
  }, [institutionAssignments, selectedUnit, educatorById]);

  const assignableEducators = useMemo(() => {
    if (!assignUnit) return [];
    const q = assignSearch.trim().toLowerCase();
    return educators.filter((e) => {
      if (e.verificationStatus !== "verified") return false;
      if (hasActiveAssignment(e.id, assignUnit.id)) return false;
      const activeCount = assignments.filter((a) => a.educatorId === e.id && a.status === ASSIGNMENT_STATUS.ACTIVE).length;
      if (assignStatusFilter === "unassigned" && activeCount > 0) return false;
      if (assignStatusFilter === "assigned" && activeCount === 0) return false;
      if (assignDeptFilter && !e.subjects.some((s) => s.toLowerCase().includes(assignDeptFilter.toLowerCase()))) return false;
      if (q && !`${e.name} ${e.id} ${e.subjects.join(" ")}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [educators, assignUnit, assignSearch, assignDeptFilter, assignStatusFilter, assignments]);

  const errors = useMemo(() => validateUnitForm(unitForm), [unitForm]);
  const isUnitFormValid = Object.keys(errors).length === 0;

  const branchMetrics = useMemo(() => (institution ? getBranchMetrics(institution) : []), [institution, assignments]);
  const unassignedEducators = useMemo(() => (institution ? getUnassignedEducators(institution.id) : []), [institution, assignments, educators]);

  const institutionRequests = useMemo(() => {
    if (!institution) return [];
    return requests.filter((r) => r.institutionId === institution.id);
  }, [requests, institution]);
  const pendingRequestCount = institutionRequests.filter((r) => r.status === REQUEST_STATUS.PENDING).length;

  const institutionHistory = useMemo(() => {
    if (!institution) return [];
    const q = historySearch.trim().toLowerCase();
    return history
      .filter((h) => h.institutionId === institution.id)
      .filter((h) => {
        if (!q) return true;
        const edu = educatorById.get(h.educatorId);
        return `${edu?.name || ""} ${h.action} ${h.performedBy}`.toLowerCase().includes(q);
      });
  }, [history, institution, historySearch, educatorById]);

  // ---------------- Hierarchy tab: add/edit/delete unit (unchanged) ----------------

  const openAddRegion = () => {
    setUnitForm({ name: "", type: ORG_UNIT_TYPE.REGION, parentId: "", headTeacher: "" });
    setUnitFormTouched({});
    setEditingUnitId(null);
    setUnitFormMode("add");
  };

  const openAddBranch = (parentId = "") => {
    setUnitForm({ name: "", type: ORG_UNIT_TYPE.BRANCH, parentId, headTeacher: "" });
    setUnitFormTouched({});
    setEditingUnitId(null);
    setUnitFormMode("add");
  };

  const openEditUnit = (unit) => {
    setUnitForm({ name: unit.name, type: unit.type, parentId: unit.parentId || "", headTeacher: unit.headTeacher === "Not yet assigned" ? "" : unit.headTeacher });
    setUnitFormTouched({});
    setEditingUnitId(unit.id);
    setUnitFormMode("edit");
  };

  const closeUnitForm = () => {
    setUnitFormMode(null);
    setEditingUnitId(null);
  };

  const handleUnitFormSubmit = (e) => {
    e.preventDefault();
    setUnitFormTouched({ name: true });
    if (!isUnitFormValid || !institution) return;

    if (unitFormMode === "add") {
      const created = addOrgUnit(institution.id, unitForm);
      setToast(`"${unitForm.name.trim()}" has been added.`);
      setSelectedUnitId(created.id);
    } else if (unitFormMode === "edit" && editingUnitId) {
      updateOrgUnit(institution.id, editingUnitId, unitForm);
      setToast(`"${unitForm.name.trim()}" has been updated.`);
    }
    closeUnitForm();
  };

  const confirmDelete = () => {
    if (!deleteTarget || !institution) return;
    removeOrgUnit(institution.id, deleteTarget.id);
    setToast(`"${deleteTarget.name}" has been removed.`);
    setDeleteTarget(null);
  };

  const childCountOf = (unitId) => orgUnits.filter((u) => u.parentId === unitId).length;

  // ---------------- Assign Staff (rich modal) ----------------

  const openAssignModal = (unitId) => {
    setAssignUnitId(unitId);
    setAssignOpen(true);
    setAssignStep("pick");
    setAssignSearch("");
    setAssignDeptFilter("");
    setAssignStatusFilter("");
    setAssignCandidate(null);
    setAssignError("");
  };

  const closeAssignModal = () => {
    setAssignOpen(false);
    setAssignUnitId(null);
    setAssignCandidate(null);
    setAssignDetails(null);
    setAssignError("");
  };

  const pickCandidate = (edu) => {
    setAssignCandidate(edu);
    setAssignDetails({
      role: ROLE_OPTIONS[0],
      department: DEPARTMENT_OPTIONS[0],
      subjects: edu.subjects.length ? [edu.subjects[0]] : [],
      classesSections: "",
      startDate: todayISO(),
      endDate: "",
      assignmentType: ASSIGNMENT_TYPE.PRIMARY,
    });
    setAssignError("");
    setAssignStep("details");
  };

  const toggleAssignSubject = (subj) => {
    setAssignDetails((d) => {
      const has = d.subjects.includes(subj);
      return { ...d, subjects: has ? d.subjects.filter((s) => s !== subj) : [...d.subjects, subj] };
    });
  };

  const submitAssignment = (e) => {
    e.preventDefault();
    if (!institution || !assignUnit || !assignCandidate || !assignDetails) return;
    const result = createAssignment({
      educatorId: assignCandidate.id,
      institutionId: institution.id,
      orgUnitId: assignUnit.id,
      role: assignDetails.role,
      department: assignDetails.department,
      subjects: assignDetails.subjects,
      classesSections: assignDetails.classesSections
        ? assignDetails.classesSections.split(",").map((s) => s.trim()).filter(Boolean)
        : [],
      startDate: assignDetails.startDate || todayISO(),
      assignmentType: assignDetails.assignmentType,
      performedBy,
      reason: `Assigned to ${assignUnit.name}.`,
    });
    if (!result.success) {
      setAssignError(result.error);
      return;
    }
    setToast(`${assignCandidate.name} has been assigned to ${assignUnit.name}.`);
    closeAssignModal();
  };

  const educatorCurrentAssignmentsLabel = (educatorId) => {
    const active = assignments.filter((a) => a.educatorId === educatorId && a.status === ASSIGNMENT_STATUS.ACTIVE);
    if (active.length === 0) return "Not currently assigned anywhere.";
    return active.map((a) => `${unitLabel(a.orgUnitId)} (${a.assignmentType})`).join(", ");
  };

  // ---------------- Transfer Staff ----------------

  const openTransfer = (assignment) => {
    setTransferTarget(assignment);
    setTransferForm({ newOrgUnitId: "", effectiveDate: todayISO(), reason: "" });
    setTransferError("");
  };

  const closeTransfer = () => {
    setTransferTarget(null);
    setTransferError("");
  };

  const submitTransfer = (e) => {
    e.preventDefault();
    if (!transferTarget || !transferForm.newOrgUnitId) {
      setTransferError("Choose a destination branch.");
      return;
    }
    const result = transferAssignment({
      assignmentId: transferTarget.id,
      newOrgUnitId: transferForm.newOrgUnitId,
      effectiveDate: transferForm.effectiveDate || todayISO(),
      reason: transferForm.reason || "Staff transfer.",
      performedBy,
    });
    if (!result.success) {
      setTransferError(result.error);
      return;
    }
    setToast(`${educatorById.get(transferTarget.educatorId)?.name || "Staff member"} has been transferred.`);
    closeTransfer();
  };

  // ---------------- Remove / end assignment ----------------

  const confirmRemove = () => {
    if (!removeTarget) return;
    const edu = educatorById.get(removeTarget.educatorId);
    endAssignment({ assignmentId: removeTarget.id, reason: removeReason || "Assignment ended.", performedBy });
    setToast(`${edu?.name || "Staff member"} has been removed from this unit.`);
    setRemoveTarget(null);
    setRemoveReason("");
  };

  // ---------------- Requests ----------------

  const openNewRequest = () => {
    setNewRequestForm({
      educatorId: educators.find((e) => e.verificationStatus === "verified")?.id || "",
      requestType: REQUEST_TYPE.ASSIGNMENT,
      currentOrgUnitId: "",
      requestedOrgUnitId: orgUnits[0]?.id || "",
      role: ROLE_OPTIONS[0],
      date: todayISO(),
      requestedBy: "",
      reason: "",
    });
    setNewRequestOpen(true);
  };

  const submitNewRequest = (e) => {
    e.preventDefault();
    if (!institution || !newRequestForm) return;
    createRequest({ ...newRequestForm, institutionId: institution.id });
    setToast("Request submitted for Admin review.");
    setNewRequestOpen(false);
  };

  const handleApprove = (request) => {
    const result = approveRequest(request.id, performedBy);
    if (!result.success) {
      setToast(result.error || "Could not approve this request.");
      return;
    }
    setToast("Request approved and applied.");
  };

  const submitReject = () => {
    if (!rejectTarget) return;
    rejectRequest(rejectTarget.id, rejectReason, performedBy);
    setToast("Request rejected.");
    setRejectTarget(null);
    setRejectReason("");
  };

  if (!institution) {
    return (
      <div className="ul-org-header">
        <h2 className="ul-org-header__title">Region / Branch Hierarchy</h2>
        <p className="ul-org-header__subtitle">No institutions onboarded yet — onboard one in Institution Management first.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="ul-org-header">
        <div>
          <h2 className="ul-org-header__title">Region / Branch Hierarchy &amp; Staff Assignment</h2>
          <p className="ul-org-header__subtitle">
            Build the region/branch structure for an institution, assign and transfer teaching staff, review
            assignment/transfer requests and the audit history — all scoped strictly to that institution.
          </p>
        </div>
        <select
          className="ul-usr-select ul-org-institution-select"
          value={institution.id}
          onChange={(e) => setInstitutionId(e.target.value)}
        >
          {institutions.map((i) => (
            <option key={i.id} value={i.id}>{i.name}</option>
          ))}
        </select>
      </div>

      <div className="ul-edp-tabs ul-org-tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`ul-edp-tab${activeTab === t.key ? " is-active" : ""}`}
            onClick={() => setActiveTab(t.key)}
          >
            {t.label}
            {t.key === "requests" && pendingRequestCount > 0 && <span className="ul-edp-tab__dot" />}
          </button>
        ))}
      </div>

      {activeTab === "hierarchy" && (
        <div className="ul-org-layout">
          {/* ---------- left: structure tree ---------- */}
          <div className="ul-card ul-org-tree-card">
            <div className="ul-org-tree-card__head">
              <p className="ul-org-tree-card__title">Organization Structure</p>
              <button type="button" className="ul-btn ul-btn--ghost ul-org-add-btn" onClick={openAddRegion}>
                <IconPlus size={12} />
                <span>Add Region</span>
              </button>
            </div>

            {topLevelUnits.length === 0 ? (
              <div className="ul-usr-empty">
                No regions or branches yet.
                <div style={{ marginTop: 10 }}>
                  <button type="button" className="ul-btn ul-btn--primary" onClick={() => openAddBranch("")}>
                    Add first Branch
                  </button>
                </div>
              </div>
            ) : (
              <div className="ul-org-tree">
                {topLevelUnits.map((unit) => (
                  <UnitNode
                    key={unit.id}
                    unit={unit}
                    orgUnits={orgUnits}
                    depth={0}
                    selectedId={selectedUnitId}
                    onSelect={setSelectedUnitId}
                    staffCountOf={staffCountOf}
                  />
                ))}
              </div>
            )}

            <div className="ul-org-tree-card__foot">
              <button type="button" className="ul-btn ul-btn--ghost ul-org-add-btn" onClick={() => openAddBranch("")}>
                <IconPlus size={12} />
                <span>Add Standalone Branch</span>
              </button>
            </div>
          </div>

          {/* ---------- right: unit details ---------- */}
          <div className="ul-card ul-org-details-card">
            {!selectedUnit ? (
              <div className="ul-usr-empty ul-org-details-empty">
                Select a region or branch from the structure on the left to view its details and assigned staff.
              </div>
            ) : (
              <>
                <div className="ul-org-details__head">
                  <div className="ul-org-details__head-icon">
                    {selectedUnit.type === ORG_UNIT_TYPE.REGION ? <IconBranch size={16} /> : <IconInstitution size={16} />}
                  </div>
                  <div className="ul-org-details__head-text">
                    <p className="ul-org-details__title">{selectedUnit.name}</p>
                    <p className="ul-org-details__sub">{selectedUnit.type} · {selectedUnit.id}</p>
                  </div>
                  <button type="button" className="ul-inst-icon-btn" onClick={() => openEditUnit(selectedUnit)} aria-label="Edit unit" title="Edit">
                    <IconEdit size={13} />
                  </button>
                </div>

                <div className="ul-usr-review-meta ul-org-details__meta">
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Head Teacher</p>
                    <p className="ul-usr-review-meta__value">{selectedUnit.headTeacher}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Educators (rostered)</p>
                    <p className="ul-usr-review-meta__value">{selectedUnit.educators}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Students</p>
                    <p className="ul-usr-review-meta__value">{selectedUnit.students}</p>
                  </div>
                  {selectedUnit.type === ORG_UNIT_TYPE.REGION && (
                    <div className="ul-usr-review-meta__item">
                      <p className="ul-usr-review-meta__label">Branches beneath</p>
                      <p className="ul-usr-review-meta__value">{childCountOf(selectedUnit.id)}</p>
                    </div>
                  )}
                </div>

                {selectedUnit.type === ORG_UNIT_TYPE.REGION && (
                  <button
                    type="button"
                    className="ul-btn ul-btn--ghost ul-org-add-btn"
                    style={{ marginTop: 14 }}
                    onClick={() => openAddBranch(selectedUnit.id)}
                  >
                    <IconPlus size={12} />
                    <span>Add Branch under this Region</span>
                  </button>
                )}

                <div className="ul-org-staff-section">
                  <div className="ul-org-staff-section__head">
                    <p className="ul-usr-review-section__title">Assigned Staff ({assignedStaff.length})</p>
                    <button type="button" className="ul-btn ul-btn--primary ul-usr-btn-sm" onClick={() => openAssignModal(selectedUnit.id)}>
                      <IconPlus size={11} />
                      <span>Assign Staff</span>
                    </button>
                  </div>

                  {assignedStaff.length === 0 ? (
                    <p className="ul-usr-review-meta__value ul-usr-review-meta__value--muted">
                      No staff assigned to this unit yet.
                    </p>
                  ) : (
                    <div className="ul-org-staff-list">
                      {assignedStaff.map(({ assignment, educator: edu }) => (
                        <div key={assignment.id} className="ul-org-staff-row">
                          <div className="ul-avatar-chip ul-usr-avatar" style={{ background: "var(--color-soft-pink)" }}>{edu.initials}</div>
                          <div className="ul-org-staff-row__body">
                            <p className="ul-org-staff-row__name">{edu.name}</p>
                            <p className="ul-org-staff-row__meta">
                              {assignment.role} · {assignment.department}
                              <span className={`ul-org-type-pill ${assignment.assignmentType === ASSIGNMENT_TYPE.PRIMARY ? "is-primary" : "is-secondary"}`}>
                                {assignment.assignmentType}
                              </span>
                            </p>
                          </div>
                          <span className="ul-status-badge is-verified">Verified</span>
                          <button type="button" className="ul-btn ul-btn--ghost ul-usr-btn-sm" onClick={() => openTransfer(assignment)}>
                            <IconRefresh size={11} />
                            <span>Transfer</span>
                          </button>
                          <button
                            type="button"
                            className="ul-btn ul-btn--danger ul-usr-btn-sm"
                            onClick={() => setRemoveTarget(assignment)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="ul-org-details__footer">
                  <button type="button" className="ul-btn ul-btn--danger" onClick={() => setDeleteTarget(selectedUnit)}>
                    Delete {selectedUnit.type}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {activeTab === "assignments" && (
        <div className="ul-org-assignments-tab">
          <div className="ul-card ul-org-metrics-card">
            <div className="ul-org-tree-card__head">
              <p className="ul-org-tree-card__title">Branch Metrics</p>
              <span className="ul-usr-review-meta__value--muted" style={{ fontSize: 11 }}>
                {unassignedEducators.length} unassigned educator{unassignedEducators.length === 1 ? "" : "s"} available institution-wide
              </span>
            </div>
            <div className="ul-org-table-wrap">
              <table className="ul-org-table">
                <thead>
                  <tr>
                    <th>Branch / Region</th>
                    <th>Students</th>
                    <th>Educators</th>
                    <th>Classes</th>
                    <th>Total Staff</th>
                    <th>Unassigned</th>
                    <th>Open Positions</th>
                    <th>Staff Allocation</th>
                    <th>Teacher Workload</th>
                  </tr>
                </thead>
                <tbody>
                  {branchMetrics.map((m) => (
                    <tr key={m.unit.id} className={selectedUnitId === m.unit.id ? "is-selected" : ""}>
                      <td>
                        <button type="button" className="ul-org-table-linkbtn" onClick={() => { setSelectedUnitId(m.unit.id); setActiveTab("hierarchy"); }}>
                          {m.unit.name}
                        </button>
                        <span className="ul-org-row__meta" style={{ display: "block" }}>{m.unit.type}</span>
                      </td>
                      <td>{m.unit.students}</td>
                      <td>{m.unit.educators}</td>
                      <td>{m.unit.classesCount}</td>
                      <td>{m.totalStaff}</td>
                      <td>{Math.max(0, m.unit.targetStaff - m.totalStaff) > 0 ? m.unit.targetStaff - m.totalStaff : 0}</td>
                      <td>{m.openPositions}</td>
                      <td><ProgressBar pct={m.staffAllocationPct} label="Staff allocation" /></td>
                      <td><ProgressBar pct={m.teacherWorkloadPct} label="Teacher workload" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="ul-card ul-org-metrics-card">
            <div className="ul-org-tree-card__head">
              <p className="ul-org-tree-card__title">Current Assignments ({institutionAssignments.length})</p>
            </div>
            {institutionAssignments.length === 0 ? (
              <div className="ul-usr-empty">No active staff assignments in this institution yet.</div>
            ) : (
              <div className="ul-org-table-wrap">
                <table className="ul-org-table">
                  <thead>
                    <tr>
                      <th>Staff</th>
                      <th>Branch / Region</th>
                      <th>Role</th>
                      <th>Type</th>
                      <th>Start Date</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {institutionAssignments.map((a) => {
                      const edu = educatorById.get(a.educatorId);
                      if (!edu) return null;
                      return (
                        <tr key={a.id}>
                          <td>
                            <div className="ul-org-cell-person">
                              <div className="ul-avatar-chip ul-usr-avatar">{edu.initials}</div>
                              <span>{edu.name}</span>
                            </div>
                          </td>
                          <td>{unitLabel(a.orgUnitId)}</td>
                          <td>{a.role}</td>
                          <td>
                            <span className={`ul-org-type-pill ${a.assignmentType === ASSIGNMENT_TYPE.PRIMARY ? "is-primary" : "is-secondary"}`}>
                              {a.assignmentType}
                            </span>
                          </td>
                          <td>{fmtDate(a.startDate)}</td>
                          <td>
                            <div className="ul-org-table-actions">
                              <button type="button" className="ul-btn ul-btn--ghost ul-usr-btn-sm" onClick={() => openTransfer(a)}>
                                <IconRefresh size={11} />
                                <span>Transfer</span>
                              </button>
                              <button type="button" className="ul-btn ul-btn--danger ul-usr-btn-sm" onClick={() => setRemoveTarget(a)}>
                                Remove
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === "requests" && (
        <div className="ul-card ul-org-metrics-card">
          <div className="ul-org-tree-card__head">
            <p className="ul-org-tree-card__title">Assignment / Transfer Requests</p>
            <button type="button" className="ul-btn ul-btn--ghost ul-org-add-btn" onClick={openNewRequest}>
              <IconPlus size={12} />
              <span>New Request</span>
            </button>
          </div>
          {institutionRequests.length === 0 ? (
            <div className="ul-usr-empty">No assignment or transfer requests for this institution.</div>
          ) : (
            <div className="ul-org-table-wrap">
              <table className="ul-org-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Current → Requested Branch</th>
                    <th>Type</th>
                    <th>Role / Date</th>
                    <th>Requested By</th>
                    <th>Reason</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {institutionRequests.map((r) => {
                    const edu = educatorById.get(r.educatorId);
                    return (
                      <tr key={r.id}>
                        <td>
                          <div className="ul-org-cell-person">
                            <div className="ul-avatar-chip ul-usr-avatar">{edu?.initials || "?"}</div>
                            <span>{edu?.name || r.educatorId}</span>
                          </div>
                        </td>
                        <td className="ul-org-cell-muted">
                          {r.currentOrgUnitId ? unitLabel(r.currentOrgUnitId) : "—"} → {unitLabel(r.requestedOrgUnitId)}
                        </td>
                        <td>{r.requestType}</td>
                        <td className="ul-org-cell-muted">{r.role}<br />{fmtDate(r.date)}</td>
                        <td>{r.requestedBy}</td>
                        <td className="ul-org-cell-reason" title={r.reason}>{r.reason}</td>
                        <td>
                          <span className={`ul-status-badge ${REQUEST_STATUS_BADGE_CLASS[r.status]}`}>
                            {REQUEST_STATUS_LABEL[r.status]}
                          </span>
                          {r.status === REQUEST_STATUS.REJECTED && r.decisionReason && (
                            <p className="ul-org-row__meta" style={{ marginTop: 3 }}>{r.decisionReason}</p>
                          )}
                        </td>
                        <td>
                          {r.status === REQUEST_STATUS.PENDING ? (
                            <div className="ul-org-table-actions">
                              <button type="button" className="ul-btn ul-btn--primary ul-usr-btn-sm" onClick={() => handleApprove(r)}>
                                <IconCheck size={11} />
                                <span>Approve</span>
                              </button>
                              <button type="button" className="ul-btn ul-btn--danger ul-usr-btn-sm" onClick={() => { setRejectTarget(r); setRejectReason(""); }}>
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="ul-org-row__meta">
                              {r.decidedBy ? `by ${r.decidedBy}` : ""}{r.decidedAt ? ` · ${fmtDate(r.decidedAt)}` : ""}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === "history" && (
        <div className="ul-card ul-org-metrics-card">
          <div className="ul-org-tree-card__head">
            <p className="ul-org-tree-card__title">Assignment History &amp; Audit Log</p>
            <label className="ul-usr-search" style={{ minWidth: 220 }}>
              <IconSearch size={13} color="var(--color-text-muted)" />
              <input
                type="text"
                placeholder="Search staff, action or performed by…"
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
              />
            </label>
          </div>
          {institutionHistory.length === 0 ? (
            <div className="ul-usr-empty">No history recorded yet for this institution.</div>
          ) : (
            <div className="ul-org-table-wrap">
              <table className="ul-org-table">
                <thead>
                  <tr>
                    <th>Staff</th>
                    <th>Previous → New Branch</th>
                    <th>Action</th>
                    <th>Date / Time</th>
                    <th>Performed By</th>
                    <th>Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {institutionHistory.map((h) => {
                    const edu = educatorById.get(h.educatorId);
                    return (
                      <tr key={h.id}>
                        <td>
                          <div className="ul-org-cell-person">
                            <div className="ul-avatar-chip ul-usr-avatar">{edu?.initials || "?"}</div>
                            <span>{edu?.name || h.educatorId}</span>
                          </div>
                        </td>
                        <td className="ul-org-cell-muted">
                          {h.previousOrgUnitId ? unitLabel(h.previousOrgUnitId) : "—"} → {h.newOrgUnitId ? unitLabel(h.newOrgUnitId) : "—"}
                        </td>
                        <td>
                          <span className="ul-org-history-action">
                            <IconHistory size={11} />
                            {h.action}
                          </span>
                        </td>
                        <td className="ul-org-cell-muted">{fmtDateTime(h.timestamp)}</td>
                        <td>{h.performedBy}</td>
                        <td className="ul-org-cell-reason" title={h.reason}>{h.reason}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ---------- Add / Edit unit form ---------- */}
      {unitFormMode && (
        <div className="ul-usr-review-backdrop" onClick={closeUnitForm}>
          <div
            className="ul-usr-review-modal ul-inst-form-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={unitFormMode === "add" ? "Add organizational unit" : `Edit ${unitForm.name}`}
          >
            <div className="ul-usr-review-modal__head">
              <div className="ul-usr-review-modal__header">
                <div className="ul-usr-review-modal__header-text">
                  <h3 className="ul-usr-review-modal__title">
                    {unitFormMode === "add" ? `Add ${unitForm.type}` : `Edit ${unitForm.type}`}
                  </h3>
                  <p className="ul-usr-review-modal__sub">
                    {unitFormMode === "add"
                      ? "Create a new organizational unit within this institution."
                      : "Update this unit's name and head teacher."}
                  </p>
                </div>
                <button type="button" className="ul-usr-review-modal__close" onClick={closeUnitForm} aria-label="Close">
                  <IconClose size={15} />
                </button>
              </div>
            </div>

            <form onSubmit={handleUnitFormSubmit}>
              <div className="ul-usr-review-modal__body">
                <div className="ul-inst-form-grid">
                  <label className="ul-inst-field ul-inst-field--full">
                    <span className="ul-inst-field__label">Name</span>
                    <input
                      type="text"
                      value={unitForm.name}
                      onChange={(e) => setUnitForm((f) => ({ ...f, name: e.target.value }))}
                      onBlur={() => setUnitFormTouched((t) => ({ ...t, name: true }))}
                      placeholder={unitForm.type === ORG_UNIT_TYPE.REGION ? "e.g. Chennai Region" : "e.g. Chennai — Adyar Branch"}
                    />
                    {unitFormTouched.name && errors.name && <span className="ul-inst-field__error">{errors.name}</span>}
                  </label>

                  {unitFormMode === "add" && unitForm.type === ORG_UNIT_TYPE.BRANCH && (
                    <label className="ul-inst-field">
                      <span className="ul-inst-field__label">Parent Region</span>
                      <select
                        value={unitForm.parentId}
                        onChange={(e) => setUnitForm((f) => ({ ...f, parentId: e.target.value }))}
                      >
                        <option value="">None — standalone branch</option>
                        {regionOptions.map((r) => (
                          <option key={r.id} value={r.id}>{r.name}</option>
                        ))}
                      </select>
                    </label>
                  )}

                  {unitFormMode === "edit" && (
                    <label className="ul-inst-field">
                      <span className="ul-inst-field__label">Type</span>
                      <input type="text" value={unitForm.type} disabled />
                    </label>
                  )}

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Head Teacher</span>
                    <input
                      type="text"
                      value={unitForm.headTeacher}
                      onChange={(e) => setUnitForm((f) => ({ ...f, headTeacher: e.target.value }))}
                      placeholder="Full name (optional — can assign later)"
                    />
                  </label>
                </div>
              </div>

              <div className="ul-usr-review-modal__actions">
                <button type="button" className="ul-btn ul-btn--ghost" onClick={closeUnitForm}>
                  Cancel
                </button>
                <button type="submit" className="ul-btn ul-btn--primary" disabled={!isUnitFormValid}>
                  {unitFormMode === "add" ? `Add ${unitForm.type}` : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- Assign Staff modal (rich) ---------- */}
      {assignOpen && assignUnit && (
        <div className="ul-usr-review-backdrop" onClick={closeAssignModal}>
          <div
            className="ul-usr-review-modal ul-org-assign-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Assign staff to ${assignUnit.name}`}
          >
            <div className="ul-usr-review-modal__head">
              <div className="ul-usr-review-modal__header">
                <div className="ul-usr-review-modal__header-text">
                  <h3 className="ul-usr-review-modal__title">Assign Staff</h3>
                  <p className="ul-usr-review-modal__sub">
                    {assignStep === "pick" ? `To ${assignUnit.name} — only verified educators can be assigned.` : `Assigning ${assignCandidate?.name} to ${assignUnit.name}`}
                  </p>
                </div>
                <button type="button" className="ul-usr-review-modal__close" onClick={closeAssignModal} aria-label="Close">
                  <IconClose size={15} />
                </button>
              </div>

              {assignStep === "pick" && (
                <div className="ul-org-filter-row">
                  <label className="ul-usr-search" style={{ flex: "1 1 220px" }}>
                    <IconSearch size={14} color="var(--color-text-muted)" />
                    <input
                      type="text"
                      placeholder="Search by name or employee ID…"
                      value={assignSearch}
                      onChange={(e) => setAssignSearch(e.target.value)}
                      autoFocus
                    />
                  </label>
                  <select className="ul-usr-select" value={assignDeptFilter} onChange={(e) => setAssignDeptFilter(e.target.value)}>
                    <option value="">All subjects</option>
                    {DEPARTMENT_OPTIONS.map((d) => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                  <select className="ul-usr-select" value={assignStatusFilter} onChange={(e) => setAssignStatusFilter(e.target.value)}>
                    <option value="">Any status</option>
                    <option value="unassigned">Unassigned</option>
                    <option value="assigned">Already assigned elsewhere</option>
                  </select>
                </div>
              )}
            </div>

            <div className="ul-usr-review-modal__body">
              {assignStep === "pick" ? (
                assignableEducators.length === 0 ? (
                  <p className="ul-usr-review-meta__value ul-usr-review-meta__value--muted">
                    No matching verified educators available to assign.
                  </p>
                ) : (
                  <div className="ul-org-staff-list">
                    {assignableEducators.map((edu) => (
                      <div key={edu.id} className="ul-org-staff-row">
                        <div className="ul-avatar-chip ul-usr-avatar">{edu.initials}</div>
                        <div className="ul-org-staff-row__body">
                          <p className="ul-org-staff-row__name">{edu.name} <span className="ul-org-row__meta">· {edu.id}</span></p>
                          <p className="ul-org-staff-row__meta">{edu.subjects.join(", ")} — {educatorCurrentAssignmentsLabel(edu.id)}</p>
                        </div>
                        <button type="button" className="ul-btn ul-btn--primary ul-usr-btn-sm" onClick={() => pickCandidate(edu)}>
                          Assign
                        </button>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                <form id="assign-details-form" onSubmit={submitAssignment}>
                  <div className="ul-org-preview">
                    <span className="ul-org-preview__label">Current</span>
                    <span className="ul-org-preview__value">{educatorCurrentAssignmentsLabel(assignCandidate.id)}</span>
                    <IconRefresh size={12} />
                    <span className="ul-org-preview__label">New</span>
                    <span className="ul-org-preview__value ul-org-preview__value--new">{assignUnit.name}</span>
                  </div>

                  <div className="ul-inst-form-grid" style={{ marginTop: 14 }}>
                    <label className="ul-inst-field">
                      <span className="ul-inst-field__label">Role</span>
                      <select value={assignDetails.role} onChange={(e) => setAssignDetails((d) => ({ ...d, role: e.target.value }))}>
                        {ROLE_OPTIONS.map((r) => (
                          <option key={r} value={r}>{r}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ul-inst-field">
                      <span className="ul-inst-field__label">Department</span>
                      <select value={assignDetails.department} onChange={(e) => setAssignDetails((d) => ({ ...d, department: e.target.value }))}>
                        {DEPARTMENT_OPTIONS.map((d) => (
                          <option key={d} value={d}>{d}</option>
                        ))}
                      </select>
                    </label>
                    <label className="ul-inst-field ul-inst-field--full">
                      <span className="ul-inst-field__label">Subjects</span>
                      <div className="ul-org-chip-picker">
                        {assignCandidate.subjects.map((s) => (
                          <button
                            type="button"
                            key={s}
                            className={`ul-org-chip${assignDetails.subjects.includes(s) ? " is-selected" : ""}`}
                            onClick={() => toggleAssignSubject(s)}
                          >
                            {s}
                          </button>
                        ))}
                      </div>
                    </label>
                    <label className="ul-inst-field ul-inst-field--full">
                      <span className="ul-inst-field__label">Classes / Sections</span>
                      <input
                        type="text"
                        placeholder="e.g. Grade 9-A, Grade 10-B"
                        value={assignDetails.classesSections}
                        onChange={(e) => setAssignDetails((d) => ({ ...d, classesSections: e.target.value }))}
                      />
                    </label>
                    <label className="ul-inst-field">
                      <span className="ul-inst-field__label">Start Date</span>
                      <input type="date" value={assignDetails.startDate} onChange={(e) => setAssignDetails((d) => ({ ...d, startDate: e.target.value }))} />
                    </label>
                    <label className="ul-inst-field">
                      <span className="ul-inst-field__label">End Date (optional)</span>
                      <input type="date" value={assignDetails.endDate} onChange={(e) => setAssignDetails((d) => ({ ...d, endDate: e.target.value }))} />
                    </label>
                    <label className="ul-inst-field ul-inst-field--full">
                      <span className="ul-inst-field__label">Assignment Type</span>
                      <div className="ul-org-segment">
                        {[ASSIGNMENT_TYPE.PRIMARY, ASSIGNMENT_TYPE.SECONDARY].map((t) => (
                          <button
                            type="button"
                            key={t}
                            className={`ul-org-segment__btn${assignDetails.assignmentType === t ? " is-active" : ""}`}
                            onClick={() => setAssignDetails((d) => ({ ...d, assignmentType: t }))}
                          >
                            {t}
                          </button>
                        ))}
                      </div>
                    </label>
                  </div>

                  {assignError && <p className="ul-inst-field__error" style={{ marginTop: 10 }}>{assignError}</p>}
                </form>
              )}
            </div>

            <div className="ul-usr-review-modal__actions">
              {assignStep === "details" ? (
                <>
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setAssignStep("pick")}>
                    Back
                  </button>
                  <button type="submit" form="assign-details-form" className="ul-btn ul-btn--primary">
                    Confirm Assignment
                  </button>
                </>
              ) : (
                <button type="button" className="ul-btn ul-btn--ghost" onClick={closeAssignModal}>
                  Done
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Transfer Staff modal ---------- */}
      {transferTarget && (
        <div className="ul-usr-review-backdrop" onClick={closeTransfer}>
          <div
            className="ul-usr-review-modal ul-org-assign-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Transfer staff"
          >
            <div className="ul-usr-review-modal__head">
              <div className="ul-usr-review-modal__header">
                <div className="ul-usr-review-modal__header-text">
                  <h3 className="ul-usr-review-modal__title">Transfer Staff</h3>
                  <p className="ul-usr-review-modal__sub">{educatorById.get(transferTarget.educatorId)?.name}</p>
                </div>
                <button type="button" className="ul-usr-review-modal__close" onClick={closeTransfer} aria-label="Close">
                  <IconClose size={15} />
                </button>
              </div>
            </div>

            <form onSubmit={submitTransfer}>
              <div className="ul-usr-review-modal__body">
                <div className="ul-org-preview">
                  <span className="ul-org-preview__label">Current Branch</span>
                  <span className="ul-org-preview__value">{unitLabel(transferTarget.orgUnitId)}</span>
                  <IconRefresh size={12} />
                  <span className="ul-org-preview__label">New Branch</span>
                  <span className="ul-org-preview__value ul-org-preview__value--new">
                    {transferForm.newOrgUnitId ? unitLabel(transferForm.newOrgUnitId) : "— choose below —"}
                  </span>
                </div>

                <div className="ul-inst-form-grid" style={{ marginTop: 14 }}>
                  <label className="ul-inst-field ul-inst-field--full">
                    <span className="ul-inst-field__label">New Branch / Region</span>
                    <select
                      value={transferForm.newOrgUnitId}
                      onChange={(e) => setTransferForm((f) => ({ ...f, newOrgUnitId: e.target.value }))}
                    >
                      <option value="">Select destination…</option>
                      {orgUnits.filter((u) => u.id !== transferTarget.orgUnitId).map((u) => (
                        <option key={u.id} value={u.id}>{u.name} ({u.type})</option>
                      ))}
                    </select>
                  </label>
                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Effective Date</span>
                    <input
                      type="date"
                      value={transferForm.effectiveDate}
                      onChange={(e) => setTransferForm((f) => ({ ...f, effectiveDate: e.target.value }))}
                    />
                  </label>
                  <label className="ul-inst-field ul-inst-field--full">
                    <span className="ul-inst-field__label">Reason</span>
                    <textarea
                      className="ul-usr-reason"
                      rows={3}
                      placeholder="Why is this transfer happening?"
                      value={transferForm.reason}
                      onChange={(e) => setTransferForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </label>
                </div>
                {transferError && <p className="ul-inst-field__error" style={{ marginTop: 10 }}>{transferError}</p>}
              </div>

              <div className="ul-usr-review-modal__actions">
                <button type="button" className="ul-btn ul-btn--ghost" onClick={closeTransfer}>
                  Cancel
                </button>
                <button type="submit" className="ul-btn ul-btn--primary">
                  Confirm Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- New Request modal ---------- */}
      {newRequestOpen && newRequestForm && (
        <div className="ul-usr-review-backdrop" onClick={() => setNewRequestOpen(false)}>
          <div
            className="ul-usr-review-modal ul-org-assign-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="New staff request"
          >
            <div className="ul-usr-review-modal__head">
              <div className="ul-usr-review-modal__header">
                <div className="ul-usr-review-modal__header-text">
                  <h3 className="ul-usr-review-modal__title">New Assignment / Transfer Request</h3>
                  <p className="ul-usr-review-modal__sub">Submitted for Admin review — nothing changes until it's approved.</p>
                </div>
                <button type="button" className="ul-usr-review-modal__close" onClick={() => setNewRequestOpen(false)} aria-label="Close">
                  <IconClose size={15} />
                </button>
              </div>
            </div>
            <form onSubmit={submitNewRequest}>
              <div className="ul-usr-review-modal__body">
                <div className="ul-inst-form-grid">
                  <label className="ul-inst-field ul-inst-field--full">
                    <span className="ul-inst-field__label">Staff Member</span>
                    <select value={newRequestForm.educatorId} onChange={(e) => setNewRequestForm((f) => ({ ...f, educatorId: e.target.value }))}>
                      {educators.filter((e) => e.verificationStatus === "verified").map((e) => (
                        <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                      ))}
                    </select>
                  </label>
                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Request Type</span>
                    <div className="ul-org-segment">
                      {[REQUEST_TYPE.ASSIGNMENT, REQUEST_TYPE.TRANSFER].map((t) => (
                        <button
                          type="button"
                          key={t}
                          className={`ul-org-segment__btn${newRequestForm.requestType === t ? " is-active" : ""}`}
                          onClick={() => setNewRequestForm((f) => ({ ...f, requestType: t }))}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </label>
                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Role</span>
                    <select value={newRequestForm.role} onChange={(e) => setNewRequestForm((f) => ({ ...f, role: e.target.value }))}>
                      {ROLE_OPTIONS.map((r) => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </label>
                  {newRequestForm.requestType === REQUEST_TYPE.TRANSFER && (
                    <label className="ul-inst-field">
                      <span className="ul-inst-field__label">Current Branch</span>
                      <select value={newRequestForm.currentOrgUnitId} onChange={(e) => setNewRequestForm((f) => ({ ...f, currentOrgUnitId: e.target.value }))}>
                        <option value="">Select…</option>
                        {orgUnits.map((u) => (
                          <option key={u.id} value={u.id}>{u.name}</option>
                        ))}
                      </select>
                    </label>
                  )}
                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Requested Branch</span>
                    <select value={newRequestForm.requestedOrgUnitId} onChange={(e) => setNewRequestForm((f) => ({ ...f, requestedOrgUnitId: e.target.value }))}>
                      {orgUnits.map((u) => (
                        <option key={u.id} value={u.id}>{u.name}</option>
                      ))}
                    </select>
                  </label>
                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Date</span>
                    <input type="date" value={newRequestForm.date} onChange={(e) => setNewRequestForm((f) => ({ ...f, date: e.target.value }))} />
                  </label>
                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Requested By</span>
                    <input
                      type="text"
                      placeholder="e.g. Head Teacher name"
                      value={newRequestForm.requestedBy}
                      onChange={(e) => setNewRequestForm((f) => ({ ...f, requestedBy: e.target.value }))}
                    />
                  </label>
                  <label className="ul-inst-field ul-inst-field--full">
                    <span className="ul-inst-field__label">Reason</span>
                    <textarea
                      className="ul-usr-reason"
                      rows={3}
                      value={newRequestForm.reason}
                      onChange={(e) => setNewRequestForm((f) => ({ ...f, reason: e.target.value }))}
                    />
                  </label>
                </div>
              </div>
              <div className="ul-usr-review-modal__actions">
                <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setNewRequestOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="ul-btn ul-btn--primary">
                  Submit Request
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- delete unit confirm ---------- */}
      <ConfirmModal
        open={!!deleteTarget}
        title={`Delete this ${deleteTarget?.type?.toLowerCase() || "unit"}?`}
        description={
          deleteTarget
            ? deleteTarget.type === ORG_UNIT_TYPE.REGION && childCountOf(deleteTarget.id) > 0
              ? `"${deleteTarget.name}" and the ${childCountOf(deleteTarget.id)} branch(es) beneath it will be permanently removed, along with their staff assignments.`
              : `"${deleteTarget.name}" will be permanently removed, along with its staff assignments.`
            : ""
        }
        confirmLabel="Delete"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {/* ---------- remove (end) assignment confirm ---------- */}
      <ConfirmModal
        open={!!removeTarget}
        title="Remove this staff assignment?"
        description={
          removeTarget
            ? `${educatorById.get(removeTarget.educatorId)?.name || "This staff member"} will be removed from ${unitLabel(removeTarget.orgUnitId)}. This is recorded in the audit history.`
            : ""
        }
        confirmLabel="Remove"
        tone="danger"
        onConfirm={confirmRemove}
        onCancel={() => { setRemoveTarget(null); setRemoveReason(""); }}
      >
        <textarea
          className="ul-usr-reason"
          rows={2}
          placeholder="Reason (optional)"
          value={removeReason}
          onChange={(e) => setRemoveReason(e.target.value)}
        />
      </ConfirmModal>

      {/* ---------- reject request confirm ---------- */}
      <ConfirmModal
        open={!!rejectTarget}
        title="Reject this request?"
        description={rejectTarget ? "The staff member's current assignment will not change." : ""}
        confirmLabel="Reject"
        tone="danger"
        onConfirm={submitReject}
        onCancel={() => { setRejectTarget(null); setRejectReason(""); }}
      >
        <textarea
          className="ul-usr-reason"
          rows={2}
          placeholder="Reason for rejection (optional)"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </ConfirmModal>

      {toast && <div className="ul-usr-toast">{toast}</div>}
    </div>
  );
}
