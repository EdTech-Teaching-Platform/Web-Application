import { useRef } from "react";
import { UploadIcon } from "./icons";

// File upload — design.md Section 4 (Forms): dashed-border rounded
// drop-zone, icon + label; then a compact uploaded-row state (filename,
// remove). This covers the static/selected states; wiring a real upload
// progress bar is a backend-integration step, not a UI one.
export default function FileDropzone({ label, hint = "or click to browse", file, onFileSelect }) {
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
        <div className="flex items-center justify-between rounded-xl border border-text/15 bg-bg px-4 py-3 text-sm text-text">
          <span className="truncate">{file.name}</span>
          <button
            type="button"
            onClick={() => onFileSelect?.(null)}
            className="ml-3 shrink-0 text-xs font-semibold text-danger hover:underline"
          >
            Remove
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-text/25 bg-bg/70 px-6 py-8 text-center text-text/60 transition-colors duration-150 hover:border-primary hover:text-primary"
        >
          <UploadIcon />
          <span className="text-sm font-medium">{label}</span>
          <span className="text-xs text-text/40">{hint}</span>
        </button>
      )}
    </div>
  );
}
