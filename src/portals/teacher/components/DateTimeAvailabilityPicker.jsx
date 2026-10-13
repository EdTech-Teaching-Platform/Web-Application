import { DURATION_OPTIONS, formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import { AlertTriangleIcon, ClockIcon, InfoIcon, UsersIcon } from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

// DateTimeAvailabilityPicker — the date/time surface shared by Scheduled
// Call Booking and Reschedule. Leads with the educator's own open slots as
// tappable "suggested time" chips (so booking into published availability
// is one tap), but always lets them drop into a manual date/start/duration
// combination too — outside-availability times aren't blocked, just
// flagged, per the platform's actual scheduling rule.
export default function DateTimeAvailabilityPicker({
  date,
  start,
  duration,
  onChangeDate,
  onChangeStart,
  onChangeDuration,
  suggestedSlots = [],
  isAdHoc,
  conflict,
  originalLabel,
  minDate,
}) {
  const isSelected = (s) => s.date === date && s.start === start;

  return (
    <div className="flex flex-col gap-4">
      {originalLabel && (
        <div className="flex items-center gap-2 text-xs font-medium text-muted">
          <ClockIcon className="h-3.5 w-3.5 shrink-0" />
          <span>
            Was: <span className="font-semibold text-muted line-through decoration-text/30">{originalLabel}</span>
          </span>
        </div>
      )}

      {suggestedSlots.length > 0 && (
        <div>
          <span className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            Suggested — from your open availability
          </span>
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
            {suggestedSlots.map((s) => {
              const active = isSelected(s);
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => {
                    onChangeDate(s.date);
                    onChangeStart(s.start);
                  }}
                  className={`flex shrink-0 flex-col items-start gap-0.5 rounded-xl px-3.5 py-2 text-left transition-colors duration-150 ${
                    active ? "bg-primary text-white" : "bg-primary/[0.07] text-primary ring-1 ring-primary/20 hover:bg-primary/[0.13]"
                  }`}
                >
                  <span className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                    {formatDateLabel(s.date)}
                  </span>
                  <span className="text-sm font-semibold">{formatTime12(s.start)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">
          {suggestedSlots.length > 0 ? "Or pick a time manually" : "Date & time"}
        </span>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Date</span>
            <input
              type="date"
              value={date}
              min={minDate}
              onChange={(e) => onChangeDate(e.target.value)}
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Start time</span>
            <input
              type="time"
              value={start}
              onChange={(e) => onChangeStart(e.target.value)}
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Duration</span>
            <Select
              wrapperClassName="block w-full"
              value={duration}
              onChange={(e) => onChangeDuration(Number(e.target.value))}
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {DURATION_OPTIONS.map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {conflict && (
        <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="font-semibold">This overlaps an existing session.</p>
            <p className="mt-0.5 flex items-center gap-1.5 text-danger/80">
              <UsersIcon className="h-3.5 w-3.5 shrink-0" />
              {conflict.existing.sessionType} · {formatDateLabel(conflict.existing.date)} · {formatTime12(conflict.existing.start)}
              {conflict.existing.bookings?.[0]?.studentName ? ` · ${conflict.existing.bookings[0].studentName}` : ""}
            </p>
          </div>
        </div>
      )}

      {!conflict && isAdHoc && date && start && (
        <div className="flex items-start gap-2.5 rounded-xl bg-warning/10 px-4 py-3 text-sm text-warning">
          <InfoIcon className="mt-0.5 h-4 w-4 shrink-0" />
          <p>This time is outside your published availability — the student will still be notified.</p>
        </div>
      )}
    </div>
  );
}
