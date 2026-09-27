// Institution Management + Institution Details View
// Jira: Day 5 — Institution management + details view
// Institution Management — onboard and maintain a school or regional
// education body on the platform. Admin. How It Works: Create and edit
// institution records. Expected Outcome: Institution tracked and
// manageable on the platform. Institution Details View — see a given
// institution's structure and roster. Admin. How It Works: Detail view
// drilling into an institution's branches and staff. Expected Outcome:
// Full institutional visibility for platform operations.
//
// List of onboarded institutions (schools / regional education bodies /
// coaching institutes) with search + type/status filters, an "Onboard
// Institution" flow, inline Edit, and Suspend/Activate. Clicking an
// institution's name opens the Institution Details view: institution +
// contact info, then a read-only Organization Structure roster of its
// regions/branches (full hierarchy editing is Region / Branch Hierarchy,
// Day 6 — this view summarizes it, it doesn't replace it).
//
// Chrome (sidebar/topbar) comes from src/layouts/AdminLayout.jsx; this
// page reuses the same .ul-card / .ul-btn / .ul-status-badge /
// .ul-avatar-chip primitives as the dashboard and the Suspend-with-reason
// / details-modal pattern already established in UserManagement.jsx
// (block/unblock -> suspend/activate here) so the look and interaction
// match exactly — layout specific to this screen lives in
// InstitutionManagement.css.

import { useEffect, useMemo, useRef, useState } from "react";
import {
  useInstitutions,
  onboardInstitution,
  updateInstitution,
  suspendInstitution,
  activateInstitution,
  INSTITUTION_TYPE,
  INSTITUTION_TYPE_OPTIONS,
  INSTITUTION_STATUS,
  INSTITUTION_STATUS_LABEL,
  INSTITUTION_STATUS_BADGE_CLASS,
  ORG_UNIT_TYPE,
} from "../data/institutionsMock";
import ConfirmModal from "../components/ConfirmModal";
import { IconSearch, IconClose, IconPlus, IconEdit, IconInstitution, IconBranch, IconMail, IconPhone } from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./InstitutionManagement.css";

const PAGE_SIZE = 8;

const EMPTY_FORM = {
  name: "",
  type: INSTITUTION_TYPE_OPTIONS[0],
  contactPerson: "",
  contactRole: "",
  email: "",
  phone: "",
  city: "",
  state: "",
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function StatusBadge({ status }) {
  return <span className={`ul-status-badge ${INSTITUTION_STATUS_BADGE_CLASS[status]}`}>{INSTITUTION_STATUS_LABEL[status]}</span>;
}

function validateForm(form) {
  const errors = {};
  if (!form.name.trim()) errors.name = "Institution name is required.";
  if (!form.contactPerson.trim()) errors.contactPerson = "Contact person is required.";
  if (!form.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!form.phone.trim()) errors.phone = "Phone number is required.";
  if (!form.city.trim()) errors.city = "City is required.";
  if (!form.state.trim()) errors.state = "State is required.";
  return errors;
}

export default function InstitutionManagement() {
  const institutions = useInstitutions();

  const [search, setSearch] = useState("");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [detailsInstitution, setDetailsInstitution] = useState(null);
  const [formMode, setFormMode] = useState(null); // null | "onboard" | "edit"
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState({});
  const [touched, setTouched] = useState({});
  const [editingId, setEditingId] = useState(null);

  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");
  const [activateTarget, setActivateTarget] = useState(null);
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    setPage(1);
  }, [search, schoolFilter, typeFilter, statusFilter]);

  // Keep Institution Details in sync with the live store.
  useEffect(() => {
    if (!detailsInstitution) return;
    const fresh = institutions.find((i) => i.id === detailsInstitution.id);
    if (fresh && fresh !== detailsInstitution) setDetailsInstitution(fresh);
  }, [institutions, detailsInstitution]);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const schoolOptions = useMemo(
    () => institutions.filter((i) => i.type === INSTITUTION_TYPE.SCHOOL).sort((a, b) => a.name.localeCompare(b.name)),
    [institutions]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return institutions.filter((i) => {
      if (q && !`${i.name} ${i.contactPerson} ${i.city} ${i.id}`.toLowerCase().includes(q)) return false;
      if (schoolFilter !== "all" && i.id !== schoolFilter) return false;
      if (typeFilter !== "all" && i.type !== typeFilter) return false;
      if (statusFilter !== "all" && i.status !== statusFilter) return false;
      return true;
    });
  }, [institutions, search, schoolFilter, typeFilter, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = useMemo(
    () => ({
      total: institutions.length,
      active: institutions.filter((i) => i.status === INSTITUTION_STATUS.ACTIVE).length,
      pending: institutions.filter((i) => i.status === INSTITUTION_STATUS.PENDING).length,
      suspended: institutions.filter((i) => i.status === INSTITUTION_STATUS.SUSPENDED).length,
    }),
    [institutions]
  );

  const errors = useMemo(() => validateForm(form), [form]);
  const isFormValid = Object.keys(errors).length === 0;

  const openOnboard = () => {
    setForm(EMPTY_FORM);
    setFormErrors({});
    setTouched({});
    setEditingId(null);
    setFormMode("onboard");
  };

  const openEdit = (institution) => {
    setForm({
      name: institution.name,
      type: institution.type,
      contactPerson: institution.contactPerson,
      contactRole: institution.contactRole || "",
      email: institution.email,
      phone: institution.phone,
      city: institution.city,
      state: institution.state,
    });
    setFormErrors({});
    setTouched({});
    setEditingId(institution.id);
    setFormMode("edit");
  };

  const closeForm = () => {
    setFormMode(null);
    setEditingId(null);
  };

  const handleFieldChange = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
  };

  const handleFieldBlur = (field) => {
    setTouched((t) => ({ ...t, [field]: true }));
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    setFormErrors(errors);
    setTouched({ name: true, contactPerson: true, email: true, phone: true, city: true, state: true });
    if (!isFormValid) return;

    if (formMode === "onboard") {
      onboardInstitution(form);
      setToast(`"${form.name.trim()}" has been onboarded.`);
    } else if (formMode === "edit" && editingId) {
      updateInstitution(editingId, form);
      setToast(`"${form.name.trim()}" has been updated.`);
    }
    closeForm();
  };

  const confirmSuspend = () => {
    if (!suspendTarget || !suspendReason.trim()) return;
    suspendInstitution(suspendTarget.id, suspendReason.trim());
    setToast(`"${suspendTarget.name}" has been suspended.`);
    setSuspendTarget(null);
    setSuspendReason("");
  };

  const confirmActivate = () => {
    if (!activateTarget) return;
    activateInstitution(activateTarget.id);
    setToast(`"${activateTarget.name}" is active again.`);
    setActivateTarget(null);
  };

  return (
    <div>
      <div className="ul-inst-header">
        <div>
          <h2 className="ul-inst-header__title">Institution Management</h2>
          <p className="ul-inst-header__subtitle">
            Onboard and maintain schools and regional education bodies on the platform, and drill into any
            institution's branches and staff from its Details view.
          </p>
        </div>
        <button type="button" className="ul-btn ul-btn--primary ul-inst-onboard-btn" onClick={openOnboard}>
          <IconPlus size={13} />
          <span>Onboard Institution</span>
        </button>
      </div>

      <div className="ul-inst-summary">
        <div className="ul-inst-summary__card">
          <p className="ul-inst-summary__value">{counts.total}</p>
          <p className="ul-inst-summary__label">Total institutions</p>
        </div>
        <div className="ul-inst-summary__card">
          <p className="ul-inst-summary__value">{counts.active}</p>
          <p className="ul-inst-summary__label">Active</p>
        </div>
        <div className="ul-inst-summary__card">
          <p className="ul-inst-summary__value">{counts.pending}</p>
          <p className="ul-inst-summary__label">Pending setup</p>
        </div>
        <div className="ul-inst-summary__card">
          <p className="ul-inst-summary__value">{counts.suspended}</p>
          <p className="ul-inst-summary__label">Suspended</p>
        </div>
      </div>

      <div className="ul-usr-toolbar">
        <label className="ul-usr-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by institution name, contact or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ul-usr-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-usr-select" value={schoolFilter} onChange={(e) => setSchoolFilter(e.target.value)}>
          <option value="all">School: All</option>
          {schoolOptions.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </select>

        <select className="ul-usr-select" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
          <option value="all">Type: All</option>
          {INSTITUTION_TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select className="ul-usr-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Status: All</option>
          <option value={INSTITUTION_STATUS.ACTIVE}>Active</option>
          <option value={INSTITUTION_STATUS.PENDING}>Pending Setup</option>
          <option value={INSTITUTION_STATUS.SUSPENDED}>Suspended</option>
        </select>
      </div>

      <div className="ul-card ul-usr-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-usr-empty">No institutions match these filters.</div>
        ) : (
          <div className="ul-usr-table-scroll">
            <table className="ul-usr-table ul-inst-table">
              <colgroup>
                <col style={{ width: "25%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Institution</th>
                  <th>Type</th>
                  <th>Contact</th>
                  <th>Location</th>
                  <th>Branches</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((inst) => (
                  <tr key={inst.id}>
                    <td>
                      <div className="ul-usr-name-cell">
                        <div className="ul-avatar-chip ul-usr-avatar">{inst.initials}</div>
                        <div className="ul-usr-name-cell__body">
                          <button type="button" className="ul-usr-name-link" onClick={() => setDetailsInstitution(inst)}>
                            {inst.name}
                          </button>
                          <span className="ul-usr-name-cell__sub">{inst.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>{inst.type}</td>
                    <td>{inst.contactPerson}</td>
                    <td>{inst.city}, {inst.state}</td>
                    <td>{inst.totalBranches}</td>
                    <td>
                      <StatusBadge status={inst.status} />
                    </td>
                    <td>
                      <div className="ul-usr-actions-cell">
                        <button
                          type="button"
                          className="ul-inst-icon-btn"
                          onClick={() => openEdit(inst)}
                          aria-label={`Edit ${inst.name}`}
                          title="Edit"
                        >
                          <IconEdit size={13} />
                        </button>
                        {inst.status === INSTITUTION_STATUS.SUSPENDED ? (
                          <button
                            type="button"
                            className="ul-btn ul-btn--primary ul-usr-btn-sm"
                            onClick={() => setActivateTarget(inst)}
                          >
                            Activate
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ul-btn ul-btn--danger ul-usr-btn-sm"
                            onClick={() => {
                              setSuspendTarget(inst);
                              setSuspendReason("");
                            }}
                          >
                            Suspend
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {filtered.length > 0 && (
          <div className="ul-usr-pagination">
            <span className="ul-usr-pagination__info">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ul-usr-pagination__controls">
              <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>
                Prev
              </button>
              <span>{currentPage} / {pageCount}</span>
              <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ---------- Institution Details view ---------- */}
      {detailsInstitution && (
        <div className="ul-usr-review-backdrop" onClick={() => setDetailsInstitution(null)}>
          <div
            className="ul-usr-review-modal ul-inst-details-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Institution details for ${detailsInstitution.name}`}
          >
            <div className="ul-usr-review-modal__head">
              <div className="ul-usr-review-modal__header">
                <div className="ul-avatar-chip ul-usr-avatar ul-usr-avatar--lg">{detailsInstitution.initials}</div>
                <div className="ul-usr-review-modal__header-text">
                  <h3 className="ul-usr-review-modal__title">{detailsInstitution.name}</h3>
                  <p className="ul-usr-review-modal__sub">{detailsInstitution.id} · {detailsInstitution.type}</p>
                </div>
                <button
                  type="button"
                  className="ul-usr-review-modal__close"
                  onClick={() => setDetailsInstitution(null)}
                  aria-label="Close"
                >
                  <IconClose size={15} />
                </button>
              </div>
              <StatusBadge status={detailsInstitution.status} />
            </div>

            <div className="ul-usr-review-modal__body">
              {/* 1. Institution information */}
              <div className="ul-usr-review-section">
                <p className="ul-usr-review-section__title">Institution Information</p>
                <div className="ul-usr-review-meta">
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Type</p>
                    <p className="ul-usr-review-meta__value">{detailsInstitution.type}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Location</p>
                    <p className="ul-usr-review-meta__value">{detailsInstitution.city}, {detailsInstitution.state}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Onboarded</p>
                    <p className="ul-usr-review-meta__value">{detailsInstitution.onboardedDate}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Status</p>
                    <p className="ul-usr-review-meta__value"><StatusBadge status={detailsInstitution.status} /></p>
                  </div>
                </div>
                {detailsInstitution.status === INSTITUTION_STATUS.SUSPENDED && detailsInstitution.suspendedReason && (
                  <div className="ul-usr-feedback-box" style={{ marginTop: 12 }}>
                    <strong>Suspended{detailsInstitution.suspendedDate ? ` on ${detailsInstitution.suspendedDate}` : ""}</strong>
                    {detailsInstitution.suspendedReason}
                  </div>
                )}
              </div>

              {/* 2. Contact */}
              <div className="ul-usr-review-section">
                <p className="ul-usr-review-section__title">Primary Contact</p>
                <div className="ul-usr-review-meta">
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Name</p>
                    <p className="ul-usr-review-meta__value">{detailsInstitution.contactPerson}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Role</p>
                    <p className="ul-usr-review-meta__value">{detailsInstitution.contactRole}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label"><IconMail size={10} /> Email</p>
                    <p className="ul-usr-review-meta__value">{detailsInstitution.email}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label"><IconPhone size={10} /> Phone</p>
                    <p className="ul-usr-review-meta__value">{detailsInstitution.phone}</p>
                  </div>
                </div>
              </div>

              {/* 3. Organization structure */}
              <div className="ul-usr-review-section">
                <p className="ul-usr-review-section__title">
                  Organization Structure
                  <span className="ul-inst-org-count">
                    {detailsInstitution.totalBranches} unit{detailsInstitution.totalBranches === 1 ? "" : "s"} ·{" "}
                    {detailsInstitution.totalEducators} educators · {detailsInstitution.totalStudents} students
                  </span>
                </p>
                {detailsInstitution.orgUnits.length === 0 ? (
                  <p className="ul-usr-review-meta__value ul-usr-review-meta__value--muted">
                    No regions or branches set up yet — use Region / Branch Hierarchy to add the first one.
                  </p>
                ) : (
                  <div className="ul-inst-org-list">
                    {detailsInstitution.orgUnits.map((unit) => (
                      <div key={unit.id} className="ul-inst-org-row">
                        <div className="ul-inst-org-row__icon">
                          {unit.type === ORG_UNIT_TYPE.REGION ? <IconBranch size={14} /> : <IconInstitution size={14} />}
                        </div>
                        <div className="ul-inst-org-row__body">
                          <p className="ul-inst-org-row__name">{unit.name}</p>
                          <p className="ul-inst-org-row__meta">
                            {unit.type} · Head: {unit.headTeacher}
                          </p>
                        </div>
                        <div className="ul-inst-org-row__stats">
                          <span>{unit.educators} educators</span>
                          <span>{unit.students} students</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="ul-usr-review-modal__actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => openEdit(detailsInstitution)}>
                Edit Details
              </button>
              {detailsInstitution.status === INSTITUTION_STATUS.SUSPENDED ? (
                <button type="button" className="ul-btn ul-btn--primary" onClick={() => setActivateTarget(detailsInstitution)}>
                  Activate Institution
                </button>
              ) : (
                <button
                  type="button"
                  className="ul-btn ul-btn--danger"
                  onClick={() => {
                    setSuspendTarget(detailsInstitution);
                    setSuspendReason("");
                  }}
                >
                  Suspend Institution
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- Onboard / Edit Institution form ---------- */}
      {formMode && (
        <div className="ul-usr-review-backdrop" onClick={closeForm}>
          <div
            className="ul-usr-review-modal ul-inst-form-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={formMode === "onboard" ? "Onboard a new institution" : `Edit ${form.name}`}
          >
            <div className="ul-usr-review-modal__head">
              <div className="ul-usr-review-modal__header">
                <div className="ul-usr-review-modal__header-text">
                  <h3 className="ul-usr-review-modal__title">
                    {formMode === "onboard" ? "Onboard Institution" : "Edit Institution"}
                  </h3>
                  <p className="ul-usr-review-modal__sub">
                    {formMode === "onboard"
                      ? "Create a new institution record. You can add regions/branches afterward."
                      : "Update this institution's record."}
                  </p>
                </div>
                <button type="button" className="ul-usr-review-modal__close" onClick={closeForm} aria-label="Close">
                  <IconClose size={15} />
                </button>
              </div>
            </div>

            <form onSubmit={handleFormSubmit}>
              <div className="ul-usr-review-modal__body">
                <div className="ul-inst-form-grid">
                  <label className="ul-inst-field ul-inst-field--full">
                    <span className="ul-inst-field__label">Institution Name</span>
                    <input
                      type="text"
                      value={form.name}
                      onChange={(e) => handleFieldChange("name", e.target.value)}
                      onBlur={() => handleFieldBlur("name")}
                      placeholder="e.g. Greenwood International School"
                    />
                    {touched.name && errors.name && <span className="ul-inst-field__error">{errors.name}</span>}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Institution Type</span>
                    <select value={form.type} onChange={(e) => handleFieldChange("type", e.target.value)}>
                      {INSTITUTION_TYPE_OPTIONS.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Contact Person</span>
                    <input
                      type="text"
                      value={form.contactPerson}
                      onChange={(e) => handleFieldChange("contactPerson", e.target.value)}
                      onBlur={() => handleFieldBlur("contactPerson")}
                      placeholder="Full name"
                    />
                    {touched.contactPerson && errors.contactPerson && (
                      <span className="ul-inst-field__error">{errors.contactPerson}</span>
                    )}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Contact Role</span>
                    <input
                      type="text"
                      value={form.contactRole}
                      onChange={(e) => handleFieldChange("contactRole", e.target.value)}
                      placeholder="e.g. Principal (optional)"
                    />
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Email</span>
                    <input
                      type="email"
                      value={form.email}
                      onChange={(e) => handleFieldChange("email", e.target.value)}
                      onBlur={() => handleFieldBlur("email")}
                      placeholder="admin@institution.edu"
                    />
                    {touched.email && errors.email && <span className="ul-inst-field__error">{errors.email}</span>}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Phone</span>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => handleFieldChange("phone", e.target.value)}
                      onBlur={() => handleFieldBlur("phone")}
                      placeholder="+91 90000 00000"
                    />
                    {touched.phone && errors.phone && <span className="ul-inst-field__error">{errors.phone}</span>}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">City</span>
                    <input
                      type="text"
                      value={form.city}
                      onChange={(e) => handleFieldChange("city", e.target.value)}
                      onBlur={() => handleFieldBlur("city")}
                      placeholder="e.g. Bengaluru"
                    />
                    {touched.city && errors.city && <span className="ul-inst-field__error">{errors.city}</span>}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">State</span>
                    <input
                      type="text"
                      value={form.state}
                      onChange={(e) => handleFieldChange("state", e.target.value)}
                      onBlur={() => handleFieldBlur("state")}
                      placeholder="e.g. Karnataka"
                    />
                    {touched.state && errors.state && <span className="ul-inst-field__error">{errors.state}</span>}
                  </label>
                </div>
              </div>

              <div className="ul-usr-review-modal__actions">
                <button type="button" className="ul-btn ul-btn--ghost" onClick={closeForm}>
                  Cancel
                </button>
                <button type="submit" className="ul-btn ul-btn--primary" disabled={!isFormValid}>
                  {formMode === "onboard" ? "Onboard Institution" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------- suspend-with-reason ---------- */}
      <ConfirmModal
        open={!!suspendTarget}
        title="Suspend this institution?"
        description={
          suspendTarget
            ? `"${suspendTarget.name}" and all its staff and students will immediately lose platform access, until an Admin reactivates it.`
            : ""
        }
        confirmLabel="Suspend Institution"
        tone="danger"
        confirmDisabled={!suspendReason.trim()}
        onConfirm={confirmSuspend}
        onCancel={() => setSuspendTarget(null)}
      >
        <textarea
          className="ul-usr-reason"
          placeholder="e.g. Outstanding platform fee dues beyond the grace period…"
          value={suspendReason}
          onChange={(e) => setSuspendReason(e.target.value)}
        />
      </ConfirmModal>

      {/* ---------- activate confirm ---------- */}
      <ConfirmModal
        open={!!activateTarget}
        title="Activate this institution?"
        description={activateTarget ? `"${activateTarget.name}" and its staff/students will regain platform access immediately.` : ""}
        confirmLabel="Activate"
        tone="default"
        onConfirm={confirmActivate}
        onCancel={() => setActivateTarget(null)}
      />

      {toast && <div className="ul-usr-toast">{toast}</div>}
    </div>
  );
}
