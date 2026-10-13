import { useState } from "react";
import Button from "../../../components/ui/Button";
import Select from "../../../components/ui/Select";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";

// StructuredResponseForm — the shared "respond to a request" form used by
// Mentorship applications and Session Requests. It is deliberately NOT a
// message: the educator picks a reason (required) and may add a private
// note; submitting updates the item's status and records the reason/note
// on the item itself, then shows a confirmation. Nothing is sent as a
// chat/thread.
export default function StructuredResponseForm({
  title,
  description,
  reasons,
  reasonLabel = "Reason",
  noteLabel = "Note (optional)",
  notePlaceholder = "Add context for your records…",
  submitLabel,
  submitTone = "primary",
  doneHeading,
  doneMessage,
  onSubmit,
  onBack,
  onDone,
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [touched, setTouched] = useState(false);
  const [done, setDone] = useState(false);

  const reasonError = touched && !reason ? "Choose a reason to continue." : "";

  function submit() {
    setTouched(true);
    if (!reason) return;
    onSubmit({ reason, note: note.trim() });
    setDone(true);
  }

  if (done) {
    return (
      <ConfirmationCard
        state="success"
        heading={doneHeading}
        message={doneMessage}
        primaryAction={
          <Button onClick={onDone}>
            Done
          </Button>
        }
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="text-sm font-semibold text-text">{title}</p>
        {description && <p className="mt-1 text-xs text-muted">{description}</p>}
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-text">{reasonLabel}</span>
        <Select
          wrapperClassName="block w-full"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          onBlur={() => setTouched(true)}
          aria-invalid={Boolean(reasonError)}
          className={`w-full rounded-xl border bg-bg px-3.5 py-2.5 pr-10 text-sm text-text ${reasonError ? "border-danger" : "border-text/15"}`}
        >
          <option value="">Select a reason…</option>
          {reasons.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </Select>
        {reasonError && <p role="alert" className="mt-1 text-xs font-medium text-danger">{reasonError}</p>}
      </div>
      <div>
        <span className="mb-1.5 block text-sm font-medium text-text">{noteLabel}</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value.slice(0, 300))}
          rows={4}
          placeholder={notePlaceholder}
          className="w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
        <p className="mt-1 text-right text-[11px] text-muted">{note.length}/300</p>
      </div>
      <div className="flex gap-2.5">
        <Button
          fullWidth
          disabled={!reason}
          className={submitTone === "danger" ? "border-danger bg-danger text-white hover:bg-danger/90 disabled:bg-danger/35" : ""}
          onClick={submit}
        >
          {submitLabel}
        </Button>
        <Button variant="secondary" fullWidth onClick={onBack}>
          Back
        </Button>
      </div>
    </div>
  );
}
