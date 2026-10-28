import { supabase } from "../../../services/supabaseClient";
import { callRpc, listResult, normalizeRpcError } from "./adminApi";

// "government_id" + "front" -> "Government ID (front)"; certificates keep their label.
const DOC_TYPE_LABEL = {
  government_id: "Government ID", degree_certificate: "Degree certificate", teaching_license: "Teaching licence",
  experience_letter: "Experience letter", subject_certificate: "Subject certificate", other: "Other document",
};
export function documentLabel(docType, docName) {
  if (docType === "other" && docName === "selfie") return "Selfie";
  const type = DOC_TYPE_LABEL[docType] || docType || "Document";
  return docName ? `${type} (${docName})` : type;
}

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
        fileName: documentLabel(document.doc_type, document.doc_name),
        uploadedDate: document.uploaded_at ? new Date(document.uploaded_at).toLocaleDateString("en-IN") : "—",
        rejectionReason: document.note,
      })),
      courses: (data.courses || []).map((course) => ({
        ...course,
        students: Number(course.students || 0),
        completionRate: Number(course.completion_rate || 0),
        rating: Number(course.rating || 0),
      })),
      coursesCount: Number(data.educator.courses_count || 0),
      professionalSummary: data.educator.bio || "",
      languages: data.educator.languages || [],
      submittedAt: data.educator.submitted_at || null,
      reviewState: data.educator.review_state || null,
      address: data.educator.location || "—",
      gender: data.educator.gender || "—",
      dob: data.educator.dob || "—",
      role: "Educator",
      skills: [],
      certifications: [],
      previousExperience: [],
      permissions: [],
      history: data.history || [],
      students: [],
      performance: { totalStudents: Number(data.educator.students_count || 0), activeStudents: 0, completedStudents: 0, atRiskStudents: 0 },
      payments: { totalEarnings: 0, paidAmount: 0, pendingAmount: 0, commissionRate: 0, nextPayoutDate: null, nextPayoutAmount: 0, history: [] },
      messages: [],
    };
  },
  setVerification: (id, status, note) => callRpc("set_educator_verification", { p_id: id, p_decision: status, p_note: note || null }),
  updateDocument: (id, documentId, status, note) => callRpc("review_educator_document", {
    p_educator_id: id, p_document_id: documentId, p_status: status, p_note: note || null,
  }),
  setAccountStatus: (id, status, reason) => callRpc("set_educator_account_status", { p_id: id, p_status: status, p_reason: reason || null }),
  delete: (id) => callRpc("delete_educator", { p_id: id }),
  createInvites: async (rows) => {
    const { data, error } = await supabase.functions.invoke("create-educator-invites", { body: { rows } });
    if (error) throw normalizeRpcError(error);
    // Per-row results: surface duplicates / failures when nothing was created.
    if (data && !data.created && Array.isArray(data.results) && data.results.length) {
      throw new Error(data.results.map((r) => `${r.email}: ${r.error || r.status}`).join("; "));
    }
    return data;
  },
  // sign-educator-document checks admin and that the path belongs to an
  // educator_verification_docs row, then signs it with the service role.
  signedDocumentUrl: async (path) => {
    const { data, error } = await supabase.functions.invoke("sign-educator-document", { body: { path } });
    if (error) throw normalizeRpcError(error);
    return data.signedUrl;
  },
};
