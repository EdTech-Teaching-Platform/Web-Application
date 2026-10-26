// Add / edit ONE question. Offers exactly what the admin question editor offers:
// Objective (MCQ with options A-D and one correct answer) or Subjective, question
// text, optional image, marks, negative marks (objective only), difficulty,
// subject, topic and an optional explanation (objective only).
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { AUTH_THEME_VARS } from "../../../auth/components/AuthKit";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import Button from "../../../components/ui/Button";
import Select from "../../../components/ui/Select";
import QuestionImageUpload from "./QuestionImageUpload";
import { XIcon } from "../../../components/ui/icons";
import { OPTION_KEYS, TS_Q_DIFFICULTIES, difficultyKey, difficultyLabel, htmlToPlain, isSubjective, makeId, plainToHtml, questionErrors } from "../data/testSeriesData";

const KIND_LABEL = { objective: "Objective (MCQ)", subjective: "Subjective" };
const field = "w-full rounded-2xl border border-text/12 bg-surface px-4 py-3 text-sm text-text outline-none transition-colors placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/15";

export function toEditorModel(q, defaults = {}) {
  if (!q) {
    return { kind: "objective", text: "", image: null, options: ["", "", "", ""], correct: "", rubric: "", marks: 4, negativeMarks: 1, difficulty: "Medium", subject: defaults.subject || "", topic: defaults.topic || "", explanation: "" };
  }
  const subj = isSubjective(q.type);
  const opts = subj ? [] : (q.options || []).slice(0, 4);
  const correctIdx = opts.findIndex((o) => o.correct);
  return {
    kind: subj ? "subjective" : "objective",
    text: htmlToPlain(q.text),
    image: q.image || null,
    options: [0, 1, 2, 3].map((i) => opts[i]?.text || ""),
    correct: correctIdx >= 0 ? OPTION_KEYS[correctIdx] : "",
    rubric: q.answerInstructions || "",
    marks: q.points ?? (subj ? 5 : 4),
    negativeMarks: q.negativeMarks ?? (subj ? 0 : 1),
    difficulty: difficultyLabel(q.difficulty),
    subject: q.subject || "",
    topic: q.topic || "",
    explanation: q.explanation || "",
  };
}

// Editor model -> stored question (keeps the shape the previews and grading read).
export function fromEditorModel(e, existing) {
  const base = {
    id: existing?.id || makeId("q"),
    text: plainToHtml(e.text),
    points: Number(e.marks),
    difficulty: difficultyKey(e.difficulty),
    subject: e.subject.trim(),
    topic: e.topic.trim(),
  };
  if (e.image) base.image = e.image;
  if (e.kind === "objective") {
    const prev = existing && !isSubjective(existing.type) ? existing.options || [] : [];
    return {
      ...base,
      type: "mcq_single",
      negativeMarks: Number(e.negativeMarks) || 0,
      explanation: e.explanation.trim(),
      options: OPTION_KEYS.map((k, i) => ({ id: prev[i]?.id || makeId("o"), text: e.options[i], correct: e.correct === k, ...(prev[i]?.image ? { image: prev[i].image } : {}) })),
    };
  }
  const prevSubj = existing && isSubjective(existing.type) ? existing : null;
  return {
    ...base,
    type: "long_answer",
    negativeMarks: 0,
    explanation: "",
    answerInstructions: e.rubric,
    modelAnswer: prevSubj?.modelAnswer || "",
    wordLimit: prevSubj?.wordLimit || 300,
    rubric: prevSubj?.rubric || [],
  };
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      {children}
    </label>
  );
}

export default function TestQuestionEditor({ initial, defaults, onSave, onClose }) {
  const [e, setE] = useState(() => toEditorModel(initial, defaults));
  const set = (patch) => setE((p) => ({ ...p, ...patch }));
  const obj = e.kind === "objective";
  const errs = questionErrors(fromEditorModel(e, initial));
  const switchKind = (label) => {
    const kind = label === KIND_LABEL.objective ? "objective" : "subjective";
    if (kind === e.kind) return;
    setE((p) => ({ ...p, kind, correct: kind === "objective" ? p.correct : "", negativeMarks: kind === "objective" ? p.negativeMarks : 0 }));
  };

  // Lock page scroll and close on Escape while the dialog is open.
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (ev) => ev.key === "Escape" && onClose?.();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [onClose]);

  // Portal to <body> so no transformed ancestor can break `fixed` positioning.
  return createPortal(
    <div style={AUTH_THEME_VARS} className="font-body fixed inset-0 z-[100] flex items-start justify-center overflow-y-auto px-4 py-8">
      <div className="fixed inset-0 bg-text/40" onClick={onClose} aria-hidden="true" />
      <div role="dialog" aria-modal="true" aria-label={initial ? "Edit question" : "Add question"} className="relative my-auto w-full max-w-2xl rounded-3xl bg-white p-6 shadow-xl sm:p-7">
        <div className="mb-5 flex items-center justify-between gap-4">
          <h2 className="font-display text-lg font-semibold text-text">{initial ? "Edit question" : "Add question"}</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-text/40 transition-colors hover:bg-bg hover:text-text">
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex flex-col gap-5">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Question type</span>
            <SegmentedControl options={Object.values(KIND_LABEL)} value={KIND_LABEL[e.kind]} onChange={switchKind} />
          </div>

          <Field label="Question">
            <textarea rows={3} className={field} value={e.text} onChange={(ev) => set({ text: ev.target.value })} placeholder="Type the question" />
          </Field>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Question image (optional)</span>
            <QuestionImageUpload image={e.image} onChange={(image) => set({ image })} />
          </div>

          {obj ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                {OPTION_KEYS.map((k, i) => (
                  <Field key={k} label={`Option ${k}`}>
                    <input type="text" className={field} value={e.options[i]} onChange={(ev) => set({ options: e.options.map((o, j) => (j === i ? ev.target.value : o)) })} />
                  </Field>
                ))}
              </div>
              <div>
                <span className="mb-1.5 block text-sm font-medium text-text">Correct answer</span>
                <SegmentedControl options={OPTION_KEYS} value={e.correct} onChange={(correct) => set({ correct })} />
              </div>
            </>
          ) : (
            <Field label="Answer instructions / rubric (optional)">
              <textarea rows={3} className={field} value={e.rubric} onChange={(ev) => set({ rubric: ev.target.value })} />
            </Field>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Marks">
              <input type="number" min="0" className={field} value={e.marks} onChange={(ev) => set({ marks: ev.target.value })} />
            </Field>
            {obj && (
              <Field label="Negative marks">
                <input type="number" min="0" className={field} value={e.negativeMarks} onChange={(ev) => set({ negativeMarks: ev.target.value })} />
              </Field>
            )}
            <Field label="Difficulty">
              <Select wrapperClassName="block w-full" value={e.difficulty} onChange={(ev) => set({ difficulty: ev.target.value })} className="w-full rounded-2xl border border-text/12 bg-surface px-4 py-3 pr-10 text-sm text-text">
                {TS_Q_DIFFICULTIES.map((d) => <option key={d} value={d}>{d}</option>)}
              </Select>
            </Field>
            <Field label="Subject">
              <input type="text" className={field} value={e.subject} onChange={(ev) => set({ subject: ev.target.value })} />
            </Field>
            <Field label="Topic">
              <input type="text" className={field} value={e.topic} onChange={(ev) => set({ topic: ev.target.value })} />
            </Field>
          </div>

          {obj && (
            <Field label="Explanation (optional)">
              <textarea rows={2} className={field} value={e.explanation} onChange={(ev) => set({ explanation: ev.target.value })} />
            </Field>
          )}
        </div>

        <div className="mt-6 flex flex-col-reverse items-stretch gap-3 sm:flex-row sm:items-center sm:justify-end">
          {errs.length > 0 && <span className="text-xs text-muted sm:mr-auto">{errs[0]}</span>}
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>Cancel</Button>
          <Button fullWidth={false} className="px-6" disabled={errs.length > 0} onClick={() => onSave(fromEditorModel(e, initial))}>Save question</Button>
        </div>
      </div>
    </div>,
    document.body
  );
}
