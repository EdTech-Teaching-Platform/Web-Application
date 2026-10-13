// Announcements — one-to-many group messaging hub (Compose, Sent,
// Scheduled, Drafts, Templates, Groups). Students never reply in-app, so
// there are no conversations: every message is a broadcast to an audience.
// All state lives in MessagingContext (mounted above the routes) so a
// half-written message, drafts and history survive navigating away.
//
// Other screens can open Compose with an audience pre-filled by navigating
// to /teacher/messaging with router state:
//   { composePrefill: { studentIds: [...], source: "at-risk", subject?: string, courseIds?: [...], groupIds?: [...] } }
// studentIds accepts roster keys (lower-cased student name) or enrolment ids.
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { useMessaging } from "../context/MessagingContext";
import ShareNotesLinkPanel from "../components/ShareNotesLinkPanel";
import BroadcastComposerPanel from "../components/BroadcastComposerPanel";
import BroadcastSentTab from "../components/BroadcastSentTab";
import BroadcastScheduledTab from "../components/BroadcastScheduledTab";
import BroadcastDraftsTab from "../components/BroadcastDraftsTab";
import BroadcastTemplatesTab from "../components/BroadcastTemplatesTab";
import BroadcastGroupsTab from "../components/BroadcastGroupsTab";
import { useAudienceEnv } from "../components/BroadcastShared";
import Button from "../../../components/ui/Button";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import { LinkIcon } from "../../../components/ui/icons";
import { composeIsBlank, emptyAudience, emptyCompose } from "../data/messagingData";

const TABS = ["Compose", "Sent", "Scheduled", "Drafts", "Templates", "Groups"];

function Toast({ message }) {
  if (!message) return null;
  return (
    <div role="status" className="fixed bottom-6 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">
      {message}
    </div>
  );
}

function tabFromParam(value) {
  return TABS.find((t) => t.toLowerCase() === (value || "").toLowerCase()) || "Compose";
}

export default function Messaging() {
  const { courses } = useTeacherCourses();
  const { compose, setCompose, loadCompose, saveDraft, postShareLinkToCourse, logShareLink, scheduled, drafts, sent } = useMessaging();
  const env = useAudienceEnv();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [tab, setTabState] = useState(() => tabFromParam(searchParams.get("tab")));
  const [shareOpen, setShareOpen] = useState(false);
  const [toast, setToast] = useState("");

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2800);
  }

  function setTab(next) {
    setTabState(next);
    setSearchParams(next === "Compose" ? {} : { tab: next.toLowerCase() }, { replace: true });
  }

  // Receive an audience pre-fill from other screens (At-Risk, Test Series, ...).
  useEffect(() => {
    const prefill = location.state?.composePrefill;
    if (!prefill) return;
    setCompose((prev) => {
      const a = prev.audience;
      const union = (x, y) => Array.from(new Set([...(x || []), ...(y || [])]));
      return {
        audience: {
          ...a,
          studentIds: union(a.studentIds, prefill.studentIds),
          studentSource: prefill.source || a.studentSource,
          courseIds: union(a.courseIds, prefill.courseIds),
          groupIds: union(a.groupIds, prefill.groupIds),
          seriesIds: union(a.seriesIds, prefill.seriesIds),
        },
        subject: prefill.subject && !prev.subject ? prefill.subject : prev.subject,
      };
    });
    setTabState("Compose");
    setSearchParams({}, { replace: true });
    navigate(location.pathname, { replace: true, state: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // Never lose in-progress work when another item is loaded into Compose.
  function load(form) {
    if (!composeIsBlank(compose) && !compose.scheduledId) saveDraft(compose);
    loadCompose(form);
    setTab("Compose");
  }

  function applyTemplate(t) {
    setCompose({ type: t.type, subject: t.subject, bodyHtml: t.bodyHtml, editorKey: Date.now() });
    setTab("Compose");
    flash(`Applied "${t.name}".`);
  }

  function messageGroup(g) {
    load({ ...emptyCompose(), audience: { ...emptyAudience(), groupIds: [g.id] } });
  }

  return (
    <div className="pb-16">
      <div className="mb-5 flex flex-col gap-4 rounded-3xl bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="eyebrow mb-1.5">Group messaging</div>
            <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Announcements</h1>
            <p className="mt-1 max-w-xl text-sm text-muted">Send updates, reminders and alerts to groups of students. Students receive them in the portal and never reply here.</p>
          </div>
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => setShareOpen(true)}>
            <LinkIcon className="h-3.5 w-3.5" />
            Share Notes Link
          </Button>
        </div>
        <div className="-mx-1 overflow-x-auto px-1 pb-1">
          <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        </div>
        <p className="text-xs text-muted">
          {sent.length} sent · {scheduled.length} scheduled · {drafts.length} draft{drafts.length === 1 ? "" : "s"}
        </p>
      </div>

      {tab === "Compose" && <BroadcastComposerPanel env={env} onGoTab={setTab} onToast={flash} />}
      {tab === "Sent" && <BroadcastSentTab env={env} onDuplicate={load} onGoCompose={() => setTab("Compose")} onToast={flash} />}
      {tab === "Scheduled" && <BroadcastScheduledTab env={env} onEdit={load} onGoCompose={() => setTab("Compose")} onToast={flash} />}
      {tab === "Drafts" && <BroadcastDraftsTab env={env} onResume={load} onGoCompose={() => setTab("Compose")} onToast={flash} />}
      {tab === "Templates" && <BroadcastTemplatesTab onUse={applyTemplate} onToast={flash} />}
      {tab === "Groups" && <BroadcastGroupsTab env={env} onSendToGroup={messageGroup} onToast={flash} />}

      <ShareNotesLinkPanel
        open={shareOpen}
        courses={courses}
        onClose={() => setShareOpen(false)}
        onShareToCourse={(courseId, payload) => {
          postShareLinkToCourse(courseId, payload);
          flash("Link shared with the course.");
        }}
        onLogShare={logShareLink}
      />

      <Toast message={toast} />
    </div>
  );
}
