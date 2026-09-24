// Course Management & Approval Queue
// Jira: Day 3 — Course management & approval queue (updated pass: Reject
// is a standalone popup on the queue itself; Course Details is read-only
// and reachable only via "Details" on Approved/Rejected rows)
// A course starts in draft, fully editable only by its owning educator.
// Submitting for review freezes it for the educator and surfaces it to
// Admin. Only an Admin approval can move a course to published — an
// educator cannot publish their own course directly, even by
// manipulating the request, because that transition is enforced at the
// data layer, not just in the interface.
//
// Compact queue of courses submitted for publishing:
// - Pending Review rows show Approve / Reject directly in the queue.
//   Reject opens ONLY the small "Return this course with feedback?"
//   popup on top of the queue — it never touches the bigger Course
//   Details view, so Cancel/X on that popup just closes it and leaves
//   the Admin on the queue, nothing else opens or navigates.
// - Approved / Rejected rows show a single "Details" button that opens
//   the existing (read-only) Course Details view for that course, with
//   the full basic info / educator info / curriculum / course details /
//   submission info sections built for the previous pass of this screen.
// Backed by a small local mock store (useCourses()/approveCourse()/
// rejectCourse() in ../data/coursesMock.js) — the same pub/sub pattern
// already used by educatorsMock.js — so this is a drop-in swap for real
// adminApi.js calls later.
//
// Chrome (sidebar/topbar) comes from src/layouts/AdminLayout.jsx; this
// page reuses the same .ul-card / .ul-btn / .ul-status-badge classes as
// the dashboard and Educator Management (AdminDashboard.css /
// EducatorVerification.css) so the look matches exactly — table/toolbar/
// modal-specific layout lives in CourseApproval.css.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  useCourses,
  approveCourse,
  rejectCourse,
  COURSE_STATUS,
  COURSE_STATUS_LABEL,
  CATEGORY_OPTIONS,
  LESSON_TYPE_LABEL,
} from "../data/coursesMock";
import ConfirmModal from "../components/ConfirmModal";
import { IconSearch, IconClose, IconChevronDown } from "../components/icons";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./CourseApproval.css";

const PAGE_SIZE = 8;
const STATUS_BADGE_CLASS = {
  [COURSE_STATUS.PENDING]: "is-pending",
  [COURSE_STATUS.APPROVED]: "is-approved",
  [COURSE_STATUS.REJECTED]: "is-rejected",
};

// Educator verification statuses mirror the ones used on the Educator
// Management screen (../data/educatorsMock.js / EducatorVerification.jsx)
// — "under_review" reuses the same amber "pending" treatment there.
const EDUCATOR_VERIFICATION_LABEL = {
  verified: "Verified",
  pending: "Pending",
  under_review: "Under review",
  rejected: "Rejected",
};
const EDUCATOR_VERIFICATION_BADGE_CLASS = {
  verified: "is-verified",
  pending: "is-pending",
  under_review: "is-pending",
  rejected: "is-rejected",
};

function StatusBadge({ status }) {
  return <span className={`ul-status-badge ${STATUS_BADGE_CLASS[status]}`}>{COURSE_STATUS_LABEL[status]}</span>;
}

function EducatorVerificationBadge({ status }) {
  return (
    <span className={`ul-status-badge ${EDUCATOR_VERIFICATION_BADGE_CLASS[status] || "is-pending"}`}>
      {EDUCATOR_VERIFICATION_LABEL[status] || "Pending"}
    </span>
  );
}

function CourseThumb({ course, size = "sm" }) {
  return (
    <div
      className={`ul-crs-thumb ul-crs-thumb--${size}`}
      style={{ background: course.thumbnailAccent }}
      aria-hidden="true"
    >
      {course.thumbnailInitials}
    </div>
  );
}

// One curriculum module, collapsed by default — expands in place to show
// each lesson's title and content type without leaving the compact view.
function CurriculumModule({ module, open, onToggle }) {
  return (
    <div className={`ul-crs-curriculum-module${open ? " is-open" : ""}`}>
      <button
        type="button"
        className="ul-crs-curriculum-row"
        onClick={onToggle}
        aria-expanded={open}
      >
        <span className="ul-crs-curriculum-row__left">
          <IconChevronDown size={14} color="var(--color-text-muted)" />
          <span>{module.module}</span>
        </span>
        <span>{module.lessons.length} lessons</span>
      </button>
      {open && (
        <div className="ul-crs-curriculum-lessons">
          {module.lessons.map((lesson) => (
            <div key={lesson.title} className="ul-crs-lesson-row">
              <span className="ul-crs-lesson-row__title">{lesson.title}</span>
              <span className={`ul-crs-lesson-type is-${lesson.type}`}>{LESSON_TYPE_LABEL[lesson.type]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CourseApproval() {
  const courses = useCourses();
  const navigate = useNavigate();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [reviewCourse, setReviewCourse] = useState(null); // course object currently open in the read-only Course Details view (Approved/Rejected only, via "Details")
  const [openModules, setOpenModules] = useState(() => new Set()); // expanded curriculum modules, keyed by module title
  const [rejectOpen, setRejectOpen] = useState(false); // feedback popup open/closed
  const [rejectTarget, setRejectTarget] = useState(null); // course being rejected — independent of reviewCourse so the popup never touches Course Details
  const [rejectReason, setRejectReason] = useState("");
  const [approveOpen, setApproveOpen] = useState(null); // course pending an Approve confirmation
  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, categoryFilter]);

  // Collapse curriculum back to compact whenever a different course is opened.
  useEffect(() => {
    setOpenModules(new Set());
  }, [reviewCourse?.id]);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return courses.filter((c) => {
      if (q && !`${c.title} ${c.educator} ${c.id}`.toLowerCase().includes(q)) return false;
      if (statusFilter !== "all" && c.status !== statusFilter) return false;
      if (categoryFilter !== "all" && c.category !== categoryFilter) return false;
      return true;
    });
  }, [courses, search, statusFilter, categoryFilter]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  const counts = useMemo(
    () => ({
      total: courses.length,
      pending: courses.filter((c) => c.status === COURSE_STATUS.PENDING).length,
      approved: courses.filter((c) => c.status === COURSE_STATUS.APPROVED).length,
      rejected: courses.filter((c) => c.status === COURSE_STATUS.REJECTED).length,
    }),
    [courses]
  );

  const toggleModule = (title) => {
    setOpenModules((prev) => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  const handleApprove = (course) => {
    approveCourse(course.id);
    setToast(`"${course.title}" approved and eligible to go live.`);
    setApproveOpen(null);
  };

  // Opens ONLY the small feedback popup for the given course — deliberately
  // does not touch reviewCourse/Course Details at all.
  const openReject = (course) => {
    setRejectTarget(course);
    setRejectReason("");
    setRejectOpen(true);
  };

  // Cancel/X on the popup both route through ConfirmModal's onCancel — this
  // must only ever close the popup, never open or affect Course Details.
  const cancelReject = () => {
    setRejectOpen(false);
    setRejectTarget(null);
  };

  const confirmReject = () => {
    if (!rejectTarget || !rejectReason.trim()) return;
    rejectCourse(rejectTarget.id, rejectReason.trim());
    setToast(`"${rejectTarget.title}" returned to the educator with feedback.`);
    setRejectOpen(false);
    setRejectTarget(null);
  };

  return (
    <div>
      <div className="ul-crs-header">
        <h2 className="ul-crs-header__title">Course Management &amp; Approval Queue</h2>
        <p className="ul-crs-header__subtitle">
          Review courses submitted for publishing. A course cannot go live until it is approved here — Approve
          publishes it, Reject/Return with Feedback sends it back to the educator with the changes required.
        </p>
      </div>

      <div className="ul-crs-summary">
        <div className="ul-crs-summary__card">
          <p className="ul-crs-summary__label">Total submissions</p>
          <p className="ul-crs-summary__value">{counts.total}</p>
        </div>
        <div className="ul-crs-summary__card">
          <p className="ul-crs-summary__label">Pending review</p>
          <p className="ul-crs-summary__value">{counts.pending}</p>
        </div>
        <div className="ul-crs-summary__card">
          <p className="ul-crs-summary__label">Approved</p>
          <p className="ul-crs-summary__value">{counts.approved}</p>
        </div>
        <div className="ul-crs-summary__card">
          <p className="ul-crs-summary__label">Rejected</p>
          <p className="ul-crs-summary__value">{counts.rejected}</p>
        </div>
      </div>

      <div className="ul-crs-toolbar">
        <label className="ul-crs-search">
          <IconSearch size={14} color="var(--color-text-muted)" />
          <input
            type="text"
            placeholder="Search by course title, educator or ID…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button type="button" className="ul-crs-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
              <IconClose size={12} />
            </button>
          )}
        </label>

        <select className="ul-crs-select" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="all">Status: All</option>
          <option value={COURSE_STATUS.PENDING}>Pending Review</option>
          <option value={COURSE_STATUS.APPROVED}>Approved</option>
          <option value={COURSE_STATUS.REJECTED}>Rejected</option>
        </select>

        <select className="ul-crs-select" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
          <option value="all">Category: All</option>
          {CATEGORY_OPTIONS.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div className="ul-card ul-crs-table-card">
        {pageItems.length === 0 ? (
          <div className="ul-crs-empty">No courses match these filters.</div>
        ) : (
          <div className="ul-crs-table-scroll">
            <table className="ul-crs-table">
              <colgroup>
                <col style={{ width: "29%" }} />
                <col style={{ width: "16%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "13%" }} />
                <col style={{ width: "16%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Course</th>
                  <th>Educator</th>
                  <th>Category</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((c) => (
                  <tr key={c.id} className="ul-crs-row--clickable" onClick={() => setReviewCourse(c)}>
                    <td>
                      <div className="ul-crs-title-cell">
                        <CourseThumb course={c} size="sm" />
                        <div className="ul-crs-title-cell__body">
                          <button type="button" className="ul-crs-title-link" onClick={() => setReviewCourse(c)}>
                            {c.title}
                          </button>
                          <span className="ul-crs-title-sub">{c.id}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="ul-crs-title-link"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/admin/educatorverification/${c.educatorId}`);
                        }}
                      >
                        {c.educator}
                      </button>
                    </td>
                    <td>
                      <span className="ul-crs-cat-chip">{c.category}</span>
                    </td>
                    <td>{c.submittedDate}</td>
                    <td>
                      <StatusBadge status={c.status} />
                    </td>
                    <td>
                      <div className="ul-crs-actions-cell" onClick={(e) => e.stopPropagation()}>
                        {c.status === COURSE_STATUS.PENDING ? (
                          <>
                            <button
                              type="button"
                              className="ul-btn ul-btn--primary ul-crs-btn-sm"
                              onClick={() => setApproveOpen(c)}
                            >
                              Approve
                            </button>
                            <button
                              type="button"
                              className="ul-btn ul-btn--danger ul-crs-btn-sm"
                              onClick={() => openReject(c)}
                            >
                              Reject
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            className="ul-btn ul-btn--ghost ul-crs-btn-sm"
                            onClick={() => setReviewCourse(c)}
                          >
                            Details
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
          <div className="ul-crs-pagination">
            <span className="ul-crs-pagination__info">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, filtered.length)} of {filtered.length}
            </span>
            <div className="ul-crs-pagination__controls">
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

      {/* ---------- read-only Course Details view (Approved/Rejected "Details") ---------- */}
      {reviewCourse && (
        <div className="ul-crs-review-backdrop" onClick={() => setReviewCourse(null)}>
          <div
            className="ul-crs-review-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={`Course details for ${reviewCourse.title}`}
          >
            {/* fixed header */}
            <div className="ul-crs-review-modal__head">
              <div className="ul-crs-review-modal__header">
                <CourseThumb course={reviewCourse} size="lg" />
                <div className="ul-crs-review-modal__header-text">
                  <h3 className="ul-crs-review-modal__title">{reviewCourse.title}</h3>
                  <p className="ul-crs-review-modal__sub">
                    {reviewCourse.id} · {reviewCourse.category} · {reviewCourse.subCategory}
                  </p>
                </div>
                <button
                  type="button"
                  className="ul-crs-review-modal__close"
                  onClick={() => setReviewCourse(null)}
                  aria-label="Close"
                >
                  <IconClose size={15} />
                </button>
              </div>
              <StatusBadge status={reviewCourse.status} />
            </div>

            {/* scrollable body */}
            <div className="ul-crs-review-modal__body">
              {/* 1. Basic course information */}
              <div className="ul-crs-review-section">
                <p className="ul-crs-review-section__title">Basic Information</p>
                <div className="ul-crs-review-meta">
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Category</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.category}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Sub-category</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.subCategory}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Level</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.level}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Language</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.language}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Course type</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.courseType}</p>
                  </div>
                </div>
              </div>

              {/* 2. Educator information */}
              <div className="ul-crs-review-section">
                <p className="ul-crs-review-section__title">Educator Information</p>
                <div className="ul-crs-educator-row">
                  <div className="ul-crs-educator-row__info">
                    <span className="ul-crs-educator-row__name">{reviewCourse.educator}</span>
                    <span className="ul-crs-educator-row__contact">
                      <span>{reviewCourse.educatorEmail}</span>
                      <span>{reviewCourse.educatorPhone}</span>
                    </span>
                  </div>
                  <div className="ul-crs-educator-row__right">
                    <EducatorVerificationBadge status={reviewCourse.educatorVerificationStatus} />
                    <button
                      type="button"
                      className="ul-btn ul-btn--ghost ul-crs-btn-sm"
                      onClick={() => navigate(`/admin/educatorverification/${reviewCourse.educatorId}`)}
                    >
                      View Educator Profile
                    </button>
                  </div>
                </div>
              </div>

              {/* 3. Course content / curriculum */}
              <div className="ul-crs-review-section">
                <p className="ul-crs-review-section__title">Course Content / Curriculum</p>
                <div className="ul-crs-curriculum-list">
                  {reviewCourse.curriculum.map((m) => (
                    <CurriculumModule
                      key={m.module}
                      module={m}
                      open={openModules.has(m.module)}
                      onToggle={() => toggleModule(m.module)}
                    />
                  ))}
                </div>
              </div>

              {/* 4. Course details */}
              <div className="ul-crs-review-section">
                <p className="ul-crs-review-section__title">Course Details</p>
                <div className="ul-crs-review-meta">
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Price</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.price}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Total lessons</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.lessons}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Duration</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.duration}</p>
                  </div>
                </div>

                <div className="ul-crs-review-section">
                  <p className="ul-crs-review-section__title">Description</p>
                  <p>{reviewCourse.description}</p>
                </div>

                <div className="ul-crs-review-section">
                  <p className="ul-crs-review-section__title">Learning Outcomes</p>
                  <ul className="ul-crs-plain-list">
                    {reviewCourse.learningOutcomes.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                </div>

                <div className="ul-crs-review-section">
                  <p className="ul-crs-review-section__title">Prerequisites</p>
                  <ul className="ul-crs-plain-list">
                    {reviewCourse.prerequisites.map((p) => (
                      <li key={p}>{p}</li>
                    ))}
                  </ul>
                </div>

                <div className="ul-crs-review-section">
                  <p className="ul-crs-review-section__title">Skills Covered</p>
                  <div className="ul-crs-tag-list">
                    {reviewCourse.skillsCovered.map((s) => (
                      <span key={s} className="ul-crs-tag">{s}</span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 5. Submission information */}
              <div className="ul-crs-review-section">
                <p className="ul-crs-review-section__title">Submission Information</p>
                <div className="ul-crs-review-meta">
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Submitted</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.submittedDate}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Last updated</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.lastUpdatedDate}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Submitted by</p>
                    <p className="ul-crs-review-meta__value">{reviewCourse.educator}</p>
                  </div>
                  <div className="ul-crs-review-meta__item">
                    <p className="ul-crs-review-meta__label">Current status</p>
                    <p className="ul-crs-review-meta__value">
                      <StatusBadge status={reviewCourse.status} />
                    </p>
                  </div>
                  {reviewCourse.reviewedDate && (
                    <div className="ul-crs-review-meta__item">
                      <p className="ul-crs-review-meta__label">Last reviewed</p>
                      <p className="ul-crs-review-meta__value ul-crs-review-meta__value--wrap">
                        {reviewCourse.reviewedDate} by {reviewCourse.reviewedBy}
                      </p>
                    </div>
                  )}
                </div>

                {reviewCourse.status === COURSE_STATUS.REJECTED && reviewCourse.feedback && (
                  <div className="ul-crs-feedback-box" style={{ marginTop: 12 }}>
                    <strong>Feedback sent to educator</strong>
                    {reviewCourse.feedback}
                  </div>
                )}

                {reviewCourse.status !== COURSE_STATUS.REJECTED && reviewCourse.previousFeedback && (
                  <div className="ul-crs-feedback-box ul-crs-feedback-box--muted" style={{ marginTop: 12 }}>
                    <strong>Previously returned with this feedback</strong>
                    {reviewCourse.previousFeedback}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------- reject-with-feedback popup — standalone, opened directly from the queue row ---------- */}
      <ConfirmModal
        open={rejectOpen}
        title="Return this course with feedback?"
        description="Tell the educator what needs to change before this course can be resubmitted. This feedback is shown to the educator and stored with the course."
        confirmLabel="Reject & Send Feedback"
        tone="danger"
        confirmDisabled={!rejectReason.trim()}
        onConfirm={confirmReject}
        onCancel={cancelReject}
      >
        <textarea
          className="ul-crs-reason"
          placeholder="e.g. Add a risk-disclosure module and complete all lesson uploads before resubmitting…"
          value={rejectReason}
          onChange={(e) => setRejectReason(e.target.value)}
        />
      </ConfirmModal>

      {/* ---------- approve confirm — standalone, opened directly from the queue row ---------- */}
      <ConfirmModal
        open={!!approveOpen}
        title="Approve this course?"
        description={approveOpen ? `"${approveOpen.title}" will move to Approved and become eligible to go live for students.` : ""}
        confirmLabel="Approve"
        tone="default"
        onConfirm={() => approveOpen && handleApprove(approveOpen)}
        onCancel={() => setApproveOpen(null)}
      />

      {toast && <div className="ul-crs-toast">{toast}</div>}
    </div>
  );
}
