import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import Chip from "../../../components/ui/Chip";
import FileDropzone from "../../../components/ui/FileDropzone";
import { formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import { NOTIFY_MODES, suggestSessionTitle, buildRosterCandidates, initials } from "../data/liveClassData";
import MeetingDetailsFields from "./MeetingDetailsFields";
import { emptyMeeting, isMeetingValid, cleanMeeting } from "../data/meetingProviders";
import { UsersIcon, ClockIcon, BookIcon, VideoIcon, SearchIcon, CheckIcon, BellIcon } from "../../../components/ui/icons";

const EDUCATOR_NAME = "Ansh Mehra";

// ScheduleLiveClassModal — Part 1 of Scheduled Live Class: converts an
// existing confirmed booking into an actual joinable session. Opened from
// the booking detail slide-over's "Schedule Live Class" action or from the
// Upcoming Sessions panel's quick action — both pass the same `slot`, and
// both write through TeacherAvailabilityContext.scheduleLiveClass, so the
// slot this booking already lives on is what gets the "Live Class
// Scheduled" badge, never a disconnected record.
export default function ScheduleLiveClassModal({ open, onClose, slot, courses, onSchedule }) {
  const roster = useMemo(() => (slot ? buildRosterCandidates(slot, courses) : { booked: [], classmates: [] }), [slot, courses]);

  const [title, setTitle] = useState("");
  const [format, setFormat] = useState("1:1");
  const [participants, setParticipants] = useState([]);
  const [rosterQuery, setRosterQuery] = useState("");
  const [materials, setMaterials] = useState(null);
  const [meeting, setMeeting] = useState(emptyMeeting());
  const [notifyMode, setNotifyMode] = useState("now");
  const [step, setStep] = useState("form");
  const [submitting, setSubmitting] = useState(false);
  const [resultLiveClass, setResultLiveClass] = useState(null);

  useEffect(() => {
    if (!open || !slot) return;
    setTitle(suggestSessionTitle(slot));
    const isGroup = (slot.bookings?.length || 0) > 1;
    setFormat(isGroup ? "Group" : "1:1");
    setParticipants(roster.booked);
    setRosterQuery("");
    setMaterials(null);
    setMeeting(emptyMeeting());
    setNotifyMode("now");
    setStep("form");
    setResultLiveClass(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, slot?.id]);

  if (!slot) return null;

  const primaryBooking = slot.bookings?.[0];
  const candidateMatches = rosterQuery.trim()
    ? roster.classmates.filter((n) => n.toLowerCase().includes(rosterQuery.trim().toLowerCase()) && !participants.includes(n))
    : roster.classmates.filter((n) => !participants.includes(n)).slice(0, 4);

  function toggleParticipant(name) {
    if (roster.booked.includes(name)) return; // booked student(s) always included
    setParticipants((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
  }

  function handleClose() {
    onClose();
  }

  function handleSubmit() {
    setSubmitting(true);
    window.setTimeout(() => {
      const config = {
        title: title.trim() || suggestSessionTitle(slot),
        format,
        participants,
        materials: materials ? { name: materials.name, size: materials.size } : null,
        meeting: cleanMeeting(meeting),
        notifyMode,
      };
      const res = onSchedule(slot.id, config);
      setSubmitting(false);
      if (!res.ok) return;
      setResultLiveClass(res.liveClass);
      setStep("success");
    }, 500);
  }

  const canSubmit = title.trim().length > 0 && isMeetingValid(meeting) && (format === "1:1" || participants.length > 0);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "success" ? "Live class scheduled" : "Schedule Live Class"}
      size="lg"
      footer={
        step === "success" ? (
          <>
            <Button fullWidth={false} className="px-6" onClick={handleClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth={false} className="px-6" disabled={!canSubmit || submitting} onClick={handleSubmit}>
              {submitting ? "Creating…" : "Create Live Class"}
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={handleClose}>
              Cancel
            </Button>
          </>
        )
      }
    >
      {step === "success" ? (
        <ConfirmationCard
          state="success"
          heading="Ready to go"
          message={`"${resultLiveClass?.title}" is on the calendar as a live class. ${
            notifyMode === "now" ? "Students have been notified now." : "Students will be reminded 15 minutes before it starts."
          }`}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {/* Locked booking summary */}
          <div className="rounded-2xl bg-bg p-4">
            <span className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <VideoIcon className="h-3.5 w-3.5" />
              From this booking
            </span>
            <div className="flex items-center gap-3 rounded-2xl bg-white p-3.5 shadow-soft">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                {primaryBooking ? initials(primaryBooking.studentName) : "?"}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-text">
                  {(slot.bookings?.length || 0) > 1 ? `${slot.bookings.length} students` : primaryBooking?.studentName}
                </p>
                <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <BookIcon className="h-3 w-3" />
                  {primaryBooking?.courseTitle}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-muted">
                <p className="flex items-center justify-end gap-1.5 font-semibold text-muted">
                  <ClockIcon className="h-3 w-3" />
                  {formatDateLabel(slot.date, { weekday: "short", month: "short", day: "numeric" })}
                </p>
                <p className="mt-0.5">
                  {formatTime12(slot.start)}–{formatTime12(slot.end)}
                </p>
              </div>
            </div>
          </div>

          {/* Session title */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Session title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="What students will see when joining"
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {/* Format */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Session format</span>
            <SegmentedControl options={["1:1", "Group"]} value={format} onChange={setFormat} />
          </div>

          {format === "Group" && (
            <div>
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
                <UsersIcon className="h-3.5 w-3.5 text-muted" />
                Participants
              </span>
              <div className="flex flex-wrap gap-1.5">
                {roster.booked.map((name) => (
                  <Chip key={name} active className="cursor-default px-3.5 py-1.5 text-xs">
                    {name}
                  </Chip>
                ))}
                {participants
                  .filter((p) => !roster.booked.includes(p))
                  .map((name) => (
                    <Chip key={name} active onClick={() => toggleParticipant(name)} className="px-3.5 py-1.5 text-xs">
                      {name} ×
                    </Chip>
                  ))}
              </div>
              <div className="relative mt-2.5">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={rosterQuery}
                  onChange={(e) => setRosterQuery(e.target.value)}
                  placeholder="Add more students from this course…"
                  className="w-full rounded-xl border border-text/15 bg-bg py-2.5 pl-10 pr-4 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                {candidateMatches.length > 0 && (
                  <div className="mt-2 flex max-h-36 flex-col gap-1 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-soft">
                    {candidateMatches.map((name) => (
                      <button
                        key={name}
                        type="button"
                        onClick={() => toggleParticipant(name)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium text-text transition-colors hover:bg-bg"
                      >
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[11px] font-semibold text-primary">
                          {initials(name)}
                        </span>
                        {name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Materials */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Pre-session materials (optional)</span>
            <FileDropzone label="Upload pre-reads or agenda" hint="PDF, slides or doc · or click to browse" file={materials} onFileSelect={setMaterials} />
          </div>

          <MeetingDetailsFields meeting={meeting} onChange={setMeeting} />

          {/* Notify */}
          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
              <BellIcon className="h-3.5 w-3.5 text-muted" />
              Notify students
            </span>
            <div className="flex flex-col gap-2">
              {NOTIFY_MODES.map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setNotifyMode(m.key)}
                  className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
                    notifyMode === m.key ? "border-primary bg-primary/[0.06]" : "border-text/15 bg-bg hover:border-primary/30"
                  }`}
                >
                  <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                      notifyMode === m.key ? "border-primary bg-primary text-white" : "border-text/25"
                    }`}
                  >
                    {notifyMode === m.key && <CheckIcon className="h-2.5 w-2.5" />}
                  </span>
                  <span>
                    <span className="block text-sm font-semibold text-text">{m.label}</span>
                    <span className="mt-0.5 block text-xs text-muted">{m.caption}</span>
                  </span>
                </button>
              ))}
            </div>
            <div className="mt-2.5 rounded-2xl bg-white p-3.5 text-xs text-muted shadow-soft">
              <span className="font-semibold text-muted">Preview: </span>
              "{title.trim() || suggestSessionTitle(slot)}" with {EDUCATOR_NAME} is scheduled for{" "}
              {formatDateLabel(slot.date, { weekday: "long", month: "long", day: "numeric" })} at {formatTime12(slot.start)}.{" "}
              {notifyMode === "now" ? "You can join from your dashboard." : "We'll remind you 15 minutes before it starts."}
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
