import { useEffect, useRef, useState } from "react";
import {
  ANSWER_ACCEPT, ANSWER_MAX_FILES, answerUploadsApi, checkAnswerFile, formatFileSize,
} from "../../../services/answerUploadsApi";
import AnswerPreview from "./AnswerPreview";

// Handwritten answer sheets for one written question (20261120090000):
// "Take a photo" (the phone camera) or "Choose files" (photos / PDF), up to 5
// files of 10 MB. Photos are resized before upload. "View" previews a file in
// the page (never a new tab, which would count as leaving the test, QA 21 Nov).
// Files can be removed only while the test is open (canRemove); after
// submitting, pages can only be added.
//   onPreviewOpen / onPreviewClose: the runner relaxes window-focus checks
//   while a preview is shown.
//   onPickStart / onPickEnd: the test runner pauses proctoring while the
//   camera or file picker is open (leaving the page there isn't a violation).
//   onChange(list): the attempt's new upload list (mapAnswerUploads).
export default function AnswerUploader({
  attemptId, questionId, files = [], canUpload = true, canRemove = true, onChange, onPickStart, onPickEnd,
  onPreviewOpen, onPreviewClose, api = answerUploadsApi, label = "Upload your answer sheet",
}) {
  const [preview, setPreview] = useState(null);
  const [queue, setQueue] = useState([]);   // [{key, name, progress, error}]
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);
  const pickRef = useRef(false);
  const busy = queue.some((q) => !q.error);
  const room = Math.max(0, ANSWER_MAX_FILES - files.length - queue.filter((q) => !q.error).length);

  // The picker closed without a choice: the window gets focus back.
  useEffect(() => () => window.removeEventListener("focus", onFocusBack), []);   // eslint-disable-line react-hooks/exhaustive-deps
  function onFocusBack() {
    window.removeEventListener("focus", onFocusBack);
    setTimeout(() => endPick(), 400);
  }
  function startPick() {
    if (pickRef.current) return;
    pickRef.current = true;
    onPickStart?.();
    window.addEventListener("focus", onFocusBack);
  }
  function endPick() {
    if (!pickRef.current) return;
    pickRef.current = false;
    window.removeEventListener("focus", onFocusBack);
    onPickEnd?.();
  }

  async function addFiles(list) {
    endPick();
    setError("");
    const picked = Array.from(list || []);
    if (!picked.length) return;
    if (picked.length > room) setError(`You can add ${room} more file${room === 1 ? "" : "s"} for this answer (5 at most).`);
    const take = picked.slice(0, room);
    for (const file of take) {
      const key = `${file.name}-${file.size}-${Math.random()}`;
      const problem = checkAnswerFile(file);
      if (problem) {
        setQueue((q) => [...q, { key, name: file.name, progress: 0, error: problem }]);
        continue;
      }
      setQueue((q) => [...q, { key, name: file.name, progress: 0, error: "" }]);
      try {
        const next = await api.upload({
          attemptId, questionId, file,
          onProgress: (p) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, progress: p } : x))),
        });
        setQueue((q) => q.filter((x) => x.key !== key));
        onChange?.(next);
      } catch (err) {
        setQueue((q) => q.map((x) => (x.key === key ? { ...x, error: err.message || "The upload failed. Try again." } : x)));
      }
    }
  }

  async function remove(file) {
    setBusyId(file.id);
    setError("");
    try {
      onChange?.(await api.remove(file.id));
    } catch (err) {
      setError(err.message || "Couldn't remove the file.");
    } finally {
      setBusyId(null);
    }
  }

  function view(file) {
    setError("");
    onPreviewOpen?.();
    setPreview(file);
  }
  function closePreview() {
    setPreview(null);
    onPreviewClose?.();
  }

  const btn = "inline-flex cursor-pointer items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ring-1 transition-colors focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-primary";
  const inputId = `ans-${questionId}`;
  return (
    <div className="rounded-2xl border border-dashed border-text/20 bg-bg/60 p-4" data-testid="answer-uploader">
      <p className="text-sm font-semibold text-text">{label}</p>
      <p className="mt-1 text-xs text-text/60">
        Write the answer on paper, then take clear photos of each page or upload a PDF. Up to {ANSWER_MAX_FILES} files, 10 MB each.
      </p>

      {canUpload && room > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          <label className={`${btn} bg-primary text-white ring-primary`} htmlFor={`${inputId}-camera`} onPointerDown={startPick} onKeyDown={startPick}>
            Take a photo
            <input id={`${inputId}-camera`} type="file" accept="image/*" capture="environment" className="sr-only"
              onClick={startPick} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} disabled={busy} />
          </label>
          <label className={`${btn} bg-white text-text ring-text/15 hover:bg-text/5`} htmlFor={`${inputId}-files`} onPointerDown={startPick} onKeyDown={startPick}>
            Choose photos or PDF
            <input id={`${inputId}-files`} type="file" accept={ANSWER_ACCEPT} multiple className="sr-only"
              onClick={startPick} onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} disabled={busy} />
          </label>
        </div>
      )}
      {!canUpload && <p className="mt-3 text-xs font-medium text-text/60">Uploads are closed for this test.</p>}
      {canUpload && room === 0 && !busy && <p className="mt-3 text-xs font-medium text-text/60">You've added the maximum of {ANSWER_MAX_FILES} files. Remove one to add another.</p>}

      {queue.length > 0 && (
        <ul className="mt-3 space-y-2" aria-live="polite">
          {queue.map((q) => (
            <li key={q.key} className="rounded-xl bg-white px-3 py-2 text-xs ring-1 ring-text/10">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate font-medium text-text">{q.name}</span>
                {q.error
                  ? <button type="button" className="font-semibold text-text/60 hover:underline" onClick={() => setQueue((list) => list.filter((x) => x.key !== q.key))}>Dismiss</button>
                  : <span className="text-text/60">{q.progress}%</span>}
              </div>
              {q.error
                ? <p role="alert" className="mt-1 text-danger">{q.error}</p>
                : <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-text/10" role="progressbar" aria-label={`Uploading ${q.name}`} aria-valuemin={0} aria-valuemax={100} aria-valuenow={q.progress}>
                    <div className="h-full bg-primary transition-[width]" style={{ width: `${q.progress}%` }} />
                  </div>}
            </li>
          ))}
        </ul>
      )}

      {files.length > 0 && (
        <ul className="mt-3 space-y-2" aria-label="Uploaded files">
          {files.map((f, i) => (
            <li key={f.id} className="flex flex-wrap items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm ring-1 ring-text/10">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-[11px] font-bold text-primary" aria-hidden="true">
                {f.contentType === "application/pdf" ? "PDF" : i + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium text-text">{f.fileName}</span>
                <span className="text-xs text-text/50">{formatFileSize(f.size)}</span>
              </span>
              <button type="button" onClick={() => view(f)} className="rounded-full px-3 py-1 text-xs font-semibold text-primary hover:bg-primary/10">View</button>
              {canUpload && canRemove && (
                <button type="button" onClick={() => remove(f)} disabled={busyId === f.id}
                  className="rounded-full px-3 py-1 text-xs font-semibold text-danger hover:bg-danger/10 disabled:opacity-50"
                  aria-label={`Remove ${f.fileName}`}>
                  {busyId === f.id ? "Removing…" : "Remove"}
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
      {canUpload && !canRemove && files.length > 0 && (
        <p className="mt-2 text-xs text-text/60">Pages you've uploaded can't be removed after submitting. You can still add more.</p>
      )}
      {error && <p role="alert" className="mt-2 text-xs text-danger">{error}</p>}
      {preview && <AnswerPreview file={preview} api={api} onClose={closePreview} />}
    </div>
  );
}
