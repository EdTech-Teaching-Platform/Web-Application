// Educator Management
// Jira: Day 2 — Educator management & verification queue
// Admin must review educator verification applications and approve or
// reject them; educators cannot teach or publish courses until approved.
//
// Landing page for the sidebar's "Educator Management" item (route stays
// /admin/educatorverification — only the URL's original name, not its
// job). This is the compact educator list: search, filters, sort,
// pagination and row actions. "View" opens the full tabbed profile at
// /admin/educatorverification/:educatorId (see EducatorProfile.jsx),
// which is also where verification review happens for pending/under-review
// applicants — the two screens share one live mock store
// (useEducators()/updateEducator() in ../data/educatorsMock.js) so an
// action taken in either place is reflected in both immediately.
//
// Chrome (sidebar/topbar) comes from src/layouts/AdminLayout.jsx; this
// page reuses the same .ul-card / .ul-btn / .ul-pill / .ul-avatar-chip
// classes as the dashboard (AdminDashboard.css) so the look matches
// exactly — table/filter/pagination-specific layout lives in
// EducatorVerification.css.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useEducators, addEducator, updateEducator, deleteEducator, SUBJECT_OPTIONS } from "../data/educatorsMock";
import ConfirmModal from "../components/ConfirmModal";
import { IconSearch, IconStar, IconMore, IconClose, IconPlus } from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";

const ACCOUNT_LABEL = { active: "Active", inactive: "Inactive", suspended: "Suspended" };
const VERIFICATION_LABEL = { pending: "Pending", under_review: "Pending", verified: "Verified", rejected: "Rejected" };
const PAGE_SIZE = 8;

const EMPTY_ADD_FORM = {
  firstName: "",
  lastName: "",
  email: "",
  phone: "",
  qualification: "",
  years: "",
  subjects: [],
};
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validateAddForm(form) {
  const errors = {};
  if (!form.firstName.trim()) errors.firstName = "First name is required.";
  if (!form.lastName.trim()) errors.lastName = "Last name is required.";
  if (!form.email.trim()) errors.email = "Email is required.";
  else if (!EMAIL_RE.test(form.email.trim())) errors.email = "Enter a valid email address.";
  if (!form.phone.trim()) errors.phone = "Phone number is required.";
  if (!form.qualification.trim()) errors.qualification = "Qualification is required.";
  if (form.years === "" || Number.isNaN(Number(form.years)) || Number(form.years) < 0) errors.years = "Enter valid years of experience.";
  if (!form.subjects.length) errors.subjects = "Select at least one subject.";
  return errors;
}
const EXPERIENCE_BANDS = [
  { key: "all", label: "Any experience" },
  { key: "0-3", label: "0–3 years", test: (y) => y <= 3 },
  { key: "4-7", label: "4–7 years", test: (y) => y >= 4 && y <= 7 },
  { key: "8-12", label: "8–12 years", test: (y) => y >= 8 && y <= 12 },
  { key: "13+", label: "13+ years", test: (y) => y >= 13 },
];
const SORT_OPTIONS = [
  { key: "newest", label: "Newest first" },
  { key: "oldest", label: "Oldest first" },
  { key: "rating", label: "Highest rating" },
  { key: "students", label: "Most students" },
];

function AccountBadge({ status }) {
  return <span className={`ul-status-badge is-account-${status}`}>{ACCOUNT_LABEL[status]}</span>;
}
function VerificationBadge({ status }) {
  return <span className={`ul-status-badge is-${status === "under_review" ? "pending" : status}`}>{VERIFICATION_LABEL[status]}</span>;
}

export default function EducatorVerification() {
  const educators = useEducators();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [accountFilter, setAccountFilter] = useState("all");
  const [verificationFilter, setVerificationFilter] = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [experienceFilter, setExperienceFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [page, setPage] = useState(1);
  const [openMenuId, setOpenMenuId] = useState(null);
  const [menuAnchor, setMenuAnchor] = useState(null); // { top, right } in viewport coords for the open row menu
  const [confirmAction, setConfirmAction] = useState(null); // { type, educator }
  const menuRef = useRef(null);

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState(EMPTY_ADD_FORM);
  const [addTouched, setAddTouched] = useState({});
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpenMenuId(null);
        setMenuAnchor(null);
      }
    };
    // The row menu is positioned in fixed viewport coordinates (computed
    // on open) rather than absolutely inside the scrolling table, so it
    // isn't clipped by the table card/scroll containers' overflow:hidden —
    // but that also means it needs to close on any scroll, otherwise it'd
    // stay glued to a spot on screen that no longer lines up with its row.
    const onScroll = () => {
      setOpenMenuId(null);
      setMenuAnchor(null);
    };
    document.addEventListener("mousedown", onClick);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onClick);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [openMenuId]);

  useEffect(() => {
    setPage(1);
  }, [search, accountFilter, verificationFilter, subjectFilter, experienceFilter, sortBy]);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const band = EXPERIENCE_BANDS.find((b) => b.key === experienceFilter);
    let list = educators.filter((e) => {
      if (q && !`${e.name} ${e.email} ${e.id}`.toLowerCase().includes(q)) return false;
      if (accountFilter !== "all" && e.accountStatus !== accountFilter) return false;
      if (verificationFilter !== "all" && e.verificationStatus !== verificationFilter) return false;
      if (subjectFilter !== "all" && !e.subjects.includes(subjectFilter)) return false;
      if (band && band.test && !band.test(e.yearsExperience)) return false;
      return true;
    });
    list = [...list].sort((a, b) => {
      if (sortBy === "newest") return b.joinedDate.localeCompare(a.joinedDate);
      if (sortBy === "oldest") return a.joinedDate.localeCompare(b.joinedDate);
      if (sortBy === "rating") return b.rating - a.rating;
      if (sortBy === "students") return b.studentsCount - a.studentsCount;
      return 0;
    });
    return list;
  }, [educators, search, accountFilter, verificationFilter, subjectFilter, experienceFilter, sortBy]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = useMemo(
    () => ({
      total: educators.length,
      active: educators.filter((e) => e.accountStatus === "active").length,
      pendingVerification: educators.filter((e) => e.verificationStatus === "pending" || e.verificationStatus === "under_review").length,
      suspended: educators.filter((e) => e.accountStatus === "suspended").length,
    }),
    [educators]
  );

  const runConfirmed = () => {
    if (!confirmAction) return;
    const { type, educator } = confirmAction;
    if (type === "deactivate") updateEducator(educator.id, { accountStatus: "inactive" });
    if (type === "suspend") updateEducator(educator.id, { accountStatus: "suspended" });
    if (type === "delete") deleteEducator(educator.id);
    setConfirmAction(null);
  };

  const addErrors = useMemo(() => validateAddForm(addForm), [addForm]);
  const isAddFormValid = Object.keys(addErrors).length === 0;

  const openAddForm = () => {
    setAddForm(EMPTY_ADD_FORM);
    setAddTouched({});
    setShowAddForm(true);
  };

  const closeAddForm = () => {
    setShowAddForm(false);
  };

  const handleAddFieldChange = (field, value) => {
    setAddForm((f) => ({ ...f, [field]: value }));
  };

  const handleAddFieldBlur = (field) => {
    setAddTouched((t) => ({ ...t, [field]: true }));
  };

  const toggleAddSubject = (subject) => {
    setAddForm((f) => ({
      ...f,
      subjects: f.subjects.includes(subject) ? f.subjects.filter((s) => s !== subject) : [...f.subjects, subject],
    }));
  };

  const handleAddFormSubmit = (e) => {
    e.preventDefault();
    setAddTouched({ firstName: true, lastName: true, email: true, phone: true, qualification: true, years: true, subjects: true });
    if (!isAddFormValid) return;
    addEducator(addForm);
    setToast(`${addForm.firstName.trim()} ${addForm.lastName.trim()} has been added as a teacher.`);
    closeAddForm();
  };

  const toggleRowMenu = (id, e) => {
    if (openMenuId === id) {
      setOpenMenuId(null);
      setMenuAnchor(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    setMenuAnchor({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    setOpenMenuId(id);
  };

  const confirmCopy = {
    deactivate: {
      title: "Deactivate this educator?",
      description: "Their courses stay live, but they won't be able to sign in or teach until reactivated.",
      confirmLabel: "Deactivate",
      tone: "default",
    },
    suspend: {
      title: "Suspend this educator?",
      description: "This immediately blocks sign-in and hides their courses from students until you lift the suspension.",
      confirmLabel: "Suspend",
      tone: "danger",
    },
    delete: {
      title: "Delete this educator?",
      description: "This permanently removes their profile, courses and history from Educator Management. This cannot be undone.",
      confirmLabel: "Delete",
      tone: "danger",
    },
  }[confirmAction?.type];

  return (
    <div>
      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Educator Management</h2>
          <p className="ul-edu-header__subtitle">
            Review, verify and manage every educator on the platform. An educator cannot teach or publish courses until their application is approved.
          </p>
        </div>
        <button type="button" className="ul-btn ul-btn--primary ul-edu-add-btn" onClick={openAddForm}>
          <IconPlus size={13} />
          <span>Add Teacher</span>
        </button>
      </div>

      <div className="ul-edu-summary">
        <div className="ul-edu-summary__card">
          <p className="ul-edu-summary__label">Total educators</p>
          <p className="ul-edu-summary__value">{counts.total}</p>
        </div>
        <div className="ul-edu-summary__card">
          <p className="ul-edu-summary__label">Active</p>
          <p className="ul-edu-summary__value">{counts.active}</p>
        </div>
        <div className="ul-edu-summary__card">
          <p className="ul-edu-summary__label">Pending verification</p>
          <p className="ul-edu-summary__value">{counts.pendingVerification}</p>
        </div>
        <div className="ul-edu-summary__card">
          <p className="ul-edu-summary__label">Suspended</p>
          <p className="ul-edu-summary__value">{counts.suspended}</p>
        </div>
      </div>

      <div className="ul-edu-toolbar">
        <label className="ul-edu-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by name, email or educator ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-edu-select" value={accountFilter} onChange={(e) => setAccountFilter(e.target.value)}>
          <option value="all">Account: All</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
          <option value="suspended">Suspended</option>
        </select>

        <select className="ul-edu-select" value={verificationFilter} onChange={(e) => setVerificationFilter(e.target.value)}>
          <option value="all">Verification: All</option>
          <option value="pending">Pending</option>
          <option value="under_review">Pending</option>
          <option value="verified">Verified</option>
          <option value="rejected">Rejected</option>
        </select>

        <select className="ul-edu-select" value={subjectFilter} onChange={(e) => setSubjectFilter(e.target.value)}>
          <option value="all">Subject: All</option>
          {SUBJECT_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>

        <select className="ul-edu-select" value={experienceFilter} onChange={(e) => setExperienceFilter(e.target.value)}>
          {EXPERIENCE_BANDS.map((b) => (
            <option key={b.key} value={b.key}>{b.label}</option>
          ))}
        </select>

        <select className="ul-edu-select ul-edu-select--sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
          {SORT_OPTIONS.map((o) => (
            <option key={o.key} value={o.key}>{o.label}</option>
          ))}
        </select>
      </div>

      <div className="ul-card ul-edu-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-edu-empty">No educators match these filters.</div>
        ) : (
          <div className="ul-edu-table-scroll">
            <table className="ul-edu-table">
              <colgroup>
                <col style={{ width: "14.3%" }} />
                <col style={{ width: "14.3%" }} />
                <col style={{ width: "14.3%" }} />
                <col style={{ width: "14.3%" }} />
                <col style={{ width: "14.3%" }} />
                <col style={{ width: "14.3%" }} />
                <col style={{ width: "14.2%" }} />
                <col style={{ width: "52px" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Educator</th>
                  <th>Contact</th>
                  <th>Subjects</th>
                  <th>Rating</th>
                  <th>Verification</th>
                  <th>Account</th>
                  <th>Joined</th>
                  <th aria-label="Actions" />
                </tr>
              </thead>
              <tbody>
                {pageItems.map((e) => (
                  <tr
                    key={e.id}
                    className="ul-edu-row--clickable"
                    onClick={() => navigate(`/admin/educatorverification/${e.id}`)}
                  >
                    <td>
                      <div className="ul-edu-cell-id">
                        <div className="ul-avatar-chip ul-edu-table-avatar" style={{ background: `${e.avatarColor}22`, color: e.avatarColor }}>
                          {e.initials}
                        </div>
                        <div className="ul-edu-cell-id__body">
                          <button
                            type="button"
                            className="ul-edu-name-link"
                            onClick={(ev) => {
                              ev.stopPropagation();
                              navigate(`/admin/educatorverification/${e.id}`);
                            }}
                          >
                            {e.name}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="ul-edu-cell-contact">
                        <span className="ul-edu-cell-email">{e.email}</span>
                        <span className="ul-edu-cell-id__sub">{e.phone}</span>
                      </div>
                    </td>
                    <td>
                      <div className="ul-edu-chips">
                        {e.subjects.map((s) => (
                          <span key={s} className="ul-edu-chip">{s}</span>
                        ))}
                      </div>
                    </td>
                    <td>
                      {e.rating > 0 ? (
                        <span className="ul-edu-rating">
                          <IconStar size={12} color="var(--color-warning-accent)" /> {e.rating.toFixed(1)}
                        </span>
                      ) : (
                        <span className="ul-edu-cell-id__sub">—</span>
                      )}
                    </td>
                    <td><VerificationBadge status={e.verificationStatus} /></td>
                    <td><AccountBadge status={e.accountStatus} /></td>
                    <td>{e.joinedDate}</td>
                    <td className="ul-edu-actions-cell" onClick={(ev) => ev.stopPropagation()}>
                      <div className="ul-edu-actions-inner" ref={openMenuId === e.id ? menuRef : null}>
                        <button
                          type="button"
                          className="ul-edu-more-btn"
                          onClick={(ev) => toggleRowMenu(e.id, ev)}
                          aria-haspopup="menu"
                          aria-expanded={openMenuId === e.id}
                          aria-label="More actions"
                        >
                          <IconMore size={15} />
                        </button>
                        {openMenuId === e.id && menuAnchor && (
                        <div
                          className="ul-edu-row-menu"
                          role="menu"
                          style={{ top: `${menuAnchor.top}px`, right: `${menuAnchor.right}px` }}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate(`/admin/educatorverification/${e.id}`);
                            }}
                          >
                            View Details
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate(`/admin/educatorverification/${e.id}`, { state: { tab: "performance" } });
                            }}
                          >
                            View Courses
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              navigate(`/admin/educatorverification/${e.id}`, { state: { tab: "documents" } });
                            }}
                          >
                            Verification Details
                          </button>
                          {e.accountStatus === "suspended" ? (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                updateEducator(e.id, { accountStatus: "active" });
                              }}
                            >
                              Activate
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setOpenMenuId(null);
                                setConfirmAction({ type: "suspend", educator: e });
                              }}
                            >
                              Suspend
                            </button>
                          )}
                        </div>
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
          <div className="ul-edu-pagination">
            <span className="ul-edu-pagination__info">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ul-edu-pagination__controls">
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

      <ConfirmModal
        open={!!confirmAction}
        title={confirmCopy?.title}
        description={confirmCopy?.description}
        confirmLabel={confirmCopy?.confirmLabel}
        tone={confirmCopy?.tone}
        onConfirm={runConfirmed}
        onCancel={() => setConfirmAction(null)}
      />

      {/* ---------- Add Teacher form ---------- */}
      {showAddForm && (
        <div className="ul-usr-review-backdrop" onClick={closeAddForm}>
          <div
            className="ul-usr-review-modal ul-inst-form-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Add a new teacher"
          >
            <div className="ul-usr-review-modal__head">
              <div className="ul-usr-review-modal__header">
                <div className="ul-usr-review-modal__header-text">
                  <h3 className="ul-usr-review-modal__title">Add Teacher</h3>
                  <p className="ul-usr-review-modal__sub">
                    Create a teacher account directly. They're added as verified and active right away.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleAddFormSubmit}>
              <div className="ul-usr-review-modal__body">
                <div className="ul-inst-form-grid">
                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">First Name</span>
                    <input
                      type="text"
                      value={addForm.firstName}
                      onChange={(e) => handleAddFieldChange("firstName", e.target.value)}
                      onBlur={() => handleAddFieldBlur("firstName")}
                      placeholder="e.g. Priya"
                    />
                    {addTouched.firstName && addErrors.firstName && <span className="ul-inst-field__error">{addErrors.firstName}</span>}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Last Name</span>
                    <input
                      type="text"
                      value={addForm.lastName}
                      onChange={(e) => handleAddFieldChange("lastName", e.target.value)}
                      onBlur={() => handleAddFieldBlur("lastName")}
                      placeholder="e.g. Kapoor"
                    />
                    {addTouched.lastName && addErrors.lastName && <span className="ul-inst-field__error">{addErrors.lastName}</span>}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Email</span>
                    <input
                      type="text"
                      value={addForm.email}
                      onChange={(e) => handleAddFieldChange("email", e.target.value)}
                      onBlur={() => handleAddFieldBlur("email")}
                      placeholder="name@example.com"
                    />
                    {addTouched.email && addErrors.email && <span className="ul-inst-field__error">{addErrors.email}</span>}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Phone</span>
                    <input
                      type="text"
                      value={addForm.phone}
                      onChange={(e) => handleAddFieldChange("phone", e.target.value)}
                      onBlur={() => handleAddFieldBlur("phone")}
                      placeholder="+1 555-123-4567"
                    />
                    {addTouched.phone && addErrors.phone && <span className="ul-inst-field__error">{addErrors.phone}</span>}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Qualification</span>
                    <input
                      type="text"
                      value={addForm.qualification}
                      onChange={(e) => handleAddFieldChange("qualification", e.target.value)}
                      onBlur={() => handleAddFieldBlur("qualification")}
                      placeholder="e.g. M.Ed., Delhi University"
                    />
                    {addTouched.qualification && addErrors.qualification && (
                      <span className="ul-inst-field__error">{addErrors.qualification}</span>
                    )}
                  </label>

                  <label className="ul-inst-field">
                    <span className="ul-inst-field__label">Years of Experience</span>
                    <input
                      type="number"
                      min="0"
                      value={addForm.years}
                      onChange={(e) => handleAddFieldChange("years", e.target.value)}
                      onBlur={() => handleAddFieldBlur("years")}
                      placeholder="e.g. 5"
                    />
                    {addTouched.years && addErrors.years && <span className="ul-inst-field__error">{addErrors.years}</span>}
                  </label>

                  <label className="ul-inst-field ul-inst-field--full">
                    <span className="ul-inst-field__label">Subjects</span>
                    <div className="ul-edu-subject-picker">
                      {SUBJECT_OPTIONS.map((subject) => (
                        <button
                          key={subject}
                          type="button"
                          className={`ul-edu-subject-chip${addForm.subjects.includes(subject) ? " is-selected" : ""}`}
                          onClick={() => toggleAddSubject(subject)}
                        >
                          {subject}
                        </button>
                      ))}
                    </div>
                    {addTouched.subjects && addErrors.subjects && <span className="ul-inst-field__error">{addErrors.subjects}</span>}
                  </label>
                </div>
              </div>

              <div className="ul-usr-review-modal__actions">
                <button type="button" className="ul-btn ul-btn--ghost" onClick={closeAddForm}>
                  Cancel
                </button>
                <button type="submit" className="ul-btn ul-btn--primary">
                  Add Teacher
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <div className="ul-usr-toast">{toast}</div>}
    </div>
  );
}
