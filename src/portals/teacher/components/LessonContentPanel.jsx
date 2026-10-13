import Input from "../../../components/ui/Input";
import FileDropzone from "../../../components/ui/FileDropzone";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import Switch from "../../../components/ui/Switch";
import Button from "../../../components/ui/Button";
import AutoSaveIndicator from "../../../components/ui/AutoSaveIndicator";
import { LESSON_TYPE_META } from "./LessonRow";
import { formatBytes, quizTotalPoints, readingTime } from "./contentData";
import {
  CaptionsIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  FileGenericIcon,
  PlayIcon,
  PlusIcon,
  SparkleIcon,
  TrashIcon,
} from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

function FieldLabel({ children, hint }) {
  return (
    <span className="mb-1.5 flex items-center gap-1.5 text-sm font-medium text-text">
      {children}
      {hint && <span className="text-muted">· {hint}</span>}
    </span>
  );
}

// -- Video ------------------------------------------------------------
function VideoEditor({ lesson, set }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <FieldLabel>Upload video</FieldLabel>
        <FileDropzone
          label="Upload a video file"
          hint="MP4 or MOV, up to 2GB"
          file={lesson.videoFile}
          onFileSelect={(file) =>
            set({
              videoFile: file,
              processing: file ? "processing" : lesson.processing,
              duration: file ? lesson.duration : "",
            })
          }
        />
        {lesson.videoFile && (
          <div className="mt-2 flex items-center justify-between rounded-xl bg-bg px-3.5 py-2.5">
            <div className="flex items-center gap-2 text-xs text-muted">
              <PlayIcon className="h-3.5 w-3.5 text-muted" />
              Preview: {lesson.videoFile.name}
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${
                lesson.processing === "processing" ? "bg-warning/12 text-warning" : "bg-success/12 text-success"
              }`}
            >
              {lesson.processing === "processing" ? "Processing…" : "Ready"}
            </span>
          </div>
        )}
      </div>

      <Input
        label="Duration"
        value={lesson.duration || (lesson.processing === "processing" ? "" : "")}
        onChange={(e) => set({ duration: e.target.value })}
        placeholder="mm:ss"
        shape="rect"
        helperText={
          lesson.processing === "processing"
            ? "Auto-detecting once processing finishes…"
            : lesson.videoFile
            ? "Auto-detected from the uploaded file — you can override it."
            : "Fills in automatically once a video is uploaded."
        }
      />

      <div>
        <FieldLabel hint="accessibility">
          <CaptionsIcon className="h-4 w-4 text-muted" />
          Transcript / captions
        </FieldLabel>
        <FileDropzone
          label="Upload transcript"
          hint=".srt or .vtt"
          file={lesson.transcriptFile}
          onFileSelect={(file) => set({ transcriptFile: file })}
        />
        <p className="mt-1.5 text-xs text-muted">Required for students who are deaf, hard of hearing, or studying without sound.</p>
      </div>

      <Switch
        checked={Boolean(lesson.preview)}
        onChange={(v) => set({ preview: v })}
        label={
          <span className="flex items-center gap-1.5">
            <EyeIcon className="h-4 w-4" /> Free preview
          </span>
        }
        description="Anyone can watch this lesson without enrolling"
      />
    </div>
  );
}

// -- Article ------------------------------------------------------------
function ArticleEditor({ lesson, set }) {
  const minutes = readingTime(lesson.content);
  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <FieldLabel>Article content</FieldLabel>
          <span className="flex items-center gap-1 text-xs text-muted">
            <ClockIcon className="h-3.5 w-3.5" />
            {minutes} min read
          </span>
        </div>
        <RichTextEditor value={lesson.content || ""} onChange={(html) => set({ content: html })} minHeight={280} />
      </div>
      <Switch
        checked={Boolean(lesson.preview)}
        onChange={(v) => set({ preview: v })}
        label={
          <span className="flex items-center gap-1.5">
            <EyeIcon className="h-4 w-4" /> Free preview
          </span>
        }
        description="Anyone can read this lesson without enrolling"
      />
    </div>
  );
}

// -- Quiz ------------------------------------------------------------
function QuestionCard({ question, index, onUpdate, onRemove }) {
  function updateOption(optId, patch) {
    onUpdate({ options: question.options.map((o) => (o.id === optId ? { ...o, ...patch } : o)) });
  }
  function toggleCorrect(optId) {
    const single = question.type === "single" || question.type === "truefalse";
    onUpdate({
      options: question.options.map((o) => ({
        ...o,
        correct: single ? o.id === optId : o.id === optId ? !o.correct : o.correct,
      })),
    });
  }
  function addOption() {
    onUpdate({ options: [...question.options, { id: crypto.randomUUID(), text: "", correct: false }] });
  }
  function removeOption(optId) {
    onUpdate({ options: question.options.filter((o) => o.id !== optId) });
  }

  return (
    <div className="rounded-xl border border-text/10 bg-bg p-4">
      <div className="mb-2.5 flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Question {index + 1}</span>
        <button type="button" onClick={onRemove} aria-label="Remove question" className="text-muted hover:text-danger">
          <TrashIcon className="h-4 w-4" />
        </button>
      </div>

      <input
        value={question.text}
        onChange={(e) => onUpdate({ text: e.target.value })}
        placeholder="Question text"
        className="mb-2.5 w-full rounded-lg border border-text/15 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
      />

      <div className="mb-3 flex items-center gap-2">
        <Select
          wrapperClassName="block flex-1"
          value={question.type}
          onChange={(e) =>
            onUpdate({
              type: e.target.value,
              options:
                e.target.value === "truefalse"
                  ? [
                      { id: crypto.randomUUID(), text: "True", correct: true },
                      { id: crypto.randomUUID(), text: "False", correct: false },
                    ]
                  : e.target.value === "short"
                  ? []
                  : question.options.length
                  ? question.options
                  : [{ id: crypto.randomUUID(), text: "", correct: false }],
            })
          }
          className="w-full rounded-lg border border-text/15 bg-white px-2.5 py-1.5 pr-8 text-xs outline-none"
        >
          <option value="single">Multiple choice — single answer</option>
          <option value="multiple">Multiple choice — multiple answers</option>
          <option value="truefalse">True / False</option>
          <option value="short">Short answer</option>
        </Select>
        <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted">
          Points
          <input
            type="number"
            min={0}
            value={question.points}
            onChange={(e) => onUpdate({ points: Number(e.target.value) })}
            className="w-16 rounded-lg border border-text/15 bg-white px-2 py-1.5 text-xs outline-none"
          />
        </label>
      </div>

      {question.type === "short" && (
        <p className="rounded-lg bg-white px-3 py-2 text-xs text-muted">Graded manually — students submit free text.</p>
      )}

      {(question.type === "single" || question.type === "multiple" || question.type === "truefalse") && (
        <div className="flex flex-col gap-2">
          {question.options.map((opt) => (
            <div key={opt.id} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => toggleCorrect(opt.id)}
                aria-pressed={opt.correct}
                aria-label={opt.correct ? "Marked correct" : "Mark as correct"}
                className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
                  opt.correct ? "border-success bg-success text-white" : "border-text/25 text-transparent"
                } ${question.type === "multiple" ? "rounded-full" : ""}`}
              >
                {opt.correct && <CheckIcon className="h-3 w-3" />}
              </button>
              <input
                value={opt.text}
                disabled={question.type === "truefalse"}
                onChange={(e) => updateOption(opt.id, { text: e.target.value })}
                placeholder="Option text"
                className="flex-1 rounded-lg border border-text/15 bg-white px-3 py-1.5 text-sm outline-none disabled:text-text/50 focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
              {question.type !== "truefalse" && question.options.length > 1 && (
                <button type="button" onClick={() => removeOption(opt.id)} className="text-text/25 hover:text-danger">
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          ))}
          {question.type !== "truefalse" && (
            <button
              type="button"
              onClick={addOption}
              className="flex items-center gap-1 self-start text-xs font-semibold text-primary hover:underline"
            >
              <PlusIcon className="h-3 w-3" /> Add option
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function QuizEditor({ lesson, set }) {
  const questions = lesson.questions || [];
  const total = quizTotalPoints(questions);

  function updateQuestion(qid, patch) {
    set({ questions: questions.map((q) => (q.id === qid ? { ...q, ...patch } : q)) });
  }
  function addQuestion() {
    set({
      questions: [
        ...questions,
        {
          id: crypto.randomUUID(),
          text: "",
          type: "single",
          points: 1,
          options: [
            { id: crypto.randomUUID(), text: "", correct: true },
            { id: crypto.randomUUID(), text: "", correct: false },
          ],
        },
      ],
    });
  }
  function removeQuestion(qid) {
    set({ questions: questions.filter((q) => q.id !== qid) });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between rounded-xl bg-primary/[0.06] px-4 py-2.5">
        <span className="text-sm font-semibold text-text">{questions.length} question{questions.length === 1 ? "" : "s"}</span>
        <span className="text-sm font-semibold text-primary">{total} pts total</span>
      </div>

      {questions.length === 0 ? (
        <div className="rounded-xl border border-dashed border-text/20 bg-bg px-4 py-8 text-center">
          <p className="text-sm text-muted">No questions yet. Add your first one below.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {questions.map((q, i) => (
            <QuestionCard
              key={q.id}
              question={q}
              index={i}
              onUpdate={(patch) => updateQuestion(q.id, patch)}
              onRemove={() => removeQuestion(q.id)}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addQuestion}
        className="flex items-center justify-center gap-1.5 rounded-full border border-dashed border-text/25 py-2.5 text-sm font-semibold text-primary transition-colors duration-150 hover:border-primary hover:bg-primary/[0.04]"
      >
        <PlusIcon className="h-4 w-4" />
        Add question
      </button>

      <div className="flex flex-col gap-4 rounded-xl bg-bg p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Quiz settings</span>

        <Input
          label="Max attempts allowed"
          type="number"
          min={1}
          value={lesson.maxAttempts ?? 1}
          onChange={(e) => set({ maxAttempts: Number(e.target.value) })}
          shape="rect"
        />

        <div>
          <div className="mb-1.5 flex items-center justify-between text-sm">
            <span className="font-medium text-text">Passing score</span>
            <span className="font-semibold text-primary">{lesson.passThreshold ?? 70}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={lesson.passThreshold ?? 70}
            onChange={(e) => set({ passThreshold: Number(e.target.value) })}
            className="w-full accent-[color:var(--color-primary)]"
          />
        </div>

        <Switch checked={Boolean(lesson.shuffle)} onChange={(v) => set({ shuffle: v })} label="Shuffle questions" description="A new order for each attempt" />

        <Switch
          checked={Boolean(lesson.timeLimitEnabled)}
          onChange={(v) => set({ timeLimitEnabled: v })}
          label="Time limit"
          description="Auto-submits once time runs out"
        />
        {lesson.timeLimitEnabled && (
          <Input
            label="Duration (minutes)"
            type="number"
            min={1}
            value={lesson.timeLimitMinutes ?? 15}
            onChange={(e) => set({ timeLimitMinutes: Number(e.target.value) })}
            shape="rect"
          />
        )}
      </div>
    </div>
  );
}

// -- Assignment ------------------------------------------------------------
function AssignmentEditor({ lesson, set }) {
  const rubric = lesson.rubric || [];
  function updateCriterion(cid, patch) {
    set({ rubric: rubric.map((r) => (r.id === cid ? { ...r, ...patch } : r)) });
  }
  function addCriterion() {
    set({ rubric: [...rubric, { id: crypto.randomUUID(), label: "", points: 10 }] });
  }
  function removeCriterion(cid) {
    set({ rubric: rubric.filter((r) => r.id !== cid) });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <FieldLabel>Instructions</FieldLabel>
        <RichTextEditor value={lesson.instructions || ""} onChange={(html) => set({ instructions: html })} minHeight={180} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel>Due date</FieldLabel>
          <input
            type="date"
            disabled={lesson.noDueDate}
            value={lesson.dueDate || ""}
            onChange={(e) => set({ dueDate: e.target.value })}
            className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm outline-none disabled:opacity-40 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </div>
        <Input
          label="Max score"
          type="number"
          min={0}
          value={lesson.maxScore ?? 100}
          onChange={(e) => set({ maxScore: Number(e.target.value) })}
          shape="rect"
        />
      </div>
      <Switch checked={Boolean(lesson.noDueDate)} onChange={(v) => set({ noDueDate: v })} label="No due date" description="Students can submit any time" />

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
          <option value="link">Link</option>
        </Select>
      </div>

      <Switch checked={Boolean(lesson.allowResubmission)} onChange={(v) => set({ allowResubmission: v })} label="Allow resubmission" description="Students can replace a graded submission" />
      <Switch checked={Boolean(lesson.lateHandling)} onChange={(v) => set({ lateHandling: v })} label="Accept late submissions" description="Flagged as late, still gradable" />

      <div className="flex flex-col gap-3 rounded-xl bg-bg p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">Rubric (optional)</span>
          <span className="text-xs font-semibold text-primary">
            {rubric.reduce((s, r) => s + (Number(r.points) || 0), 0)} pts
          </span>
        </div>
        {rubric.map((r) => (
          <div key={r.id} className="flex items-center gap-2">
            <input
              value={r.label}
              onChange={(e) => updateCriterion(r.id, { label: e.target.value })}
              placeholder="Criterion — e.g. Clear naming convention"
              className="flex-1 rounded-lg border border-text/15 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
            <input
              type="number"
              min={0}
              value={r.points}
              onChange={(e) => updateCriterion(r.id, { points: Number(e.target.value) })}
              className="w-20 rounded-lg border border-text/15 bg-white px-2.5 py-2 text-sm outline-none"
            />
            <button type="button" onClick={() => removeCriterion(r.id)} className="text-muted hover:text-danger">
              <TrashIcon className="h-4 w-4" />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={addCriterion}
          className="flex items-center justify-center gap-1.5 rounded-full border border-dashed border-text/25 py-2 text-xs font-semibold text-primary hover:border-primary hover:bg-primary/[0.04]"
        >
          <PlusIcon className="h-3.5 w-3.5" /> Add criterion
        </button>
      </div>
    </div>
  );
}

// -- Downloadable resource ------------------------------------------------
function ResourceEditor({ lesson, set }) {
  const files = lesson.files || [];

  function addFile(file) {
    if (!file) return;
    set({ files: [...files, { id: crypto.randomUUID(), name: file.name, size: file.size }] });
  }
  function removeFile(fid) {
    set({ files: files.filter((f) => f.id !== fid) });
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <FieldLabel>Files</FieldLabel>
        <FileDropzone label="Upload a file" hint="PDF, DOCX, ZIP, images — add as many as needed" onFileSelect={addFile} />
      </div>

      {files.length > 0 && (
        <div className="flex flex-col gap-2">
          {files.map((f) => (
            <div key={f.id} className="flex items-center gap-3 rounded-xl border border-text/10 bg-bg px-3.5 py-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <FileGenericIcon className="h-4 w-4" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-text">{f.name}</span>
                <span className="block text-xs text-muted">{formatBytes(f.size)}</span>
              </span>
              <button type="button" onClick={() => removeFile(f.id)} aria-label="Remove file" className="shrink-0 text-muted hover:text-danger">
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <FieldLabel>Description (optional)</FieldLabel>
        <textarea
          rows={2}
          value={lesson.description2 ?? lesson.resourceNote ?? ""}
          onChange={(e) => set({ resourceNote: e.target.value })}
          placeholder="What's in this download and how should students use it?"
          className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm outline-none placeholder:text-muted focus:border-primary focus:ring-2 focus:ring-primary/15"
        />
      </div>
    </div>
  );
}

// -- Live session ------------------------------------------------------------
function LiveEditor({ lesson, set }) {
  function addPreRead(file) {
    if (!file) return;
    set({ preSessionFiles: [...(lesson.preSessionFiles || []), { id: crypto.randomUUID(), name: file.name, size: file.size }] });
  }
  function removePreRead(fid) {
    set({ preSessionFiles: (lesson.preSessionFiles || []).filter((f) => f.id !== fid) });
  }

  const scheduled = lesson.scheduledAt ? new Date(lesson.scheduledAt) : null;

  return (
    <div className="flex flex-col gap-5">
      <div className="rounded-xl border border-text/10 bg-bg p-4">
        <span className="text-xs font-semibold uppercase tracking-wide text-muted">Linked live session</span>
        {scheduled ? (
          <>
            <p className="mt-1.5 text-sm font-semibold text-text">
              {scheduled.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })} ·{" "}
              {scheduled.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" })}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">{lesson.meetingLink || "No meeting link set yet"}</p>
          </>
        ) : (
          <p className="mt-1.5 text-sm text-muted">Not scheduled yet — set a date &amp; link below.</p>
        )}
        <p className="mt-2 text-xs text-muted">
          Content here is limited to what surrounds the live session — pre-session materials and, afterward, the recording.
        </p>
      </div>

      <Input
        label="Scheduled date & time"
        type="datetime-local"
        value={lesson.scheduledAt || ""}
        onChange={(e) => set({ scheduledAt: e.target.value })}
        shape="rect"
      />
      <Input
        label="Meeting link"
        value={lesson.meetingLink || ""}
        onChange={(e) => set({ meetingLink: e.target.value })}
        placeholder="https://…"
        shape="rect"
      />

      <div>
        <FieldLabel>Pre-session materials</FieldLabel>
        <FileDropzone label="Upload a pre-read" hint="PDF or slides students should review beforehand" onFileSelect={addPreRead} />
        {(lesson.preSessionFiles || []).length > 0 && (
          <div className="mt-2 flex flex-col gap-2">
            {lesson.preSessionFiles.map((f) => (
              <div key={f.id} className="flex items-center gap-3 rounded-xl border border-text/10 bg-bg px-3.5 py-2.5">
                <FileGenericIcon className="h-4 w-4 shrink-0 text-muted" />
                <span className="min-w-0 flex-1 truncate text-sm text-text">{f.name}</span>
                <button type="button" onClick={() => removePreRead(f.id)} className="shrink-0 text-muted hover:text-danger">
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-dashed border-text/20 bg-bg px-4 py-5 text-center text-sm text-muted">
        Recording will appear here automatically once this session has taken place.
      </div>
    </div>
  );
}

// LessonContentPanel — the main editor for whichever lesson the tree has
// selected. Shared header (title/description/required toggle) + save
// state live outside the per-type switch since every lesson type needs
// them identically.
export default function LessonContentPanel({ lesson, onChange, onSaveDraft, onSaveNext, saveStatus, savedAt, hasNext }) {
  if (!lesson) {
    return (
      <div className="flex h-full min-h-[420px] flex-col items-center justify-center rounded-3xl bg-white text-center shadow-soft">
        <SparkleIcon className="h-10 w-10 text-text/15" />
        <p className="mt-3 text-sm text-muted">Select a lesson from the curriculum to add its content.</p>
      </div>
    );
  }

  const meta = LESSON_TYPE_META[lesson.type];

  function set(patch) {
    onChange({ ...lesson, ...patch });
  }

  return (
    <div className="flex flex-col rounded-3xl bg-white shadow-soft">
      <div className="border-b border-text/[0.07] px-5 py-4 sm:px-7">
        <div className="flex items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
            <meta.Icon className="h-4 w-4" />
          </span>
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">{meta.label} lesson</span>
          <AutoSaveIndicator status={saveStatus} timestamp={savedAt} className="ml-auto" />
        </div>
        <input
          value={lesson.title}
          onChange={(e) => set({ title: e.target.value })}
          placeholder="Lesson title"
          className="mt-2.5 w-full border-none bg-transparent p-0 text-xl font-semibold text-text outline-none placeholder:text-muted"
        />
        <input
          value={lesson.description || ""}
          onChange={(e) => set({ description: e.target.value })}
          placeholder="Short description (optional)"
          className="mt-1 w-full border-none bg-transparent p-0 text-sm text-muted outline-none placeholder:text-muted"
        />
      </div>

      <div className="px-5 py-5 sm:px-7">
        {lesson.type === "video" && <VideoEditor lesson={lesson} set={set} />}
        {lesson.type === "article" && <ArticleEditor lesson={lesson} set={set} />}
        {lesson.type === "quiz" && <QuizEditor lesson={lesson} set={set} />}
        {lesson.type === "assignment" && <AssignmentEditor lesson={lesson} set={set} />}
        {lesson.type === "resource" && <ResourceEditor lesson={lesson} set={set} />}
        {lesson.type === "live" && <LiveEditor lesson={lesson} set={set} />}

        <div className="mt-6 border-t border-text/[0.07] pt-5">
          <Switch
            checked={Boolean(lesson.required)}
            onChange={(v) => set({ required: v })}
            label="Required for completion"
            description="Students must finish this lesson to earn a certificate"
          />
        </div>
      </div>

      <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-text/[0.07] bg-white/95 px-5 py-4 backdrop-blur sm:px-7">
        <Button variant="secondary" fullWidth={false} className="px-5" onClick={onSaveDraft}>
          Save Draft
        </Button>
        <Button variant="primary" fullWidth={false} className="px-5" onClick={onSaveNext}>
          {hasNext ? "Save & Next Lesson" : "Save"}
        </Button>
      </div>
    </div>
  );
}
