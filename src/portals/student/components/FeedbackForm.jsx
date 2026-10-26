// "Give feedback or report an issue" for a submitted attempt
// (student_submit_feedback), and the student's earlier submissions
// (student_my_feedback). Rules mirror the RPC: rating 1-5 for feedback,
// message 5-2000 characters, at most 5 per series per day (server-side).
import { useState } from "react";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import StatusBadge from "../../../components/ui/StatusBadge";
import { StarIcon } from "../../../components/ui/icons";
import { useStudentData } from "../hooks/useStudentData";
import { feedbackApi } from "../services/feedbackApi";
import { formatDate } from "../utils/format";
import { FEEDBACK_CATEGORIES, FEEDBACK_KINDS, FEEDBACK_STATUS, MESSAGE_MAX, validateFeedback } from "../utils/feedback";

function StarRating({ value, onChange }) {
  return (
    <div role="radiogroup" aria-label="Rating" className="flex gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={value === n}
          aria-label={`${n} star${n === 1 ? "" : "s"}`}
          onClick={() => onChange(n)}
          className={`grid h-10 w-10 place-items-center rounded-full transition-colors duration-150 ${n <= (value || 0) ? "text-primary" : "text-text/25 hover:text-text/50"}`}
        >
          <StarIcon className={`h-6 w-6 ${n <= (value || 0) ? "fill-current" : ""}`} />
        </button>
      ))}
    </div>
  );
}

export function FeedbackForm({ open, onClose, attemptId, questions = [], onSubmitted, api = feedbackApi }) {
  const [kind, setKind] = useState("feedback");
  const [rating, setRating] = useState(0);
  const [category, setCategory] = useState("");
  const [questionId, setQuestionId] = useState("");
  const [message, setMessage] = useState("");
  const [touched, setTouched] = useState(false);
  const [state, setState] = useState({ phase: "form", error: "" });   // form | sending | sent

  const errors = validateFeedback({ kind, rating, message });
  const valid = Object.keys(errors).length === 0;
  const length = message.trim().length;

  const reset = () => {
    setKind("feedback"); setRating(0); setCategory(""); setQuestionId(""); setMessage(""); setTouched(false);
    setState({ phase: "form", error: "" });
  };
  const close = () => { reset(); onClose?.(); };

  const submit = async (e) => {
    e?.preventDefault();
    setTouched(true);
    if (!valid || state.phase === "sending") return;
    setState({ phase: "sending", error: "" });
    try {
      const id = await api.submit({ attemptId, kind, rating, category, questionId, message: message.trim() });
      setState({ phase: "sent", error: "" });
      onSubmitted?.(id);
    } catch (err) {
      setState({ phase: "form", error: err?.message || "Couldn't send. Please try again." });
    }
  };

  if (state.phase === "sent") {
    return (
      <Modal open={open} onClose={close} title="Thanks, it's sent"
        footer={<Button onClick={close}>Done</Button>}>
        <p role="status" className="text-sm text-text/70">
          Our team will look at it. You can follow its status on the test series page.
        </p>
      </Modal>
    );
  }

  return (
    <Modal open={open} onClose={close} title="Give feedback or report an issue"
      footer={<>
        <Button type="submit" form="feedback-form" disabled={!valid || state.phase === "sending"}>
          {state.phase === "sending" ? "Sending…" : "Send"}
        </Button>
        <Button variant="secondary" onClick={close}>Cancel</Button>
      </>}>
      <form id="feedback-form" onSubmit={submit} noValidate className="space-y-4">
        {state.error && <p role="alert" className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{state.error}</p>}

        <fieldset>
          <legend className="mb-2 text-sm font-medium text-text">What would you like to send?</legend>
          <div className="grid gap-2" role="radiogroup" aria-label="Type">
            {FEEDBACK_KINDS.map((k) => (
              <label key={k.value} className={`flex cursor-pointer items-start gap-3 rounded-2xl px-3 py-2.5 ring-1 ${kind === k.value ? "bg-primary/5 ring-primary" : "ring-text/10"}`}>
                <input type="radio" name="feedback-kind" value={k.value} checked={kind === k.value} onChange={() => setKind(k.value)} className="mt-1 accent-[var(--color-primary)]" />
                <span><span className="block text-sm font-semibold text-text">{k.label}</span><span className="block text-xs text-text/60">{k.hint}</span></span>
              </label>
            ))}
          </div>
        </fieldset>

        {kind === "feedback" && (
          <div>
            <p className="mb-1 text-sm font-medium text-text">Rating</p>
            <StarRating value={rating} onChange={setRating} />
            {touched && errors.rating && <p className="mt-1 text-xs text-danger">{errors.rating}</p>}
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="feedback-category" className="mb-1 block text-sm font-medium text-text">Category (optional)</label>
            <select id="feedback-category" value={category} onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-full border border-text/15 bg-bg px-4 py-2.5 text-sm text-text">
              <option value="">None</option>
              {FEEDBACK_CATEGORIES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
            </select>
          </div>
          <div>
            <label htmlFor="feedback-question" className="mb-1 block text-sm font-medium text-text">Question (optional)</label>
            <select id="feedback-question" value={questionId} onChange={(e) => setQuestionId(e.target.value)}
              className="w-full rounded-full border border-text/15 bg-bg px-4 py-2.5 text-sm text-text">
              <option value="">Whole test</option>
              {questions.map((q) => (
                <option key={q.question_id} value={q.question_id}>
                  Q{q.position}. {String(q.text ?? "").slice(0, 50)}{String(q.text ?? "").length > 50 ? "…" : ""}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="feedback-message" className="mb-1 block text-sm font-medium text-text">Message</label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onBlur={() => setTouched(true)}
            maxLength={MESSAGE_MAX}
            rows={5}
            aria-invalid={Boolean(touched && errors.message)}
            aria-describedby="feedback-count"
            className="w-full rounded-2xl border border-text/15 bg-bg px-4 py-3 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
          <span className="mt-1 flex justify-between text-xs">
            <span className="text-danger">{touched && errors.message ? errors.message : ""}</span>
            <span id="feedback-count" className={length > MESSAGE_MAX ? "text-danger" : "text-text/50"}>{length} / {MESSAGE_MAX}</span>
          </span>
        </div>
      </form>
    </Modal>
  );
}

// Earlier submissions with their status and the admin's reply.
export function MyFeedbackList({ seriesId, api = feedbackApi, refreshKey = 0 }) {
  const { data, error, loading } = useStudentData(() => api.mine(seriesId), `${seriesId}|${refreshKey}`);
  if (loading || error || !data?.length) return null;
  return (
    <section aria-labelledby="my-feedback-title" className="space-y-3">
      <h2 id="my-feedback-title" className="font-display text-xl font-bold tracking-tight text-text">Your feedback</h2>
      <ul className="space-y-2">
        {data.map((f) => {
          const st = FEEDBACK_STATUS[f.status] ?? FEEDBACK_STATUS.new;
          return (
            <li key={f.id} className="rounded-2xl bg-white p-4 ring-1 ring-(--lp-line)">
              <div className="flex flex-wrap items-center gap-2 text-xs text-text/60">
                <span className="font-semibold text-text">{FEEDBACK_KINDS.find((k) => k.value === f.kind)?.label ?? f.kind}</span>
                {f.test_title && <span>· {f.test_title}{f.question_position ? ` · Q${f.question_position}` : ""}</span>}
                {f.rating && <span>· {"★".repeat(f.rating)}</span>}
                <span>· {formatDate(f.created_at)}</span>
                <span className="ml-auto"><StatusBadge status={st.tone}>{st.label}</StatusBadge></span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-text">{f.message}</p>
              {f.admin_note && (
                <p className="mt-2 rounded-xl bg-bg px-3 py-2 text-sm text-text/80"><strong>Reply:</strong> {f.admin_note}</p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default FeedbackForm;
