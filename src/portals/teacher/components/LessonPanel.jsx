import { useEffect, useState } from "react";
import Input from "../../../components/ui/Input";
import Checkbox from "../../../components/ui/Checkbox";
import FileDropzone from "../../../components/ui/FileDropzone";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import { XIcon, PlusIcon, TrashIcon, UploadIcon } from "../../../components/ui/icons";
import { LESSON_TYPE_META } from "./LessonRow";
import Select from "../../../components/ui/Select";

// LessonPanel — the right-side slide-over for editing one lesson's
// type-specific fields. Screen-local (Course Builder is the only place a
// lesson-authoring drawer exists so far) rather than generalizing Modal
// into a drawer variant on a single use case.
export default function LessonPanel({ lesson, onClose, onChange, onDelete }) {
  const [entered, setEntered] = useState(false);
  const open = Boolean(lesson);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open, lesson?.id]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!lesson) return null;
  const meta = LESSON_TYPE_META[lesson.type];

  function set(patch) {
    onChange({ ...lesson, ...patch });
  }

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button
        type="button"
        aria-label="Close panel"
        onClick={onClose}
        className={`absolute inset-0 bg-text/40 transition-opacity duration-200 ease-out ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Edit lesson"
        className={`relative flex h-full w-full max-w-md flex-col overflow-hidden rounded-l-3xl bg-white shadow-elevated transition-transform duration-200 ease-out ${
          entered ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center gap-3 border-b border-text/[0.07] px-6 py-4">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <meta.Icon className="h-4.5 w-4.5" />
          </span>
          <div className="min-w-0 flex-1">
            <span className="block text-xs font-semibold uppercase tracking-wide text-muted">{meta.label} lesson</span>
            <input
              value={lesson.title}
              onChange={(e) => set({ title: e.target.value })}
              placeholder="Lesson title"
              className="w-full border-none bg-transparent p-0 text-base font-semibold text-text outline-none placeholder:text-muted"
            />
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="shrink-0 rounded-full p-1.5 text-muted hover:bg-bg hover:text-text"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {lesson.type === "video" && <VideoFields lesson={lesson} set={set} />}
          {lesson.type === "article" && <ArticleFields lesson={lesson} set={set} />}
          {lesson.type === "quiz" && <QuizFields lesson={lesson} set={set} />}
          {lesson.type === "assignment" && <AssignmentFields lesson={lesson} set={set} />}
          {lesson.type === "resource" && <ResourceFields lesson={lesson} set={set} />}
          {lesson.type === "live" && <LiveFields lesson={lesson} set={set} />}
        </div>

        <div className="flex items-center justify-between border-t border-text/[0.07] px-6 py-4">
          <button
            type="button"
            onClick={() => {
              onDelete();
              onClose();
            }}
            className="flex items-center gap-1.5 text-sm font-semibold text-danger hover:underline"
          >
            <TrashIcon className="h-4 w-4" />
            Delete lesson
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-soft"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function FieldLabel({ children }) {
  return <span className="mb-1.5 block text-sm font-medium text-text">{children}</span>;
}

function VideoFields({ lesson, set }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <FieldLabel>Video source</FieldLabel>
        <FileDropzone
          label="Upload a video file"
          hint="MP4, MOV up to 2GB"
          file={lesson.videoFile}
          onFileSelect={(file) => set({ videoFile: file })}
        />
      </div>
      <Input
        label="Duration"
        value={lesson.duration || ""}
        onChange={(e) => set({ duration: e.target.value })}
        placeholder="mm:ss"
        shape="rect"
        helperText={lesson.videoFile ? "Auto-detected from the uploaded file." : "Auto-fills once a video is uploaded."}
      />
      <div>
        <FieldLabel>Transcript (optional)</FieldLabel>
        <FileDropzone
          label="Upload transcript"
          hint=".srt or .vtt"
          file={lesson.transcriptFile}
          onFileSelect={(file) => set({ transcriptFile: file })}
        />
      </div>
      <label className="flex cursor-pointer items-center justify-between rounded-xl border border-text/10 bg-bg px-4 py-3">
        <span>
          <span className="block text-sm font-medium text-text">Free preview</span>
          <span className="block text-xs text-muted">Visible to non-enrolled visitors</span>
        </span>
        <Checkbox checked={Boolean(lesson.preview)} onChange={(e) => set({ preview: e.target.checked })} />
      </label>
    </div>
  );
}

function ArticleFields({ lesson, set }) {
  return (
    <div>
      <FieldLabel>Article content</FieldLabel>
      <RichTextEditor value={lesson.content || ""} onChange={(html) => set({ content: html, hasContent: html.length > 0 })} minHeight={260} />
    </div>
  );
}

function QuizFields({ lesson, set }) {
  const questions = lesson.questions || [];

  function updateQuestion(id, patch) {
    set({ questions: questions.map((q) => (q.id === id ? { ...q, ...patch } : q)) });
  }
  function addQuestion() {
    set({
      questions: [...questions, { id: crypto.randomUUID(), text: "", type: "single", points: 1 }],
    });
  }
  function removeQuestion(id) {
    set({ questions: questions.filter((q) => q.id !== id) });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3">
        {questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-text/10 bg-bg p-3.5">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Question {i + 1}</span>
              <button type="button" onClick={() => removeQuestion(q.id)} className="text-muted hover:text-danger">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <input
              value={q.text}
              onChange={(e) => updateQuestion(q.id, { text: e.target.value })}
              placeholder="Question text"
              className="mb-2 w-full rounded-lg border border-text/15 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <div className="flex gap-2">
              <Select
                wrapperClassName="block flex-1"
                value={q.type}
                onChange={(e) => updateQuestion(q.id, { type: e.target.value })}
                className="w-full rounded-lg border border-text/15 bg-white px-2.5 py-1.5 pr-8 text-xs outline-none"
              >
                <option value="single">Single choice</option>
                <option value="multiple">Multiple choice</option>
                <option value="truefalse">True / False</option>
                <option value="short">Short answer</option>
              </Select>
              <input
                type="number"
                min={1}
                value={q.points}
                onChange={(e) => updateQuestion(q.id, { points: Number(e.target.value) })}
                className="w-20 rounded-lg border border-text/15 bg-white px-2.5 py-1.5 text-xs outline-none"
              />
            </div>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addQuestion}
        className="flex items-center justify-center gap-1.5 rounded-full border border-dashed border-text/25 py-2.5 text-sm font-semibold text-primary hover:border-primary hover:bg-primary/[0.04]"
      >
        <PlusIcon className="h-4 w-4" />
        Add question
      </button>
      <Input
        label="Pass threshold (%)"
        type="number"
        value={lesson.passThreshold ?? 70}
        onChange={(e) => set({ passThreshold: Number(e.target.value) })}
        shape="rect"
      />
    </div>
  );
}

function AssignmentFields({ lesson, set }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <FieldLabel>Instructions</FieldLabel>
        <RichTextEditor
          value={lesson.instructions || ""}
          onChange={(html) => set({ instructions: html, hasContent: html.length > 0 })}
          minHeight={160}
        />
      </div>
      <div>
        <FieldLabel>Submission type</FieldLabel>
        <Select
          wrapperClassName="block w-full"
          value={lesson.submissionType || "file"}
          onChange={(e) => set({ submissionType: e.target.value })}
          className="w-full rounded-full border border-text/15 bg-bg px-4 py-3 pr-10 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          <option value="file">File upload</option>
          <option value="text">Text entry</option>
          <option value="both">Both</option>
        </Select>
      </div>
      <div>
        <FieldLabel>Rubric / grading notes</FieldLabel>
        <textarea
          rows={4}
          value={lesson.rubric || ""}
          onChange={(e) => set({ rubric: e.target.value })}
          placeholder="What separates a strong submission from a weak one?"
          className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
    </div>
  );
}

function ResourceFields({ lesson, set }) {
  return (
    <div>
      <FieldLabel>File</FieldLabel>
      <FileDropzone
        label="Upload a resource"
        hint="PDF, ZIP, slides — any downloadable file"
        file={lesson.resourceFile}
        onFileSelect={(file) => set({ resourceFile: file, hasContent: Boolean(file) })}
      />
      <p className="mt-3 flex items-center gap-2 text-xs text-muted">
        <UploadIcon className="h-3.5 w-3.5" />
        Students can download this file once enrolled.
      </p>
    </div>
  );
}

function LiveFields({ lesson, set }) {
  return (
    <div className="flex flex-col gap-5">
      <Input
        label="Scheduled date & time"
        type="datetime-local"
        value={lesson.scheduledAt || ""}
        onChange={(e) => set({ scheduledAt: e.target.value, hasContent: Boolean(e.target.value) })}
        shape="rect"
      />
      <Input
        label="Meeting link"
        value={lesson.meetingLink || ""}
        onChange={(e) => set({ meetingLink: e.target.value })}
        placeholder="https://…"
        shape="rect"
      />
      <Input
        label="Expected duration"
        value={lesson.duration || ""}
        onChange={(e) => set({ duration: e.target.value })}
        placeholder="mm:ss"
        shape="rect"
      />
    </div>
  );
}
