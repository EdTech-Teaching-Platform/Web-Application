import { useEffect, useRef, useState } from "react";
import { answerUploadsApi } from "../../../services/answerUploadsApi";

// Shows an uploaded answer sheet inside the page (QA 21 Nov: opening it in a
// new tab during a test counted as a tab-switch violation). Photos as an
// image; a PDF is fetched and shown from a local blob: URL in a frame. The
// signed URL is private and expires in 10 minutes.
//   <AnswerPreview file={{id, fileName, contentType}} onClose={...} />
export default function AnswerPreview({ file, onClose, api = answerUploadsApi, fetchImpl = (...a) => fetch(...a) }) {
  const [src, setSrc] = useState(null);
  const [error, setError] = useState("");
  const closeRef = useRef(null);
  const isPdf = file.contentType === "application/pdf";

  useEffect(() => {
    let alive = true;
    let objectUrl = null;
    (async () => {
      try {
        const url = await api.fileUrl(file.id);
        if (!isPdf) { if (alive) setSrc(url); return; }
        const res = await fetchImpl(url);
        if (!res.ok) throw new Error("Couldn't load the file.");
        const blob = await res.blob();
        objectUrl = URL.createObjectURL(new Blob([blob], { type: "application/pdf" }));
        if (alive) setSrc(objectUrl);
      } catch (err) {
        if (alive) setError(err.message || "Couldn't load the file.");
      }
    })();
    return () => { alive = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [api, fetchImpl, file.id, isPdf]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[1300] flex items-center justify-center p-3 sm:p-6">
      <div className="absolute inset-0 bg-text/60" aria-hidden="true" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label={`Preview of ${file.fileName}`}
        className="relative flex h-full max-h-[92vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-center justify-between gap-3 border-b border-text/10 px-4 py-2.5">
          <p className="truncate text-sm font-semibold text-text">{file.fileName}</p>
          <button ref={closeRef} type="button" onClick={onClose} className="rounded-full px-3 py-1 text-sm font-semibold text-text ring-1 ring-text/15 hover:bg-text/5">Close</button>
        </div>
        <div className="flex min-h-0 flex-1 items-center justify-center bg-bg">
          {error ? <p role="alert" className="px-6 text-sm text-danger">{error}</p>
            : !src ? <p role="status" className="text-sm text-text/60">Loading…</p>
            : isPdf ? <iframe src={src} title={`PDF ${file.fileName}`} className="h-full w-full border-0" />
            : <img src={src} alt={`Your answer sheet ${file.fileName}`} className="max-h-full max-w-full object-contain" />}
        </div>
      </div>
    </div>
  );
}
