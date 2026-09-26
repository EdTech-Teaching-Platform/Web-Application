// Primary/Secondary buttons per design.md Section 4 (Buttons): pill shape,
// generous padding, solid primary fill vs. outlined secondary.
// "social" is the Google/Apple pill treatment used on Login + Registration.
//
// `as`: lets a nav/CTA render as react-router's <Link> (pass `as={Link}
// to="/register"`) instead of a native <button> — same pill styling
// either way, so a link-that-looks-like-a-button doesn't need its own
// parallel component. Defaults to "button", unchanged from before.
//
// Hover feedback is a small lift + soft shadow (`transform`/`box-shadow`
// only, per design.md's motion rule) layered on top of each variant's
// existing color shift, so every button in the app gets it for free from
// this one place. Disabled buttons opt out of the lift via
// `disabled:translate-y-0 disabled:shadow-none` so a non-interactive
// button never looks like it's inviting a click.
export default function Button({
  children,
  variant = "primary",
  fullWidth = true,
  className = "",
  type = "button",
  as: Component = "button",
  ...props
}) {
  const base = `inline-flex items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-semibold transition-all duration-150 ease-out hover:-translate-y-0.5 hover:shadow-lg active:translate-y-0 active:shadow-none disabled:cursor-not-allowed disabled:pointer-events-none disabled:translate-y-0 disabled:shadow-none ${
    fullWidth ? "w-full" : ""
  }`;

  const variants = {
    primary:
      "bg-primary text-white hover:bg-primary/90 disabled:bg-primary/35 disabled:text-white/80",
    secondary:
      "border border-primary bg-bg text-primary hover:bg-primary/5 disabled:border-primary/30 disabled:text-primary/40",
    social:
      "border border-text/15 bg-bg text-text hover:bg-text/5 disabled:opacity-50",
    // "inverse" — white/cream fill + primary text, for a CTA sitting on a
    // solid --color-primary surface (e.g. the closing CTA banner), per
    // design.md: a solid maroon button on a solid maroon banner wouldn't
    // read. This is its own variant rather than a className override on
    // "primary" because plain Tailwind utility classes don't win a
    // cascade fight by JSX string order — overriding bg-primary/text-white
    // with bg-white/text-primary via className was landing as invisible
    // white-text-on-white in practice.
    inverse:
      "bg-white text-primary hover:bg-white/90 disabled:bg-white/20 disabled:text-white/50 disabled:hover:bg-white/20",
  };

  const typeProp = Component === "button" ? { type } : {};

  return (
    <Component
      className={`${base} ${variants[variant] ?? variants.primary} ${className}`}
      {...typeProp}
      {...props}
    >
      {children}
    </Component>
  );
}
