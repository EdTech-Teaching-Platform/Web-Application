import { useState } from "react";
import { XIcon } from "./icons";

// ChipInput — type + Enter (or comma) to add a removable pill, Backspace on
// an empty field removes the last one. Generic tag/keyword capture, so it
// belongs in shared ui rather than Course Builder alone — Registration's
// "specializations" and any future search-filter UI can reuse it instead of
// hand-rolling another pill input.
//
// Usage:
//   <ChipInput label="Tags" values={tags} onChange={setTags} placeholder="e.g. react, ui-design" />
export default function ChipInput({
  label,
  helperText,
  values = [],
  onChange,
  placeholder = "Type and press Enter…",
  max,
  className = "",
}) {
  const [draft, setDraft] = useState("");

  function commit(raw) {
    const value = raw.trim();
    if (!value) return;
    if (values.some((v) => v.toLowerCase() === value.toLowerCase())) {
      setDraft("");
      return;
    }
    if (max && values.length >= max) return;
    onChange([...values, value]);
    setDraft("");
  }

  function handleKeyDown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit(draft);
    } else if (e.key === "Backspace" && !draft && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  }

  return (
    <div className={className}>
      {label && <span className="mb-1.5 block text-sm font-medium text-text">{label}</span>}
      <div className="flex min-h-[48px] flex-wrap items-center gap-2 rounded-2xl border border-text/15 bg-bg px-3 py-2 transition-colors duration-150 focus-within:border-primary focus-within:ring-2 focus-within:ring-primary/15">
        {values.map((v) => (
          <span
            key={v}
            className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary"
          >
            {v}
            <button
              type="button"
              onClick={() => onChange(values.filter((x) => x !== v))}
              aria-label={`Remove ${v}`}
              className="text-primary/60 hover:text-primary"
            >
              <XIcon className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={handleKeyDown}
          onBlur={() => commit(draft)}
          placeholder={values.length === 0 ? placeholder : ""}
          className="min-w-[120px] flex-1 border-none bg-transparent px-1 py-1 text-sm text-text outline-none placeholder:text-muted"
        />
      </div>
      {helperText && <span className="mt-1.5 block text-xs text-text/45">{helperText}</span>}
      {max && (
        <span className="mt-1 block text-right text-[11px] text-text/35">
          {values.length}/{max}
        </span>
      )}
    </div>
  );
}
