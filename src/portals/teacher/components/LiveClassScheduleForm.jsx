import SegmentedControl from "../../../components/ui/SegmentedControl";
import Select from "../../../components/ui/Select";
import { WEEKDAY_LABELS, formatDateLabel, formatTime12, addMinutesToTime } from "../data/teacherAvailability";
import MeetingDetailsFields from "./MeetingDetailsFields";
import { NOTIFY_MODES, RECURRING_NOTIFY_MODES } from "../data/liveClassScheduleData";
import { BellIcon, ClockIcon, CheckIcon } from "../../../components/ui/icons";

const DURATION_OPTIONS = [30, 45, 60, 90, 120];

function FieldLabel({ children }) {
  return <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">{children}</span>;
}

function DayToggle({ days, onChange }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {WEEKDAY_LABELS.map((label, i) => {
        const active = days.includes(i);
        return (
          <button
            key={label}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(active ? days.filter((d) => d !== i) : [...days, i])}
            className={`flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold transition-all duration-150 ${
              active ? "bg-primary text-white" : "bg-surface text-muted shadow-soft hover:bg-primary/10 hover:text-primary"
            } hover:-translate-y-0.5 hover:shadow-soft`}
          >
            {label[0]}
          </button>
        );
      })}
    </div>
  );
}

// LiveClassScheduleForm — the recurrence + timing + meeting-details +
// notify fields shared by both the "Schedule Live Class" create flow and
// the "Manage Schedule" edit-in-place view, so the two never drift into
// two different-looking forms for the same underlying schedule shape. A
// pure controlled form: every field is lifted state, nothing here reads
// or writes TeacherAvailabilityContext directly.
export default function LiveClassScheduleForm({
  course,
  recurrence,
  setRecurrence,
  date,
  setDate,
  daysOfWeek,
  setDaysOfWeek,
  time,
  setTime,
  duration,
  setDuration,
  noEndDate,
  setNoEndDate,
  endDate,
  setEndDate,
  title,
  setTitle,
  meeting,
  setMeeting,
  notifyMode,
  setNotifyMode,
  recurringNotifyMode,
  setRecurringNotifyMode,
  minDate,
}) {
  const enrolledCount = course?.students?.length || 0;
  const previewDateLabel =
    recurrence === "one-off"
      ? date
        ? formatDateLabel(date, { weekday: "long", month: "long", day: "numeric" })
        : "a chosen date"
      : `every ${daysOfWeek.length ? daysOfWeek.map((d) => WEEKDAY_LABELS[d]).join("/") : "chosen weekday"}`;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-2xl bg-bg p-4">
        <span className="mb-1 block text-xs font-semibold uppercase tracking-wide text-muted">Course</span>
        <p className="text-sm font-semibold text-text">{course?.title || "—"}</p>
        <p className="mt-0.5 text-xs text-muted">{enrolledCount} enrolled student{enrolledCount === 1 ? "" : "s"} will be added automatically.</p>
      </div>

      <div>
        <FieldLabel>Recurrence</FieldLabel>
        <SegmentedControl options={["One-off", "Weekly"]} value={recurrence === "weekly" ? "Weekly" : "One-off"} onChange={(v) => setRecurrence(v === "Weekly" ? "weekly" : "one-off")} />
      </div>

      {recurrence === "one-off" ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel>Date</FieldLabel>
            <input
              type="date"
              min={minDate}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <FieldLabel>Time</FieldLabel>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3 rounded-2xl bg-bg p-4">
          <div>
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-muted">On these days</span>
            <DayToggle days={daysOfWeek} onChange={setDaysOfWeek} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <FieldLabel>Time</FieldLabel>
              <input
                type="time"
                value={time}
                onChange={(e) => setTime(e.target.value)}
                className="w-full rounded-xl border border-text/15 bg-white px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </div>
            <div>
              <FieldLabel>Ends</FieldLabel>
              <label className="flex items-center gap-2 py-2.5 text-sm text-text">
                <input type="checkbox" checked={noEndDate} onChange={(e) => setNoEndDate(e.target.checked)} className="h-4 w-4 accent-primary" />
                No end date
              </label>
            </div>
          </div>
          {!noEndDate && (
            <input
              type="date"
              min={minDate}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full max-w-[180px] rounded-xl border border-text/15 bg-white px-3.5 py-2 text-sm text-text outline-none focus:border-primary/40"
            />
          )}
        </div>
      )}

      <div>
        <FieldLabel>Duration</FieldLabel>
        <Select
          wrapperClassName="block w-full max-w-[180px]"
          value={duration}
          onChange={(e) => setDuration(Number(e.target.value))}
          className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          {DURATION_OPTIONS.map((m) => (
            <option key={m} value={m}>
              {m} min
            </option>
          ))}
        </Select>
      </div>

      <div>
        <FieldLabel>Session title</FieldLabel>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="What students will see when joining"
          className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>

      <MeetingDetailsFields meeting={meeting} onChange={setMeeting} />

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
      </div>

      {recurrence === "weekly" && (
        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
            <ClockIcon className="h-3.5 w-3.5 text-muted" />
            Recurring notifications
          </span>
          <div className="flex flex-col gap-2">
            {RECURRING_NOTIFY_MODES.map((m) => (
              <button
                key={m.key}
                type="button"
                onClick={() => setRecurringNotifyMode(m.key)}
                className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 ${
                  recurringNotifyMode === m.key ? "border-primary bg-primary/[0.06]" : "border-text/15 bg-bg hover:border-primary/30"
                }`}
              >
                <span
                  className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                    recurringNotifyMode === m.key ? "border-primary bg-primary text-white" : "border-text/25"
                  }`}
                >
                  {recurringNotifyMode === m.key && <CheckIcon className="h-2.5 w-2.5" />}
                </span>
                <span>
                  <span className="block text-sm font-semibold text-text">{m.label}</span>
                  <span className="mt-0.5 block text-xs text-muted">{m.caption}</span>
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-white p-3.5 text-xs text-muted shadow-soft">
        <span className="font-semibold text-muted">Preview: </span>
        "{title.trim() || "Live Class"}" for {course?.title || "this course"} is scheduled {previewDateLabel} at {time ? formatTime12(time) : "a chosen time"}, {duration} minutes.{" "}
        {notifyMode === "now" ? "Enrolled students are notified as soon as this is saved." : "Enrolled students are reminded closer to the session."}
        {time && duration ? ` Ends around ${formatTime12(addMinutesToTime(time, duration))}.` : ""}
      </div>
    </div>
  );
}
