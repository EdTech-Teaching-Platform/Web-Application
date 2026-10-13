import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Root-cause fix for the "page loads scrolled to the bottom" bug: React
// Router (unlike a traditional multi-page app) does NOT reset window scroll
// on navigation — it's a client-side DOM update, so whatever scroll position
// the previous page/route was at just carries over onto the new one. This
// mounts once at the top of the router tree (see AppRoutes.jsx) and resets
// window scroll to the top on every path change, covering sidebar nav
// clicks, card/row → detail navigations, and browser back/forward (all of
// which change `location.pathname`).
//
// Deliberately scoped to `window` only — it must never reach into an
// internal scrollable container (chat thread, long list, curriculum tree)
// that manages its own scroll position on purpose.
export default function ScrollToTop() {
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);

  return null;
}
