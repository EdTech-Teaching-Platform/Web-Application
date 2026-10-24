import { callRpc, listResult } from "./adminApi";

export const trackerApi = {
  stats: () => callRpc("get_tracker_stats"),
  list: async (params) => listResult(await callRpc("list_series_tracker", params)),
  detail: async (id) => {
    const data = await callRpc("get_series_tracker_detail", { p_series: id });
    return {
      ...data,
      assignments: (data?.assignments || []).map((a) => ({
        ...a,
        educatorName: a.educator_name,
        testName: a.test_name,
        questionCount: a.question_count,
        totalMarks: a.total_marks,
        duration: a.duration_minutes,
        displayStatus: a.display_status,
        progress: a.progress,
      })),
    };
  },
  matches: async (params) => listResult(await callRpc("list_repeated_matches", params)),
  matchCounts: () => callRpc("get_match_counts"),
  detectMatches: () => callRpc("detect_repeated_questions"),
  markReviewed: (id) => callRpc("mark_match_reviewed", { p_id: id }),
  dismissMatch: (id, note) => callRpc("dismiss_match", { p_id: id, p_note: note }),
  confirmMatch: (id, note) => callRpc("flag_match_confirmed", { p_id: id, p_note: note }),
};
