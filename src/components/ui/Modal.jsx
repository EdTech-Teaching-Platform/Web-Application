import { useEffect } from "react";
import { createPortal } from "react-dom";
import { XCircleIcon } from "./icons";

// Modal — design.md Section 4 (Modals & Drawers): one shared shell, 16-20px
// radius, same header/close pattern, same primary/secondary CTA footer.
// Entrance: fade + slight scale-in 200ms ease-out. Used here for "Share
// profile"/"Share course" (Day 3), reusable for any future confirmation
// dialog rather than a one-off inline overlay per screen.
export default function Modal({ open, onClose, title, children, footer, maxWidth = "max-w-md" }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const dialog = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div
        className="absolute inset-0 bg-text/40"
        onClick={onClose}
        aria-hidden="true"
      />
      {/* Capped to the viewport: header and footer stay put, the body scrolls. */}
      <div className={`relative flex max-h-full w-full ${maxWidth} animate-[fadeScaleIn_200ms_ease-out] flex-col overflow-hidden rounded-2xl bg-white shadow-xl`}>
        <div className="flex shrink-0 items-center justify-between gap-4 px-6 pb-4 pt-6">
          <h2 className="font-display text-lg font-semibold text-text">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-text/40 transition-colors duration-150 hover:text-text"
          >
            <XCircleIcon />
          </button>
        </div>
        <div className={`min-h-0 flex-1 overflow-y-auto px-6 ${footer ? "pb-1" : "pb-6"}`}>{children}</div>
        {footer && <div className="flex shrink-0 flex-col gap-3 px-6 pb-6 pt-5">{footer}</div>}
      </div>
    </div>
  );

  // The student portal marks its root with data-modal-root. Rendering the dialog
  // there (it keeps that portal's theme variables) lifts it above the floating
  // navbar and bottom bar, which sit in a higher stacking layer than the page.
  const host = typeof document !== "undefined" ? document.querySelector("[data-modal-root]") : null;
  return host ? createPortal(dialog, host) : dialog;
}
