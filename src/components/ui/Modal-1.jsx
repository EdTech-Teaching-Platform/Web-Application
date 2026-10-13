import { useEffect, useState } from "react";
import { XIcon } from "./icons";

// Modal / Drawer — design.md Section 4: one shared shell, 16-20px radius,
// same header/close pattern, same primary/secondary CTA footer across every
// use (Quick Actions, profile edit, confirmation dialogs, and here — the
// Digital ID Card "Share" view). Entrance: fade + slight scale-in, 200ms
// ease-out; exit reverses the same transition.
//
// Deliberately conditionally rendered (`open` unmounts the DOM node) rather
// than kept mounted+hidden, so it never intercepts clicks/tab focus while
// closed. The brief mount-frame delay below is what lets the enter
// transition actually animate instead of snapping in at its end state.
//
// Capped at 85% of the viewport height with the header and footer pinned
// in place and only the middle content scrolling — a modal with a lot of
// fields (Schedule a Call/Live Class, Reschedule, etc.) could otherwise
// grow taller than the window with no way to reach its own Confirm/Cancel
// buttons at the bottom. This keeps the footer always reachable no matter
// how short the browser window or how long the content is.
export default function Modal({ open, onClose, title, children, footer, size = "md" }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e) => e.key === "Escape" && onClose?.();
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-md", lg: "max-w-lg" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className={`absolute inset-0 bg-text/50 transition-opacity duration-200 ease-out ${
          entered ? "opacity-100" : "opacity-0"
        }`}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`relative flex w-full ${widths[size] ?? widths.md} max-h-[85vh] flex-col rounded-3xl bg-surface shadow-elevated transition-all duration-200 ease-out ${
          entered ? "translate-y-0 scale-100 opacity-100" : "translate-y-1 scale-95 opacity-0"
        }`}
      >
        <div className="flex shrink-0 items-start justify-between gap-4 px-6 pb-5 pt-6 sm:px-7 sm:pt-7">
          {title && <h2 className="font-display text-lg text-text">{title}</h2>}
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="ml-auto shrink-0 rounded-full p-1 text-text/40 transition-colors duration-150 hover:bg-text/5 hover:text-text"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6 sm:px-7 sm:pb-7">{children}</div>
        {footer && (
          <div className="shrink-0 border-t border-text/[0.07] px-6 py-5 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row-reverse">{footer}</div>
          </div>
        )}
      </div>
    </div>
  );
}
