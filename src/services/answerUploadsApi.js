// Handwritten answer sheets (photos / PDF) for written questions
// (20261120090000, Edge Function answer-uploads, private bucket answer-uploads).
//   uploadAnswerFile({attemptId, questionId, file, onProgress, signal})
//       photos are resized in the browser first (2000 px, WebP / JPEG), PDFs
//       go as they are (10 MB max); then upload URL -> PUT -> register.
//       Resolves the attempt's upload list (mapAnswerUploads).
//   listAnswerUploads(attemptId) / removeAnswerUpload(uploadId)
//   answerFileUrl(uploadId, {download})   a 10-minute signed URL; works for
//       the student who uploaded it and for the test's graders.
import { invokeFunction } from "./edgeFunctions";
import { putToSignedUrl } from "./storageUpload";
import { ASSET_KIND, prepareImage } from "./assetsApi";
import { callRpc } from "../portals/student/services/studentRpc";

export const ANSWER_MAX_FILES = 5;
export const ANSWER_MAX_BYTES = 10 * 1024 * 1024;
export const ANSWER_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export function mapAnswerUploads(data) {
  const uploads = (data?.uploads || []).map((u) => ({
    id: u.id, questionId: u.question_id, fileName: u.file_name || "file",
    contentType: u.content_type || "", size: Number(u.size_bytes || 0), createdAt: u.created_at || null,
  }));
  const byQuestion = {};
  uploads.forEach((u) => { (byQuestion[u.questionId] ||= []).push(u); });
  return {
    windowClosesAt: data?.window_closes_at || null,
    canUpload: Boolean(data?.can_upload),
    serverNow: data?.server_now || null,
    graceMinutes: data?.grace_minutes ?? 15,   // the test's upload time after submitting (20261121090000)
    canRemove: data?.can_remove ?? Boolean(data?.can_upload),   // only while the test is open
    submittedAt: data?.submitted_at || null,
    uploads,
    byQuestion,
  };
}

// Why this file can't be used, or null.
export function checkAnswerFile(file) {
  if (!file) return "Choose a file.";
  const type = String(file.type || "").toLowerCase();
  if (type === "image/heic" || type === "image/heif") {
    return "This photo is in HEIC format. Choose \"Most Compatible\" in your camera settings, or take the photo from this page.";
  }
  if (type === "application/pdf") {
    if (!(file.size > 0)) return "The file is empty.";
    return file.size > ANSWER_MAX_BYTES ? "The PDF is larger than 10 MB. Scan at a lower resolution or split it." : null;
  }
  if (!PHOTO_TYPES.includes(type)) return "Upload a photo (JPG, PNG, WebP) or a PDF.";
  if (!(file.size > 0)) return "The file is empty.";
  return null;
}

export function formatFileSize(bytes) {
  const n = Number(bytes) || 0;
  if (n >= 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(n / 1024))} KB`;
}

export async function prepareAnswerFile(file, deps = {}) {
  const problem = checkAnswerFile(file);
  if (problem) throw Object.assign(new Error(problem), { stage: "check" });
  if (file.type === "application/pdf") return file;
  const { file: out } = await (deps.prepare || prepareImage)(ASSET_KIND.ANSWER_PAGE, file);
  return out;
}

export async function uploadAnswerFile({ attemptId, questionId, file, onProgress, signal }, deps = {}) {
  const ready = await prepareAnswerFile(file, deps);
  const ticket = await (deps.invoke || invokeFunction)("answer-uploads", {
    action: "upload", attemptId, questionId, fileName: ready.name || file.name, contentType: ready.type, size: ready.size,
  });
  await (deps.put || putToSignedUrl)(ticket.signedUrl, ready, { onProgress, signal });
  const data = await (deps.rpc || callRpc)("student_register_answer_upload", {
    p_attempt_id: attemptId, p_question_id: questionId, p_path: ticket.path,
    p_file_name: ready.name || file.name, p_content_type: ready.type, p_size: ready.size,
  });
  return mapAnswerUploads(data);
}

export async function listAnswerUploads(attemptId, rpc = callRpc) {
  return mapAnswerUploads(await rpc("student_list_answer_uploads", { p_attempt_id: attemptId }));
}

export async function removeAnswerUpload(uploadId, rpc = callRpc) {
  return mapAnswerUploads(await rpc("student_remove_answer_upload", { p_upload_id: uploadId }));
}

export async function answerFileUrl(uploadId, { download = false } = {}, invoke = invokeFunction) {
  const data = await invoke("answer-uploads", { action: "view", uploadId, download });
  return data?.url;
}

export const answerUploadsApi = {
  upload: uploadAnswerFile,
  list: listAnswerUploads,
  remove: removeAnswerUpload,
  fileUrl: answerFileUrl,
};

// ---- The answer sheet AFTER the test (20261128090000, QA 22 Nov flow):
// finish the test -> the answer-sheet screen (countdown of the test's
// minutes, default 5) -> PDF or page photos, up to 10 files -> Submit.
export const SHEET_MAX_FILES = 10;

export function mapSheetStatus(data) {
  const base = mapAnswerUploads(data);
  return {
    ...base,
    attemptId: data?.attempt_id || null,
    testId: data?.test_id || null,
    status: data?.status || null,
    hasWritten: Boolean(data?.has_written),
    graceMinutes: data?.grace_minutes ?? 5,
    problem: data?.problem || "",
    autoSubmitReason: data?.auto_submit_reason || null,
    sheetSubmittedAt: data?.sheet_submitted_at || null,
    maxFiles: data?.max_files ?? SHEET_MAX_FILES,
    files: base.uploads,
  };
}

export async function sheetStatus(attemptId, rpc = callRpc) {
  return mapSheetStatus(await rpc("student_sheet_status", { p_attempt_id: attemptId }));
}

export async function uploadSheetFile({ attemptId, file, onProgress, signal }, deps = {}) {
  const ready = await prepareAnswerFile(file, deps);
  const ticket = await (deps.invoke || invokeFunction)("answer-uploads", {
    action: "upload", attemptId, fileName: ready.name || file.name, contentType: ready.type, size: ready.size,
  });
  await (deps.put || putToSignedUrl)(ticket.signedUrl, ready, { onProgress, signal });
  return mapSheetStatus(await (deps.rpc || callRpc)("student_register_sheet_upload", {
    p_attempt_id: attemptId, p_path: ticket.path,
    p_file_name: ready.name || file.name, p_content_type: ready.type, p_size: ready.size,
  }));
}

export async function removeSheetFile(uploadId, rpc = callRpc) {
  return mapSheetStatus(await rpc("student_remove_sheet_upload", { p_upload_id: uploadId }));
}

export async function submitSheet(attemptId, rpc = callRpc) {
  return mapSheetStatus(await rpc("student_submit_answer_sheet", { p_attempt_id: attemptId }));
}

// Same shape as answerUploadsApi, for <AnswerUploader> on the sheet screen.
export const sheetUploadsApi = {
  upload: ({ attemptId, file, onProgress, signal }) => uploadSheetFile({ attemptId, file, onProgress, signal }),
  remove: removeSheetFile,
  fileUrl: answerFileUrl,
  status: sheetStatus,
  submit: submitSheet,
};

export default answerUploadsApi;
