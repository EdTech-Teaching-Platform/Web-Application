// Signed URL for an educator verification document (admin only).
// Body: { documentId } or { path } (the educator_verification_docs.doc_url
// value the admin UI shows), optional { download: true } for a download link.
// The value must belong to an educator_verification_docs row, so arbitrary
// storage objects can't be signed. doc_url forms (paths.ts):
//   * a storage path, optionally prefixed with the bucket name -> signed in
//     EDUCATOR_DOCS_BUCKET. Paths in a user-id folder ('<educator id>/<docType>-
//     <docName>-<timestamp>.<ext>', written by educator-upload-url +
//     educator_register_document) must be in the document owner's folder.
//   * a Supabase storage URL (.../storage/v1/object/<public|sign|authenticated>/<bucket>/<path>)
//     -> signed in that bucket
//   * any other http(s) URL -> returned unchanged (external: true)
// Env: EDUCATOR_DOCS_BUCKET (required for paths), optional
// EDUCATOR_DOCS_URL_TTL seconds (default 300).
import { clients, fail, json, options, requireAdmin } from "../_shared/auth.ts";
import { downloadName, resolveDocLocation } from "./paths.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    const { userClient, admin } = clients(req);
    await requireAdmin(req, userClient);
    const { documentId, path, download } = await req.json();
    if (!documentId && !path) throw new Error("documentId or path is required");

    let query = admin.from("educator_verification_docs").select("id,doc_url,doc_type,doc_name,educator_id").limit(1);
    query = documentId ? query.eq("id", documentId) : query.eq("doc_url", path);
    const { data: docs, error } = await query;
    if (error) throw error;
    const doc = docs?.[0];
    if (!doc?.doc_url) throw new Error("Document not found");

    const location = resolveDocLocation(doc.doc_url, doc.educator_id, Deno.env.get("EDUCATOR_DOCS_BUCKET"));
    if (location.kind === "external") return json({ signedUrl: location.url, external: true });

    const ttl = Number(Deno.env.get("EDUCATOR_DOCS_URL_TTL") ?? 300);
    const { data, error: signError } = await admin.storage.from(location.bucket).createSignedUrl(
      location.path, ttl, download ? { download: downloadName(doc.doc_type, doc.doc_name, location.path) } : undefined,
    );
    if (signError) throw signError;
    return json({ signedUrl: data.signedUrl, expiresIn: ttl, docType: doc.doc_type, docName: doc.doc_name });
  } catch (error) { return fail(error); }
});
