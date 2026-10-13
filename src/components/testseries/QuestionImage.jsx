// Read-only rendering of a question's (or an answer option's) image. One
// component is used everywhere a question is shown -- the builder's Review
// preview, the student test runner and results (including the educator's
// "Preview as Student") and the Grading submission viewer -- so an uploaded
// image looks the same in every place.
//
//   <QuestionImage image={q.image} />                       stem image, click to enlarge
//   <QuestionImage image={o.image} variant="option" />      small image inside an option row
//
// States: a soft skeleton while the file decodes, a "couldn't load" fallback
// with Retry if it fails, and nothing at all when there is no image.
import { useEffect, useState } from "react";
import { AlertTriangleIcon, MaximizeIcon, XIcon } from "../ui/icons";

function Lightbox({ image, onClose }) {
  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  return (
    <div role="dialog" aria-modal="true" aria-label={image.alt || image.name || "Question image"} className="fixed inset-0 z-[70] flex items-center justify-center p-4 sm:p-8">
      <button type="button" aria-label="Close image" onClick={onClose} className="absolute inset-0 bg-text/70 backdrop-blur-[1px] motion-safe:animate-[rise-in_0.2s_ease-out_both]" />
      <div className="relative max-h-full max-w-4xl motion-safe:animate-[rise-in_0.25s_ease-out_both]">
        <img src={image.src} alt={image.alt || ""} className="max-h-[85vh] max-w-full rounded-2xl bg-white object-contain shadow-elevated" />
        <button type="button" onClick={onClose} aria-label="Close" className="absolute -right-2 -top-2 flex h-9 w-9 items-center justify-center rounded-full bg-surface text-text shadow-card hover:text-primary">
          <XIcon className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default function QuestionImage({ image, variant = "stem", zoomable = variant === "stem", className = "" }) {
  const [status, setStatus] = useState("loading"); // loading | ready | error
  const [attempt, setAttempt] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setStatus("loading");
  }, [image?.src, attempt]);

  if (!image?.src) return null;
  const small = variant === "option";
  const box = small ? "max-h-32 max-w-full" : "max-h-72 max-w-full sm:max-h-80";

  if (status === "error") {
    return (
      <div role="alert" className={`flex items-center gap-3 rounded-2xl border border-danger/30 bg-danger/5 px-4 py-3 text-xs text-danger ${className}`}>
        <AlertTriangleIcon className="h-4 w-4 shrink-0" />
        <span className="min-w-0 flex-1">This image couldn't be loaded.</span>
        <button type="button" onClick={() => setAttempt((n) => n + 1)} className="shrink-0 font-semibold underline">Retry</button>
      </div>
    );
  }

  const img = (
    <img
      key={attempt}
      src={image.src}
      alt={image.alt || (small ? "Answer option diagram" : "Question diagram")}
      onLoad={() => setStatus("ready")}
      onError={() => setStatus("error")}
      draggable={false}
      className={`${box} rounded-xl bg-white object-contain transition-opacity duration-300 ${status === "ready" ? "opacity-100" : "opacity-0"}`}
    />
  );

  return (
    <figure className={`relative inline-block max-w-full ${className}`}>
      {status === "loading" && <span aria-hidden="true" className={`absolute inset-0 animate-pulse rounded-xl bg-text/[0.07] ${small ? "min-h-20 min-w-28" : "min-h-40 min-w-56"}`} />}
      {zoomable ? (
        <button type="button" onClick={() => setOpen(true)} aria-label="Enlarge image" className="group relative block rounded-xl ring-1 ring-text/[0.08] transition-shadow duration-200 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40">
          {img}
          {status === "ready" && (
            <span aria-hidden="true" className="absolute bottom-2 right-2 flex h-7 w-7 items-center justify-center rounded-full bg-text/60 text-white opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
              <MaximizeIcon className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      ) : (
        <span className="block rounded-xl ring-1 ring-text/[0.08]">{img}</span>
      )}
      {open && <Lightbox image={image} onClose={() => setOpen(false)} />}
    </figure>
  );
}
