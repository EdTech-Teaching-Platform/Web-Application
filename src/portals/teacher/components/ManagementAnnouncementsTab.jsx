import { useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import AnnouncementComposerPanel from "./AnnouncementComposerPanel";
import ShareNotesLinkPanel from "./ShareNotesLinkPanel";
import { useMessaging } from "../context/MessagingContext";
import { MegaphoneIcon, LinkIcon, PencilIcon, TrashIcon, DuplicateIcon, PlusIcon, FileGenericIcon } from "../../../components/ui/icons";

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>
  );
}

// ManagementAnnouncementsTab — the course-scoped Announcements home (Part
// 2's entry point: "accessible from a course's Management Overview").
// Reads/writes through MessagingContext so a link shared here via Share
// Notes Link's course path lands in this exact same history list, tagged
// distinctly so it never reads as a full announcement.
export default function ManagementAnnouncementsTab({ course }) {
  const { announcementsByCourse, postAnnouncement, updateAnnouncement, removeAnnouncement, duplicateAnnouncement, postShareLinkToCourse, logShareLink } = useMessaging();
  const navigate = useNavigate();
  const [composerOpen, setComposerOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [toast, setToast] = useState("");

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  const list = (announcementsByCourse[course.id] || []).slice().sort((a, b) => {
    const aKey = a.postedAt || a.scheduledAt || "";
    const bKey = b.postedAt || b.scheduledAt || "";
    return aKey < bKey ? 1 : -1;
  });

  function submitAnnouncement(payload) {
    if (editing) {
      updateAnnouncement(course.id, editing.id, payload);
      flash(payload.status === "scheduled" ? "Announcement updated — still scheduled." : "Announcement updated and posted.");
    } else {
      postAnnouncement(course.id, payload);
      flash(payload.status === "scheduled" ? "Announcement scheduled." : "Announcement posted to all enrolled students.");
    }
    setComposerOpen(false);
    setEditing(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div>
          <h2 className="text-base font-bold text-text">Announcements</h2>
          <p className="mt-0.5 text-xs text-muted">Updates sent to everyone enrolled in {course.title}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => setShareOpen(true)}>
            <LinkIcon className="h-3.5 w-3.5" />
            Share Notes Link
          </Button>
          <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => navigate("/teacher/messaging", { state: { composePrefill: { studentIds: [], courseIds: [course.id], source: "course-announcements", subject: "" } } })}>
            <MegaphoneIcon className="h-3.5 w-3.5" />
            Full composer
          </Button>
          <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs" onClick={() => { setEditing(null); setComposerOpen(true); }}>
            <PlusIcon className="h-3.5 w-3.5" />
            New Announcement
          </Button>
        </div>
      </div>

      {list.length === 0 ? (
        <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-soft">
          <span className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-text/[0.06] text-muted">
            <MegaphoneIcon className="h-5 w-5" />
          </span>
          <p className="text-sm font-medium text-muted">No announcements posted yet for this course.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {list.map((a) => (
            <div key={a.id} className="rounded-3xl bg-white p-4 sm:p-5 shadow-soft">
              <div className="flex items-start gap-3">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${a.kind === "link" ? "bg-text/[0.07] text-muted" : "bg-primary/10 text-primary"}`}>
                  {a.kind === "link" ? <LinkIcon className="h-4 w-4" /> : <MegaphoneIcon className="h-4 w-4" />}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="truncate text-sm font-semibold text-text">{a.title}</p>
                    {a.kind === "link" && <span className="shrink-0 rounded-full bg-text/[0.07] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">Shared Link</span>}
                    {a.status === "scheduled" && <span className="shrink-0 rounded-full bg-warning/12 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-warning">Scheduled</span>}
                  </div>
                  {a.bodyHtml && <p className="mt-1 truncate text-xs text-muted">{stripHtml(a.bodyHtml)}</p>}
                  {a.attachment && (
                    <div className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-bg px-2.5 py-1 text-[11px] font-medium text-muted">
                      <FileGenericIcon className="h-3 w-3" />
                      {a.attachment.name}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-muted">{a.status === "scheduled" ? `Scheduled for ${new Date(a.scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : `Posted ${a.postedAt}`}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  {a.kind === "announcement" && (
                    <button type="button" onClick={() => { setEditing(a); setComposerOpen(true); }} disabled={a.status !== "scheduled"} title={a.status !== "scheduled" ? "Only scheduled announcements can be edited" : "Edit"} className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary disabled:opacity-25">
                      <PencilIcon className="h-4 w-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => duplicateAnnouncement(course.id, a.id)} title="Duplicate" className="rounded-full p-1.5 text-muted hover:bg-bg hover:text-primary">
                    <DuplicateIcon className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => { removeAnnouncement(course.id, a.id); flash("Announcement deleted."); }} title="Delete" className="rounded-full p-1.5 text-muted hover:bg-danger/10 hover:text-danger">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <AnnouncementComposerPanel
        open={composerOpen}
        course={course}
        editing={editing}
        onClose={() => { setComposerOpen(false); setEditing(null); }}
        onSubmit={submitAnnouncement}
      />

      <ShareNotesLinkPanel
        open={shareOpen}
        courses={[course]}
        presetCourseId={course.id}
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
