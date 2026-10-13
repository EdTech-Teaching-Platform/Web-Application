import { useEffect, useState } from "react";

// DropdownPanel — the one shared popover used by the educator header's
// Notifications, Settings and Profile menus (and anything else that needs an
// anchored menu). It owns the behavior the three used to need separately:
//   * anchored under its trigger (right- or left-aligned), z-above the page
//   * click/tap outside closes it (clicks on the anchor itself are ignored so
//     the trigger's own toggle isn't fought by the outside-click handler)
//   * Escape closes it and returns focus to the trigger
//   * 150ms fade + slight rise/scale entrance, mirrored on exit (the same
//     enter/exit rhythm as Modal.jsx)
//   * on narrow screens (< sm) it becomes a full-width sheet pinned under the
//     sticky header, so it can never overflow the screen edge
//
// Usage — wrap trigger + panel in one `relative` element and pass its ref:
//   <div ref={anchorRef} className="relative">
//     <button aria-expanded={open} onClick={toggle}>…</button>
//     <DropdownPanel open={open} onClose={close} anchorRef={anchorRef} label="Notifications">…</DropdownPanel>
//   </div>
export default function DropdownPanel({
  open,
  onClose,
  anchorRef,
  label,
  align = "right",
  widthClass = "sm:w-80",
  className = "",
  children,
}) {
  // `mounted` lingers briefly after close so the exit transition can play.
  const [mounted, setMounted] = useState(open);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setEntered(true));
      return () => cancelAnimationFrame(raf);
    }
    setEntered(false);
    const t = setTimeout(() => setMounted(false), 150);
    return () => clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointerDown = (e) => {
      if (anchorRef?.current?.contains(e.target)) return;
      onClose?.();
    };
    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      onClose?.();
      anchorRef?.current?.querySelector("button")?.focus();
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose, anchorRef]);

  if (!mounted) return null;

  return (
    <div
      role="dialog"
      aria-label={label}
      className={`fixed inset-x-3 top-[4.25rem] z-30 origin-top overflow-hidden rounded-3xl bg-surface shadow-card ring-1 ring-text/[0.06] transition-all duration-150 ease-out sm:absolute sm:inset-x-auto sm:top-full sm:mt-2 ${
        align === "right" ? "sm:right-0 sm:origin-top-right" : "sm:left-0 sm:origin-top-left"
      } ${widthClass} ${entered ? "translate-y-0 scale-100 opacity-100" : "-translate-y-1 scale-95 opacity-0"} ${className}`}
    >
      {children}
    </div>
  );
}
