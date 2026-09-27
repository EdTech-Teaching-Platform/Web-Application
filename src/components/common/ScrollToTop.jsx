import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

export default function ScrollToTop() {
  const location = useLocation();

  useLayoutEffect(() => {
    if (typeof window !== "undefined") {
      window.history.scrollRestoration = "manual";
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    }

    document.querySelectorAll(".student-main, .student-main .overflow-y-auto").forEach((element) => {
      element.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  // Query-string changes power in-place filters and sorting on Explore.
  // Keep the current scroll position for those updates; only a path or
  // hash navigation should reset the page scroll.
  }, [location.pathname, location.hash]);

  return null;
}
