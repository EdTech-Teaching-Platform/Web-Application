// Request-extension and decline modals for an assigned series. The educator can
// never delete an assigned series, only ask for more time or decline with a reason.
import { useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import { formatDate } from "../data/testSeriesData";
import { addDays, daysBetween, effectiveBuildDeadline, isIsoDate, MOCK_TODAY_ISO } from "../data/testSeriesDeadlines";

const MIN_REASON = 10;

function ReasonField({ label, value, onChange, touched, error, placeholder }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
      <textarea
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(touched && error)}
        className={`w-full rounded-2xl border bg-surface px-4 py-3 text-sm text-text outline-none transition-all duration-150 placeholder:text-muted/80 ${
          touched && error ? "border-danger focus:ring-2 focus:ring-danger/15" : "border-text/12 focus:border-primary focus:ring-2 focus:ring-primary/15"
        }`}
      />
      {touched && error && <span className="mt-1.5 block text-xs text-danger">{error}</span>}
    </label>
  );
}

export function ExtensionRequestModal({ open, series, onClose, onSubmit }) {
  const current = series ? effectiveBuildDeadline(series) : "";
  const earliest = addDays(current && current > MOCK_TODAY_ISO ? current : MOCK_TODAY_ISO, 1);
  const [date, setDate] = useState("");
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState({});
  const dateErr = !isIsoDate(date) ? "Pick the new deadline you need." : daysBetween(earliest, date) < 0 ? `The new date must be ${formatDate(earliest)} or later.` : "";
  const reasonErr = reason.trim().length < MIN_REASON ? `Tell the admin why (at least ${MIN_REASON} characters).` : "";
  const valid = !dateErr && !reasonErr;
  function close() {
    setDate("");
    setReason("");
    setTouched({});
    onClose();
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title="Request a deadline extension"
      footer={
        <>
          <Button
            fullWidth={false}
            className="px-6"
            disabled={!valid}
            onClick={() => {
              onSubmit({ newDate: date, reason: reason.trim() });
              close();
            }}
          >
            Send request
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={close}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-muted">
          "{series?.title}" is due {current ? formatDate(current) : "soon"}. The admin reviews extension requests; the deadline stays as it is until they approve.
        </p>
        <Input label="New deadline" type="date" min={earliest} value={date} onChange={(e) => setDate(e.target.value)} onBlur={() => setTouched((t) => ({ ...t, date: true }))} error={touched.date ? dateErr : undefined} shape="rect" />
        <ReasonField label="Reason" value={reason} onChange={(v) => { setReason(v); setTouched((t) => ({ ...t, reason: true })); }} touched={touched.reason} error={reasonErr} placeholder="e.g. I'm waiting on the final syllabus changes before writing the last two tests." />
      </div>
    </Modal>
  );
}

export function DeclineAssignmentModal({ open, series, onClose, onConfirm }) {
  const [reason, setReason] = useState("");
  const [touched, setTouched] = useState(false);
  const err = reason.trim().length < MIN_REASON ? `Tell the admin why (at least ${MIN_REASON} characters).` : "";
  function close() {
    setReason("");
    setTouched(false);
    onClose();
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title="Decline this assignment?"
      footer={
        <>
          <Button
            fullWidth={false}
            className="!bg-danger px-6 disabled:!bg-danger/35"
            disabled={Boolean(err)}
            onClick={() => {
              onConfirm(reason.trim());
              close();
            }}
          >
            Decline assignment
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={close}>
            Keep it
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 pb-2">
        <p className="text-sm text-muted">
          "{series?.title}" will move out of your queue and the admin will see your reason. Anything you've already drafted is kept, but you won't be able to publish it.
        </p>
        <ReasonField label="Reason for declining" value={reason} onChange={(v) => { setReason(v); setTouched(true); }} touched={touched} error={err} placeholder="e.g. This is outside my subject area." />
      </div>
    </Modal>
  );
}
