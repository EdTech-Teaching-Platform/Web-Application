import { createContext, useContext, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { useTeacherCourses } from "./TeacherCoursesContext";
import {
  buildStudentPool,
  emptyCompose,
  nowIso,
  seedAnnouncements,
  seedDrafts,
  seedGroups,
  seedScheduled,
  seedSent,
  seedShareLinkLog,
  seedTemplates,
  simulateRecipients,
} from "../data/messagingData";

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// MessagingContext — single source of truth for the Announcements hub
// (one-to-many broadcasts): the Compose form itself, Sent history,
// Scheduled, Drafts, Templates and student Groups, plus per-course
// Announcements and the Share Notes Link log. It stays mounted at the same
// level as before so all of it survives route changes. There are no 1-1
// conversations anywhere: students never reply in-app.
const MessagingContext = createContext(null);

export function MessagingProvider() {
  const { courses } = useTeacherCourses();

  const [compose, setComposeState] = useState(emptyCompose);
  const [sent, setSent] = useState(() => {
    const pool = buildStudentPool(courses);
    return seedSent(courses, pool, seedGroups(pool));
  });
  const [scheduled, setScheduled] = useState(() => seedScheduled(courses, buildStudentPool(courses)));
  const [drafts, setDrafts] = useState(() => seedDrafts(courses));
  const [templates, setTemplates] = useState(seedTemplates);
  const [groups, setGroups] = useState(() => seedGroups(buildStudentPool(courses)));
  const [announcementsByCourse, setAnnouncementsByCourse] = useState(() => seedAnnouncements(courses));
  const [shareLinkLog, setShareLinkLog] = useState(() => seedShareLinkLog());

  // -- Compose form ------------------------------------------------------
  function setCompose(patch) {
    setComposeState((prev) => ({ ...prev, ...(typeof patch === "function" ? patch(prev) : patch) }));
  }
  function loadCompose(form) {
    setComposeState({ ...emptyCompose(), ...form, editorKey: Date.now() });
  }
  function resetCompose() {
    setComposeState({ ...emptyCompose(), editorKey: Date.now() });
  }

  // -- Broadcast records -------------------------------------------------
  function recordFrom(form) {
    return {
      subject: form.subject.trim(),
      type: form.type,
      bodyHtml: form.bodyHtml,
      audience: form.audience,
      channels: form.channels,
      priority: form.priority,
      cta: form.cta?.enabled && form.cta.label.trim() && form.cta.link ? { label: form.cta.label.trim(), link: form.cta.link } : null,
      attachments: form.attachments,
    };
  }

  function touchGroups(audience) {
    const used = new Set([...(audience.groupIds || [])]);
    if (!used.size) return;
    const at = nowIso();
    setGroups((prev) => prev.map((g) => (used.has(g.id) ? { ...g, lastUsedAt: at } : g)));
  }

  function deliver(record, students) {
    const recId = id("bc");
    const entry = {
      ...record,
      id: recId,
      status: "sent",
      sentAt: nowIso(),
      resends: 0,
      recipients: simulateRecipients(students, recId, Boolean(record.cta)),
    };
    setSent((prev) => [entry, ...prev]);
    touchGroups(record.audience);
    return entry;
  }

  function sendBroadcast(form, students) {
    const entry = deliver(recordFrom(form), students);
    if (form.draftId) setDrafts((prev) => prev.filter((d) => d.draftId !== form.draftId));
    if (form.scheduledId) setScheduled((prev) => prev.filter((s) => s.id !== form.scheduledId));
    return entry;
  }

  function scheduleBroadcast(form, scheduledForIso) {
    const base = {
      ...recordFrom(form),
      scheduledFor: scheduledForIso,
      recurring: form.delivery.mode === "recurring" ? { frequency: form.delivery.frequency, until: form.delivery.until } : null,
    };
    const entry = { ...base, id: form.scheduledId || id("sch") };
    setScheduled((prev) => (form.scheduledId ? prev.map((s) => (s.id === form.scheduledId ? entry : s)) : [entry, ...prev]));
    if (form.draftId) setDrafts((prev) => prev.filter((d) => d.draftId !== form.draftId));
    return entry;
  }

  function rescheduleScheduled(scheduledId, iso) {
    setScheduled((prev) => prev.map((s) => (s.id === scheduledId ? { ...s, scheduledFor: iso } : s)));
  }

  function sendScheduledNow(scheduledId, students) {
    const item = scheduled.find((s) => s.id === scheduledId);
    if (!item) return null;
    const { id: _id, scheduledFor: _sf, recurring: _rc, ...record } = item;
    const entry = deliver(record, students);
    setScheduled((prev) =>
      prev.flatMap((s) => {
        if (s.id !== scheduledId) return [s];
        // A recurring reminder keeps its series; a one-off is consumed.
        if (!s.recurring) return [];
        const step = s.recurring.frequency === "daily" ? 1 : 7;
        const next = new Date(new Date(s.scheduledFor).getTime() + step * 86400000);
        return next.toISOString().slice(0, 10) > s.recurring.until ? [] : [{ ...s, scheduledFor: next.toISOString() }];
      })
    );
    return entry;
  }

  // Cancelling never loses work: the message goes back to Drafts.
  function cancelScheduled(scheduledId) {
    const item = scheduled.find((s) => s.id === scheduledId);
    if (!item) return;
    setScheduled((prev) => prev.filter((s) => s.id !== scheduledId));
    const form = scheduledToForm(item);
    setDrafts((prev) => [{ ...form, scheduledId: null, draftId: id("drf"), updatedAt: nowIso() }, ...prev]);
  }

  function resendToUnopened(broadcastId) {
    let count = 0;
    setSent((prev) =>
      prev.map((b) => {
        if (b.id !== broadcastId) return b;
        count = b.recipients.filter((r) => r.status !== "opened").length;
        return {
          ...b,
          resends: (b.resends || 0) + 1,
          lastResendAt: nowIso(),
          recipients: b.recipients.map((r) => (r.status === "failed" ? { ...r, status: "delivered" } : r)),
        };
      })
    );
    return count;
  }

  // -- Drafts ------------------------------------------------------------
  function saveDraft(form) {
    const draftId = form.draftId || id("drf");
    const { editorKey: _ek, ...rest } = form;
    const entry = { ...rest, draftId, updatedAt: nowIso() };
    setDrafts((prev) => (prev.some((d) => d.draftId === draftId) ? prev.map((d) => (d.draftId === draftId ? entry : d)) : [entry, ...prev]));
    return draftId;
  }
  function deleteDraft(draftId) {
    setDrafts((prev) => prev.filter((d) => d.draftId !== draftId));
    setComposeState((prev) => (prev.draftId === draftId ? { ...prev, draftId: null } : prev));
  }

  // -- Templates ----------------------------------------------------------
  function saveTemplate(tpl) {
    const entry = { builtIn: false, ...tpl, id: tpl.id || id("tpl"), updatedAt: nowIso() };
    setTemplates((prev) => (prev.some((t) => t.id === entry.id) ? prev.map((t) => (t.id === entry.id ? { ...t, ...entry } : t)) : [entry, ...prev]));
    return entry;
  }
  function duplicateTemplate(templateId) {
    const src = templates.find((t) => t.id === templateId);
    if (!src) return;
    setTemplates((prev) => [{ ...src, id: id("tpl"), name: `${src.name} (copy)`, builtIn: false, updatedAt: nowIso() }, ...prev]);
  }
  function deleteTemplate(templateId) {
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }

  // -- Groups ------------------------------------------------------------
  function saveGroup(group) {
    const entry = { lastUsedAt: null, ...group, id: group.id || id("grp") };
    setGroups((prev) => (prev.some((g) => g.id === entry.id) ? prev.map((g) => (g.id === entry.id ? { ...g, ...entry } : g)) : [entry, ...prev]));
    return entry;
  }
  function deleteGroup(groupId) {
    setGroups((prev) => prev.filter((g) => g.id !== groupId));
    // Scrub the deleted group from anything that still references it.
    const scrub = (a) => ({ ...a, groupIds: a.groupIds.filter((g) => g !== groupId), exclude: { ...a.exclude, groupIds: a.exclude.groupIds.filter((g) => g !== groupId) } });
    setComposeState((prev) => ({ ...prev, audience: scrub(prev.audience) }));
    setScheduled((prev) => prev.map((s) => ({ ...s, audience: scrub(s.audience) })));
    setDrafts((prev) => prev.map((d) => ({ ...d, audience: scrub(d.audience) })));
  }

  // -- Course-scoped announcements ----------------------------------------
  function postAnnouncement(courseId, announcement) {
    const entry = { id: id("an"), ...announcement };
    setAnnouncementsByCourse((prev) => ({ ...prev, [courseId]: [entry, ...(prev[courseId] || [])] }));
    return entry;
  }
  function updateAnnouncement(courseId, announcementId, patch) {
    setAnnouncementsByCourse((prev) => ({
      ...prev,
      [courseId]: (prev[courseId] || []).map((a) => (a.id === announcementId ? { ...a, ...patch } : a)),
    }));
  }
  function removeAnnouncement(courseId, announcementId) {
    setAnnouncementsByCourse((prev) => ({ ...prev, [courseId]: (prev[courseId] || []).filter((a) => a.id !== announcementId) }));
  }
  function duplicateAnnouncement(courseId, announcementId) {
    setAnnouncementsByCourse((prev) => {
      const list = prev[courseId] || [];
      const source = list.find((a) => a.id === announcementId);
      if (!source) return prev;
      const copy = { ...source, id: id("an"), title: `${source.title} (copy)`, status: "scheduled", postedAt: null };
      return { ...prev, [courseId]: [copy, ...list] };
    });
  }
  function postShareLinkToCourse(courseId, { url, label }) {
    return postAnnouncement(courseId, {
      kind: "link",
      title: label ? `Shared: ${label}` : "Shared a link",
      bodyHtml: "",
      url,
      attachment: null,
      status: "sent",
      postedAt: new Date().toISOString().slice(0, 10),
      scheduledAt: null,
    });
  }
  function logShareLink(entry) {
    setShareLinkLog((prev) => [{ id: id("sl"), sharedAt: new Date().toISOString().slice(0, 10), ...entry }, ...prev]);
  }

  const value = useMemo(
    () => ({
      compose,
      setCompose,
      loadCompose,
      resetCompose,
      sent,
      scheduled,
      drafts,
      templates,
      groups,
      announcementsByCourse,
      shareLinkLog,
      sendBroadcast,
      scheduleBroadcast,
      rescheduleScheduled,
      sendScheduledNow,
      cancelScheduled,
      resendToUnopened,
      saveDraft,
      deleteDraft,
      saveTemplate,
      duplicateTemplate,
      deleteTemplate,
      saveGroup,
      deleteGroup,
      postAnnouncement,
      updateAnnouncement,
      removeAnnouncement,
      duplicateAnnouncement,
      postShareLinkToCourse,
      logShareLink,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [compose, sent, scheduled, drafts, templates, groups, announcementsByCourse, shareLinkLog]
  );

  return (
    <MessagingContext.Provider value={value}>
      <Outlet />
    </MessagingContext.Provider>
  );
}

// A scheduled item back into the Compose form shape (Edit / Cancel).
export function scheduledToForm(item) {
  const d = new Date(item.scheduledFor);
  const pad = (n) => String(n).padStart(2, "0");
  return {
    ...emptyCompose(),
    scheduledId: item.id,
    type: item.type,
    audience: item.audience,
    subject: item.subject,
    bodyHtml: item.bodyHtml,
    attachments: item.attachments || [],
    cta: item.cta ? { enabled: true, label: item.cta.label, link: item.cta.link } : { enabled: false, label: "", link: "" },
    channels: item.channels,
    priority: item.priority,
    delivery: {
      mode: item.recurring ? "recurring" : "later",
      date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
      time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
      frequency: item.recurring?.frequency || "weekly",
      until: item.recurring?.until || "",
    },
  };
}

export function useMessaging() {
  const ctx = useContext(MessagingContext);
  if (!ctx) throw new Error("useMessaging must be used within MessagingProvider");
  return ctx;
}
