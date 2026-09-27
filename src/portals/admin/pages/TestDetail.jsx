// Test Series -> Tests -> Questions. Third and final level of the
// strict hierarchy. Manages the Question Builder for one Test: choose
// Objective or Subjective first, then fill in the type-specific form.
//
// Reuses the same shared admin CSS classes as TestSeries.jsx (see that
// file's header comment) plus .ul-ts-*/.ul-tsd-* and .ul-td-* from
// TestDetail.css.

import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  QUESTION_TYPE,
  QUESTION_TYPE_LABEL,
  DIFFICULTY,
  DIFFICULTY_LABEL,
  DIFFICULTY_BADGE_CLASS,
  SERIES_STATUS,
  TEST_STATUS,
  TEST_STATUS_LABEL,
  TEST_STATUS_BADGE_CLASS,
  useTestById,
  createQuestion,
  updateQuestion,
  deleteQuestion,
  setTestStatus,
  setSeriesStatus,
  validateTestForPublish,
  validateSeriesForPublish,
} from "../data/testSeriesMock";
import { IconClose, IconPlus, IconEdit, IconChevronLeft, IconEye } from "../components/icons";
import ConfirmModal from "../components/ConfirmModal";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./SettingsPermissions.css";
import "./UserManagement.css";
import "./TestSeries.css";
import "./TestSeriesDetail.css";
import "./TestDetail.css";

const EMPTY_OBJECTIVE = {
  text: "", optionA: "", optionB: "", optionC: "", optionD: "", correctAnswer: "A",
  marks: 4, negativeMarks: 1, difficulty: DIFFICULTY.MEDIUM, subject: "", explanation: "",
};
const EMPTY_SUBJECTIVE = {
  text: "", answerInstructions: "", marks: 5, difficulty: DIFFICULTY.MEDIUM, subject: "", rubric: "",
};

export default function TestDetail({ seriesId: seriesIdProp, testId: testIdProp, onBack, onSeriesPublished } = {}) {
  const routeParams = useParams();
  const seriesId = seriesIdProp ?? routeParams.seriesId;
  const testId = testIdProp ?? routeParams.testId;
  const navigate = useNavigate();
  const { series, test } = useTestById(seriesId, testId);
  const goBack = () => (onBack ? onBack() : navigate(seriesId ? `/admin/testseries/${seriesId}` : "/admin/testseries"));
  // "Publish Test Series" goes further back than the plain Back button —
  // it drops out of this series entirely onto the top-level Test Series
  // Structure page (the series list), not just one level up onto this
  // series' Tests list. When embedded inside TestSeries.jsx, the parent
  // supplies onSeriesPublished to switch its own tab state directly;
  // as a standalone route there's no "series list" tab to switch, so we
  // land on /admin/testseries, which renders that same list.
  const goToSeriesStructure = () => (onSeriesPublished ? onSeriesPublished() : navigate("/admin/testseries"));

  const [toast, setToast] = useState("");
  const toastTimer = useRef(null);
  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderStep, setBuilderStep] = useState("type"); // "type" | "form"
  const [questionType, setQuestionType] = useState(null);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [form, setForm] = useState(EMPTY_OBJECTIVE);
  const [formErrors, setFormErrors] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const readiness = useMemo(() => (test ? validateTestForPublish(test) : { valid: false, errors: [] }), [test]);
  const seriesReadiness = useMemo(() => (series ? validateSeriesForPublish(series) : { valid: false, errors: [] }), [series]);
  const marksUsed = useMemo(() => (test ? test.questions.reduce((sum, q) => sum + Number(q.marks || 0), 0) : 0), [test]);

  if (!series || !test) {
    return (
      <div className="ul-ts-page">
        <button type="button" className="ul-tsd-back" onClick={goBack}><IconChevronLeft size={12} /> Back</button>
        <div className="ul-set-empty">This Test could not be found.</div>
      </div>
    );
  }

  const openAddQuestion = () => {
    setQuestionType(null);
    setEditingQuestionId(null);
    setFormErrors([]);
    setBuilderStep("type");
    setBuilderOpen(true);
  };

  const openEditQuestion = (q) => {
    setQuestionType(q.type);
    setEditingQuestionId(q.id);
    setFormErrors([]);
    setForm(q.type === QUESTION_TYPE.OBJECTIVE
      ? { text: q.text, optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD, correctAnswer: q.correctAnswer, marks: q.marks, negativeMarks: q.negativeMarks, difficulty: q.difficulty, subject: q.subject, explanation: q.explanation || "" }
      : { text: q.text, answerInstructions: q.answerInstructions, marks: q.marks, difficulty: q.difficulty, subject: q.subject, rubric: q.rubric || "" });
    setBuilderStep("form");
    setBuilderOpen(true);
  };

  const chooseType = (type) => {
    setQuestionType(type);
    setForm(type === QUESTION_TYPE.OBJECTIVE ? EMPTY_OBJECTIVE : EMPTY_SUBJECTIVE);
    setBuilderStep("form");
  };

  const closeBuilder = () => {
    setBuilderOpen(false);
    setFormErrors([]);
  };

  const validateQuestionForm = () => {
    const errors = [];
    if (!form.text || !form.text.trim()) errors.push("Question text is required.");
    if (!form.marks || Number(form.marks) <= 0) errors.push("Marks must be greater than 0.");
    if (questionType === QUESTION_TYPE.OBJECTIVE) {
      if (!form.optionA.trim() || !form.optionB.trim() || !form.optionC.trim() || !form.optionD.trim()) errors.push("All four options (A–D) are required.");
      if (!form.correctAnswer) errors.push("Select the correct answer.");
      if (form.negativeMarks && Number(form.negativeMarks) < 0) errors.push("Negative marking cannot be a negative value.");
    } else if (!form.answerInstructions || !form.answerInstructions.trim()) {
      errors.push("Answer instructions are required for a subjective question.");
    }
    return errors;
  };

  const saveQuestion = () => {
    const errors = validateQuestionForm();
    if (errors.length > 0) {
      setFormErrors(errors);
      return;
    }
    const payload = questionType === QUESTION_TYPE.OBJECTIVE
      ? { ...form, marks: Number(form.marks), negativeMarks: Number(form.negativeMarks) || 0 }
      : { ...form, marks: Number(form.marks) };

    if (editingQuestionId) {
      updateQuestion(series.id, test.id, editingQuestionId, payload);
      setToast("Question updated.");
    } else {
      createQuestion(series.id, test.id, questionType, payload);
      setToast("Question added.");
    }
    closeBuilder();
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteQuestion(series.id, test.id, deleteTarget.id);
    setToast("Question deleted.");
    setDeleteTarget(null);
  };

  const togglePublish = () => {
    const next = test.status === TEST_STATUS.PUBLISHED ? TEST_STATUS.DRAFT : TEST_STATUS.PUBLISHED;
    if (next === TEST_STATUS.PUBLISHED && !readiness.valid) {
      setToast(readiness.errors[0]);
      return;
    }
    setTestStatus(series.id, test.id, next);
    setToast(`"${test.name}" ${next === TEST_STATUS.PUBLISHED ? "published" : "unpublished"}.`);
  };

  const handlePublishSeries = () => {
    if (!seriesReadiness.valid) {
      setToast(seriesReadiness.errors[0]);
      return;
    }
    setSeriesStatus(series.id, SERIES_STATUS.PUBLISHED);
    setToast(`"${series.name}" published. The entire Test Series is now live for students.`);
    // Jump straight to the Test Series Structure page (the series list)
    // instead of leaving the admin sitting on a single Test's question
    // list — publishing the whole series is the "I'm done here" action.
    goToSeriesStructure();
  };

  return (
    <div className="ul-ts-page">
      <button type="button" className="ul-tsd-back" onClick={goBack}><IconChevronLeft size={12} /> Back to {series.name}</button>

      <div className="ul-dash-welcome ul-ts-header-row">
        <div>
          <h2 className="ul-dash-welcome__title">{test.name}</h2>
          <p className="ul-dash-welcome__subtitle">
            {test.duration} min · {test.totalMarks} marks · Passing: {test.passingMarks} ·{" "}
            <span className={`ul-status-badge ${TEST_STATUS_BADGE_CLASS[test.status]}`}>{TEST_STATUS_LABEL[test.status]}</span>
          </p>
        </div>
      </div>

      <div className="ul-ts-create-row">
        <span className="ul-card__eyebrow">Overview</span>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setPreviewOpen(true)}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconEye size={13} /> Preview Test</span>
          </button>
          <button type="button" className="ul-btn ul-btn--ghost" onClick={togglePublish}>{test.status === TEST_STATUS.PUBLISHED ? "Unpublish" : "Publish"}</button>
          <button type="button" className="ul-btn ul-btn--primary" onClick={openAddQuestion}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconPlus size={14} /> Add Question</span>
          </button>
          {test.questions.length > 0 && series.status !== SERIES_STATUS.PUBLISHED && (
            <button type="button" className="ul-btn ul-btn--primary" onClick={handlePublishSeries}>Publish Test Series</button>
          )}
        </div>
      </div>

      <div className="ul-stats ul-ts-stats">
        <div className="ul-stat-card"><span className="ul-stat-card__label">QUESTIONS</span><span className="ul-stat-card__value">{test.questions.length}</span><span className="ul-stat-card__trend">In this Test</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">MARKS ALLOCATED</span><span className="ul-stat-card__value">{marksUsed} / {test.totalMarks}</span><span className="ul-stat-card__trend">{marksUsed === test.totalMarks ? "Fully allocated" : "Check totals before publishing"}</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">SCHEDULED</span><span className="ul-stat-card__value" style={{ fontSize: 13 }}>{test.scheduledAt ? new Date(test.scheduledAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" }) : "—"}</span><span className="ul-stat-card__trend">{test.scheduledAt ? new Date(test.scheduledAt).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "Not scheduled"}</span></div>
        <div className="ul-stat-card"><span className="ul-stat-card__label">ATTEMPT LIMIT</span><span className="ul-stat-card__value">{test.attemptLimit}</span><span className="ul-stat-card__trend">Attempts per student</span></div>
      </div>

      {!readiness.valid && (
        <div className="ul-ts-errors" style={{ marginBottom: 14 }}>
          <strong>Not ready to publish yet:</strong>
          <ul>{readiness.errors.map((err, i) => <li key={i}>{err}</li>)}</ul>
        </div>
      )}

      <div className="ul-card ul-set-table-card">
        {test.questions.length === 0 ? (
          <div className="ul-set-empty">No Questions yet. Click "Add Question" to build this Test.</div>
        ) : (
          <div className="ul-set-table-scroll">
            <table className="ul-set-table ul-td-table" style={{ minWidth: 780 }}>
              <colgroup>
                <col style={{ width: "8%" }} />
                <col style={{ width: "34%" }} />
                <col style={{ width: "12%" }} />
                <col style={{ width: "14%" }} />
                <col style={{ width: "10%" }} />
                <col style={{ width: "22%" }} />
              </colgroup>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Question</th>
                  <th>Type</th>
                  <th>Subject / Topic</th>
                  <th>Marks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {test.questions.map((q, i) => (
                  <tr key={q.id}>
                    <td data-label="#">{i + 1}</td>
                    <td className="ul-td-question-cell" data-label="Question">{q.text}</td>
                    <td data-label="Type">
                      <span className="ul-td-type-tag">{QUESTION_TYPE_LABEL[q.type]}</span>
                      <br />
                      <span className={`ul-status-badge ${DIFFICULTY_BADGE_CLASS[q.difficulty]}`}>{DIFFICULTY_LABEL[q.difficulty]}</span>
                    </td>
                    <td data-label="Subject / Topic">{q.subject || "—"}</td>
                    <td data-label="Marks">{q.marks}</td>
                    <td data-label="Actions">
                      <div className="ul-ts-actions-cell">
                        <button type="button" className="ul-btn ul-btn--ghost ul-set-btn-sm" onClick={() => openEditQuestion(q)}><IconEdit size={12} /> Edit</button>
                        <button type="button" className="ul-btn ul-btn--danger ul-set-btn-sm" onClick={() => setDeleteTarget(q)}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ---------- Add / Edit Question drawer ---------- */}
      {builderOpen && (
        <div className="ul-set-drawer-backdrop" onClick={closeBuilder}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">{editingQuestionId ? "Edit Question" : "Add Question"}</h3>
                <p className="ul-set-drawer__sub">{builderStep === "type" ? "Choose the question type to continue." : QUESTION_TYPE_LABEL[questionType]}</p>
              </div>
              <button type="button" className="ul-set-drawer__close" onClick={closeBuilder} aria-label="Close"><IconClose size={15} /></button>
            </div>
            <div className="ul-set-drawer__body">
              {builderStep === "type" ? (
                <div className="ul-td-type-choice">
                  <button type="button" className="ul-td-type-card" onClick={() => chooseType(QUESTION_TYPE.OBJECTIVE)}>
                    <strong>Objective</strong>
                    <span>Multiple-choice question with 4 options and one correct answer.</span>
                  </button>
                  <button type="button" className="ul-td-type-card" onClick={() => chooseType(QUESTION_TYPE.SUBJECTIVE)}>
                    <strong>Subjective</strong>
                    <span>Free-text answer, manually evaluated against a rubric.</span>
                  </button>
                </div>
              ) : (
                <div className="ul-ts-form">
                  {formErrors.length > 0 && (
                    <div className="ul-ts-errors">
                      <strong>Fix the following:</strong>
                      <ul>{formErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                    </div>
                  )}

                  <div className="ul-ts-form-row">
                    <label>Question</label>
                    <textarea value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Type the question here…" />
                  </div>

                  {questionType === QUESTION_TYPE.OBJECTIVE ? (
                    <>
                      <div className="ul-ts-form-grid-2">
                        <div className="ul-ts-form-row">
                          <label>Option A</label>
                          <input type="text" value={form.optionA} onChange={(e) => setForm({ ...form, optionA: e.target.value })} />
                        </div>
                        <div className="ul-ts-form-row">
                          <label>Option B</label>
                          <input type="text" value={form.optionB} onChange={(e) => setForm({ ...form, optionB: e.target.value })} />
                        </div>
                      </div>
                      <div className="ul-ts-form-grid-2">
                        <div className="ul-ts-form-row">
                          <label>Option C</label>
                          <input type="text" value={form.optionC} onChange={(e) => setForm({ ...form, optionC: e.target.value })} />
                        </div>
                        <div className="ul-ts-form-row">
                          <label>Option D</label>
                          <input type="text" value={form.optionD} onChange={(e) => setForm({ ...form, optionD: e.target.value })} />
                        </div>
                      </div>
                      <div className="ul-ts-form-row">
                        <label>Correct Answer</label>
                        <div className="ul-td-correct-toggle">
                          {["A", "B", "C", "D"].map((letter) => (
                            <button key={letter} type="button" className={form.correctAnswer === letter ? "is-active" : ""} onClick={() => setForm({ ...form, correctAnswer: letter })}>{letter}</button>
                          ))}
                        </div>
                      </div>
                      <div className="ul-ts-form-grid-2">
                        <div className="ul-ts-form-row">
                          <label>Marks</label>
                          <input type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
                        </div>
                        <div className="ul-ts-form-row">
                          <label>Negative Marking</label>
                          <input type="number" min="0" step="0.25" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: e.target.value })} />
                        </div>
                      </div>
                      <div className="ul-ts-form-grid-2">
                        <div className="ul-ts-form-row">
                          <label>Difficulty</label>
                          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                            {Object.values(DIFFICULTY).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
                          </select>
                        </div>
                        <div className="ul-ts-form-row">
                          <label>Subject / Topic</label>
                          <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mechanics" />
                        </div>
                      </div>
                      <div className="ul-ts-form-row">
                        <label>Explanation (shown after the attempt)</label>
                        <textarea value={form.explanation} onChange={(e) => setForm({ ...form, explanation: e.target.value })} placeholder="Optional explanation for the correct answer" />
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="ul-ts-form-row">
                        <label>Answer / Instructions</label>
                        <textarea value={form.answerInstructions} onChange={(e) => setForm({ ...form, answerInstructions: e.target.value })} placeholder="Model answer or instructions for the student" />
                      </div>
                      <div className="ul-ts-form-grid-2">
                        <div className="ul-ts-form-row">
                          <label>Marks</label>
                          <input type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
                        </div>
                        <div className="ul-ts-form-row">
                          <label>Difficulty</label>
                          <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })}>
                            {Object.values(DIFFICULTY).map((d) => <option key={d} value={d}>{DIFFICULTY_LABEL[d]}</option>)}
                          </select>
                        </div>
                      </div>
                      <div className="ul-ts-form-row">
                        <label>Subject / Topic</label>
                        <input type="text" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="e.g. Mechanics" />
                      </div>
                      <div className="ul-ts-form-row">
                        <label>Evaluation Criteria / Rubric</label>
                        <textarea value={form.rubric} onChange={(e) => setForm({ ...form, rubric: e.target.value })} placeholder="How should this answer be graded?" />
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            {builderStep === "form" && (
              <div className="ul-set-drawer__actions ul-ts-drawer-actions">
                {!editingQuestionId && (
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setBuilderStep("type")}>Back</button>
                )}
                <button type="button" className="ul-btn ul-btn--primary" onClick={saveQuestion}>{editingQuestionId ? "Save Changes" : "Add Question"}</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------- Test Preview ---------- */}
      {previewOpen && (
        <div className="ul-set-drawer-backdrop" onClick={() => setPreviewOpen(false)}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">Preview — {test.name}</h3>
                <p className="ul-set-drawer__sub">This is how the Test will appear to students.</p>
              </div>
              <button type="button" className="ul-set-drawer__close" onClick={() => setPreviewOpen(false)} aria-label="Close"><IconClose size={15} /></button>
            </div>
            <div className="ul-set-drawer__body">
              {test.questions.length === 0 ? (
                <div className="ul-set-empty">No Questions to preview yet.</div>
              ) : (
                <div className="ul-td-preview-list">
                  {test.questions.map((q, i) => (
                    <div className="ul-td-preview-item" key={q.id}>
                      <strong>Q{i + 1}. {q.text}</strong>
                      {q.type === QUESTION_TYPE.OBJECTIVE ? (
                        <ul className="ul-td-preview-options">
                          <li className={q.correctAnswer === "A" ? "is-correct" : ""}>A. {q.optionA}</li>
                          <li className={q.correctAnswer === "B" ? "is-correct" : ""}>B. {q.optionB}</li>
                          <li className={q.correctAnswer === "C" ? "is-correct" : ""}>C. {q.optionC}</li>
                          <li className={q.correctAnswer === "D" ? "is-correct" : ""}>D. {q.optionD}</li>
                        </ul>
                      ) : (
                        <p className="ul-td-preview-answer-box">Answer box shown to the student.</p>
                      )}
                      <span className="ul-td-preview-marks">{q.marks} marks{q.type === QUESTION_TYPE.OBJECTIVE && q.negativeMarks ? ` · −${q.negativeMarks} negative` : ""}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        open={!!deleteTarget}
        title="Delete this Question?"
        description={deleteTarget ? "This Question will be permanently removed from the Test. This cannot be undone." : ""}
        confirmLabel="Delete Question"
        tone="danger"
        onConfirm={confirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {toast && <div className="ul-set-toast">{toast}</div>}
    </div>
  );
}
