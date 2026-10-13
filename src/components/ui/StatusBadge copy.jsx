import { CheckIcon, ClockIcon, XIcon } from "./icons";

// StatusBadge — design.md Section 4: uses ONLY the three status tokens
// (success/warning/danger), never a rotation color, plus a neutral/gray
// treatment (text/opacity, same muted style ProgressSteps already uses for
// an "upcoming" step) for lifecycle states that aren't a status per se
// (Draft, Archived). An optional `icon` override lets callers like the
// course lifecycle badges use a state-specific icon (pencil, flag, archive
// box) without forking a second badge component.
//
// Usage:
//   <StatusBadge status="success">Verified</StatusBadge>
//   <StatusBadge status="warning">Pending review</StatusBadge>
//   <StatusBadge status="danger">Rejected</StatusBadge>
//   <StatusBadge status="neutral" icon={PencilIcon}>Draft</StatusBadge>
// Soft-tinted pill per status token: a translucent fill of the status
// color plus a subtle matching ring, icon and text in the full-strength
// color. Kept as light tints (never solid fills) so status text stays
// legible (dark-on-light) everywhere it's used.
const STATUS_STYLES = {
  // Redesign: soft pastel pills from the shared pastel set (dark ink on tint).
  success: { bg: "bg-pastel-sage", ring: "ring-pastel-sage-ink/10", text: "text-pastel-sage-ink", Icon: CheckIcon },
  warning: { bg: "bg-pastel-orange", ring: "ring-pastel-orange-ink/10", text: "text-pastel-orange-ink", Icon: ClockIcon },
  danger: { bg: "bg-pastel-pink", ring: "ring-pastel-pink-ink/10", text: "text-pastel-pink-ink", Icon: XIcon },
  neutral: { bg: "bg-pastel-lavender/70", ring: "ring-pastel-lavender-ink/10", text: "text-pastel-lavender-ink", Icon: null },
};

export default function StatusBadge({ status = "success", children, showIcon = true, icon, size = "md", className = "" }) {
  const { bg, ring, text, Icon: defaultIcon } = STATUS_STYLES[status] ?? STATUS_STYLES.success;
  const Icon = icon ?? defaultIcon;
  const sizing = size === "sm" ? "px-2.5 py-1 text-[11px]" : "px-3 py-1 text-xs";

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full font-semibold ring-1 ${sizing} ${bg} ${ring} ${text} ${className}`}
    >
      {showIcon && Icon && <Icon className="h-3 w-3" />}
      {children}
    </span>
  );
}
