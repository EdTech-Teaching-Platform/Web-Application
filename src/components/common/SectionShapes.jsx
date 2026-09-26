// Per-section decorative shapes — replaces the earlier single fixed
// AmbientPortalBackdrop layer (which could never read as visible against
// solid white sections). Each <SectionShapes variant="..."/> renders a
// small scattered set of clean geometric shapes (circle, ring/donut,
// blob, dot, plus, diagonal stripe) using the existing pastel + primary
// tokens at 15-30% solid opacity — visible, not a faint texture — and is
// meant to be dropped inside a `position: relative` section as an
// absolutely-positioned, non-interactive first child:
//
//   <section className="relative ...">
//     <SectionShapes variant="hero" />
//     <div className="relative z-10">...real content...</div>
//   </section>
//
// Fully static (no animation/transition), pointer-events-none, aria-hidden,
// and z-0 so it always sits behind the section's real content.
const TOKENS = {
  teal: "var(--color-accent-teal)",
  lilac: "var(--color-accent-lilac)",
  peach: "var(--color-accent-peach)",
  sky: "var(--color-accent-sky)",
  primary: "var(--color-primary)",
};

function Circle({ top, left, right, bottom, size, color, opacity = 0.2 }) {
  return (
    <span
      className="absolute rounded-full"
      style={{ top, left, right, bottom, width: size, height: size, backgroundColor: TOKENS[color], opacity }}
    />
  );
}

function Ring({ top, left, right, bottom, size, color, opacity = 0.28 }) {
  return (
    <span
      className="absolute rounded-full"
      style={{ top, left, right, bottom, width: size, height: size, border: `${Math.max(4, size / 12)}px solid ${TOKENS[color]}`, opacity }}
    />
  );
}

function Blob({ top, left, right, bottom, size, color, opacity = 0.18 }) {
  return (
    <span
      className="absolute"
      style={{
        top,
        left,
        right,
        bottom,
        width: size,
        height: size * 0.8,
        backgroundColor: TOKENS[color],
        opacity,
        borderRadius: "42% 58% 63% 37% / 41% 44% 56% 59%",
      }}
    />
  );
}

function Dot({ top, left, right, bottom, size = 10, color, opacity = 0.3 }) {
  return (
    <span
      className="absolute rounded-full"
      style={{ top, left, right, bottom, width: size, height: size, backgroundColor: TOKENS[color], opacity }}
    />
  );
}

function Plus({ top, left, right, bottom, size = 18, color, opacity = 0.3 }) {
  const thickness = Math.max(2, size / 7);
  return (
    <span className="absolute" style={{ top, left, right, bottom, width: size, height: size, opacity }} aria-hidden="true">
      <span className="absolute rounded-full" style={{ top: "50%", left: 0, right: 0, height: thickness, transform: "translateY(-50%)", backgroundColor: TOKENS[color] }} />
      <span className="absolute rounded-full" style={{ left: "50%", top: 0, bottom: 0, width: thickness, transform: "translateX(-50%)", backgroundColor: TOKENS[color] }} />
    </span>
  );
}

function Stripe({ top, left, right, bottom, width = 90, color, opacity = 0.16 }) {
  return (
    <span
      className="absolute origin-center -rotate-[24deg]"
      style={{ top, left, right, bottom, width, height: Math.max(10, width / 6), backgroundColor: TOKENS[color], opacity, borderRadius: 999 }}
    />
  );
}

// One scattered arrangement per named variant — different section
// "families" get a visually distinct set/placement so the whole page
// doesn't look like the same sticker repeated everywhere.
const VARIANTS = {
  hero: [
    { Cmp: Circle, props: { top: "-40px", right: "6%", size: 140, color: "peach", opacity: 0.16 } },
    { Cmp: Ring, props: { bottom: "10%", left: "2%", size: 90, color: "teal", opacity: 0.24 } },
    { Cmp: Dot, props: { top: "18%", left: "38%", size: 12, color: "primary", opacity: 0.25 } },
    { Cmp: Plus, props: { top: "8%", right: "28%", size: 18, color: "sky", opacity: 0.28 } },
    { Cmp: Blob, props: { bottom: "-30px", right: "22%", size: 90, color: "lilac", opacity: 0.14 } },
    { Cmp: Dot, props: { bottom: "6%", left: "20%", size: 9, color: "teal", opacity: 0.22 } },
  ],
  goals: [
    { Cmp: Blob, props: { top: "-30px", left: "8%", size: 130, color: "lilac", opacity: 0.16 } },
    { Cmp: Plus, props: { bottom: "12%", right: "5%", size: 22, color: "teal", opacity: 0.3 } },
    { Cmp: Ring, props: { top: "12%", right: "16%", size: 70, color: "peach", opacity: 0.22 } },
    { Cmp: Dot, props: { bottom: "8%", left: "24%", size: 10, color: "sky", opacity: 0.26 } },
    { Cmp: Circle, props: { bottom: "-26px", right: "30%", size: 60, color: "primary", opacity: 0.14 } },
  ],
  categories: [
    { Cmp: Circle, props: { bottom: "-36px", right: "10%", size: 110, color: "sky", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "20%", right: "30%", size: 10, color: "peach", opacity: 0.3 } },
    { Cmp: Plus, props: { top: "10%", left: "10%", size: 18, color: "teal", opacity: 0.26 } },
    { Cmp: Ring, props: { bottom: "10%", left: "4%", size: 66, color: "lilac", opacity: 0.2 } },
    { Cmp: Dot, props: { top: "8%", right: "6%", size: 9, color: "primary", opacity: 0.22 } },
  ],
  courses: [
    { Cmp: Ring, props: { top: "6%", right: "4%", size: 100, color: "peach", opacity: 0.22 } },
    { Cmp: Stripe, props: { bottom: "8%", left: "-20px", width: 110, color: "teal", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "14%", left: "8%", size: 10, color: "sky", opacity: 0.26 } },
    { Cmp: Plus, props: { bottom: "14%", right: "20%", size: 18, color: "lilac", opacity: 0.28 } },
    { Cmp: Circle, props: { bottom: "-30px", right: "38%", size: 70, color: "primary", opacity: 0.12 } },
  ],
  paths: [
    { Cmp: Blob, props: { top: "-24px", right: "12%", size: 150, color: "lilac", opacity: 0.2 } },
    { Cmp: Dot, props: { bottom: "16%", left: "6%", size: 14, color: "primary", opacity: 0.22 } },
    { Cmp: Ring, props: { top: "10%", left: "18%", size: 60, color: "teal", opacity: 0.22 } },
    { Cmp: Plus, props: { bottom: "10%", right: "26%", size: 20, color: "sky", opacity: 0.28 } },
    { Cmp: Dot, props: { top: "16%", right: "6%", size: 9, color: "peach", opacity: 0.26 } },
  ],
  why: [
    { Cmp: Circle, props: { top: "-30px", left: "14%", size: 100, color: "teal", opacity: 0.18 } },
    { Cmp: Plus, props: { bottom: "10%", right: "8%", size: 20, color: "sky", opacity: 0.3 } },
    { Cmp: Ring, props: { bottom: "-20px", left: "34%", size: 70, color: "peach", opacity: 0.2 } },
    { Cmp: Dot, props: { top: "16%", right: "22%", size: 10, color: "lilac", opacity: 0.26 } },
    { Cmp: Dot, props: { bottom: "20%", left: "6%", size: 9, color: "primary", opacity: 0.2 } },
  ],
  educators: [
    { Cmp: Ring, props: { bottom: "-30px", left: "8%", size: 120, color: "primary", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "14%", right: "20%", size: 10, color: "peach", opacity: 0.3 } },
    { Cmp: Plus, props: { top: "8%", left: "6%", size: 18, color: "teal", opacity: 0.26 } },
    { Cmp: Circle, props: { bottom: "10%", right: "6%", size: 64, color: "sky", opacity: 0.2 } },
    { Cmp: Dot, props: { bottom: "24%", left: "30%", size: 8, color: "lilac", opacity: 0.24 } },
  ],
  testimonials: [
    { Cmp: Blob, props: { top: "-20px", right: "6%", size: 120, color: "sky", opacity: 0.16 } },
    { Cmp: Stripe, props: { bottom: "6%", left: "-10px", width: 100, color: "lilac", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "12%", left: "10%", size: 10, color: "peach", opacity: 0.26 } },
    { Cmp: Ring, props: { bottom: "12%", right: "24%", size: 60, color: "teal", opacity: 0.22 } },
    { Cmp: Plus, props: { top: "16%", right: "34%", size: 16, color: "primary", opacity: 0.24 } },
  ],
  faq: [
    { Cmp: Circle, props: { bottom: "-24px", right: "14%", size: 90, color: "teal", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "10%", left: "10%", size: 10, color: "primary", opacity: 0.24 } },
    { Cmp: Plus, props: { bottom: "16%", left: "24%", size: 16, color: "sky", opacity: 0.26 } },
    { Cmp: Ring, props: { top: "16%", right: "30%", size: 54, color: "peach", opacity: 0.2 } },
  ],
  cta: [
    { Cmp: Ring, props: { top: "-20px", right: "10%", size: 100, color: "sky", opacity: 0.22 } },
    { Cmp: Dot, props: { bottom: "18%", left: "12%", size: 12, color: "peach", opacity: 0.3 } },
    { Cmp: Plus, props: { top: "12%", left: "8%", size: 18, color: "teal", opacity: 0.26 } },
    { Cmp: Circle, props: { bottom: "-26px", right: "30%", size: 60, color: "lilac", opacity: 0.16 } },
    { Cmp: Dot, props: { top: "20%", right: "20%", size: 9, color: "primary", opacity: 0.2 } },
  ],
  student: [
    { Cmp: Circle, props: { top: "8%", right: "4%", size: 90, color: "lilac", opacity: 0.14 } },
    { Cmp: Dot, props: { bottom: "12%", left: "6%", size: 10, color: "teal", opacity: 0.22 } },
    { Cmp: Ring, props: { top: "20%", left: "16%", size: 60, color: "sky", opacity: 0.18 } },
    { Cmp: Plus, props: { bottom: "20%", right: "18%", size: 16, color: "peach", opacity: 0.22 } },
    { Cmp: Dot, props: { top: "10%", left: "40%", size: 8, color: "primary", opacity: 0.18 } },
  ],
  public: [
    { Cmp: Blob, props: { top: "-30px", left: "50%", size: 160, color: "peach", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "6px", right: "8%", size: 8, color: "teal", opacity: 0.2 } },
    { Cmp: Ring, props: { top: "10px", left: "6%", size: 40, color: "sky", opacity: 0.18 } },
  ],
};

export default function SectionShapes({ variant = "hero", className = "" }) {
  const shapes = VARIANTS[variant] || VARIANTS.hero;
  return (
    <div className={`decorative-shapes pointer-events-none absolute inset-0 -z-10 overflow-hidden ${className}`} aria-hidden="true">
      {shapes.map(({ Cmp, props }, index) => (
        <Cmp key={index} {...props} />
      ))}
    </div>
  );
}
