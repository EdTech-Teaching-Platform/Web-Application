// Shared section-background wrapper — applies the alternating background
// rhythm from design.md (white / cream / soft pastel / brand burgundy)
// consistently across every student-facing page instead of each page
// re-deciding its own section backgrounds. Reuses the existing color
// tokens only (--color-bg, --color-accent-*, --color-primary) — no new
// hex values.
//
// tone:
//   "white"  -> bg-white               (course grids, tables, testimonials, FAQ)
//   "beige"  -> bg-bg                  (hero/intro/storytelling/transitions)
//   "teal" | "lilac" | "peach" | "sky" -> low-opacity pastel tint (feature highlights)
//   "brand"  -> bg-primary text-white  (strong CTAs)
export default function Section({
  as: Tag = "section",
  tone = "beige",
  id,
  className = "",
  containerClassName = "",
  children,
}) {
  const tones = {
    white: "bg-white",
    beige: "bg-bg",
    teal: "bg-accent-teal/10",
    lilac: "bg-accent-lilac/10",
    peach: "bg-accent-peach/10",
    sky: "bg-accent-sky/10",
    brand: "bg-primary text-white",
  };

  return (
    <Tag id={id} className={`${tones[tone] ?? tones.beige} py-12 sm:py-14 ${className}`}>
      <div className={`mx-auto max-w-6xl px-6 ${containerClassName}`}>{children}</div>
    </Tag>
  );
}
