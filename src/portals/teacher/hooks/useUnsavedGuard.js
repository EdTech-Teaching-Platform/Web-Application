// Unsaved-changes guard. The app uses <BrowserRouter> (not a data router), so
// react-router's useBlocker isn't available; instead, while `dirty` is true we
//   * intercept in-app link clicks in the capture phase and ask first, and
//   * set a beforeunload prompt for tab close / reload.
// `go(to)` is the guarded replacement for navigate(to) in the page's own buttons.
import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

export default function useUnsavedGuard(dirty) {
  const navigate = useNavigate();
  const [pending, setPending] = useState(null);

  useEffect(() => {
    if (!dirty) return undefined;
    function onClick(e) {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = e.target instanceof Element ? e.target.closest("a[href]") : null;
      if (!a || a.target === "_blank" || a.hasAttribute("download")) return;
      const url = new URL(a.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      const to = `${url.pathname}${url.search}${url.hash}`;
      if (to === `${window.location.pathname}${window.location.search}${window.location.hash}`) return;
      e.preventDefault();
      e.stopPropagation();
      setPending(to);
    }
    function onBeforeUnload(e) {
      e.preventDefault();
      e.returnValue = "";
    }
    document.addEventListener("click", onClick, true);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [dirty]);

  const go = useCallback(
    (to) => {
      if (dirty) setPending(to);
      else navigate(to);
    },
    [dirty, navigate]
  );
  const leave = useCallback(() => {
    const to = pending;
    setPending(null);
    if (to) navigate(to);
  }, [pending, navigate]);
  const stay = useCallback(() => setPending(null), []);
  return { pending, go, leave, stay };
}
