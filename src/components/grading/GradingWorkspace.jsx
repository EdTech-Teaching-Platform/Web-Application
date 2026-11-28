import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { gradingApi } from "../../services/gradingApi";
import { answerUploadsApi, formatFileSize } from "../../services/answerUploadsApi";
import AssetImage from "../common/AssetImage";
import { formatWhen, markProblem } from "./gradingUtils";

// Marking one attempt's written answers (20261120090000): each question with
// the marking guide, the typed answer and the uploaded answer
// sheets (photos inline, PDFs in a new tab), marks (0..max) and feedback per
// question, and overall feedback. "Save draft" keeps it private; "Publish
// marks" updates the student's score and report and notifies them. Publishing
// waits until the student's 15-minute upload window has closed.
//   <GradingWorkspace attemptId={id} backTo="/teacher/evaluate" />

// A photo shown inline (signed URL fetched on mount); a PDF as a link.
export function AnswerFile({ file, index, api = answerUploadsApi }) {
  const isPdf = file.content_type === "application/pdf";
  const [url, setUrl] = useState(null);
  const [error, setError] = useState("");
  useEffect(() => {
    if (isPdf) return undefined;
    let alive = true;
    api.fileUrl(file.id).then((u) => { if (alive) setUrl(u); }).catch((e) => { if (alive) setError(e.message || "Couldn't load"); });
    return () => { alive = false; };
  }, [api, file.id, isPdf]);
  const open = async () => {
    const tab = typeof window.open === "function" ? window.open("", "_blank") : null;
    try {
      const u = await api.fileUrl(file.id);
      if (tab) tab.location.href = u;
      else window.location.assign(u);
    } catch (e) {
      tab?.close?.();
      setError(e.message || "Couldn't open the file.");
    }
  };
  return (
    <figure className="overflow-hidden rounded-xl bg-slate-50 ring-1 ring-slate-200">
      {isPdf ? (
        <button type="button" onClick={open} className="flex h-40 w-full flex-col items-center justify-center gap-1 text-sm font-semibold text-slate-700 hover:bg-slate-100">
          <span className="rounded-md bg-red-100 px-2 py-0.5 text-xs font-bold text-red-700">PDF</span>
          Open {file.file_name}
        </button>
      ) : url ? (
        <button type="button" onClick={open} className="block w-full" aria-label={`Open page ${index + 1} full size`}>
          <img src={url} alt={`Answer sheet page ${index + 1}`} className="max-h-[32rem] w-full object-contain" loading="lazy" />
        </button>
      ) : (
        <div className="flex h-40 items-center justify-center text-xs text-slate-500">{error || "Loading page…"}</div>
      )}
      <figcaption className="flex items-center justify-between gap-2 px-3 py-1.5 text-xs text-slate-500">
        <span className="min-w-0 truncate">
          {isPdf ? file.file_name : `Page ${index + 1}`} · {formatFileSize(file.size_bytes)}
          {file.created_at && ` · added ${formatWhen(file.created_at)}`}
        </span>
        {file.after_submission && <span className="shrink-0 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-800">After submitting</span>}
        {!isPdf && <button type="button" onClick={open} className="shrink-0 font-semibold text-slate-700 hover:underline">Full size</button>}
      </figcaption>
    </figure>
  );
}

// The attempt's answer sheet next to the questions (20261128090000): each file
// with the time it was added, removed files, and when the student submitted.
function SheetPanel({ sheet, api }) {
  const files = sheet.files || [];
  const removed = sheet.removed || [];
  return (
    <aside aria-labelledby="sheet-title" className="rounded-2xl bg-white p-4 ring-1 ring-slate-200 lg:sticky lg:top-4 lg:max-h-[calc(100vh-2rem)] lg:overflow-y-auto">
      <h2 id="sheet-title" className="text-sm font-bold text-slate-900">Answer sheet ({files.length} file{files.length === 1 ? "" : "s"})</h2>
      <p className="mt-1 text-xs text-slate-500">
        {sheet.submitted_at ? `Submitted ${formatWhen(sheet.submitted_at)}.`
          : sheet.auto_submit_reason === "proctor_limit" ? "Auto-submitted after violations: no upload window."
          : files.length ? "Not submitted with the button (the time ran out or it's still open)." : ""}
      </p>
      {files.length === 0 ? (
        <p className="mt-3 rounded-xl bg-slate-50 px-3 py-4 text-center text-sm text-slate-500">No answer sheet uploaded.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {files.map((f, i) => <AnswerFile key={f.id} file={f} index={i} api={api} />)}
        </div>
      )}
      {removed.length > 0 && (
        <details className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <summary className="cursor-pointer font-semibold">Removed before submitting ({removed.length})</summary>
          <ul className="mt-2 space-y-1">
            {removed.map((f) => (
              <li key={f.id} className="flex flex-wrap items-center gap-2">
                <span className="truncate">{f.file_name}</span>
                <span className="text-slate-500">added {formatWhen(f.created_at)} · removed {formatWhen(f.removed_at)}</span>
                <RemovedFileLink file={f} api={api} />
              </li>
            ))}
          </ul>
        </details>
      )}
    </aside>
  );
}

// A file the student removed during the test (kept for the teacher, QA 21 Nov).
function RemovedFileLink({ file, api }) {
  const [error, setError] = useState("");
  const open = async () => {
    const tab = typeof window.open === "function" ? window.open("", "_blank") : null;
    try {
      const u = await api.fileUrl(file.id);
      if (tab) tab.location.href = u;
      else window.location.assign(u);
    } catch (e) {
      tab?.close?.();
      setError(e.message || "Couldn't open it.");
    }
  };
  return error
    ? <span className="text-red-600">{error}</span>
    : <button type="button" onClick={open} className="font-semibold text-slate-700 underline">Open</button>;
}

function initialMarks(questions) {
  const out = {};
  for (const q of questions) {
    out[q.question_id] = {
      marks: q.grade?.marks != null ? String(q.grade.marks) : "",
      feedback: q.grade?.feedback || "",
    };
  }
  return out;
}

export default function GradingWorkspace({ attemptId, backTo, api = gradingApi, filesApi = answerUploadsApi }) {
  const [data, setData] = useState(null);
  const [marks, setMarks] = useState({});
  const [overall, setOverall] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [confirming, setConfirming] = useState(false);

  const apply = (d) => {
    setData(d);
    setMarks(initialMarks(d.questions || []));
    setOverall(d.evaluation?.overall_feedback || "");
  };
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      apply(await api.get(attemptId));
    } catch (err) {
      setError(err.message || "Couldn't open this attempt.");
    } finally {
      setLoading(false);
    }
  }, [api, attemptId]);
  useEffect(() => { load(); }, [load]);

  const questions = useMemo(() => data?.questions || [], [data]);
  const problems = useMemo(() => Object.fromEntries(questions.map((q) => [q.question_id, markProblem(marks[q.question_id]?.marks, q.max_marks)])), [questions, marks]);
  const anyProblem = Object.values(problems).some(Boolean);
  // 20261128090000: the answer sheet (uploaded after the test) belongs to the
  // whole attempt, so it counts for every written question.
  const sheetFiles = data?.sheet?.files || [];
  const answered = (q) => Boolean((q.typed_answer || "").trim()) || (q.uploads || []).length > 0 || sheetFiles.length > 0;
  const missing = questions.filter((q) => answered(q) && (marks[q.question_id]?.marks ?? "") === "").length;
  const writtenEarned = questions.reduce((sum, q) => sum + (Number(marks[q.question_id]?.marks) || 0), 0);
  const writtenMax = questions.reduce((sum, q) => sum + Number(q.max_marks || 0), 0);
  const objective = data?.objective || { marks_earned: 0, marks_possible: 0 };

  const setOne = (qid, patch) => setMarks((m) => ({ ...m, [qid]: { ...m[qid], ...patch } }));
  const payload = () => questions.map((q) => {
    const v = marks[q.question_id] || {};
    return { questionId: q.question_id, marks: v.marks === "" || v.marks == null ? null : Number(v.marks), feedback: v.feedback || "" };
  });
  const save = async (publish) => {
    if (busy || anyProblem) return;
    setBusy(publish ? "publish" : "draft");
    setMessage("");
    try {
      apply(await api.save(attemptId, payload(), overall, publish));
      setMessage(publish ? "Marks published. The student has been notified." : "Draft saved. The student can't see it yet.");
    } catch (err) {
      setMessage(err.message || "Couldn't save. Try again.");
    } finally {
      setBusy("");
      setConfirming(false);
    }
  };

  if (loading && !data) return <p role="status" className="px-6 py-10 text-sm text-slate-500">Loading the answers…</p>;
  if (error) {
    return (
      <div className="mx-auto max-w-3xl space-y-3 px-4 py-8">
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        {backTo && <Link to={backTo} className="text-sm font-semibold text-slate-700 underline">← Back to the list</Link>}
      </div>
    );
  }

  const a = data.attempt;
  const ev = data.evaluation || {};
  const windowOpen = !data.can_publish;
  const closes = data.upload_window_closes_at ? new Date(data.upload_window_closes_at).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" }) : "";
  const publishBlock = windowOpen ? `The student is still on the answer-sheet screen (until ${closes} at the latest). Save a draft now; you can publish as soon as they submit.`
    : missing > 0 ? `Give marks for ${missing} more answered question${missing === 1 ? "" : "s"} to publish.`
    : anyProblem ? "Fix the marks shown in red." : "";
  const field = "w-full rounded-xl border border-slate-300 px-3 py-2 text-sm focus:border-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/10";

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5 px-4 py-6 sm:px-6">
      {backTo && <Link to={backTo} className="text-sm font-semibold text-slate-700 underline">← Back to the list</Link>}
      <header className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{a.series_title}</p>
            <h1 className="mt-1 text-xl font-bold text-slate-900">{a.test_title}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {a.student_name ? <><strong>{a.student_name}</strong> ({a.candidate})</> : <strong>{a.candidate}</strong>}
              {` · attempt ${a.attempt_number} · submitted ${formatWhen(a.submitted_at)}`}
            </p>
          </div>
          <div className="text-right text-sm">
            <p className="font-semibold text-slate-900">
              {objective.marks_earned + writtenEarned} / {Number(objective.marks_possible) + writtenMax} marks
            </p>
            <p className="text-xs text-slate-500">Objective {objective.marks_earned}/{objective.marks_possible} · written {writtenEarned}/{writtenMax}</p>
            <p className="mt-1 text-xs font-semibold text-slate-600">
              {ev.status === "published" ? `Published ${formatWhen(ev.published_at)}` : ev.status === "draft" ? "Draft saved" : "Not marked yet"}
            </p>
          </div>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Answer sheets for this test: uploaded after finishing, within {data.upload_window_minutes ?? 5} minutes (a PDF or page photos).
        </p>
        {windowOpen && (
          <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-sm text-amber-800">
            The student is still uploading their answer sheet (until {closes} at the latest). Reload when they've submitted.
          </p>
        )}
      </header>

      {message && <p role="status" className="rounded-xl bg-slate-100 px-4 py-3 text-sm text-slate-800">{message}</p>}

      <div className={sheetFiles.length || data?.sheet ? "grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,26rem)]" : ""}>
      <ol className="space-y-4">
        {questions.map((q) => {
          const v = marks[q.question_id] || { marks: "", feedback: "" };
          const problem = problems[q.question_id];
          const markId = `mark-${q.question_id}`;
          return (
            <li key={q.question_id} className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-lg bg-slate-900 px-2 py-0.5 text-sm font-bold text-white">Q{q.position}</span>
                <span className="text-sm text-slate-500">{q.max_marks} marks</span>
                {!answered(q) && <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-semibold text-slate-600">Not answered</span>}
                {!(q.typed_answer || "").trim() && sheetFiles.length > 0 && <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-semibold text-sky-800">See the answer sheet</span>}
              </div>
              <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-slate-900">{q.text}</p>
              {q.image_path && <AssetImage path={q.image_path} alt={q.image_alt || ""} className="mt-3 max-h-64 rounded-xl object-contain" />}
              {q.marking_guide && (
                <details className="mt-3 rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-700">
                  <summary className="cursor-pointer font-semibold">Marking guide</summary>
                  <p className="mt-2 whitespace-pre-line">{q.marking_guide}</p>
                </details>
              )}

              <div className="mt-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Typed answer</p>
                <p className="mt-1 whitespace-pre-line rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-900">
                  {(q.typed_answer || "").trim() || <span className="text-slate-500">No typed answer.</span>}
                </p>
              </div>
              {(q.uploads || []).length > 0 && (
                <div className="mt-4">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Uploaded answer sheet ({q.uploads.length})</p>
                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    {q.uploads.map((f, i) => <AnswerFile key={f.id} file={f} index={i} api={filesApi} />)}
                  </div>
                </div>
              )}
              {(q.removed_uploads || []).length > 0 && (
                <details className="mt-3 rounded-xl bg-slate-50 px-4 py-2 text-sm text-slate-700">
                  <summary className="cursor-pointer font-semibold">Removed by the student during the test ({q.removed_uploads.length})</summary>
                  <ul className="mt-2 space-y-1 text-xs">
                    {q.removed_uploads.map((f) => (
                      <li key={f.id} className="flex flex-wrap items-center gap-2">
                        <span className="truncate">{f.file_name}</span>
                        <span className="text-slate-500">added {formatWhen(f.created_at)} · removed {formatWhen(f.removed_at)}</span>
                        <RemovedFileLink file={f} api={filesApi} />
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="mt-4 grid gap-3 sm:grid-cols-[10rem_1fr]">
                <div>
                  <label htmlFor={markId} className="block text-xs font-semibold text-slate-700">Marks (out of {q.max_marks})</label>
                  <div className="mt-1 flex items-center gap-2">
                    <input id={markId} type="number" inputMode="decimal" min="0" max={q.max_marks} step="0.5" value={v.marks}
                      onChange={(e) => setOne(q.question_id, { marks: e.target.value })}
                      aria-invalid={problem ? "true" : undefined} aria-describedby={problem ? `${markId}-err` : undefined}
                      className={`${field} ${problem ? "border-red-500" : ""}`} />
                    <button type="button" onClick={() => setOne(q.question_id, { marks: String(q.max_marks) })}
                      className="shrink-0 rounded-full px-2 py-1 text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Full</button>
                  </div>
                  {problem && <p id={`${markId}-err`} className="mt-1 text-xs text-red-600">{problem}</p>}
                </div>
                <label className="block text-xs font-semibold text-slate-700">
                  Feedback for the student
                  <textarea rows={2} maxLength={3000} value={v.feedback} onChange={(e) => setOne(q.question_id, { feedback: e.target.value })}
                    className={`${field} mt-1 font-normal`} placeholder="What was good, what was missing" />
                </label>
              </div>
            </li>
          );
        })}
      </ol>
      {data?.sheet && <SheetPanel sheet={data.sheet} api={filesApi} />}
      </div>

      <section className="rounded-2xl bg-white p-5 ring-1 ring-slate-200">
        <label className="block text-sm font-semibold text-slate-900">
          Overall feedback <span className="font-normal text-slate-500">(optional)</span>
          <textarea rows={3} maxLength={3000} value={overall} onChange={(e) => setOverall(e.target.value)} className={`${field} mt-1 font-normal`} />
        </label>
        {publishBlock && <p className="mt-3 text-sm text-slate-600">{publishBlock}</p>}
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button type="button" onClick={() => save(false)} disabled={!!busy || anyProblem}
            className="rounded-full px-5 py-2.5 text-sm font-semibold text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50 disabled:opacity-50">
            {busy === "draft" ? "Saving…" : "Save draft"}
          </button>
          <button type="button" onClick={() => setConfirming(true)} disabled={!!busy || !!publishBlock}
            className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            {ev.status === "published" ? "Publish changes" : "Publish marks"}
          </button>
        </div>
      </section>

      {confirming && (
        <div className="fixed inset-0 z-[1200] flex items-center justify-center px-4">
          <div className="absolute inset-0 bg-slate-900/45" aria-hidden="true" onClick={() => !busy && setConfirming(false)} />
          <div role="dialog" aria-modal="true" aria-labelledby="publish-title" className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="publish-title" className="text-lg font-bold text-slate-900">Publish these marks?</h2>
            <p className="mt-2 text-sm text-slate-700">
              The student's score becomes {objective.marks_earned + writtenEarned} / {Number(objective.marks_possible) + writtenMax}, they see your
              feedback and get a notification. You can still change the marks later.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirming(false)} disabled={!!busy} className="rounded-full px-4 py-2 text-sm font-semibold ring-1 ring-slate-300">Cancel</button>
              <button type="button" onClick={() => save(true)} disabled={!!busy} className="rounded-full bg-slate-900 px-5 py-2 text-sm font-semibold text-white disabled:opacity-50">
                {busy === "publish" ? "Publishing…" : "Publish"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
