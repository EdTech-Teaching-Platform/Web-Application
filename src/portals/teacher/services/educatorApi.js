// Teacher portal service: the educator RPCs (docs/EDUCATOR_RPC_CONTRACT.md)
// and the document upload flow (educator-upload-url -> signed upload ->
// educator_register_document). The user is always the signed-in one: no call
// sends a user id. Test series authoring uses the shared admin testSeriesApi
// (the same RPCs, role-aware on the server).
import { invokeFunction } from "../../../services/edgeFunctions";
import { callRpc } from "../../admin/services/adminApi";
import { checkUploadFile } from "../utils/onboarding";
import { putToSignedUrl } from "../../../services/storageUpload";

// PUT to a signed upload URL with progress (shared with the test image uploads).
export { putToSignedUrl };

export const educatorApi = {
  // ---- onboarding (any educator)
  startOnboarding: (fullName, phone) => callRpc("educator_start_onboarding", { p_full_name: fullName, p_phone: phone || null }),
  getStatus: () => callRpc("educator_get_status"),
  getOnboarding: () => callRpc("educator_get_onboarding"),
  saveStep: (step, data) => callRpc("educator_save_onboarding_step", { p_step: step, p_data: data }),
  registerDocument: (docType, path, docName) => callRpc("educator_register_document", { p_doc_type: docType, p_path: path, p_doc_name: docName }),
  removeDocument: (id) => callRpc("educator_remove_document", { p_document_id: id }),
  submitOnboarding: () => callRpc("educator_submit_onboarding"),
  // A signed URL (10 min) for one of the caller's own documents (sign-educator-document).
  documentUrl: ({ documentId, download = false }) => invokeFunction("sign-educator-document", { documentId, download }),

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
