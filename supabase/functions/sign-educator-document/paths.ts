// Pure helpers for sign-educator-document. No imports, so they are
// unit-tested outside Deno (tests/educator-upload-url.test.js,
// tests/educator-documents.test.js).
//
// resolveDocLocation(doc_url, educatorId, configuredBucket): where a doc_url
// points. Accepted forms (old and new):
//   * '<educator id>/<docType>-<docName>-<ts>.<ext>'   educator-upload-url (20261028)
//   * '<bucket>/<path>' or '/<path>'                    older admin / lead rows
//   * 'https://<project>.supabase.co/storage/v1/object/<public|sign|authenticated>/<bucket>/<path>[?token=…]'
//   * 'https://…/storage/v1/object/<bucket>/<path>'     (no visibility segment)
//   * any other http(s) URL                              external, returned as is
// A path in a user-id folder must be in the folder of the document's own
// educator (data integrity: a row can't point into another user's folder).
// This is about the ROW, not the caller: admins open every educator's files.
const STORAGE_URL = /\/storage\/v1\/object\/(?:(?:public|sign|authenticated)\/)?([^/?#]+)\/([^?#]+)/;
const USER_FOLDER = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

export type DocLocation =
  | { kind: "storage"; bucket: string; path: string }
  | { kind: "external"; url: string };

function cleanPath(raw: string): string {
  let path = raw;
  try { path = decodeURIComponent(path); } catch { /* keep as is */ }
  path = path.replace(/\\/g, "/").replace(/^\/+/, "");
  if (!path || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Document not found");
  }
  return path;
}

export function resolveDocLocation(docUrl: string, educatorId: string | null | undefined, configuredBucket: string | undefined): DocLocation {
  const value = String(docUrl ?? "").trim();
  if (!value) throw new Error("Document not found");

  let location: DocLocation;
  const match = STORAGE_URL.exec(value);
  if (match && match[1] !== "upload") {
    location = { kind: "storage", bucket: decodeURIComponent(match[1]), path: cleanPath(match[2]) };
  } else if (/^https?:\/\//i.test(value)) {
    return { kind: "external", url: value };
  } else {
    if (!configuredBucket) throw new Error("EDUCATOR_DOCS_BUCKET is not configured");
    let path = cleanPath(value);
    if (path.startsWith(`${configuredBucket}/`)) path = path.slice(configuredBucket.length + 1);
    location = { kind: "storage", bucket: configuredBucket, path: cleanPath(path) };
  }
  const folder = USER_FOLDER.exec(location.path);
  if (folder && educatorId && folder[1].toLowerCase() !== String(educatorId).toLowerCase()) {
    throw new Error("Document not found");   // the row points into another user's folder
  }
  return location;
}

// Second check on top of adm_authorize_document_access (the database decides
// first): admins open any document; the owner educator opens their own;
// nobody else. Returns the access kind or null.
export function decideAccess({ isAdmin, callerId, educatorId }: { isAdmin: boolean; callerId?: string | null; educatorId?: string | null }): "admin" | "owner" | null {
  if (isAdmin) return "admin";
  if (callerId && educatorId && String(callerId).toLowerCase() === String(educatorId).toLowerCase()) return "owner";
  return null;
}

const CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif", pdf: "application/pdf",
};

// "image/jpeg" | "application/pdf" | "application/octet-stream" from the path.
export function contentTypeFor(path: string): string {
  const ext = /\.([A-Za-z0-9]{1,5})(?:$|\?)/.exec(String(path ?? ""))?.[1]?.toLowerCase() ?? "";
  return CONTENT_TYPES[ext] ?? "application/octet-stream";
}

// A download name for the signed URL: "<docType>-<docName>.<ext>".
export function downloadName(docType: string, docName: string | null | undefined, path: string): string {
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(path)?.[1]?.toLowerCase() ?? "bin";
  const label = [docType, docName].filter(Boolean).join("-").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-{2,}/g, "-");
  return `${label || "document"}.${ext}`;
}

// 10 minutes by default, clamped to 1..60 minutes.
export function signedUrlTtl(raw: string | undefined | null): number {
  const n = Number(raw ?? 600);
  return Number.isFinite(n) ? Math.min(Math.max(Math.round(n), 60), 3600) : 600;
}
