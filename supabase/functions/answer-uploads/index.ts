// Handwritten answer sheets (photos / PDF) for written questions, in the
// PRIVATE bucket answer-uploads (20261120090000). Body (validate.ts):
//   { action: "upload", attemptId, questionId?, fileName, contentType, size }
//       Without questionId (20261128090000): the attempt's answer sheet, only
//       after the test and before its final Submit (student_sheet_upload_slot).
//       student_answer_upload_slot (caller's JWT) checks: own attempt, written
//       question of that test, upload window open (test time + 15 minutes),
//       < 5 files, rate limit. Returns { path, signedUrl, token, expiresIn };
//       the client PUTs the file, then calls student_register_answer_upload.
//   { action: "view", uploadId, download? }
//       adm_answer_upload_access (caller's JWT): the student who uploaded it,
//       or a grader of that test (series educator / admin). Returns a signed
//       URL valid for 10 minutes.
// The service role only signs; every permission check runs in the database
// as the caller. Errors: { error, field? } with 400 / 403 / 404 / 409 / 429.
import { clients, fail, json, options, requireUser } from "../_shared/auth.ts";
import { ANSWER_BUCKET, AnswerUploadError, VIEW_SECONDS, buildAnswerPath, validateAnswerRequest } from "./validate.ts";

Deno.serve(async (req) => {
  const preflight = options(req); if (preflight) return preflight;
  try {
    if (req.method !== "POST") return json({ error: "Use POST" }, 405);
    const { userClient, admin } = clients(req);
    await requireUser(req, userClient);

    let body: unknown;
    try { body = await req.json(); } catch { body = null; }
    const request = validateAnswerRequest(body);

    if (request.action === "view") {
      const { data: file, error } = await userClient.rpc("adm_answer_upload_access", { p_upload_id: request.uploadId });
      if (error) {
        if (error.code === "P0002" || error.code === "42501") throw new AnswerUploadError("File not found.", 404);
        throw new Error(error.message);
      }
      const { data, error: signError } = await admin.storage.from(ANSWER_BUCKET)
        .createSignedUrl(file.path, VIEW_SECONDS, request.download ? { download: file.file_name } : undefined);
      if (signError) throw signError;
      return json({ url: data.signedUrl, fileName: file.file_name, contentType: file.content_type, expiresIn: VIEW_SECONDS });
    }

    const { data: slot, error: slotError } = request.questionId
      ? await userClient.rpc("student_answer_upload_slot", {
        p_attempt_id: request.attemptId, p_question_id: request.questionId,
        p_content_type: request.contentType, p_size: request.size,
      })
      : await userClient.rpc("student_sheet_upload_slot", {
        p_attempt_id: request.attemptId, p_content_type: request.contentType, p_size: request.size,
      });
    if (slotError) {
      if (slotError.code === "42501" || slotError.code === "UL403") throw new AnswerUploadError(slotError.message, 403);
      throw new Error(slotError.message);
    }
    if (!slot?.allowed) {
      return json({ error: slot?.error ?? "You can't upload now.", retryAfterSeconds: slot?.retry_after_seconds }, slot?.status ?? 409);
    }
    const path = buildAnswerPath(slot.student_id, request.attemptId, request.questionId, request.contentType, crypto.randomUUID());
    const { data, error } = await admin.storage.from(ANSWER_BUCKET).createSignedUploadUrl(path);
    if (error) throw error;
    return json({ path, signedUrl: data.signedUrl, token: data.token, bucket: ANSWER_BUCKET, expiresIn: 7200 });
  } catch (error) {
    if (error instanceof AnswerUploadError) return json({ error: error.message, field: error.field }, error.status);
    return fail(error);
  }
});
