import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../../components/ui/Button";
import RichTextEditor from "../../../components/ui/RichTextEditor";
import QuestionImage from "../../../components/testseries/QuestionImage";
import {
  XIcon,
  LinkIcon,
  ArrowRightIcon,
  ChevronDownIcon,
  FileGenericIcon,
  ArticleIcon,
  DownloadFileIcon,
  AlertTriangleIcon,
  ClockIcon,
  PlusIcon,
  TrashIcon,
  RepeatIcon,
  CheckIcon,
} from "../../../components/ui/icons";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

const IMAGE_EXT = /\.(png|jpe?g|gif|webp|svg)$/i;
const PDF_EXT = /\.pdf$/i;

const DEFAULT_SNIPPETS = [
  "Great work — clear reasoning throughout!",
  "Please resubmit with more detail on your approach.",
  "Solid effort, but double-check the requirements before your next submission.",
  "This exceeds expectations — nice attention to detail.",
];

function SubmissionViewer({ submission }) {
  const content = submission.content || {};

  if (content.kind === "file" && !content.value) {
    return (
      <div className="flex items-start gap-2.5 rounded-xl bg-danger/[0.06] px-4 py-3.5 text-sm text-danger">
        <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
        No content received — this student marked the assignment submitted, but no file actually came through.
      </div>
    );
  }

  if (content.kind === "file") {
    const isImage = IMAGE_EXT.test(content.value);
    const isPdf = PDF_EXT.test(content.value);
    return (
      <div className="overflow-hidden rounded-xl border border-text/10 bg-bg">
        {isImage || isPdf ? (
          <div className="flex h-40 items-center justify-center bg-text/[0.04] text-text/25">
            <div className="text-center">
              <FileGenericIcon className="mx-auto h-8 w-8" />
              <p className="mt-1.5 text-xs">{isImage ? "Image preview" : "PDF preview"} (simulated)</p>
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-3 px-4 py-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/[0.08] text-primary">
            <FileGenericIcon className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-text">{content.value}</p>
            <p className="text-xs text-muted">{formatSize(content.fileSize)}</p>
          </div>
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            className="flex shrink-0 items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-xs font-semibold text-primary ring-1 ring-primary/25 hover:bg-primary/5"
          >
            <DownloadFileIcon className="h-3.5 w-3.5" />
            Download to view
          </button>
        </div>
      </div>
    );
  }

  if (content.kind === "link") {
    return (
      <a
        href={content.value}
        target="_blank"
        rel="noreferrer"
        onClick={(e) => e.preventDefault()}
        className="flex items-center gap-2.5 rounded-xl border border-text/10 bg-bg px-4 py-3.5 text-sm text-primary hover:bg-primary/[0.04]"
      >
        <LinkIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{content.value}</span>
        <span className="shrink-0 text-xs font-semibold">Open link</span>
      </a>
    );
  }

  // text
  return (
    <div className="flex items-start gap-2.5 rounded-xl border border-text/10 bg-bg px-4 py-3.5 text-sm leading-relaxed text-text/75">
      <ArticleIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted" />
      <p className="whitespace-pre-wrap">{content.value}</p>
    </div>
  );
}

// GradingPanel — a dedicated full workspace (not the shared centered
// Modal — this needs room for the brief, the submission and the rubric
// side by side on larger screens) matching the Assignment lesson's own
// fields from Content Upload (instructions, due date, max score, rubric)
// so grading one submission reads as the other half of that same lesson,
// never a separately invented shape. "Save & Next" commits this
// submission then hands back to the queue's next pending one via
// onSaveNext, so an educator can move through a stack without re-opening
// the panel each time.
export default function GradingPanel({ submission, lesson, queuePosition, queueTotal, hasNext, onClose, onSave, onSaveNext, onSaveDraft, onRequestResubmission }) {
  const [scores, setScores] = useState({});
  const [feedback, setFeedback] = useState("");
  const [briefOpen, setBriefOpen] = useState(true);
  const [snippets, setSnippets] = useState(DEFAULT_SNIPPETS);
  const [newSnippet, setNewSnippet] = useState("");
  const [showAddSnippet, setShowAddSnippet] = useState(false);
  const [pulse, setPulse] = useState(false);
  const editorKey = useRef(0);

  const rubric = lesson?.rubric || [];
  const hasRubric = rubric.length > 0;
  const maxScore = submission?.type === "quiz" ? submission?.manualMaxScore ?? 10 : lesson?.maxScore ?? 100;

  useEffect(() => {
    if (!submission) return;
    setFeedback(submission.feedback ?? "");
    editorKey.current += 1;
    if (hasRubric) {
      const seed = {};
      rubric.forEach((r) => {
        seed[r.id] = "";
      });
      setScores(seed);
    } else {
      setScores({ overall: submission.score ?? "" });
    }
    setBriefOpen(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [submission?.id]);

  const total = useMemo(() => {
    if (hasRubric) return rubric.reduce((s, r) => s + (Number(scores[r.id]) || 0), 0);
    return scores.overall === "" || scores.overall === undefined ? null : Number(scores.overall);
  }, [scores, hasRubric, rubric]);

  useEffect(() => {
    setPulse(true);
    const t = window.setTimeout(() => setPulse(false), 350);
    return () => window.clearTimeout(t);
  }, [total]);

  if (!submission) return null;

  const overMax = total !== null && total > maxScore;
  const valid = total !== null && total >= 0 && !overMax;
  const late = Boolean(submission.late);
  const isTestSeries = submission.source === "test_series";

  function commit() {
    if (!valid) return;
    onSave({ score: total, feedback });
  }
  function saveDraft() {
    onSaveDraft({ score: total ?? 0, feedback });
  }
  function insertSnippet(text) {
    setFeedback((prev) => (prev ? `${prev}<p>${text}</p>` : `<p>${text}</p>`));
    editorKey.current += 1;
  }
  function addSnippet() {
    if (!newSnippet.trim()) return;
    setSnippets((prev) => [...prev, newSnippet.trim()]);
    setNewSnippet("");
    setShowAddSnippet(false);
  }
  function removeSnippet(i) {
    setSnippets((prev) => prev.filter((_, idx) => idx !== i));
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-bg sm:inset-4 sm:z-40 sm:overflow-hidden sm:rounded-3xl sm:shadow-2xl sm:ring-1 sm:ring-text/[0.08]">
      {/* Header */}
      <div className="flex shrink-0 flex-col gap-3 border-b border-text/[0.07] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
            {submission.studentName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <p className="truncate text-sm font-semibold text-text">{submission.studentName}</p>
              {/* Test Series submissions share this panel + rubric workflow;
                  the tag just makes their origin visible. */}
              {isTestSeries && (
                <span className="shrink-0 rounded-full bg-pastel-lavender px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-pastel-lavender-ink">Test Series</span>
              )}
            </div>
            <p className="truncate text-xs text-muted">
              {isTestSeries ? `${submission.seriesTitle} · ${submission.testTitle} · Written answer` : `${lesson?.title || submission.moduleTitle} · ${submission.type === "quiz" ? "Quiz (manual review)" : "Assignment"}`} · Submitted {submission.submittedAt}
              {late && <span className="ml-1.5 font-semibold text-danger">· Late</span>}
            </p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-3">
          {queuePosition > 0 && queueTotal > 0 && (
            <span className="rounded-full bg-text/[0.06] px-3 py-1.5 text-xs font-semibold text-muted">
              Grading {queuePosition} of {queueTotal}
            </span>
          )}
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-muted hover:bg-bg hover:text-text">
            <XIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-5">
          {lesson && (
            <div className="overflow-hidden rounded-3xl bg-white shadow-soft">
              <button type="button" onClick={() => setBriefOpen((v) => !v)} className="flex w-full items-center justify-between px-4 py-3.5 text-left">
                <span className="text-sm font-semibold text-text">{isTestSeries ? "Question" : "Assignment brief"}</span>
                <ChevronDownIcon className={`h-4 w-4 text-muted transition-transform duration-200 ${briefOpen ? "rotate-180" : ""}`} />
              </button>
              {briefOpen && (
                <div className="flex flex-col gap-3 border-t border-text/[0.06] px-4 py-4">
                  <div className="flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      <ClockIcon className="h-3.5 w-3.5" />
                      {lesson.noDueDate ? "No due date" : lesson.dueDate ? `Due ${lesson.dueDate}` : "No due date"}
                    </span>
                    <span>Max score: {maxScore}</span>
                    {lesson.allowResubmission && <span className="rounded-full bg-primary/10 px-2 py-0.5 font-semibold text-primary">Resubmission allowed</span>}
                  </div>
                  {lesson.instructions && (
                    <div className="prose prose-sm max-w-none rounded-xl bg-bg px-4 py-3 text-sm text-muted" dangerouslySetInnerHTML={{ __html: lesson.instructions }} />
                  )}
                  {lesson.image && <QuestionImage image={lesson.image} />}
                </div>
              )}
            </div>
          )}

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Submission</span>
            <SubmissionViewer submission={submission} />
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-text">{hasRubric ? "Rubric" : "Score"}</span>
              <span className={`rounded-full px-2.5 py-1 text-xs font-bold transition-all duration-300 ${overMax ? "bg-danger/15 text-danger" : "bg-primary/10 text-primary"} ${pulse ? "scale-110" : "scale-100"}`}>
                {total ?? 0}/{maxScore}
              </span>
            </div>
            {hasRubric ? (
              <div className="flex flex-col gap-2 rounded-xl border border-text/10 p-3">
                {rubric.map((r) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-lg px-1 py-1.5">
                    <span className="min-w-0 flex-1 text-sm text-text/75">{r.label}</span>
                    <input
                      type="number"
                      min={0}
                      max={r.points}
                      value={scores[r.id] ?? ""}
                      onChange={(e) => setScores((prev) => ({ ...prev, [r.id]: e.target.value }))}
                      placeholder="0"
                      className="w-20 rounded-lg border border-text/15 bg-bg px-2.5 py-1.5 text-right text-sm font-semibold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
                    />
                    <span className="w-14 shrink-0 text-xs text-muted">/ {r.points} pts</span>
                  </div>
                ))}
              </div>
            ) : (
              <input
                type="number"
                min={0}
                max={maxScore}
                value={scores.overall ?? ""}
                onChange={(e) => setScores({ overall: e.target.value })}
                placeholder="0"
                className="w-32 rounded-xl border border-text/15 bg-bg px-4 py-2.5 text-sm font-semibold text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            )}
            {overMax && <p className="mt-1.5 text-xs font-medium text-danger">Score can't exceed the max of {maxScore}.</p>}
          </div>

          <div>
            <span className="mb-1.5 block text-sm font-medium text-text">Written feedback</span>
            <RichTextEditor key={`${submission.id}-${editorKey.current}`} value={feedback} onChange={setFeedback} placeholder="Give the student specific, actionable feedback…" minHeight={120} />
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {snippets.map((snip, i) => (
                <span key={i} className="group flex items-center gap-1 rounded-full bg-text/[0.05] pl-3 pr-1 py-1 text-xs font-medium text-muted">
                  <button type="button" onClick={() => insertSnippet(snip)} className="hover:text-primary">
                    {snip.length > 34 ? `${snip.slice(0, 34)}…` : snip}
                  </button>
                  <button type="button" onClick={() => removeSnippet(i)} aria-label="Remove snippet" className="rounded-full p-1 text-text/25 opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger">
                    <XIcon className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
              {showAddSnippet ? (
                <div className="flex items-center gap-1">
                  <input
                    autoFocus
                    value={newSnippet}
                    onChange={(e) => setNewSnippet(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addSnippet()}
                    placeholder="New snippet…"
                    className="w-40 rounded-full border border-text/15 bg-white px-3 py-1 text-xs outline-none focus:border-primary"
                  />
                  <button type="button" onClick={addSnippet} className="text-primary">
                    <CheckIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <button type="button" onClick={() => setShowAddSnippet(true)} className="flex items-center gap-1 rounded-full border border-dashed border-text/20 px-2.5 py-1 text-xs font-medium text-muted hover:border-primary hover:text-primary">
                  <PlusIcon className="h-3 w-3" />
                  Add snippet
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Footer actions */}
      <div className="flex shrink-0 flex-col gap-2.5 border-t border-text/[0.07] bg-white px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        {lesson?.allowResubmission ? (
          <button
            type="button"
            onClick={() => onRequestResubmission({ feedback })}
            className="flex items-center justify-center gap-1.5 rounded-full border border-warning/40 px-4 py-2.5 text-sm font-semibold text-warning transition-colors hover:bg-warning/5"
          >
            <RepeatIcon className="h-3.5 w-3.5" />
            Request Resubmission
          </button>
        ) : (
          <span />
        )}
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="secondary" fullWidth={false} className="px-5" onClick={saveDraft}>
            Save Draft
          </Button>
          {hasNext ? (
            <Button variant="primary" fullWidth={false} disabled={!valid} className="flex items-center justify-center gap-1.5 px-6" onClick={() => onSaveNext({ score: total, feedback })}>
              Save & Next
              <ArrowRightIcon className="h-3.5 w-3.5" />
            </Button>
          ) : (
            <Button variant="primary" fullWidth={false} disabled={!valid} className="px-6" onClick={commit}>
              Submit Grade
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
