import { callRpc, listResult } from "./adminApi";

// Content Moderation: student feedback, queries and issue reports on tests
// (test_feedback; RPCs in 20261027100300_feedback_rpc_admin.sql).

export const KIND_LABEL = { feedback: "Feedback", query: "Query", issue: "Issue" };
export const STATUS_LABEL = { new: "New", in_review: "In review", resolved: "Resolved", dismissed: "Dismissed" };
export const STATUS_BADGE = { new: "is-pending", in_review: "is-verified", resolved: "is-approved", dismissed: "is-rejected" };
export const CATEGORY_LABEL = {
  wrong_answer: "Wrong answer",
  unclear_question: "Unclear question",
  technical_problem: "Technical problem",
  other: "Other",
};
// Statuses an admin can set; resolve / dismiss need a note (shown to the student).
export const STATUS_ACTIONS = [
  { status: "in_review", label: "Mark in review", needsNote: false },
  { status: "resolved", label: "Resolve", needsNote: true },
  { status: "dismissed", label: "Dismiss", needsNote: true },
];

export function mapModerationRow(r) {
  if (!r) return null;
  return {
    id: r.id,
    kind: r.kind,
    kindLabel: KIND_LABEL[r.kind] ?? r.kind,
    rating: r.rating ?? null,
    category: r.category ?? null,
    categoryLabel: r.category ? CATEGORY_LABEL[r.category] ?? r.category : "",
    message: r.message ?? "",
    status: r.status,
    statusLabel: STATUS_LABEL[r.status] ?? r.status,
    statusBadge: STATUS_BADGE[r.status] ?? "is-pending",
    adminNote: r.admin_note ?? "",
    createdAt: r.created_at,
    reviewedAt: r.reviewed_at ?? null,
    reviewedByName: r.reviewed_by_name ?? "",
    student: { id: r.student_id, name: r.student_name || "Unknown student", email: r.student_email || "" },
    series: { id: r.series_id, title: r.series_title || "—" },
    test: { id: r.test_id ?? null, title: r.test_title || "" },
    attemptId: r.attempt_id ?? null,
    questionId: r.question_id ?? null,
  };
}

export function mapModerationItem(d) {
  if (!d) return null;
  return {
    ...mapModerationRow(d),
    question: d.question ? { id: d.question.id, text: d.question.text, position: d.question.position } : null,
    attempt: d.attempt
      ? { number: d.attempt.attempt_number, status: d.attempt.status, score: d.attempt.score, maxScore: d.attempt.max_score,
          percentage: d.attempt.percentage, submittedAt: d.attempt.submitted_at }
      : null,
    history: (d.history || []).map((h) => ({
      action: h.action, actorName: h.actor_name || "Admin", actorRole: h.actor_role,
      from: STATUS_LABEL[h.before] ?? h.before, to: STATUS_LABEL[h.after] ?? h.after, note: h.note || "", at: h.at,
    })),
  };
}

const nullIfAll = (v) => (v === undefined || v === null || v === "" || v === "all" ? null : v);

export const moderationApi = {
  // { rows, total } — rows are mapModerationRow objects.
  list: async ({ search = "", kind = "all", status = "all", series = "all", page = 1, size = 10 } = {}) => {
    const { rows, total } = listResult(await callRpc("list_moderation_items", {
      p_search: search.trim() || null,
      p_kind: nullIfAll(kind),
      p_status: nullIfAll(status),
      p_series: nullIfAll(series),
      p_page: page,
      p_size: size,
    }));
    return { rows: rows.map(mapModerationRow), total: Number(total) || 0 };
  },
  stats: () => callRpc("get_moderation_stats"),
  get: async (id) => mapModerationItem(await callRpc("get_moderation_item", { p_id: id })),
  setStatus: async (id, status, note = "") =>
    mapModerationRow(await callRpc("set_moderation_status", { p_id: id, p_status: status, p_note: note.trim() || null })),
  filterOptions: () => callRpc("get_moderation_filter_options"),
};

export default moderationApi;
