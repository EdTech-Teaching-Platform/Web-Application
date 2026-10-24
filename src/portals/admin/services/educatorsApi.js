import { supabase } from "../../../services/supabaseClient";
import { callRpc, listResult, normalizeRpcError } from "./adminApi";

const mapEducator = (e) => ({
  ...e,
  name: e.full_name,
  code: e.educator_code,
  firstName: e.full_name?.split(" ")[0] || "",
  lastName: e.full_name?.split(" ").slice(1).join(" ") || "",
  subjects: e.subjects || [],
  yearsExperience: Number(e.years_experience || 0),
  accountStatus: e.account_status,
  verificationStatus: e.verification_status,
  joinedDate: e.joined_at ? new Date(e.joined_at).toLocaleDateString("en-IN") : "—",
  lastActive: e.last_active_at ? new Date(e.last_active_at).toLocaleString("en-IN") : "—",
  rating: Number(e.rating || 0),
  studentsCount: Number(e.students_count || 0),
  avatarColor: "#5b6bd6",
});

export const educatorsApi = {
  list: async (params) => {
    const result = listResult(await callRpc("list_educators", params));
    return { ...result, rows: result.rows.map(mapEducator) };
  },
  stats: () => callRpc("get_educator_stats"),
  detail: async (id) => {
    const data = await callRpc("get_educator_detail", { p_id: id });
    if (!data?.educator) return null;
    const educator = mapEducator(data.educator);
    const verificationNote = (data.history || []).find(
      (entry) => entry.kind === "verification" && entry.to_value === "under_review"
    )?.reason || null;
    return {
      ...educator,
      verificationNote,
      documents: (data.documents || []).map((document) => ({
        ...document,
        type: document.doc_type,
        fileName: document.file_path?.split("/").pop() || "Document",
        uploadedDate: document.uploaded_at ? new Date(document.uploaded_at).toLocaleDateString("en-IN") : "—",
        rejectionReason: document.note,
      })),
      history: data.history || [],
      students: [],
      performance: {},
      messages: [],
    };
  },
  setVerification: (id, status, note) => callRpc("set_educator_verification", { p_id: id, p_decision: status, p_note: note || null }),
  updateDocument: async (id, documentId, status, note) => {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) throw normalizeRpcError(userError);
    const { error } = await supabase.from("educator_documents").update({
      status,
      note: note || null,
      reviewed_by: userData.user?.id || null,
      reviewed_at: new Date().toISOString(),
    }).eq("id", documentId).eq("educator_id", id);
    if (error) throw normalizeRpcError(error);
  },
  setAccountStatus: (id, status, reason) => callRpc("set_educator_account_status", { p_id: id, p_status: status, p_reason: reason || null }),
  delete: (id) => callRpc("delete_educator", { p_id: id }),
  createInvites: async (rows) => {
    const { data, error } = await supabase.functions.invoke("create-educator-invites", { body: { rows } });
    if (error) throw normalizeRpcError(error);
    return data;
  },
  signedDocumentUrl: async (path) => {
    const { data, error } = await supabase.storage.from("educator-documents").createSignedUrl(path, 300);
    if (error) throw error;
    return data.signedUrl;
  },
};
