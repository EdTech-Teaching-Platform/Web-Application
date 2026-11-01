// Validators for asset-upload-url. No imports, so they can be unit-tested
// outside Deno (tests/test-assets.test.js).

export const ASSET_BUCKET = "test-assets";
export const ASSET_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const ASSET_KINDS = ["banner", "question_image"] as const;
export type AssetKind = typeof ASSET_KINDS[number];

// Series banners up to 2 MB, question figures up to 3 MB (the bucket's own
// limit is 3 MB). The browser resizes and re-encodes first, so real uploads
// are far smaller.
export const MAX_ASSET_BYTES: Record<AssetKind, number> = {
  banner: 2 * 1024 * 1024,
  question_image: 3 * 1024 * 1024,
};

const EXTENSION: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AssetValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "AssetValidationError";
    this.field = field;
  }
}

export interface AssetRequest {
  kind: AssetKind;
  fileName: string;
  contentType: string;
  size: number;
}

export function validateAssetRequest(body: unknown): AssetRequest {
  if (!body || typeof body !== "object") throw new AssetValidationError("body", "Send a JSON body.");
  const b = body as Record<string, unknown>;
  const kind = String(b.kind ?? "").trim().toLowerCase();
  const contentType = String(b.contentType ?? "").trim().toLowerCase();
  const size = Number(b.size);
  if (!(ASSET_KINDS as readonly string[]).includes(kind)) {
    throw new AssetValidationError("kind", "Unknown image kind.");
  }
  if (!(ASSET_TYPES as readonly string[]).includes(contentType)) {
    throw new AssetValidationError("contentType", "Upload a JPEG, PNG or WebP image.");
  }
  if (!Number.isFinite(size) || size <= 0) throw new AssetValidationError("size", "The file is empty.");
  const max = MAX_ASSET_BYTES[kind as AssetKind];
  if (size > max) throw new AssetValidationError("size", `The image is larger than ${max / (1024 * 1024)} MB.`);
  const fileName = String(b.fileName ?? "").split(/[\\/]/).pop()?.slice(0, 120) || "image";
  return { kind: kind as AssetKind, fileName, contentType, size };
}

// '<uid>/<kind>/<uuid>.<ext>' (bucket-relative; adm_test_asset_path accepts
// exactly this shape). The extension comes from the validated content type,
// never from the client's file name.
export function buildAssetPath(userId: string, req: AssetRequest, id: string): string {
  if (!UUID.test(userId)) throw new Error("Authentication required");
  if (!UUID.test(id)) throw new Error("Bad asset id");
  return `${userId.toLowerCase()}/${req.kind}/${id.toLowerCase()}.${EXTENSION[req.contentType]}`;
}

// The public URL of a stored path (the bucket is public).
export function publicAssetUrl(supabaseUrl: string, path: string): string {
  const encoded = path.split("/").map(encodeURIComponent).join("/");
  return `${supabaseUrl.replace(/\/+$/, "")}/storage/v1/object/public/${ASSET_BUCKET}/${encoded}`;
}
