// Question-type picker shared by the question editor (TestDetail) and the
// series wizard (TestSeriesWizardParts). Types that aren't available yet
// (short answer, long answer, subjective) are shown with a "Coming soon"
// badge and can't be selected.
import ComingSoonBadge from "./ComingSoonBadge";
import { QUESTION_TYPE_OPTIONS, OPTION_KEYS, QTYPE, TRUE_FALSE_OPTIONS, normalizeQuestionType } from "../data/questionTypes";

export default function QuestionTypePicker({ value, onChange, variant = "cards", label = "Question type" }) {
  const current = normalizeQuestionType(value);
  const pick = (opt) => {
    if (!opt.available) return;
    onChange(opt.value);
  };
  if (variant === "pills") {
    return (
      <div className="ul-ts-form-row">
        <label>{label}</label>
        <div className="ul-ts-pill-toggle ul-qtype-pills" role="radiogroup" aria-label={label}>
          {QUESTION_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              role="radio"
              aria-checked={current === opt.value}
              aria-disabled={!opt.available}
              disabled={!opt.available}
              title={opt.available ? opt.hint : "Coming soon"}
              className={`${current === opt.value ? "is-active" : ""}${opt.available ? "" : " is-disabled"}`}
              onClick={() => pick(opt)}
            >
              {opt.label}
              {!opt.available && <ComingSoonBadge />}
            </button>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="ul-td-type-choice" role="radiogroup" aria-label={label}>
      {QUESTION_TYPE_OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={current === opt.value}
          aria-disabled={!opt.available}
          disabled={!opt.available}
          className={`ul-td-type-card${current === opt.value ? " is-active" : ""}${opt.available ? "" : " is-disabled"}`}
          onClick={() => pick(opt)}
        >
          <strong>{opt.label} {!opt.available && <ComingSoonBadge />}</strong>
          <span>{opt.hint}</span>
        </button>
      ))}
    </div>
  );
}

// Type-specific answer fields: options + correct answer(s), True / False, or
// the accepted answer for fill in the blank. `q` uses the editor shape
// (optionA..D, correctAnswer, correctAnswers, acceptedAnswer).
export function QuestionAnswerFields({ q, onChange }) {
  const type = normalizeQuestionType(q.type);
  if (type === QTYPE.FILL_BLANK) {
    return (
      <div className="ul-ts-form-row">
        <label htmlFor="q-accepted-answer">Accepted answer</label>
        <input
          id="q-accepted-answer"
          type="text"
          value={q.acceptedAnswer || ""}
          onChange={(e) => onChange({ acceptedAnswer: e.target.value })}
          placeholder="e.g. Paris"
        />
        <span className="ul-tsw-hint">The student's typed answer must match this (case and extra spaces are ignored).</span>
      </div>
    );
  }
  if (type === QTYPE.TRUE_FALSE) {
    return (
      <div className="ul-ts-form-row">
        <label>Correct answer</label>
        <div className="ul-td-correct-toggle" role="radiogroup" aria-label="Correct answer">
          {TRUE_FALSE_OPTIONS.map((o) => (
            <button key={o.key} type="button" role="radio" aria-checked={q.correctAnswer === o.key}
              className={q.correctAnswer === o.key ? "is-active" : ""} onClick={() => onChange({ correctAnswer: o.key })}>
              {o.text}
            </button>
          ))}
        </div>
      </div>
    );
  }
  if (type !== QTYPE.MCQ_SINGLE && type !== QTYPE.MCQ_MULTI) return null;
  const multi = type === QTYPE.MCQ_MULTI;
  const picked = q.correctAnswers || [];
  return (
    <>
      <div className="ul-ts-form-grid-2">
        {OPTION_KEYS.map((k) => (
          <div className="ul-ts-form-row" key={k}>
            <label htmlFor={`q-option-${k}`}>Option {k}</label>
            <input id={`q-option-${k}`} type="text" value={q[`option${k}`] || ""} onChange={(e) => onChange({ [`option${k}`]: e.target.value })} />
          </div>
        ))}
      </div>
      <div className="ul-ts-form-row">
        <label>{multi ? "Correct answers (select all that apply)" : "Correct answer"}</label>
        <div className="ul-td-correct-toggle" role={multi ? "group" : "radiogroup"} aria-label={multi ? "Correct answers" : "Correct answer"}>
          {OPTION_KEYS.map((k) => {
            const on = multi ? picked.includes(k) : q.correctAnswer === k;
            return (
              <button
                key={k}
                type="button"
                role={multi ? "checkbox" : "radio"}
                aria-checked={on}
                className={on ? "is-active" : ""}
                onClick={() => onChange(multi
                  ? { correctAnswers: on ? picked.filter((x) => x !== k) : [...picked, k].sort() }
                  : { correctAnswer: k })}
              >
                {k}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
