import { useEffect, useMemo, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import FileDropzone from "../../../components/ui/FileDropzone";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import { BellIcon, CalendarIcon, MegaphoneIcon, FileGenericIcon } from "../../../components/ui/icons";

function stripHtml(html) {
  return (html || "").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// AnnouncementComposerPanel — course-scoped updates (Part 2). Course
// context is shown but locked (announcements are always course-scoped),
// and the rich text editor / file dropzone / schedule pattern are the
// exact same shared pieces Content Upload and Homework/Notes Upload
// already use, not new implementations. The live preview mirrors exactly
// what a student will see, updating as the educator types.
export default function AnnouncementComposerPanel({ open, course, editing, onClose, onSubmit }) {
  const [title, setTitle] = useState("");
  const [bodyHtml, setBodyHtml] = useState("");
  const [file, setFile] = useState(null);
  const [schedule, setSchedule] = useState("now"); // now | later
  const [scheduledAt, setScheduledAt] = useState("");
  const [editorKey, setEditorKey] = useState(0);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setTitle(editing.title || "");
      setBodyHtml(editing.bodyHtml || "");
      setFile(editing.attachment ? { name: editing.attachment.name, size: editing.attachment.size } : null);
      setSchedule(editing.status === "scheduled" ? "later" : "now");
      setScheduledAt(editing.scheduledAt || "");
    } else {
      setTitle("");
      setBodyHtml("");
      setFile(null);
      setSchedule("now");
      setScheduledAt("");
    }
    setEditorKey((k) => k + 1);
  }, [open, editing]);

  const canSubmit = title.trim() && stripHtml(bodyHtml).length > 0 && (schedule !== "later" || scheduledAt);
  const studentCount = course?.students?.length || 0;

  function submit() {
    onSubmit({
      kind: "announcement",
      title: title.trim(),
      bodyHtml,
      attachment: file ? { name: file.name, size: file.size } : null,
      status: schedule === "later" ? "scheduled" : "sent",
      postedAt: schedule === "later" ? null : new Date().toISOString().slice(0, 10),
      scheduledAt: schedule === "later" ? scheduledAt : null,
    });
  }

  if (!course) return null;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editing ? "Edit Announcement" : "New Announcement"}
      size="2xl"
      footer={
        <>
          <Button variant="primary" fullWidth={false} disabled={!canSubmit} className="px-6" onClick={submit}>
            {schedule === "later" ? "Schedule Announcement" : "Post Announcement"}
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1.2fr_1fr]">
        <div className="flex flex-col gap-5">
          <div className="flex items-center gap-2 rounded-xl bg-primary/[0.06] px-3.5 py-2.5 text-sm">
            <MegaphoneIcon className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 truncate font-semibold text-primary">{course.title}</span>
            <span className="ml-auto shrink-0 text-xs text-primary/60">{studentCount} student{studentCount === 1 ? "" : "s"}</span>
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Title</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Module 3 live critique moved to Thursday"
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Message</span>
            <RichTextEditor key={editorKey} value={bodyHtml} onChange={setBodyHtml} placeholder="Write your announcement…" minHeight={140} />
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Attachment (optional)</span>
            <FileDropzone label="Attach a document" file={file} onFileSelect={setFile} />
          </div>

          <div>
            <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
              <CalendarIcon className="h-3.5 w-3.5 text-muted" />
              Delivery
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSchedule("now")}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  schedule === "now" ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
                } hover:-translate-y-0.5 hover:shadow-soft`}
              >
                Send Now
              </button>
              <button
                type="button"
                onClick={() => setSchedule("later")}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  schedule === "later" ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
                } hover:-translate-y-0.5 hover:shadow-soft`}
              >
                Schedule for Later
              </button>
            </div>
            {schedule === "later" && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={(e) => setScheduledAt(e.target.value)}
                className="mt-2.5 w-full max-w-xs rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            )}
          </div>

          <div className="flex items-start gap-2.5 rounded-xl bg-bg p-3.5 text-xs text-muted">
            <BellIcon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted" />
            <span>
              Delivery respects each student's own notification-channel preferences (in-app, email, SMS or push) —
              this isn't something you override per announcement.
            </span>
          </div>
        </div>

        {/* Live preview */}
        <div>
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Student preview</span>
          <div className="rounded-2xl bg-bg p-4">
            <div className="rounded-3xl bg-white p-4 shadow-[0_6px_24px_-10px_rgba(26,26,26,0.12)]">
              <div className="flex items-center gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <MegaphoneIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-semibold text-muted">{course.title}</p>
                  <p className="truncate text-sm font-semibold text-text">{title.trim() || "Your announcement title"}</p>
                </div>
              </div>
              <div
                className="mt-3 text-sm leading-relaxed text-muted [&_h3]:mt-2 [&_h3]:text-base [&_h3]:font-semibold [&_ul]:list-disc [&_ul]:pl-5 [&_a]:text-primary [&_a]:underline"
                dangerouslySetInnerHTML={{ __html: bodyHtml || "<p class='text-muted'>Your message will appear here as you type…</p>" }}
              />
              {file && (
                <div className="mt-3 flex items-center gap-2 rounded-xl bg-bg px-3 py-2.5 text-xs">
                  <FileGenericIcon className="h-4 w-4 shrink-0 text-primary" />
                  <span className="truncate font-medium text-text">{file.name}</span>
                </div>
              )}
              <p className="mt-3 text-[11px] text-muted">
                {schedule === "later" && scheduledAt
                  ? `Scheduled for ${new Date(scheduledAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}`
                  : "Posted just now"}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
