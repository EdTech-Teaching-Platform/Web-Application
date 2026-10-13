import Modal from "../../../components/ui/Modal";
import OccurrenceEditor from "./OccurrenceEditor";
import AttendeeStack from "./AttendeeStack";
import { formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import { attendeeInfo, courseTitleOf } from "../data/liveSessions";
import { useTeacherCourses } from "../context/TeacherCoursesContext";

// EditLiveSessionModal — "Edit" on a session in the Upcoming panel or the
// Live Classes calendar. Wraps the shared per-occurrence editor in a
// Modal; saving goes through updateLiveClassOccurrence (series untouched).
export default function EditLiveSessionModal({ slot, onClose, onSave, onSaved }) {
  const { courses } = useTeacherCourses();
  if (!slot) return null;
  const info = attendeeInfo(slot, courses);
  return (
    <Modal open onClose={onClose} title="Edit this session" size="md">
      <div className="flex flex-col gap-4">
        <div className="rounded-2xl bg-bg p-4">
          <p className="text-xs font-semibold text-muted">{courseTitleOf(slot)}</p>
          <p className="mt-0.5 text-sm font-semibold text-text">{slot.liveClass?.title}</p>
          <p className="mt-1 text-xs text-muted">
            Currently {formatDateLabel(slot.date, { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(slot.start)}–{formatTime12(slot.end)}
          </p>
          <AttendeeStack className="mt-2" names={info.names} attending={info.attending} enrolled={info.enrolled} />
        </div>
        <p className="text-xs text-muted">Only this session changes — the rest of the schedule stays as it is.</p>
        <OccurrenceEditor
          key={slot.id}
          slot={slot}
          onSave={onSave}
          onDone={(s) => {
            onSaved?.(s);
            onClose();
          }}
          onCancel={onClose}
        />
      </div>
    </Modal>
  );
}
