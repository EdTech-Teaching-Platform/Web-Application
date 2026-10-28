// Teacher portal service: the educator RPCs (docs/EDUCATOR_RPC_CONTRACT.md)
// and the document upload flow (educator-upload-url -> signed upload ->
// educator_register_document). The user is always the signed-in one: no call
// sends a user id. Test series authoring uses the shared admin testSeriesApi
// (the same RPCs, role-aware on the server).
import { supabase } from "../../../services/supabaseClient";
import { callRpc } from "../../admin/services/adminApi";
import { checkUploadFile } from "../utils/onboarding";

// supabase.functions.invoke error -> Error with the function's message,
// HTTP status, field and retry time.
async function invokeFunction(name, body) {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (!error) return data;
  let payload = null;
  try { payload = await error.context?.json?.(); } catch { payload = null; }
  const wrapped = new Error(payload?.error || error.message || "The request failed.");
  wrapped.status = error.context?.status;
  wrapped.field = payload?.field;
  wrapped.retryAfterSeconds = payload?.retryAfterSeconds;
  throw wrapped;
}

// PUT to a signed upload URL with progress (the same form body
// storage-js uploadToSignedUrl sends). Resolves on 2xx.
export function putToSignedUrl(signedUrl, file, { onProgress, signal, xhrFactory = () => new XMLHttpRequest() } = {}) {
  return new Promise((resolve, reject) => {
    const xhr = xhrFactory();
    xhr.open("PUT", signedUrl);
    xhr.setRequestHeader("x-upsert", "false");
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress?.(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) { onProgress?.(100); resolve(); }
      else reject(new Error(xhr.status === 413 ? "The file is too large." : "The upload failed. Try again."));
    };
    xhr.onerror = () => reject(new Error("The upload failed. Check your connection and try again."));
    xhr.onabort = () => reject(Object.assign(new Error("Upload cancelled."), { name: "AbortError" }));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    const body = new FormData();
    body.append("cacheControl", "3600");
    body.append("", file);
    xhr.send(body);
  });
}

export const educatorApi = {
  // ---- onboarding (any educator)
  startOnboarding: (fullName, phone) => callRpc("educator_start_onboarding", { p_full_name: fullName, p_phone: phone || null }),
  getStatus: () => callRpc("educator_get_status"),
  getOnboarding: () => callRpc("educator_get_onboarding"),
  saveStep: (step, data) => callRpc("educator_save_onboarding_step", { p_step: step, p_data: data }),
  registerDocument: (docType, path, docName) => callRpc("educator_register_document", { p_doc_type: docType, p_path: path, p_doc_name: docName }),
  removeDocument: (id) => callRpc("educator_remove_document", { p_document_id: id }),
  submitOnboarding: () => callRpc("educator_submit_onboarding"),

  // Validates locally, gets a signed upload URL, uploads with progress, then
  // registers the document. Errors carry .stage: "check" | "url" | "upload" | "register".
  uploadDocument: async ({ docType, docName, file, onProgress, signal }, deps = {}) => {
    const fail = (stage, error) => { error.stage = stage; throw error; };
    const problem = checkUploadFile(docType, file);
    if (problem) fail("check", new Error(problem));
    let ticket;
    try {
      ticket = await (deps.invoke || invokeFunction)("educator-upload-url", {
        docType, docName, fileName: file.name, contentType: file.type, size: file.size,
      });
    } catch (error) {
      if (error.status === 429) error.message = "You've uploaded a lot in the last hour. Try again later.";
      fail("url", error);
    }
    try {
      await (deps.put || putToSignedUrl)(ticket.signedUrl, file, { onProgress, signal });
    } catch (error) { fail("upload", error); }
    try {
      return await educatorApi.registerDocument(docType, ticket.path, docName);
    } catch (error) { return fail("register", error); }
  },

  // ---- verified educators
  getDashboard: () => callRpc("educator_get_dashboard"),
  getStats: () => callRpc("educator_get_stats"),
  getProfile: () => callRpc("educator_get_profile"),
  updateProfile: (fields) => callRpc("educator_update_profile", { p_fields: fields }),
  listAssignments: (status) => callRpc("educator_list_assignments", { p_status: status || null }),
  getAssignment: (id) => callRpc("educator_get_assignment", { p_assignment_id: id }),
  startAssignment: (id) => callRpc("educator_start_assignment", { p_assignment_id: id }),
  addAssignmentComment: (id, comment, questionId) => callRpc("educator_add_assignment_comment", {
    p_assignment_id: id, p_comment: comment, p_question_id: questionId || null,
  }),
};
