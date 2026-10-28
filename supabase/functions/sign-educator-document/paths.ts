// Where an educator_verification_docs.doc_url points. No imports, so it can be
// unit-tested outside Deno (tests/educator-upload-url.test.js).
//   * Supabase storage URL (.../storage/v1/object/<public|sign|authenticated>/<bucket>/<path>)
//       -> that bucket and path
//   * other http(s) URL -> external (returned unchanged)
//   * storage path, optionally prefixed with the bucket name:
//       - '<educator id>/<file>' (educator-upload-url, 20261028) must be in the
//         document owner's own folder;
//       - older paths without a user-id folder are signed as before.
const STORAGE_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/;
const USER_FOLDER = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\//i;

export type DocLocation =
  | { kind: "storage"; bucket: string; path: string }
  | { kind: "external"; url: string };

export function resolveDocLocation(docUrl: string, educatorId: string | null | undefined, configuredBucket: string | undefined): DocLocation {
  const value = String(docUrl ?? "").trim();
  if (!value) throw new Error("Document not found");

  const match = STORAGE_URL.exec(value);
  if (match) return { kind: "storage", bucket: decodeURIComponent(match[1]), path: decodeURIComponent(match[2]) };
  if (/^https?:\/\//i.test(value)) return { kind: "external", url: value };

  if (!configuredBucket) throw new Error("EDUCATOR_DOCS_BUCKET is not configured");
  let path = value.replace(/^\/+/, "");
  if (path.startsWith(`${configuredBucket}/`)) path = path.slice(configuredBucket.length + 1);
  if (!path || path.split("/").some((part) => part === "" || part === "." || part === "..")) {
    throw new Error("Document not found");
  }
  const folder = USER_FOLDER.exec(path);
  if (folder && educatorId && folder[1].toLowerCase() !== String(educatorId).toLowerCase()) {
    throw new Error("Document not found");   // a path in another user's folder
  }
  return { kind: "storage", bucket: configuredBucket, path };
}

// A download name for the signed URL: "<docType>-<docName>.<ext>".
export function downloadName(docType: string, docName: string | null | undefined, path: string): string {
  const ext = /\.([A-Za-z0-9]{1,5})$/.exec(path)?.[1]?.toLowerCase() ?? "bin";
  const label = [docType, docName].filter(Boolean).join("-").replace(/[^A-Za-z0-9_-]+/g, "-").replace(/-{2,}/g, "-");
  return `${label || "document"}.${ext}`;
}
