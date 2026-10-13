import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import LiveClassScheduleForm from "./LiveClassScheduleForm";
import OccurrenceEditor from "./OccurrenceEditor";
import { formatDateLabel, formatTime12, isoDate } from "../data/teacherAvailability";
import { TODAY } from "../data/teacherCourses";
import { describeSchedule } from "../data/liveClassScheduleData";
import { emptyMeeting, isMeetingValid, cleanMeeting } from "../data/meetingProviders";
import MeetingProviderChip from "./MeetingProviderChip";
import { AlertTriangleIcon, ClockIcon, PencilIcon, RepeatIcon, TrashIcon, UsersIcon } from "../../../components/ui/icons";

// ManageLiveClassSchedulePanel — the "already scheduled" entry point on
// Live Classes: shows the schedule's current settings (editable in place,
// reusing the exact same form the create flow uses), the next several
// generated occurrences with their real per-occurrence enrolled/attending
// counts, and whole-series Pause/End actions. Cancelling or editing one
// occurrence never touches the others or the series rule itself — the
// same single-vs-series distinction Reschedule/Cancel Booking already
// established for 1:1 bookings.
export default function ManageLiveClassSchedulePanel({ open, course, schedule, slots, onClose, onUpdateSchedule, onSetStatus, onCancelOccurrence, onEditOccurrence }) {
  const [editing, setEditing] = useState(false);
  const [recurrence, setRecurrence] = useState("one-off");
  const [date, setDate] = useState("");
  const [daysOfWeek, setDaysOfWeek] = useState([]);
  const [time, setTime] = useState("17:00");
  const [duration, setDuration] = useState(60);
  const [noEndDate, setNoEndDate] = useState(true);
  const [endDate, setEndDate] = useState("");
  const [title, setTitle] = useState("");
  const [meeting, setMeeting] = useState(emptyMeeting());
  const [notifyMode, setNotifyMode] = useState("now");
  const [recurringNotifyMode, setRecurringNotifyMode] = useState("every_occurrence");
  const [savedFlash, setSavedFlash] = useState("");
  const [editingOccurrence, setEditingOccurrence] = useState(null); // slotId
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [error, setError] = useState(null);

  function resetFromSchedule() {
    if (!schedule) return;
    setRecurrence(schedule.recurrence);
    setDate(schedule.date || "");
    setDaysOfWeek(schedule.daysOfWeek || []);
    setTime(schedule.time);
    setDuration(schedule.duration);
    setNoEndDate(!schedule.endDate);
    setEndDate(schedule.endDate || "");
    setTitle(schedule.title);
    setMeeting({ ...emptyMeeting(), ...(schedule.meeting || {}) });
    setNotifyMode(schedule.notifyMode);
    setRecurringNotifyMode(schedule.recurringNotifyMode || "every_occurrence");
  }

  useEffect(() => {
    if (!open) return;
    resetFromSchedule();
    setEditing(false);
    setConfirmEnd(false);
    setSavedFlash("");
    setError(null);
    setEditingOccurrence(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, schedule?.id]);

  const todayIso = isoDate(TODAY);
  const occurrences = useMemo(
    () =>
      (slots || [])
        .filter((s) => s.blockId === schedule?.id && s.date >= todayIso)
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    [slots, schedule?.id, todayIso]
  );

  if (!schedule || !course) return null;

  function handleSaveEdit() {
    setError(null);
    const res = onUpdateSchedule(schedule.id, {
      recurrence,
      date: recurrence === "one-off" ? date : null,
      daysOfWeek: recurrence === "weekly" ? daysOfWeek : [],
      time,
      duration,
      endDate: recurrence === "weekly" && !noEndDate ? endDate : null,
      title: title.trim() || schedule.title,
      meeting: cleanMeeting(meeting),
      notifyMode,
      recurringNotifyMode,
    });
    if (!res.ok) {
      setError("Couldn't save these changes — try again.");
      return;
    }
    setSavedFlash("Schedule updated — upcoming sessions were refreshed.");
    setEditing(false);
  }

  const enrolledCount = course.students?.length || 0;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`Manage Schedule — ${course.title}`}
      size="xl"
      footer={
        editing ? (
          <>
            <Button fullWidth={false} className="px-6" disabled={!isMeetingValid(meeting)} onClick={handleSaveEdit}>
              Save Changes
            </Button>
            <Button
              variant="secondary"
              fullWidth={false}
              className="px-6"
              onClick={() => {
                resetFromSchedule();
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </>
        ) : (
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Close
          </Button>
        )
      }
    >
      <div className="flex flex-col gap-5">
        {error && (
          <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
            <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}
        {savedFlash && !editing && (
          <div className="flex items-start gap-2.5 rounded-xl bg-success/10 px-4 py-3 text-sm text-success">{savedFlash}</div>
        )}

        {editing ? (
          <LiveClassScheduleForm
            course={course}
            recurrence={recurrence}
            setRecurrence={setRecurrence}
            date={date}
            setDate={setDate}
            daysOfWeek={daysOfWeek}
            setDaysOfWeek={setDaysOfWeek}
            time={time}
            setTime={setTime}
            duration={duration}
            setDuration={setDuration}
            noEndDate={noEndDate}
            setNoEndDate={setNoEndDate}
            endDate={endDate}
            setEndDate={setEndDate}
            title={title}
            setTitle={setTitle}
            meeting={meeting}
            setMeeting={setMeeting}
            notifyMode={notifyMode}
            setNotifyMode={setNotifyMode}
            recurringNotifyMode={recurringNotifyMode}
            setRecurringNotifyMode={setRecurringNotifyMode}
            minDate={todayIso}
          />
        ) : (
          <>
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-bg p-4">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-semibold text-text">{schedule.title}</p>
                  <StatusBadge status={schedule.status === "active" ? "success" : schedule.status === "paused" ? "warning" : "neutral"} size="sm" showIcon={false}>
                    {schedule.status === "active" ? "Active" : schedule.status === "paused" ? "Paused" : "Ended"}
                  </StatusBadge>
                  <MeetingProviderChip provider={schedule.meeting?.provider} />
                  {schedule.recurrence === "weekly" && (
                    <span className="flex items-center gap-1 rounded-full bg-text/[0.06] px-2.5 py-1 text-[11px] font-medium text-muted">
                      <RepeatIcon className="h-3 w-3" /> Recurring
                    </span>
                  )}
                </div>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <ClockIcon className="h-3 w-3" />
                  {describeSchedule(schedule)} · {schedule.duration} min
                </p>
                <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                  <UsersIcon className="h-3 w-3" />
                  {enrolledCount} enrolled student{enrolledCount === 1 ? "" : "s"}
                </p>
              </div>
              <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => setEditing(true)}>
                <PencilIcon className="h-3.5 w-3.5" />
                Edit Schedule
              </Button>
            </div>

            <div>
              <h4 className="mb-2.5 text-sm font-semibold text-text">Upcoming occurrences</h4>
              {occurrences.length === 0 ? (
                <div className="flex flex-col items-center rounded-xl bg-bg px-6 py-8 text-center">
                  <p className="text-sm font-medium text-muted">No upcoming occurrences left.</p>
                  <p className="mt-1 text-xs text-muted">
                    {schedule.recurrence === "weekly" ? "This recurring schedule has reached its end date." : "This one-off session has already happened."}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col divide-y divide-text/[0.06] rounded-3xl bg-white shadow-soft">
                  {occurrences.map((slot) => {
                    const attending = slot.bookings?.length || 0;
                    const isEditingThis = editingOccurrence === slot.id;
                    return (
                      <div key={slot.id} className="flex flex-col gap-2.5 px-4 py-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <p className="text-sm font-semibold text-text">
                              {formatDateLabel(slot.date, { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(slot.start)}
                            </p>
                            <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                              <UsersIcon className="h-3 w-3" />
                              {attending}/{enrolledCount} attending
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {slot.liveClass?.status === "live" && (
                              <span className="rounded-full bg-danger/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-danger">Live now</span>
                            )}
                            <button
                              type="button"
                              onClick={() => setEditingOccurrence(isEditingThis ? null : slot.id)}
                              className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.06]"
                            >
                              {isEditingThis ? "Cancel edit" : "Edit just this occurrence"}
                            </button>
                            <button
                              type="button"
                              onClick={() => onCancelOccurrence(slot.id)}
                              aria-label="Cancel this occurrence only"
                              className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger"
                              title="Cancel this occurrence only"
                            >
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                        {isEditingThis && (
                          <OccurrenceEditor slot={slot} onSave={onEditOccurrence} onDone={() => setEditingOccurrence(null)} onCancel={() => setEditingOccurrence(null)} />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-danger/20 bg-danger/[0.04] p-4">
              <div>
                <p className="text-sm font-semibold text-text">
                  {schedule.status === "ended" ? "This schedule has ended." : schedule.status === "paused" ? "This schedule is paused." : "Whole series"}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {schedule.status === "ended"
                    ? "No further occurrences will be created."
                    : "Pausing keeps what's already on the calendar but stops new occurrences. Ending also cancels every upcoming occurrence."}
                </p>
              </div>
              {schedule.status !== "ended" && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    className="px-4 py-2 text-xs"
                    onClick={() => onSetStatus(schedule.id, schedule.status === "paused" ? "active" : "paused")}
                  >
                    {schedule.status === "paused" ? "Resume Schedule" : "Pause Schedule"}
                  </Button>
                  {!confirmEnd ? (
                    <Button
                      variant="secondary"
                      fullWidth={false}
                      className="border-danger px-4 py-2 text-xs text-danger hover:bg-danger/5"
                      onClick={() => setConfirmEnd(true)}
                    >
                      End Recurring Schedule
                    </Button>
                  ) : (
                    <div className="flex items-center gap-2">
                      <Button
                        variant="secondary"
                        fullWidth={false}
                        className="border-danger bg-danger px-4 py-2 text-xs text-white hover:bg-danger/90"
                        onClick={() => {
                          onSetStatus(schedule.id, "ended");
                          setConfirmEnd(false);
                        }}
                      >
                        Confirm end
                      </Button>
                      <Button variant="secondary" fullWidth={false} className="px-4 py-2 text-xs" onClick={() => setConfirmEnd(false)}>
                        Go back
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
