// Chip / FilterPill — one shared component for both uses named in design.md
// Section 4 (Pills & Chips): the role selector on Registration and the
// Password/One-Time Code method switcher on Login are the same visual
// language (active = filled primary, inactive = outlined primary), just
// different data. Don't fork a separate component for either use.
const TONES = {
  primary: {
    on: "border-primary bg-primary text-white",
    off: "border-primary bg-bg text-primary hover:bg-primary/5",
  },
  // Blue landing / test-series theme (--lp-* variables).
  blue: {
    on: "border-(--lp-blue-deep) bg-(--lp-blue-deep) text-white",
    off: "border-(--lp-blue) bg-white text-(--lp-blue-deep) hover:bg-(--lp-blue-soft)",
  },
};

export default function Chip({ active, tone = "primary", children, className = "", ...props }) {
  const t = TONES[tone] ?? TONES.primary;
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-150 ${
        active ? t.on : t.off
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
