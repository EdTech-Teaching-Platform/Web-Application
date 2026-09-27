import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Scrolls to the element whose id matches the current URL hash. Needed
// because react-router's <Link> does a client-side navigation, which does
// NOT trigger the browser's native anchor-scroll the way a plain
// <a href="#section"> does. Used by the discovery pages (Explore, Live
// Classes, Recorded Classes) whose navbar dropdown items link to in-page
// sections, e.g. "/student/explore#popular".
export function useScrollToHash() {
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const id = decodeURIComponent(hash.slice(1));
    // Give the page a tick to render before measuring scroll position.
    const raf = requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => cancelAnimationFrame(raf);
  }, [hash]);
}
