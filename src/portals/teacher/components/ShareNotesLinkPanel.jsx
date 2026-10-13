import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { LinkIcon, BookIcon, CopyIcon, CheckIcon } from "../../../components/ui/icons";
import { courseMaterials } from "../data/messagingData";
import Select from "../../../components/ui/Select";

// ShareNotesLinkPanel — the fast, structure-light counterpart to
// Homework/Notes Upload: paste (or pick from real, already-uploaded
// course materials) a link and share it with a whole course or copy it.
// Reachable with a preset course or fully open (from the Announcements
// page). There is no per-student path: sharing is always one-to-many.
export default function ShareNotesLinkPanel({ open, onClose, courses, presetCourseId, onShareToCourse, onLogShare }) {
  const [recipientType, setRecipientType] = useState(presetCourseId ? "course" : "copy");
  const [courseId, setCourseId] = useState(presetCourseId || "");
  const [linkMode, setLinkMode] = useState("url"); // material | url
  const [materialId, setMaterialId] = useState("");
  const [url, setUrl] = useState("");
  const [label, setLabel] = useState("");
  const [step, setStep] = useState("form"); // form | copied | sent

  useEffect(() => {
    if (!open) return;
    setRecipientType(presetCourseId ? "course" : "copy");
    setCourseId(presetCourseId || "");
    setLinkMode("url");
    setMaterialId("");
    setUrl("");
    setLabel("");
    setStep("form");
  }, [open, presetCourseId]);

  const activeCourseId = recipientType === "course" ? courseId : null;
  const activeCourse = courses.find((c) => c.id === activeCourseId) || null;
  const materials = activeCourse ? courseMaterials(activeCourse) : [];

  const resolvedUrl = linkMode === "material" ? materials.find((m) => m.id === materialId)?.name || "" : url.trim();
  const resolvedLabel = label.trim() || (linkMode === "material" ? resolvedUrl : "Shared link");

  const canShare =
    resolvedUrl.trim().length > 0 &&
    (recipientType === "copy" || (recipientType === "course" && courseId));

  function handleClose() {
    onClose();
  }

  async function handleShare() {
    if (recipientType === "copy") {
      try {
        await navigator.clipboard.writeText(resolvedUrl.startsWith("http") ? resolvedUrl : `https://universallearning.app/notes/${resolvedUrl}`);
      } catch {
        // clipboard may be unavailable — the field below still shows the link to copy manually
      }
      onLogShare?.({ url: resolvedUrl, label: resolvedLabel, recipient: "Copy", target: "—" });
      setStep("copied");
      return;
    }
    onShareToCourse(courseId, { url: resolvedUrl, label: resolvedLabel });
    onLogShare?.({ url: resolvedUrl, label: resolvedLabel, recipient: "Course", target: activeCourse?.title });
    setStep("sent");
  }

  return (
    <Modal open={open} onClose={handleClose} title="Share Notes Link" size="md">
      {step === "form" && (
        <div className="flex flex-col gap-5">
          {(
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Recipient</span>
              <div className="flex flex-wrap gap-2">
                {[
                  { key: "course", label: "This course", Icon: BookIcon },
                  { key: "copy", label: "Copy link", Icon: CopyIcon },
                ].map((opt) => (
                  <button
                    key={opt.key}
                    type="button"
                    onClick={() => setRecipientType(opt.key)}
                    className={`flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                      recipientType === opt.key ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
                    } hover:-translate-y-0.5 hover:shadow-soft`}
                  >
                    <opt.Icon className="h-3.5 w-3.5" />
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {recipientType === "course" && !presetCourseId && (
            <div>
              <span className="mb-1.5 block text-sm font-medium text-text">Course</span>
              <Select wrapperClassName="block w-full" value={courseId} onChange={(e) => setCourseId(e.target.value)} className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
                <option value="">Select a course…</option>
                {courses.map((c) => (
                  <option key={c.id} value={c.id}>{c.title}</option>
                ))}
              </Select>
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Link</span>
            {materials.length > 0 && (
              <div className="mb-2 flex gap-2">
                <button type="button" onClick={() => setLinkMode("material")} className={`rounded-full border px-3 py-1 text-xs font-semibold ${linkMode === "material" ? "border-primary bg-primary text-white" : "border-text/15 text-muted"} hover:-translate-y-0.5 hover:shadow-soft`}>
                  From uploaded material
                </button>
                <button type="button" onClick={() => setLinkMode("url")} className={`rounded-full border px-3 py-1 text-xs font-semibold ${linkMode === "url" ? "border-primary bg-primary text-white" : "border-text/15 text-muted"} hover:-translate-y-0.5 hover:shadow-soft`}>
                  Paste a URL
                </button>
              </div>
            )}
            {linkMode === "material" && materials.length > 0 ? (
              <Select wrapperClassName="block w-full" value={materialId} onChange={(e) => setMaterialId(e.target.value)} className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15">
                <option value="">Select material…</option>
                {materials.map((m) => (
                  <option key={m.id} value={m.id}>{m.name} — {m.source}</option>
                ))}
              </Select>
            ) : (
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="https://…"
                className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            )}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Short label (optional)</span>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Chapter 4 diagrams"
              className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          {resolvedUrl && (
            <div className="rounded-2xl bg-bg p-3.5">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted">Preview</span>
              <div className="flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-soft">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                  <LinkIcon className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-text">{resolvedLabel}</p>
                  <p className="truncate text-xs text-muted">{resolvedUrl}</p>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2">
            <Button variant="secondary" fullWidth={false} className="px-5" onClick={handleClose}>
              Cancel
            </Button>
            <Button fullWidth={false} className="ml-auto px-6" disabled={!canShare} onClick={handleShare}>
              {recipientType === "copy" ? "Generate Link" : "Share"}
            </Button>
          </div>
        </div>
      )}

      {step === "copied" && (
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2.5 rounded-xl border border-text/15 bg-bg px-4 py-3">
            <LinkIcon className="h-4 w-4 shrink-0 text-muted" />
            <span className="min-w-0 flex-1 truncate text-sm text-text">{resolvedUrl.startsWith("http") ? resolvedUrl : `https://universallearning.app/notes/${resolvedUrl}`}</span>
          </div>
          <div className="flex items-center justify-center gap-2 rounded-xl bg-success/10 py-2.5 text-sm font-semibold text-success">
            <CheckIcon className="h-4 w-4" />
            Copied!
          </div>
          <Button fullWidth={false} className="ml-auto px-6" onClick={handleClose}>
            Done
          </Button>
        </div>
      )}

      {step === "sent" && (
        <div className="flex flex-col items-center gap-3 py-4 text-center">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/12 text-success">
            <CheckIcon className="h-7 w-7" />
          </span>
          <p className="text-sm text-muted">
            Shared with everyone in <span className="font-semibold text-text">{activeCourse?.title}</span>.
          </p>
          <Button fullWidth={false} className="px-6" onClick={handleClose}>
            Done
          </Button>
        </div>
      )}
    </Modal>
  );
}
