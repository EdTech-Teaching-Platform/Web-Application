import { useEffect, useState } from "react";
import Button from "../../../components/ui/Button";
import Input from "../../../components/ui/Input";
import Modal from "../../../components/ui/Modal";
import EmptyState from "../../../components/ui/EmptyState";
import StatusBadge from "../../../components/ui/StatusBadge";
import { useMessaging, scheduledToForm } from "../context/MessagingContext";
import { AudienceChips, ChannelIcons, ConfirmDialog, TypePill } from "./BroadcastShared";
import { CalendarIcon, ClockIcon, PencilIcon, RepeatIcon, SendIcon, XIcon } from "../../../components/ui/icons";
import { audienceLabels, countdownLabel, formatDateTime, nowMs, resolveAudience, stripHtml, timezoneLabel } from "../data/messagingData";

function toParts(iso) {
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return { date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`, time: `${pad(d.getHours())}:${pad(d.getMinutes())}` };
}

export default function BroadcastScheduledTab({ env, onEdit, onGoCompose, onGoTab, onToast }) {
  const { scheduled, groups, rescheduleScheduled, cancelScheduled, sendScheduledNow } = useMessaging();
  const [, setTick] = useState(0);
  const [cancelId, setCancelId] = useState(null);
  const [sendId, setSendId] = useState(null);
  const [reschedId, setReschedId] = useState(null);
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const labelEnv = { ...env, groups };

  useEffect(() => {
    const t = window.setInterval(() => setTick((n) => n + 1), 30000);
    return () => window.clearInterval(t);
  }, []);

  const sorted = [...scheduled].sort((a, b) => a.scheduledFor.localeCompare(b.scheduledFor));
  const resched = scheduled.find((s) => s.id === reschedId);
  const newIso = date && time ? new Date(`${date}T${time}:00`).toISOString() : null;
  const reschedError = reschedId && (!newIso ? "Pick a date and time." : new Date(newIso).getTime() <= nowMs() ? "Pick a time in the future." : "");

  if (sorted.length === 0) {
    return <EmptyState icon={CalendarIcon} heading="Nothing scheduled" message="Schedule a message from Compose and it will wait here until it goes out." action={<Button fullWidth={false} className="px-6" onClick={onGoCompose}>Compose a message</Button>} />;
  }

  function startResched(s) {
    const p = toParts(s.scheduledFor);
    setDate(p.date);
    setTime(p.time);
    setReschedId(s.id);
  }

  function doSendNow() {
    const item = scheduled.find((s) => s.id === sendId);
    if (!item) return;
    const students = resolveAudience(item.audience, { ...env, groups });
    sendScheduledNow(item.id, students);
    setSendId(null);
    onToast(`Sent to ${students.length} student${students.length === 1 ? "" : "s"}.`);
  }

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      {sorted.map((s) => (
        <div key={s.id} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <TypePill type={s.type} />
              {s.priority === "Important" && <StatusBadge status="warning" size="sm" showIcon={false}>Important</StatusBadge>}
              {s.recurring && (
                <span className="inline-flex items-center gap-1 rounded-full bg-text/[0.06] px-2.5 py-1 text-[11px] font-semibold text-muted">
                  <RepeatIcon className="h-3 w-3" />
                  {s.recurring.frequency === "daily" ? "Daily" : "Weekly"} until {s.recurring.until}
                </span>
              )}
            </div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-pastel-orange px-3 py-1 text-xs font-semibold text-pastel-orange-ink">
              <ClockIcon className="h-3 w-3" />
              {countdownLabel(s.scheduledFor)}
            </span>
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-text">{s.subject}</p>
            <p className="mt-0.5 line-clamp-2 text-xs text-muted">{stripHtml(s.bodyHtml)}</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <AudienceChips labels={audienceLabels(s.audience, labelEnv)} max={2} />
            <ChannelIcons channels={s.channels} />
          </div>
          <p className="text-xs text-muted">
            {formatDateTime(s.scheduledFor)} · {timezoneLabel()}
          </p>
          <div className="mt-auto flex flex-wrap items-center gap-2 border-t border-text/[0.07] pt-3">
            <Button fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs" onClick={() => setSendId(s.id)}>
              <SendIcon className="h-3.5 w-3.5" />
              Send now
            </Button>
            <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs" onClick={() => onEdit(scheduledToForm(s))}>
              <PencilIcon className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs" onClick={() => startResched(s)}>
              <CalendarIcon className="h-3.5 w-3.5" />
              Reschedule
            </Button>
            <Button variant="tertiary" fullWidth={false} className="ml-auto flex items-center gap-1.5 px-3.5 py-1.5 text-xs text-danger hover:bg-danger/10" onClick={() => setCancelId(s.id)}>
              <XIcon className="h-3.5 w-3.5" />
              Cancel
            </Button>
          </div>
        </div>
      ))}

      <ConfirmDialog
        open={Boolean(cancelId)}
        heading="Cancel this scheduled message?"
        message="It won't be sent. A copy goes back to Drafts so nothing is lost."
        confirmLabel="Cancel schedule"
        onConfirm={() => { cancelScheduled(cancelId); setCancelId(null); onToast("Schedule cancelled. Moved to Drafts."); }}
        onClose={() => setCancelId(null)}
      />
      <ConfirmDialog
        open={Boolean(sendId)}
        heading="Send this right now?"
        message="It will go out immediately instead of at the scheduled time."
        confirmLabel="Send now"
        cancelLabel="Not yet"
        onConfirm={doSendNow}
        onClose={() => setSendId(null)}
      />
      <Modal
        open={Boolean(resched)}
        onClose={() => setReschedId(null)}
        title="Reschedule"
        size="sm"
        footer={
          <>
            <Button fullWidth={false} className="px-6" disabled={Boolean(reschedError)} onClick={() => { rescheduleScheduled(reschedId, newIso); setReschedId(null); onToast("Rescheduled."); }}>
              Save new time
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setReschedId(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <div className="grid grid-cols-2 gap-3">
          <Input label="Date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          <Input label="Time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <p className="mt-2 text-xs text-muted">Times are in {timezoneLabel()}.</p>
        {reschedError && <p role="alert" className="mt-1 text-xs font-medium text-danger">{reschedError}</p>}
      </Modal>
    </div>
  );
}
