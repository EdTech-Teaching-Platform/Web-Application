import { useCallback, useEffect, useRef, useState } from "react";
import { educatorApi } from "../services/educatorApi";
import { GATE, gateFor } from "../utils/onboarding";

export const PENDING_POLL_MS = 60000;

// educator_get_status() for the portal gate: loaded on mount, refreshed when
// the window regains focus, and every 60 s while the application is waiting
// for review (so approval opens the portal without a reload).
export function useEducatorStatus({ api = educatorApi, pollMs = PENDING_POLL_MS } = {}) {
  const [state, setState] = useState({ status: null, loading: true, error: null });
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const status = await api.getStatus();
      if (mounted.current) setState({ status, loading: false, error: null });
    } catch (error) {
      // keep the last known status on a transient failure
      if (mounted.current) setState((s) => ({ ...s, loading: false, error }));
    }
  }, [api]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    window.addEventListener("focus", refresh);
    return () => {
      mounted.current = false;
      window.removeEventListener("focus", refresh);
    };
  }, [refresh]);

  const gate = state.status ? gateFor(state.status) : null;
  useEffect(() => {
    if (gate !== GATE.PENDING) return undefined;
    const timer = setInterval(refresh, pollMs);
    return () => clearInterval(timer);
  }, [gate, refresh, pollMs]);

  return { ...state, gate, refresh };
}
