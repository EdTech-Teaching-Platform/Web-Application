// Teacher / admin marking of written answers (20261120090000). The same RPCs
// serve both portals: the database allows admins and the series' educator.
import { callRpc, listResult } from "../portals/admin/services/adminApi";

export const gradingApi = {
  // status: "pending" (not yet published) | "draft" | "published" | "all"
  list: async ({ status = "pending", search = "", seriesId = null, page = 1, size = 20 } = {}) =>
    listResult(await callRpc("grading_list_attempts", {
      p_status: status, p_search: search.trim() || null, p_series_id: seriesId, p_page: page, p_size: size,
    })),
  get: (attemptId) => callRpc("grading_get_attempt", { p_attempt_id: attemptId }),
  // grades: [{questionId, marks (number | null to clear), feedback}]
  save: (attemptId, grades, overallFeedback, publish = false) => callRpc("grading_save", {
    p_attempt_id: attemptId,
    p_grades: grades.map((g) => ({ question_id: g.questionId, marks: g.marks, feedback: g.feedback || "" })),
    p_overall_feedback: overallFeedback || null,
    p_publish: Boolean(publish),
  }),
};

export default gradingApi;
