import { useCallback, useEffect, useRef, useState } from "react";
import { callRpc } from "../services/studentRpc";
import { onAccountBlocked } from "../../../services/accountBlock";

// The student's own account state (student_get_account_status, never refused
// for a block). Checked on load and whenever the window regains focus; any
// student RPC refused with account_blocked flips it at once. A failed check
// (network) keeps the last known state: it never locks a student out.
export function useAccountStatus({ load = () => callRpc("student_get_account_status") } = {}) {
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
    window.addEventListener("focus", check);
    const stop = onAccountBlocked(() => setState((s) => ({ ...s, blocked: true, checked: true })));
    return () => { window.removeEventListener("focus", check); stop(); };
  }, [check]);

  return { ...state, check };
}
