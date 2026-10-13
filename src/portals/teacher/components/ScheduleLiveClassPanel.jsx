import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import LiveClassScheduleForm from "./LiveClassScheduleForm";
import { isoDate } from "../data/teacherAvailability";
import { TODAY } from "../data/teacherCourses";
import { suggestScheduleTitle, describeSchedule } from "../data/liveClassScheduleData";
import { emptyMeeting, isMeetingValid, cleanMeeting } from "../data/meetingProviders";
import { AlertTriangleIcon } from "../../../components/ui/icons";

// ScheduleLiveClassPanel — the "none yet" entry point on Live Classes:
// builds a brand-new per-course schedule (one-off or weekly recurring)
// and, on confirm, hands it to TeacherAvailabilityContext.createLiveClassSchedule,
// which both records the rule and immediately materializes its next
// upcoming occurrences as real slots — so this course's entry on the Live
// Classes grid and the Availability Calendar update together, not just one
// of them.
export default function ScheduleLiveClassPanel({ open, course, onClose, onCreate }) {
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
  const [step, setStep] = useState("form");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null);

  useEffect(() => {
    if (!open || !course) return;
    setRecurrence("one-off");
    setDate("");
    setDaysOfWeek([new Date(TODAY).getDay()]);
    setTime("17:00");
    setDuration(60);
    setNoEndDate(true);
    setEndDate("");
    setTitle(suggestScheduleTitle(course));
    setMeeting(emptyMeeting());
    setNotifyMode("now");
    setRecurringNotifyMode("every_occurrence");
    setStep("form");
    setError(null);
    setResult(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, course?.id]);

  if (!course) return null;

  const minDate = isoDate(TODAY);
  const canSubmit =
    title.trim().length > 0 && isMeetingValid(meeting) && time && (recurrence === "one-off" ? Boolean(date) : daysOfWeek.length > 0 && (noEndDate || Boolean(endDate)));

  function handleSubmit() {
    setError(null);
    setSubmitting(true);
    window.setTimeout(() => {
      const config = {
        courseId: course.id,
        courseTitle: course.title,
        recurrence,
        date: recurrence === "one-off" ? date : null,
        daysOfWeek: recurrence === "weekly" ? daysOfWeek : [],
        time,
        duration,
        endDate: recurrence === "weekly" && !noEndDate ? endDate : null,
        title: title.trim() || suggestScheduleTitle(course),
        meeting: cleanMeeting(meeting),
        notifyMode,
        recurringNotifyMode,
      };
      const res = onCreate(config);
      setSubmitting(false);
      if (!res.ok) {
        setError("Couldn't save this schedule — try again.");
        return;
      }
      setResult(res);
      setStep("success");
    }, 450);
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={step === "success" ? "Live class scheduled" : `Schedule Live Class — ${course.title}`}
      size="xl"
      footer={
        step === "success" ? (
          <Button fullWidth={false} className="px-6" onClick={onClose}>
            Done
          </Button>
        ) : (
          <>
            <Button fullWidth={false} className="px-6" disabled={!canSubmit || submitting} onClick={handleSubmit}>
              {submitting ? "Saving…" : recurrence === "weekly" ? "Save Recurring Schedule" : "Schedule Live Class"}
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
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
          message={`${describeSchedule(result.schedule)} — ${result.occurrencesCreated} upcoming session${
            result.occurrencesCreated === 1 ? "" : "s"
          } added to the calendar${result.skipped ? ` (${result.skipped} skipped — conflicted with something already scheduled)` : ""}.`}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {error && (
            <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          )}
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
            minDate={minDate}
          />
        </div>
      )}
    </Modal>
  );
}
