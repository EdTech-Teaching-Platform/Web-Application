// Signed UPLOAD URL for an educator's verification document.
// Caller: any signed-in user with role 'educator' (any verification status),
// checked in the database by adm_claim_educator_upload_slot, which also rate
// limits (EDUCATOR_UPLOAD_LIMIT_PER_HOUR, default 20).
// Body: { docType, docName, fileName, contentType, size } (validate.ts).
// The user id comes from the JWT only; any id in the body is ignored.
// Returns { path, signedUrl, token, bucket, expiresIn }. The client uploads with
// supabase.storage.from(bucket).uploadToSignedUrl(path, token, file) and then
// calls educator_register_document(docType, path, docName).
// Env: EDUCATOR_DOCS_BUCKET (required), EDUCATOR_UPLOAD_LIMIT_PER_HOUR (optional).
// No storage policy is changed: the service role creates the signed URL.
import { clients, fail, json, options, requireUser } from "../_shared/auth.ts";
import { buildUploadPath, UploadValidationError, validateUploadRequest } from "./validate.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const { userClient, admin } = clients(req);
    const user = await requireUser(req, userClient);

    let body: unknown;
    try { body = await req.json(); } catch { body = null; }
    const upload = validateUploadRequest(body);

    const bucket = Deno.env.get("EDUCATOR_DOCS_BUCKET");
    if (!bucket) throw new Error("EDUCATOR_DOCS_BUCKET is not configured");

    const limit = Number(Deno.env.get("EDUCATOR_UPLOAD_LIMIT_PER_HOUR") ?? 20);
    const { data: slot, error: slotError } = await userClient.rpc("adm_claim_educator_upload_slot", {
      p_doc_type: upload.docType, p_limit: Number.isFinite(limit) ? limit : 20,
    });
    if (slotError) throw new Error(slotError.code === "42501" ? "Educators only" : slotError.message);
    if (!slot?.allowed) {
      return json({ error: "Too many uploads. Try again later.", retryAfterSeconds: slot?.retry_after_seconds ?? 3600 }, 429);
    }

    const path = buildUploadPath(user.id, upload, Date.now());
    const { data, error } = await admin.storage.from(bucket).createSignedUploadUrl(path);
    if (error) throw error;
    return json({ path, signedUrl: data.signedUrl, token: data.token, bucket, expiresIn: 7200 });
  } catch (error) {
    if (error instanceof UploadValidationError) return json({ error: error.message, field: error.field }, 400);
    return fail(error);
  }
});
