import { useState } from "react";
import { assetUrl } from "../../services/assetPaths";

// A stored test image (banner / question figure) through assetUrl. With no
// path, or when the file can't load, it renders `fallback` (default: a
// neutral block) instead of the browser's broken-image icon.
export function NeutralImageFallback({ className = "", style, label }) {
  return (
    <div
      className={className}
      role={label ? "img" : undefined}
      aria-label={label || undefined}
      aria-hidden={label ? undefined : true}
      data-testid="asset-fallback"
      style={{ background: "linear-gradient(135deg, #eef0f4, #e2e5ec)", ...style }}
    />
  );
}

export default function AssetImage({ path, alt = "", className = "", style, fallback, fallbackClassName, ...rest }) {
  const src = assetUrl(path);
  const [failedSrc, setFailedSrc] = useState(null);   // a new path gets a new try
  if (!src || failedSrc === src) {
    if (fallback !== undefined) return fallback;
    return <NeutralImageFallback className={fallbackClassName ?? className} style={style} />;
  }
  return <img src={src} alt={alt} className={className} style={style} loading="lazy" onError={() => setFailedSrc(src)} {...rest} />;
}
