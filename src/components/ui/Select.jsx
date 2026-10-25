import { Children, isValidElement, useEffect, useId, useMemo, useRef, useState } from "react";
import { CheckIcon, ChevronDownIcon } from "./icons";

// Shared dropdown — a custom, themed listbox instead of the browser's native
// <select> popup. The API is deliberately the same as before so every
// existing caller keeps working untouched: pass `<option>` children (or
// `<optgroup>`s), `value` / `defaultValue`, `onChange` (receives an
// event-like `{ target: { value, name } }`), `onBlur`, `disabled`, `name`,
// `className` (styles the trigger — each caller keeps its own sizing/pill
// vs. rect look) and `wrapperClassName` (inline-auto width by default; pass
// "block w-full" for full width). A visually hidden native <select> mirrors
// the value so forms/validation/`name` keep behaving as before.
//
// Colors come from the design tokens (--color-primary / --color-text /
// --color-bg), so it follows whichever portal/theme it renders in.
function collectOptions(children, out = []) {
  Children.forEach(children, (child) => {
    if (!isValidElement(child)) return;
    if (child.type === "option") {
      const label = Children.toArray(child.props.children).join("");
      out.push({ value: String(child.props.value ?? label), label, disabled: !!child.props.disabled });
    } else if (child.props?.children) {
      collectOptions(child.props.children, out);
    }
  });
  return out;
}

export default function Select({
  className = "",
  wrapperClassName = "inline-block",
  chevronClassName = "",
  disabled,
  children,
  value,
  defaultValue,
  onChange,
  onBlur,
  name,
  id,
  required,
  ...rest
}) {
  const options = useMemo(() => collectOptions(children), [children]);
  const controlled = value !== undefined;
  const [inner, setInner] = useState(String(defaultValue ?? options[0]?.value ?? ""));
  const current = String(controlled ? value ?? "" : inner);
  const selected = options.find((o) => o.value === current);
  // An option whose value is "" is the placeholder — shown muted in the trigger.
  const isPlaceholder = !selected || selected.value === "";

  const [open, setOpen] = useState(false);
  const [dropUp, setDropUp] = useState(false);
  const [active, setActive] = useState(-1);
  const rootRef = useRef(null);
  const listRef = useRef(null);
  const listId = useId();

  const close = () => {
    setOpen(false);
    setActive(-1);
  };

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (rootRef.current && !rootRef.current.contains(e.target)) {
        close();
        onBlur?.({ target: { name, value: current } });
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  });

  useEffect(() => {
    if (open && active >= 0) listRef.current?.children[active]?.scrollIntoView({ block: "nearest" });
  }, [open, active]);

  const openList = () => {
    if (disabled) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (rect) setDropUp(window.innerHeight - rect.bottom < 280 && rect.top > 280);
    setActive(Math.max(0, options.findIndex((o) => o.value === current)));
    setOpen(true);
  };

  const choose = (opt) => {
    if (opt.disabled) return;
    if (!controlled) setInner(opt.value);
    onChange?.({ target: { value: opt.value, name }, currentTarget: { value: opt.value, name } });
    close();
  };

  const move = (dir) => {
    let i = active;
    for (let n = 0; n < options.length; n += 1) {
      i = (i + dir + options.length) % options.length;
      if (!options[i].disabled) break;
    }
    setActive(i);
  };

  const onKeyDown = (e) => {
    if (disabled) return;
    if (!open) {
      if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Home") { e.preventDefault(); setActive(0); }
    else if (e.key === "End") { e.preventDefault(); setActive(options.length - 1); }
    else if (e.key === "Enter" || e.key === " ") { e.preventDefault(); if (options[active]) choose(options[active]); }
    else if (e.key === "Escape") { e.preventDefault(); close(); }
    else if (e.key === "Tab") close();
    else if (e.key.length === 1) {
      const idx = options.findIndex((o, i) => i > active && o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      const wrap = idx >= 0 ? idx : options.findIndex((o) => o.label.toLowerCase().startsWith(e.key.toLowerCase()));
      if (wrap >= 0) setActive(wrap);
    }
  };

  return (
    <span ref={rootRef} className={`relative ${wrapperClassName}`}>
      <button
        type="button"
        id={id}
        disabled={disabled}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        onClick={() => (open ? close() : openList())}
        onKeyDown={onKeyDown}
        onBlur={(e) => {
          if (!rootRef.current?.contains(e.relatedTarget)) onBlur?.({ target: { name, value: current } });
        }}
        className={`flex items-center text-left outline-none transition-shadow duration-150 focus-visible:ring-2 focus-visible:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...rest}
      >
        <span className={`block min-w-0 flex-1 truncate ${isPlaceholder ? "text-text/45" : ""}`}>
          {selected ? selected.label : ""}
        </span>
      </button>
      <ChevronDownIcon
        className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text/50 transition-transform duration-200 ease-out ${open ? "rotate-180" : ""} ${chevronClassName}`}
      />

      {open && (
        <ul
          ref={listRef}
          id={listId}
          role="listbox"
          className={`absolute left-0 z-50 max-h-64 min-w-full overflow-auto rounded-2xl bg-white p-1.5 text-sm text-text shadow-[0_20px_50px_rgba(15,17,21,0.18)] ring-1 ring-text/10 ${
            dropUp ? "bottom-full mb-2" : "top-full mt-2"
          }`}
        >
          {options.map((opt, i) => {
            const isSel = opt.value === current;
            return (
              <li
                key={opt.value + i}
                role="option"
                aria-selected={isSel}
                aria-disabled={opt.disabled || undefined}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => choose(opt)}
                className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl px-3 py-2.5 transition-colors duration-100 ${
                  opt.disabled ? "cursor-not-allowed opacity-40" : ""
                } ${i === active ? "bg-primary/10" : ""} ${isSel ? "font-semibold text-primary" : ""} ${
                  opt.value === "" && !isSel ? "text-text/50" : ""
                }`}
              >
                <span className="truncate">{opt.label}</span>
                {isSel && <CheckIcon className="h-4 w-4 shrink-0" />}
              </li>
            );
          })}
        </ul>
      )}

      {/* Hidden native mirror — keeps form submission / `name` / required working. */}
      <select
        tabIndex={-1}
        aria-hidden="true"
        name={name}
        required={required}
        disabled={disabled}
        value={current}
        onChange={() => {}}
        className="pointer-events-none absolute inset-0 h-full w-full opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </span>
  );
}
