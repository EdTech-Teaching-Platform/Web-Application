import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { computeMenuPosition } from "./menuPosition";

// The one row "⋮" menu for tables in every portal.
//   <RowActionsMenu items={[{label, onClick, danger, disabled, icon}, cond && {...}]} />
// Falsy items are skipped, so callers build the list from the row's state
// (a published test gets Unpublish, not Publish). With no items it renders
// nothing.
// The menu renders in a portal on <body> with fixed positioning
// (computeMenuPosition: flips above / below and left / right to stay on
// screen), so a scrolling table can never clip it or grow a scrollbar
// instead. It follows the trigger on scroll / resize, closes on an outside
// click, Escape (focus returns to the trigger), Tab or picking an item, and
// supports Arrow keys, Home and End. Clicks don't reach a clickable row.
export default function RowActionsMenu({ items, label = "More actions", triggerClassName = "ul-rowmenu__trigger", icon }) {
  const visible = (items || []).filter(Boolean);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
  const trigger = useRef(null);
  const menu = useRef(null);
  const id = useId();

  const place = useCallback(() => {
    if (!trigger.current || !menu.current) return;
    const r = trigger.current.getBoundingClientRect();
    setPos(computeMenuPosition(
      { top: r.top, bottom: r.bottom, left: r.left, right: r.right },
      { width: menu.current.offsetWidth || 200, height: menu.current.offsetHeight || 160 },
      { width: window.innerWidth, height: window.innerHeight },
    ));
  }, []);

  const close = useCallback((refocus) => {
    setOpen(false);
    setPos(null);
    if (refocus) trigger.current?.focus();
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    place();
    menu.current?.querySelector("[role=menuitem]:not(:disabled)")?.focus();
  }, [open, place]);

  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (menu.current?.contains(e.target) || trigger.current?.contains(e.target)) return;
      close(false);
    };
    const onKey = (e) => { if (e.key === "Escape") { e.stopPropagation(); close(true); } };
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("touchstart", onPointer);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("touchstart", onPointer);
      document.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open, place, close]);

  if (!visible.length) return null;

  const onMenuKey = (e) => {
    const list = [...(menu.current?.querySelectorAll("[role=menuitem]:not(:disabled)") || [])];
    if (!list.length) return;
    const at = list.indexOf(document.activeElement);
    const go = (i) => { e.preventDefault(); list[(i + list.length) % list.length].focus(); };
    if (e.key === "ArrowDown") go(at + 1);
    else if (e.key === "ArrowUp") go(at - 1);
    else if (e.key === "Home") go(0);
    else if (e.key === "End") go(list.length - 1);
    else if (e.key === "Tab") close(false);
  };

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className={triggerClassName}
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(e) => { e.stopPropagation(); if (open) close(false); else setOpen(true); }}
        onKeyDown={(e) => { if (!open && e.key === "ArrowDown") { e.preventDefault(); setOpen(true); } }}
      >
        {icon || (
          <svg viewBox="0 0 20 20" width="16" height="16" fill="currentColor" aria-hidden="true">
            <circle cx="10" cy="4.5" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="10" cy="15.5" r="1.6" />
          </svg>
        )}
      </button>
      {open && createPortal(
        <div
          ref={menu}
          id={id}
          role="menu"
          aria-label={label}
          className="ul-rowmenu"
          data-placement={pos?.placement}
          style={pos ? { top: pos.top, left: pos.left } : { top: 0, left: 0, visibility: "hidden" }}
          onClick={(e) => e.stopPropagation()}
          onKeyDown={onMenuKey}
        >
          {visible.map((it) => (
            <button
              key={it.key || it.label}
              type="button"
              role="menuitem"
              className={`ul-rowmenu__item${it.danger ? " is-danger" : ""}`}
              disabled={!!it.disabled}
              title={typeof it.disabled === "string" ? it.disabled : undefined}
              onClick={() => { close(false); it.onClick?.(); }}
            >
              {it.icon}
              {it.label}
            </button>
          ))}
        </div>,
        document.body,
      )}
    </>
  );
}
