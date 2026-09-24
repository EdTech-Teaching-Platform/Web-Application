// Chip / FilterPill — one shared component for both uses named in design.md
// Section 4 (Pills & Chips): the role selector on Registration and the
// Password/One-Time Code method switcher on Login are the same visual
// language (active = filled primary, inactive = outlined primary), just
// different data. Don't fork a separate component for either use.
export default function Chip({ active, children, className = "", ...props }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      className={`rounded-full border px-5 py-2 text-sm font-medium transition-colors duration-150 ${
        active
          ? "border-primary bg-primary text-white"
          : "border-primary bg-bg text-primary hover:bg-primary/5"
      } ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
