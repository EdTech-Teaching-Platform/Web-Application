// Signed UPLOAD URL for a test series banner or a question figure.
// Caller: an admin or a verified educator (adm_actor_kind), checked in the
// database by adm_claim_asset_upload_slot with the caller's JWT, which also
// rate limits (ASSET_UPLOAD_LIMIT_PER_HOUR, default 60).
// Body: { kind: 'banner' | 'question_image', fileName, contentType, size } (validate.ts).
// The user id comes from the JWT only; any id in the body is ignored.
// Returns { path, signedUrl, token, publicUrl, bucket, expiresIn }. The client
// PUTs the file to signedUrl (or uploadToSignedUrl(path, token, file)) and then
// saves `path` through the series / question RPCs (adm_test_asset_path checks it).
// No storage policy is involved: the service role creates the signed URL and
// the bucket test-assets (20261029110000) is public for reads.
import { clients, fail, json, options, requireUser } from "../_shared/auth.ts";
import { ASSET_BUCKET, AssetValidationError, buildAssetPath, publicAssetUrl, validateAssetRequest } from "./validate.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const { userClient, admin } = clients(req);
    const user = await requireUser(req, userClient);

    let body: unknown;
    try { body = await req.json(); } catch { body = null; }
    const asset = validateAssetRequest(body);

    const limit = Number(Deno.env.get("ASSET_UPLOAD_LIMIT_PER_HOUR") ?? 60);
    const { data: slot, error: slotError } = await userClient.rpc("adm_claim_asset_upload_slot", {
      p_kind: asset.kind, p_limit: Number.isFinite(limit) ? limit : 60,
    });
    if (slotError) {
      if (slotError.code === "42501") return json({ error: "Only admins and verified educators can upload images." }, 403);
      throw new Error(slotError.message);
    }
    if (!slot?.allowed) {
      return json({ error: "Too many uploads. Try again later.", retryAfterSeconds: slot?.retry_after_seconds ?? 3600 }, 429);
    }

    const path = buildAssetPath(user.id, asset, crypto.randomUUID());
    const { data, error } = await admin.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    return json({
      path, signedUrl: data.signedUrl, token: data.token, bucket: ASSET_BUCKET, expiresIn: 7200,
      publicUrl: publicAssetUrl(Deno.env.get("SUPABASE_URL") ?? "", path),
    });
  } catch (error) {
    if (error instanceof AssetValidationError) return json({ error: error.message, field: error.field }, 400);
    return fail(error);
  }
});
