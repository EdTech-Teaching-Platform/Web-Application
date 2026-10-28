// Validators for educator-upload-url. No imports, so they can be unit-tested
// outside Deno (tests/educator-upload-url.test.js).

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;
export const PDF_TYPE = "application/pdf";

// Certificates may be PDFs; ID pictures and the selfie must be images.
export const CERTIFICATE_TYPES = ["degree_certificate", "teaching_license", "experience_letter", "subject_certificate"] as const;

// docType -> allowed docName values, or a pattern for certificate labels.
// Matches educator_register_document (20261028090100).
const FIXED_NAMES: Record<string, readonly string[]> = {
  government_id: ["front", "back"],
  other: ["selfie"],
};
const LABEL = /^[a-z0-9][a-z0-9-]{0,39}$/;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export class UploadValidationError extends Error {
  field: string;
  constructor(field: string, message: string) {
    super(message);
    this.name = "UploadValidationError";
    this.field = field;
  }
}

export interface UploadRequest {
  docType: string;
  docName: string;
  fileName: string;
  contentType: string;
  size: number;
}

// "My ID (front).JPG" -> "My-ID-front.JPG"; path separators, control
// characters and anything outside [A-Za-z0-9._-] are dropped; never empty.
export function sanitizeFileName(name: unknown): string {
  const base = String(name ?? "").split(/[\\/]/).pop() ?? "";
  const cleaned = base
    .normalize("NFKD")
    .replace(/[^\w.\- ]+/g, "")
    .replace(/\s+/g, "-")
    .replace(/_/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^[.-]+/, "")
    .slice(0, 100);
  return cleaned || "file";
}

export function validateUploadRequest(body: unknown): UploadRequest {
  if (!body || typeof body !== "object") throw new UploadValidationError("body", "Send a JSON body.");
  const b = body as Record<string, unknown>;
  const docType = String(b.docType ?? "").trim().toLowerCase();
  const docName = String(b.docName ?? "").trim().toLowerCase();
  const contentType = String(b.contentType ?? "").trim().toLowerCase();
  const size = Number(b.size);

  const isCertificate = (CERTIFICATE_TYPES as readonly string[]).includes(docType);
  if (!isCertificate && !FIXED_NAMES[docType]) {
    throw new UploadValidationError("docType", "Unknown document type.");
  }
  if (isCertificate ? !LABEL.test(docName) : !FIXED_NAMES[docType].includes(docName)) {
    throw new UploadValidationError("docName", isCertificate
      ? "Name the certificate with lowercase letters, numbers and dashes (up to 40)."
      : `Choose one of: ${FIXED_NAMES[docType].join(", ")}.`);
  }
  const allowed: string[] = isCertificate ? [...IMAGE_TYPES, PDF_TYPE] : [...IMAGE_TYPES];
  if (!allowed.includes(contentType)) {
    throw new UploadValidationError("contentType", isCertificate
      ? "Upload a JPEG, PNG, WebP or PDF file."
      : "Upload a JPEG, PNG or WebP picture.");
  }
  if (!Number.isFinite(size) || size <= 0) throw new UploadValidationError("size", "The file is empty.");
  if (size > MAX_UPLOAD_BYTES) throw new UploadValidationError("size", "The file is larger than 5 MB.");

  return { docType, docName, fileName: sanitizeFileName(b.fileName), contentType, size };
}

// '<user id>/<docType>-<docName>-<timestamp>.<ext>'. The extension comes from
// the validated content type, never from the client's file name.
export function buildUploadPath(userId: string, req: UploadRequest, now: number): string {
  if (!/^[0-9a-f-]{36}$/i.test(userId)) throw new Error("Authentication required");
  return `${userId.toLowerCase()}/${req.docType}-${req.docName}-${Math.trunc(now)}.${EXTENSION[req.contentType]}`;
}
