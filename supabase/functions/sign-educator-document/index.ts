// Signed URL for an educator verification document.
// Caller: an admin (adm_is_platform_admin) for any document, or the educator
// who owns the document. Nobody else.
// Body: { documentId } (preferred) or { path } (the doc_url, older UI), plus
// optional { download: true } for a download link.
// 1. adm_authorize_document_access (with the caller's JWT) finds the row,
//    decides admin / owner / refused, and writes the audit row
//    (educator.document_access: who, which document, view or download).
// 2. decideAccess re-checks the answer; resolveDocLocation accepts the old and
//    new doc_url forms (paths.ts).
// 3. The service role signs the file (default 10 minutes).
// Returns { signedUrl, expiresIn, contentType, fileName, docType, docName, access }
// or { signedUrl, external: true } for an external URL.
// Errors: { error } with 401/403 (not allowed), 404 (no such document), 400.
// Env: EDUCATOR_DOCS_BUCKET (required for plain paths), EDUCATOR_DOCS_URL_TTL (seconds, default 600).
import { clients, json, options, requireUser } from "../_shared/auth.ts";
import { contentTypeFor, decideAccess, downloadName, resolveDocLocation, signedUrlTtl } from "./paths.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const { userClient, admin } = clients(req);
    const user = await requireUser(req, userClient);
    let body: Record<string, unknown> = {};
    try { body = await req.json(); } catch { body = {}; }
    const documentId = typeof body.documentId === "string" ? body.documentId : null;
    const path = typeof body.path === "string" ? body.path : null;
    const download = body.download === true;
    if (!documentId && !path) return json({ error: "documentId or path is required" }, 400);

    const { data: doc, error: accessError } = await userClient.rpc("adm_authorize_document_access", {
      p_document_id: documentId, p_path: documentId ? null : path, p_purpose: download ? "download" : "view",
    });
    if (accessError) {
      const status = accessError.code === "P0002" ? 404 : accessError.code === "42501" ? 403 : 400;
      return json({ error: accessError.message, code: accessError.code }, status);
    }
    const isAdmin = doc?.access === "admin";
    if (!decideAccess({ isAdmin, callerId: user.id, educatorId: doc?.educator_id })) {
      return json({ error: "You can't open this document." }, 403);
    }

    const location = resolveDocLocation(doc.doc_url, doc.educator_id, Deno.env.get("EDUCATOR_DOCS_BUCKET"));
    if (location.kind === "external") return json({ signedUrl: location.url, external: true, access: doc.access });

    const ttl = signedUrlTtl(Deno.env.get("EDUCATOR_DOCS_URL_TTL"));
    const fileName = downloadName(doc.doc_type, doc.doc_name, location.path);
    const { data, error: signError } = await admin.storage.from(location.bucket).createSignedUrl(
      location.path, ttl, download ? { download: fileName } : undefined,
    );
    if (signError) {
      return json({ error: /not found/i.test(signError.message) ? "The file is missing from storage." : signError.message }, 404);
    }
    return json({
      signedUrl: data.signedUrl, expiresIn: ttl, contentType: contentTypeFor(location.path), fileName,
      docType: doc.doc_type, docName: doc.doc_name, access: doc.access,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const status = /^Authentication required$/.test(message) ? 401 : /not found/i.test(message) ? 404 : 400;
    return json({ error: message }, status);
  }
});
