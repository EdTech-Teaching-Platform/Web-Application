import { callRpc } from "./studentRpc";

// The student's own inbox (the lead's notifications rows), through the
// student RPCs of 20261107090000_student_notifications.sql. An admin resolving
// a reported issue writes one of these rows (reference_type 'test_feedback').
export const NOTIFICATIONS_TOPIC = "student-notifications";

// Only in-app student links are followed (the server already drops others).
export function safeStudentLink(url) {
  return typeof url === "string" && /^\/student\/[^\s]*$/.test(url) && !url.startsWith("//") ? url : null;
}

export function normalizeNotification(row) {
  return {
    id: row.id,
    category: row.category || "system",
    title: row.title || "Notification",
    body: row.body || "",
    actionUrl: safeStudentLink(row.action_url),
    referenceType: row.reference_type || "",
    referenceId: row.reference_id || null,
    isRead: Boolean(row.is_read),
    createdAt: row.created_at || null,
  };
}

export const notificationsApi = {
  // {rows, unread}
  async list({ unreadOnly = false, limit = 30 } = {}) {
    const data = await callRpc("student_list_notifications", { p_unread_only: unreadOnly, p_limit: limit });
    return { rows: (data?.rows || []).map(normalizeNotification), unread: Number(data?.unread || 0) };
  },
  markRead: (id) => callRpc("student_mark_notification_read", { p_id: id }),
  markAllRead: () => callRpc("student_mark_all_notifications_read"),
};

export const CATEGORY_LABEL = {
  support_ticket: "Your reports",
  moderation: "Your reports",
  assessment_result: "Results",
  announcement: "Announcements",
  broadcast: "Announcements",
  payment: "Payments",
  refund: "Payments",
  system: "Updates",
};
export const categoryLabel = (c) => CATEGORY_LABEL[c] || "Updates";

// A resolved report (the popup is shown for these).
export const isResolutionNotice = (n) => n.referenceType === "test_feedback";

export default notificationsApi;
