// Assign Educators — part of the Test Series Management section. Admins
// assign educators to build out tests/question papers for a subject
// within a Test Series (existing or new), track that work through to
// submission, and review it here too (the "Review & Approval" tab is a
// view over the SAME assignment records, not a second dataset).
//
// Reuses existing Admin primitives rather than inventing new ones:
// .ul-edu-header / .ul-edu-toolbar / .ul-edu-table / .ul-edu-pagination /
// .ul-edu-row-menu (EducatorVerification.css), .ul-card / .ul-status-badge
// (AdminDashboard.css), .ul-set-drawer* (SettingsPermissions.css),
// .ul-ts-form* / .ul-ts-pill-toggle (TestSeries.css), .ul-confirm-modal
// (ConfirmModal.css), .ul-mgmt-detail-* (ManagementDashboards.css),
// .ul-edp-tabs (EducatorProfile.css).

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ASSIGNMENT_STATUS,
  ASSIGNMENT_STATUS_LABEL,
  ASSIGNMENT_STATUS_BADGE_CLASS,
  QUESTION_TYPE_MIX,
  QUESTION_TYPE_MIX_LABEL,
  DIFFICULTY_OPTIONS,
  REQUEST_STATUS,
  REQUEST_STATUS_LABEL,
  REQUEST_STATUS_BADGE_CLASS,
} from "../data/testAssignmentsMock";
import { SUBJECT_OPTIONS, AUDIENCE_OPTIONS } from "../data/testSeriesMock";
import { GRADE_OPTIONS, EXAM_OPTIONS } from "../data/testSeriesWizard";
import { useRpc } from "../hooks/useRpc";
import { assignmentsApi, mapAssignment } from "../services/assignmentsApi";
import { IconSearch, IconClose, IconChevronDown, IconMore, IconPlus, IconBell } from "../components/icons";
import ConfirmModal from "../components/ConfirmModal";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "../components/ConfirmModal.css";
import "./ManagementDashboards.css";
import "./TestSeries.css";
import "./SettingsPermissions.css";
import "./EducatorProfile.css";
import "./AssignEducators.css";
import PageToast from "../../../components/feedback/Toast";
import RowActionsMenu from "../../../components/common/RowActionsMenu";
import { scrollToFirstInvalid } from "../../../utils/scrollToFirstInvalid";
import { allocationSummary, defaultAllocation, shareOf, validateAssignmentForm } from "../data/assignmentForm";

const money = () => ""; // placeholder kept out — no currency on this page
const getDisplayStatus = (a) => a.displayStatus || a.status;
const getAssignmentProgress = (a) => Number(a.progress || 0);

function StatusBadge({ status }) {
  return <span className={`ul-status-badge ${ASSIGNMENT_STATUS_BADGE_CLASS[status] || "is-pending"}`}>{ASSIGNMENT_STATUS_LABEL[status] || status}</span>;
}

// The details modal's assignment (QA #24): the list row merged with the
// get_assignment_detail response. history comes from the response (it is
// next to the assignment there, not on it); missing parts are empty, never
// undefined, so the modal can't crash into a blank screen.
export function buildDetailAssignment(data, row, id) {
  // No id = the modal is closed (QA 13 Nov: the cached detail response used to
  // keep it open after X). A response for another assignment is ignored.
  if (!id) return null;
  const fromDetail = data?.assignment && data.assignment.id === id ? mapAssignment(data.assignment) : null;
  if (!fromDetail && !row) return null;
  const history = (fromDetail && Array.isArray(data?.history) ? data.history : []).map((h) => ({
    action: h.action || "", note: h.note || "", at: h.at || h.created_at || null, by: h.by || h.by_name || "Admin",
  }));
  return { ...(row || {}), ...(fromDetail || {}), history, topics: (fromDetail || row)?.topics || [] };
}

function fmtDate(d) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}
function fmtDateTime(d) {
  if (!d) return "—";
  return new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

const ASSIGN_SUBJECTS = [
  ...SUBJECT_OPTIONS,
  ...["Social Science", "History", "Geography", "Economics", "Commerce", "Accountancy", "Environmental Science", "Hindi", "Statistics", "Electronics"].filter((x) => !SUBJECT_OPTIONS.includes(x)),
];

const EMPTY_FORM = {
  seriesMode: "existing", // "existing" | "new"
  seriesId: "",
  newSeriesName: "",
  subject: SUBJECT_OPTIONS[0],
  topicsText: "",
  educatorIds: [],
  testName: "",
  testCount: 1,
  grade: "",
  exam: "",
  audience: "",
  questionCount: 20,
  questionTypeMix: QUESTION_TYPE_MIX.MIXED,
  difficulty: "Medium",
  totalMarks: 50,
  duration: 60,
  instructions: "",
  deadline: "",
  allocation: [],   // educator id per test (create only; QA 13 Nov)
};

export default function AssignEducators() {
  const [tab, setTab] = useState("management"); // "management" | "review"
  const [toast, setToast] = useState("");

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(""), 3200);
    return () => clearTimeout(t);
  }, [toast]);


  // ---- Assignment Management: search / filters / sort / pagination ----
  const [search, setSearch] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const filterRef = useRef(null);
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [educatorFilter, setEducatorFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [deadlineBefore, setDeadlineBefore] = useState("");
  const [sortBy, setSortBy] = useState("deadline_asc");
  const [page, setPage] = useState(1);
  const listRequest = useCallback(() => assignmentsApi.list({
    p_search: search.trim() || null,
    p_sort: sortBy,
    p_subject: subjectFilter === "all" ? null : subjectFilter,
    p_educator: educatorFilter === "all" ? null : educatorFilter,
    p_status: statusFilter === "all" ? null : statusFilter,
    p_deadline_before: deadlineBefore || null,
    p_page: page,
    p_size: 8,
  }), [search, sortBy, subjectFilter, educatorFilter, statusFilter, deadlineBefore, page]);
  const assignmentsState = useRpc(listRequest);
  const assignments = assignmentsState.data?.rows || [];
  const assignmentTotal = Number(assignmentsState.data?.total || 0);
  const seriesState = useRpc(useCallback(() => assignmentsApi.series(), []));
  const eligibleState = useRpc(useCallback(() => assignmentsApi.eligibleEducators(), []));
  const requestState = useRpc(useCallback(() => assignmentsApi.requests(), []));
  const seriesList = seriesState.data || [];
  const eligibleEducators = eligibleState.data || [];

  useEffect(() => {
    if (!filtersOpen) return undefined;
    const onClick = (e) => {
      if (filterRef.current && !filterRef.current.contains(e.target)) setFiltersOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [filtersOpen]);

  const educatorOptions = useMemo(() => ["all", ...eligibleEducators.map((e) => e.full_name || e.name).filter(Boolean)], [eligibleEducators]);

  const activeFilterCount = [subjectFilter !== "all", educatorFilter !== "all", statusFilter !== "all", deadlineBefore !== ""].filter(Boolean).length;
  const clearFilters = () => {
    setSubjectFilter("all");
    setEducatorFilter("all");
    setStatusFilter("all");
    setDeadlineBefore("");
    setPage(1);
  };

  const PAGE_SIZE = 8;
  const pageCount = Math.max(1, Math.ceil(assignmentTotal / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageItems = assignments;

  // ---- Review & Approval: incoming test series requests ----
  const requests = requestState.data || [];
  const reviewRows = requests;
  const pendingRequestCount = requests.filter((r) => r.status === REQUEST_STATUS.PENDING).length;

  const [assignReqTarget, setAssignReqTarget] = useState(null);
  const [assignReqEducatorId, setAssignReqEducatorId] = useState("");
  const [assignReqDeadline, setAssignReqDeadline] = useState("");
  const [assignReqNote, setAssignReqNote] = useState("");
  const [rejectReqTarget, setRejectReqTarget] = useState(null);
  const [rejectReqReason, setRejectReqReason] = useState("");
  const openAssignRequest = (r) => {
    setAssignReqTarget(r.id);
    setAssignReqEducatorId("");
    setAssignReqDeadline(r.requestedDeadline || "");
    setAssignReqNote("");
  };
  const assignReqObj = requests.find((r) => r.id === assignReqTarget) || null;

  // ---- detail / form state ----
  const [detailId, setDetailId] = useState(null);
  const detailState = useRpc(useCallback(() => detailId ? assignmentsApi.detail(detailId) : Promise.resolve(null), [detailId]), { immediate: !!detailId });
  // Escape closes the details popup.
  useEffect(() => {
    if (!detailId) return undefined;
    const onKey = (e) => { if (e.key === "Escape") setDetailId(null); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [detailId]);
  const detailAssignment = buildDetailAssignment(detailState.data, assignments.find((a) => a.id === detailId), detailId);

  const [formMode, setFormMode] = useState(null); // null | "create" | "edit"
  const [form, setForm] = useState(EMPTY_FORM);
  const [formErrors, setFormErrors] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [formSaving, setFormSaving] = useState(false);
  // QA (13 Nov): each field shows its own message and the drawer scrolls to
  // the first one (formErrors is now only for errors from the server).
  const [fieldErrors, setFieldErrors] = useState({});
  const [errorTick, setErrorTick] = useState(0);
  const formBodyRef = useRef(null);
  useEffect(() => {
    if (errorTick) scrollToFirstInvalid(formBodyRef.current);
  }, [errorTick]);
  // a fixed field loses its message as soon as it is valid
  useEffect(() => {
    setFieldErrors((prev) => {
      const keys = Object.keys(prev);
      if (!keys.length) return prev;
      const now = Object.fromEntries(validateAssignmentForm(form, { mode: formMode || "create" }).map((e) => [e.field, e.message]));
      const next = Object.fromEntries(keys.filter((k) => now[k]).map((k) => [k, now[k]]));
      return Object.keys(next).length === keys.length && keys.every((k) => next[k] === prev[k]) ? prev : next;
    });
  }, [form, formMode]);
  const fieldProps = (name) => (fieldErrors[name]
    ? { "aria-invalid": true, "aria-describedby": `asg-err-${name}` }
    : {});
  const FieldMsg = ({ name }) => (fieldErrors[name] ? <p className="ul-field-error" id={`asg-err-${name}`}>{fieldErrors[name]}</p> : null);
  const allocation = formMode === "create" ? defaultAllocation(form.testCount, form.educatorIds, form.allocation) : [];

  const openCreateForm = () => {
    setForm(EMPTY_FORM);
    setFormErrors([]);
    setFieldErrors({});
    setEditingId(null);
    setFormMode("create");
  };
  const openEditForm = (a) => {
    setForm({
      seriesMode: "existing",
      seriesId: a.seriesId || "",
      newSeriesName: a.seriesId ? "" : a.seriesName,
      subject: a.subject,
      topicsText: (a.topics || []).join(", "),
      educatorIds: [a.educatorId],
      testName: a.testName,
      testCount: a.testCount || 1,
      grade: a.grade || "",
      exam: a.exam || "",
      audience: a.audience || "",
      questionCount: a.questionCount,
      questionTypeMix: a.questionTypeMix,
      difficulty: a.difficulty,
      totalMarks: a.totalMarks,
      duration: a.duration,
      instructions: a.instructions,
      deadline: a.deadline,
    });
    setFormErrors([]);
    setFieldErrors({});
    setEditingId(a.id);
    setFormMode("edit");
  };
  const closeForm = () => setFormMode(null);

  const submitForm = () => {
    const errors = validateAssignmentForm(form, { mode: formMode });
    setFormErrors([]);
    if (errors.length) {
      setFieldErrors(Object.fromEntries(errors.map((e) => [e.field, e.message])));
      setErrorTick((t) => t + 1);
      return;
    }
    setFieldErrors({});
    const topics = form.topicsText.split(",").map((t) => t.trim()).filter(Boolean);
    const selectedSeries = form.seriesMode === "existing" ? seriesList.find((s) => s.id === form.seriesId) : null;
    const seriesId = form.seriesMode === "existing" ? form.seriesId : null;
    const seriesName = form.seriesMode === "existing" ? selectedSeries?.name : form.newSeriesName.trim();

    // QA #23: wait for the save; show its error in the form, and only then
    // close, toast and refetch (it used to toast success before the save ran).
    const request = editingId
      ? assignmentsApi.updateRequirements(editingId, {
        seriesId,
        seriesName,
        subject: form.subject,
        topics,
        testName: form.testName.trim(),
        testCount: Number(form.testCount),
        grade: form.grade,
        exam: form.exam,
        audience: form.audience,
        questionCount: Number(form.questionCount),
        questionTypeMix: form.questionTypeMix,
        difficulty: form.difficulty,
        totalMarks: Number(form.totalMarks),
        duration: Number(form.duration),
        instructions: form.instructions,
        deadline: form.deadline,
      })
      : assignmentsApi.create({
        allocation: allocationSummary(allocation, form.educatorIds),   // QA (13 Nov): who builds which tests
        seriesMode: form.seriesMode,
        seriesId,
        newSeriesName: form.newSeriesName.trim(),
        subject: form.subject,
        topics,
        educatorIds: form.educatorIds,
        testName: form.testName.trim(),
        testCount: Number(form.testCount),
        grade: form.grade,
        exam: form.exam,
        audience: form.audience,
        questionCount: Number(form.questionCount),
        questionTypeMix: form.questionTypeMix,
        difficulty: form.difficulty,
        totalMarks: Number(form.totalMarks),
        duration: Number(form.duration),
        instructions: form.instructions,
        deadline: form.deadline,
      });
    const done = editingId
      ? "Assignment requirements updated. The educator has been notified."
      : `${allocationSummary(allocation, form.educatorIds).length} assignment${allocationSummary(allocation, form.educatorIds).length === 1 ? "" : "s"} created.`;
    setFormSaving(true);
    return request
      .then(() => {
        setToast({ tone: "success", message: done });
        setFormMode(null);
        assignmentsState.refetch();
        if (editingId && detailId === editingId) detailState.refetch().catch(() => {});
      })
      .catch((error) => { setFormErrors([error?.message || "Couldn't save the assignment."]); setErrorTick((t) => t + 1); })
      .finally(() => setFormSaving(false));
  };

  // ---- reassign / extend / cancel ----
  const [reassignTarget, setReassignTarget] = useState(null);
  const [reassignEducatorId, setReassignEducatorId] = useState("");
  const [extendTarget, setExtendTarget] = useState(null);
  const [extendDate, setExtendDate] = useState("");
  const [cancelTarget, setCancelTarget] = useState(null);
  const [cancelReason, setCancelReason] = useState("");

  // ---- review modal ----
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewDecision, setReviewDecision] = useState("approved");
  const [reviewFeedback, setReviewFeedback] = useState("");
  const [reviewReason, setReviewReason] = useState("");
  const [reviewQComment, setReviewQComment] = useState("");

  const openReview = (a) => {
    if (a.status === ASSIGNMENT_STATUS.SUBMITTED) assignmentsApi.startReview(a.id).then(() => assignmentsState.refetch()).catch((error) => setToast(error));
    setReviewTarget(a.id);
    setReviewDecision("approved");
    setReviewFeedback("");
    setReviewReason("");
    setReviewQComment("");
  };
  const reviewAssignment = assignments.find((a) => a.id === reviewTarget) || null;

  const submitReview = () => {
    if (!reviewAssignment) return;
    const questionComments = reviewQComment.trim() ? [{ questionRef: "General", comment: reviewQComment.trim() }] : [];
    assignmentsApi.review(reviewAssignment.id, reviewDecision, reviewFeedback, questionComments, reviewReason)
      .then(() => assignmentsState.refetch()).catch((error) => setToast(error));
    setToast(
      reviewDecision === "approved"
        ? "Submission approved. The educator has been notified."
        : reviewDecision === "revision"
        ? "Revision requested. The educator has been notified."
        : "Submission rejected. The educator has been notified."
    );
    setReviewTarget(null);
  };


  return (
    <>
      <PageToast message={toast} onDone={() => setToast("")} />

      <div className="ul-edu-header">
        <div>
          <h2 className="ul-edu-header__title">Assign Educators</h2>
          <p className="ul-edu-header__subtitle">
            Create and track educator assignments.
          </p>
        </div>
        {(assignmentsState.loading || seriesState.loading || eligibleState.loading || requestState.loading) && <div className="ul-edu-empty">Loading assignment data…</div>}
        {(assignmentsState.error || seriesState.error || eligibleState.error || requestState.error) && (
          <div className="ul-edu-empty" role="alert">
            <p>{assignmentsState.error?.message || seriesState.error?.message || eligibleState.error?.message || requestState.error?.message}</p>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => { assignmentsState.refetch(); seriesState.refetch(); eligibleState.refetch(); requestState.refetch(); }}>Retry</button>
          </div>
        )}
        {tab === "management" && (
          <button type="button" className="ul-btn ul-btn--primary ul-edu-add-btn" onClick={openCreateForm}>
            <IconPlus size={13} />
            <span>New Assignment</span>
          </button>
        )}
      </div>

      {tab === "management" && (
        <>
          <div className="ul-edu-toolbar">
            <label className="ul-edu-search">
              <IconSearch size={14} color="var(--color-text-muted)" />
              <input
                type="text"
                placeholder="Search by assignment ID, test, series or educator…"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              />
              {search && (
                <button type="button" className="ul-edu-search__clear" onClick={() => setSearch("")} aria-label="Clear search">
                  <IconClose size={12} />
                </button>
              )}
            </label>

            <select className="ul-edu-select ul-edu-select--sort" value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="deadline_asc">Deadline: soonest first</option>
              <option value="deadline_desc">Deadline: latest first</option>
              <option value="assigned_desc">Recently assigned</option>
              <option value="progress_desc">Progress: highest first</option>
            </select>

            <div className="ul-asg-filter-popover-wrap" ref={filterRef}>
              <button type="button" className={`ul-btn ul-btn--ghost ul-asg-filters-toggle${filtersOpen ? " is-open" : ""}`} onClick={() => setFiltersOpen((v) => !v)}>
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ""} <IconChevronDown size={13} />
              </button>
              {filtersOpen && (
                <div className="ul-asg-filter-popover">
                  <label className="ul-asg-filter-field">
                    <span>Subject</span>
                    <select value={subjectFilter} onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}>
                      <option value="all">All subjects</option>
                      {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label className="ul-asg-filter-field">
                    <span>Educator</span>
                    <select value={educatorFilter} onChange={(e) => { setEducatorFilter(e.target.value); setPage(1); }}>
                      {educatorOptions.map((e) => <option key={e} value={e}>{e === "all" ? "All educators" : e}</option>)}
                    </select>
                  </label>
                  <label className="ul-asg-filter-field">
                    <span>Status</span>
                    <select value={statusFilter} onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}>
                      <option value="all">All statuses</option>
                      {Object.values(ASSIGNMENT_STATUS).map((st) => <option key={st} value={st}>{ASSIGNMENT_STATUS_LABEL[st]}</option>)}
                      <option value="overdue">{ASSIGNMENT_STATUS_LABEL.overdue}</option>
                    </select>
                  </label>
                  <label className="ul-asg-filter-field">
                    <span>Deadline on/before</span>
                    <input type="date" value={deadlineBefore} onChange={(e) => { setDeadlineBefore(e.target.value); setPage(1); }} />
                  </label>
                  <button type="button" className="ul-btn ul-btn--ghost ul-asg-filter-popover__clear" onClick={clearFilters} disabled={activeFilterCount === 0}>
                    Clear Filters
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="ul-card ul-edu-table-card">
            {pageItems.length === 0 ? (
              <div className="ul-edu-empty">No assignments match your filters.</div>
            ) : (
              <div className="ul-edu-table-scroll">
                <table className="ul-edu-table ul-asg-table">
                  <colgroup>
                    <col style={{ width: "10%" }} />
                    <col style={{ width: "22%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "16%" }} />
                    <col style={{ width: "11%" }} />
                    <col style={{ width: "14%" }} />
                    <col style={{ width: "13%" }} />
                    <col style={{ width: "52px" }} />
                  </colgroup>
                  <thead>
                    <tr>
                      <th>Assignment</th>
                      <th>Test Series</th>
                      <th>Subject</th>
                      <th>Educator</th>
                      <th>Deadline</th>
                      <th>Progress</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageItems.map((a) => {
                      const displayStatus = getDisplayStatus(a);
                      const progress = getAssignmentProgress(a);
                      return (
                        <tr key={a.id} className="ul-edu-row--clickable" onClick={() => setDetailId(a.id)}>
                          <td><span className="ul-txn-id-chip">{a.id}</span></td>
                          <td className="ul-asg-ellipsis">{a.seriesName}</td>
                          <td>{a.subject}</td>
                          <td className="ul-asg-ellipsis">{a.educatorName}</td>
                          <td>{fmtDate(a.deadline)}</td>
                          <td>
                            <div className="ul-asg-progress">
                              <div className="ul-progress-track ul-asg-progress-track">
                                <div className="ul-progress-fill" style={{ width: `${progress}%` }} />
                              </div>
                              <span>{progress}%</span>
                            </div>
                          </td>
                          <td><StatusBadge status={displayStatus} /></td>
                          <td className="ul-edu-actions-cell" onClick={(ev) => ev.stopPropagation()}>
                            <div className="ul-edu-actions-inner">
                              {/* a completed or cancelled assignment only offers View Details */}
                              <RowActionsMenu triggerClassName="ul-edu-more-btn" icon={<IconMore size={15} />} items={(() => {
                                const closed = [ASSIGNMENT_STATUS.COMPLETED, ASSIGNMENT_STATUS.CANCELLED].includes(a.status);
                                return [
                                  { label: "View Details", onClick: () => setDetailId(a.id) },
                                  !closed && { label: "Edit Requirements", onClick: () => openEditForm(a) },
                                  !closed && { label: "Reassign Educator", onClick: () => { setReassignTarget(a.id); setReassignEducatorId(a.educatorId); } },
                                  !closed && { label: "Extend Deadline", onClick: () => { setExtendTarget(a.id); setExtendDate(a.deadline); } },
                                  !closed && [ASSIGNMENT_STATUS.SUBMITTED, ASSIGNMENT_STATUS.UNDER_REVIEW].includes(a.status) && { label: "Review Submission", onClick: () => openReview(a) },
                                  !closed && { label: "Cancel Assignment", danger: true, onClick: () => { setCancelTarget(a.id); setCancelReason(""); } },
                                ];
                              })()} />
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            {pageItems.length > 0 && (
              <div className="ul-edu-pagination">
                <span className="ul-edu-pagination__info">
                  Showing {(currentPage - 1) * PAGE_SIZE + 1}–{Math.min(currentPage * PAGE_SIZE, assignmentTotal)} of {assignmentTotal}
                </span>
                <div className="ul-edu-pagination__controls">
                  <button type="button" disabled={currentPage === 1} onClick={() => setPage(currentPage - 1)}>Previous</button>
                  <span>{currentPage} / {pageCount}</span>
                  <button type="button" disabled={currentPage === pageCount} onClick={() => setPage(currentPage + 1)}>Next</button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ---------- Create / Edit Assignment drawer ---------- */}
      {formMode && (
        <div className="ul-set-drawer-backdrop" onClick={closeForm}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">{formMode === "edit" ? "Edit Assignment Requirements" : "New Test Assignment"}</h3>
                <p className="ul-set-drawer__sub">
                  {formMode === "edit"
                    ? "The educator is notified of the changes in their portal."
                    : "Assign one or more educators to build a test or question paper."}
                </p>
              </div>
            </div>
            <div className="ul-set-drawer__body" ref={formBodyRef}>
              <div className="ul-ts-form">
                {(formErrors.length > 0 || Object.keys(fieldErrors).length > 0) && (
                  <div className="ul-ts-errors" role="alert" data-invalid={Object.keys(fieldErrors).length === 0 || undefined}>
                    <strong>Fix the following:</strong>
                    <ul>{[...Object.values(fieldErrors), ...formErrors].map((err, i) => <li key={i}>{err}</li>)}</ul>
                  </div>
                )}

                {formMode === "create" && (
                  <div className="ul-ts-form-row">
                    <label>Test Series</label>
                    <div className="ul-ts-pill-toggle">
                      <button type="button" className={form.seriesMode === "existing" ? "is-active" : ""} onClick={() => setForm({ ...form, seriesMode: "existing" })}>Existing series</button>
                      <button type="button" className={form.seriesMode === "new" ? "is-active" : ""} onClick={() => setForm({ ...form, seriesMode: "new" })}>New series</button>
                    </div>
                  </div>
                )}
                {formMode === "create" && form.seriesMode === "existing" && (
                  <div className="ul-ts-form-row">
                    <label>Select Test Series</label>
                    <select value={form.seriesId} onChange={(e) => setForm({ ...form, seriesId: e.target.value })} {...fieldProps("seriesId")}>
                      <option value="">Select a test series…</option>
                      {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    <FieldMsg name="seriesId" />
                  </div>
                )}
                {formMode === "create" && form.seriesMode === "new" && (
                  <div className="ul-ts-form-row">
                    <label>New Test Series Name</label>
                    <input type="text" value={form.newSeriesName} onChange={(e) => setForm({ ...form, newSeriesName: e.target.value })} placeholder="e.g. Class 12 Chemistry Mock Series" {...fieldProps("newSeriesName")} />
                    <FieldMsg name="newSeriesName" />
                  </div>
                )}

                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Subject</label>
                    <select value={ASSIGN_SUBJECTS.includes(form.subject) ? form.subject : "__other__"} onChange={(e) => setForm({ ...form, subject: e.target.value === "__other__" ? "" : e.target.value })}>
                      {ASSIGN_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
                      <option value="__other__">Other…</option>
                    </select>
                    {!ASSIGN_SUBJECTS.includes(form.subject) && (
                      <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Type the subject" style={{ marginTop: 6 }} autoFocus {...fieldProps("subject")} />
                    )}
                    <FieldMsg name="subject" />
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Topics (comma-separated)</label>
                    <input type="text" value={form.topicsText} onChange={(e) => setForm({ ...form, topicsText: e.target.value })} placeholder="e.g. Thermodynamics, Equilibrium" />
                  </div>
                </div>

                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Class / Grade</label>
                    <select value={form.grade} onChange={(e) => setForm({ ...form, grade: e.target.value })}>
                      <option value="">Select class / grade…</option>
                      {GRADE_OPTIONS.map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Exam / Goal</label>
                    <select value={form.exam} onChange={(e) => setForm({ ...form, exam: e.target.value })}>
                      <option value="">Select exam / goal…</option>
                      {EXAM_OPTIONS.map((x) => <option key={x} value={x}>{x}</option>)}
                    </select>
                  </div>
                </div>
                <div className="ul-ts-form-row">
                  <label>Target Audience</label>
                  <select value={form.audience} onChange={(e) => setForm({ ...form, audience: e.target.value })}>
                    <option value="">Select audience…</option>
                    {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                  </select>
                </div>

                <div className="ul-ts-form-row">
                  <label>Test / Question Paper Name</label>
                  <input type="text" value={form.testName} onChange={(e) => setForm({ ...form, testName: e.target.value })} placeholder="e.g. Full Mock Test 3 — Thermodynamics" {...fieldProps("testName")} />
                  <FieldMsg name="testName" />
                </div>

                {formMode === "create" && (
                  <div className="ul-ts-form-row">
                    <label>Assign To (select one or more educators)</label>
                    <div className="ul-asg-educator-list" data-invalid={fieldErrors.educatorIds ? true : undefined} aria-describedby={fieldErrors.educatorIds ? "asg-err-educatorIds" : undefined}>
                      {eligibleEducators.length === 0 && !eligibleState.loading && (
                        <p className="ul-edu-empty">No approved, active educators yet. Approve an educator in Educator Management first.</p>
                      )}
                      {eligibleEducators.map((e) => (
                        <label key={e.id} className="ul-asg-educator-option">
                          <input
                            type="checkbox"
                            checked={form.educatorIds.includes(e.id)}
                            onChange={(ev) => {
                              const next = ev.target.checked
                                ? [...form.educatorIds, e.id]
                                : form.educatorIds.filter((id) => id !== e.id);
                              setForm({ ...form, educatorIds: next });
                            }}
                          />
                          <span>{e.name}</span>
                          <small>{[e.subjects.join(", "), (e.languages || []).join(", "), `${e.openAssignments ?? 0} open`, e.rating ? `${e.rating}★` : null].filter(Boolean).join(" · ")}</small>
                        </label>
                      ))}
                    </div>
                    <FieldMsg name="educatorIds" />
                  </div>
                )}

                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Number of Tests</label>
                    <input type="number" min="1" step="1" value={form.testCount} onChange={(e) => setForm({ ...form, testCount: e.target.value })} {...fieldProps("testCount")} />
                    <FieldMsg name="testCount" />
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Question Count (all tests)</label>
                    <input type="number" min="1" value={form.questionCount} onChange={(e) => setForm({ ...form, questionCount: e.target.value })} {...fieldProps("questionCount")} />
                    <FieldMsg name="questionCount" />
                  </div>
                </div>

                {/* QA (13 Nov): who builds each test */}
                {formMode === "create" && form.educatorIds.length > 0 && allocation.length > 0 && allocation.length <= 50 && (
                  <div className="ul-ts-form-row ul-asg-allocation" data-invalid={fieldErrors.allocation ? true : undefined}>
                    <label>Who builds each test</label>
                    <ol className="ul-asg-allocation__list">
                      {allocation.map((educatorId, i) => (
                        <li key={i}>
                          <span>Test {i + 1}</span>
                          <select aria-label={`Educator for test ${i + 1}`} value={educatorId}
                            onChange={(e) => { const next = [...allocation]; next[i] = e.target.value; setForm({ ...form, allocation: next }); }}>
                            {form.educatorIds.map((id) => <option key={id} value={id}>{eligibleEducators.find((x) => x.id === id)?.name || "Educator"}</option>)}
                          </select>
                        </li>
                      ))}
                    </ol>
                    <p className="ul-asg-allocation__sum">
                      {allocationSummary(allocation, form.educatorIds).map((a) => {
                        const name = eligibleEducators.find((x) => x.id === a.educatorId)?.name || "Educator";
                        const marks = shareOf(form.totalMarks, a.tests, form.testCount);
                        const questions = Math.max(1, Math.round(shareOf(form.questionCount, a.tests, form.testCount)));
                        return `${name}: ${a.tests} test${a.tests === 1 ? "" : "s"} (${questions} questions${marks ? `, ${marks} marks` : ""})`;
                      }).join(" · ")}
                    </p>
                    {form.educatorIds.length === 1 && Number(form.testCount) > 1 && (
                      <p className="ul-asg-allocation__hint">One educator builds all {Number(form.testCount)} tests. Select more educators to split them.</p>
                    )}
                    <FieldMsg name="allocation" />
                  </div>
                )}
                {Number(form.testCount) > 0 && Number(form.questionCount) > 0 && (
                  <p style={{ margin: "-4px 0 0", fontSize: 11.5, color: "var(--color-text-muted)" }}>
                    {Number(form.testCount)} test{Number(form.testCount) === 1 ? "" : "s"} · about {Math.ceil(Number(form.questionCount) / Number(form.testCount))} question{Math.ceil(Number(form.questionCount) / Number(form.testCount)) === 1 ? "" : "s"}
                    {Number(form.totalMarks) > 0 ? ` and ${Math.round((Number(form.totalMarks) / Number(form.testCount)) * 10) / 10} marks` : ""} per test. Question count and total marks cover the whole series.
                  </p>
                )}
                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Question Type</label>
                    <select value={form.questionTypeMix} onChange={(e) => setForm({ ...form, questionTypeMix: e.target.value })}>
                      {Object.values(QUESTION_TYPE_MIX).map((v) => <option key={v} value={v}>{QUESTION_TYPE_MIX_LABEL[v]}</option>)}
                    </select>
                  </div>
                </div>
                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Difficulty Level</label>
                    <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                      {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Total Marks (all tests)</label>
                    <input type="number" min="1" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} {...fieldProps("totalMarks")} />
                    <FieldMsg name="totalMarks" />
                  </div>
                </div>
                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Duration per Test (minutes)</label>
                    <input type="number" min="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} {...fieldProps("duration")} />
                    <FieldMsg name="duration" />
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Deadline</label>
                    <input type="date" value={form.deadline} onChange={(e) => setForm({ ...form, deadline: e.target.value })} {...fieldProps("deadline")} />
                    <FieldMsg name="deadline" />
                  </div>
                </div>

                <div className="ul-ts-form-row">
                  <label>Instructions &amp; Guidelines</label>
                  <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Anything the educator should know before building this test" />
                </div>
              </div>
            </div>
            <div className="ul-set-drawer__actions ul-ts-drawer-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={closeForm}>Cancel</button>
              <button type="button" className="ul-btn ul-btn--primary" onClick={submitForm} disabled={formSaving}>
                {formMode === "edit" ? "Save Changes" : "Create Assignment"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Assign educator to an incoming request ---------- */}
      <ConfirmModal
        open={!!assignReqObj}
        title="Assign educator"
        description={assignReqObj ? `Approve "${assignReqObj.testName}" (${assignReqObj.subject}, ${assignReqObj.questionCount} questions, ${assignReqObj.totalMarks} marks) and assign an educator to build it. They will be notified in their portal.` : ""}
        confirmLabel="Assign & Notify"
        compact
        onConfirm={() => {
          assignmentsApi.assignRequest(assignReqTarget, assignReqEducatorId, assignReqDeadline, assignReqNote.trim())
            .then(() => { const who = eligibleEducators.find((e) => e.id === assignReqEducatorId)?.name || "the educator"; setToast(`Assigned to ${who}.`); setAssignReqTarget(null); requestState.refetch(); assignmentsState.refetch(); })
            .catch((error) => setToast(error));
        }}
        onCancel={() => setAssignReqTarget(null)}
        confirmDisabled={!assignReqEducatorId || !assignReqDeadline}
      >
        <div className="ul-ts-form-row">
          <label>Educator</label>
          <select value={assignReqEducatorId} onChange={(e) => setAssignReqEducatorId(e.target.value)}>
            <option value="">Select an educator…</option>
            {eligibleEducators.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
        <div className="ul-ts-form-row">
          <label>Deadline</label>
          <input type="date" value={assignReqDeadline} onChange={(e) => setAssignReqDeadline(e.target.value)} />
        </div>
        <div className="ul-ts-form-row">
          <label>Message to educator (optional)</label>
          <input type="text" value={assignReqNote} onChange={(e) => setAssignReqNote(e.target.value)} placeholder="Any extra instructions…" />
        </div>
      </ConfirmModal>

      {/* ---------- Reject an incoming request ---------- */}
      <ConfirmModal
        open={!!rejectReqTarget}
        title="Reject this request?"
        description="The request will be marked as rejected and no educator will be assigned."
        confirmLabel="Reject"
        tone="danger"
        compact
        onConfirm={() => {
          assignmentsApi.rejectRequest(rejectReqTarget, rejectReqReason.trim())
            .then(() => { setToast("Request rejected."); setRejectReqTarget(null); requestState.refetch(); })
            .catch((error) => setToast(error));
        }}
        onCancel={() => setRejectReqTarget(null)}
        confirmDisabled={!rejectReqReason.trim()}
      >
        <div className="ul-ts-form-row">
          <label>Reason</label>
          <input type="text" value={rejectReqReason} onChange={(e) => setRejectReqReason(e.target.value)} placeholder="Reason for rejecting" />
        </div>
      </ConfirmModal>

      {/* ---------- Reassign educator ---------- */}
      <ConfirmModal
        open={!!reassignTarget}
        title="Reassign educator"
        description={'This resets the assignment back to "Assigned" and clears any existing submission. The new educator will be notified in their portal.'}
        confirmLabel="Reassign"
        onConfirm={() => {
          assignmentsApi.reassign(reassignTarget, reassignEducatorId)
            .then(() => { setToast("Educator reassigned."); setReassignTarget(null); assignmentsState.refetch(); })
            .catch((error) => setToast(error));
        }}
        onCancel={() => setReassignTarget(null)}
        confirmDisabled={!reassignEducatorId}
      >
        <div className="ul-ts-form-row">
          <label>New Educator</label>
          <select value={reassignEducatorId} onChange={(e) => setReassignEducatorId(e.target.value)}>
            <option value="">Select an educator…</option>
            {eligibleEducators.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </ConfirmModal>

      {/* ---------- Extend deadline ---------- */}
      <ConfirmModal
        open={!!extendTarget}
        title="Extend deadline"
        description="The educator will be notified of the new deadline in their portal."
        confirmLabel="Save New Deadline"
        onConfirm={() => {
          assignmentsApi.extend(extendTarget, extendDate)
            .then(() => { setToast("Deadline updated."); setExtendTarget(null); assignmentsState.refetch(); })
            .catch((error) => setToast(error));
        }}
        onCancel={() => setExtendTarget(null)}
        confirmDisabled={!extendDate}
      >
        <div className="ul-ts-form-row">
          <label>New Deadline</label>
          <input type="date" value={extendDate} onChange={(e) => setExtendDate(e.target.value)} />
        </div>
      </ConfirmModal>

      {/* ---------- Cancel assignment ---------- */}
      <ConfirmModal
        open={!!cancelTarget}
        title="Cancel this assignment?"
        description="The educator will be notified that the assignment was cancelled. This cannot be undone."
        confirmLabel="Cancel Assignment"
        tone="danger"
        onConfirm={() => {
          assignmentsApi.cancel(cancelTarget, cancelReason)
            .then(() => { setToast("Assignment cancelled."); setCancelTarget(null); assignmentsState.refetch(); })
            .catch((error) => setToast(error));
        }}
        onCancel={() => setCancelTarget(null)}
      >
        <div className="ul-ts-form-row">
          <label>Reason (optional)</label>
          <textarea value={cancelReason} onChange={(e) => setCancelReason(e.target.value)} placeholder="Why is this assignment being cancelled?" />
        </div>
      </ConfirmModal>

      {/* ---------- Review submission modal ---------- */}
      {reviewAssignment && (
        <div className="ul-confirm-backdrop" onClick={() => setReviewTarget(null)}>
          <div className="ul-confirm-modal ul-mgmt-detail-modal ul-asg-review-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-confirm-modal__header">
              <span className="ul-confirm-modal__icon"><IconBell size={16} color="var(--color-primary-dark)" /></span>
              <button type="button" className="ul-confirm-modal__close" onClick={() => setReviewTarget(null)} aria-label="Close"><IconClose size={15} /></button>
            </div>
            <h3 className="ul-confirm-modal__title">{reviewAssignment.testName}</h3>
            <p className="ul-confirm-modal__desc">{reviewAssignment.seriesName} · {reviewAssignment.subject} · by {reviewAssignment.educatorName}</p>

            <div className="ul-mgmt-detail-stats">
              <div><span>{reviewAssignment.questionCount}</span>Questions</div>
              <div><span>{reviewAssignment.totalMarks}</span>Total Marks</div>
              <div><span>{reviewAssignment.duration}m</span>Duration</div>
              <div><span>{QUESTION_TYPE_MIX_LABEL[reviewAssignment.questionTypeMix]}</span>Type</div>
            </div>

            <div className="ul-mgmt-detail-list">
              <div className="ul-mgmt-detail-list__row"><span>Difficulty</span><span>{reviewAssignment.difficulty}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Topics</span><span>{(reviewAssignment.topics || []).join(", ") || "—"}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Submitted</span><span>{fmtDateTime(reviewAssignment.submission?.submittedAt)}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Instructions given</span><span>{reviewAssignment.instructions || "—"}</span></div>
            </div>

            <p className="ul-asg-review-note">
              Preview the full test structure, questions, options/answers and marking scheme from the Test Series module
              (<span className="ul-txn-id-chip">{reviewAssignment.seriesName}</span>) before deciding below.
            </p>

            <span className="ul-mgmt-detail-subhead">Decision</span>
            <div className="ul-ts-pill-toggle ul-asg-decision-pills">
              <button type="button" className={reviewDecision === "approved" ? "is-active" : ""} onClick={() => setReviewDecision("approved")}>Approve</button>
              <button type="button" className={reviewDecision === "revision" ? "is-active" : ""} onClick={() => setReviewDecision("revision")}>Request Revision</button>
              <button type="button" className={reviewDecision === "rejected" ? "is-active" : ""} onClick={() => setReviewDecision("rejected")}>Reject</button>
            </div>

            <div className="ul-ts-form-row">
              <label>Overall Feedback</label>
              <textarea value={reviewFeedback} onChange={(e) => setReviewFeedback(e.target.value)} placeholder="General feedback for the educator" />
            </div>
            <div className="ul-ts-form-row">
              <label>Comment on a specific question (optional)</label>
              <textarea value={reviewQComment} onChange={(e) => setReviewQComment(e.target.value)} placeholder="e.g. Q5's options overlap — please rewrite distractors" />
            </div>
            {reviewDecision !== "approved" && (
              <div className="ul-ts-form-row">
                <label>Reason {reviewDecision === "rejected" ? "for rejection" : "for revision"}</label>
                <textarea value={reviewReason} onChange={(e) => setReviewReason(e.target.value)} placeholder="Required so the educator understands what to fix" />
              </div>
            )}

            <div className="ul-confirm-modal__actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setReviewTarget(null)}>Close</button>
              <button
                type="button"
                className={`ul-btn ${reviewDecision === "rejected" ? "ul-btn--danger" : "ul-btn--primary"}`}
                onClick={submitReview}
                disabled={reviewDecision !== "approved" && !reviewReason.trim()}
              >
                Submit Decision
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- Assignment detail modal ---------- */}
      {detailAssignment && !reviewAssignment && (
        <div className="ul-confirm-backdrop" onClick={() => setDetailId(null)}>
          <div className="ul-confirm-modal ul-mgmt-detail-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-confirm-modal__header">
              <span className="ul-confirm-modal__icon"><IconBell size={16} color="var(--color-primary-dark)" /></span>
              <button type="button" className="ul-confirm-modal__close" onClick={() => setDetailId(null)} aria-label="Close"><IconClose size={15} /></button>
            </div>
            <h3 className="ul-confirm-modal__title">{detailAssignment.testName}</h3>
            <p className="ul-confirm-modal__desc">{detailAssignment.seriesName} · {detailAssignment.subject} · {detailAssignment.educatorName}</p>

            <div className="ul-mgmt-detail-stats">
              <div><span><StatusBadge status={getDisplayStatus(detailAssignment)} /></span>Status</div>
              <div><span>{getAssignmentProgress(detailAssignment)}%</span>Progress</div>
              <div><span>{fmtDate(detailAssignment.assignedDate)}</span>Assigned</div>
              <div><span>{fmtDate(detailAssignment.deadline)}</span>Deadline</div>
            </div>

            <div className="ul-mgmt-detail-list">
              <div className="ul-mgmt-detail-list__row"><span>Number of Tests</span><span>{detailAssignment.testCount || 1}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Class / Grade</span><span>{detailAssignment.grade || "—"}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Exam / Goal</span><span>{detailAssignment.exam || "—"}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Target Audience</span><span>{detailAssignment.audience || "—"}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Question Count</span><span>{detailAssignment.questionCount}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Question Type</span><span>{QUESTION_TYPE_MIX_LABEL[detailAssignment.questionTypeMix]}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Difficulty</span><span>{detailAssignment.difficulty}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Total Marks</span><span>{detailAssignment.totalMarks}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Duration</span><span>{detailAssignment.duration} minutes</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Topics</span><span>{(detailAssignment.topics || []).join(", ") || "—"}</span></div>
              <div className="ul-mgmt-detail-list__row"><span>Instructions</span><span>{detailAssignment.instructions || "—"}</span></div>
            </div>

            {detailAssignment.overallFeedback && (
              <>
                <span className="ul-mgmt-detail-subhead">Review Feedback</span>
                <p className="ul-asg-review-note">{detailAssignment.overallFeedback}</p>
              </>
            )}

            <span className="ul-mgmt-detail-subhead">History</span>
            <div className="ul-mgmt-activity-list">
              {detailState.loading && !detailAssignment.history.length && <p className="ul-mgmt-activity-row__meta">Loading history…</p>}
              {!detailState.loading && !detailAssignment.history.length && <p className="ul-mgmt-activity-row__meta">No history yet.</p>}
              {detailAssignment.history.slice().reverse().map((h, i) => (
                <div key={i} className="ul-mgmt-activity-row">
                  <span className="ul-mgmt-activity-row__dot" />
                  <div className="ul-mgmt-activity-row__body">
                    <p className="ul-mgmt-activity-row__text"><strong>{h.action}</strong>{h.note ? ` — ${h.note}` : ""}</p>
                    <p className="ul-mgmt-activity-row__meta">{fmtDateTime(h.at)} · {h.by}</p>
                  </div>
                </div>
              ))}
            </div>


          </div>
        </div>
      )}
    </>
  );
}
