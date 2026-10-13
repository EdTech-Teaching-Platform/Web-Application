// IconBadge — small circular pastel-tinted holder for a feature / category /
// stat / type icon. One shared treatment so each distinct kind of thing
// (course category, lesson type, session type, notification category) gets
// its own tone consistently. Dark ink on a light tint for contrast; the
// "maroon" tone is the only filled-deep variant (white icon on maroon).
//
// Usage: <IconBadge icon={VideoIcon} tone="blue" size="md" />
// `icon` may be a component (rendered with no props) or an element.
export const ICON_TONES = {
  maroon: "bg-primary/10 text-primary",
  maroonSolid: "bg-primary text-white",
  blue: "bg-pastel-blue text-pastel-blue-ink",
  sage: "bg-pastel-sage text-pastel-sage-ink",
  lavender: "bg-pastel-lavender text-pastel-lavender-ink",
  orange: "bg-pastel-orange text-pastel-orange-ink",
  pink: "bg-pastel-pink text-pastel-pink-ink",
};

const HASH_TONES = ["blue", "sage", "lavender", "orange", "pink"];

// toneForKey — deterministic tone for a free-text category/type string
// (e.g. a session type) so the same kind of thing always gets the same
// pastel without a hand-maintained map.
export function toneForKey(key = "") {
  let h = 0;
  for (let i = 0; i < key.length; i += 1) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return HASH_TONES[h % HASH_TONES.length];
}

const SIZES = {
  xs: "h-7 w-7 [&_svg]:h-3.5 [&_svg]:w-3.5",
  sm: "h-9 w-9 [&_svg]:h-4 [&_svg]:w-4",
  md: "h-11 w-11",
  lg: "h-14 w-14 [&_svg]:h-6 [&_svg]:w-6",
};

export default function IconBadge({ icon: Icon, children, tone = "maroon", size = "md", className = "" }) {
  const toneClass = ICON_TONES[tone] ?? ICON_TONES.maroon;
  const sizeClass = SIZES[size] ?? SIZES.md;
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${sizeClass} ${toneClass} ${className}`}
    >
      {Icon ? <Icon /> : children}
    </span>
  );
}
