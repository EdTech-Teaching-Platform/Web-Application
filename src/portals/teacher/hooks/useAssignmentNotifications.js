import { useCallback, useEffect, useRef, useState } from "react";
import { educatorApi } from "../services/educatorApi";

// The educator's assignment messages (QA, 13 Nov: they were only shown to the
// admin, as "mock, not delivered"). Loads on mount, on focus and every 60 s;
// markRead updates the list at once and then on the server. A failed load
// keeps the last list and never blocks the portal.
export function useAssignmentNotifications({ enabled = true, api = educatorApi, pollMs = 60000 } = {}) {
  const [state, setState] = useState({ rows: [], unread: 0 });
  const apiRef = useRef(api);
  useEffect(() => { apiRef.current = api; });

  const load = useCallback(async () => {
    try {
      const next = await apiRef.current.listAssignmentNotifications({ limit: 20 });
      setState({ rows: next.rows, unread: next.unread });
    } catch { /* keep the last list */ }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;
    load();
    window.addEventListener("focus", load);
    const timer = pollMs > 0 ? setInterval(load, pollMs) : null;
    return () => { window.removeEventListener("focus", load); if (timer) clearInterval(timer); };
  }, [enabled, load, pollMs]);

  const markRead = useCallback(async (id) => {
    setState((s) => {
      const target = s.rows.find((n) => n.id === id);
      if (!target || target.isRead) return s;
      return { rows: s.rows.map((n) => (n.id === id ? { ...n, isRead: true } : n)), unread: Math.max(0, s.unread - 1) };
    });
    await apiRef.current.markAssignmentNotificationRead(id);
  }, []);

  return { ...state, markRead, reload: load };
}

export default useAssignmentNotifications;
