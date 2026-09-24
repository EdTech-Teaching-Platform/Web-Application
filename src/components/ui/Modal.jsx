import { useEffect } from "react";
import { XCircleIcon } from "./icons";

// Modal — design.md Section 4 (Modals & Drawers): one shared shell, 16-20px
// radius, same header/close pattern, same primary/secondary CTA footer.
// Entrance: fade + slight scale-in 200ms ease-out. Used here for "Share
// profile"/"Share course" (Day 3), reusable for any future confirmation
// dialog rather than a one-off inline overlay per screen.
export default function Modal({ open, onClose, title, children, footer }) {
  useEffect(() => {
    if (!open) return;
    function onKey(e) {
      if (e.key === "Escape") onClose?.();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
      <div
        className="absolute inset-0 bg-text/40"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-md animate-[fadeScaleIn_200ms_ease-out] rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-4">
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
        <div>{children}</div>
        {footer && <div className="mt-6 flex flex-col gap-3">{footer}</div>}
      </div>
    </div>
  );
}
