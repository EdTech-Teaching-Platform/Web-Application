import { useCallback, useEffect, useRef, useState } from "react";
import { callRpc } from "../services/studentRpc";
import { onAccountBlocked } from "../../../services/accountBlock";

// The student's own account state (student_get_account_status, never refused
// for a block). Checked on load, whenever the window regains focus or the tab
// becomes visible, and every 30 s while the tab is visible (QA #15 / #16: a
// student sitting on the dashboard never saw the block until they switched
// tabs). Any student RPC refused with account_blocked flips it at once. A
// failed check (network) keeps the last known state: it never locks a
// student out.
export const ACCOUNT_STATUS_POLL_MS = 30000;
export function useAccountStatus({ load = () => callRpc("student_get_account_status"), pollMs = ACCOUNT_STATUS_POLL_MS } = {}) {
  const [state, setState] = useState({ blocked: false, reasonPublic: "", checked: false });
  const loadRef = useRef(load);
  useEffect(() => { loadRef.current = load; });

  const check = useCallback(async () => {
    try {
      const res = await loadRef.current();
      setState({ blocked: !!res?.blocked, reasonPublic: res?.reason_public || "", checked: true });
    } catch (error) {
      if (error?.code === "account_blocked") setState((s) => ({ ...s, blocked: true, checked: true }));
      else setState((s) => ({ ...s, checked: true }));
    }
  }, []);

  useEffect(() => {
    check();
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", onVisible);
    const timer = pollMs > 0 ? setInterval(() => { if (document.visibilityState !== "hidden") check(); }, pollMs) : null;
    const stop = onAccountBlocked(() => setState((s) => ({ ...s, blocked: true, checked: true })));
    return () => {
      window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", onVisible);
      if (timer) clearInterval(timer);
      stop();
    };
  }, [check, pollMs]);

  return { ...state, check };
}
