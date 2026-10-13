import { useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import {
  resolveBookingTarget,
  addMinutesToTime,
  formatTime12,
  formatDateLabel,
  isoDate,
  toMinutes,
} from "../data/teacherAvailability";
import DateTimeAvailabilityPicker from "./DateTimeAvailabilityPicker";
import { TODAY } from "../data/teacherCourses";
import { AlertTriangleIcon, BookIcon, CalendarIcon, CheckIcon, SearchIcon, UsersIcon } from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

const EDUCATOR_NAME = "Ansh Mehra";

function initials(name) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("");
}

// Builds the searchable student directory from real enrolled-student
// records across every course this educator teaches (never a separate
// hardcoded list) — one entry per unique student name, with every course
// they're enrolled in attached so a multi-course student shows all of
// them.
function buildDirectory(courses) {
  const map = new Map();
  (courses || []).forEach((c) => {
    (c.students || []).forEach((s) => {
      if (!map.has(s.name)) map.set(s.name, { name: s.name, courses: [] });
      map.get(s.name).courses.push({ id: c.id, title: c.title });
    });
  });
  return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
}

// ScheduleCallModal — Scheduled Call Booking (educator-initiated). Opened
// either from the Availability calendar header ("+ Schedule Call", no
// preset — the educator searches their real enrolled students) or from a
// student row in Course Management's Students tab (presetStudent locks
// the student + course as a confirmed chip instead of a picker). Both
// paths write through the exact same TeacherAvailabilityContext.scheduleCall
// the calendar itself reads from, so a new booking appears everywhere
// immediately with zero separate state.
export default function ScheduleCallModal({
  open,
  onClose,
  courses,
  slots,
  sessionTypes,
  presetStudent,
  onSchedule,
  onViewBooking,
  // Optional context tag (e.g. "mentorship") carried straight through onto
  // the created booking, plus a matching default session type -- lets a
  // caller like the Mentorship Hub open this exact same flow but have the
  // resulting session show up tagged wherever bookings are listed
  // (Availability calendar, agenda view, Student Management's Bookings &
  // Sessions tab) instead of reading as a plain call.
  extraBookingFields,
  presetSessionType,
}) {
  const directory = useMemo(() => (presetStudent ? [] : buildDirectory(courses)), [courses, presetStudent]);

  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(presetStudent ? { name: presetStudent.studentName, courses: [{ id: presetStudent.courseId, title: presetStudent.courseTitle }] } : null);
  const [courseId, setCourseId] = useState(presetStudent?.courseId || null);
  const [sessionType, setSessionType] = useState(presetSessionType || sessionTypes[0]);
  const [date, setDate] = useState(isoDate(TODAY));
  const [start, setStart] = useState("10:00");
  const [duration, setDuration] = useState(30);
  const [note, setNote] = useState("");
  const [step, setStep] = useState("form"); // form | success
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);
  const [resultSlot, setResultSlot] = useState(null);
  const [resultIsAdHoc, setResultIsAdHoc] = useState(false);

  const end = addMinutesToTime(start, duration);

  const matches = useMemo(() => {
    if (!query.trim()) return directory.slice(0, 6);
    const q = query.trim().toLowerCase();
    return directory.filter((d) => d.name.toLowerCase().includes(q));
  }, [directory, query]);

  const suggestedSlots = useMemo(
    () =>
      slots
        .filter((s) => s.status === "open" && (s.date > isoDate(TODAY) || (s.date === isoDate(TODAY) && toMinutes(s.start) >= toMinutes("00:00"))))
        .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
        .slice(0, 6),
    [slots]
  );

  const { exactOpenSlot, conflict } = useMemo(
    () => (date && start ? resolveBookingTarget(slots, { date, start, end }) : { exactOpenSlot: null, conflict: null }),
    [slots, date, start, end]
  );
  const isAdHoc = Boolean(date && start && !exactOpenSlot && !conflict);

  const chosenCourseTitle = selected?.courses.find((c) => c.id === courseId)?.title;
  const canSubmit = Boolean(selected && courseId && sessionType && date && start && !conflict);

  function reset() {
    setQuery("");
    if (!presetStudent) setSelected(null);
    setCourseId(presetStudent?.courseId || null);
    setSessionType(presetSessionType || sessionTypes[0]);
    setDate(isoDate(TODAY));
    setStart("10:00");
    setDuration(30);
    setNote("");
    setStep("form");
    setErrorMsg(null);
    setResultSlot(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  function pickStudent(d) {
    setSelected(d);
    setCourseId(d.courses.length === 1 ? d.courses[0].id : null);
    setQuery("");
  }

  function handleSubmit() {
    if (!canSubmit) return;
    setSubmitting(true);
    setErrorMsg(null);
    window.setTimeout(() => {
      const result = onSchedule({
        studentName: selected.name,
        courseId,
        courseTitle: chosenCourseTitle,
        sessionType,
        date,
        startTime: start,
        endTime: end,
        note,
        ...(extraBookingFields || {}),
      });
      setSubmitting(false);
      if (!result.ok) {
        setErrorMsg(
          result.conflict
            ? `Overlaps ${result.conflict.existing.sessionType} at ${formatTime12(result.conflict.existing.start)} on ${formatDateLabel(result.conflict.existing.date)}.`
            : "Couldn't schedule this call — try a different time."
        );
        return;
      }
      setResultSlot(result.slot);
      setResultIsAdHoc(result.isAdHoc);
      setStep("success");
    }, 500);
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={step === "success" ? "Call scheduled" : "Schedule a call"}
      size="xl"
      footer={
        step === "success" ? (
          <>
            <Button
              fullWidth={false}
              className="px-6"
              onClick={() => {
                onViewBooking?.(resultSlot);
                handleClose();
              }}
            >
              View Booking
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={handleClose}>
              Done
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth={false} className="px-6" disabled={!canSubmit || submitting} onClick={handleSubmit}>
              {submitting ? "Scheduling…" : "Schedule Call"}
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
          heading={`Booked with ${selected?.name.split(" ")[0]}`}
          message={`${formatDateLabel(resultSlot.date, { weekday: "long", month: "long", day: "numeric" })} · ${formatTime12(resultSlot.start)}–${formatTime12(
            resultSlot.end
          )}${resultIsAdHoc ? " — outside your published hours, so they've been notified this is a one-off time." : ""} They've been notified.`}
        />
      ) : (
        <div className="flex flex-col gap-5">
          {errorMsg && (
            <div className="flex items-start gap-2.5 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
              <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
              {errorMsg}
            </div>
          )}

          {extraBookingFields?.sessionTag === "mentorship" && (
            <div className="flex items-center gap-2 rounded-xl bg-primary/[0.06] px-4 py-2.5 text-xs font-semibold text-primary">
              <UsersIcon className="h-3.5 w-3.5" />
              This will be scheduled as a mentorship check-in
            </div>
          )}

          {/* Student + course */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Student</span>
            {presetStudent ? (
              <div className="flex items-center gap-2.5 rounded-xl bg-primary/[0.06] px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initials(selected.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{selected.name}</p>
                  <p className="truncate text-xs text-muted">{chosenCourseTitle}</p>
                </div>
                <CheckIcon className="h-4 w-4 shrink-0 text-primary" />
              </div>
            ) : selected ? (
              <div className="flex items-center gap-2.5 rounded-xl bg-primary/[0.06] px-4 py-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                  {initials(selected.name)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-text">{selected.name}</p>
                  <p className="truncate text-xs text-muted">{selected.courses.map((c) => c.title).join(", ")}</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelected(null);
                    setCourseId(null);
                  }}
                  className="shrink-0 text-xs font-semibold text-primary hover:underline"
                >
                  Change
                </button>
              </div>
            ) : (
              <div className="relative">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search your enrolled students…"
                  className="w-full rounded-xl border border-text/15 bg-bg py-2.5 pl-10 pr-4 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
                />
                {matches.length > 0 && (
                  <div className="mt-2 flex max-h-52 flex-col gap-1 overflow-y-auto rounded-2xl bg-white p-1.5 shadow-soft">
                    {matches.map((d) => (
                      <button
                        key={d.name}
                        type="button"
                        onClick={() => pickStudent(d)}
                        className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-left transition-colors hover:bg-bg"
                      >
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {initials(d.name)}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-text">{d.name}</p>
                          <p className="truncate text-xs text-muted">{d.courses.map((c) => c.title).join(", ")}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
                {matches.length === 0 && query.trim() && (
                  <p className="mt-2 px-1 text-xs text-muted">No enrolled students match "{query}".</p>
                )}
              </div>
            )}
          </div>

          {selected && !presetStudent && selected.courses.length > 1 && (
            <div>
              <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
                <BookIcon className="h-3.5 w-3.5 text-muted" />
                Which course is this about?
              </span>
              <div className="flex flex-wrap gap-2">
                {selected.courses.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCourseId(c.id)}
                    className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      courseId === c.id ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
                    } hover:-translate-y-0.5 hover:shadow-soft`}
                  >
                    {c.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Session type */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Session type</span>
            <Select
              wrapperClassName="block w-full"
              value={sessionType}
              onChange={(e) => setSessionType(e.target.value)}
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {sessionTypes.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </Select>
          </div>

          {/* Date & time */}
          <DateTimeAvailabilityPicker
            date={date}
            start={start}
            duration={duration}
            onChangeDate={setDate}
            onChangeStart={setStart}
            onChangeDuration={setDuration}
            suggestedSlots={suggestedSlots}
            isAdHoc={isAdHoc}
            conflict={conflict}
            minDate={isoDate(TODAY)}
          />

          {/* Note */}
          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Note for the student (optional)</span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="e.g. Let's review your last assignment"
              className="w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {/* Preview of what the student sees */}
          {selected && courseId && date && start && (
            <div className="rounded-2xl bg-bg p-4">
              <span className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
                <UsersIcon className="h-3.5 w-3.5" />
                What {selected.name.split(" ")[0]} will see
              </span>
              <div className="rounded-2xl bg-white p-3.5 shadow-soft">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  {sessionType} with {EDUCATOR_NAME}
                </p>
                <p className="mt-1 text-xs text-muted">
                  {formatDateLabel(date, { weekday: "long", month: "long", day: "numeric" })} · {formatTime12(start)}–{formatTime12(end)}
                </p>
                <p className="mt-0.5 truncate text-xs text-muted">{chosenCourseTitle}</p>
                {note.trim() && <p className="mt-1.5 text-xs italic text-muted">"{note.trim()}"</p>}
              </div>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
