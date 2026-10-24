import { supabase } from "../../../services/supabaseClient";
import { callRpc, listResult, normalizeRpcError } from "./adminApi";

const mapAssignment = (a) => ({
  ...a,
  educatorId: a.educator_id,
  educatorName: a.educator_name || "—",
  seriesId: a.series_id,
  seriesName: a.series_name,
  testName: a.test_name,
  questionCount: a.question_count,
  questionTypeMix: a.question_type_mix,
  totalMarks: Number(a.total_marks || 0),
  duration: a.duration_minutes,
  assignedDate: a.assigned_date,
  displayStatus: a.display_status,
  progress: Number(a.progress || 0),
  submittedAt: a.submitted_at,
  overallFeedback: a.overall_feedback,
  decisionReason: a.decision_reason,
});

const mapRequest = (r) => ({
  ...r,
  sentDate: r.sent_date,
  requestedDeadline: r.requested_deadline,
  questionCount: r.question_count,
  questionTypeMix: r.question_type_mix,
  totalMarks: Number(r.total_marks || 0),
  duration: r.duration_minutes,
});

function throwIfError(error) {
  if (error) throw normalizeRpcError(error);
}

export const assignmentsApi = {
  list: async (params) => {
    const result = listResult(await callRpc("list_assignments", params));
    return { ...result, rows: result.rows.map(mapAssignment) };
  },
  detail: (id) => callRpc("get_assignment_detail", { p_id: id }),
  requests: async () => {
    const { data, error } = await supabase.from("v_series_requests").select("*").order("sent_date", { ascending: false });
    throwIfError(error);
    return (data || []).map(mapRequest);
  },
  eligibleEducators: async () => {
    const { data, error } = await supabase.from("v_eligible_educators").select("*").order("name");
    throwIfError(error);
    return data || [];
  },
  series: async () => {
    const { data, error } = await supabase.from("test_series").select("id, title").is("deleted_at", null).order("title");
    throwIfError(error);
    return (data || []).map((s) => ({ id: s.id, name: s.title }));
  },
  create: (payload) => callRpc("create_assignments", { p: payload }),
  updateRequirements: (id, patch) => callRpc("update_assignment_requirements", { p_id: id, patch }),
  reassign: (id, educatorId) => callRpc("reassign_educator", { p_id: id, p_educator: educatorId }),
  extend: (id, date) => callRpc("extend_deadline", { p_id: id, p_date: date }),
  cancel: (id, reason) => callRpc("cancel_assignment", { p_id: id, p_reason: reason || null }),
  startReview: (id) => callRpc("start_review", { p_id: id }),
  review: (id, decision, feedback, comments, reason) => callRpc("review_submission", {
    p_id: id, p_decision: decision, p_feedback: feedback, p_comments: comments, p_reason: reason,
  }),
  assignRequest: (requestId, educatorId, deadline, note) => callRpc("assign_request", {
    p_request: requestId, p_educator: educatorId, p_deadline: deadline, p_note: note || null,
  }),
  rejectRequest: (requestId, reason) => callRpc("reject_request", { p_request: requestId, p_reason: reason || null }),
};
