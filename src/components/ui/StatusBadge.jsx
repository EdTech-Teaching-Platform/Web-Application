// StatusBadge — design.md Section 4 (Badges): uses ONLY the three status
// tokens (success/warning/danger), never a rotation color, so status stays
// visually distinct from decorative color-blocking. Small pill, used inside
// ListRow (deadlines, orders, notifications) and elsewhere status needs a
// compact indicator.
const VARIANTS = {
  success: "bg-success/15 text-success",
  warning: "bg-warning/15 text-warning",
  danger: "bg-danger/15 text-danger",
  neutral: "bg-text/10 text-text/60",
};

export default function StatusBadge({ status = "neutral", children }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium ${
        VARIANTS[status] ?? VARIANTS.neutral
      }`}
    >
      {children}
    </span>
  );
}
