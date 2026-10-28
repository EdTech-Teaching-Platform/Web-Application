// Test Series creation wizard (Admin).
// Start method → (Source) → Details → Structure → Classification →
// Availability → Review. All state lives here so stepping backwards never
// loses data. Saves through createSeriesFromWizard() in testSeriesMock.js, so
// the result is an ordinary Test Series that the existing list/detail/edit
// pages already handle.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  IconPencil, IconLayers, IconUpload, IconSparkle,
  IconCheck, IconChevronLeft, IconChevronRight, IconPlus, IconClose, IconAlert, IconEdit,
} from "../components/icons";
import {
  PRICING_TYPE, PRICING_TYPE_LABEL, AUDIENCE_OPTIONS,
  DIFFICULTY_LABEL,
} from "../data/testSeriesMock";
import {
  START_METHOD, GRADE_OPTIONS, CLASS_SUBJECT_OPTIONS, EXAM_OPTIONS, LEVEL_OPTIONS, BASE_LANGUAGES,
  initialWizardState, normalizeWizardState, emptyTest, cloneQuestion, questionKey, testTotalMarks, derivedTestType,
  stepErrors, applicableSteps, validateWizard, buildSeriesPayload, stripHtml, wid,
} from "../data/testSeriesWizard";
import { useRpc } from "../hooks/useRpc";
import { testSeriesApi } from "../services/testSeriesApi";
import { WizModal, RichText, QuestionEditor, CsvImporter, OutlineBuilder, sanitizeHtml } from "./TestSeriesWizardParts";
import { isBlockedQuestionType, questionPayload, questionTypeLabel } from "../data/questionTypes";
import ComingSoonBadge from "../components/ComingSoonBadge";
import SaveProgress from "../components/SaveProgress";
import { failedStepIndex, saveErrorMessage, saveSteps } from "../utils/saveProgress";
import { startTimer } from "../utils/debugTiming";
import { needsApproval, publishActionLabel, useAuthoringPortal } from "../context/authoringPortal";
import { AI_COMING_SOON, AI_ENABLED } from "../utils/featureFlags";
import "./AdminDashboard.css";
import "./EducatorVerification.css";
import "./SettingsPermissions.css";
import "./TestSeries.css";
import "./TestSeriesWizard.css";

// `hidden: true` hides a start option from the admin UI without deleting its logic.
const METHOD_CARDS = [
  { key: START_METHOD.SCRATCH, icon: IconPencil, tone: "rose", title: "Build from scratch", text: "Start with an empty series and add tests and questions yourself." },
  { key: START_METHOD.DUPLICATE, hidden: true, icon: IconLayers, tone: "grey", title: "Duplicate an existing series", text: "Copy the tests and questions of a series you already made into a new, independent series." },
  { key: START_METHOD.CSV, icon: IconUpload, tone: "orange", title: "Import questions", text: "Upload a CSV and review a row-by-row validation report before anything is imported." },
  { key: START_METHOD.AI, icon: IconSparkle, tone: "pink", title: "AI-assisted outline", text: "Get an editable, template-based outline of tests and topics from your requirements.", comingSoon: !AI_ENABLED },
];
const SOURCE_TITLE = {
  [START_METHOD.DUPLICATE]: ["Duplicate an existing series", "Pick a series to copy. The original stays untouched — you get a new, independent copy to edit."],
  [START_METHOD.CSV]: ["Import questions from CSV", "Upload a file, review the validation report, fix or remove problem rows, then import the valid ones."],
  [START_METHOD.AI]: ["AI-assisted outline", "Describe what you need and review a suggested outline. You decide what to keep."],
};
const STEP_LABEL = { method: "Start", source: "Source", details: "Details", structure: "Structure", classification: "Classification", availability: "Availability", review: "Review" };

function esc(s) { return String(s || "").replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c])); }
function money(n) { return `₹${Number(n || 0).toLocaleString("en-IN")}`; }
function mapSubject(cat) { return CLASS_SUBJECT_OPTIONS.includes(cat) ? cat : "Other"; }

function OptionCard({ icon: Icon, tone, title, text, points, selected, onClick, comingSoon }) {
  return (
    <button
      type="button"
      className={`ul-tsw-opt${selected ? " is-selected" : ""}${comingSoon ? " is-disabled" : ""}`}
      onClick={comingSoon ? undefined : onClick}
      disabled={comingSoon}
      aria-disabled={comingSoon || undefined}
      aria-pressed={selected}
    >
      <span className={`ul-tsw-opt__icon is-${tone}`}><Icon size={20} /></span>
      <span className="ul-tsw-opt__radio">{selected && <IconCheck size={12} />}</span>
      <strong>{title} {comingSoon && <ComingSoonBadge />}</strong>
      {text && <span className="ul-tsw-opt__text">{comingSoon ? AI_COMING_SOON : text}</span>}
      {points && <ul>{points.map((p) => <li key={p}>{p}</li>)}</ul>}
    </button>
  );
}

function Chips({ options, value, onChange, multi }) {
  const on = (o) => (multi ? value.includes(o) : value === o);
  return (
    <div className="ul-tsw-chips">
      {options.map((o) => (
        <button key={o} type="button" className={`ul-tsw-chip${on(o) ? " is-on" : ""}`} aria-pressed={on(o)}
          onClick={() => onChange(multi ? (value.includes(o) ? value.filter((x) => x !== o) : [...value, o]) : o)}>{o}</button>
      ))}
    </div>
  );
}

function Errors({ list }) {
  if (!list.length) return null;
  return (
    <div className="ul-tsw-needs" role="status">
      <IconAlert size={14} />
      <ul>{list.map((e) => <li key={e}>{e}</li>)}</ul>
    </div>
  );
}

export default function TestSeriesWizard() {
  const navigate = useNavigate();
  const location = useLocation();
  const portal = useAuthoringPortal();   // admin or teacher portal: paths and the publish label
  // A series created in the wizard belongs to whoever creates it, so an
  // educator's goes to an admin for approval instead of being published.
  const approval = needsApproval(portal, { origin: portal.kind });
  const [st, setSt] = useState(initialWizardState);
  // Only the duplicate start needs the series list (up to 100 rows with
  // enrolment / attempt counts); the name check is its own RPC below.
  const listRequest = useCallback(() => testSeriesApi.list({ p_page: 1, p_size: 100 }), []);
  const seriesListState = useRpc(listRequest, { immediate: st.startMethod === START_METHOD.DUPLICATE });
  const seriesList = useMemo(() => seriesListState.data?.rows || [], [seriesListState.data]);
  const [step, setStep] = useState("method");
  const [reached, setReached] = useState(() => new Set(["method"]));
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [modal, setModal] = useState(null); // {kind:'q'|'csv', testWid, qWid?}
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [dupSearch, setDupSearch] = useState("");
  const [langInput, setLangInput] = useState("");
  const [showWindows, setShowWindows] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [nameExists, setNameExists] = useState(false);
  const [requestError, setRequestError] = useState("");
  // {title, steps, active, failed, error, publish} while saving or after a failed save.
  const [progress, setProgress] = useState(null);
  const inFlight = useRef(false);   // blocks a second click before React re-renders

  useEffect(() => {
    const id = location.state?.seriesId;
    if (!id) return;
    testSeriesApi.get(id).then((series) => {
      if (!series?.wizard_state) return;
      // Drafts saved with the AI start (coming soon) restart the method step;
      // legacy objective / subjective questions move to the current types.
      const restored = normalizeWizardState({ ...initialWizardState(), ...series.wizard_state, id });
      setSt(!AI_ENABLED && restored.startMethod === START_METHOD.AI ? { ...restored, startMethod: "" } : restored);
    }).catch((error) => setRequestError(error.message));
  }, [location.state]);

  useEffect(() => {
    if (!st.name.trim()) {
      setNameExists(false);
      return undefined;
    }
    const timer = setTimeout(() => {
      testSeriesApi.nameExists(st.name.trim(), st.id).then(setNameExists).catch((error) => setRequestError(error.message));
    }, 300);
    return () => clearTimeout(timer);
  }, [st.name, st.id]);

  const ctx = useMemo(() => ({ existingSeries: seriesList, nameTaken: nameExists }), [seriesList, nameExists]);

  // Keep the admin on the page while a save is running.
  useEffect(() => {
    if (!saving) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [saving]);
  const steps = applicableSteps(st);
  const stepIdx = Math.max(0, steps.indexOf(step));
  const errs = stepErrors(step, st, ctx);
  const review = useMemo(() => validateWizard(st, ctx), [st, ctx]);
  const totalQuestions = st.tests.reduce((n, t) => n + t.questions.length, 0);
  const totalMarks = st.tests.reduce((n, t) => n + testTotalMarks(t), 0);
  const totalDuration = st.tests.reduce((n, t) => n + (Number(t.duration) || 0), 0);
  const dirty = !!(st.startMethod || st.name || st.tests.length);

  const patch = (p) => setSt((s) => ({ ...s, ...p }));
  const patchC = (p) => setSt((s) => ({ ...s, classification: { ...s.classification, ...p } }));
  const patchA = (p) => setSt((s) => ({ ...s, availability: { ...s.availability, ...p } }));
  const patchTest = (id, p) => setSt((s) => ({ ...s, tests: s.tests.map((t) => (t.wid === id ? { ...t, ...p } : t)) }));
  const patchQuestion = (tid, qid, p) => setSt((s) => ({ ...s, tests: s.tests.map((t) => (t.wid !== tid ? t : { ...t, questions: t.questions.map((q) => (q.wid === qid ? { ...q, ...p } : q)) })) }));

  const go = (key) => { setStep(key); setReached((r) => new Set([...r, key])); window.scrollTo?.({ top: 0 }); };
  const next = () => { if (errs.length === 0 && stepIdx < steps.length - 1) go(steps[stepIdx + 1]); };
  const back = () => { if (stepIdx > 0) setStep(steps[stepIdx - 1]); };

  // ---- starting-method handlers
  const chooseMethod = (key) => {
    if (key === START_METHOD.AI && !AI_ENABLED) return;   // AI-assisted outline is coming soon
    patch({ startMethod: key });
  };

  const loadDuplicate = (src) => {
    const subj = (src.classification && src.classification.subject) || mapSubject(src.subject);
    setSt((s) => ({
      ...s,
      sourceSeriesId: src.id,
      name: `${src.name} (Copy)`,
      about: src.about || (src.description ? `<p>${esc(src.description)}</p>` : ""),
      whoFor: src.whoFor || "",
      audience: src.audience || "",
      pricing: src.pricing,
      price: src.pricing === PRICING_TYPE.PAID ? String(src.price) : "",
      syllabus: src.syllabus || "",
      classification: { ...s.classification, ...(src.classification || {}), subject: subj, languages: (src.classification && src.classification.languages) || s.classification.languages },
      tests: src.tests.map((t) => ({
        ...emptyTest(t.name),
        instructions: t.instructions || "",
        duration: t.duration,
        passingPercent: t.totalMarks ? Math.round((t.passingMarks / t.totalMarks) * 100) : 40,
        attemptLimit: t.attemptLimit || 1,
        questions: t.questions.map(cloneQuestion),
      })),
    }));
  };

  const addQuestions = (testWid, qs) => setSt((s) => ({
    ...s,
    tests: s.tests.map((t) => {
      if (t.wid !== testWid) return t;
      const keys = new Set(t.questions.map(questionKey));
      const fresh = qs.filter((q) => { const k = questionKey(q); if (keys.has(k)) return false; keys.add(k); return true; });
      return { ...t, questions: [...t.questions, ...fresh] };
    }),
  }));
  // Used by the Source step: put questions in a named test (created on demand).
  const addToNamedTest = (name, qs) => {
    const existing = st.tests.find((t) => t.name === name);
    if (existing) { addQuestions(existing.wid, qs); return; }
    const t = emptyTest(name);
    const keys = new Set();
    t.questions = qs.filter((q) => { const k = questionKey(q); if (keys.has(k)) return false; keys.add(k); return true; });
    setSt((s) => ({ ...s, tests: [...s.tests, t] }));
  };
  const sourceTest = st.tests.find((t) => t.name === "Imported questions");
  const sourceKeys = new Set((sourceTest ? sourceTest.questions : []).map(questionKey));

  const applyOutline = (outline, cfg) => {
    setSt((s) => ({
      ...s,
      audience: s.audience || cfg.audience,
      classification: { ...s.classification, subject: s.classification.subject || mapSubject(cfg.subject) },
      tests: outline.map((o) => ({ ...emptyTest(o.name), duration: o.duration, plannedQuestions: o.questionCount, topics: o.topics })),
    }));
  };

  const moveItem = (arr, i, d) => { const n = [...arr]; const j = i + d; if (j < 0 || j >= n.length) return arr; [n[i], n[j]] = [n[j], n[i]]; return n; };
  const moveTest = (i, d) => setSt((s) => ({ ...s, tests: moveItem(s.tests, i, d) }));
  const moveQuestion = (tid, i, d) => setSt((s) => ({ ...s, tests: s.tests.map((t) => (t.wid === tid ? { ...t, questions: moveItem(t.questions, i, d) } : t)) }));
  const removeQuestion = (tid, qid) => setSt((s) => ({ ...s, tests: s.tests.map((t) => (t.wid === tid ? { ...t, questions: t.questions.filter((q) => q.wid !== qid) } : t)) }));
  const addTest = () => setSt((s) => ({ ...s, tests: [...s.tests, emptyTest(`Test ${s.tests.length + 1}`)] }));
  const removeTest = (id) => { setSt((s) => ({ ...s, tests: s.tests.filter((t) => t.wid !== id) })); setConfirmRemove(null); };
  const addLanguage = () => {
    const v = langInput.trim();
    if (!v) return;
    const exists = st.classification.languages.some((l) => l.toLowerCase() === v.toLowerCase());
    if (!exists) patchC({ languages: [...st.classification.languages, v.charAt(0).toUpperCase() + v.slice(1)] });
    setLangInput("");
  };

  // ---- save
  const publishLabel = publishActionLabel(portal, { origin: portal.kind }, st.availability.goLive === "schedule");
  // One RPC per click: save_wizard_draft (draft of a saved series) or
  // upsert_test_series_full (saves the questions and, for publish, validates
  // and publishes in the same transaction).
  const save = (publish) => {
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitted(true);
    setSaving(true);
    const draftOnly = !publish && !!st.id;
    const steps = saveSteps({ publish, scheduled: st.availability.goLive === "schedule", draftOnly, approval: publish && approval });
    const title = publish ? publishLabel : "Save as draft";
    setProgress({ title, steps, active: 0, failed: -1, error: "", publish });
    const payload = buildSeriesPayload(st, ctx, publish);
    const rpcPayload = {
      id: st.id || null,
      name: payload.name,
      about: payload.about,
      whoFor: payload.whoFor,
      audience: payload.audience,
      syllabus: payload.syllabus,
      startMethod: payload.startMethod,
      pricing: payload.pricing,
      price: String(payload.price ?? 0),
      buildDeadline: payload.buildDeadline,
      wizardState: st,
      classification: payload.classification,
      availability: {
        goLive: st.availability.goLive,
        goLiveAt: st.availability.goLiveAt,
        mode: st.availability.mode,
        openAt: st.availability.openAt,
        closeAt: st.availability.closeAt,
        monthlyLimited: st.availability.monthlyLimited,
        monthlyLimit: st.availability.monthlyLimit,
        accessLimited: st.availability.accessLimited,
        accessDays: st.availability.accessDays,
      },
      lateSubmissions: payload.lateSubmissions,
      tests: payload.tests.map((t) => ({
        name: t.name,
        instructions: t.instructions,
        duration: String(t.duration),
        passingPercent: String(t.passingPercent || 40),
        attemptLimit: String(t.attemptLimit || 1),
        window: t.window,
        plannedQuestions: String(t.plannedQuestions || t.questions.length),
        topics: t.topics || [],
        sections: [],
        questions: t.questions.map((q, index) => ({
          ...questionPayload(q),
          answerInstructions: q.answerInstructions || "",
          sectionPosition: "",
          position: index + 1,
        })),
      })),
    };
    const stopTimer = startTimer(`wizard ${publish ? "publish" : "save draft"} (${rpcPayload.tests.length} tests, ${totalQuestions} questions)`);
    // Submit for approval = save (not publish), then educator_submit_series_for_approval.
    // The saved id is kept so a retry updates the same series.
    let savedId = null;
    const saveRequest = draftOnly
      ? testSeriesApi.saveDraft(st.id, st)
      : publish && approval
        ? testSeriesApi.saveWizard(rpcPayload, false).then((id) => {
          savedId = id;
          setSt((s) => ({ ...s, id }));
          return testSeriesApi.submitForApproval(id).then(() => id);
        })
        : testSeriesApi.saveWizard(rpcPayload, publish);
    saveRequest
      .then((id) => {
        setProgress((p) => p && { ...p, active: p.steps.length });
        const msg = !publish ? "Test series saved as draft."
          : approval ? "Submitted for approval. An admin will review it before it goes live."
          : st.availability.goLive === "schedule" ? "Test series scheduled for go-live." : "Test series published.";
        navigate(portal.basePath, { state: { toast: msg, seriesId: id } });
      })
      .catch((error) => {
        const message = savedId && error?.code
          ? `${error.message} Your series is saved as a draft: fix this and submit it again.`
          : saveErrorMessage(error);
        setProgress((p) => p && { ...p, failed: failedStepIndex(error, p.steps), error: message });
      })
      .finally(() => {
        stopTimer();
        inFlight.current = false;
        setSaving(false);
      });
  };
  // Discard everything entered and go back to the wizard's Start step.
  const discardAndRestart = () => {
    if (st.id) {
      testSeriesApi.discardDraft(st.id).catch((error) => setRequestError(error.message));
    }
    setSt(initialWizardState());
    setStep("method");
    setReached(new Set(["method"]));
    setModal(null);
    setConfirmRemove(null);
    setDupSearch("");
    setLangInput("");
    setShowWindows(false);
    setSubmitted(false);
    setLeaveOpen(false);
    window.scrollTo({ top: 0 });
  };
  const leave = () => {
    if (saving) return;
    if (dirty && !submitted) setLeaveOpen(true); else navigate(portal.basePath);
  };

  const languageChoices = [...BASE_LANGUAGES, ...st.classification.languages.filter((l) => !BASE_LANGUAGES.includes(l))];
  const [sourceTitle, sourceSub] = SOURCE_TITLE[st.startMethod] || ["", ""];
  const dupList = seriesList.filter((s) => s.name.toLowerCase().includes(dupSearch.toLowerCase()));

  return (
    <div className="ul-tsw">
      <div className="ul-tsw-top">
        <button type="button" className="ul-btn ul-btn--ghost" onClick={leave} disabled={saving}>
          <span className="ul-tsw-inline"><IconChevronLeft size={13} /> Test Series</span>
        </button>
        <div>
          <h2 className="ul-tsw-title">Create Test Series</h2>
          <p className="ul-tsw-sub">Follow the steps below. You can go back at any time without losing what you entered.</p>
        </div>
      </div>

      <ol className="ul-tsw-steps" aria-label="Progress">
        {steps.map((k, i) => {
          const done = i < stepIdx;
          const clickable = reached.has(k) && k !== step;
          return (
            <li key={k} className={`ul-tsw-stepi${k === step ? " is-current" : ""}${done ? " is-done" : ""}`}>
              <button type="button" disabled={!clickable || saving} onClick={() => setStep(k)}>
                <span className="ul-tsw-stepi__n">{done ? <IconCheck size={12} /> : i + 1}</span>
                <span className="ul-tsw-stepi__l">{k === "source" ? (SOURCE_TITLE[st.startMethod] ? { duplicate: "Choose series", csv: "Import", ai: "AI outline" }[st.startMethod] : "Source") : STEP_LABEL[k]}</span>
              </button>
            </li>
          );
        })}
      </ol>

      <div className="ul-card ul-tsw-panel">
        <span className="ul-tsw-eyebrow">Step {stepIdx + 1} of {steps.length}</span>
        {requestError && <div className="ul-tsw-note" role="alert">{requestError}</div>}
        {nameExists && <div className="ul-tsw-note" role="alert">A test series with this name already exists.</div>}

        {step === "method" && (
          <>
            <h3>How would you like to start?</h3>
            <p className="ul-tsw-lead">Each option leads to its own setup in the next step.</p>
            <div className="ul-tsw-grid-3">
              {METHOD_CARDS.filter((c) => !c.hidden).map(({ hidden, ...c }) => <OptionCard key={c.key} {...c} selected={st.startMethod === c.key} onClick={() => chooseMethod(c.key)} />)}
            </div>
          </>
        )}

        {step === "source" && (
          <>
            <h3>{sourceTitle}</h3>
            <p className="ul-tsw-lead">{sourceSub}</p>

            {st.startMethod === START_METHOD.DUPLICATE && (
              <div className="ul-tsw-stack">
                <div className="ul-tsw-note"><strong>This creates a new, independent copy.</strong> Changes you make here never affect the original series.</div>
                <div className="ul-tsw-search"><input value={dupSearch} onChange={(e) => setDupSearch(e.target.value)} placeholder="Search series by name" /></div>
                <div className="ul-tsw-banklist">
                  {dupList.length === 0 && <p className="ul-tsw-empty">No series found.</p>}
                  {dupList.map((s) => {
                    const qn = s.tests.reduce((n, t) => n + t.questions.length, 0);
                    const sel = st.sourceSeriesId === s.id;
                    return (
                      <button key={s.id} type="button" className={`ul-tsw-bankitem ul-tsw-pick${sel ? " is-picked" : ""}`} onClick={() => loadDuplicate(s)} aria-pressed={sel}>
                        <span className="ul-tsw-opt__radio">{sel && <IconCheck size={12} />}</span>
                        <div><p>{s.name}</p><small>{s.subject} · {s.tests.length} test{s.tests.length === 1 ? "" : "s"} · {qn} question{qn === 1 ? "" : "s"} · {s.status}</small></div>
                      </button>
                    );
                  })}
                </div>
                {st.sourceSeriesId && <div className="ul-tsw-note is-ok">Copied {st.tests.length} test(s) and {totalQuestions} question(s) into a new series. You can edit everything in the next steps.</div>}
              </div>
            )}

            {st.startMethod === START_METHOD.CSV && (
              <>
                <CsvImporter existingKeys={sourceKeys} onImport={(qs) => addToNamedTest("Imported questions", qs)} />
                {totalQuestions > 0 && <div className="ul-tsw-note is-ok" style={{ marginTop: 14 }}>{totalQuestions} question{totalQuestions === 1 ? "" : "s"} ready in “Imported questions”.</div>}
              </>
            )}

            {AI_ENABLED && st.startMethod === START_METHOD.AI && (
              <>
                <OutlineBuilder initialSubject="" initialAudience={st.audience} audienceOptions={AUDIENCE_OPTIONS} onApply={applyOutline} />
                {st.tests.length > 0 && <div className="ul-tsw-note is-ok" style={{ marginTop: 14 }}>{st.tests.length} draft test(s) created from the outline. Continue to configure them and add questions.</div>}
              </>
            )}
            <Errors list={errs} />
          </>
        )}

        {step === "details" && (
          <>
            <h3>Configure your test series</h3>
            <p className="ul-tsw-lead">Standalone series — set its own audience, syllabus, pricing and availability.</p>
            <div className="ul-ts-form">
              <div className="ul-ts-form-row">
                <label>Test series name</label>
                <input type="text" value={st.name} maxLength={120} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. JEE Main Physics Test Series 2026" />
              </div>
              <div className="ul-ts-form-row">
                <label>About this test series</label>
                <RichText value={st.about} onChange={(v) => patch({ about: v })} placeholder="Describe what’s inside, how it’s structured and what students will gain…" />
              </div>
              <div className="ul-ts-form-row">
                <label>Who it’s for</label>
                <textarea value={st.whoFor} onChange={(e) => patch({ whoFor: e.target.value })} placeholder="e.g. Class 12 students preparing for JEE Main who want exam-pattern practice." />
              </div>
              <div className="ul-ts-form-row">
                <label>Target audience / level</label>
                <select value={st.audience} onChange={(e) => patch({ audience: e.target.value })}>
                  <option value="">Select audience…</option>
                  {AUDIENCE_OPTIONS.map((a) => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div className="ul-ts-form-row">
                <label>Syllabus (optional)</label>
                <textarea value={st.syllabus} onChange={(e) => patch({ syllabus: e.target.value })} placeholder="List the chapters or topics this series covers" />
              </div>
              <div className="ul-ts-form-row">
                <label>Free or paid</label>
                <div className="ul-ts-pill-toggle">
                  {Object.values(PRICING_TYPE).map((p) => <button key={p} type="button" className={st.pricing === p ? "is-active" : ""} onClick={() => patch({ pricing: p })}>{PRICING_TYPE_LABEL[p]}</button>)}
                </div>
              </div>
              {st.pricing === PRICING_TYPE.PAID && (
                <div className="ul-ts-form-row">
                  <label>Price (₹)</label>
                  <input type="number" min="0" value={st.price} onChange={(e) => patch({ price: e.target.value })} placeholder="e.g. 999" />
                </div>
              )}
            </div>
            <Errors list={errs} />
          </>
        )}

        {step === "structure" && (
          <>
            <h3>Build the structure</h3>
            <p className="ul-tsw-lead">Add tests, then add, import or pick questions for each one.</p>
            <div className="ul-tsw-row">
              <button type="button" className="ul-btn ul-btn--primary" onClick={addTest}><span className="ul-tsw-inline"><IconPlus size={13} /> Add test</span></button>
              <span className="ul-tsw-spacer" />
              <span className="ul-tsw-count">{st.tests.length} test(s) · {totalQuestions} question(s) · {totalMarks} marks</span>
            </div>
            <div className="ul-tsw-stack" style={{ marginTop: 14 }}>
              {st.tests.length === 0 && <p className="ul-tsw-empty">No tests yet. Add your first test.</p>}
              {st.tests.map((t, ti) => (
                <div key={t.wid} className="ul-tsw-testcard">
                  <div className="ul-tsw-testcard__head">
                    <span className="ul-tsw-num">{ti + 1}</span>
                    <input value={t.name} onChange={(e) => patchTest(t.wid, { name: e.target.value })} placeholder="Test name" aria-label="Test name" />
                    <button type="button" className="ul-tsw-iconbtn" disabled={ti === 0} onClick={() => moveTest(ti, -1)} aria-label="Move test up">↑</button>
                    <button type="button" className="ul-tsw-iconbtn" disabled={ti === st.tests.length - 1} onClick={() => moveTest(ti, 1)} aria-label="Move test down">↓</button>
                    {confirmRemove === t.wid ? (
                      <>
                        <button type="button" className="ul-btn ul-btn--danger" onClick={() => removeTest(t.wid)}>Confirm remove</button>
                        <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setConfirmRemove(null)}>Keep</button>
                      </>
                    ) : (
                      <button type="button" className="ul-tsw-iconbtn" onClick={() => (t.questions.length ? setConfirmRemove(t.wid) : removeTest(t.wid))} aria-label="Remove test"><IconClose size={14} /></button>
                    )}
                  </div>
                  <div className="ul-tsw-testgrid">
                    <div className="ul-ts-form-row"><label>Duration (min)</label><input type="number" min="1" value={t.duration} onChange={(e) => patchTest(t.wid, { duration: e.target.value })} /></div>
                    <div className="ul-ts-form-row"><label>Passing %</label><input type="number" min="0" max="100" value={t.passingPercent} onChange={(e) => patchTest(t.wid, { passingPercent: e.target.value })} /></div>
                    <div className="ul-ts-form-row"><label>Attempts allowed</label><input type="number" min="1" value={t.attemptLimit} onChange={(e) => patchTest(t.wid, { attemptLimit: e.target.value })} /></div>
                    <div className="ul-ts-form-row"><label>Topics</label><input value={t.topics.join(", ")} onChange={(e) => patchTest(t.wid, { topics: e.target.value.split(",").map((x) => x.trim()).filter(Boolean) })} placeholder="comma separated" /></div>
                  </div>
                  <p className="ul-tsw-testsum">
                    {t.questions.length} question{t.questions.length === 1 ? "" : "s"} · {testTotalMarks(t)} marks
                    {t.plannedQuestions > 0 && <> · planned {t.plannedQuestions}{t.questions.length < t.plannedQuestions ? ` (${t.plannedQuestions - t.questions.length} to go)` : " ✓"}</>}
                  </p>
                  {t.questions.length > 0 && (
                    <div className="ul-tsw-qlist">
                      {t.questions.map((q, qi) => (
                        <div key={q.wid} className="ul-tsw-qrow">
                          <span className="ul-tsw-num">{qi + 1}</span>
                          <span className="ul-tsw-clip">{q.text || <em>(no text)</em>}</span>
                          <span className="ul-tsw-qmeta">{questionTypeLabel(q.type)}{isBlockedQuestionType(q.type) && <> <ComingSoonBadge label="Remove: coming soon" /></>} · {DIFFICULTY_LABEL[q.difficulty]} · {q.marks}m</span>
                          <button type="button" className="ul-tsw-iconbtn" onClick={() => setModal({ kind: "q", testWid: t.wid, qWid: q.wid })} aria-label="Edit question"><IconEdit size={13} /></button>
                          <button type="button" className="ul-tsw-iconbtn" disabled={qi === 0} onClick={() => moveQuestion(t.wid, qi, -1)} aria-label="Move up">↑</button>
                          <button type="button" className="ul-tsw-iconbtn" disabled={qi === t.questions.length - 1} onClick={() => moveQuestion(t.wid, qi, 1)} aria-label="Move down">↓</button>
                          <button type="button" className="ul-tsw-iconbtn" onClick={() => removeQuestion(t.wid, q.wid)} aria-label="Remove question"><IconClose size={13} /></button>
                        </div>
                      ))}
                    </div>
                  )}
                  <div className="ul-tsw-row">
                    <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setModal({ kind: "q", testWid: t.wid, qWid: null })}>+ Add question</button>
                    <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setModal({ kind: "csv", testWid: t.wid })}>Import CSV</button>
                  </div>
                </div>
              ))}
            </div>
            <Errors list={errs} />
          </>
        )}

        {step === "classification" && (
          <>
            <h3>Tags students can filter by</h3>
            <p className="ul-tsw-lead">Classification used to organise and find this series.</p>
            <div className="ul-tsw-fields">
              <div><label className="ul-tsw-flabel">Class / Grade</label><Chips options={GRADE_OPTIONS} value={st.classification.grade} onChange={(v) => patchC({ grade: v })} /></div>
              <div><label className="ul-tsw-flabel">Subject</label><Chips options={CLASS_SUBJECT_OPTIONS} value={st.classification.subject} onChange={(v) => patchC({ subject: v })} /></div>
              <div><label className="ul-tsw-flabel">Exam / Goal</label><Chips options={EXAM_OPTIONS} value={st.classification.exam} onChange={(v) => patchC({ exam: v })} /></div>
              <div>
                <label className="ul-tsw-flabel">Test type</label>
                <span className="ul-tsw-chip is-static is-lilac">{derivedTestType(st.tests)}</span>
                <small className="ul-tsw-hint" style={{ display: "block", marginTop: 6 }}>Read-only: taken from the structure you built.</small>
              </div>
              <div>
                <label className="ul-tsw-flabel">Difficulty</label>
                <div className="ul-ts-pill-toggle">
                  {LEVEL_OPTIONS.map((l) => <button key={l} type="button" className={st.classification.difficulty === l ? "is-active" : ""} onClick={() => patchC({ difficulty: l })}>{l}</button>)}
                </div>
              </div>
              <div>
                <label className="ul-tsw-flabel">Language</label>
                <Chips multi options={languageChoices} value={st.classification.languages} onChange={(v) => patchC({ languages: v })} />
                <div className="ul-tsw-row" style={{ marginTop: 10 }}>
                  <input className="ul-tsw-input" value={langInput} onChange={(e) => setLangInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addLanguage(); } }} placeholder="Add another language…" />
                  <button type="button" className="ul-btn ul-btn--ghost" disabled={!langInput.trim()} onClick={addLanguage}>+ Add</button>
                </div>
              </div>
            </div>
            <Errors list={errs} />
          </>
        )}

        {step === "availability" && (
          <>
            <h3>Deadlines and availability</h3>
            <p className="ul-tsw-lead">When you need to finish building, when students can start and when they have to stop.</p>
            <div className="ul-tsw-sections">
              <section>
                <h4>1. Build deadline</h4><small>Optional. A target date to finish building this series.</small>
                <input className="ul-tsw-input" type="date" value={st.buildDeadline} onChange={(e) => patch({ buildDeadline: e.target.value })} />
              </section>
              <section>
                <h4>2. Publishing</h4><small>Publishing makes the series visible. Scheduling holds it back until the go-live time.</small>
                <div className="ul-ts-pill-toggle">
                  <button type="button" className={st.availability.goLive === "now" ? "is-active" : ""} onClick={() => patchA({ goLive: "now" })}>Publish now</button>
                  <button type="button" className={st.availability.goLive === "schedule" ? "is-active" : ""} onClick={() => patchA({ goLive: "schedule" })}>Schedule go-live</button>
                </div>
                {st.availability.goLive === "schedule" && <input className="ul-tsw-input" type="datetime-local" value={st.availability.goLiveAt} onChange={(e) => patchA({ goLiveAt: e.target.value })} />}
              </section>
              <section>
                <h4>3. Student availability window</h4><small>When students can take the tests.</small>
                <div className="ul-ts-pill-toggle">
                  <button type="button" className={st.availability.mode === "always" ? "is-active" : ""} onClick={() => patchA({ mode: "always" })}>Always open</button>
                  <button type="button" className={st.availability.mode === "window" ? "is-active" : ""} onClick={() => patchA({ mode: "window" })}>Open &amp; close dates</button>
                </div>
                {st.availability.mode === "window" && (
                  <div className="ul-ts-form-grid-2">
                    <div className="ul-ts-form-row"><label>Opens</label><input type="date" value={st.availability.openAt} onChange={(e) => patchA({ openAt: e.target.value })} /></div>
                    <div className="ul-ts-form-row"><label>Closes</label><input type="date" value={st.availability.closeAt} onChange={(e) => patchA({ closeAt: e.target.value })} /></div>
                  </div>
                )}
              </section>
              <section>
                <h4>4. Monthly access limit</h4><small>How many tests from this series one student can access in a calendar month. Resets on the 1st of every month.</small>
                <div className="ul-ts-pill-toggle">
                  <button type="button" className={!st.availability.monthlyLimited ? "is-active" : ""} onClick={() => patchA({ monthlyLimited: false })}>Unlimited</button>
                  <button type="button" className={st.availability.monthlyLimited ? "is-active" : ""} onClick={() => patchA({ monthlyLimited: true })}>Set a limit</button>
                </div>
                {st.availability.monthlyLimited && (
                  <div className="ul-ts-form-row">
                    <label>Tests per student per month</label>
                    <input type="number" min="1" step="1" value={st.availability.monthlyLimit} onChange={(e) => patchA({ monthlyLimit: e.target.value === "" ? "" : Number(e.target.value) })} />
                  </div>
                )}
              </section>
              <section>
                <h4>5. Days of access</h4><small>How long a student keeps access to this series after joining or buying it.</small>
                <div className="ul-ts-pill-toggle">
                  <button type="button" className={!st.availability.accessLimited ? "is-active" : ""} onClick={() => patchA({ accessLimited: false })}>Lifetime</button>
                  <button type="button" className={st.availability.accessLimited ? "is-active" : ""} onClick={() => patchA({ accessLimited: true })}>Limited days</button>
                </div>
                {st.availability.accessLimited && (
                  <div className="ul-ts-form-row">
                    <label>Days of access</label>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <input type="number" min="1" step="1" value={st.availability.accessDays} onChange={(e) => patchA({ accessDays: e.target.value === "" ? "" : Number(e.target.value) })} style={{ maxWidth: 120 }} />
                      {[30, 90, 180, 365].map((n) => <button key={n} type="button" className={`ul-btn ul-btn--ghost${Number(st.availability.accessDays) === n ? " is-active" : ""}`} onClick={() => patchA({ accessDays: n })}>{n} days</button>)}
                    </div>
                  </div>
                )}
              </section>
              <section>
                <h4>6. Per-test windows</h4><small>Each test inherits the series window unless you give it its own.</small>
                <div><button type="button" className="ul-btn ul-btn--ghost" onClick={() => setShowWindows((v) => !v)}>
                  Customize per-test windows ({st.tests.filter((t) => t.window.mode === "custom").length} custom) {showWindows ? "▴" : "▾"}
                </button></div>
                {showWindows && (
                  <div className="ul-tsw-stack">
                    {st.tests.length === 0 && <p className="ul-tsw-empty">Add tests first.</p>}
                    {st.tests.map((t) => (
                      <div key={t.wid} className="ul-tsw-winrow">
                        <strong>{t.name || "Untitled test"}</strong>
                        <div className="ul-ts-pill-toggle">
                          <button type="button" className={t.window.mode === "inherit" ? "is-active" : ""} onClick={() => patchTest(t.wid, { window: { ...t.window, mode: "inherit" } })}>Inherit</button>
                          <button type="button" className={t.window.mode === "custom" ? "is-active" : ""} onClick={() => patchTest(t.wid, { window: { ...t.window, mode: "custom" } })}>Custom</button>
                        </div>
                        {t.window.mode === "custom" && (
                          <div className="ul-ts-form-grid-2">
                            <div className="ul-ts-form-row"><label>Opens</label><input type="datetime-local" value={t.window.openAt} onChange={(e) => patchTest(t.wid, { window: { ...t.window, openAt: e.target.value } })} /></div>
                            <div className="ul-ts-form-row"><label>Closes</label><input type="datetime-local" value={t.window.closeAt} onChange={(e) => patchTest(t.wid, { window: { ...t.window, closeAt: e.target.value } })} /></div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </section>
              <section>
                <h4>7. Late submissions</h4><small>What happens when a learner submits after the test window closes.</small>
                <div className="ul-ts-pill-toggle">
                  <button type="button" className={!st.lateSubmissions.allowed ? "is-active" : ""} onClick={() => patch({ lateSubmissions: { ...st.lateSubmissions, allowed: false } })}>Not allowed</button>
                  <button type="button" className={st.lateSubmissions.allowed ? "is-active" : ""} onClick={() => patch({ lateSubmissions: { ...st.lateSubmissions, allowed: true } })}>Allow with grace period</button>
                </div>
                {st.lateSubmissions.allowed && (
                  <div className="ul-ts-form-row" style={{ maxWidth: 220 }}>
                    <label>Grace period (minutes)</label>
                    <input type="number" min="1" value={st.lateSubmissions.graceMinutes} onChange={(e) => patch({ lateSubmissions: { ...st.lateSubmissions, graceMinutes: e.target.value } })} />
                  </div>
                )}
              </section>
            </div>
            <Errors list={errs} />
          </>
        )}

        {step === "review" && (
          <>
            <h3>Review &amp; publish</h3>
            <p className="ul-tsw-lead">Check everything below. Fix problems by stepping back — your entries are kept.</p>

            {review.errors.length > 0 && (
              <div className="ul-ts-errors"><strong>Fix these before publishing:</strong><ul>{review.errors.map((e) => <li key={e}>{e}</li>)}</ul></div>
            )}
            {review.warnings.length > 0 && (
              <div className="ul-tsw-warn"><strong>Warnings</strong><ul>{review.warnings.map((e) => <li key={e}>{e}</li>)}</ul></div>
            )}

            <div className="ul-tsw-checks">
              {review.checks.map((c) => (
                <div key={c.label} className={`ul-tsw-check-item${c.ok ? " is-ok" : " is-bad"}`}>
                  <span>{c.ok ? <IconCheck size={13} /> : <IconAlert size={13} />}</span>
                  <div><strong>{c.label}</strong><small>{c.detail}</small></div>
                </div>
              ))}
            </div>

            <div className="ul-tsw-preview">
              <h4>Final preview</h4>
              <h2>{st.name || "Untitled test series"}</h2>
              {st.about && <div className="ul-tsw-previewabout" dangerouslySetInnerHTML={{ __html: sanitizeHtml(st.about) }} />}
              <dl>
                <div><dt>Offered as</dt><dd>Standalone test series</dd></div>
                <div><dt>Audience</dt><dd>{st.audience || "—"}{st.whoFor ? ` — ${stripHtml(st.whoFor)}` : ""}</dd></div>
                <div><dt>Subject</dt><dd>{st.classification.subject || "—"}</dd></div>
                <div><dt>Class / Grade</dt><dd>{st.classification.grade || "—"}</dd></div>
                <div><dt>Exam / Goal</dt><dd>{st.classification.exam || "—"}</dd></div>
                <div><dt>Difficulty</dt><dd>{st.classification.difficulty || "—"}</dd></div>
                <div><dt>Language</dt><dd>{st.classification.languages.join(", ") || "—"}</dd></div>
                <div><dt>Tests</dt><dd>{st.tests.length}</dd></div>
                <div><dt>Questions</dt><dd>{totalQuestions}</dd></div>
                <div><dt>Total marks</dt><dd>{totalMarks}</dd></div>
                <div><dt>Total duration</dt><dd>{totalDuration} min</dd></div>
                <div><dt>Pricing</dt><dd>{st.pricing === PRICING_TYPE.PAID ? money(st.price) : "Free"}</dd></div>
                <div><dt>Publishing</dt><dd>{st.availability.goLive === "schedule" ? `Scheduled — ${st.availability.goLiveAt ? new Date(st.availability.goLiveAt).toLocaleString() : "no time set"}` : "Publish now"}</dd></div>
                <div><dt>Student availability</dt><dd>{st.availability.mode === "always" ? "Always open" : `${st.availability.openAt || "?"} to ${st.availability.closeAt || "?"}`}</dd></div>
                <div><dt>Days of access</dt><dd>{st.availability.accessLimited ? `${st.availability.accessDays || "?"} days` : "Lifetime"}</dd></div>
                <div><dt>Monthly access limit</dt><dd>{st.availability.monthlyLimited ? `${st.availability.monthlyLimit || "?"} test(s) per student per month` : "Unlimited"}</dd></div>
                <div><dt>Late submissions</dt><dd>{st.lateSubmissions.allowed ? `Allowed (${st.lateSubmissions.graceMinutes} min grace)` : "Not allowed"}</dd></div>
                {st.buildDeadline && <div><dt>Build deadline</dt><dd>{st.buildDeadline}</dd></div>}
              </dl>
            </div>
          </>
        )}
      </div>

      <div className="ul-tsw-footer">
        {progress && (
          <SaveProgress
            {...progress}
            running={saving}
            onRetry={() => save(progress.publish)}
            onDismiss={() => setProgress(null)}
          />
        )}
        <button type="button" className="ul-btn ul-btn--ghost" onClick={back} disabled={stepIdx === 0 || saving}>
          <span className="ul-tsw-inline"><IconChevronLeft size={13} /> Back</span>
        </button>
        <span className="ul-tsw-spacer" />
        {stepIdx >= steps.indexOf("details") && steps.includes("details") && (
          <button type="button" className="ul-btn ul-btn--ghost" disabled={review.draftErrors.length > 0 || saving} aria-busy={saving && !progress?.publish} title={review.draftErrors[0] || ""} onClick={() => save(false)}>{saving && !progress?.publish ? "Saving…" : "Save as draft"}</button>
        )}
        {step !== "review" ? (
          <button type="button" className="ul-btn ul-btn--primary" disabled={errs.length > 0} onClick={next}>
            <span className="ul-tsw-inline">Continue <IconChevronRight size={13} /></span>
          </button>
        ) : (
          <button type="button" className="ul-btn ul-btn--primary" disabled={review.errors.length > 0 || saving} aria-busy={saving && !!progress?.publish} onClick={() => save(true)}>{saving && progress?.publish ? (approval ? "Submitting…" : st.availability.goLive === "schedule" ? "Scheduling…" : "Publishing…") : publishLabel}</button>
        )}
      </div>

      {modal && modal.kind === "q" && (() => {
        const t = st.tests.find((x) => x.wid === modal.testWid);
        const existing = t && modal.qWid ? t.questions.find((q) => q.wid === modal.qWid) : null;
        return (
          <QuestionEditor
            initial={existing}
            defaults={{ subject: st.classification.subject, topic: (t && t.topics[0]) || "" }}
            onClose={() => setModal(null)}
            onSave={(q) => {
              if (existing) patchQuestion(modal.testWid, modal.qWid, q); else addQuestions(modal.testWid, [{ ...q, wid: wid("wq") }]);
              setModal(null);
            }}
          />
        );
      })()}
      {modal && modal.kind === "csv" && (() => {
        const t = st.tests.find((x) => x.wid === modal.testWid);
        return (
          <WizModal wide title="Import questions from CSV" subtitle={t ? `Adding to: ${t.name}` : ""} onClose={() => setModal(null)}>
            <CsvImporter existingKeys={new Set((t ? t.questions : []).map(questionKey))} onImport={(qs) => addQuestions(modal.testWid, qs)} />
          </WizModal>
        );
      })()}
      {leaveOpen && (
        <WizModal title="Leave without saving?" onClose={() => setLeaveOpen(false)}
          footer={<>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={() => setLeaveOpen(false)}>Keep editing</button>
            <button type="button" className="ul-btn ul-btn--danger" onClick={() => { setLeaveOpen(false); navigate(portal.basePath); }}>Discard &amp; leave</button>
          </>}>
          <p>Your entries on this page have not been saved yet.</p>
        </WizModal>
      )}
    </div>
  );
}
