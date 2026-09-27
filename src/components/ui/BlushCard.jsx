// BlushCard — design.md Section 4: soft pink tint, a fifth quieter surface
// reserved specifically for social-proof content (testimonials/reviews).
// Uses the --color-blush token already added in index.css for the
// Onboarding form-panel treatment — same token, documented scope extended
// to testimonials here per design.md.
export default function BlushCard({ children, className = "" }) {
  return (
    <div className={`rounded-2xl bg-blush p-5 text-text ${className}`}>{children}</div>
  );
}
