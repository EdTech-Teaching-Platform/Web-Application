// Stored test image paths and their URLs (no imports: safe for data modules
// and tests). Re-exported by assetsApi.js; see there for the upload flow.
export const ASSET_BUCKET = "test-assets";
export const ASSET_KIND = { BANNER: "banner", QUESTION: "question_image" };
export const ASSET_INPUT_TYPES = ["image/jpeg", "image/png", "image/webp"];
// Same limits as asset-upload-url (after resizing). The picked file itself
// may be larger: it is resized first.
export const ASSET_LIMITS = {
  [ASSET_KIND.BANNER]: { maxWidth: 1600, maxBytes: 2 * 1024 * 1024, label: "2 MB" },
  [ASSET_KIND.QUESTION]: { maxWidth: 1200, maxBytes: 3 * 1024 * 1024, label: "3 MB" },
};
export const MAX_INPUT_BYTES = 20 * 1024 * 1024;

const SUPABASE_URL = String(import.meta.env?.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const PATH_RE = /^[0-9a-f-]{36}\/(banner|question_image)\/[0-9a-f-]{36}\.(jpg|png|webp)$/;

export const isUnsavedImage = (value) => /^(data|blob):/i.test(String(value || ""));

// A stored path (or null): drops a leading 'test-assets/'; anything else,
// including the old data URLs, is not a stored path.
export function storedAssetPath(value) {
  const v = String(value || "").trim().replace(/^test-assets\//, "");
  return PATH_RE.test(v) ? v : null;
}

// Stored path -> public URL. Full http(s) URLs pass through; data: / blob:
// URLs pass through too (an unsaved preview); anything else -> null.
export function assetUrl(path, base = SUPABASE_URL) {
  const v = String(path || "").trim();
  if (!v) return null;
  if (/^(https?:|data:image\/|blob:)/i.test(v)) return v;
  const clean = v.replace(/^\/+/, "").replace(/^test-assets\//, "");
  if (!clean || clean.split("/").some((part) => part === ".." || part === "")) return null;
  if (!base) return null;
  return `${base}/storage/v1/object/public/${ASSET_BUCKET}/${clean.split("/").map(encodeURIComponent).join("/")}`;
}
