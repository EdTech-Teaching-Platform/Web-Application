// Test Series -> Tests -> Questions. Third and final level of the
// strict hierarchy. Manages the Question Builder for one Test: choose the
// question type first (MCQ single / multiple, true / false, fill in the
// blank; short / long / subjective are "Coming soon"), then fill in the
// type-specific form. Existing subjective questions are read-only.
//
// Reuses the same shared admin CSS classes as TestSeries.jsx (see that
// file's header comment) plus .ul-ts-*/.ul-tsd-* and .ul-td-* from
// TestDetail.css.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
// Constants and pure readiness checks only; data loads and saves through
// testSeriesApi (question / option / test-status / publish RPCs).
import {
  DIFFICULTY,
  DIFFICULTY_LABEL,
  DIFFICULTY_BADGE_CLASS,
  SERIES_STATUS,
  TEST_STATUS,
  TEST_STATUS_LABEL,
  TEST_STATUS_BADGE_CLASS,
  validateTestForPublish,
  validateSeriesForPublish,
} from "../data/testSeriesMock";
import { testSeriesApi } from "../services/testSeriesApi";
import {
  QTYPE, SUBJECTIVE_BLOCKED_MESSAGE, TRUE_FALSE_OPTIONS, blankQuestionFields, isBlockedQuestionType, isChoiceType,
  questionPayload, questionTypeLabel, validateQuestionDraft,
} from "../data/questionTypes";
import QuestionTypePicker, { QuestionAnswerFields } from "../components/QuestionTypePicker";
import ComingSoonBadge from "../components/ComingSoonBadge";
import { IconClose, IconPlus, IconEdit, IconChevronLeft, IconEye } from "../components/icons";
import ConfirmModal from "../components/ConfirmModal";
import SeriesReviewBanner from "../components/SeriesReviewBanner";
import { isLockedForReview, needsApproval, publishActionLabel, seriesPath, useAuthoringPortal } from "../context/authoringPortal";
import QuestionImageField from "../components/QuestionImageField";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./SettingsPermissions.css";
import "./UserManagement.css";
import "./TestSeries.css";
import "./TestSeriesDetail.css";
import "./TestDetail.css";

function emptyQuestionForm(type = QTYPE.MCQ_SINGLE) {
  return {
    text: "", image: "", ...blankQuestionFields(type),
    marks: 4, negativeMarks: type === QTYPE.MCQ_SINGLE || type === QTYPE.MCQ_MULTI ? 1 : 0,
    difficulty: DIFFICULTY.MEDIUM, subject: "", explanation: "",
  };
}

export default function TestDetail({ seriesId: seriesIdProp, testId: testIdProp, onBack, onSeriesPublished } = {}) {
  const routeParams = useParams();
  const seriesId = seriesIdProp ?? routeParams.seriesId;
  const testId = testIdProp ?? routeParams.testId;
  const navigate = useNavigate();
  const portal = useAuthoringPortal();
  const [toast, setToast] = useState("");
  const [series, setSeries] = useState(null);
  const [test, setTest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const load = useCallback(async () => {
    const data = await testSeriesApi.get(seriesId);
    setSeries(data);
    setTest(data?.tests.find((t) => String(t.id) === String(testId)) || null);
  }, [seriesId, testId]);
  useEffect(() => {
    let active = true;
    load().catch((error) => active && setToast(error.message)).finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [load]);
  // Runs one RPC, reloads the series, shows a toast; errors come back as toasts.
  const run = async (request, message) => {
    if (saving) return false;
    setSaving(true);
    try {
      await request();
      await load();
      if (message) setToast(message);
      return true;
    } catch (error) {
      setToast(error.message);
      return false;
    } finally {
      setSaving(false);
    }
  };
  const goBack = () => (onBack ? onBack() : navigate(seriesId ? seriesPath(portal, seriesId) : portal.basePath));
  // "Publish Test Series" goes further back than the plain Back button —
  // it drops out of this series entirely onto the top-level Test Series
  // Structure page (the series list), not just one level up onto this
  // series' Tests list. When embedded inside TestSeries.jsx, the parent
  // supplies onSeriesPublished to switch its own tab state directly;
  // as a standalone route there's no "series list" tab to switch, so we
  // land on /admin/testseries, which renders that same list.
  const goToSeriesStructure = () => (onSeriesPublished ? onSeriesPublished() : navigate(portal.basePath));

  const toastTimer = useRef(null);
  useEffect(() => {
    if (!toast) return undefined;
    toastTimer.current = setTimeout(() => setToast(""), 2600);
    return () => clearTimeout(toastTimer.current);
  }, [toast]);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [builderStep, setBuilderStep] = useState("type"); // "type" | "form" | "locked"
  const [questionType, setQuestionType] = useState(null);
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [form, setForm] = useState(() => emptyQuestionForm());
  const [formErrors, setFormErrors] = useState([]);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // An educator's own series is published through admin approval.
  const approval = needsApproval(portal, series);
  const lockedForReview = isLockedForReview(portal, series);
  const readiness = useMemo(() => (test ? validateTestForPublish(test) : { valid: false, errors: [] }), [test]);
  const seriesReadiness = useMemo(
    () => (series ? validateSeriesForPublish({ ...series, availability: { mode: series.availability_mode } }) : { valid: false, errors: [] }),
    [series],
  );
  const marksUsed = useMemo(() => (test ? test.questions.reduce((sum, q) => sum + Number(q.marks || 0), 0) : 0), [test]);

  if (!series || !test) {
    return (
      <div className="ul-ts-page">
        <button type="button" className="ul-tsd-back" onClick={goBack}><IconChevronLeft size={12} /> Back</button>
        <div className="ul-set-empty">{loading ? "Loading…" : "This Test could not be found."}</div>
        {toast && <div className="ul-set-toast">{toast}</div>}
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

  // Subjective questions (short / long / subjective) can't be edited yet:
  // they open read-only. Deleting them still works.
  const openEditQuestion = (q) => {
    setQuestionType(q.type);
    setEditingQuestionId(q.id);
    setFormErrors([]);
    setForm({
      ...emptyQuestionForm(q.type),
      text: q.text, image: q.image || "", optionA: q.optionA, optionB: q.optionB, optionC: q.optionC, optionD: q.optionD,
      correctAnswer: q.correctAnswer, correctAnswers: q.correctAnswers || [], acceptedAnswer: q.acceptedAnswer || "",
      marks: q.marks, negativeMarks: q.negativeMarks, difficulty: q.difficulty, subject: q.subject, explanation: q.explanation || "",
    });
    setBuilderStep(isBlockedQuestionType(q.type) ? "locked" : "form");
    setBuilderOpen(true);
  };

  const chooseType = (type) => {
    if (isBlockedQuestionType(type)) return;
    setQuestionType(type);
    setForm((prev) => ({ ...emptyQuestionForm(type), text: prev.text, image: prev.image, difficulty: prev.difficulty, subject: prev.subject }));
    setBuilderStep("form");
  };

  const closeBuilder = () => {
    setBuilderOpen(false);
    setFormErrors([]);
  };

  const draftErrors = validateQuestionDraft({ ...form, type: questionType });

  const saveQuestion = async () => {
    if (draftErrors.length > 0) {
      setFormErrors(draftErrors);
      return;
    }
    const payload = questionPayload({ ...form, type: questionType });
    let regraded = 0;
    const ok = editingQuestionId
      ? await run(async () => {
        const updated = await testSeriesApi.updateQuestion(editingQuestionId, payload);
        regraded = Number(updated?.regraded_attempts || 0);
      }, "Question updated.")
      : await run(() => testSeriesApi.createQuestion({ ...payload, testId: test.id }), "Question added.");
    if (ok && regraded > 0) setToast(`Question updated. ${regraded} submitted attempt${regraded === 1 ? "" : "s"} re-scored.`);
    if (ok) closeBuilder();
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await run(() => testSeriesApi.deleteQuestion(deleteTarget.id), "Question deleted.");
    setDeleteTarget(null);
  };

  const togglePublish = () => {
    const next = test.status === TEST_STATUS.PUBLISHED ? TEST_STATUS.DRAFT : TEST_STATUS.PUBLISHED;
    if (next === TEST_STATUS.PUBLISHED && !readiness.valid) {
      setToast(readiness.errors[0]);
      return;
    }
    run(() => testSeriesApi.setTestStatus(test.id, next), `"${test.name}" ${next === TEST_STATUS.PUBLISHED ? "published" : "unpublished"}.`);
  };

  const handlePublishSeries = async () => {
    if (!seriesReadiness.valid) {
      setToast(seriesReadiness.errors[0]);
      return;
    }
    // An educator's own series goes to an admin for approval instead.
    const ok = approval
      ? await run(() => testSeriesApi.submitForApproval(series.id), `"${series.name}" submitted for approval. An admin will review it before it goes live.`)
      : await run(() => testSeriesApi.publishSeries(series.id), `"${series.name}" published. The entire Test Series is now live for students.`);
    // Jump straight to the Test Series Structure page (the series list)
    // instead of leaving the admin sitting on a single Test's question
    // list — publishing the whole series is the "I'm done here" action.
    if (ok) goToSeriesStructure();
  };

  return (
    <div className="ul-ts-page">
      <button type="button" className="ul-tsd-back" onClick={goBack}><IconChevronLeft size={12} /> Back to {series.name}</button>

      <SeriesReviewBanner portal={portal} series={series} setToast={setToast} onSubmitted={() => load()} />

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
          {!(approval && series.status !== SERIES_STATUS.PUBLISHED) && (
            <button type="button" className="ul-btn ul-btn--ghost" onClick={togglePublish}>{test.status === TEST_STATUS.PUBLISHED ? "Unpublish" : "Publish"}</button>
          )}
          <button type="button" className="ul-btn ul-btn--primary" onClick={openAddQuestion}>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><IconPlus size={14} /> Add Question</span>
          </button>
          {test.questions.length > 0 && series.status !== SERIES_STATUS.PUBLISHED && !lockedForReview
            && !(portal.kind === "admin" && series.origin === "educator") && (
            <button type="button" className="ul-btn ul-btn--primary" onClick={handlePublishSeries}>
              {approval ? publishActionLabel(portal, series) : "Publish Test Series"}
            </button>
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
                      <span className="ul-td-type-tag">{questionTypeLabel(q.type)}</span>
                      {isBlockedQuestionType(q.type) && <> <ComingSoonBadge label="Read-only" /></>}
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
                <p className="ul-set-drawer__sub">{builderStep === "type" ? "Choose the question type to continue." : questionTypeLabel(questionType)}</p>
              </div>
              <button type="button" className="ul-set-drawer__close" onClick={closeBuilder} aria-label="Close"><IconClose size={15} /></button>
            </div>
            <div className="ul-set-drawer__body">
              {builderStep === "type" ? (
                <QuestionTypePicker value={questionType} onChange={chooseType} />
              ) : builderStep === "locked" ? (
                <div className="ul-ts-form">
                  <div className="ul-ts-errors" role="status">
                    <strong>{questionTypeLabel(questionType)} questions can't be edited yet.</strong> <ComingSoonBadge />
                    <p>{SUBJECTIVE_BLOCKED_MESSAGE} This question stays in the test, and students who answer it see "pending review". You can delete it from the list.</p>
                  </div>
                  <div className="ul-ts-form-row">
                    <label>Question</label>
                    <p className="ul-td-preview-answer-box">{form.text}</p>
                  </div>
                </div>
              ) : (
                <div className="ul-ts-form">
                  {formErrors.length > 0 && (
                    <div className="ul-ts-errors" role="alert">
                      <strong>Fix the following:</strong>
                      <ul>{formErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
                    </div>
                  )}

                  <div className="ul-ts-form-row">
                    <label htmlFor="q-text">Question</label>
                    <textarea id="q-text" value={form.text} onChange={(e) => setForm({ ...form, text: e.target.value })} placeholder="Type the question here…" />
                  </div>
                  <QuestionImageField value={form.image} onChange={(image) => setForm({ ...form, image })} />

                  {editingQuestionId && test.attempts > 0 && (
                    <div className="ul-tsw-note" role="note">
                      Changing a correct answer or the marks re-scores {test.attempts} submitted attempt{test.attempts === 1 ? "" : "s"}. Options can be edited but not added or removed.
                    </div>
                  )}
                  <QuestionAnswerFields q={{ ...form, type: questionType }} onChange={(patch) => setForm({ ...form, ...patch })} />

                  <div className="ul-ts-form-grid-2">
                    <div className="ul-ts-form-row">
                      <label htmlFor="q-marks">Marks</label>
                      <input id="q-marks" type="number" min="0" value={form.marks} onChange={(e) => setForm({ ...form, marks: e.target.value })} />
                    </div>
                    <div className="ul-ts-form-row">
                      <label htmlFor="q-negative">Negative Marking</label>
                      <input id="q-negative" type="number" min="0" step="0.25" value={form.negativeMarks} onChange={(e) => setForm({ ...form, negativeMarks: e.target.value })} />
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
                </div>
              )}
            </div>
            {builderStep === "form" && (
              <div className="ul-set-drawer__actions ul-ts-drawer-actions">
                {!editingQuestionId && (
                  <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setBuilderStep("type")}>Back</button>
                )}
                <button type="button" className="ul-btn ul-btn--primary" onClick={saveQuestion} disabled={saving || draftErrors.length > 0}>{editingQuestionId ? "Save Changes" : "Add Question"}</button>
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
                      {q.image && <img className="ul-qimg-view" src={q.image} alt={`Question ${i + 1} attachment`} />}
                      {q.type === QTYPE.TRUE_FALSE ? (
                        <ul className="ul-td-preview-options">
                          {TRUE_FALSE_OPTIONS.map((o) => <li key={o.key} className={q.correctAnswer === o.key ? "is-correct" : ""}>{o.text}</li>)}
                        </ul>
                      ) : isChoiceType(q.type) ? (
                        <ul className="ul-td-preview-options">
                          {["A", "B", "C", "D"].map((k) => (
                            <li key={k} className={(q.correctAnswers || []).includes(k) ? "is-correct" : ""}>{k}. {q[`option${k}`]}</li>
                          ))}
                        </ul>
                      ) : q.type === QTYPE.FILL_BLANK ? (
                        <p className="ul-td-preview-answer-box">Typed answer. Accepted: {q.acceptedAnswer || "—"}</p>
                      ) : (
                        <p className="ul-td-preview-answer-box">Answer box shown to the student (reviewed later; shows "pending review").</p>
                      )}
                      <span className="ul-td-preview-marks">{q.marks} marks{q.negativeMarks ? ` · −${q.negativeMarks} negative` : ""}</span>
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
