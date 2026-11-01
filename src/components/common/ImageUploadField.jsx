import { useEffect, useRef, useState } from "react";
import AssetImage from "./AssetImage";
import { ASSET_KIND, ASSET_LIMITS, isUnsavedImage, uploadImage } from "../../services/assetsApi";

// Upload / preview / replace / remove for a series banner or a question
// figure. `value` is the stored path ('' = none); onChange(path) gets the new
// path after a successful upload, or '' on remove. The path is saved by the
// caller's RPC (the wizard, series settings or the question editor).
// Optional alt text: altValue + onAltChange.
export default function ImageUploadField({
  kind = ASSET_KIND.QUESTION, value, onChange, label, altValue, onAltChange, disabled = false, upload = uploadImage,
}) {
  const inputRef = useRef(null);
  const abortRef = useRef(null);
  const [progress, setProgress] = useState(null);   // null | 0..100
  const [error, setError] = useState("");
  const limits = ASSET_LIMITS[kind];
  const banner = kind === ASSET_KIND.BANNER;
  const unsaved = isUnsavedImage(value);
  const busy = progress !== null;
  const title = label || (banner ? "Banner image (optional)" : "Question image (optional)");

  useEffect(() => () => abortRef.current?.abort(), []);

  const pick = () => { if (!disabled && !busy) inputRef.current?.click(); };
  const onFile = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    setError("");
    setProgress(0);
    const controller = new AbortController();
    abortRef.current = controller;
    try {
      const result = await upload(kind, file, { onProgress: setProgress, signal: controller.signal });
      onChange(result.path);
    } catch (err) {
      if (err?.cause?.name !== "AbortError") setError(err?.message || "The upload failed. Try again.");
    } finally {
      abortRef.current = null;
      setProgress(null);
    }
  };
  const remove = () => { setError(""); onChange(""); if (onAltChange) onAltChange(""); };

  return (
    <div className="ul-ts-form-row">
      <label>{title}</label>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp" onChange={onFile} style={{ display: "none" }}
        aria-label={`Choose ${banner ? "a banner" : "an image"} file`} disabled={disabled} />
      {value ? (
        <div className="ul-qimg">
          <AssetImage path={value} alt={altValue || (banner ? "Banner preview" : "Question image preview")} className="ul-qimg__img"
            style={banner ? { width: "100%", aspectRatio: "16 / 6", objectFit: "cover" } : undefined}
            fallbackClassName="ul-qimg__img" />
          {unsaved && (
            <span className="ul-tsw-hint" role="status" style={{ color: "#b54708" }}>
              This image was never uploaded and students can't see it. Upload it again, or remove it.
            </span>
          )}
          <div className="ul-qimg__actions">
            <button type="button" className="ul-btn ul-btn--ghost" onClick={pick} disabled={disabled || busy}>Replace</button>
            <button type="button" className="ul-btn ul-btn--ghost" onClick={remove} disabled={disabled || busy}>Remove</button>
          </div>
        </div>
      ) : (
        <button type="button" className="ul-qimg__drop" onClick={pick} disabled={disabled || busy}>
          {banner ? "Upload a banner" : "Upload a photo or diagram"}
          <small>JPG, PNG or WebP · resized to {limits.maxWidth} px wide · up to {limits.label}</small>
        </button>
      )}
      {busy && (
        <div role="progressbar" aria-label="Uploading image" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}
          style={{ height: 6, borderRadius: 999, background: "#eef0f4", overflow: "hidden", marginTop: 6 }}>
          <div style={{ width: `${progress}%`, height: "100%", background: "#0f1115", transition: "width 120ms linear" }} />
        </div>
      )}
      {error && <span className="ul-tsw-hint" role="alert" style={{ color: "#b3261e" }}>{error}</span>}
      {onAltChange && value && (
        <input type="text" value={altValue || ""} maxLength={300} onChange={(e) => onAltChange(e.target.value)} disabled={disabled}
          placeholder={banner ? "Describe the banner (alt text)" : "Describe the image for screen readers (alt text)"}
          aria-label="Alt text" style={{ marginTop: 6 }} />
      )}
    </div>
  );
}
