import { useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";

// Screen-reader / keyboard support for a single-page app (WCAG 2.4.1 Bypass
// Blocks, 2.4.2 Page Titled, 2.4.3 Focus Order, 4.1.3 Status Messages):
//  - a "Skip to main content" link as the first tab stop,
//  - a unique document.title per route (taken from the page's <h1>),
//  - a polite live-region announcement when the route changes,
//  - focus moved to <main> after navigation (only when focus would otherwise
//    be left on a control that no longer exists or in the old navigation).
// It renders nothing visual until the skip link is focused, and it never
// edits any page component.

const BRAND = "Universal Learning";
export const MAIN_ID = "main-content";

export function humanizePath(pathname) {
  const last = pathname.split("/").filter(Boolean).pop();
  if (!last) return "Home";
  const text = decodeURIComponent(last).replace(/[-_]+/g, " ").trim();
  return text.charAt(0).toUpperCase() + text.slice(1);
}

export function titleFromDocument(root, pathname) {
  const h1 = root.querySelector("main h1, h1");
  const text = h1?.textContent?.replace(/\s+/g, " ").trim();
  return text || humanizePath(pathname);
}

function getMain() {
  const main = document.querySelector("main");
  if (main) {
    if (!main.id) main.id = MAIN_ID;
    if (!main.hasAttribute("tabindex")) main.setAttribute("tabindex", "-1");
  }
  return main;
}

export default function RouteA11y() {
  const { pathname } = useLocation();
  const [message, setMessage] = useState("");
  const first = useRef(true);

  useEffect(() => {
    const isFirst = first.current;
    first.current = false;
    let done = false;
    let observer;
    let timer;

    const apply = () => {
      if (done) return;
      const h1 = document.querySelector("main h1, h1");
      // Lazy routes render a fallback first; wait until a heading exists
      // (or give up after a short while and use the path).
      if (!h1 && !apply.final) return;
      done = true;
      observer?.disconnect();
      clearTimeout(timer);
      const title = titleFromDocument(document, pathname);
      document.title = title === BRAND ? BRAND : `${title} | ${BRAND}`;
      if (isFirst) return;
      setMessage("");
      // clear then set so repeated identical titles are still announced
      setTimeout(() => setMessage(`${title} page loaded`), 50);
      const main = getMain();
      const active = document.activeElement;
      const lost = !active || active === document.body || !main?.contains(active);
      if (main && lost) {
        try { main.focus({ preventScroll: true }); } catch { /* ignore */ }
      }
    };

    getMain();
    const root = document.getElementById("root") || document.body;
    observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true });
    timer = setTimeout(() => { apply.final = true; apply(); }, 1500);
    apply();

    return () => {
      done = true;
      observer?.disconnect();
      clearTimeout(timer);
    };
  }, [pathname]);

  const skip = (event) => {
    const main = getMain();
    if (!main) return;
    event.preventDefault();
    main.focus();
    main.scrollIntoView?.({ block: "start" });
  };

  return (
    <>
      <a href={`#${MAIN_ID}`} className="a11y-skip-link" onClick={skip}>
        Skip to main content
      </a>
      <div className="sr-only" role="status" aria-live="polite" aria-atomic="true" data-testid="route-announcer">
        {message}
      </div>
    </>
  );
}
