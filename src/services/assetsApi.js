// Test series images: series banners and question figures in the public
// Supabase Storage bucket 'test-assets' (20261029110000).
//   uploadImage(kind, file)  resize + re-encode in the browser, then
//                            asset-upload-url -> PUT to the signed URL.
//                            Resolves {path, publicUrl, width, height, size, contentType}.
//   assetUrl(path)           the ONE place a stored path becomes a URL.
// The stored value is the bucket-relative path '<uid>/<kind>/<uuid>.<ext>';
// the RPCs check it (adm_test_asset_path). Old drafts may still hold the
// base64 data URLs the editor used to keep in browser state: they were never
// uploaded (isUnsavedImage) and the RPCs refuse them.
import { invokeFunction } from "./edgeFunctions";
import { putToSignedUrl } from "./storageUpload";

export * from "./assetPaths";
import { ASSET_INPUT_TYPES, ASSET_LIMITS, MAX_INPUT_BYTES, assetUrl, storedAssetPath } from "./assetPaths";

const QUALITY = 0.85;

export class AssetUploadError extends Error {
  constructor(stage, message, cause) {
    super(message);
    this.name = "AssetUploadError";
    this.stage = stage;   // "check" | "resize" | "url" | "upload"
    if (cause) this.cause = cause;
  }
}

// Scales (w, h) down to fit maxWidth, never up.
export function fitWithin(width, height, maxWidth) {
  if (!(width > 0) || !(height > 0)) return { width: 0, height: 0 };
  if (width <= maxWidth) return { width: Math.round(width), height: Math.round(height) };
  return { width: Math.round(maxWidth), height: Math.max(1, Math.round((height * maxWidth) / width)) };
}

export function checkImageFile(kind, file) {
  if (!ASSET_LIMITS[kind]) return "Unknown image kind.";
  if (!file) return "Choose an image.";
  if (!ASSET_INPUT_TYPES.includes(String(file.type || "").toLowerCase())) return "Use a JPG, PNG or WebP image.";
  if (!(file.size > 0)) return "The file is empty.";
  if (file.size > MAX_INPUT_BYTES) return "The image is larger than 20 MB.";
  return null;
}

// ---- browser image pipeline (injectable for tests)
async function decodeImage(file) {
  if (typeof createImageBitmap === "function") {
    const bitmap = await createImageBitmap(file);
    return { source: bitmap, width: bitmap.width, height: bitmap.height, close: () => bitmap.close?.() };
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("decode"));
      el.src = url;
    });
    return { source: img, width: img.naturalWidth, height: img.naturalHeight, close: () => {} };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function canvasBlob(canvas, type) {
  return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), type, QUALITY));
}

async function encodeImage(source, width, height, { keepAlpha }) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(source, 0, 0, width, height);
  const webp = await canvasBlob(canvas, "image/webp");
  if (webp && webp.type === "image/webp") return webp;
  // No WebP encoder (older Safari): JPEG on white, or PNG to keep transparency.
  if (keepAlpha) {
    const png = await canvasBlob(canvas, "image/png");
    if (png) return png;
  }
  ctx.globalCompositeOperation = "destination-over";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  const jpeg = await canvasBlob(canvas, "image/jpeg");
  if (!jpeg) throw new Error("encode");
  return jpeg;
}

const EXT = { "image/webp": "webp", "image/jpeg": "jpg", "image/png": "png" };

// Resizes to the kind's max width and re-encodes (WebP, else JPEG / PNG) at ~0.85.
export async function prepareImage(kind, file, deps = {}) {
  const problem = checkImageFile(kind, file);
  if (problem) throw new AssetUploadError("check", problem);
  const limits = ASSET_LIMITS[kind];
  let decoded;
  try {
    decoded = await (deps.decode || decodeImage)(file);
  } catch (error) {
    throw new AssetUploadError("resize", "This image can't be read. Try another file.", error);
  }
  try {
    const size = fitWithin(decoded.width, decoded.height, limits.maxWidth);
    if (!size.width) throw new Error("empty");
    const blob = await (deps.encode || encodeImage)(decoded.source, size.width, size.height, { keepAlpha: file.type === "image/png" });
    if (blob.size > limits.maxBytes) {
      throw new AssetUploadError("check", `The image is still larger than ${limits.label} after resizing. Try a smaller one.`);
    }
    const base = String(file.name || "image").replace(/\.[^.]+$/, "") || "image";
    const out = typeof File === "function"
      ? new File([blob], `${base}.${EXT[blob.type] || "jpg"}`, { type: blob.type })
      : blob;
    return { file: out, width: size.width, height: size.height };
  } catch (error) {
    if (error instanceof AssetUploadError) throw error;
    throw new AssetUploadError("resize", "This image can't be processed. Try another file.", error);
  } finally {
    decoded.close?.();
  }
}

// uploadImage(kind, file, {onProgress, signal}) -> {path, publicUrl, width, height, size, contentType}
// Errors are AssetUploadError with .stage and a message for the user.
export async function uploadImage(kind, file, { onProgress, signal } = {}, deps = {}) {
  const prepared = await prepareImage(kind, file, deps);
  const ready = prepared.file;
  let ticket;
  try {
    ticket = await (deps.invoke || invokeFunction)("asset-upload-url", {
      kind, fileName: ready.name || "image", contentType: ready.type, size: ready.size,
    });
  } catch (error) {
    const message = error?.status === 429 ? "You've uploaded a lot of images in the last hour. Try again later."
      : error?.status === 403 ? "Only admins and verified educators can upload images."
      : error?.message || "The upload could not start.";
    throw new AssetUploadError("url", message, error);
  }
  if (!storedAssetPath(ticket?.path) || !ticket?.signedUrl) {
    throw new AssetUploadError("url", "The upload could not start. Try again.");
  }
  try {
    await (deps.put || putToSignedUrl)(ticket.signedUrl, ready, { onProgress, signal });
  } catch (error) {
    throw new AssetUploadError("upload", error?.message || "The upload failed. Try again.", error);
  }
  return {
    path: ticket.path,
    publicUrl: ticket.publicUrl || assetUrl(ticket.path),
    width: prepared.width,
    height: prepared.height,
    size: ready.size,
    contentType: ready.type,
  };
}
