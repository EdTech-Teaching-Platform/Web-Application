import { useRef } from "react";
import { UploadIcon, XIcon, CheckIcon } from "./icons";

function formatSize(bytes) {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

// File upload — design.md Section 4 (Forms): dashed-border rounded
// drop-zone, icon + label; then a compact uploaded-row state (filename,
// remove). Extended with an optional linear --color-primary progress state
// and a failed/"Try again" state (Educator Verification, per mockup) —
// still the same shared component, no parallel version forked.
// `status`: undefined/"success" (default once a file is set) | "uploading" | "error".
export default function FileDropzone({
  label,
  hint = "or click to browse",
  file,
  status = "success",
  progress = 100,
  onFileSelect,
  onRetry,
}) {
  const inputRef = useRef(null);

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        className="hidden"
        onChange={(e) => onFileSelect?.(e.target.files?.[0] ?? null)}
      />
      {file ? (
        <div
          className={`rounded-xl border px-4 py-3 text-sm ${
            status === "error" ? "border-danger/40 bg-danger/5" : "border-text/15 bg-bg"
          }`}
        >
          <div className="flex items-center gap-3">
            <span
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
                status === "error" ? "bg-danger/10 text-danger" : "bg-primary/10 text-primary"
              }`}
            >
              {status === "error" ? <XIcon className="h-4 w-4" /> : <CheckIcon className="h-4 w-4" />}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate font-medium text-text">{file.name}</span>
              <span className="block text-xs text-text/40">
                {formatSize(file.size)}
                {status === "error" && <span className="ml-2 font-semibold text-danger">Upload failed</span>}
              </span>
            </span>
            {status === "error" ? (
              <button
                type="button"
                onClick={() => onRetry?.()}
                className="shrink-0 text-xs font-semibold text-danger hover:underline"
              >
                Try again
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onFileSelect?.(null)}
                className="shrink-0 text-xs font-semibold text-text/40 hover:text-danger"
                aria-label="Remove file"
              >
                <XIcon className="h-4 w-4" />
              </button>
            )}
          </div>
          {status !== "error" && (
            <div className="mt-2.5 h-1 w-full overflow-hidden rounded-full bg-text/10">
              <div
                className="h-full rounded-full bg-success transition-all duration-300"
                style={{ width: `${status === "uploading" ? progress : 100}%` }}
              />
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full items-center gap-3 rounded-xl border border-dashed border-text/25 bg-bg/70 px-5 py-4 text-left text-text/60 transition-colors duration-150 hover:border-primary hover:text-primary"
        >
          <UploadIcon className="shrink-0" />
          <span>
            <span className="block text-sm font-medium">{label}</span>
            <span className="block text-xs text-text/40">{hint}</span>
          </span>
        </button>
      )}
    </div>
  );
}
