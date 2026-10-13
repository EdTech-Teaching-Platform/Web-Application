import { useEffect, useState } from "react";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import Switch from "../../../components/ui/Switch";
import FileDropzone from "../../../components/ui/FileDropzone";
import { BellIcon, BookIcon, CalendarIcon, FileGenericIcon } from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

function newId(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

// HomeworkUploadPanel — shares supplementary material tied to real
// curriculum structure (never a separately hardcoded module/lesson list)
// and reuses the exact same FileDropzone the downloadable-resource lesson
// type in Content Upload already uses — a second file's dropzone is just
// another instance of the same component, not a new pattern.
export default function HomeworkUploadPanel({ open, course, presetAttach, onClose, onShare }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [level, setLevel] = useState("course"); // course | module | lesson
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [files, setFiles] = useState([]);
  const [availability, setAvailability] = useState("immediate"); // immediate | scheduled
  const [availableAt, setAvailableAt] = useState("");
  const [notify, setNotify] = useState(true);

  useEffect(() => {
    if (!open) return;
    setTitle("");
    setDescription("");
    setFiles([]);
    setAvailability("immediate");
    setAvailableAt("");
    setNotify(true);
    if (presetAttach?.lessonId) {
      setLevel("lesson");
      setModuleId(presetAttach.moduleId);
      setLessonId(presetAttach.lessonId);
    } else if (presetAttach?.moduleId) {
      setLevel("module");
      setModuleId(presetAttach.moduleId);
      setLessonId("");
    } else {
      setLevel("course");
      setModuleId(course?.modules?.[0]?.id || "");
      setLessonId("");
    }
  }, [open, presetAttach, course]);

  if (!course) return null;

  const currentModule = course.modules.find((m) => m.id === moduleId);
  const canSubmit = title.trim() && files.length > 0 && (level !== "lesson" || lessonId) && (level === "course" || moduleId) && (availability !== "scheduled" || availableAt);

  function updateFile(index, file) {
    setFiles((prev) => {
      const next = [...prev];
      if (file) next[index] = file;
      else next.splice(index, 1);
      return next;
    });
  }
  function addFile(file) {
    if (file) setFiles((prev) => [...prev, file]);
  }

  function attachedLabel() {
    if (level === "course") return course.title;
    if (level === "module") return currentModule?.title || "a module";
    const lesson = currentModule?.lessons.find((l) => l.id === lessonId);
    return lesson?.title || "a lesson";
  }

  function submit() {
    onShare({
      id: newId("hw"),
      title: title.trim(),
      description: description.trim() ? `<p>${description.trim()}</p>` : "",
      attachTo: { level, moduleId: level === "course" ? null : moduleId, lessonId: level === "lesson" ? lessonId : null },
      files: files.map((f) => ({ id: newId("f"), name: f.name, size: f.size })),
      availability,
      availableAt: availability === "scheduled" ? availableAt : null,
      notify,
      sharedAt: new Date().toISOString().slice(0, 10),
    });
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Share Homework / Notes"
      size="lg"
      footer={
        <>
          <Button variant="primary" fullWidth={false} disabled={!canSubmit} className="px-6" onClick={submit}>
            Share with Students
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-6" onClick={onClose}>
            Cancel
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g. Extra practice: naming conventions cheat sheet"
            className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Description (optional)</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Give students a bit of context for this material…"
            className="w-full resize-none rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
            <BookIcon className="h-3.5 w-3.5 text-muted" />
            Attach to
          </span>
          <div className="flex flex-wrap gap-2">
            {[
              { key: "course", label: "This whole course" },
              { key: "module", label: "A specific module" },
              { key: "lesson", label: "A specific lesson" },
            ].map((opt) => (
              <button
                key={opt.key}
                type="button"
                onClick={() => setLevel(opt.key)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                  level === opt.key ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
                } hover:-translate-y-0.5 hover:shadow-soft`}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {level !== "course" && (
            <Select
              wrapperClassName="block w-full"
              value={moduleId}
              onChange={(e) => {
                setModuleId(e.target.value);
                setLessonId("");
              }}
              className="mt-2.5 w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              {course.modules.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.title}
                </option>
              ))}
            </Select>
          )}
          {level === "lesson" && currentModule && (
            <Select
              wrapperClassName="block w-full"
              value={lessonId}
              onChange={(e) => setLessonId(e.target.value)}
              className="mt-2.5 w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 pr-10 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            >
              <option value="">Select a lesson…</option>
              {currentModule.lessons.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.title || "Untitled lesson"}
                </option>
              ))}
            </Select>
          )}
        </div>

        <div>
          <span className="mb-1.5 block text-sm font-medium text-text">Files</span>
          <div className="flex flex-col gap-2.5">
            {files.map((f, i) => (
              <FileDropzone key={`${f.name}-${i}`} label="Upload a file" file={f} onFileSelect={(file) => updateFile(i, file)} />
            ))}
            <FileDropzone label="Add a file" hint="or click to browse" file={null} onFileSelect={addFile} />
          </div>
        </div>

        <div>
          <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
            <CalendarIcon className="h-3.5 w-3.5 text-muted" />
            Availability
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAvailability("immediate")}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                availability === "immediate" ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
              } hover:-translate-y-0.5 hover:shadow-soft`}
            >
              Available immediately
            </button>
            <button
              type="button"
              onClick={() => setAvailability("scheduled")}
              className={`rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all duration-150 ${
                availability === "scheduled" ? "border-primary bg-primary text-white" : "border-text/15 bg-surface text-muted hover:border-primary/40"
              } hover:-translate-y-0.5 hover:shadow-soft`}
            >
              Available on a specific date
            </button>
          </div>
          {availability === "scheduled" && (
            <input
              type="datetime-local"
              value={availableAt}
              onChange={(e) => setAvailableAt(e.target.value)}
              className="mt-2.5 w-full max-w-xs rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          )}
        </div>

        <div className="flex items-center justify-between gap-4 rounded-xl bg-bg p-3.5">
          <span className="min-w-0">
            <span className="block text-sm font-medium text-text">Notify enrolled students</span>
            <span className="mt-0.5 block text-xs text-muted">Sends a push/email the moment this becomes available</span>
          </span>
          <Switch checked={notify} onChange={setNotify} />
        </div>

        {notify && title.trim() && (
          <div className="rounded-2xl bg-bg p-4">
            <span className="mb-2.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted">
              <BellIcon className="h-3.5 w-3.5" />
              What students will see
            </span>
            <div className="flex items-start gap-2.5 rounded-2xl bg-white p-3.5 shadow-soft">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
                <FileGenericIcon className="h-4 w-4" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-text">New material shared: {title}</p>
                <p className="mt-0.5 text-xs text-muted">
                  {attachedLabel()} · {availability === "scheduled" && availableAt ? `Available ${new Date(availableAt).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}` : "Available now"}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
