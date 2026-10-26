// Landing-page theme (2026 redesign) — a self-contained palette exposed as
// CSS custom properties, set on the landing wrapper and on PublicLayout
// when the visitor is on "/". Scoped on purpose: the rest of the product
// (student/educator/admin portals, other public pages) keeps the
// design.md tokens in src/index.css untouched.
//
// Usage in Tailwind v4: `bg-(--lp-blue)`, `text-(--lp-ink)`,
// `border-(--lp-line)`, `font-(family-name:--lp-font)`.
export const LANDING_THEME_VARS = {
  "--lp-ink": "#0f1115",
  "--lp-ink-soft": "#1b1f27",
  "--lp-blue": "#3d7bf7",
  "--lp-blue-deep": "#2557d6",
  "--lp-blue-soft": "#e3ecff",
  "--lp-blue-tint": "#f1f6ff",
  "--lp-yellow": "#ffd84d",
  "--lp-yellow-soft": "#fff3bf",
  "--lp-grey": "#f5f6f8",
  "--lp-line": "#e6e8ee",
  "--lp-muted": "#5d6472",
  // Shared components (Select, Chip, Button, Accordion...) draw from the
  // design.md "primary" token, which is maroon. Inside the landing / public
  // pages it resolves to the theme blue instead, so no maroon leaks in.
  // (Same value the student portal and auth pages already use.)
  "--color-primary": "#2557d6",
  "--color-danger": "#e5484d",
  "--lp-font": "'Bricolage Grotesque', 'Plus Jakarta Sans', ui-sans-serif, system-ui, sans-serif",
};
