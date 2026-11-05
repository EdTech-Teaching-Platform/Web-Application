import { callRpc, listResult } from "./adminApi";
import { invokeFunction } from "../../../services/edgeFunctions";

function mapStudent(row) {
  // get_student_detail (20261104090000): only this student's active test
  // series enrolments, with real progress, best score and attempts.
  const enrolledSeries = (row.enrolled_series || []).map((entry) => ({
    seriesId: entry.series_id,
    title: entry.title || "Test series",
    progress: Number(entry.progress || 0),
    testsDone: Number(entry.tests_done || 0),
    testsTotal: Number(entry.tests_total || 0),
    bestScore: entry.best_score == null ? null : Number(entry.best_score),
    attempts: Number(entry.attempts || 0),
    enrolledDate: entry.enrolled_at ? new Date(entry.enrolled_at).toLocaleDateString("en-IN") : "—",
  }));
  const enrolledCourses = (row.enrolled_courses || []).map((entry) => ({
    title: entry.title || "Course",
    progress: Number(entry.progress || 0),
    enrolledDate: entry.enrolled_at,
  }));
  return {
    ...row,
    name: row.full_name,
    code: row.student_code,
    registeredDate: row.registered_at ? new Date(row.registered_at).toLocaleDateString("en-IN") : "—",
    lastActive: row.last_active_at ? new Date(row.last_active_at).toLocaleString("en-IN") : "—",
    blockedDate: row.blocked_at ? new Date(row.blocked_at).toLocaleDateString("en-IN") : "",
    blockedReason: row.blocked_reason || "",
    blockedAt: row.blocked_at ? new Date(row.blocked_at).toLocaleString("en-IN") : "",
    blockedByName: row.blocked_by_name || "",
    blockHistory: (row.block_history || []).map((h) => ({
      action: h.action, reason: h.reason || "", byName: h.by_name || "Admin",
      at: h.at ? new Date(h.at).toLocaleString("en-IN") : "",
    })),
    // Kept apart: the lead's course enrolments used to be mixed into the series list.
    enrolledSeries,
    enrolledCourses,
  };
}

export const studentsApi = {
  stats: () => callRpc("get_student_stats"),
  list: async ({ search, status, grade, page, size }) => {
    const result = listResult(await callRpc("list_students", {
      p_search: search?.trim() || null,
      p_status: status === "all" ? null : status,
      p_grade: grade === "all" ? null : grade,
      p_sort: "registered_desc",
      p_page: page,
      p_size: size,
    }));
    return { ...result, rows: result.rows.map(mapStudent) };
  },
  detail: async (id) => {
    const data = await callRpc("get_student_detail", { p_id: id });
    return data ? mapStudent(data) : null;
  },
  setStatus: (id, status, reason) => (status === "blocked"
    ? callRpc("block_student", { p_id: id, p_reason: reason })
    : callRpc("unblock_student", { p_id: id })),
  // Auth-level ban that follows the SQL block / unblock (set-user-ban, QA triage P2).
  setBan: (id, ban, reason) => invokeFunction("set-user-ban", { userId: id, ban, reason: reason || null }),
};
