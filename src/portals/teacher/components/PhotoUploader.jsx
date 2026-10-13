import { useEffect, useMemo, useRef } from "react";
import { UploadIcon, XIcon } from "../../../components/ui/icons";

// Circular profile-photo uploader for Educator Profile Setup. Screen-local
// (only this screen needs a circular avatar picker with an "Upload
// image"/"Remove image" pair beneath it, per the supplied reference
// mockup) so it lives in this portal's components/, not the shared
// components/ui/ folder — promote it only if a second portal needs the
// exact same circular-avatar-with-links pattern.
function initialsOf(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

export default function PhotoUploader({ file, fallbackName, onChange }) {
  const inputRef = useRef(null);

  // Object URLs must be revoked on unmount/replacement or they leak memory
  // across re-renders as the user swaps photos.
  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <div className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-full bg-primary/10 text-2xl font-semibold text-primary ring-4 ring-white">
          {previewUrl ? (
            <img src={previewUrl} alt="Profile" className="h-full w-full object-cover" />
          ) : (
            <span>{initialsOf(fallbackName)}</span>
          )}
        </div>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          aria-label="Upload profile photo"
          className="absolute bottom-0 right-0 flex h-9 w-9 items-center justify-center rounded-full border-2 border-bg bg-primary text-white shadow-sm transition-all duration-150 hover:bg-primary/90 hover:-translate-y-0.5 hover:shadow-soft"
        >
          <UploadIcon className="h-4 w-4" />
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => onChange?.(e.target.files?.[0] ?? null)}
      />

      <div className="flex items-center gap-4 text-sm font-semibold">
        <button type="button" onClick={() => inputRef.current?.click()} className="text-primary hover:underline">
          Upload image
        </button>
        {file && (
          <button
            type="button"
            onClick={() => onChange?.(null)}
            className="flex items-center gap-1 text-danger hover:underline"
          >
            <XIcon className="h-3.5 w-3.5" />
            Remove image
          </button>
        )}
      </div>
      <p className="text-xs text-muted">PNG or JPG, at least 400×400px, up to 5MB</p>
    </div>
  );
}
