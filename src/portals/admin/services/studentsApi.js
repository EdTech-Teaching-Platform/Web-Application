import { callRpc, listResult } from "./adminApi";

function mapStudent(row) {
  const enrolledSeries = (row.enrolled_series || []).map((entry) => ({
    title: entry.title || "Test series",
    progress: Number(entry.progress || 0),
    enrolledDate: entry.enrolled_at,
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
    enrolledCourses: [...enrolledSeries, ...enrolledCourses],
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
};
