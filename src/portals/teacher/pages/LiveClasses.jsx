// Live Classes — the per-course scheduling home (Sec 5.6 rework). The
// sidebar's "Live Classes" nav item now lands here instead of going
// straight to a join screen: this page is where recurring/one-off
// live class schedules are created and managed, one per course. Video
// calling and recording happen in the educator's own meeting provider
// (Zoom, Google Meet, Teams...), so Join simply opens the session's meeting
// link in a new tab once it's time (Join unlocks 30 minutes before start,
// on the session's own day — data/liveJoin.js).
// The page has two views: "Overview" (per-course schedules + the
// month-paginated Upcoming Live Sessions panel) and "Calendar" (a
// live-classes-only Month/Week/Day calendar). Both read the same shared
// slots, so an Edit made in either shows up in both and in Availability.
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { useTeacherAvailability } from "../context/TeacherAvailabilityContext";
import { formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import { joinState, useNow } from "../data/liveJoin";
import { joinLiveSession } from "../data/meetingProviders";
import { describeSchedule } from "../data/liveClassScheduleData";
import ScheduleLiveClassPanel from "../components/ScheduleLiveClassPanel";
import ManageLiveClassSchedulePanel from "../components/ManageLiveClassSchedulePanel";
import UpcomingLiveSessionsPanel from "../components/UpcomingLiveSessionsPanel";
import LiveClassCalendar from "../components/LiveClassCalendar";
import EditLiveSessionModal from "../components/EditLiveSessionModal";
import { VideoIcon, UsersIcon, ClockIcon, RepeatIcon } from "../../../components/ui/icons";
import StatusBadge from "../../../components/ui/StatusBadge";
import SegmentedControl from "../../../components/ui/SegmentedControl";

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>
  );
}

export default function LiveClasses() {
  const { courses } = useTeacherCourses();
  const {
    slots,
    liveClassSchedules,
    createLiveClassSchedule,
    updateLiveClassSchedule,
    setLiveClassScheduleStatus,
    updateLiveClassOccurrence,
    cancelSlot,
  } = useTeacherAvailability();
  const [searchParams, setSearchParams] = useSearchParams();

  const [schedulingCourseId, setSchedulingCourseId] = useState(null);
  const [managingCourseId, setManagingCourseId] = useState(null);
  const [toast, setToast] = useState("");
  const [view, setView] = useState("Overview"); // Overview | Calendar
  const [editingSlot, setEditingSlot] = useState(null);
  const now = useNow(15000);

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2800);
  };

  const scheduleByCourse = useMemo(() => {
    const map = {};
    liveClassSchedules
      .filter((s) => s.status !== "ended")
      .forEach((s) => {
        map[s.courseId] = s;
      });
    return map;
  }, [liveClassSchedules]);

  function nextOccurrenceFor(scheduleId) {
    return slots
      .filter((s) => s.blockId === scheduleId && s.status === "booked" && joinState(s, now).state !== "ended")
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))[0];
  }

  // Deep-link support: entry points elsewhere in the app (Availability's
  // booking popover/agenda/upcoming panel, the Dashboard hero action,
  // Course Management Overview) navigate here with ?courseId=... — on
  // arrival, open that course's Schedule or Manage panel directly instead
  // of leaving the educator to find it in the grid themselves.
  useEffect(() => {
    const courseId = searchParams.get("courseId");
    if (!courseId) return;
    if (scheduleByCourse[courseId]) setManagingCourseId(courseId);
    else setSchedulingCourseId(courseId);
    const next = new URLSearchParams(searchParams);
    next.delete("courseId");
    setSearchParams(next, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const schedulingCourse = courses.find((c) => c.id === schedulingCourseId) || null;
  const managingCourse = courses.find((c) => c.id === managingCourseId) || null;
  const managingSchedule = managingCourseId ? scheduleByCourse[managingCourseId] : null;

  function handleCreate(config) {
    const res = createLiveClassSchedule(config);
    if (res.ok) flash(`Live class scheduled for ${config.courseTitle}.`);
    return res;
  }

  function handleJoin(slot) {
    const res = joinLiveSession(slot);
    if (!res.ok) flash(res.message);
  }

  // Single-occurrence edit (date/time/duration) — shared by the Edit modal
  // (Upcoming panel + calendar) and Manage Schedule's occurrence rows. It
  // writes the shared slot record, so the Upcoming panel re-sorts, the
  // calendar re-positions it and Availability reflects it right away.
  function handleEditOccurrence(slotId, patch) {
    const res = updateLiveClassOccurrence(slotId, patch);
    if (res.ok) flash("Session updated — your calendars are up to date.");
    return res;
  }

  return (
    <div className="flex flex-col gap-6 pb-10">
      <div>
        <div className="eyebrow mb-1.5">Teach live</div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Live Classes</h1>
        <p className="mt-1.5 text-sm text-muted">
          Set up a recurring or one-off live class for each course, then join it from here with your meeting link once it's time.
        </p>
      </div>

      {courses.length === 0 ? (
        <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
          <VideoIcon className="h-6 w-6 text-text/20" />
          <p className="mt-3 text-sm font-medium text-muted">Create a course first to schedule live classes for it.</p>
        </div>
      ) : (
        <>
        <SegmentedControl options={["Overview", "Calendar"]} value={view} onChange={setView} className="self-start" />
        {view === "Calendar" ? (
          <LiveClassCalendar
            onEditSession={setEditingSlot}
            onJoin={handleJoin}
            onCancelSession={(s) => {
              cancelSlot(s.id);
              flash("Session cancelled — enrolled students will be notified.");
            }}
            flash={flash}
          />
        ) : (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1fr_360px]">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {courses.map((course) => {
              const schedule = scheduleByCourse[course.id];
              const next = schedule ? nextOccurrenceFor(schedule.id) : null;
              return (
                <div key={course.id} className="flex flex-col gap-3 rounded-3xl bg-white p-5 shadow-soft">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-text">{course.title}</p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted">
                        <UsersIcon className="h-3 w-3" />
                        {course.students?.length || 0} enrolled
                      </p>
                    </div>
                    {schedule ? (
                      <StatusBadge status={schedule.status === "active" ? "success" : "warning"} size="sm" showIcon={false}>
                        {schedule.status === "active" ? "Scheduled" : "Paused"}
                      </StatusBadge>
                    ) : (
                      <StatusBadge status="neutral" size="sm" showIcon={false}>
                        None yet
                      </StatusBadge>
                    )}
                  </div>

                  {schedule ? (
                    <div className="rounded-xl bg-bg p-3.5">
                      <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                        {schedule.recurrence === "weekly" && <RepeatIcon className="h-3 w-3 text-muted" />}
                        {describeSchedule(schedule)}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-muted">
                        <ClockIcon className="h-3 w-3" />
                        {next
                          ? `Next: ${formatDateLabel(next.date, { weekday: "short", month: "short", day: "numeric" })} · ${formatTime12(next.start)}`
                          : "No upcoming occurrences left"}
                      </p>
                    </div>
                  ) : (
                    <p className="rounded-xl bg-bg p-3.5 text-xs text-muted">No live class scheduled for this course yet.</p>
                  )}

                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    {schedule ? (
                      <button
                        type="button"
                        onClick={() => setManagingCourseId(course.id)}
                        className="rounded-full bg-primary/[0.08] px-3.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.14]"
                      >
                        Manage Schedule
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setSchedulingCourseId(course.id)}
                        className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-soft"
                      >
                        Schedule Live Class
                      </button>
                    )}
                    {schedule && (
                      <button
                        type="button"
                        onClick={() => document.getElementById("upcoming-live-panel")?.scrollIntoView({ behavior: "smooth", block: "start" })}
                        className="rounded-full bg-text/[0.06] px-3.5 py-1.5 text-xs font-semibold text-muted hover:bg-text/[0.1]"
                      >
                        View Upcoming Sessions
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <UpcomingLiveSessionsPanel slots={slots} courses={courses} now={now} onEdit={setEditingSlot} onJoin={handleJoin} />
        </div>
        )}
        </>
      )}

      <ScheduleLiveClassPanel
        open={Boolean(schedulingCourse)}
        course={schedulingCourse}
        onClose={() => setSchedulingCourseId(null)}
        onCreate={handleCreate}
      />

      {managingCourse && managingSchedule && (
        <ManageLiveClassSchedulePanel
          open={Boolean(managingCourseId)}
          course={managingCourse}
          schedule={managingSchedule}
          slots={slots}
          onClose={() => setManagingCourseId(null)}
          onUpdateSchedule={updateLiveClassSchedule}
          onSetStatus={setLiveClassScheduleStatus}
          onCancelOccurrence={(slotId) => {
            cancelSlot(slotId);
            flash("Occurrence cancelled — enrolled students will be notified.");
          }}
          onEditOccurrence={handleEditOccurrence}
        />
      )}

      <EditLiveSessionModal slot={editingSlot} onClose={() => setEditingSlot(null)} onSave={handleEditOccurrence} />

      <Toast message={toast} />
    </div>
  );
}
