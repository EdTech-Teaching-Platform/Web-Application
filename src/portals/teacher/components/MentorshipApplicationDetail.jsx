import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { initials } from "../data/studentDirectory";
import { relativeDate } from "./CoursePortfolioCard";
import StructuredResponseForm from "./StructuredResponseForm";
import { MENTORSHIP_DECLINE_REASONS, MENTORSHIP_INFO_REASONS } from "../data/mentorshipData";
import { APPLICATION_STATUS_META } from "./MentorshipApplicationCard";
import {
  XIcon,
  AlertTriangleIcon,
  CalendarIcon,
  ClockIcon,
  BookIcon,
  InfoIcon,
  CheckIcon,
} from "../../../components/ui/icons";

// MentorshipApplicationDetail — the slide-over detail view for one
// application, same right-edge drawer shell/motion as StudentProfileSheet.
// Three actions branch into their own confirm-before-send sub-panels
// (Decline, Request More Info) or hand off to MentorshipPlanSetupModal
// (Accept), driven by the parent so the plan-setup modal can stack above.
export default function MentorshipApplicationDetail({
  application,
  rosterEntry,
  activeMentorshipCount,
  capacity,
  onClose,
  onAccept,
  onDecline,
  onRequestInfo,
}) {
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);
  const [mode, setMode] = useState("view"); // view | decline | requestInfo

  const open = Boolean(application);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setMode("view");
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open, application?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const meta = APPLICATION_STATUS_META[application.status] ?? APPLICATION_STATUS_META.new;
  const isPending = application.status === "new" || application.status === "under_review";
  const atCapacity = capacity != null && activeMentorshipCount >= capacity;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-text/50 transition-opacity duration-200 ease-out ${entered ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex h-full w-full max-w-xl flex-col overflow-hidden rounded-l-3xl bg-bg shadow-elevated transition-transform duration-200 ease-out ${
          entered ? "translate-x-0" : "translate-x-4 opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-3 border-b border-text/[0.07] bg-white px-5 py-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
              {initials(application.studentName)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-base font-semibold text-text">{application.studentName}</p>
              <p className="mt-0.5 text-xs text-muted">Applied {relativeDate(application.appliedAt)}</p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <StatusBadge status={meta.status} size="sm" showIcon={false}>
              {meta.label}
            </StatusBadge>
            <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-text">
              <XIcon className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {mode === "view" && (
            <div className="flex flex-col gap-6">
              {atCapacity && isPending && (
                <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
                  <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
                  You're at your mentorship capacity ({activeMentorshipCount}/{capacity} active). Accepting this
                  applicant will {`go over capacity — consider your waitlist setting in Program Settings.`}
                </div>
              )}

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                  <BookIcon className="h-3.5 w-3.5" />
                  Goals
                </p>
                <div className="prose prose-sm max-w-none rounded-2xl bg-white p-4 text-sm text-text shadow-soft" dangerouslySetInnerHTML={{ __html: application.goals }} />
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Focus areas</p>
                <div className="flex flex-wrap gap-1.5">
                  {application.focusAreas?.map((f) => (
                    <span key={f} className="rounded-full bg-primary/[0.08] px-3 py-1 text-xs font-semibold text-primary">
                      {f}
                    </span>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white p-3.5 shadow-soft">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <ClockIcon className="h-3.5 w-3.5" />
                    Cadence
                  </p>
                  <p className="mt-1 text-sm font-medium text-text">{application.cadence}</p>
                </div>
                <div className="rounded-2xl bg-white p-3.5 shadow-soft">
                  <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                    <CalendarIcon className="h-3.5 w-3.5" />
                    Proposed duration
                  </p>
                  <p className="mt-1 text-sm font-medium text-text">{application.proposedDuration}</p>
                </div>
              </div>

              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">Existing relationship</p>
                {rosterEntry ? (
                  <button
                    type="button"
                    onClick={() => navigate(`/teacher/coursemanagement/${rosterEntry.enrollments[0].courseId}?tab=students&student=${encodeURIComponent(rosterEntry.name)}`)}
                    className="flex w-full flex-col gap-2 rounded-2xl bg-white p-3.5 text-left hover:bg-primary/[0.03] shadow-soft"
                  >
                    <div className="flex flex-wrap gap-1.5">
                      {rosterEntry.enrollments.map((e) => (
                        <span key={e.courseId} className="rounded-full bg-primary/[0.07] px-2.5 py-1 text-[11px] font-semibold text-primary">
                          {e.courseTitle}
                        </span>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs text-muted">
                      <span>Overall progress: {rosterEntry.overallProgress}%</span>
                      <span>Enrolled {relativeDate(rosterEntry.enrolledAt)}</span>
                    </div>
                  </button>
                ) : (
                  <div className="rounded-2xl bg-white p-3.5 text-sm text-muted shadow-soft">
                    No existing enrollment — this applicant isn't currently a student in one of your courses.
                  </div>
                )}
              </div>

              {application.status === "declined" && application.declineReason && (
                <div className="rounded-xl bg-danger/[0.06] p-3.5 text-sm text-danger">
                  Declined — {application.declineReason}
                  {application.declineNote && <span className="mt-1 block text-xs">Note: {application.declineNote}</span>}
                </div>
              )}
              {application.infoRequestedAt && (
                <div className="rounded-xl bg-warning/[0.08] p-3.5 text-sm text-warning">
                  Requested more info on {relativeDate(application.infoRequestedAt)}
                  {application.infoRequestReason && <span className="block text-xs">{application.infoRequestReason}{application.infoRequestNote ? ` — ${application.infoRequestNote}` : ""}</span>}
                </div>
              )}

              {isPending && (
                <div className="flex flex-col gap-2.5 border-t border-text/[0.07] pt-4">
                  <Button fullWidth className="flex items-center justify-center gap-1.5" onClick={() => onAccept(application)}>
                    <CheckIcon className="h-4 w-4" />
                    Accept &amp; Set Up Plan
                  </Button>
                  <Button variant="secondary" fullWidth className="flex items-center justify-center gap-1.5" onClick={() => setMode("requestInfo")}>
                    <InfoIcon className="h-4 w-4" />
                    Request More Info
                  </Button>
                  <Button variant="secondary" fullWidth className="border-danger text-danger hover:bg-danger/5" onClick={() => setMode("decline")}>
                    Decline
                  </Button>
                </div>
              )}
            </div>
          )}

          {mode === "decline" && (
            <StructuredResponseForm
              title="Decline this application"
              description="Pick a reason and add an optional private note. The application is marked declined and the note is kept on the application."
              reasons={MENTORSHIP_DECLINE_REASONS}
              noteLabel="Private note (optional)"
              submitLabel="Decline application"
              submitTone="danger"
              doneHeading="Application declined"
              doneMessage={`${application.studentName}'s application has been marked as declined.`}
              onSubmit={({ reason, note }) => onDecline(application.id, reason, note)}
              onBack={() => setMode("view")}
              onDone={onClose}
            />
          )}

          {mode === "requestInfo" && (
            <StructuredResponseForm
              title="Request more info"
              description="Flag what you still need before deciding. The application moves to under review and your request is recorded on it."
              reasons={MENTORSHIP_INFO_REASONS}
              reasonLabel="What do you need?"
              noteLabel="Details (optional)"
              submitLabel="Record info request"
              doneHeading="Info request recorded"
              doneMessage="The application is under review with your request noted."
              onSubmit={({ reason, note }) => onRequestInfo(application, reason, note)}
              onBack={() => setMode("view")}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
