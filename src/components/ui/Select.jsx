import { ChevronDownIcon } from "./icons";

// Shared dropdown wrapper — every existing `<select>` in the app rolls its
// own border/padding/pill-vs-rect styling via `className` (there's no
// single visual language to unify beyond the control itself), so this stays
// a thin wrapper: it guarantees `appearance-none` (killing the native
// browser arrow that was rendering alongside/instead of a manually placed
// chevron — the double/misaligned-arrow bug) and renders exactly one
// right-aligned, vertically-centered chevron every time. `wrapperClassName`
// controls whether the control is inline-auto-width (default, for compact
// filter/sort pills) or block/full-width (pass "block w-full").
export default function Select({
  className = "",
  wrapperClassName = "inline-block",
  chevronClassName = "",
  disabled,
  ...props
}) {
  return (
    <span className={`relative ${wrapperClassName}`}>
      <select
        disabled={disabled}
        className={`appearance-none outline-none transition-shadow duration-150 focus:shadow-soft focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:opacity-50 ${className}`}
        {...props}
      />
      <ChevronDownIcon
        className={`pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted ${chevronClassName}`}
      />
    </span>
  );
}
