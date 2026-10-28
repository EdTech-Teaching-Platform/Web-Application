import { useCallback, useEffect, useState } from "react";
import { testSeriesApi } from "../services/testSeriesApi";

// Number of educator series waiting for approval (sidebar badge, Approvals
// tab). Refreshes every minute and when the window regains focus; errors
// keep the last count (the badge is a hint, not a gate).
export function usePendingApprovals({ intervalMs = 60000, api = testSeriesApi } = {}) {
  const [count, setCount] = useState(0);
  const refresh = useCallback(() => api.listPendingApprovals({ size: 1 })
    .then((result) => setCount(Number(result?.total || 0)))
    .catch(() => {}), [api]);

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, intervalMs);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
  }, [refresh, intervalMs]);

  return { count, refresh };
}
