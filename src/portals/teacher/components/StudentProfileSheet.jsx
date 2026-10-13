import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import AutoSaveIndicator from "../../../components/ui/AutoSaveIndicator";
import GradeSummaryCard from "./GradeSummaryCard";
import { LESSON_TYPE_META } from "./LessonRow";
import { STATUS_META } from "./StudentRosterCard";
import { relativeDate } from "./CoursePortfolioCard";
import { formatTime12, formatDateLabel } from "../data/teacherAvailability";
import {
  initials,
  atRiskReason,
  studentAssessments,
  studentBookings,
  bookingDisplayStatus,
  studentAttendanceForSlot,
  studentTimeline,
} from "../data/studentDirectory";
import {
  XIcon,
  AlertTriangleIcon,
  CertificateIcon,
  MegaphoneIcon,
  CheckIcon,
  CalendarIcon,
  AssignmentIcon,
  LockIcon,
} from "../../../components/ui/icons";

const TABS = [
  { key: "overview", label: "Overview" },
  { key: "progress", label: "Progress Detail" },
  { key: "assessments", label: "Assessments" },
  { key: "bookings", label: "Bookings & Sessions" },
  { key: "notes", label: "Notes" },
];

function findLesson(course, lessonId) {
  for (const m of course.modules) {
    const l = m.lessons.find((les) => les.id === lessonId);
    if (l) return l;
  }
  return null;
}

function EmptyNote({ text }) {
  return (
    <div className="rounded-3xl bg-white px-6 py-12 text-center shadow-soft">
      <p className="text-sm font-medium text-muted">{text}</p>
    </div>
  );
}

const ATTENDANCE_CLASS = {
  Present: "bg-success/12 text-success",
  Partial: "bg-warning/12 text-warning",
  Absent: "bg-danger/12 text-danger",
};

const TIMELINE_META = {
  enrolled: { Icon: CalendarIcon, label: (ev) => `Enrolled in ${ev.courseTitle}` },
  submitted: { Icon: AssignmentIcon, label: (ev) => `Submitted "${ev.title}" — ${ev.courseTitle}` },
  graded: { Icon: CertificateIcon, label: (ev) => `Graded${ev.score !== undefined ? ` ${ev.score}` : ""} on "${ev.title}" — ${ev.courseTitle}` },
  certificate: { Icon: CertificateIcon, label: (ev) => `Certificate issued — ${ev.courseTitle}` },
};

function TimelineRow({ ev }) {
  const meta = TIMELINE_META[ev.type];
  if (!meta) return null;
  const Icon = meta.Icon;
  return (
    <div className="flex items-start gap-3 py-2">
      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
        <Icon className="h-3.5 w-3.5" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-text">{meta.label(ev)}</p>
        <p className="text-xs text-muted">{relativeDate(ev.date)}</p>
      </div>
    </div>
  );
}

function OverviewTab({ entry, courses, navigate }) {
  const timeline = studentTimeline(entry, courses);
  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Courses ({entry.enrollments.length})</p>
        <div className="flex flex-col gap-2.5">
          {entry.enrollments.map((enr) => {
            const meta = STATUS_META[enr.completionStatus] ?? STATUS_META["not-started"];
            return (
              <button
                key={enr.courseId}
                type="button"
                onClick={() => navigate(`/teacher/coursemanagement/${enr.courseId}?tab=students&student=${encodeURIComponent(entry.name)}`)}
                className="flex items-center gap-3 rounded-2xl bg-white p-3.5 text-left transition-colors hover:bg-primary/[0.03] shadow-soft"
              >
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-xs font-bold text-primary">
                  {enr.courseTitle.slice(0, 1)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-text">{enr.courseTitle}</p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 w-24 overflow-hidden rounded-full bg-bg">
                      <div className="h-full rounded-full bg-primary" style={{ width: `${enr.progress}%` }} />
                    </div>
                    <span className="text-xs text-muted">{enr.progress}%</span>
                  </div>
                  <p className="mt-1 text-xs text-muted">
                    Enrolled {relativeDate(enr.enrolledAt)}
                    {enr.certificateIssued ? " · Certificate issued" : ""}
                  </p>
                </div>
                <StatusBadge status={meta.status} size="sm" showIcon={false}>
                  {meta.label}
                </StatusBadge>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted">Activity Timeline</p>
        {timeline.length === 0 ? (
          <EmptyNote text="No recorded activity yet." />
        ) : (
          <div className="flex flex-col divide-y divide-text/[0.06] rounded-2xl bg-white px-3.5 shadow-soft">
            {timeline.slice(0, 20).map((ev, i) => (
              <TimelineRow key={i} ev={ev} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ProgressTab({ entry, courses }) {
  const [courseId, setCourseId] = useState(entry.enrollments[0].courseId);

  useEffect(() => {
    setCourseId(entry.enrollments[0].courseId);
  }, [entry.key]);

  const enr = entry.enrollments.find((e) => e.courseId === courseId) || entry.enrollments[0];
  const course = courses.find((c) => c.id === enr.courseId);
  if (!course) return <EmptyNote text="Course not found." />;

  const flat = course.modules.flatMap((m) => m.lessons.map((l) => ({ ...l, moduleTitle: m.title })));
  const completeCount = Math.round((enr.progress / 100) * flat.length);
  const gradedSubmissions = (course.submissions || []).filter(
    (s) => s.status === "graded" && (s.studentId === enr.studentId || s.studentName === entry.name)
  );

  return (
    <div className="flex flex-col gap-4">
      {entry.enrollments.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {entry.enrollments.map((e) => (
            <button
              key={e.courseId}
              type="button"
              onClick={() => setCourseId(e.courseId)}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                courseId === e.courseId ? "border-primary bg-primary text-white" : "border-text/15 bg-white text-muted hover:border-primary/40"
              } hover:-translate-y-0.5 hover:shadow-soft`}
            >
              {e.courseTitle}
            </button>
          ))}
        </div>
      )}

      <div>
        <div className="mb-1.5 flex items-center justify-between text-xs text-muted">
          <span>{enr.progress}% complete</span>
          <span>
            {completeCount}/{flat.length} lessons
          </span>
        </div>
        <div className="h-2 w-full overflow-hidden rounded-full bg-white ring-1 ring-text/[0.06]">
          <div className="h-full rounded-full bg-primary transition-all duration-300" style={{ width: `${enr.progress}%` }} />
        </div>
      </div>

      {gradedSubmissions.length > 0 && (
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
            <CertificateIcon className="h-3.5 w-3.5" />
            Grades
          </p>
          <div className="flex flex-col gap-2">
            {gradedSubmissions.map((s) => {
              const lesson = findLesson(course, s.lessonId);
              const maxScore = s.type === "quiz" ? s.manualMaxScore ?? 10 : lesson?.maxScore ?? 100;
              return (
                <GradeSummaryCard
                  key={s.id}
                  title={lesson?.title || s.moduleTitle}
                  score={s.score}
                  maxScore={maxScore}
                  feedback={s.feedback}
                  gradedAt={s.gradedAt}
                  gradedBy={s.gradedBy}
                />
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1">
        {flat.map((lesson, i) => {
          const done = i < completeCount;
          const meta = LESSON_TYPE_META[lesson.type];
          return (
            <div key={lesson.id} className="flex items-center gap-3 rounded-2xl bg-white px-3.5 py-2.5 shadow-soft">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${
                  done ? "bg-success/15 text-success" : "bg-text/[0.06] text-muted"
                }`}
              >
                {done ? <CheckIcon className="h-3.5 w-3.5" /> : <meta.Icon className="h-3 w-3" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text">{lesson.title || "Untitled lesson"}</p>
                <p className="truncate text-xs text-muted">{lesson.moduleTitle}</p>
              </div>
              {!done && <span className="shrink-0 text-[11px] font-medium text-muted">Not started</span>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AssessmentsTab({ entry, courses, navigate }) {
  const rows = studentAssessments(entry, courses);
  if (rows.length === 0) return <EmptyNote text="No graded or drafted work yet." />;
  return (
    <div className="flex flex-col gap-4">
      {rows.map((s) => {
        const course = courses.find((c) => c.id === s.courseId);
        const lesson = course ? findLesson(course, s.lessonId) : null;
        const maxScore = s.type === "quiz" ? s.manualMaxScore ?? 10 : lesson?.maxScore ?? 100;
        return (
          <div key={s.id} className="flex flex-col gap-2">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium text-muted">{s.courseTitle}</p>
              <button
                type="button"
                onClick={() => navigate(`/teacher/coursemanagement/${s.courseId}?tab=grading`)}
                className="text-xs font-semibold text-primary hover:underline"
              >
                View in Grading
              </button>
            </div>
            <GradeSummaryCard
              title={lesson?.title || s.moduleTitle}
              score={s.score}
              maxScore={maxScore}
              feedback={s.feedback}
              gradedAt={s.gradedAt}
              gradedBy={s.gradedBy}
            />
          </div>
        );
      })}
    </div>
  );
}

function BookingsTab({ entry, slots }) {
  const bookings = studentBookings(entry, slots);
  if (bookings.length === 0) return <EmptyNote text="No sessions booked yet." />;
  return (
    <div className="flex flex-col gap-3">
      {bookings.map((slot) => {
        const meta = bookingDisplayStatus(slot);
        const attendance = studentAttendanceForSlot(slot, entry.name);
        const booking = (slot.bookings || []).find((b) => b.studentName === entry.name);
        return (
          <div key={slot.id} className="flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-soft">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="flex items-center gap-1.5 text-sm font-semibold text-text">
                  <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                  {slot.sessionType}
                  {booking?.sessionTag === "mentorship" && (
                    <span className="shrink-0 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-primary">
                      Mentorship
                    </span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-muted">
                  {formatDateLabel(slot.date, { weekday: "short", month: "short", day: "numeric" })} · {formatTime12(slot.start)}–{formatTime12(slot.end)}
                </p>
                {booking?.courseTitle && <p className="mt-0.5 truncate text-xs text-muted">{booking.courseTitle}</p>}
              </div>
              <StatusBadge status={meta.status} size="sm" showIcon={false}>
                {meta.label}
              </StatusBadge>
            </div>
            {attendance && (
              <span className={`inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${ATTENDANCE_CLASS[attendance.status] || "bg-text/[0.06] text-muted"}`}>
                {attendance.status}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

function NotesTab({ note, onNoteChange, saveStatus, savedAt }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
          <LockIcon className="h-3.5 w-3.5" />
          Private — only visible to you
        </p>
        <AutoSaveIndicator status={saveStatus} timestamp={savedAt} />
      </div>
      <RichTextEditor
        value={note}
        onChange={onNoteChange}
        placeholder="Jot down context about this student — what they respond well to, what they struggle with, anything worth remembering for next time…"
        minHeight={220}
      />
    </div>
  );
}

// StudentProfileSheet — the full cross-course relationship view opened
// from "View Full Profile", spanning every course this student shares
// with the educator (deeper than StudentProgressDrawer, which stays
// scoped to one course's Students tab). Same right-edge drawer shell/
// motion as StudentProgressDrawer; becomes a full-width sheet on mobile
// automatically since its max width only applies from sm: up.
export default function StudentProfileSheet({
  entry,
  courses,
  slots,
  note,
  noteSaveStatus,
  noteSavedAt,
  onNoteChange,
  onClose,
}) {
  const navigate = useNavigate();
  const [entered, setEntered] = useState(false);
  const [tab, setTab] = useState("overview");
  const open = Boolean(entry);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    setTab("overview");
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, entry?.key]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const reason = atRiskReason(entry, courses);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-text/50 transition-opacity duration-200 ease-out ${entered ? "opacity-100" : "opacity-0"}`}
      />
      <div
        className={`relative flex h-full w-full max-w-2xl flex-col overflow-hidden rounded-l-3xl bg-bg shadow-elevated transition-transform duration-200 ease-out ${
          entered ? "translate-x-0" : "translate-x-4 opacity-0"
        }`}
      >
        <div className="flex shrink-0 flex-col gap-4 border-b border-text/[0.07] bg-white px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/10 text-base font-semibold text-primary">
                {initials(entry.name)}
              </span>
              <div className="min-w-0">
                <p className="flex flex-wrap items-center gap-2 text-base font-semibold text-text">
                  <span className="truncate">{entry.name}</span>
                  {entry.atRisk && (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger/10 px-2 py-0.5 text-[11px] font-bold text-danger">
                      <AlertTriangleIcon className="h-3 w-3" /> At Risk
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-muted">
                  Enrolled {relativeDate(entry.enrolledAt)} · Active {relativeDate(entry.lastActive)}
                </p>
              </div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 rounded-full p-1.5 text-muted hover:bg-bg hover:text-text">
              <XIcon className="h-5 w-5" />
            </button>
          </div>

          {reason && (
            <div className="flex items-start gap-2 rounded-xl bg-danger/[0.06] px-3.5 py-2.5 text-xs text-danger">
              <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              {reason.text}
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => navigate("/teacher/messaging", { state: { composePrefill: { studentIds: [entry.key], source: "student-profile" } } })}>
              <MegaphoneIcon className="h-3.5 w-3.5" />
              Add to group announcement
            </Button>
          </div>

          <div className="-mx-1 flex gap-1 overflow-x-auto pt-1">
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  tab === t.key ? "bg-primary text-white" : "text-muted hover:bg-primary/[0.06] hover:text-text"
                } hover:-translate-y-0.5 hover:shadow-soft`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 sm:px-6">
          {tab === "overview" && <OverviewTab entry={entry} courses={courses} navigate={navigate} />}
          {tab === "progress" && <ProgressTab entry={entry} courses={courses} />}
          {tab === "assessments" && <AssessmentsTab entry={entry} courses={courses} navigate={navigate} />}
          {tab === "bookings" && <BookingsTab entry={entry} slots={slots} />}
          {tab === "notes" && <NotesTab note={note} onNoteChange={onNoteChange} saveStatus={noteSaveStatus} savedAt={noteSavedAt} />}
        </div>
      </div>
    </div>
  );
}
