// AI Test Builder — "AI Question Generator Agent" for the Test Series
// module. Opened from TestSeries.jsx's "AI Test Builder" button (series
// tab only). Admin fills a generation form (or starts blank), reviews an
// editable structured preview, then saves it into the existing Test
// Series data model.
//
// Flattens the richer AI shape (sections, 5 question types) down into
// the existing flat questions[]/objective-or-subjective model via
// testSeriesMock.js's own createTestSeries/createTest/createQuestion —
// testSeriesMock.js itself is never touched.

import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  AI_QUESTION_TYPE,
  AI_QUESTION_TYPE_LABEL,
  AI_QUESTION_TYPE_OPTIONS,
  EXAM_TYPE_OPTIONS,
  DIFFICULTY_OPTIONS,
  LANGUAGE_OPTIONS,
  GENERATION_MODE,
  GENERATION_MODE_OPTIONS,
  PARSED_ISSUE_LABEL,
  generateTest,
  createEmptyTest,
} from "../data/aiTestBuilderMock";
import {
  QUESTION_TYPE,
  SUBJECT_OPTIONS,
  AUDIENCE_OPTIONS,
  PRICING_TYPE,
  useTestSeriesList,
  createTestSeries,
  createTest,
  createQuestion,
} from "../data/testSeriesMock";
import { IconSparkle, IconChevronLeft, IconPlus, IconCheck, IconAlert } from "../components/icons";
import "../components/AdminChrome.css";
import "./AdminDashboard.css";
import "./TestSeries.css";
import "./SettingsPermissions.css";
import "./AITestBuilder.css";
import ComingSoonBadge from "../components/ComingSoonBadge";
import { AI_COMING_SOON, AI_ENABLED } from "../utils/featureFlags";

const EMPTY_AI_FORM = {
  testName: "",
  subject: SUBJECT_OPTIONS[0],
  topics: "",
  examType: EXAM_TYPE_OPTIONS[0],
  difficulty: "Medium",
  totalMarks: 40,
  duration: 60,
  numQuestions: 10,
  numSections: 1,
  questionTypes: [AI_QUESTION_TYPE.MCQ],
  negativeMarking: false,
  negativeMarkValue: 1,
  language: LANGUAGE_OPTIONS[0],
  additionalInstructions: "",
  generationMode: GENERATION_MODE.FULL,
};

function mapDifficultyToSeries(d) {
  const v = (d || "medium").toString().toLowerCase();
  return ["easy", "medium", "hard"].includes(v) ? v : "medium";
}

// Converts one AI-shape question into the existing testSeriesMock
// createQuestion(seriesId, testId, type, data) call — never fabricates a
// correctAnswer that wasn't actually present; a blank/ambiguous one is
// passed through as "" so it stays visibly empty for manual entry.
function flattenQuestion(q) {
  const difficulty = mapDifficultyToSeries(q.difficulty);
  const marks = Number(q.marks) || 1;
  const subject = q.subject || q.topic || "";

  if (q.type === AI_QUESTION_TYPE.MCQ) {
    const opts = q.options || [];
    return {
      type: QUESTION_TYPE.OBJECTIVE,
      data: {
        text: q.text,
        optionA: opts[0]?.text || "",
        optionB: opts[1]?.text || "",
        optionC: opts[2]?.text || "",
        optionD: opts[3]?.text || "",
        correctAnswer: q.correctAnswer || "",
        marks,
        negativeMarks: q.negativeMarks || 0,
        difficulty,
        subject,
        explanation: q.explanation || "",
      },
    };
  }
  if (q.type === AI_QUESTION_TYPE.TRUE_FALSE) {
    let correctAnswer = "";
    if (q.correctAnswer) {
      const a = String(q.correctAnswer).toLowerCase();
      if (a.includes("false")) correctAnswer = "B";
      else if (a.includes("true")) correctAnswer = "A";
    }
    return {
      type: QUESTION_TYPE.OBJECTIVE,
      data: {
        text: q.text,
        optionA: "True",
        optionB: "False",
        optionC: "",
        optionD: "",
        correctAnswer,
        marks,
        negativeMarks: q.negativeMarks || 0,
        difficulty,
        subject,
        explanation: q.explanation || "",
      },
    };
  }
  if (q.type === AI_QUESTION_TYPE.MULTI_SELECT) {
    const opts = q.options || [];
    const correctList = q.correctAnswers || [];
    return {
      type: QUESTION_TYPE.OBJECTIVE,
      data: {
        text: q.text,
        optionA: opts[0]?.text || "",
        optionB: opts[1]?.text || "",
        optionC: opts[2]?.text || "",
        optionD: opts[3]?.text || "",
        correctAnswer: correctList[0] || "",
        marks,
        negativeMarks: q.negativeMarks || 0,
        difficulty,
        subject,
        explanation: `${q.explanation ? q.explanation + " " : ""}${correctList.length > 1 ? `Multiple correct options in the original: ${correctList.join(", ")}.` : ""}`.trim(),
      },
    };
  }
  // short_answer / long_answer -> subjective
  return {
    type: QUESTION_TYPE.SUBJECTIVE,
    data: {
      text: q.text,
      answerInstructions: q.answerInstructions || "",
      marks,
      difficulty,
      subject,
      rubric: q.rubric || "",
    },
  };
}

function emptyOptionsFor(type) {
  if (type === AI_QUESTION_TYPE.TRUE_FALSE) return [{ key: "True", text: "True" }, { key: "False", text: "False" }];
  if (type === AI_QUESTION_TYPE.MCQ || type === AI_QUESTION_TYPE.MULTI_SELECT) {
    return ["A", "B", "C", "D"].map((key) => ({ key, text: "" }));
  }
  return [];
}

function blankQuestion(type) {
  return {
    id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    type,
    text: "",
    options: emptyOptionsFor(type),
    correctAnswer: type === AI_QUESTION_TYPE.MULTI_SELECT ? undefined : "",
    correctAnswers: type === AI_QUESTION_TYPE.MULTI_SELECT ? [] : undefined,
    answerInstructions: type === AI_QUESTION_TYPE.SHORT_ANSWER || type === AI_QUESTION_TYPE.LONG_ANSWER ? "" : undefined,
    marks: 1,
    negativeMarks: 0,
    difficulty: "Medium",
    subject: "",
    topic: "",
    explanation: "",
    rubric: type === AI_QUESTION_TYPE.SHORT_ANSWER || type === AI_QUESTION_TYPE.LONG_ANSWER ? "" : undefined,
    issues: [],
  };
}

export default function AITestBuilder() {
  const navigate = useNavigate();
  const seriesList = useTestSeriesList();

  const [aiForm, setAiForm] = useState(EMPTY_AI_FORM);
  const [test, setTest] = useState(null);
  const [toast, setToast] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveTarget, setSaveTarget] = useState("new");
  const [existingSeriesId, setExistingSeriesId] = useState("");
  const [newSeriesForm, setNewSeriesForm] = useState({ name: "", subject: SUBJECT_OPTIONS[0], audience: AUDIENCE_OPTIONS[0], pricing: PRICING_TYPE.FREE, price: "" });
  const [testMeta, setTestMeta] = useState({ duration: 60, totalMarks: 0, passingMarks: 0, attemptLimit: 1, scheduledAt: "", shuffleQuestions: false, shuffleOptions: false });

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3200);
  };

  const canGenerate =
    aiForm.testName.trim() &&
    aiForm.subject &&
    aiForm.questionTypes.length > 0 &&
    Number(aiForm.totalMarks) > 0 &&
    Number(aiForm.duration) > 0 &&
    Number(aiForm.numQuestions) > 0 &&
    Number(aiForm.numSections) >= 1;

  // AI is coming soon: no generate / build / save path runs while AI_ENABLED is false.
  const handleGenerate = () => {
    if (!AI_ENABLED || !canGenerate) return;
    const config = {
      testName: aiForm.testName.trim(),
      subject: aiForm.subject,
      topics: aiForm.topics.split(",").map((t) => t.trim()).filter(Boolean),
      examType: aiForm.examType,
      difficulty: aiForm.difficulty,
      totalMarks: Number(aiForm.totalMarks) || 0,
      duration: Number(aiForm.duration) || 0,
      numQuestions: Number(aiForm.numQuestions) || 0,
      numSections: Number(aiForm.numSections) || 1,
      questionTypes: aiForm.questionTypes,
      negativeMarking: aiForm.negativeMarking,
      negativeMarkValue: Number(aiForm.negativeMarkValue) || 0,
      language: aiForm.language,
      additionalInstructions: aiForm.additionalInstructions,
      generationMode: aiForm.generationMode,
    };
    const existingStructure = config.generationMode === GENERATION_MODE.QUESTIONS_FOR_STRUCTURE && test ? { sections: test.sections } : null;
    const result = generateTest(config, existingStructure);
    setTest(result);
    setTestMeta({ duration: result.duration, totalMarks: result.totalMarks, passingMarks: Math.max(1, Math.round(result.totalMarks * 0.4)), attemptLimit: 1, scheduledAt: "", shuffleQuestions: false, shuffleOptions: false });
    flash(result.sections.some((s) => s.questions.length) ? "Test generated. Review it below before saving." : "Structure generated. Add questions when you're ready.");
  };

  const startManual = () => {
    if (!AI_ENABLED) return;
    const t = createEmptyTest(aiForm.testName.trim() || "New Test");
    setTest(t);
    setTestMeta({ duration: 60, totalMarks: 0, passingMarks: 0, attemptLimit: 1, scheduledAt: "", shuffleQuestions: false, shuffleOptions: false });
  };

  const resetForm = () => setAiForm(EMPTY_AI_FORM);

  const startOver = () => {
    setTest(null);
    setAiForm(EMPTY_AI_FORM);
  };

  // ---------- preview/editor mutations ----------
  const updateSection = (sectionId, patch) => {
    setTest((t) => ({ ...t, sections: t.sections.map((s) => (s.id === sectionId ? { ...s, ...patch } : s)) }));
  };
  const deleteSection = (sectionId) => {
    setTest((t) => ({ ...t, sections: t.sections.filter((s) => s.id !== sectionId) }));
  };
  const addSection = () => {
    setTest((t) => ({
      ...t,
      sections: [...t.sections, { id: `SEC-${Date.now()}`, name: `Section ${String.fromCharCode(65 + t.sections.length)}`, instructions: "", questionCount: 0, marksPerQuestion: null, totalMarks: 0, questionTypes: [], questions: [] }],
    }));
  };
  const addQuestion = (sectionId, type) => {
    setTest((t) => ({
      ...t,
      sections: t.sections.map((s) => (s.id === sectionId ? { ...s, questions: [...s.questions, blankQuestion(type)] } : s)),
    }));
  };
  const deleteQuestion = (sectionId, qId) => {
    setTest((t) => ({ ...t, sections: t.sections.map((s) => (s.id === sectionId ? { ...s, questions: s.questions.filter((q) => q.id !== qId) } : s)) }));
  };
  const duplicateQuestion = (sectionId, qId) => {
    setTest((t) => ({
      ...t,
      sections: t.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.questions.findIndex((q) => q.id === qId);
        if (idx === -1) return s;
        const clone = { ...s.questions[idx], id: `copy-${Date.now()}-${Math.random().toString(36).slice(2, 7)}` };
        const next = [...s.questions];
        next.splice(idx + 1, 0, clone);
        return { ...s, questions: next };
      }),
    }));
  };
  const moveQuestion = (sectionId, qId, dir) => {
    setTest((t) => ({
      ...t,
      sections: t.sections.map((s) => {
        if (s.id !== sectionId) return s;
        const idx = s.questions.findIndex((q) => q.id === qId);
        const swapWith = idx + dir;
        if (idx < 0 || swapWith < 0 || swapWith >= s.questions.length) return s;
        const next = [...s.questions];
        [next[idx], next[swapWith]] = [next[swapWith], next[idx]];
        return { ...s, questions: next };
      }),
    }));
  };
  const updateQuestion = (sectionId, qId, patch) => {
    setTest((t) => ({
      ...t,
      sections: t.sections.map((s) => (s.id !== sectionId ? s : { ...s, questions: s.questions.map((q) => (q.id === qId ? { ...q, ...patch } : q)) })),
    }));
  };
  const updateOption = (sectionId, qId, optKey, text) => {
    setTest((t) => ({
      ...t,
      sections: t.sections.map((s) => (s.id !== sectionId ? s : {
        ...s,
        questions: s.questions.map((q) => (q.id !== qId ? q : { ...q, options: q.options.map((o) => (o.key === optKey ? { ...o, text } : o)) })),
      })),
    }));
  };
  const toggleMultiCorrect = (sectionId, qId, optKey) => {
    setTest((t) => ({
      ...t,
      sections: t.sections.map((s) => (s.id !== sectionId ? s : {
        ...s,
        questions: s.questions.map((q) => {
          if (q.id !== qId) return q;
          const has = (q.correctAnswers || []).includes(optKey);
          return { ...q, correctAnswers: has ? q.correctAnswers.filter((k) => k !== optKey) : [...(q.correctAnswers || []), optKey] };
        }),
      })),
    }));
  };

  const totals = useMemo(() => {
    if (!test) return { questions: 0, marks: 0, issues: 0 };
    let questions = 0, marks = 0, issues = 0;
    test.sections.forEach((s) => s.questions.forEach((q) => {
      questions += 1;
      marks += Number(q.marks) || 0;
      issues += (q.issues || []).length;
    }));
    return { questions, marks, issues };
  }, [test]);

  const handleSaveConfirm = () => {
    if (!AI_ENABLED) return;
    if (!test) return;
    let seriesId = existingSeriesId;
    if (saveTarget === "new") {
      if (!newSeriesForm.name.trim()) return;
      const series = createTestSeries({
        name: newSeriesForm.name.trim(),
        subject: newSeriesForm.subject,
        audience: newSeriesForm.audience,
        pricing: newSeriesForm.pricing,
        price: newSeriesForm.pricing === PRICING_TYPE.PAID ? Number(newSeriesForm.price) || 0 : 0,
      });
      seriesId = series.id;
    }
    if (!seriesId) return;

    const instructions = test.sections
      .map((s) => `${s.name}${s.instructions ? ` — ${s.instructions}` : ""}`)
      .join("\n");

    const createdTest = createTest(seriesId, {
      name: test.name,
      instructions,
      duration: Number(testMeta.duration) || 0,
      totalMarks: Number(testMeta.totalMarks) || totals.marks,
      passingMarks: Number(testMeta.passingMarks) || 0,
      attemptLimit: Number(testMeta.attemptLimit) || 1,
      scheduledAt: testMeta.scheduledAt || undefined,
      shuffleQuestions: !!testMeta.shuffleQuestions,
      shuffleOptions: !!testMeta.shuffleOptions,
    });

    test.sections.forEach((s) => s.questions.forEach((q) => {
      const { type, data } = flattenQuestion(q);
      createQuestion(seriesId, createdTest.id, type, data);
    }));

    setSaveOpen(false);
    flash(`Saved "${test.name}" to Test Series. Open Test & Question Structure to review it.`);
    setTimeout(() => navigate("/admin/testseries"), 900);
  };

  const openSave = () => {
    if (!AI_ENABLED) return;
    setNewSeriesForm((f) => ({ ...f, name: test?.name ? `${test.name} Series` : f.name, subject: test?.subject || f.subject }));
    setSaveOpen(true);
  };

  return (
    <>
      {toast && <div className="ul-aitb-toast">{toast}</div>}

      <div className="ul-dash-welcome ul-aitb-welcome">
        <div>
          <button type="button" className="ul-btn ul-btn--ghost ul-aitb-back" onClick={() => navigate("/admin/testseries")}>
            <IconChevronLeft size={14} /> Back to Test Series
          </button>
          <h2 className="ul-dash-welcome__title"><IconSparkle size={20} /> AI Test Builder {!AI_ENABLED && <ComingSoonBadge />}</h2>
          <p className="ul-dash-welcome__subtitle">Describe the test you need and generate a complete, editable structure and question set.</p>
        </div>
      </div>

      {!AI_ENABLED && (
        <div className="ul-ts-errors" role="status" style={{ marginBottom: 14 }}>
          <strong>{AI_COMING_SOON}</strong> The builder below is shown for preview only; every control is disabled.
        </div>
      )}

      <fieldset disabled={!AI_ENABLED} aria-disabled={!AI_ENABLED || undefined} className="ul-aitb-lock">

      {!test && (
        <div className="ul-card ul-aitb-form-card">
          <div className="ul-ts-form">
            <div className="ul-ts-form-grid-2">
              <div className="ul-ts-form-row">
                <label>Test Name</label>
                <input type="text" value={aiForm.testName} onChange={(e) => setAiForm({ ...aiForm, testName: e.target.value })} placeholder="e.g. Physics Full Mock Test 2" />
              </div>
              <div className="ul-ts-form-row">
                <label>Subject</label>
                <select value={SUBJECT_OPTIONS.includes(aiForm.subject) ? aiForm.subject : "__other__"} onChange={(e) => setAiForm({ ...aiForm, subject: e.target.value === "__other__" ? "" : e.target.value })}>
                  {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  <option value="__other__">Other…</option>
                </select>
                {!SUBJECT_OPTIONS.includes(aiForm.subject) && (
                  <input type="text" value={aiForm.subject} onChange={(e) => setAiForm({ ...aiForm, subject: e.target.value })} placeholder="Type the subject" style={{ marginTop: 6 }} autoFocus />
                )}
              </div>
            </div>

            <div className="ul-ts-form-row">
              <label>Topics (comma-separated, optional)</label>
              <input type="text" value={aiForm.topics} onChange={(e) => setAiForm({ ...aiForm, topics: e.target.value })} placeholder="Leave blank to let AI pick from the subject's usual topics" />
            </div>

            <div className="ul-ts-form-grid-2">
              <div className="ul-ts-form-row">
                <label>Exam Type</label>
                <select value={aiForm.examType} onChange={(e) => setAiForm({ ...aiForm, examType: e.target.value })}>
                  {EXAM_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="ul-ts-form-row">
                <label>Difficulty Level</label>
                <select value={aiForm.difficulty} onChange={(e) => setAiForm({ ...aiForm, difficulty: e.target.value })}>
                  {DIFFICULTY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
            </div>

            <div className="ul-ts-form-grid-2">
              <div className="ul-ts-form-row">
                <label>Total Marks</label>
                <input type="number" min="1" value={aiForm.totalMarks} onChange={(e) => setAiForm({ ...aiForm, totalMarks: e.target.value })} />
              </div>
              <div className="ul-ts-form-row">
                <label>Duration (minutes)</label>
                <input type="number" min="1" value={aiForm.duration} onChange={(e) => setAiForm({ ...aiForm, duration: e.target.value })} />
              </div>
            </div>

            <div className="ul-ts-form-grid-2">
              <div className="ul-ts-form-row">
                <label>Number of Questions</label>
                <input type="number" min="1" value={aiForm.numQuestions} onChange={(e) => setAiForm({ ...aiForm, numQuestions: e.target.value })} />
              </div>
              <div className="ul-ts-form-row">
                <label>Number of Sections</label>
                <input type="number" min="1" max="10" value={aiForm.numSections} onChange={(e) => setAiForm({ ...aiForm, numSections: e.target.value })} />
              </div>
            </div>

            <div className="ul-ts-form-row">
              <label>Question Types</label>
              <div className="ul-aitb-chip-group">
                {AI_QUESTION_TYPE_OPTIONS.map((type) => {
                  const active = aiForm.questionTypes.includes(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      className={`ul-aitb-chip${active ? " is-active" : ""}`}
                      onClick={() => setAiForm({
                        ...aiForm,
                        questionTypes: active ? aiForm.questionTypes.filter((t) => t !== type) : [...aiForm.questionTypes, type],
                      })}
                    >
                      {active && <IconCheck size={12} />} {AI_QUESTION_TYPE_LABEL[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="ul-ts-form-grid-2">
              <div className="ul-ts-form-row">
                <label>Language</label>
                <select value={aiForm.language} onChange={(e) => setAiForm({ ...aiForm, language: e.target.value })}>
                  {LANGUAGE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div className="ul-ts-form-row">
                <label>Negative Marking</label>
                <div className="ul-ts-pill-toggle">
                  <button type="button" className={!aiForm.negativeMarking ? "is-active" : ""} onClick={() => setAiForm({ ...aiForm, negativeMarking: false })}>Off</button>
                  <button type="button" className={aiForm.negativeMarking ? "is-active" : ""} onClick={() => setAiForm({ ...aiForm, negativeMarking: true })}>On</button>
                </div>
              </div>
            </div>

            {aiForm.negativeMarking && (
              <div className="ul-ts-form-row">
                <label>Negative Marks per Wrong Answer</label>
                <input type="number" min="0" step="0.25" value={aiForm.negativeMarkValue} onChange={(e) => setAiForm({ ...aiForm, negativeMarkValue: e.target.value })} />
              </div>
            )}

            <div className="ul-ts-form-row">
              <label>Additional Instructions (optional)</label>
              <textarea value={aiForm.additionalInstructions} onChange={(e) => setAiForm({ ...aiForm, additionalInstructions: e.target.value })} placeholder="Any extra guidance for the generator, e.g. focus areas, tone, calculator allowed…" />
            </div>

            <div className="ul-ts-form-row">
              <label>Generation Mode</label>
              <div className="ul-aitb-radio-group">
                {GENERATION_MODE_OPTIONS.map((o) => (
                  <label key={o.value} className="ul-aitb-radio">
                    <input type="radio" name="genmode" checked={aiForm.generationMode === o.value} onChange={() => setAiForm({ ...aiForm, generationMode: o.value })} />
                    {o.label}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="ul-aitb-form-actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={resetForm}>Reset Form</button>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={startManual}>Start Blank Instead</button>
            <button type="button" className="ul-btn ul-btn--primary" disabled={!canGenerate} onClick={handleGenerate}>
              <IconSparkle size={14} /> Generate Test
            </button>
          </div>
        </div>
      )}

      {test && (
        <div className="ul-aitb-preview">
          {(test.warnings?.length > 0 || totals.issues > 0) && (
            <div className="ul-aitb-warnings">
              <IconAlert size={16} color="var(--color-warning-accent)" />
              <div>
                {test.warnings?.map((w, i) => <p key={`w-${i}`}>{w}</p>)}
                {totals.issues > 0 && <p>{totals.issues} question{totals.issues === 1 ? "" : "s"} below {totals.issues === 1 ? "has" : "have"} flagged issues — review before saving. Nothing was invented for these; they're left blank for you to fill in.</p>}
              </div>
            </div>
          )}

          <div className="ul-card ul-aitb-meta-card">
            <div className="ul-ts-form-row">
              <label>Test Name</label>
              <input type="text" value={test.name} onChange={(e) => setTest({ ...test, name: e.target.value })} />
            </div>
            <div className="ul-aitb-meta-grid">
              <div className="ul-ts-form-row">
                <label>Duration (min)</label>
                <input type="number" min="1" value={testMeta.duration} onChange={(e) => setTestMeta({ ...testMeta, duration: e.target.value })} />
              </div>
              <div className="ul-ts-form-row">
                <label>Total Marks</label>
                <input type="number" min="0" value={testMeta.totalMarks} onChange={(e) => setTestMeta({ ...testMeta, totalMarks: e.target.value })} />
              </div>
              <div className="ul-ts-form-row">
                <label>Passing Marks</label>
                <input type="number" min="0" value={testMeta.passingMarks} onChange={(e) => setTestMeta({ ...testMeta, passingMarks: e.target.value })} />
              </div>
              <div className="ul-ts-form-row">
                <label>Attempt Limit</label>
                <input type="number" min="1" value={testMeta.attemptLimit} onChange={(e) => setTestMeta({ ...testMeta, attemptLimit: e.target.value })} />
              </div>
            </div>
            <div className="ul-aitb-meta-stats">
              <span>{test.sections.length} section{test.sections.length === 1 ? "" : "s"}</span>
              <span>{totals.questions} question{totals.questions === 1 ? "" : "s"}</span>
              <span>{totals.marks} marks</span>
              <span className="ul-aitb-source-tag">{test.source === "manual" ? "Manual" : "AI generated"}</span>
            </div>
          </div>

          {test.sections.map((section) => (
            <div key={section.id} className="ul-card ul-aitb-section-card">
              <div className="ul-aitb-section-head">
                <input className="ul-aitb-section-name" type="text" value={section.name} onChange={(e) => updateSection(section.id, { name: e.target.value })} />
                <button type="button" className="ul-btn ul-btn--ghost ul-aitb-small-btn" onClick={() => deleteSection(section.id)}>
                  Remove Section
                </button>
              </div>
              <input
                className="ul-aitb-section-instructions"
                type="text"
                placeholder="Section instructions (optional)"
                value={section.instructions}
                onChange={(e) => updateSection(section.id, { instructions: e.target.value })}
              />

              {section.questions.map((q, qi) => (
                <QuestionEditor
                  key={q.id}
                  q={q}
                  index={qi}
                  canMoveUp={qi > 0}
                  canMoveDown={qi < section.questions.length - 1}
                  onChange={(patch) => updateQuestion(section.id, q.id, patch)}
                  onOptionChange={(key, text) => updateOption(section.id, q.id, key, text)}
                  onToggleMultiCorrect={(key) => toggleMultiCorrect(section.id, q.id, key)}
                  onDelete={() => deleteQuestion(section.id, q.id)}
                  onMove={(dir) => moveQuestion(section.id, q.id, dir)}
                />
              ))}

              <div className="ul-aitb-add-question">
                {AI_QUESTION_TYPE_OPTIONS.map((type) => (
                  <button key={type} type="button" className="ul-btn ul-btn--ghost ul-aitb-small-btn" onClick={() => addQuestion(section.id, type)}>
                    <IconPlus size={12} /> {AI_QUESTION_TYPE_LABEL[type]}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <button type="button" className="ul-btn ul-btn--ghost ul-aitb-add-section-btn" onClick={addSection}>
            <IconPlus size={14} /> Add Section
          </button>

          <div className="ul-aitb-bottom-actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={startOver}>Start Over</button>
            <button type="button" className="ul-btn ul-btn--primary" onClick={openSave} disabled={totals.questions === 0}>
              Save as Test Series
            </button>
          </div>
        </div>
      )}

      {saveOpen && (
        <div className="ul-set-drawer-backdrop" onClick={() => setSaveOpen(false)}>
          <div className="ul-set-drawer" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="ul-set-drawer__head">
              <div>
                <h3 className="ul-set-drawer__title">Save as Test Series</h3>
                <p className="ul-set-drawer__sub">Add this test to an existing Test Series, or create a new one. It will be saved as a Draft.</p>
              </div>
            </div>
            <div className="ul-set-drawer__body">
              <div className="ul-ts-form">
                <div className="ul-ts-form-row">
                  <div className="ul-ts-pill-toggle">
                    <button type="button" className={saveTarget === "new" ? "is-active" : ""} onClick={() => setSaveTarget("new")}>Create New Test Series</button>
                    <button type="button" className={saveTarget === "existing" ? "is-active" : ""} onClick={() => setSaveTarget("existing")} disabled={seriesList.length === 0}>Add to Existing</button>
                  </div>
                </div>

                {saveTarget === "new" ? (
                  <>
                    <div className="ul-ts-form-row">
                      <label>Test Series Name</label>
                      <input type="text" value={newSeriesForm.name} onChange={(e) => setNewSeriesForm({ ...newSeriesForm, name: e.target.value })} />
                    </div>
                    <div className="ul-ts-form-grid-2">
                      <div className="ul-ts-form-row">
                        <label>Subject / Category</label>
                        <select value={SUBJECT_OPTIONS.includes(newSeriesForm.subject) ? newSeriesForm.subject : "__other__"} onChange={(e) => setNewSeriesForm({ ...newSeriesForm, subject: e.target.value === "__other__" ? "" : e.target.value })}>
                          {SUBJECT_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                          <option value="__other__">Other…</option>
                        </select>
                        {!SUBJECT_OPTIONS.includes(newSeriesForm.subject) && (
                          <input type="text" value={newSeriesForm.subject} onChange={(e) => setNewSeriesForm({ ...newSeriesForm, subject: e.target.value })} placeholder="Type the subject" style={{ marginTop: 6 }} />
                        )}
                      </div>
                      <div className="ul-ts-form-row">
                        <label>Target Audience</label>
                        <select value={newSeriesForm.audience} onChange={(e) => setNewSeriesForm({ ...newSeriesForm, audience: e.target.value })}>
                          {AUDIENCE_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
                        </select>
                      </div>
                    </div>
                    <div className="ul-ts-form-row">
                      <label>Free or Paid</label>
                      <div className="ul-ts-pill-toggle">
                        <button type="button" className={newSeriesForm.pricing === PRICING_TYPE.FREE ? "is-active" : ""} onClick={() => setNewSeriesForm({ ...newSeriesForm, pricing: PRICING_TYPE.FREE })}>Free</button>
                        <button type="button" className={newSeriesForm.pricing === PRICING_TYPE.PAID ? "is-active" : ""} onClick={() => setNewSeriesForm({ ...newSeriesForm, pricing: PRICING_TYPE.PAID })}>Paid</button>
                      </div>
                    </div>
                    {newSeriesForm.pricing === PRICING_TYPE.PAID && (
                      <div className="ul-ts-form-row">
                        <label>Price (₹)</label>
                        <input type="number" min="0" value={newSeriesForm.price} onChange={(e) => setNewSeriesForm({ ...newSeriesForm, price: e.target.value })} />
                      </div>
                    )}
                  </>
                ) : (
                  <div className="ul-ts-form-row">
                    <label>Test Series</label>
                    <select value={existingSeriesId} onChange={(e) => setExistingSeriesId(e.target.value)}>
                      <option value="">Select a Test Series…</option>
                      {seriesList.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                <div className="ul-ts-form-row">
                  <label>Scheduled Date/Time (optional — leave blank to keep as Draft)</label>
                  <input type="datetime-local" value={testMeta.scheduledAt} onChange={(e) => setTestMeta({ ...testMeta, scheduledAt: e.target.value })} />
                </div>
              </div>
            </div>
            <div className="ul-set-drawer__actions ul-ts-drawer-actions">
              <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setSaveOpen(false)}>Cancel</button>
              <button
                type="button"
                className="ul-btn ul-btn--primary"
                disabled={saveTarget === "new" ? !newSeriesForm.name.trim() || !newSeriesForm.subject.trim() : !existingSeriesId}
                onClick={handleSaveConfirm}
              >
                Save Test
              </button>
            </div>
          </div>
        </div>
      )}
      </fieldset>
    </>
  );
}

function QuestionEditor({ q, index, canMoveUp, canMoveDown, onChange, onOptionChange, onToggleMultiCorrect, onDelete, onMove }) {
  const hasOptions = q.type === AI_QUESTION_TYPE.MCQ || q.type === AI_QUESTION_TYPE.MULTI_SELECT || q.type === AI_QUESTION_TYPE.TRUE_FALSE;
  const isSubjective = q.type === AI_QUESTION_TYPE.SHORT_ANSWER || q.type === AI_QUESTION_TYPE.LONG_ANSWER;

  return (
    <div className="ul-aitb-question">
      <div className="ul-aitb-question-head">
        <span className="ul-aitb-question-num">Q{index + 1}</span>
        <select className="ul-aitb-type-select" value={q.type} onChange={(e) => onChange({ type: e.target.value, options: emptyOptionsFor(e.target.value) })}>
          {AI_QUESTION_TYPE_OPTIONS.map((t) => <option key={t} value={t}>{AI_QUESTION_TYPE_LABEL[t]}</option>)}
        </select>
        <input className="ul-aitb-marks-input" type="number" min="0" step="0.5" value={q.marks} onChange={(e) => onChange({ marks: e.target.value })} title="Marks" />
        <div className="ul-aitb-question-controls">
          <button type="button" className="ul-aitb-reorder-btn" disabled={!canMoveUp} onClick={() => onMove(-1)} title="Move up">▲</button>
          <button type="button" className="ul-aitb-reorder-btn" disabled={!canMoveDown} onClick={() => onMove(1)} title="Move down">▼</button>
          <button type="button" className="ul-btn ul-btn--ghost ul-aitb-small-btn ul-aitb-remove-btn" onClick={onDelete}>Remove</button>
        </div>
      </div>

      {q.issues && q.issues.length > 0 && (
        <div className="ul-aitb-issue-badges">
          {q.issues.map((code) => <span key={code} className="ul-aitb-issue-badge">{PARSED_ISSUE_LABEL[code] || code}</span>)}
        </div>
      )}

      <textarea className="ul-aitb-question-text" value={q.text} onChange={(e) => onChange({ text: e.target.value })} placeholder="Question text…" />

      {hasOptions && (
        <div className="ul-aitb-options">
          {q.options.map((opt) => {
            const isCorrect = q.type === AI_QUESTION_TYPE.MULTI_SELECT ? (q.correctAnswers || []).includes(opt.key) : q.correctAnswer === opt.key;
            return (
              <div key={opt.key} className={`ul-aitb-option${isCorrect ? " is-correct" : ""}`}>
                <button
                  type="button"
                  className="ul-aitb-option-mark"
                  title={q.type === AI_QUESTION_TYPE.MULTI_SELECT ? "Toggle correct option" : "Mark as correct answer"}
                  onClick={() => (q.type === AI_QUESTION_TYPE.MULTI_SELECT ? onToggleMultiCorrect(opt.key) : onChange({ correctAnswer: opt.key }))}
                >
                  {isCorrect ? <IconCheck size={12} /> : opt.key}
                </button>
                {q.type === AI_QUESTION_TYPE.TRUE_FALSE ? (
                  <span className="ul-aitb-option-static">{opt.text}</span>
                ) : (
                  <input type="text" value={opt.text} onChange={(e) => onOptionChange(opt.key, e.target.value)} placeholder={`Option ${opt.key}`} />
                )}
              </div>
            );
          })}
          {!q.correctAnswer && q.type !== AI_QUESTION_TYPE.MULTI_SELECT && (
            <p className="ul-aitb-no-answer">No correct answer marked yet — click an option letter to set it.</p>
          )}
        </div>
      )}

      {isSubjective && (
        <div className="ul-ts-form-row">
          <label>Answer Instructions / Rubric</label>
          <textarea value={q.answerInstructions || q.rubric || ""} onChange={(e) => onChange({ answerInstructions: e.target.value, rubric: e.target.value })} placeholder="What should a full-marks answer include?" />
        </div>
      )}
    </div>
  );
}
