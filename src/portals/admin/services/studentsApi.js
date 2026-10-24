import { supabase } from "../../../services/supabaseClient";
import { normalizeRpcError } from "./adminApi";

function throwIfError(error) {
  if (error) throw normalizeRpcError(error);
}

function mapStudent(row) {
  return {
    ...row,
    name: row.full_name,
    code: row.student_code,
    registeredDate: row.registered_at ? new Date(row.registered_at).toLocaleDateString("en-IN") : "—",
    lastActive: row.last_active_at ? new Date(row.last_active_at).toLocaleString("en-IN") : "—",
    blockedDate: row.blocked_at ? new Date(row.blocked_at).toLocaleDateString("en-IN") : "",
    enrolledCourses: row.enrolled_courses || [],
  };
}

export const studentsApi = {
  stats: async () => {
    const [all, active, blocked] = await Promise.all([
      supabase.from("students").select("id", { count: "exact", head: true }),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "active"),
      supabase.from("students").select("id", { count: "exact", head: true }).eq("status", "blocked"),
    ]);
    [all, active, blocked].forEach(({ error }) => throwIfError(error));
    return { total: all.count || 0, active: active.count || 0, blocked: blocked.count || 0 };
  },
  list: async ({ search, status, grade, page, size }) => {
    let query = supabase.from("v_students_list").select("*", { count: "exact" });
    if (search.trim()) query = query.or(`full_name.ilike.%${search.trim()}%,email.ilike.%${search.trim()}%,student_code.ilike.%${search.trim()}%`);
    if (status !== "all") query = query.eq("status", status);
    if (grade !== "all") query = query.eq("grade", grade);
    const from = (page - 1) * size;
    const { data, error, count } = await query.order("registered_at", { ascending: false }).range(from, from + size - 1);
    throwIfError(error);
    return { rows: (data || []).map(mapStudent), total: count || 0 };
  },
  detail: async (id) => {
    const { data, error } = await supabase.from("v_students_list").select("*").eq("id", id).maybeSingle();
    throwIfError(error);
    if (!data) return null;
    const { data: enrollments, error: enrollmentError } = await supabase
      .from("series_enrollments")
      .select("series_id, enrolled_at")
      .eq("user_id", id);
    throwIfError(enrollmentError);
    const seriesIds = (enrollments || []).map((entry) => entry.series_id);
    let series = [];
    if (seriesIds.length) {
      const { data: seriesRows, error: seriesError } = await supabase.from("test_series").select("id, title").in("id", seriesIds);
      throwIfError(seriesError);
      series = seriesRows || [];
    }
    return mapStudent({ ...data, enrolled_courses: (enrollments || []).map((entry) => ({
      title: series.find((item) => item.id === entry.series_id)?.title || "Test series",
      progress: 0,
      enrolledDate: entry.enrolled_at,
    })) });
  },
  setStatus: async (id, status, reason) => {
    const { data: authData, error: authError } = await supabase.auth.getUser();
    throwIfError(authError);
    const { error } = await supabase.from("students").update({
      status,
      blocked_reason: status === "blocked" ? reason : null,
    }).eq("id", id);
    throwIfError(error);
    const { error: historyError } = await supabase.from("student_block_history").insert({
      student_id: id,
      action: status === "blocked" ? "blocked" : "unblocked",
      reason: status === "blocked" ? reason : null,
      by_admin: authData.user?.id || null,
    });
    throwIfError(historyError);
  },
};
