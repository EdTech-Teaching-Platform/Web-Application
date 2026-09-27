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
    { Cmp: Circle, props: { top: "4%", right: "6%", size: 140, color: "peach", opacity: 0.16 } },
    { Cmp: Ring, props: { bottom: "10%", left: "2%", size: 90, color: "teal", opacity: 0.24 } },
    { Cmp: Dot, props: { top: "18%", left: "38%", size: 12, color: "primary", opacity: 0.25 } },
    { Cmp: Plus, props: { top: "8%", right: "28%", size: 18, color: "sky", opacity: 0.28 } },
    { Cmp: Blob, props: { bottom: "4%", right: "22%", size: 90, color: "lilac", opacity: 0.14 } },
    { Cmp: Dot, props: { bottom: "6%", left: "20%", size: 9, color: "teal", opacity: 0.22 } },
    { Cmp: Ring, props: { top: "42%", right: "2%", size: 54, color: "lilac", opacity: 0.23 } },
    { Cmp: Stripe, props: { top: "72%", left: "46%", width: 72, color: "peach", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "34%", left: "4%", size: 13, color: "sky", opacity: 0.25 } },
    { Cmp: Plus, props: { bottom: "18%", right: "44%", size: 16, color: "primary", opacity: 0.2 } },
  ],
  goals: [
    { Cmp: Blob, props: { top: "4%", left: "8%", size: 130, color: "lilac", opacity: 0.16 } },
    { Cmp: Plus, props: { bottom: "12%", right: "5%", size: 22, color: "teal", opacity: 0.3 } },
    { Cmp: Ring, props: { top: "12%", right: "16%", size: 70, color: "peach", opacity: 0.22 } },
    { Cmp: Dot, props: { bottom: "8%", left: "24%", size: 10, color: "sky", opacity: 0.26 } },
    { Cmp: Circle, props: { bottom: "4%", right: "30%", size: 60, color: "primary", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "38%", left: "28%", size: 12, color: "peach", opacity: 0.28 } },
    { Cmp: Stripe, props: { bottom: "16%", right: "25%", width: 86, color: "sky", opacity: 0.17 } },
    { Cmp: Ring, props: { bottom: "4%", left: "48%", size: 58, color: "teal", opacity: 0.2 } },
    { Cmp: Dot, props: { top: "16%", right: "42%", size: 8, color: "primary", opacity: 0.25 } },
  ],
  categories: [
    { Cmp: Circle, props: { bottom: "4%", right: "10%", size: 110, color: "sky", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "20%", right: "30%", size: 10, color: "peach", opacity: 0.3 } },
    { Cmp: Plus, props: { top: "10%", left: "10%", size: 18, color: "teal", opacity: 0.26 } },
    { Cmp: Ring, props: { bottom: "10%", left: "4%", size: 66, color: "lilac", opacity: 0.2 } },
    { Cmp: Dot, props: { top: "8%", right: "6%", size: 9, color: "primary", opacity: 0.22 } },
    { Cmp: Ring, props: { top: "34%", right: "24%", size: 52, color: "peach", opacity: 0.2 } },
    { Cmp: Blob, props: { bottom: "4%", left: "34%", size: 100, color: "lilac", opacity: 0.14 } },
    { Cmp: Plus, props: { bottom: "22%", right: "42%", size: 16, color: "primary", opacity: 0.22 } },
    { Cmp: Dot, props: { top: "56%", left: "18%", size: 12, color: "teal", opacity: 0.28 } },
  ],
  courses: [
    { Cmp: Ring, props: { top: "6%", right: "4%", size: 100, color: "peach", opacity: 0.22 } },
    { Cmp: Stripe, props: { bottom: "8%", left: "2%", width: 110, color: "teal", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "14%", left: "8%", size: 10, color: "sky", opacity: 0.26 } },
    { Cmp: Plus, props: { bottom: "14%", right: "20%", size: 18, color: "lilac", opacity: 0.28 } },
    { Cmp: Circle, props: { bottom: "4%", right: "38%", size: 70, color: "primary", opacity: 0.12 } },
    { Cmp: Blob, props: { top: "28%", left: "1%", size: 90, color: "lilac", opacity: 0.14 } },
    { Cmp: Ring, props: { bottom: "12%", right: "3%", size: 58, color: "teal", opacity: 0.22 } },
    { Cmp: Dot, props: { top: "62%", right: "32%", size: 12, color: "peach", opacity: 0.28 } },
    { Cmp: Stripe, props: { top: "18%", left: "56%", width: 76, color: "sky", opacity: 0.15 } },
  ],
  paths: [
    { Cmp: Blob, props: { top: "4%", right: "12%", size: 150, color: "lilac", opacity: 0.2 } },
    { Cmp: Dot, props: { bottom: "16%", left: "6%", size: 14, color: "primary", opacity: 0.22 } },
    { Cmp: Ring, props: { top: "10%", left: "18%", size: 60, color: "teal", opacity: 0.22 } },
    { Cmp: Plus, props: { bottom: "10%", right: "26%", size: 20, color: "sky", opacity: 0.28 } },
    { Cmp: Dot, props: { top: "16%", right: "6%", size: 9, color: "peach", opacity: 0.26 } },
    { Cmp: Circle, props: { bottom: "4%", left: "38%", size: 62, color: "peach", opacity: 0.14 } },
    { Cmp: Stripe, props: { top: "52%", left: "2%", width: 84, color: "lilac", opacity: 0.17 } },
    { Cmp: Ring, props: { bottom: "14%", right: "4%", size: 56, color: "primary", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "32%", right: "38%", size: 12, color: "teal", opacity: 0.28 } },
  ],
  why: [
    { Cmp: Circle, props: { top: "4%", left: "14%", size: 100, color: "teal", opacity: 0.18 } },
    { Cmp: Plus, props: { bottom: "10%", right: "8%", size: 20, color: "sky", opacity: 0.3 } },
    { Cmp: Ring, props: { bottom: "4%", left: "34%", size: 70, color: "peach", opacity: 0.2 } },
    { Cmp: Dot, props: { top: "16%", right: "22%", size: 10, color: "lilac", opacity: 0.26 } },
    { Cmp: Dot, props: { bottom: "20%", left: "6%", size: 9, color: "primary", opacity: 0.2 } },
    { Cmp: Blob, props: { top: "34%", right: "2%", size: 92, color: "lilac", opacity: 0.15 } },
    { Cmp: Stripe, props: { bottom: "24%", left: "44%", width: 78, color: "sky", opacity: 0.16 } },
    { Cmp: Dot, props: { top: "18%", left: "40%", size: 12, color: "peach", opacity: 0.28 } },
    { Cmp: Ring, props: { top: "56%", left: "2%", size: 52, color: "primary", opacity: 0.16 } },
  ],
  educators: [
    { Cmp: Ring, props: { bottom: "4%", left: "8%", size: 120, color: "primary", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "14%", right: "20%", size: 10, color: "peach", opacity: 0.3 } },
    { Cmp: Plus, props: { top: "8%", left: "6%", size: 18, color: "teal", opacity: 0.26 } },
    { Cmp: Circle, props: { bottom: "10%", right: "6%", size: 64, color: "sky", opacity: 0.2 } },
    { Cmp: Dot, props: { bottom: "24%", left: "30%", size: 8, color: "lilac", opacity: 0.24 } },
    { Cmp: Blob, props: { top: "32%", right: "1%", size: 88, color: "peach", opacity: 0.15 } },
    { Cmp: Stripe, props: { bottom: "8%", right: "38%", width: 76, color: "lilac", opacity: 0.16 } },
    { Cmp: Ring, props: { top: "10%", left: "42%", size: 54, color: "teal", opacity: 0.19 } },
    { Cmp: Plus, props: { bottom: "32%", right: "18%", size: 16, color: "primary", opacity: 0.22 } },
  ],
  testimonials: [
    { Cmp: Blob, props: { top: "4%", right: "6%", size: 120, color: "sky", opacity: 0.16 } },
    { Cmp: Stripe, props: { bottom: "6%", left: "2%", width: 100, color: "lilac", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "12%", left: "10%", size: 10, color: "peach", opacity: 0.26 } },
    { Cmp: Ring, props: { bottom: "12%", right: "24%", size: 60, color: "teal", opacity: 0.22 } },
    { Cmp: Plus, props: { top: "16%", right: "34%", size: 16, color: "primary", opacity: 0.24 } },
    { Cmp: Circle, props: { bottom: "4%", left: "40%", size: 68, color: "peach", opacity: 0.15 } },
    { Cmp: Dot, props: { top: "48%", right: "4%", size: 12, color: "lilac", opacity: 0.27 } },
    { Cmp: Stripe, props: { top: "18%", left: "38%", width: 70, color: "teal", opacity: 0.15 } },
    { Cmp: Ring, props: { bottom: "8%", left: "4%", size: 52, color: "primary", opacity: 0.17 } },
  ],
  faq: [
    { Cmp: Circle, props: { bottom: "4%", right: "14%", size: 90, color: "teal", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "10%", left: "10%", size: 10, color: "primary", opacity: 0.24 } },
    { Cmp: Plus, props: { bottom: "16%", left: "24%", size: 16, color: "sky", opacity: 0.26 } },
    { Cmp: Ring, props: { top: "16%", right: "30%", size: 54, color: "peach", opacity: 0.2 } },
    { Cmp: Blob, props: { top: "42%", left: "2%", size: 90, color: "lilac", opacity: 0.14 } },
    { Cmp: Dot, props: { bottom: "12%", right: "12%", size: 12, color: "peach", opacity: 0.28 } },
    { Cmp: Stripe, props: { top: "62%", right: "28%", width: 76, color: "teal", opacity: 0.15 } },
  ],
  cta: [
    { Cmp: Ring, props: { top: "4%", right: "10%", size: 100, color: "sky", opacity: 0.22 } },
    { Cmp: Dot, props: { bottom: "18%", left: "12%", size: 12, color: "peach", opacity: 0.3 } },
    { Cmp: Plus, props: { top: "12%", left: "8%", size: 18, color: "teal", opacity: 0.26 } },
    { Cmp: Circle, props: { bottom: "4%", right: "30%", size: 60, color: "lilac", opacity: 0.16 } },
    { Cmp: Dot, props: { top: "20%", right: "20%", size: 9, color: "primary", opacity: 0.2 } },
    { Cmp: Blob, props: { bottom: "4%", left: "34%", size: 96, color: "peach", opacity: 0.16 } },
    { Cmp: Stripe, props: { top: "46%", right: "2%", width: 82, color: "lilac", opacity: 0.16 } },
    { Cmp: Ring, props: { bottom: "12%", right: "40%", size: 56, color: "primary", opacity: 0.17 } },
    { Cmp: Dot, props: { top: "68%", left: "8%", size: 12, color: "sky", opacity: 0.28 } },
  ],
  student: [
    { Cmp: Circle, props: { top: "2%", right: "4%", size: 90, color: "lilac", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "4%", left: "8%", size: 10, color: "teal", opacity: 0.22 } },
    { Cmp: Ring, props: { top: "9%", left: "18%", size: 60, color: "sky", opacity: 0.18 } },
    { Cmp: Plus, props: { top: "8%", right: "20%", size: 16, color: "peach", opacity: 0.22 } },
    { Cmp: Dot, props: { top: "14%", left: "42%", size: 8, color: "primary", opacity: 0.18 } },
    { Cmp: Blob, props: { top: "13%", right: "2%", size: 112, color: "peach", opacity: 0.15 } },
    { Cmp: Ring, props: { top: "19%", right: "36%", size: 54, color: "lilac", opacity: 0.2 } },
    { Cmp: Stripe, props: { top: "23%", left: "4%", width: 88, color: "teal", opacity: 0.15 } },
    { Cmp: Circle, props: { top: "27%", left: "48%", size: 70, color: "sky", opacity: 0.14 } },
    { Cmp: Plus, props: { top: "24%", right: "22%", size: 18, color: "primary", opacity: 0.2 } },
    { Cmp: Dot, props: { top: "33%", left: "10%", size: 11, color: "peach", opacity: 0.24 } },
    { Cmp: Ring, props: { top: "37%", right: "8%", size: 64, color: "teal", opacity: 0.18 } },
    { Cmp: Blob, props: { top: "42%", left: "2%", size: 96, color: "sky", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "46%", right: "30%", size: 9, color: "lilac", opacity: 0.22 } },
    { Cmp: Plus, props: { top: "49%", left: "36%", size: 16, color: "teal", opacity: 0.2 } },
    { Cmp: Circle, props: { top: "53%", right: "4%", size: 66, color: "primary", opacity: 0.13 } },
    { Cmp: Stripe, props: { top: "57%", left: "6%", width: 80, color: "peach", opacity: 0.16 } },
    { Cmp: Ring, props: { top: "62%", left: "22%", size: 50, color: "sky", opacity: 0.19 } },
    { Cmp: Dot, props: { top: "65%", right: "16%", size: 12, color: "teal", opacity: 0.22 } },
    { Cmp: Blob, props: { top: "69%", right: "1%", size: 104, color: "lilac", opacity: 0.15 } },
    { Cmp: Plus, props: { top: "73%", left: "4%", size: 18, color: "primary", opacity: 0.2 } },
    { Cmp: Circle, props: { top: "77%", left: "40%", size: 58, color: "peach", opacity: 0.14 } },
    { Cmp: Ring, props: { top: "82%", right: "34%", size: 56, color: "teal", opacity: 0.18 } },
    { Cmp: Dot, props: { top: "86%", left: "12%", size: 10, color: "sky", opacity: 0.24 } },
    { Cmp: Stripe, props: { top: "90%", right: "6%", width: 84, color: "lilac", opacity: 0.15 } },
    { Cmp: Blob, props: { top: "95%", left: "44%", size: 88, color: "peach", opacity: 0.14 } },
    { Cmp: Circle, props: { top: "1%", left: "3%", size: 96, color: "lilac", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "4%", left: "16%", size: 9, color: "peach", opacity: 0.16 } },
    { Cmp: Ring, props: { top: "6%", left: "30%", size: 96, color: "teal", opacity: 0.23 } },
    { Cmp: Plus, props: { top: "8%", left: "44%", size: 18, color: "primary", opacity: 0.18 } },
    { Cmp: Blob, props: { top: "10%", right: "38%", size: 48, color: "sky", opacity: 0.16 } },
    { Cmp: Stripe, props: { top: "12%", right: "24%", width: 100, color: "lilac", opacity: 0.16 } },
    { Cmp: Circle, props: { top: "15%", right: "10%", size: 56, color: "peach", opacity: 0.19 } },
    { Cmp: Dot, props: { top: "18%", right: "2%", size: 8, color: "teal", opacity: 0.23 } },
    { Cmp: Ring, props: { top: "20%", left: "3%", size: 96, color: "primary", opacity: 0.18 } },
    { Cmp: Plus, props: { top: "23%", left: "16%", size: 14, color: "sky", opacity: 0.16 } },
    { Cmp: Blob, props: { top: "26%", left: "30%", size: 48, color: "lilac", opacity: 0.14 } },
    { Cmp: Stripe, props: { top: "28%", left: "44%", width: 84, color: "peach", opacity: 0.24 } },
    { Cmp: Circle, props: { top: "31%", right: "38%", size: 110, color: "teal", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "34%", right: "24%", size: 12, color: "primary", opacity: 0.15 } },
    { Cmp: Ring, props: { top: "37%", right: "10%", size: 48, color: "sky", opacity: 0.2 } },
    { Cmp: Plus, props: { top: "40%", right: "2%", size: 18, color: "lilac", opacity: 0.15 } },
    { Cmp: Blob, props: { top: "42%", left: "3%", size: 48, color: "peach", opacity: 0.22 } },
    { Cmp: Stripe, props: { top: "45%", left: "16%", width: 70, color: "teal", opacity: 0.24 } },
    { Cmp: Circle, props: { top: "47%", left: "30%", size: 72, color: "primary", opacity: 0.17 } },
    { Cmp: Dot, props: { top: "50%", left: "44%", size: 9, color: "sky", opacity: 0.18 } },
    { Cmp: Ring, props: { top: "52%", right: "38%", size: 96, color: "lilac", opacity: 0.16 } },
    { Cmp: Plus, props: { top: "54%", right: "24%", size: 18, color: "peach", opacity: 0.21 } },
    { Cmp: Blob, props: { top: "56%", right: "10%", size: 56, color: "teal", opacity: 0.19 } },
    { Cmp: Stripe, props: { top: "59%", right: "2%", width: 100, color: "primary", opacity: 0.16 } },
    { Cmp: Circle, props: { top: "62%", left: "3%", size: 110, color: "sky", opacity: 0.23 } },
    { Cmp: Dot, props: { top: "64%", left: "16%", size: 9, color: "lilac", opacity: 0.24 } },
    { Cmp: Ring, props: { top: "67%", left: "30%", size: 72, color: "peach", opacity: 0.16 } },
    { Cmp: Plus, props: { top: "69%", left: "44%", size: 18, color: "teal", opacity: 0.24 } },
    { Cmp: Blob, props: { top: "72%", right: "38%", size: 56, color: "primary", opacity: 0.22 } },
    { Cmp: Stripe, props: { top: "75%", right: "24%", width: 92, color: "sky", opacity: 0.15 } },
    { Cmp: Circle, props: { top: "77%", right: "10%", size: 56, color: "lilac", opacity: 0.23 } },
    { Cmp: Dot, props: { top: "80%", right: "2%", size: 12, color: "peach", opacity: 0.19 } },
    { Cmp: Ring, props: { top: "83%", left: "3%", size: 64, color: "teal", opacity: 0.16 } },
    { Cmp: Plus, props: { top: "85%", left: "16%", size: 18, color: "primary", opacity: 0.19 } },
    { Cmp: Blob, props: { top: "87%", left: "30%", size: 110, color: "sky", opacity: 0.14 } },
    { Cmp: Stripe, props: { top: "89%", left: "44%", width: 92, color: "lilac", opacity: 0.21 } },
    { Cmp: Circle, props: { top: "92%", right: "38%", size: 72, color: "peach", opacity: 0.21 } },
    { Cmp: Dot, props: { top: "95%", right: "24%", size: 12, color: "teal", opacity: 0.16 } },
    { Cmp: Ring, props: { top: "97%", right: "10%", size: 96, color: "primary", opacity: 0.22 } },
  ],
  public: [
    { Cmp: Blob, props: { top: "4%", left: "50%", size: 160, color: "peach", opacity: 0.14 } },
    { Cmp: Dot, props: { top: "6px", right: "8%", size: 8, color: "teal", opacity: 0.2 } },
    { Cmp: Ring, props: { top: "10px", left: "6%", size: 40, color: "sky", opacity: 0.18 } },
  ],
};

export default function SectionShapes({ variant = "hero", className = "", visible = false }) {
  const shapes = VARIANTS[variant] || VARIANTS.hero;
  return (
    <div className={`decorative-shapes pointer-events-none absolute inset-0 ${visible ? "z-0" : "-z-10"} overflow-hidden ${className}`} aria-hidden="true">
      {shapes.map(({ Cmp, props }, index) => (
        <Cmp key={index} {...props} />
      ))}
    </div>
  );
}
