// Primary/Secondary buttons per design.md Section 4 (Buttons): pill shape,
// generous padding, solid primary fill vs. outlined secondary.
// "social" is the Google/Apple pill treatment used on Login + Registration.
export default function Button({
  children,
  variant = "primary",
  fullWidth = true,
  shape = "pill",
  className = "",
  type = "button",
  ...props
}) {
  // Redesign: every button is a full pill; `shape="rect"` is kept as an accepted
  // prop for existing callers but no longer changes the radius.
  const radius = shape === "rect" ? "rounded-full" : "rounded-full";
  const base = `inline-flex items-center justify-center gap-2 ${radius} px-6 py-3 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:hover:scale-100 disabled:hover:shadow-none active:scale-[0.97] ${
    fullWidth ? "w-full" : ""
  }`;

  // primary/secondary/tertiary tiers per design.md's buttons section, richer
  // per the 2026 elevation pass: primary is a subtle two-stop gradient fill
  // with hover lift + brand-tinted glow, secondary keeps the outlined
  // treatment but with a filled hover state, tertiary is a quiet text-only
  // affordance for lower-emphasis actions. "social" is unchanged (Google/
  // Apple pill on Login/Registration).
  const variants = {
    primary:
      "bg-primary text-white shadow-soft hover:-translate-y-0.5 hover:scale-[1.02] hover:shadow-glow-primary disabled:translate-y-0 disabled:bg-primary/35 disabled:text-white/80 disabled:shadow-none",
    secondary:
      "border border-primary/25 bg-surface text-text hover:-translate-y-0.5 hover:scale-[1.02] hover:border-primary/60 hover:shadow-card disabled:border-primary/15 disabled:text-text/35 disabled:hover:translate-y-0 disabled:hover:scale-100 disabled:hover:border-primary/15",
    tertiary:
      "text-primary hover:bg-primary/[0.07] disabled:text-primary/35",
    social:
      "border border-text/15 bg-surface text-text hover:-translate-y-0.5 hover:shadow-soft disabled:opacity-50",
  };

  return (
    <button
      type={type}
      className={`${base} ${variants[variant] ?? variants.primary} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
