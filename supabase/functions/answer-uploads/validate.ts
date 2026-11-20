// Validators for answer-uploads. No imports, so they can be unit-tested
// outside Deno (tests/written-answers.test.jsx).

export const ANSWER_BUCKET = "answer-uploads";
export const ANSWER_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"] as const;
export const MAX_ANSWER_BYTES = 10 * 1024 * 1024;
export const VIEW_SECONDS = 600;

const EXTENSION: Record<string, string> = {
  "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp", "application/pdf": "pdf",
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class AnswerUploadError extends Error {
  status: number;
  field?: string;
  constructor(message: string, status = 400, field?: string) {
    super(message);
    this.name = "AnswerUploadError";
    this.status = status;
    this.field = field;
  }
}

export type AnswerRequest =
  | { action: "upload"; attemptId: string; questionId: string; fileName: string; contentType: string; size: number }
  | { action: "view"; uploadId: string; download: boolean };

// Body: { action: "upload", attemptId, questionId, fileName, contentType, size }
//    or { action: "view", uploadId, download? }
export function validateAnswerRequest(body: unknown): AnswerRequest {
  if (!body || typeof body !== "object") throw new AnswerUploadError("Send a JSON body.", 400, "body");
  const b = body as Record<string, unknown>;
  const action = String(b.action ?? "").trim().toLowerCase();
  if (action === "view") {
    const uploadId = String(b.uploadId ?? "").trim().toLowerCase();
    if (!UUID.test(uploadId)) throw new AnswerUploadError("uploadId must be a file id.", 400, "uploadId");
    return { action, uploadId, download: b.download === true };
  }
  if (action !== "upload") throw new AnswerUploadError("Unknown action.", 400, "action");
  const attemptId = String(b.attemptId ?? "").trim().toLowerCase();
  const questionId = String(b.questionId ?? "").trim().toLowerCase();
  if (!UUID.test(attemptId)) throw new AnswerUploadError("attemptId must be an attempt id.", 400, "attemptId");
  if (!UUID.test(questionId)) throw new AnswerUploadError("questionId must be a question id.", 400, "questionId");
  const contentType = String(b.contentType ?? "").trim().toLowerCase();
  if (!(ANSWER_TYPES as readonly string[]).includes(contentType)) {
    throw new AnswerUploadError("Upload a photo (JPG, PNG, WebP) or a PDF.", 400, "contentType");
  }
  const size = Number(b.size);
  if (!Number.isFinite(size) || size <= 0) throw new AnswerUploadError("The file is empty.", 400, "size");
  if (size > MAX_ANSWER_BYTES) throw new AnswerUploadError("Each file can be up to 10 MB.", 400, "size");
  const fileName = String(b.fileName ?? "").split(/[\\/]/).pop()?.slice(0, 120) || `answer.${EXTENSION[contentType]}`;
  return { action, attemptId, questionId, fileName, contentType, size };
}

// '<student>/<attempt>/<question>/<uuid>.<ext>': the shape
// student_register_answer_upload accepts. The extension comes from the
// validated content type, never from the file name.
export function buildAnswerPath(studentId: string, attemptId: string, questionId: string, contentType: string, id: string): string {
  for (const v of [studentId, attemptId, questionId, id]) {
    if (!UUID.test(v)) throw new Error("Bad id");
  }
  const ext = EXTENSION[contentType];
  if (!ext) throw new Error("Bad content type");
  return `${studentId}/${attemptId}/${questionId}/${id}.${ext}`.toLowerCase();
}
