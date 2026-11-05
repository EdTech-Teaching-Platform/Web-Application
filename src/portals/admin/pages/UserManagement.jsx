// User Management & Student Details + Block Account
// Jira: Day 4 — User management & student details
// User Management & Student Details — oversee student accounts. How It
// Works: Search, view, and act on student accounts. Expected Outcome:
// Operational control over the user base. Block Account — suspend a
// misbehaving account. Admin. How It Works: Suspend action on a user's
// account. Expected Outcome: Suspended account loses access regardless
// of valid credentials.
//
// Compact list of student accounts with search + status filter. Clicking
// a student's name opens a read-only Student Details view. Admin can
// Block an active account (with a confirmation + required reason) or
// Unblock a blocked one directly from the list or from Student Details —
// the blocked status is reflected immediately in both places via the
// shared mock store (useStudents()/blockStudent()/unblockStudent() in
// ../data/studentsMock.js), the same pub/sub pattern already used by
// educatorsMock.js / coursesMock.js.
//
// Chrome (sidebar/topbar) comes from src/layouts/AdminLayout.jsx; this
// page reuses the same .ul-card / .ul-btn / .ul-status-badge classes as
// the dashboard and Educator Management (AdminDashboard.css /
// EducatorVerification.css) so the look matches exactly — table/toolbar/
// modal-specific layout lives in UserManagement.css.

import { useCallback, useEffect, useRef, useState } from "react";
import { useOnboardedBy } from "../data/regionalOnboardingMock";
import {
  STUDENT_STATUS,
  STUDENT_STATUS_LABEL,
  STUDENT_STATUS_BADGE_CLASS,
  GRADE_OPTIONS,
} from "../data/studentsMock";
import { useRpc } from "../hooks/useRpc";
import { studentsApi } from "../services/studentsApi";
import ConfirmModal from "../components/ConfirmModal";
import { IconSearch, IconClose } from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./UserManagement.css";
import PageToast from "../../../components/feedback/Toast";

const PAGE_SIZE = 8;

// Stable references: passing a fresh arrow function to useRpc on every render
// made it re-fetch in an endless loop.
const fetchStudentStats = () => studentsApi.stats();

// Waits for typing to pause before the search hits the server.
function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

function StatusBadge({ status }) {
  return <span className={`ul-status-badge ${STUDENT_STATUS_BADGE_CLASS[status]}`}>{STUDENT_STATUS_LABEL[status]}</span>;
}

// Which Regional Head onboarded this student (from Manage Regional Heads).
function AcquiredVia({ studentId }) {
  const a = useOnboardedBy(studentId);
  if (!a) return "Direct sign-up";
  return `${a.headName} — Regional Head${a.region ? `, ${a.region}` : ""}`;
}


export default function UserManagement() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailsStudent, setDetailsStudent] = useState(null); // student open in the read-only Student Details view
  const [blockTarget, setBlockTarget] = useState(null); // student pending a Block confirmation (independent of detailsStudent)
  const [blockReason, setBlockReason] = useState("");
  const [unblockTarget, setUnblockTarget] = useState(null); // student pending an Unblock confirmation
  const [toast, setToast] = useState("");
  const debouncedSearch = useDebounced(search);
  const listRequest = useCallback(() => studentsApi.list({ search: debouncedSearch, status: statusFilter, grade: gradeFilter, page, size: PAGE_SIZE }), [debouncedSearch, statusFilter, gradeFilter, page]);
  const studentsState = useRpc(listRequest, { cacheKey: `students:list:${JSON.stringify([debouncedSearch.trim(), statusFilter, gradeFilter, page])}` });
  const statsState = useRpc(fetchStudentStats, { cacheKey: "students:stats" });
  const students = studentsState.data?.rows || [];
  const total = Number(studentsState.data?.total || 0);
  // Keyed on the id (not the object): the effect below replaces detailsStudent
  // with the fetched copy, which previously changed the request and re-fetched forever.
  const detailsId = detailsStudent?.id ?? null;
  const detailState = useRpc(useCallback(() => detailsId ? studentsApi.detail(detailsId) : Promise.resolve(null), [detailsId]), { immediate: !!detailsId });
  const toastTimer = useRef(null);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, statusFilter, gradeFilter]);

  // Keep Student Details in sync with the live store (e.g. blocking the
  // student currently open in Details should update its badge in place).
  useEffect(() => {
    if (detailState.data) setDetailsStudent(detailState.data);
  }, [detailState.data]);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = students;
  const counts = statsState.data || { total, active: "—", blocked: "—" };

  // Opens ONLY the small Block confirmation for the given student —
  // deliberately does not touch detailsStudent/Student Details.
  const openBlock = (student) => {
    setBlockTarget(student);
    setBlockReason("");
  };

  const cancelBlock = () => {
    setBlockTarget(null);
    setBlockReason("");
  };

  // QA triage P2: after the SQL block / unblock succeeds, the Auth-level ban
  // follows (set-user-ban). The SQL action already stops all access, so a
  // failed ban is a warning with Retry, not an error.
  const syncBan = (student, ban, reason) => studentsApi.setBan(student.id, ban, reason)
    .catch((error) => setToast({
      tone: "warning",
      message: `"${student.name}" is ${ban ? "blocked" : "unblocked"} in the app, but the sign-in ${ban ? "ban" : "unban"} failed: ${error?.message || "unknown error"}`,
      actionLabel: "Retry",
      onAction: () => syncBan(student, ban, reason).then((ok) => ok !== false && setToast({ tone: "success", message: `Sign-in ${ban ? "ban" : "unban"} applied for "${student.name}".` })),
    }) || false);
  const refreshAfterStatus = () => {
    studentsState.refetch();
    statsState.refetch().catch(() => {});
    if (detailsId) detailState.refetch().catch(() => {});
  };

  const confirmBlock = () => {
    if (!blockTarget || !blockReason.trim()) return;
    const student = blockTarget;
    const reason = blockReason.trim();
    studentsApi.setStatus(student.id, STUDENT_STATUS.BLOCKED, reason).then(() => {
      setToast({ tone: "success", message: `"${student.name}" has been blocked.` });
      setBlockTarget(null); setBlockReason(""); refreshAfterStatus();
      syncBan(student, true, reason);
    }).catch((error) => setToast(error));
  };

  const confirmUnblock = () => {
    if (!unblockTarget) return;
    const student = unblockTarget;
    studentsApi.setStatus(student.id, STUDENT_STATUS.ACTIVE).then(() => {
      setToast({ tone: "success", message: `"${student.name}" has been unblocked.` });
      setUnblockTarget(null); refreshAfterStatus();
      syncBan(student, false);
    }).catch((error) => setToast(error));
  };

  return (
    <div>
      <div className="ul-usr-header">
        <h2 className="ul-usr-header__title">Student Management &amp; Details</h2>
        <p className="ul-usr-header__subtitle">
          Search, view and act on student accounts. Blocking a misbehaving account suspends it immediately —
          the student loses access regardless of valid credentials, until an Admin unblocks it.
        </p>
      </div>
      {studentsState.loading && !studentsState.data && <div className="ul-edu-empty">Loading students…</div>}
      {studentsState.error && <div className="ul-edu-empty" role="alert"><p>{studentsState.error.message}</p><button type="button" className="ul-btn ul-btn--ghost" onClick={() => studentsState.refetch()}>Retry</button></div>}

      <div className="ul-usr-summary">
        <div className="ul-usr-summary__card">
          <p className="ul-usr-summary__label">Total students</p>
          <p className="ul-usr-summary__value">{counts.total}</p>
        </div>
        <div className="ul-usr-summary__card">
          <p className="ul-usr-summary__label">Active</p>
          <p className="ul-usr-summary__value">{counts.active}</p>
        </div>
        <div className="ul-usr-summary__card">
          <p className="ul-usr-summary__label">Blocked</p>
          <p className="ul-usr-summary__value">{counts.blocked}</p>
        </div>
      </div>

      <div className="ul-usr-toolbar">
        <label className="ul-usr-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by name, email or student ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ul-usr-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-usr-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Status: All</option>
          <option value={STUDENT_STATUS.ACTIVE}>Active</option>
          <option value={STUDENT_STATUS.BLOCKED}>Blocked</option>
        </select>

        <select className="ul-usr-select" value={gradeFilter} onChange={(e) => setGradeFilter(e.target.value)}>
          <option value="all">Grade: All</option>
          {GRADE_OPTIONS.map((g) => (
            <option key={g} value={g}>{g}</option>
          ))}
        </select>
      </div>

      <div className="ul-card ul-usr-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-usr-empty">No students match these filters.</div>
        ) : (
          <div className="ul-usr-table-scroll">
            <table className="ul-usr-table ul-usr-mgmt-table">
              <colgroup>
                <col style={{ width: "25%" }} />
                <col style={{ width: "25%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "13%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Email</th>
                  <th>Grade</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((s) => (
                  <tr key={s.id} className="ul-usr-row--clickable" onClick={() => setDetailsStudent(s)}>
                    <td>
                      <div className="ul-usr-name-cell">
                        <div className="ul-avatar-chip ul-usr-avatar">{s.initials}</div>
                        <div className="ul-usr-name-cell__body">
                          <button type="button" className="ul-usr-name-link" onClick={() => setDetailsStudent(s)}>
                            {s.name}
                          </button>
                        </div>
                      </div>
                    </td>
                    <td>{s.email}</td>
                    <td>{s.grade}</td>
                    <td>{s.registeredDate}</td>
                    <td>
                      <StatusBadge status={s.status} />
                    </td>
                    <td>
                      <div className="ul-usr-actions-cell" onClick={(e) => e.stopPropagation()}>
                        {s.status === STUDENT_STATUS.ACTIVE ? (
                          <button
                            type="button"
                            className="ul-btn ul-btn--danger ul-usr-btn-sm"
                            onClick={() => openBlock(s)}
                          >
                            Block
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="ul-btn ul-btn--primary ul-usr-btn-sm"
                            onClick={() => setUnblockTarget(s)}
                          >
                            Unblock
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

        {pageItems.length > 0 && (
          <div className="ul-usr-pagination">
            <span className="ul-usr-pagination__info">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, total)} of {total}
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

      {/* ---------- read-only Student Details view ---------- */}
      {detailsStudent && (
        <div className="ul-usr-review-backdrop" onClick={() => setDetailsStudent(null)}>
          <div
            className="ul-usr-review-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Student details for ${detailsStudent.name}`}
          >
            {/* fixed header */}
            <div className="ul-usr-review-modal__head">
              <div className="ul-usr-review-modal__header">
                <div className="ul-avatar-chip ul-usr-avatar ul-usr-avatar--lg">{detailsStudent.initials}</div>
                <div className="ul-usr-review-modal__header-text">
                  <h3 className="ul-usr-review-modal__title">{detailsStudent.name}</h3>
                  <p className="ul-usr-review-modal__sub">{detailsStudent.grade}</p>
                </div>
                <button
                  type="button"
                  className="ul-usr-review-modal__close"
                  onClick={() => setDetailsStudent(null)}
                  aria-label="Close"
                >
                  <IconClose size={15} />
                </button>
              </div>
              <StatusBadge status={detailsStudent.status} />
            </div>

            {/* scrollable body */}
            <div className="ul-usr-review-modal__body">
              {/* 1. Contact information */}
              <div className="ul-usr-review-section">
                <p className="ul-usr-review-section__title">Contact Information</p>
                <div className="ul-usr-review-meta">
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Email</p>
                    <p className="ul-usr-review-meta__value">{detailsStudent.email}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Phone</p>
                    <p className="ul-usr-review-meta__value">{detailsStudent.phone}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Location</p>
                    <p className="ul-usr-review-meta__value">{detailsStudent.city}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Grade</p>
                    <p className="ul-usr-review-meta__value">{detailsStudent.grade}</p>
                  </div>
                </div>
              </div>

              {/* 2. Account information */}
              <div className="ul-usr-review-section">
                <p className="ul-usr-review-section__title">Account Information</p>
                <div className="ul-usr-review-meta">
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Registered</p>
                    <p className="ul-usr-review-meta__value">{detailsStudent.registeredDate}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Onboarded by</p>
                    <p className="ul-usr-review-meta__value"><AcquiredVia studentId={detailsStudent.id} /></p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Last active</p>
                    <p className="ul-usr-review-meta__value">{detailsStudent.lastActive}</p>
                  </div>
                  <div className="ul-usr-review-meta__item">
                    <p className="ul-usr-review-meta__label">Status</p>
                    <p className="ul-usr-review-meta__value">
                      <StatusBadge status={detailsStudent.status} />
                    </p>
                  </div>
                </div>

                {detailsStudent.status === STUDENT_STATUS.BLOCKED && (
                  <div className="ul-usr-feedback-box" style={{ marginTop: 12 }} role="status" aria-label="Block details">
                    <strong>
                      Blocked{detailsStudent.blockedAt ? ` on ${detailsStudent.blockedAt}` : ""}
                      {detailsStudent.blockedByName ? ` by ${detailsStudent.blockedByName}` : ""}
                    </strong>
                    <span>Reason (admins only): {detailsStudent.blockedReason || "—"}</span>
                    <span>The student can't sign in or use the portal until an admin unblocks the account.</span>
                  </div>
                )}
                {detailsStudent.blockHistory?.length > 0 && (
                  <details style={{ marginTop: 10 }}>
                    <summary>Block history ({detailsStudent.blockHistory.length})</summary>
                    <ul>
                      {detailsStudent.blockHistory.map((h, i) => (
                        <li key={`${h.at}-${i}`}>
                          {h.action === "blocked" ? "Blocked" : "Unblocked"} on {h.at} by {h.byName}{h.reason ? `: ${h.reason}` : ""}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </div>

              {/* 3. Enrolled test series (display names; the underlying enrolment records are unchanged) */}
              <div className="ul-usr-review-section">
                <p className="ul-usr-review-section__title">Enrolled Test Series</p>
                {/* QA triage P7 (#14): the student's own enrolments, with the real titles
                    (this used to show made-up names hashed from the student id). */}
                {detailsStudent.enrolledSeries.length === 0 ? (
                  <p className="ul-usr-review-meta__value ul-usr-review-meta__value--muted">Not enrolled in any test series yet.</p>
                ) : (
                  <div className="ul-usr-course-list" aria-label="Enrolled test series">
                    {detailsStudent.enrolledSeries.map((c) => (
                      <div key={c.seriesId || c.title} className="ul-usr-course-row">
                        <span className="ul-usr-course-row__title">
                          {c.title}
                          <small style={{ display: "block", opacity: 0.7 }}>
                            Enrolled {c.enrolledDate} · {c.testsDone}/{c.testsTotal} tests · {c.attempts} attempt{c.attempts === 1 ? "" : "s"}
                            {c.bestScore != null ? ` · best ${c.bestScore}%` : ""}
                          </small>
                        </span>
                        <div className="ul-usr-course-row__progress">
                          <div className="ul-usr-course-row__bar">
                            <div className="ul-usr-course-row__bar-fill" style={{ width: `${c.progress}%` }} />
                          </div>
                          <span>{c.progress}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* sticky action bar */}
            <div className="ul-usr-review-modal__actions">
              {detailsStudent.status === STUDENT_STATUS.ACTIVE ? (
                <button
                  type="button"
                  className="ul-btn ul-btn--danger"
                  onClick={() => openBlock(detailsStudent)}
                >
                  Block Account
                </button>
              ) : (
                <button
                  type="button"
                  className="ul-btn ul-btn--primary"
                  onClick={() => setUnblockTarget(detailsStudent)}
                >
                  Unblock Account
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- block-with-reason popup — standalone, opened from the list or Student Details ---------- */}
      <ConfirmModal
        open={!!blockTarget}
        title="Block this student account?"
        description={
          blockTarget
            ? `"${blockTarget.name}" will immediately lose access to the platform, regardless of valid credentials, until an Admin unblocks the account.`
            : ""
        }
        confirmLabel="Block Account"
        tone="danger"
        confirmDisabled={!blockReason.trim()}
        onConfirm={confirmBlock}
        onCancel={cancelBlock}
      >
        <textarea
          className="ul-usr-reason"
          placeholder="e.g. Repeated sharing of course content outside the platform…"
          value={blockReason}
          onChange={(e) => setBlockReason(e.target.value)}
        />
      </ConfirmModal>

      {/* ---------- unblock confirm — standalone, opened from the list or Student Details ---------- */}
      <ConfirmModal
        open={!!unblockTarget}
        title="Unblock this student account?"
        description={unblockTarget ? `"${unblockTarget.name}" will regain access to the platform immediately.` : ""}
        confirmLabel="Unblock"
        tone="default"
        onConfirm={confirmUnblock}
        onCancel={() => setUnblockTarget(null)}
      />

      <PageToast message={toast} onDone={() => setToast("")} />
    </div>
  );
}
