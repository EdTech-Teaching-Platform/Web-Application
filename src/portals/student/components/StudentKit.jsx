// StudentKit — small presentation helpers shared by the student screens so they
// all carry the landing-page feel: scroll-in motion, the blue squiggle, drifting
// decoration and the subject glyphs used on series covers. No data, no routes.
import { useEffect, useRef, useState } from "react";

export const MOTION_CSS = `
@keyframes ul-dash-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-9px); } }
@keyframes ul-dash-drift { 0%, 100% { transform: translate3d(0, 0, 0) rotate(var(--r, 0deg)); } 50% { transform: translate3d(var(--dx, 12px), var(--dy, -14px), 0) rotate(calc(var(--r, 0deg) + 6deg)); } }
.ul-dash-float { animation: ul-dash-float 7s ease-in-out infinite; }
.ul-dash-drift { transform: rotate(var(--r, 0deg)); animation: ul-dash-drift var(--dur, 24s) ease-in-out var(--delay, 0s) infinite; }
.ul-dash-rise { opacity: 0; transform: translateY(18px); transition: opacity 0.7s cubic-bezier(0.2, 0.8, 0.2, 1), transform 0.7s cubic-bezier(0.2, 0.8, 0.2, 1); transition-delay: var(--d, 0ms); }
.ul-dash-rise[data-in="true"] { opacity: 1; transform: none; }
@media (prefers-reduced-motion: reduce) {
  .ul-dash-float, .ul-dash-drift { animation: none; }
  .ul-dash-rise { opacity: 1; transform: none; transition: none; }
}
`;

// Fades and lifts its children in once, the first time they scroll into view.
export function Rise({ delay = 0, className = "", children }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (shown) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          observer.disconnect();
        }
      },
      { threshold: 0.08, rootMargin: "0px 0px -30px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);
  return (
    <div ref={ref} data-in={shown ? "true" : "false"} style={{ "--d": `${delay}ms` }} className={`ul-dash-rise ${className}`}>
      {children}
    </div>
  );
}

export function Squiggle({ className = "" }) {
  return (
    <svg viewBox="0 0 120 8" preserveAspectRatio="none" className={className} fill="none" aria-hidden="true">
      <path d="M2 5C12 0 22 8 32 4s20-4 30 0 20 4 30 0 18-3 26 0" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

// Big faint symbol on a series cover, picked from the subject/exam/title.
const GLYPH_BY_SUBJECT = [
  [/math|algebra|calcul|geometr|arith/i, "∑"],
  [/phys/i, "E=mc²"],
  [/chem/i, "H₂O"],
  [/bio|life/i, "DNA"],
  [/english|hindi|language|grammar|verbal/i, "Aa"],
  [/reason|aptitude|logic/i, "?!"],
];
const GLYPH_FALLBACK = ["π", "∑", "Δ", "√"];

export function glyphFor(series, index = 0) {
  const hay = `${series?.subject ?? ""} ${series?.exam ?? ""} ${series?.title ?? ""}`;
  const hit = GLYPH_BY_SUBJECT.find(([re]) => re.test(hay));
  return hit ? hit[1] : GLYPH_FALLBACK[index % GLYPH_FALLBACK.length];
}

// Dotted texture + glyph for covers that draw their own circles (COVER_ART).
export function CoverDots() {
  return (
    <span
      className="pointer-events-none absolute inset-0 opacity-60"
      aria-hidden="true"
      style={{ backgroundImage: "radial-gradient(rgba(255,255,255,0.5) 1.1px, transparent 1.4px)", backgroundSize: "16px 16px" }}
    />
  );
}

export function CoverGlyph({ children, className = "right-4" }) {
  return (
    <span
      className={`pointer-events-none absolute -bottom-3 select-none font-display text-[5rem] font-extrabold italic leading-none tracking-tight text-(--lp-ink)/[0.14] transition-transform duration-500 ease-out group-hover:-translate-y-1.5 group-hover:-rotate-6 ${className}`}
      aria-hidden="true"
    >
      {children}
    </span>
  );
}
