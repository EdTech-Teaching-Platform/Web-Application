// Test Series -> Tests. Second level of the strict Test Series -> Tests
// -> Questions structure. Shows every Test that belongs to one Test
// Series and lets Admin create, edit, delete, and publish/unpublish
// Tests, plus jump into Question management for a specific Test
// (TestDetail.jsx — the third level).
//
// Reuses the same shared admin CSS classes as TestSeries.jsx (see that
// file's header comment) plus .ul-ts-* from TestSeries.css and
// .ul-tsd-* from TestSeriesDetail.css.

import { useMemo, useRef, useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  SERIES_STATUS_LABEL,
  SERIES_STATUS_BADGE_CLASS,
  TEST_STATUS,
  TEST_STATUS_LABEL,
  TEST_STATUS_BADGE_CLASS,
  useTestSeriesById,
  createTest,
  updateTest,
  deleteTest,
  duplicateTest,
  setTestStatus,
  validateTestForPublish,
} from "../data/testSeriesMock";
import {
  IconClose, IconPlus, IconEdit, IconChevronLeft, IconMore, IconCheck,
  IconEyeOff, IconEye, IconReport,
} from "../components/icons";
import ConfirmModal from "../components/ConfirmModal";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./SettingsPermissions.css";
import "./UserManagement.css";
import "./TestSeries.css";
import "./TestSeriesDetail.css";

const EMPTY_TEST_FORM = {
  name: "",
  instructions: "",
  duration: "",
  totalMarks: "",
  passingMarks: "",
  attemptLimit: "",
  scheduledAt: "",
};

export default function TestSeriesDetail({ seriesId: seriesIdProp, onBack, onManageQuestions } = {}) {
  const routeParams = useParams();
  const seriesId = seriesIdProp ?? routeParams.seriesId;
  const navigate = useNavigate();
  const goBack = () => (onBack ? onBack() : navigate("/admin/testseries"));
  const series = useTestSeriesById(seriesId);

  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  const [formOpen, setFormOpen] = useState(null); // null | "create" | "edit"
  const [form, setForm] = useState(EMPTY_TEST_FORM);
  const [editingId, setEditingId] = useState(null);
  const [formErrors, setFormErrors] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [viewTarget, setViewTarget] = useState(null);
  const [openMenuId, setOpenMenuId] = useState(null);

  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  useEffect(() => {
    if (!openMenuId) return undefined;
    const close = () => setOpenMenuId(null);
    window.addEventListener("click", close);
    return () => window.removeEventListener("click", close);
  }, [openMenuId]);

  const totals = useMemo(() => {
    if (!series) return null;
    return {
      testCount: series.tests.length,
      questionCount: series.tests.reduce((sum, t) => sum + t.questions.length, 0),
    };
  }, [series]);

  if (!series) {
    return (
      <div className="ul-ts-page">
        <button type="button" className="ul-tsd-back" onClick={goBack}><IconChevronLeft size={12} /> Back to Test Series</button>
        <div className="ul-set-empty">This Test Series could not be found.</div>
      </div>
    );
  }

  const openCreateTest = () => {
    setForm(EMPTY_TEST_FORM);
    setEditingId(null);
    setFormErrors([]);
    setFormOpen("create");
  };

  const openEditTest = (t) => {
    setForm({
      name: t.name, instructions: t.instructions, duration: String(t.duration || ""),
      totalMarks: String(t.totalMarks || ""), passingMarks: String(t.passingMarks || ""),
      attemptLimit: String(t.attemptLimit || ""), scheduledAt: t.scheduledAt || "",
    });
    setEditingId(t.id);
    setFormErrors([]);
    setFormOpen("edit");
  };

  const closeForm = () => {
    setFormOpen(null);
    setFormErrors([]);
  };

  const buildPayload = () => ({
    name: form.name.trim(),
    instructions: form.instructions.trim(),
    duration: Number(form.duration) || 0,
    totalMarks: Number(form.totalMarks) || 0,
    passingMarks: Number(form.passingMarks) || 0,
    attemptLimit: Number(form.attemptLimit) || 1,
    scheduledAt: form.scheduledAt,
  });

  const saveAsDraft = () => {
    const payload = { ...buildPayload(), status: TEST_STATUS.DRAFT };
    if (formOpen === "edit") {
      updateTest(series.id, editingId, payload);
      setToast(`"${payload.name || "Test"}" saved as draft.`);
    } else {
      const existing = series.tests.find((t) => t.id === editingId);
      createTest(series.id, { ...payload, questions: existing ? existing.questions : [] });
      setToast(`"${payload.name || "Test"}" created as draft.`);
    }
    closeForm();
  };

  const saveAndManageQuestions = () => {
    const payload = { ...buildPayload(), status: TEST_STATUS.DRAFT, questions: [] };
    const created = createTest(series.id, payload);
    setToast(`"${payload.name || "Test"}" created as draft. Now add Questions.`);
    closeForm();
    if (onManageQuestions) onManageQuestions(created.id);
    else navigate(`/admin/testseries/${series.id}/tests/${created.id}`);
  };

  const saveAndPublish = () => {
    const existing = formOpen === "edit" ? series.tests.find((t) => t.id === editingId) : null;
    const payload = { ...buildPayload(), status: TEST_STATUS.PUBLISHED, questions: existing ? existing.questions : [] };
    const { valid, errors } = validateTestForPublish(payload);
    if (!valid) {
      setFormErrors(errors);
      return;
    }
    if (formOpen === "edit") {
      updateTest(series.id, editingId, payload);
      setToast(`"${payload.name}" updated and published.`);
    } else {
      createTest(series.id, payload);
      setToast(`"${payload.name}" created and published.`);
    }
    closeForm();
  };

  const handlePublish = (t) => {
    if (t.status === TEST_STATUS.PUBLISHED) return;
    const { valid, errors } = validateTestForPublish(t);
    if (!valid) {
      setToast(errors[0]);
      return;
    }
    setTestStatus(series.id, t.id, TEST_STATUS.PUBLISHED);
    setToast(`"${t.name}" published.`);
  };

  const handleUnpublish = (t) => {
    if (t.status !== TEST_STATUS.PUBLISHED) return;
    setTestStatus(series.id, t.id, TEST_STATUS.DRAFT);
    setToast(`"${t.name}" unpublished.`);
  };

  const handleDuplicateTest = (t) => {
    duplicateTest(series.id, t.id);
    setToast(`"${t.name}" duplicated.`);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteTest(series.id, deleteTarget.id);
    setToast(`"${deleteTarget.name}" deleted.`);
    setDeleteTarget(null);
  };


  return (
    <div className="ul-ts-page">
      <button type="button" className="ul-tsd-back" onClick={goBack}><IconChevronLeft size={12} /> Back to Test Series</button>

      <div className="ul-dash-welcome ul-ts-header-row">
        <div>
          <h2 className="ul-dash-welcome__title">{series.name}</h2>
          <p className="ul-dash-welcome__subtitle">{series.subject} · {series.audience} · <span className={`ul-status-badge ${SERIES_STATUS_BADGE_CLASS[series.status]}`}>{SERIES_STATUS_LABEL[series.status]}</span></p>
        </div>
      </div>

      <div className="ul-ts-create-row">
        <span className="ul-card__eyebrow">Overview</span>
        <button type="button" className="ul-btn ul-btn--primary" onClick={openCreateTest}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <IconPlus size={14} /> Create Test
          </span>
        </button>
      </div>

      <div className="ul-stats ul-ts-stats">
        <div className="ul-stat-card"><span className="ul-stat-card__label">TOTAL TESTS</span><span className="ul-stat-card__value">{totals.testCount}</span><span className="ul-stat-card__trend">In this Test Series</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">TOTAL QUESTIONS</span><span className="ul-stat-card__value">{totals.questionCount}</span><span className="ul-stat-card__trend">Across all Tests</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">ENROLLMENT</span><span className="ul-stat-card__value">{series.enrollment.toLocaleString("en-IN")}</span><span className="ul-stat-card__trend">Students enrolled</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">AVG. PERFORMANCE</span><span className="ul-stat-card__value">{series.avgPerformance}%</span><span className="ul-stat-card__trend">Across all attempts</span></div>
      </div>

      <div className="ul-card ul-set-table-card">
        {series.tests.length === 0 ? (
          <div className="ul-set-empty">No Tests in this Test Series yet. Create one to get started.</div>
        ) : (
          <div className="ul-set-table-scroll">
            <table className="ul-set-table ul-tsd-table" style={{ minWidth: 860 }}>
              <colgroup>
                <col style={{ width: "22%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "9%" }} />
                <col style={{ width: "28%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>Test</th>
                  <th>Questions</th>
                  <th>Duration</th>
                  <th>Marks</th>
                  <th>Scheduled</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {series.tests.map((t) => (
                  <tr key={t.id}>
                    <td data-label="Test"><strong>{t.name}</strong></td>
                    <td data-label="Questions">{t.questions.length}</td>
                    <td data-label="Duration">{t.duration} min</td>
                    <td data-label="Marks">{t.passingMarks} / {t.totalMarks}</td>
                    <td className="ul-ts-dates-cell" data-label="Scheduled">{t.scheduledAt ? new Date(t.scheduledAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</td>
                    <td data-label="Status"><span className={`ul-status-badge ${TEST_STATUS_BADGE_CLASS[t.status]}`}>{TEST_STATUS_LABEL[t.status]}</span></td>
                    <td data-label="Actions">
                      <div className="ul-ts-actions-cell">
                        <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm ul-ts-manage-btn" onClick={() => (onManageQuestions ? onManageQuestions(t.id) : navigate(`/admin/testseries/${series.id}/tests/${t.id}`))}>Manage Questions</button>
                        <button type="button" className="ul-ts-icon-btn" onClick={() => openEditTest(t)} aria-label="Edit"><IconEdit size={14} /></button>
                        <div className="ul-ts-kebab-wrap">
                          <button type="button" className="ul-ts-icon-btn" onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === t.id ? null : t.id); }} aria-label="More actions"><IconMore size={14} /></button>
                          {openMenuId === t.id && (
                            <div className="ul-ts-kebab-menu" onClick={(e) => e.stopPropagation()}>
                              <button type="button" className="is-publish" onClick={() => { handlePublish(t); setOpenMenuId(null); }}><IconCheck size={13} /> Publish</button>
                              <button type="button" className="is-unpublish" onClick={() => { handleUnpublish(t); setOpenMenuId(null); }}><IconEyeOff size={13} /> Unpublish</button>
                              <button type="button" onClick={() => { handleDuplicateTest(t); setOpenMenuId(null); }}><IconReport size={13} /> Duplicate</button>
                              <button type="button" onClick={() => { setViewTarget(t); setOpenMenuId(null); }}><IconEye size={13} /> View Details</button>
                              <button type="button" className="is-danger" onClick={() => { setDeleteTarget(t); setOpenMenuId(null); }}><IconClose size={13} /> Delete</button>
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Create / Edit Test drawer ---------- */}
      {formOpen && (
        <div className="ul-set-drawer-backdrop" onClick={closeForm}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">{formOpen === "edit" ? "Edit Test" : "Create Test"}</h3>
                <p className="ul-set-drawer__sub">{formOpen === "create" ? "Fill in the test details, then add Questions next." : "Fill in the test details. You can save as a draft and publish later."}</p>
              </div>
            </div>
            <div className="ul-set-drawer__body">
              <div className="ul-ts-form">
                {formErrors.length > 0 && (
                  <div className="ul-ts-errors">
                    <strong>Fix the following before publishing:</strong>
                    <ul>{formErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                  </div>
                )}

                <div className="ul-ts-form-row">
                  <label>Test Name</label>
                  <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Physics Full Mock Test 1" />
                </div>

                <div className="ul-ts-form-row">
                  <label>Instructions</label>
                  <textarea value={form.instructions} onChange={(e) => setForm({ ...form, instructions: e.target.value })} placeholder="Instructions shown to students before starting this test" />
                </div>

                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Duration (minutes)</label>
                    <input type="number" min="1" value={form.duration} onChange={(e) => setForm({ ...form, duration: e.target.value })} placeholder="e.g. 60" />
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Attempt Limit</label>
                    <input type="number" min="1" value={form.attemptLimit} onChange={(e) => setForm({ ...form, attemptLimit: e.target.value })} placeholder="e.g. 2" />
                  </div>
                </div>

                <div className="ul-ts-form-grid-2">
                  <div className="ul-ts-form-row">
                    <label>Total Marks</label>
                    <input type="number" min="1" value={form.totalMarks} onChange={(e) => setForm({ ...form, totalMarks: e.target.value })} placeholder="e.g. 40" />
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Passing Marks</label>
                    <input type="number" min="1" value={form.passingMarks} onChange={(e) => setForm({ ...form, passingMarks: e.target.value })} placeholder="e.g. 16" />
                  </div>
                </div>

                <div className="ul-ts-form-row">
                  <label>Scheduled Date &amp; Time</label>
                  <input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="ul-set-drawer__actions ul-ts-drawer-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={closeForm}>Cancel</button>
              {formOpen === "create" ? (
                <button type="button" className="ul-btn ul-btn--primary" onClick={saveAndManageQuestions}>Next</button>
              ) : (
                <>
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={saveAsDraft}>Save as Draft</button>
                  <button type="button" className="ul-btn ul-btn--primary" onClick={saveAndPublish}>Publish</button>
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------- View Details drawer ---------- */}
      {viewTarget && (
        <div className="ul-set-drawer-backdrop" onClick={() => setViewTarget(null)}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">{viewTarget.name}</h3>
                <p className="ul-set-drawer__sub">{viewTarget.instructions || "No instructions provided."}</p>
              </div>
              <button type="button" className="ul-set-drawer__close" onClick={() => setViewTarget(null)} aria-label="Close"><IconClose size={15} /></button>
            </div>
            <div className="ul-set-drawer__body">
              <div className="ul-set-kv">
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Status</p><p className="ul-set-kv__value"><span className={`ul-status-badge ${TEST_STATUS_BADGE_CLASS[viewTarget.status]}`}>{TEST_STATUS_LABEL[viewTarget.status]}</span></p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Questions</p><p className="ul-set-kv__value">{viewTarget.questions.length}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Duration</p><p className="ul-set-kv__value">{viewTarget.duration} min</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Total Marks</p><p className="ul-set-kv__value">{viewTarget.totalMarks}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Passing Marks</p><p className="ul-set-kv__value">{viewTarget.passingMarks}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Attempt Limit</p><p className="ul-set-kv__value">{viewTarget.attemptLimit}</p></div>
                <div className="ul-set-kv__item"><p className="ul-set-kv__label">Scheduled</p><p className="ul-set-kv__value">{viewTarget.scheduledAt ? new Date(viewTarget.scheduledAt).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—"}</p></div>
              </div>
            </div>
            <div className="ul-set-drawer__actions ul-ts-drawer-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setViewTarget(null)}><IconChevronLeft size={12} /> Back</button>
              <button type="button" className="ul-btn ul-btn--primary" onClick={() => { const target = viewTarget; setViewTarget(null); openEditTest(target); }}>Edit</button>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this Test?"
        description={deleteTarget ? `"${deleteTarget.name}" and all of its Questions will be permanently deleted. This cannot be undone.` : ""}
        confirmLabel="Delete Test"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}
