import { useMemo, useState } from "react";
import { useMentorship } from "../context/MentorshipContext";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { useTeacherAvailability } from "../context/TeacherAvailabilityContext";
import StatCard from "../../../components/ui/StatCard";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import ScheduleCallModal from "../components/ScheduleCallModal";
import MentorshipApplicationCard from "../components/MentorshipApplicationCard";
import MentorshipApplicationDetail from "../components/MentorshipApplicationDetail";
import MentorshipPlanSetupModal from "../components/MentorshipPlanSetupModal";
import MentorshipMenteeCard from "../components/MentorshipMenteeCard";
import MentorshipProgramView from "../components/MentorshipProgramView";
import MentorshipSettingsPanel from "../components/MentorshipSettingsPanel";
import { relatedRosterEntry, mentorshipStats, upcomingItems } from "../data/mentorshipData";
import { formatDateLabel, formatTime12 } from "../data/teacherAvailability";
import {
  UsersIcon,
  ClockIcon,
  TrendingUpIcon,
  SparkleIcon,
  MentorIcon,
  GridIcon,
  RowsIcon,
  AlertTriangleIcon,
  CalendarIcon,
  SettingsIcon,
} from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

const HUB_TABS = [
  { key: "dashboard", label: "Dashboard" },
  { key: "applications", label: "Applications" },
  { key: "settings", label: "Settings" },
];

const MENTEE_STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "paused", label: "Paused" },
  { key: "completed", label: "Completed" },
  { key: "ended_early", label: "Ended Early" },
];

const APPLICATION_STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "new", label: "New" },
  { key: "under_review", label: "Under Review" },
  { key: "accepted", label: "Accepted" },
  { key: "declined", label: "Declined" },
];

function Toast({ message }) {
  if (!message) return null;
  return <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>;
}

function UpcomingPanel({ mentorships, slots }) {
  const items = useMemo(() => upcomingItems(mentorships, slots), [mentorships, slots]);
  return (
    <div className="rounded-3xl bg-white p-4 shadow-soft">
      <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
        <CalendarIcon className="h-3.5 w-3.5" />
        Upcoming (next 14 days)
      </p>
      {items.length === 0 ? (
        <p className="py-4 text-center text-sm text-muted">Nothing due soon.</p>
      ) : (
        <div className="flex flex-col divide-y divide-text/[0.06]">
          {items.map((it, i) => (
            <div key={i} className="flex items-center gap-3 py-2.5">
              <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${it.overdue ? "bg-danger/10 text-danger" : "bg-primary/[0.08] text-primary"}`}>
                {it.overdue ? <AlertTriangleIcon className="h-4 w-4" /> : it.kind === "checkin" ? <CalendarIcon className="h-4 w-4" /> : <MentorIcon className="h-4 w-4" />}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-text">
                  {it.kind === "checkin" ? "Check-in" : "Milestone"}: {it.title} — {it.studentName}
                </p>
                <p className="text-xs text-muted">
                  {formatDateLabel(it.date, { weekday: "short", month: "short", day: "numeric" })}
                  {it.time ? ` · ${formatTime12(it.time)}` : ""}
                  {it.overdue ? " · Overdue" : ""}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MentorshipHub() {
  const mentorship = useMentorship();
  const { courses } = useTeacherCourses();
  const { slots, sessionTypes, scheduleCall } = useTeacherAvailability();

  const { applications, mentorships, settings } = mentorship;

  const hasAnything = applications.length > 0 || mentorships.length > 0;
  const [tab, setTab] = useState("dashboard");
  const [programId, setProgramId] = useState(null);

  const [menteeFilter, setMenteeFilter] = useState("all");
  const [menteeSort, setMenteeSort] = useState("recent");
  const [displayMode, setDisplayMode] = useState("grid");

  const [appFilter, setAppFilter] = useState("all");
  const [appSort, setAppSort] = useState("newest");
  const [openApplication, setOpenApplication] = useState(null);
  const [planSetupApp, setPlanSetupApp] = useState(null);

  const [scheduleEntry, setScheduleEntry] = useState(null);
  const [toast, setToast] = useState("");

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  const stats = useMemo(() => mentorshipStats(mentorships), [mentorships]);
  const pendingApplicationsCount = applications.filter((a) => a.status === "new" || a.status === "under_review").length;
  const activeCount = mentorships.filter((m) => m.status === "active").length;

  const filteredMentorships = useMemo(() => {
    let list = mentorships;
    if (menteeFilter !== "all") list = list.filter((m) => m.status === menteeFilter);
    const sorted = [...list];
    if (menteeSort === "name") sorted.sort((a, b) => a.studentName.localeCompare(b.studentName));
    else if (menteeSort === "progress") sorted.sort((a, b) => b.startDate.localeCompare(a.startDate));
    else sorted.sort((a, b) => b.startDate.localeCompare(a.startDate));
    return sorted;
  }, [mentorships, menteeFilter, menteeSort]);

  const filteredApplications = useMemo(() => {
    let list = applications;
    if (appFilter !== "all") list = list.filter((a) => a.status === appFilter);
    const sorted = [...list];
    sorted.sort((a, b) => (appSort === "oldest" ? a.appliedAt.localeCompare(b.appliedAt) : b.appliedAt.localeCompare(a.appliedAt)));
    return sorted;
  }, [applications, appFilter, appSort]);

  function scheduleCheckIn(m) {
    setScheduleEntry(m);
  }

  const scheduleTarget = scheduleEntry;
  const presetStudent = scheduleTarget
    ? { studentName: scheduleTarget.studentName, courseId: scheduleTarget.courseId, courseTitle: scheduleTarget.courseTitle }
    : null;

  const openProgram = programId ? mentorships.find((m) => m.id === programId) : null;

  function handleAccept(app) {
    setOpenApplication(null);
    setPlanSetupApp(app);
  }

  function handlePlanConfirm(applicationId, programData) {
    const created = mentorship.acceptApplication(applicationId, programData);
    setPlanSetupApp(null);
    if (created) {
      flash(`${created.studentName} is now an active mentee.`);
      setTab("dashboard");
      setProgramId(created.id);
    }
  }

  function handleDecline(applicationId, reason, note) {
    mentorship.declineApplication(applicationId, reason, note);
  }

  function handleRequestInfo(app, reason, note) {
    mentorship.markInfoRequested(app.id, reason, note);
  }

  if (openProgram) {
    return (
      <div className="pb-16">
        <MentorshipProgramView
          mentorship={openProgram}
          slots={slots}
          onBack={() => setProgramId(null)}
          onScheduleCheckIn={scheduleCheckIn}
          onAddMilestone={mentorship.addMilestone}
          onUpdateMilestone={mentorship.updateMilestoneField}
          onRemoveMilestone={mentorship.removeMilestone}
          onReorderMilestones={mentorship.reorderMilestones}
          onCompleteMilestone={mentorship.completeMilestone}
          onAddReflection={mentorship.addReflection}
          onShareResource={mentorship.shareResource}
          onUpdateProgram={mentorship.updateProgramDetails}
          onPause={mentorship.pauseMentorship}
          onResume={mentorship.resumeMentorship}
          onEndEarly={mentorship.endMentorshipEarly}
          onComplete={mentorship.completeMentorship}
        />
        <ScheduleCallModal
          open={Boolean(scheduleEntry)}
          onClose={() => setScheduleEntry(null)}
          courses={[]}
          presetStudent={presetStudent}
          slots={slots}
          sessionTypes={sessionTypes}
          presetSessionType="Mentorship Check-In"
          extraBookingFields={scheduleTarget ? { sessionTag: "mentorship", mentorshipId: scheduleTarget.id } : undefined}
          onSchedule={scheduleCall}
          onViewBooking={() => flash(`Check-in booked with ${scheduleTarget?.studentName}.`)}
        />
        <Toast message={toast} />
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="eyebrow mb-1.5">Mentorship</div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Mentorship Hub</h1>
          <p className="mt-1 text-sm text-muted">Run structured, longer-term mentorship programs alongside your courses.</p>
        </div>
      </div>

      <div className="mb-6 flex flex-wrap gap-2">
        {HUB_TABS.map((t) => (
          <Chip key={t.key} active={tab === t.key} onClick={() => setTab(t.key)} className="flex items-center gap-1.5 px-4 py-2 text-sm">
            {t.key === "settings" && <SettingsIcon className="h-3.5 w-3.5" />}
            {t.label}
            {t.key === "applications" && pendingApplicationsCount > 0 && (
              <span className={`ml-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${tab === "applications" ? "bg-white/25 text-white" : "bg-primary/10 text-primary"}`}>
                {pendingApplicationsCount}
              </span>
            )}
          </Chip>
        ))}
      </div>

      {!hasAnything ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
            <MentorIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">No mentorship activity yet</p>
            <p className="mt-1 max-w-sm text-sm text-muted">
              Set up your mentorship pitch and application questions in Settings so students can apply — accepted applicants show up here as mentees.
            </p>
          </div>
          <Button fullWidth={false} className="mt-2 px-6" onClick={() => setTab("settings")}>
            Go to Settings
          </Button>
        </div>
      ) : (
        <>
          {tab === "dashboard" && (
            <div className="flex flex-col gap-6">
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <StatCard icon={UsersIcon} tone="blue" label="Active Mentorships" value={stats.active} />
                <StatCard icon={SparkleIcon} tone="lavender" label="Pending Applications" value={pendingApplicationsCount} />
                <StatCard icon={ClockIcon} tone="orange" label="Milestones Due This Week" value={stats.milestonesDueThisWeek} />
                <StatCard icon={TrendingUpIcon} tone="sage" label="Avg Completion" value={`${stats.avgCompletion}%`} ring={stats.avgCompletion} />
              </div>

              <div className="flex items-center justify-between rounded-xl bg-primary/[0.06] px-4 py-2.5">
                <span className="text-sm font-medium text-primary">
                  Capacity: {activeCount}/{settings.capacity} active mentees
                </span>
                {activeCount >= settings.capacity && (
                  <span className="text-xs font-semibold text-primary">
                    {settings.waitlistWhenFull ? "New applicants are waitlisted" : "New applications are hidden"}
                  </span>
                )}
              </div>

              <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-2">
                      {MENTEE_STATUS_FILTERS.map((f) => (
                        <Chip key={f.key} active={menteeFilter === f.key} onClick={() => setMenteeFilter(f.key)} className="px-3.5 py-1.5 text-xs">
                          {f.label}
                        </Chip>
                      ))}
                    </div>
                    <div className="flex items-center gap-2.5">
                      <Select
                        value={menteeSort}
                        onChange={(e) => setMenteeSort(e.target.value)}
                        className="rounded-full border border-text/15 bg-white px-4 py-2 pr-9 text-xs font-medium text-text outline-none focus:border-primary/40"
                      >
                        <option value="recent">Sort: Most Recent</option>
                        <option value="name">Sort: Name (A–Z)</option>
                      </Select>
                      <div className="flex items-center gap-1 rounded-full bg-text/[0.05] p-1">
                        <button
                          type="button"
                          aria-pressed={displayMode === "grid"}
                          onClick={() => setDisplayMode("grid")}
                          className={`rounded-full p-2 transition-all duration-200 ${displayMode === "grid" ? "bg-primary text-white" : "text-muted hover:text-text"} hover:-translate-y-0.5 hover:shadow-soft`}
                        >
                          <GridIcon className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          aria-pressed={displayMode === "list"}
                          onClick={() => setDisplayMode("list")}
                          className={`rounded-full p-2 transition-all duration-200 ${displayMode === "list" ? "bg-primary text-white" : "text-muted hover:text-text"} hover:-translate-y-0.5 hover:shadow-soft`}
                        >
                          <RowsIcon className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {filteredMentorships.length === 0 ? (
                    <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-soft">
                      <p className="text-sm font-medium text-muted">No mentees match this filter.</p>
                    </div>
                  ) : displayMode === "grid" ? (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      {filteredMentorships.map((m) => (
                        <MentorshipMenteeCard key={m.id} mentorship={m} slots={slots} viewMode="grid" onOpen={(mm) => setProgramId(mm.id)} onSchedule={scheduleCheckIn} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-3">
                      {filteredMentorships.map((m) => (
                        <MentorshipMenteeCard key={m.id} mentorship={m} slots={slots} viewMode="list" onOpen={(mm) => setProgramId(mm.id)} onSchedule={scheduleCheckIn} />
                      ))}
                    </div>
                  )}
                </div>

                <UpcomingPanel mentorships={mentorships} slots={slots} />
              </div>
            </div>
          )}

          {tab === "applications" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-2">
                  {APPLICATION_STATUS_FILTERS.map((f) => (
                    <Chip key={f.key} active={appFilter === f.key} onClick={() => setAppFilter(f.key)} className="px-3.5 py-1.5 text-xs">
                      {f.label}
                    </Chip>
                  ))}
                </div>
                <Select
                  value={appSort}
                  onChange={(e) => setAppSort(e.target.value)}
                  className="rounded-full border border-text/15 bg-white px-4 py-2 pr-9 text-xs font-medium text-text outline-none focus:border-primary/40"
                >
                  <option value="newest">Sort: Newest</option>
                  <option value="oldest">Sort: Oldest</option>
                </Select>
              </div>

              {filteredApplications.length === 0 ? (
                <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
                    <UsersIcon className="h-6 w-6" />
                  </span>
                  <p className="text-sm font-medium text-muted">No applications match this view.</p>
                </div>
              ) : (
                <div className="flex flex-col gap-3">
                  {filteredApplications.map((app) => (
                    <MentorshipApplicationCard key={app.id} application={app} rosterEntry={relatedRosterEntry(app.studentName, courses)} onOpen={setOpenApplication} />
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "settings" && <MentorshipSettingsPanel settings={settings} activeCount={activeCount} onUpdate={mentorship.updateSettings} />}
        </>
      )}

      <MentorshipApplicationDetail
        application={openApplication ? applications.find((a) => a.id === openApplication.id) || openApplication : null}
        rosterEntry={openApplication ? relatedRosterEntry(openApplication.studentName, courses) : null}
        activeMentorshipCount={activeCount}
        capacity={settings.capacity}
        onClose={() => setOpenApplication(null)}
        onAccept={handleAccept}
        onDecline={handleDecline}
        onRequestInfo={handleRequestInfo}
      />

      <MentorshipPlanSetupModal
        open={Boolean(planSetupApp)}
        application={planSetupApp}
        defaultCadence={settings.defaultCadence}
        defaultDuration={settings.defaultDuration}
        onClose={() => setPlanSetupApp(null)}
        onConfirm={handlePlanConfirm}
      />

      <ScheduleCallModal
        open={Boolean(scheduleEntry) && !openProgram}
        onClose={() => setScheduleEntry(null)}
        courses={[]}
        presetStudent={presetStudent}
        slots={slots}
        sessionTypes={sessionTypes}
        presetSessionType="Mentorship Check-In"
        extraBookingFields={scheduleTarget ? { sessionTag: "mentorship", mentorshipId: scheduleTarget.id } : undefined}
        onSchedule={scheduleCall}
        onViewBooking={() => flash(`Check-in booked with ${scheduleTarget?.studentName}.`)}
      />

      <Toast message={toast} />
    </div>
  );
}
