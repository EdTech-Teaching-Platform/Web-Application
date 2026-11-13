import { callRpc, listResult } from "./adminApi";
import { notifyChanged } from "../../../services/dataSync";

export const mapAssignment = (a) => ({
  ...a,
  educatorId: a.educator_id,
  educatorName: a.educator_name || "—",
  seriesId: a.series_id,
  seriesName: a.series_name,
  testName: a.test_name,
  testCount: a.test_count ?? a.testCount ?? 1,
  grade: a.grade || "",
  exam: a.exam || "",
  audience: a.audience || "",
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

export const assignmentsApi = {
  list: async (params) => {
    const result = listResult(await callRpc("list_assignments", params));
    return { ...result, rows: result.rows.map(mapAssignment) };
  },
  detail: (id) => callRpc("get_assignment_detail", { p_id: id }),
  requests: async () => ((await callRpc("list_series_requests")) || []).map(mapRequest),
  // Every approved, active educator (list_assignable_educators, 20261029100000).
  eligibleEducators: async ({ search = "", subject = "" } = {}) => {
    const { rows } = listResult(await callRpc("list_assignable_educators", {
      p_search: search.trim() || null, p_subject: subject || null, p_page: 1, p_size: 200,
    }));
    return rows.map((e) => ({
      ...e, full_name: e.name, subjects: e.subjects || [], languages: e.languages || [],
      openAssignments: Number(e.open_assignments || 0), rating: e.rating == null ? null : Number(e.rating),
    }));
  },
  series: async () => ((await callRpc("list_series_options")) || []).map((s) => ({ id: s.id, name: s.title })),
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

// Every write announces "assignments" (services/dataSync.js), so the sidebar
// badge and any open list refresh (QA, 13 Nov).
for (const name of ["create", "updateRequirements", "reassign", "extend", "cancel", "startReview", "review", "assignRequest", "rejectRequest"]) {
  const call = assignmentsApi[name];
  assignmentsApi[name] = async (...args) => {
    const result = await call(...args);
    notifyChanged("assignments", { action: name });
    return result;
  };
}
