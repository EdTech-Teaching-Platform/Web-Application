import IconBadge, { toneForKey } from "../../../components/ui/IconBadge";
import { VideoIcon, ClockIcon, RepeatIcon, PencilIcon } from "../../../components/ui/icons";
import { formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import { attendeeInfo, courseIdOf, courseTitleOf, durationMinutes } from "../data/liveSessions";
import AttendeeStack from "./AttendeeStack";
import JoinSessionButton from "./JoinSessionButton";
import MeetingProviderChip from "./MeetingProviderChip";

// LiveSessionCard — one live class session as a card row: course, title,
// date/time/duration, recurrence tag, enrolled/attending avatar stack, Edit
// and the shared Join button. Used by the Upcoming panel, the calendar's
// Day view and its mobile agenda so a session looks and behaves the same
// everywhere. `showDate` is off in Day view (the header already says which
// day).
export default function LiveSessionCard({ slot, now, courses, onOpen, onEdit, onJoin, showDate = true, className = "" }) {
  const info = attendeeInfo(slot, courses);
  const tone = toneForKey(courseIdOf(slot) || courseTitleOf(slot));
  const recurring = Boolean(slot.recurrence);
  return (
    <div className={`rounded-2xl bg-bg p-3.5 transition-colors duration-150 hover:bg-primary/[0.04] ${className}`}>
      <div className="flex items-start gap-3">
        <IconBadge icon={VideoIcon} tone={tone} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="truncate text-xs font-semibold text-muted">{courseTitleOf(slot)}</span>
            <span className="flex items-center gap-1 rounded-full bg-text/[0.06] px-2 py-0.5 text-[10px] font-semibold text-muted">
              {recurring && <RepeatIcon className="h-2.5 w-2.5" />}
              {recurring ? "Recurring" : "One-off"}
            </span>
            <MeetingProviderChip provider={slot.liveClass?.meeting?.provider} />
          </div>
          <button
            type="button"
            onClick={() => onOpen?.(slot)}
            disabled={!onOpen}
            className="mt-0.5 block max-w-full truncate text-left text-sm font-semibold text-text enabled:hover:text-primary"
          >
            {slot.liveClass?.title || "Live class"}
          </button>
          <p className="mt-1 flex flex-wrap items-center gap-x-1.5 text-xs text-muted">
            <ClockIcon className="h-3 w-3 shrink-0" />
            {showDate && <span>{formatDateLabel(slot.date, { weekday: "short", month: "short", day: "numeric" })} ·</span>}
            <span>
              {formatTime12(slot.start)}–{formatTime12(slot.end)} · {durationMinutes(slot)} min
            </span>
          </p>
          <AttendeeStack className="mt-2" names={info.names} attending={info.attending} enrolled={info.enrolled} />
        </div>
      </div>
      <div className="mt-3 flex items-center justify-end gap-2">
        {onEdit && (
          <button
            type="button"
            onClick={() => onEdit(slot)}
            aria-label={`Edit ${slot.liveClass?.title || "live class"}`}
            className="flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.08]"
          >
            <PencilIcon className="h-3.5 w-3.5" />
            Edit
          </button>
        )}
        <JoinSessionButton session={slot} now={now} onJoin={onJoin} size="sm" />
      </div>
    </div>
  );
}
