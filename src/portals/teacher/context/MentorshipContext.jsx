import { createContext, useContext, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { useTeacherCourses } from "./TeacherCoursesContext";
import { seedApplications, seedMentorships, defaultSettings } from "../data/mentorshipData";

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// MentorshipContext — the single source of truth for mentorship
// Applications, active/past mentorship Programs, and the educator's
// Program Settings, shared across every Mentorship Hub view (Applications,
// Dashboard, per-mentee Program, Settings) so an accept/decline, a
// milestone edit, or a settings change is immediately reflected everywhere
// it's shown. Seeded once from TeacherCoursesContext's real courses/
// students, same nesting precedent the Announcements context and
// TeacherAvailabilityContext already established. Nested inside
// TeacherAvailabilityProvider (not just TeacherCoursesProvider) since
// "Schedule Check-In" reads/writes that same booking-slot list directly.
const MentorshipContext = createContext(null);

export function MentorshipProvider() {
  const { courses } = useTeacherCourses();

  const [applications, setApplications] = useState(() => seedApplications(courses));
  const [mentorships, setMentorships] = useState(() => seedMentorships(courses));
  const [settings, setSettings] = useState(defaultSettings);

  function updateApplication(applicationId, patch) {
    setApplications((prev) => prev.map((a) => (a.id === applicationId ? { ...a, ...patch } : a)));
  }

  // Decline / request-info are structured responses recorded on the
  // application itself (reason + optional note) -- never a chat message.
  function declineApplication(applicationId, reason, note) {
    updateApplication(applicationId, { status: "declined", declineReason: reason || "", declineNote: note || "", declinedAt: new Date().toISOString().slice(0, 10) });
  }

  function markUnderReview(applicationId) {
    updateApplication(applicationId, { status: "under_review" });
  }

  function markInfoRequested(applicationId, reason, note) {
    updateApplication(applicationId, {
      status: "under_review",
      infoRequestedAt: new Date().toISOString().slice(0, 10),
      infoRequestReason: reason || "",
      infoRequestNote: note || "",
    });
  }

  // Accepting an application turns it into a real Mentorship program —
  // the one place an application becomes a mentee.
  function acceptApplication(applicationId, programData) {
    const app = applications.find((a) => a.id === applicationId);
    if (!app) return null;
    const mentorship = {
      id: id("ment"),
      studentId: app.studentId,
      studentName: app.studentName,
      courseId: app.courseId,
      courseTitle: app.courseTitle,
      focusArea: programData.focusArea,
      status: "active",
      cadence: programData.cadence,
      duration: programData.duration,
      startDate: new Date().toISOString().slice(0, 10),
      goalsAtApplication: app.goals,
      milestones: programData.milestones.map((m) => ({ id: id("ms"), completedAt: null, reflection: "", ...m })),
      resources: [],
      reflections: [],
      menteeReflections: [],
      pausedReason: null,
      pausedAt: null,
      endedNote: null,
      completedAt: null,
      completionSummary: null,
      certificateIssued: false,
    };
    setMentorships((prev) => [mentorship, ...prev]);
    updateApplication(applicationId, { status: "accepted" });
    return mentorship;
  }

  function updateMentorship(mentorshipId, patch) {
    setMentorships((prev) =>
      prev.map((m) => (m.id === mentorshipId ? { ...m, ...(typeof patch === "function" ? patch(m) : patch) } : m))
    );
  }

  function addMilestone(mentorshipId, milestone) {
    updateMentorship(mentorshipId, (m) => ({
      ...m,
      milestones: [...m.milestones, { id: id("ms"), completedAt: null, reflection: "", ...milestone }],
    }));
  }

  function updateMilestoneField(mentorshipId, milestoneId, patch) {
    updateMentorship(mentorshipId, (m) => ({
      ...m,
      milestones: m.milestones.map((ms) => (ms.id === milestoneId ? { ...ms, ...patch } : ms)),
    }));
  }

  function removeMilestone(mentorshipId, milestoneId) {
    updateMentorship(mentorshipId, (m) => ({ ...m, milestones: m.milestones.filter((ms) => ms.id !== milestoneId) }));
  }

  function reorderMilestones(mentorshipId, nextMilestones) {
    updateMentorship(mentorshipId, { milestones: nextMilestones });
  }

  // Marking complete also clears any stale "current position" flag from
  // the milestone that just finished, and hands the next not-yet-complete
  // milestone the current marker so the roadmap's position indicator keeps
  // moving forward automatically.
  function completeMilestone(mentorshipId, milestoneId, reflection) {
    updateMentorship(mentorshipId, (m) => {
      const idx = m.milestones.findIndex((ms) => ms.id === milestoneId);
      const milestones = m.milestones.map((ms, i) => {
        if (ms.id === milestoneId) {
          return { ...ms, completedAt: new Date().toISOString().slice(0, 10), reflection: reflection || ms.reflection, current: false };
        }
        return ms;
      });
      const next = milestones.find((ms, i) => i > idx && !ms.completedAt);
      if (next) {
        return { ...m, milestones: milestones.map((ms) => (ms.id === next.id ? { ...ms, current: true } : ms)) };
      }
      return { ...m, milestones };
    });
  }

  function addReflection(mentorshipId, html) {
    updateMentorship(mentorshipId, (m) => ({ ...m, reflections: [{ id: id("ref"), at: new Date().toISOString().slice(0, 10), html }, ...m.reflections] }));
  }

  function shareResource(mentorshipId, item) {
    updateMentorship(mentorshipId, (m) => ({ ...m, resources: [item, ...m.resources] }));
  }

  function pauseMentorship(mentorshipId, reason) {
    updateMentorship(mentorshipId, { status: "paused", pausedReason: reason, pausedAt: new Date().toISOString().slice(0, 10) });
  }

  function resumeMentorship(mentorshipId) {
    updateMentorship(mentorshipId, { status: "active", pausedReason: null, pausedAt: null });
  }

  function endMentorshipEarly(mentorshipId, note) {
    updateMentorship(mentorshipId, { status: "ended_early", endedNote: note, completedAt: new Date().toISOString().slice(0, 10) });
  }

  function completeMentorship(mentorshipId, summary, issueCertificate) {
    updateMentorship(mentorshipId, {
      status: "completed",
      completionSummary: summary,
      completedAt: new Date().toISOString().slice(0, 10),
      certificateIssued: Boolean(issueCertificate),
    });
  }

  function updateProgramDetails(mentorshipId, patch) {
    updateMentorship(mentorshipId, patch);
  }

  function updateSettings(patch) {
    setSettings((prev) => ({ ...prev, ...patch }));
  }

  const value = useMemo(
    () => ({
      applications,
      mentorships,
      settings,
      declineApplication,
      markUnderReview,
      markInfoRequested,
      acceptApplication,
      addMilestone,
      updateMilestoneField,
      removeMilestone,
      reorderMilestones,
      completeMilestone,
      addReflection,
      shareResource,
      pauseMentorship,
      resumeMentorship,
      endMentorshipEarly,
      completeMentorship,
      updateProgramDetails,
      updateSettings,
    }),
    [applications, mentorships, settings]
  );

  return (
    <MentorshipContext.Provider value={value}>
      <Outlet />
    </MentorshipContext.Provider>
  );
}

export function useMentorship() {
  const ctx = useContext(MentorshipContext);
  if (!ctx) throw new Error("useMentorship must be used within MentorshipProvider");
  return ctx;
}
