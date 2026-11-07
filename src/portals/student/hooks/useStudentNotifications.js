import { useCallback, useEffect, useRef, useState } from "react";
import { notifyChanged, useRefetchOnChange } from "../../../services/dataSync";
import { NOTIFICATIONS_TOPIC, notificationsApi } from "../services/notificationsApi";

// The student's inbox for the layout (bell badge + resolution popup) and the
// Notifications page. Loads on mount, every `intervalMs`, when the window
// regains focus, and whenever another view changes it (dataSync topic).
// A failed load keeps the last state: the inbox is a hint, never a gate.
export function useStudentNotifications({ api = notificationsApi, intervalMs = 60000, limit = 30, enabled = true } = {}) {
  const [state, setState] = useState({ rows: [], unread: 0, loading: enabled, error: null, loaded: false });
  const apiRef = useRef(api);
  apiRef.current = api;

  const refresh = useCallback(async () => {
    try {
      const res = await apiRef.current.list({ limit });
      setState({ rows: res.rows, unread: res.unread, loading: false, error: null, loaded: true });
      return res;
    } catch (error) {
      setState((s) => ({ ...s, loading: false, error }));
      return null;
    }
  }, [limit]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = intervalMs > 0 ? setInterval(refresh, intervalMs) : null;
    return () => { if (timer) clearInterval(timer); };
  }, [enabled, refresh, intervalMs]);
  useRefetchOnChange(enabled ? refresh : () => {}, NOTIFICATIONS_TOPIC);

  // Optimistic: the row reads as read at once; other views refetch.
  const markRead = useCallback(async (id) => {
    setState((s) => {
      const hit = s.rows.find((r) => r.id === id && !r.isRead);
      if (!hit) return s;
      return { ...s, unread: Math.max(0, s.unread - 1), rows: s.rows.map((r) => (r.id === id ? { ...r, isRead: true } : r)) };
    });
    try { await apiRef.current.markRead(id); } catch { /* the next refresh shows the truth */ }
    notifyChanged(NOTIFICATIONS_TOPIC);
  }, []);

  const markAllRead = useCallback(async () => {
    setState((s) => ({ ...s, unread: 0, rows: s.rows.map((r) => ({ ...r, isRead: true })) }));
    try { await apiRef.current.markAllRead(); } catch { /* the next refresh shows the truth */ }
    notifyChanged(NOTIFICATIONS_TOPIC);
  }, []);

  return { ...state, refresh, markRead, markAllRead };
}
