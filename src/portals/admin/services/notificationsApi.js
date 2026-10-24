import { callRpc, listResult } from "./adminApi";

export const notificationsApi = {
  stats: () => callRpc("get_notification_stats"),
  filters: () => callRpc("get_notification_filter_options"),
  list: async (filters) => listResult(await callRpc("list_notifications", {
    p_search: filters.search || null, p_status: filters.status || null,
    p_category: filters.category || null, p_audience: filters.audience || null,
    p_page: filters.page || 1, p_size: filters.size || 10,
  })),
  get: (id) => callRpc("get_notification", { p_id: id }),
  preview: (form) => callRpc("preview_notification", {
    p_id: form.id || null, p_title: form.title || null, p_body: form.body || null,
    p_category: form.category || null, p_audience_type: form.audienceType || null,
    p_series_ids: form.seriesIds || null, p_user_ids: form.userIds || null,
    p_channels: form.channels || null,
  }),
  estimate: (form) => callRpc("estimate_audience", {
    p_type: form.audienceType, p_series_ids: form.seriesIds || [], p_user_ids: form.userIds || [],
  }),
  create: (form, action = "draft") => callRpc("create_notification", {
    p_title: form.title, p_body: form.body, p_category: form.category,
    p_audience_type: form.audienceType, p_channels: form.channels,
    p_series_ids: form.seriesIds || [], p_user_ids: form.userIds || [],
    p_scheduled_for: form.scheduledFor || null, p_action: action, p_action_url: form.actionUrl || null,
  }),
  publish: (id) => callRpc("publish_notification", { p_id: id }),
  archive: (id) => callRpc("archive_notification", { p_id: id }),
  deleteDraft: (id) => callRpc("delete_draft_notification", { p_id: id }),
  markRead: (id) => callRpc("mark_notification_read", { p_id: id }),
  markAllRead: () => callRpc("mark_all_notifications_read"),
  myUnreadCount: () => callRpc("get_my_unread_notification_count"),
};
