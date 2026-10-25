// Signed URL for an educator verification document (admin only).
// Body: { documentId } or { path } (the educator_verification_docs.doc_url
// value the admin UI shows). The value must belong to an
// educator_verification_docs row, so arbitrary storage objects can't be signed.
// doc_url forms handled:
//   * a storage path ("<educator>/<file>.pdf", optionally prefixed with the bucket name)
//     -> signed in EDUCATOR_DOCS_BUCKET
//   * a Supabase storage URL (.../storage/v1/object/<public|sign|authenticated>/<bucket>/<path>)
//     -> signed in that bucket
//   * any other http(s) URL -> returned unchanged (external: true)
// Env: EDUCATOR_DOCS_BUCKET (required; docs/db_inspection/buckets.csv does not
// exist, so the lead's bucket name must be configured), optional
// EDUCATOR_DOCS_URL_TTL seconds (default 300).
import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";

const STORAGE_URL = /\/storage\/v1\/object\/(?:public|sign|authenticated)\/([^/]+)\/([^?]+)/;

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const { userClient, admin } = clients(req);
    await requireAdmin(req, userClient);
    const { documentId, path } = await req.json();
    if (!documentId && !path) throw new Error("documentId or path is required");

    let query = admin.from("educator_verification_docs").select("id,doc_url").limit(1);
    query = documentId ? query.eq("id", documentId) : query.eq("doc_url", path);
    const { data: docs, error } = await query;
    if (error) throw error;
    const doc = docs?.[0];
    if (!doc?.doc_url) throw new Error("Document not found");

    const ttl = Number(Deno.env.get("EDUCATOR_DOCS_URL_TTL") ?? 300);
    const configured = Deno.env.get("EDUCATOR_DOCS_BUCKET");
    let bucket: string;
    let objectPath: string;
    const match = STORAGE_URL.exec(doc.doc_url);
    if (match) {
      bucket = decodeURIComponent(match[1]);
      objectPath = decodeURIComponent(match[2]);
    } else if (/^https?:\/\//i.test(doc.doc_url)) {
      return json({ signedUrl: doc.doc_url, external: true });
    } else {
      if (!configured) throw new Error("EDUCATOR_DOCS_BUCKET is not configured");
      bucket = configured;
      objectPath = doc.doc_url.replace(/^\/+/, "");
      if (objectPath.startsWith(`${bucket}/`)) objectPath = objectPath.slice(bucket.length + 1);
    }

    const { data, error: signError } = await admin.storage.from(bucket).createSignedUrl(objectPath, ttl);
    if (signError) throw signError;
    return json({ signedUrl: data.signedUrl, expiresIn: ttl });
  } catch (error) { return fail(error); }
});
