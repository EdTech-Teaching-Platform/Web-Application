// AdminSelect — drop-in replacement for a native <select> across the admin
// portal. It still renders the real <select> (so every existing CSS rule,
// layout, label and `aria-*` prop keeps working) but swaps the browser's
// plain popup for a styled menu. Pass the same props/children you would to
// <select>; onChange receives an event-like object with `target.value`.
// On touch devices the native picker is kept.
import { Children, isValidElement, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconCheck } from "./icons";
import "./AdminSelect.css";

function textOf(node) {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement(node)) return textOf(node.props.children);
  return "";
}

function collectOptions(children, out = []) {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    if (c.type === "option") {
      const label = textOf(c.props.children);
      out.push({
        value: c.props.value !== undefined ? String(c.props.value) : label,
        label,
        disabled: !!c.props.disabled,
        hidden: !!c.props.hidden,
      });
    } else if (c.props && c.props.children) {
      collectOptions(c.props.children, out); // Fragment / optgroup
    }
  });
  return out;
}

const isCoarsePointer = () =>
  typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(pointer: coarse)").matches;

export default function AdminSelect({ children, onChange, onMouseDown, onKeyDown, onBlur, className, ...rest }) {
  const selectRef = useRef(null);
  const menuRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const [pos, setPos] = useState(null);

  const value = rest.value == null ? "" : String(rest.value);
  const getOptions = () => collectOptions(children).filter((o) => !o.hidden);

  const openMenu = () => {
    if (rest.disabled || !selectRef.current) return;
    const rect = selectRef.current.getBoundingClientRect();
    const below = window.innerHeight - rect.bottom - 12;
    const above = rect.top - 12;
    const flip = below < 200 && above > below;
    setPos({
      left: rect.left,
      width: rect.width,
      maxHeight: Math.max(120, Math.min(300, flip ? above : below)),
      ...(flip ? { bottom: window.innerHeight - rect.top + 6 } : { top: rect.bottom + 6 }),
    });
    setActive(Math.max(0, getOptions().findIndex((o) => o.value === value)));
    setOpen(true);
  };

  const choose = (opt) => {
    if (!opt || opt.disabled) return;
    setOpen(false);
    if (opt.value !== value && onChange) {
      const target = { value: opt.value, name: rest.name, id: rest.id };
      onChange({ target, currentTarget: target, preventDefault() {}, stopPropagation() {} });
    }
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (menuRef.current && menuRef.current.contains(e.target)) {
        // Keep focus on the select and stop outer click-outside handlers
        // (filter popovers etc.) from closing when a menu item is pressed.
        e.stopPropagation();
        e.preventDefault();
        return;
      }
      if (e.target === selectRef.current) return;
      setOpen(false);
    };
    const onScroll = (e) => { if (!menuRef.current || !menuRef.current.contains(e.target)) setOpen(false); };
    const close = () => setOpen(false);
    document.addEventListener("mousedown", onDown, true);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("mousedown", onDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  useEffect(() => {
    if (!open || !menuRef.current) return;
    const el = menuRef.current.querySelector(".is-active");
    if (el && el.scrollIntoView) el.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const handleMouseDown = (e) => {
    if (onMouseDown) onMouseDown(e);
    if (e.defaultPrevented || rest.disabled || e.button !== 0 || isCoarsePointer()) return;
    e.preventDefault(); // suppress the native popup
    if (selectRef.current) selectRef.current.focus();
    if (open) setOpen(false); else openMenu();
  };

  const handleKeyDown = (e) => {
    if (onKeyDown) onKeyDown(e);
    if (e.defaultPrevented || rest.disabled || isCoarsePointer()) return;
    if (!open) {
      if (e.key === "Enter" || e.key === " " || ((e.key === "ArrowDown" || e.key === "ArrowUp") && e.altKey)) {
        e.preventDefault();
        openMenu();
      }
      return; // plain arrows/typeahead keep native behaviour
    }
    const opts = getOptions();
    if (e.key === "Escape") { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown") { e.preventDefault(); setActive((i) => Math.min(opts.length - 1, i + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((i) => Math.max(0, i - 1)); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(opts.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); choose(opts[active]); }
    else if (e.key === "Tab") setOpen(false);
  };

  const handleBlur = (e) => {
    if (onBlur) onBlur(e);
    setOpen(false);
  };

  const options = open ? getOptions() : [];

  return (
    <>
      <select
        {...rest}
        ref={selectRef}
        className={`${className ? `${className} ` : ""}ul-asel`}
        onChange={onChange}
        onMouseDown={handleMouseDown}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
      >
        {children}
      </select>
      {open && pos && createPortal(
        <ul ref={menuRef} className="ul-asel__menu" role="listbox" style={pos}>
          {options.map((opt, i) => (
            <li
              key={`${opt.value}-${i}`}
              role="option"
              aria-selected={opt.value === value}
              aria-disabled={opt.disabled || undefined}
              className={`ul-asel__opt${opt.value === value ? " is-selected" : ""}${i === active ? " is-active" : ""}${opt.disabled ? " is-disabled" : ""}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(opt)}
            >
              <span>{opt.label || " "}</span>
              {opt.value === value && <IconCheck size={14} />}
            </li>
          ))}
        </ul>,
        document.body,
      )}
    </>
  );
}
