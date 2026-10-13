import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import Switch from "../../../components/ui/Switch";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import StatusBadge from "../../../components/ui/StatusBadge";
import HomeworkUploadPanel from "./HomeworkUploadPanel";
import MentorshipRoadmap from "./MentorshipRoadmap";
import { MENTORSHIP_STATUS_META } from "./MentorshipMenteeCard";
import { initials } from "../data/studentDirectory";
import { relativeDate } from "./CoursePortfolioCard";
import { mentorshipProgress, mentorshipSessions } from "../data/mentorshipData";
import { formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import {
  ArrowLeftIcon,
  VideoIcon,
  PencilIcon,
  PauseIcon,
  PlayIcon,
  StopIcon,
  CertificateIcon,
  CalendarIcon,
  DownloadFileIcon,
  PlusIcon,
} from "../../../components/ui/icons";

const TABS = [
  { key: "roadmap", label: "Roadmap" },
  { key: "sessions", label: "Sessions" },
  { key: "goals", label: "Goals & Reflections" },
  { key: "resources", label: "Resources" },
];

function EditProgramModal({ open, mentorship, onClose, onSave }) {
  const [focusArea, setFocusArea] = useState(mentorship?.focusArea || "");
  const [cadence, setCadence] = useState(mentorship?.cadence || "");
  const [duration, setDuration] = useState(mentorship?.duration || "");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Edit program details"
      footer={
        <>
          <Button
            fullWidth={false}
            className="px-6"
            disabled={!focusArea.trim() || !cadence.trim() || !duration.trim()}
            onClick={() => onSave({ focusArea: focusArea.trim(), cadence: cadence.trim(), duration: duration.trim() })}
          >
            Save Changes
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Focus area</span>
          <input value={focusArea} onChange={(e) => setFocusArea(e.target.value)} className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Cadence</span>
          <input value={cadence} onChange={(e) => setCadence(e.target.value)} className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </div>
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Duration</span>
          <input value={duration} onChange={(e) => setDuration(e.target.value)} className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15" />
        </div>
      </div>
    </Modal>
  );
}

function ReasonModal({ open, title, label, confirmLabel, danger, onClose, onConfirm }) {
  const [text, setText] = useState("");
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button
            fullWidth={false}
            className={`px-6 ${danger ? "border-danger bg-danger text-white hover:bg-danger/90" : ""}`}
            onClick={() => {
              onConfirm(text.trim());
              setText("");
            }}
          >
            {confirmLabel}
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div>
        <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          className="w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
    </Modal>
  );
}

function CompleteModal({ open, onClose, onConfirm }) {
  const [summary, setSummary] = useState("");
  const [issueCertificate, setIssueCertificate] = useState(true);
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Mark mentorship complete"
      footer={
        <>
          <Button fullWidth={false} className="px-6" disabled={!summary.trim()} onClick={() => onConfirm(summary.trim(), issueCertificate)}>
            Complete Mentorship
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Completion summary</span>
          <textarea
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            rows={4}
            placeholder="Summarize the mentee's growth over this program…"
            className="w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <div className="flex items-center justify-between gap-4 rounded-xl bg-bg p-3.5">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text">Issue a completion certificate</span>
            <span className="mt-0.5 block text-xs text-muted">Adds a mentorship certificate to their profile</span>
          </span>
          <Switch checked={issueCertificate} onChange={setIssueCertificate} />
        </div>
      </div>
    </Modal>
  );
}

function CertificateCard({ mentorship }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-primary px-6 py-8 text-center text-white">
      <span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/15">
        <CertificateIcon className="h-6 w-6" />
      </span>
      <div>
        <p className="font-display text-lg">Certificate of Mentorship</p>
        <p className="mt-1 text-sm text-white/75">Awarded to {mentorship.studentName}</p>
      </div>
      <p className="max-w-sm text-xs text-white/60">{mentorship.focusArea} · {mentorship.duration} · Completed {formatDateLabel(mentorship.completedAt, { month: "long", day: "numeric", year: "numeric" })}</p>
    </div>
  );
}

function SessionsTab({ mentorship, slots, onScheduleNext }) {
  const sessions = mentorshipSessions(mentorship, slots);
  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={onScheduleNext}>
          <PlusIcon className="h-3.5 w-3.5" />
          Schedule Next Check-In
        </Button>
      </div>
      {sessions.length === 0 ? (
        <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-soft">
          <p className="text-sm font-medium text-muted">No check-ins scheduled yet.</p>
        </div>
      ) : (
        sessions.map((slot) => (
          <div key={slot.id} className="flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  {slot.sessionType}
                  <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">Mentorship</span>
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateLabel(slot.date, { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(slot.start)}–{formatTime12(slot.end)}
                </p>
              </div>
              <StatusBadge status={slot.status === "booked" ? "success" : slot.status === "cancelled" ? "danger" : "neutral"} size="sm" showIcon={false}>
                {slot.status === "booked" ? "Booked" : slot.status === "cancelled" ? "Cancelled" : slot.status}
              </StatusBadge>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function GoalsTab({ mentorship, onAddReflection }) {
  const [draft, setDraft] = useState("");
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Goals at application</p>
        <div className="prose prose-sm max-w-none rounded-2xl bg-white p-4 text-sm text-text shadow-soft" dangerouslySetInnerHTML={{ __html: mentorship.goalsAtApplication }} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Add a reflection</p>
        <RichTextEditor value={draft} onChange={setDraft} placeholder="Notes on how this mentee is progressing…" minHeight={120} />
        <Button
          fullWidth={false}
          className="mt-2.5 px-5 text-xs"
          disabled={!draft.trim() || draft === "<br>"}
          onClick={() => {
            onAddReflection(draft);
            setDraft("");
          }}
        >
          Add Reflection
        </Button>
      </div>

      {mentorship.reflections.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Your reflection log</p>
          <div className="flex flex-col gap-2.5">
            {mentorship.reflections.map((r) => (
              <div key={r.id} className="rounded-2xl bg-white p-3.5 shadow-soft">
                <p className="mb-1 text-xs text-muted">{relativeDate(r.at)}</p>
                <div className="prose prose-sm max-w-none text-sm text-text" dangerouslySetInnerHTML={{ __html: r.html }} />
              </div>
            ))}
          </div>
        </div>
      )}

      {mentorship.menteeReflections.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">From {mentorship.studentName.split(" ")[0]}</p>
          <div className="flex flex-col gap-2.5">
            {mentorship.menteeReflections.map((r) => (
              <div key={r.id} className="rounded-xl bg-rotation-3/10 p-3.5 ring-1 ring-rotation-3/20">
                <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted">From mentee · {relativeDate(r.at)}</p>
                <div className="prose prose-sm max-w-none text-sm text-text" dangerouslySetInnerHTML={{ __html: r.html }} />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ResourcesTab({ mentorship, onShare }) {
  const [panelOpen, setPanelOpen] = useState(false);
  const shimCourse = { id: mentorship.id, title: mentorship.focusArea, modules: [] };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex justify-end">
        <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => setPanelOpen(true)}>
          <PlusIcon className="h-3.5 w-3.5" />
          Share Resource
        </Button>
      </div>
      {mentorship.resources.length === 0 ? (
        <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-soft">
          <p className="text-sm font-medium text-muted">Nothing shared with this mentee yet.</p>
        </div>
      ) : (
        mentorship.resources.map((r) => (
          <div key={r.id} className="flex items-start gap-2.5 rounded-2xl bg-white p-3.5 shadow-soft">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <DownloadFileIcon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-text">{r.title}</p>
              {r.description && <p className="mt-0.5 text-xs text-muted">{r.description.replace(/<[^>]+>/g, "")}</p>}
              <p className="mt-1 text-[11px] text-muted">{(r.files || []).map((f) => f.name).join(", ")} · Shared {relativeDate(r.sharedAt)}</p>
            </div>
          </div>
        ))
      )}
      <HomeworkUploadPanel
        open={panelOpen}
        course={shimCourse}
        presetAttach={null}
        onClose={() => setPanelOpen(false)}
        onShare={(item) => {
          onShare(item);
          setPanelOpen(false);
        }}
      />
    </div>
  );
}

// MentorshipProgramView — the per-mentee deep view opened from "View
// Program" on the Dashboard roster. Header quick actions gate Pause/End
// Early/Mark Complete behind a confirmation step (ReasonModal/
// CompleteModal) rather than firing immediately.
export default function MentorshipProgramView({
  mentorship,
  slots,
  onBack,
  onScheduleCheckIn,
  onAddMilestone,
  onUpdateMilestone,
  onRemoveMilestone,
  onReorderMilestones,
  onCompleteMilestone,
  onAddReflection,
  onShareResource,
  onUpdateProgram,
  onPause,
  onResume,
  onEndEarly,
  onComplete,
}) {
  const [tab, setTab] = useState("roadmap");
  const [editOpen, setEditOpen] = useState(false);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [endOpen, setEndOpen] = useState(false);
  const [completeOpen, setCompleteOpen] = useState(false);

  const meta = MENTORSHIP_STATUS_META[mentorship.status] ?? MENTORSHIP_STATUS_META.active;
  const progress = mentorshipProgress(mentorship);
  const isActive = mentorship.status === "active";
  const isPaused = mentorship.status === "paused";
  const isOpen = isActive || isPaused;

  return (
    <div className="pb-16">
      <button type="button" onClick={onBack} className="mb-4 flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to Dashboard
      </button>

      <div className="rounded-3xl bg-white p-5 shadow-soft">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/10 text-lg font-semibold text-primary">
              {initials(mentorship.studentName)}
            </span>
            <div className="min-w-0">
              <p className="flex flex-wrap items-center gap-2 text-lg font-semibold text-text">
                {mentorship.studentName}
                <StatusBadge status={meta.status} size="sm" showIcon={false}>
                  {meta.label}
                </StatusBadge>
              </p>
              <p className="truncate text-sm text-muted">{mentorship.focusArea}</p>
              <p className="mt-0.5 text-xs text-muted">
                Started {formatDateLabel(mentorship.startDate, { month: "short", day: "numeric", year: "numeric" })} · {mentorship.cadence} · {mentorship.duration}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isOpen && (
              <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-2 text-xs" onClick={() => onScheduleCheckIn(mentorship)}>
                <VideoIcon className="h-3.5 w-3.5" />
                Schedule Check-In
              </Button>
            )}
            <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-2 text-xs" onClick={() => setEditOpen(true)}>
              <PencilIcon className="h-3.5 w-3.5" />
              Edit Program
            </Button>
            {isActive && (
              <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-2 text-xs" onClick={() => setPauseOpen(true)}>
                <PauseIcon className="h-3.5 w-3.5" />
                Pause
              </Button>
            )}
            {isPaused && (
              <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-2 text-xs" onClick={() => onResume(mentorship.id)}>
                <PlayIcon className="h-3.5 w-3.5" />
                Resume
              </Button>
            )}
            {isOpen && (
              <Button variant="secondary" fullWidth={false} className="border-danger text-danger hover:bg-danger/5 flex items-center gap-1.5 px-3.5 py-2 text-xs" onClick={() => setEndOpen(true)}>
                <StopIcon className="h-3.5 w-3.5" />
                End Early
              </Button>
            )}
            {isOpen && (
              <Button fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-2 text-xs" onClick={() => setCompleteOpen(true)}>
                <CertificateIcon className="h-3.5 w-3.5" />
                Mark Complete
              </Button>
            )}
          </div>
        </div>

        {isPaused && mentorship.pausedReason && (
          <div className="mt-4 rounded-xl bg-warning/10 px-3.5 py-2.5 text-xs text-warning">Paused {relativeDate(mentorship.pausedAt)} — {mentorship.pausedReason}</div>
        )}
        {mentorship.status === "ended_early" && mentorship.endedNote && (
          <div className="mt-4 rounded-xl bg-danger/10 px-3.5 py-2.5 text-xs text-danger">Ended early {relativeDate(mentorship.completedAt)} — {mentorship.endedNote}</div>
        )}

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
            <span>Program progress</span>
            <span className="font-semibold text-muted">{progress}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-bg">
            <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
          </div>
        </div>

        {mentorship.status === "completed" && (
          <div className="mt-5 flex flex-col gap-4">
            {mentorship.completionSummary && <p className="rounded-xl bg-bg p-3.5 text-sm text-muted">{mentorship.completionSummary}</p>}
            {mentorship.certificateIssued && <CertificateCard mentorship={mentorship} />}
          </div>
        )}
      </div>

      <div className="-mx-1 mt-5 flex gap-1 overflow-x-auto pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setTab(t.key)}
            className={`shrink-0 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-150 ${
              tab === t.key ? "bg-primary text-white" : "bg-white text-muted ring-1 ring-text/[0.06] hover:text-text"
            } hover:-translate-y-0.5 hover:shadow-soft`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="mt-5">
        {tab === "roadmap" && (
          <MentorshipRoadmap
            mentorship={mentorship}
            onAdd={(m) => onAddMilestone(mentorship.id, m)}
            onUpdate={(id, patch) => onUpdateMilestone(mentorship.id, id, patch)}
            onRemove={(id) => onRemoveMilestone(mentorship.id, id)}
            onReorder={(next) => onReorderMilestones(mentorship.id, next)}
            onComplete={(id, reflection) => onCompleteMilestone(mentorship.id, id, reflection)}
          />
        )}
        {tab === "sessions" && <SessionsTab mentorship={mentorship} slots={slots} onScheduleNext={() => onScheduleCheckIn(mentorship)} />}
        {tab === "goals" && <GoalsTab mentorship={mentorship} onAddReflection={(html) => onAddReflection(mentorship.id, html)} />}
        {tab === "resources" && <ResourcesTab mentorship={mentorship} onShare={(item) => onShareResource(mentorship.id, item)} />}
      </div>

      <EditProgramModal open={editOpen} mentorship={mentorship} onClose={() => setEditOpen(false)} onSave={(patch) => { onUpdateProgram(mentorship.id, patch); setEditOpen(false); }} />
      <ReasonModal
        open={pauseOpen}
        title="Pause this mentorship"
        label="Reason (visible to you only)"
        confirmLabel="Pause Mentorship"
        onClose={() => setPauseOpen(false)}
        onConfirm={(reason) => { onPause(mentorship.id, reason); setPauseOpen(false); }}
      />
      <ReasonModal
        open={endOpen}
        title="End this mentorship early"
        label="Note (why this is ending early)"
        confirmLabel="End Mentorship"
        danger
        onClose={() => setEndOpen(false)}
        onConfirm={(note) => { onEndEarly(mentorship.id, note); setEndOpen(false); }}
      />
      <CompleteModal open={completeOpen} onClose={() => setCompleteOpen(false)} onConfirm={(summary, cert) => { onComplete(mentorship.id, summary, cert); setCompleteOpen(false); }} />
    </div>
  );
}
