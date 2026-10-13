// Optional image upload for a question (QuestionImageUpload) or for one answer
// option (OptionImageUpload) in the Test Series Question Builder.
//
// Styled like the Content Upload zones (dashed rounded drop-zone with an icon,
// then a compact "uploaded" row with progress / remove) and kept optional. The
// image is stored on the question record itself (`question.image`,
// `option.image`); see data/questionImages.js. Handles drag-and-drop or click,
// validates type and size, shows upload progress, a thumbnail with Replace /
// Remove, and a failed state with Try again.
import { useCallback, useEffect, useRef, useState } from "react";
import QuestionImage from "../../../components/testseries/QuestionImage";
import { AlertTriangleIcon, CheckIcon, PlusIcon, RepeatIcon, TrashIcon, UploadIcon, XIcon } from "../../../components/ui/icons";
import { IMAGE_ACCEPT, OPTION_MAX_DIM, QUESTION_MAX_DIM, formatBytes, processImageFile } from "../data/questionImages";

const RISE = "motion-safe:animate-[rise-in_0.3s_ease-out_both]";

function useImageUpload({ maxDim, onChange }) {
  const [state, setState] = useState({ status: "idle", progress: 0, error: "", name: "" });
  const lastFile = useRef(null);
  const alive = useRef(true);
  const change = useRef(onChange);
  change.current = onChange;
  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const upload = useCallback(
    async (file) => {
      if (!file) return;
      lastFile.current = file;
      setState({ status: "uploading", progress: 12, error: "", name: file.name });
      const tick = window.setInterval(() => {
        if (alive.current) setState((s) => (s.status === "uploading" ? { ...s, progress: Math.min(92, s.progress + 16) } : s));
      }, 110);
      try {
        // A short minimum duration keeps the progress state readable on fast machines.
        const [image] = await Promise.all([processImageFile(file, { maxDim }), new Promise((resolve) => window.setTimeout(resolve, 480))]);
        if (!alive.current) return;
        change.current(image);
        setState({ status: "idle", progress: 0, error: "", name: "" });
      } catch (err) {
        if (alive.current) setState({ status: "error", progress: 0, error: err?.message || "The upload failed.", name: file.name });
      } finally {
        window.clearInterval(tick);
      }
    },
    [maxDim]
  );
  const retry = useCallback(() => lastFile.current && upload(lastFile.current), [upload]);
  const dismiss = useCallback(() => setState({ status: "idle", progress: 0, error: "", name: "" }), []);
  return { state, upload, retry, dismiss };
}

function useFilePicker(onFile) {
  const inputRef = useRef(null);
  const input = (
    <input
      ref={inputRef}
      type="file"
      accept={IMAGE_ACCEPT}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        e.target.value = ""; // allow picking the same file again after a failure
        if (f) onFile(f);
      }}
    />
  );
  return { input, open: () => inputRef.current?.click() };
}

// ---- question-level image ----------------------------------------------------
export default function QuestionImageUpload({ image, onChange, disabled = false }) {
  const { state, upload, retry, dismiss } = useImageUpload({ maxDim: QUESTION_MAX_DIM, onChange });
  const picker = useFilePicker(upload);
  const [drag, setDrag] = useState(false);

  const dropProps = {
    onDragOver: (e) => {
      if (disabled) return;
      e.preventDefault();
      setDrag(true);
    },
    onDragLeave: () => setDrag(false),
    onDrop: (e) => {
      e.preventDefault();
      setDrag(false);
      if (!disabled) upload(e.dataTransfer.files?.[0]);
    },
  };

  let body;
  if (state.status === "uploading") {
    body = (
      <div className={`rounded-xl border border-text/15 bg-bg px-4 py-3 text-sm ${RISE}`} role="status" aria-live="polite">
        <div className="flex items-center gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><UploadIcon className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-text">{state.name}</span>
            <span className="block text-xs text-text/40">Uploading and optimising…</span>
          </span>
        </div>
        <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-text/10">
          <div className="h-full rounded-full bg-success transition-all duration-300" style={{ width: `${state.progress}%` }} />
        </div>
      </div>
    );
  } else if (state.status === "error") {
    body = (
      <div role="alert" className={`rounded-xl border border-danger/40 bg-danger/5 px-4 py-3 text-sm ${RISE}`}>
        <div className="flex items-start gap-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-danger/10 text-danger"><AlertTriangleIcon className="h-4 w-4" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium text-text">{state.name || "Image"}</span>
            <span className="block text-xs font-semibold text-danger">Upload failed. {state.error}</span>
          </span>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-text/40 hover:text-danger"><XIcon className="h-4 w-4" /></button>
        </div>
        <div className="mt-2.5 flex flex-wrap gap-3 pl-11 text-xs font-semibold">
          <button type="button" onClick={retry} className="text-danger hover:underline">Try again</button>
          <button type="button" onClick={picker.open} className="text-primary hover:underline">Choose another image</button>
        </div>
      </div>
    );
  } else if (image) {
    body = (
      <div className={`rounded-2xl border border-text/12 bg-bg p-3 sm:p-4 ${RISE}`}>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
          <div className="shrink-0"><QuestionImage image={image} className="[&_img]:max-h-40 sm:[&_img]:max-w-[14rem]" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 text-sm">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success/15 text-success"><CheckIcon className="h-3.5 w-3.5" /></span>
              <span className="min-w-0 flex-1 truncate font-medium text-text">{image.name || "Question image"}</span>
            </div>
            <p className="mt-0.5 pl-8 text-xs text-text/40">{formatBytes(image.size)}{image.width ? ` · ${image.width}×${image.height}` : ""}</p>
            <label className="mt-3 block">
              <span className="mb-1 block text-xs font-medium text-text">Alt text <span className="font-normal text-muted">(optional, read aloud for students using a screen reader)</span></span>
              <input
                value={image.alt || ""}
                onChange={(e) => onChange({ ...image, alt: e.target.value })}
                disabled={disabled}
                placeholder="e.g. Velocity–time graph for the first 6 seconds"
                className="w-full rounded-xl border border-text/15 bg-surface px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/15"
              />
            </label>
            {!disabled && (
              <div className="mt-3 flex flex-wrap gap-2">
                <button type="button" onClick={picker.open} className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-surface px-3.5 py-1.5 text-xs font-semibold text-text transition-colors hover:border-primary/60">
                  <RepeatIcon className="h-3.5 w-3.5" /> Replace
                </button>
                <button type="button" onClick={() => onChange(undefined)} className="inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-danger/10 hover:text-danger">
                  <TrashIcon className="h-3.5 w-3.5" /> Remove
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  } else {
    body = (
      <button
        type="button"
        disabled={disabled}
        onClick={picker.open}
        className={`flex w-full items-center gap-3 rounded-xl border border-dashed px-5 py-4 text-left transition-colors duration-150 ${drag ? "border-primary bg-primary/[0.06] text-primary" : "border-text/25 bg-bg/70 text-text/60 hover:border-primary hover:text-primary"}`}
      >
        <UploadIcon className="shrink-0" />
        <span>
          <span className="block text-sm font-medium">{drag ? "Drop the image here" : "Add an image to this question"}</span>
          <span className="block text-xs text-text/40">Drag and drop, or click to browse · PNG, JPG, WebP or GIF up to 5 MB</span>
        </span>
      </button>
    );
  }

  return (
    <div {...dropProps}>
      {picker.input}
      {body}
    </div>
  );
}

// ---- option-level image ------------------------------------------------------
// Compact: a small "Image" chip on the option row, a thumbnail once uploaded and
// a one-line error with retry underneath the row.
export function OptionImageUpload({ image, onChange, disabled = false, label = "option" }) {
  const { state, upload, retry, dismiss } = useImageUpload({ maxDim: OPTION_MAX_DIM, onChange });
  const picker = useFilePicker(upload);
  const busy = state.status === "uploading";
  return (
    <div className="flex flex-col items-end">
      {picker.input}
      {image && !busy ? (
        <span className={`group relative inline-flex ${RISE}`}>
          <button type="button" disabled={disabled} onClick={picker.open} aria-label={`Replace image for ${label}`} title="Replace image" className="block overflow-hidden rounded-lg ring-1 ring-text/15 transition-shadow hover:shadow-card">
            <img src={image.src} alt={image.alt || ""} className="h-10 w-14 bg-white object-cover" />
          </button>
          {!disabled && (
            <button type="button" onClick={() => onChange(undefined)} aria-label={`Remove image from ${label}`} className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-surface text-muted shadow-soft ring-1 ring-text/10 hover:text-danger">
              <XIcon className="h-3 w-3" />
            </button>
          )}
        </span>
      ) : (
        <button
          type="button"
          disabled={disabled || busy}
          onClick={picker.open}
          aria-label={`Add an image to ${label}`}
          className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-dashed border-text/25 px-2.5 text-xs font-semibold text-primary transition-colors hover:border-primary hover:bg-primary/[0.04] disabled:opacity-50"
        >
          {busy ? <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary/30 border-t-primary" aria-hidden="true" /> : <PlusIcon className="h-3.5 w-3.5" />}
          {busy ? "Uploading" : "Image"}
        </button>
      )}
      {state.status === "error" && (
        <span role="alert" className="mt-1 flex max-w-[14rem] flex-wrap items-center justify-end gap-x-2 text-right text-[11px] font-semibold text-danger">
          {state.error}
          <button type="button" onClick={retry} className="underline">Try again</button>
          <button type="button" onClick={dismiss} aria-label="Dismiss" className="text-muted hover:text-danger"><XIcon className="inline h-3 w-3" /></button>
        </span>
      )}
    </div>
  );
}
