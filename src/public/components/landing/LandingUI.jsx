// Small presentational building blocks used only by the redesigned public
// landing page (src/public/pages/LandingPage.jsx). Kept next to the page
// rather than promoted to src/components/ui — no other portal needs them.
// All colors come from the --lp-* variables in ../landingTheme.js.
import React, { useEffect, useRef, useState } from "react";

// ---------------------------------------------------------------- Reveal
// Fade + rise on first scroll into view. opacity/transform only, ease-out,
// once per element. Falls back to "already visible" when
// IntersectionObserver is missing, and is skipped entirely for visitors
// who prefer reduced motion (motion-safe variants).
export function Reveal({ as: Tag = "div", delay = 0, className = "", children, ...rest }) {
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
      { threshold: 0.1, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shown]);

  return (
    <Tag
      ref={ref}
      style={{ transitionDelay: shown ? `${delay}ms` : "0ms" }}
      className={`motion-safe:transition-[opacity,transform] motion-safe:duration-700 motion-safe:ease-out ${
        shown ? "translate-y-0 opacity-100" : "motion-safe:translate-y-7 motion-safe:opacity-0"
      } ${className}`}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ----------------------------------------------------------------- Icons
export function ArrowUpRight({ className = "h-4 w-4" }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      <path d="M7 17 17 7" />
      <path d="M8 7h9v9" />
    </svg>
  );
}

// ---------------------------------------------------------- Pill button
// The "pill + attached arrow circle" CTA from the reference style. Renders
// a real <button> (or any element via `as`, e.g. react-router's Link) so
// it keeps keyboard + form behaviour.
const TONES = {
  ink: { pill: "bg-(--lp-ink) text-white", dot: "bg-(--lp-ink) text-white" },
  blue: { pill: "bg-(--lp-blue) text-white", dot: "bg-(--lp-blue) text-white" },
  yellow: { pill: "bg-(--lp-yellow) text-(--lp-ink)", dot: "bg-(--lp-yellow) text-(--lp-ink)" },
  white: { pill: "bg-white text-(--lp-ink)", dot: "bg-white text-(--lp-ink)" },
  outline: {
    pill: "bg-white text-(--lp-ink) ring-1 ring-inset ring-(--lp-ink)/25",
    dot: "bg-white text-(--lp-ink) ring-1 ring-inset ring-(--lp-ink)/25",
  },
};

export function PillButton({ as: Component = "button", tone = "ink", arrow = true, size = "md", className = "", children, type, ...props }) {
  const t = TONES[tone] ?? TONES.ink;
  const pad = size === "sm" ? "px-5 py-2.5" : "px-6 py-3.5";
  const dot = size === "sm" ? "h-10 w-10" : "h-12 w-12";
  const typeProp = Component === "button" ? { type: type ?? "button" } : {};
  return (
    <Component
      className={`group inline-flex items-center gap-1 rounded-full text-sm font-semibold outline-none focus-visible:ring-4 focus-visible:ring-(--lp-blue)/35 ${className}`}
      {...typeProp}
      {...props}
    >
      <span className={`rounded-full ${pad} ${t.pill} transition-transform duration-200 ease-out group-hover:-translate-y-0.5`}>{children}</span>
      {arrow && (
        <span className={`grid ${dot} place-items-center rounded-full ${t.dot} transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5`}>
          <ArrowUpRight />
        </span>
      )}
    </Component>
  );
}

// ---------------------------------------------------------- Section head
export function SectionHead({ eyebrow, title, subtitle, align = "center", dark = false, className = "", maxW = "max-w-2xl" }) {
  const center = align === "center";
  return (
    <div className={`${center ? "mx-auto text-center" : ""} ${maxW} ${className}`}>
      <span
        className={`inline-flex rounded-full px-3.5 py-1.5 text-xs font-semibold tracking-wide ${
          dark ? "bg-white/10 text-white" : "bg-(--lp-grey) text-(--lp-ink)"
        }`}
      >
        {eyebrow}
      </span>
      <h2
        className={`mt-4 font-(family-name:--lp-font) text-balance text-3xl font-bold leading-[1.1] tracking-tight sm:text-4xl md:text-5xl ${
          dark ? "text-white" : "text-(--lp-ink)"
        }`}
      >
        {title}
      </h2>
      {subtitle && (
        <p className={`mt-4 text-base leading-relaxed ${dark ? "text-white/70" : "text-(--lp-muted)"}`}>{subtitle}</p>
      )}
    </div>
  );
}

// -------------------------------------------------------------- Doodles
// Hand-drawn style flourishes (squiggle, curl arrow, dashes) — static,
// decorative, aria-hidden.
export function Squiggle({ className = "", stroke = "currentColor" }) {
  return (
    <svg viewBox="0 0 120 40" fill="none" preserveAspectRatio="none" className={className} aria-hidden="true">
      <path d="M3 24c10-18 18 14 28-4s18 14 28-4 18 14 28-4 18 8 30-6" stroke={stroke} strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function CurlArrow({ className = "", stroke = "currentColor" }) {
  return (
    <svg viewBox="0 0 90 110" fill="none" className={className} aria-hidden="true">
      <path d="M12 98C-4 60 30 20 64 22c14 1 20 14 8 22-12 8-26-2-14-14 8-8 20-8 28-4" stroke={stroke} strokeWidth="4" strokeLinecap="round" />
      <path d="M72 14 86 26 70 34" stroke={stroke} strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Hatch({ className = "", stroke = "currentColor" }) {
  return (
    <svg viewBox="0 0 60 60" fill="none" className={className} aria-hidden="true">
      {[0, 1, 2, 3, 4].map((row) =>
        [0, 1, 2, 3, 4].map((col) => (
          <path key={`${row}-${col}`} d={`M${6 + col * 11} ${10 + row * 11}l4 -6`} stroke={stroke} strokeWidth="2.4" strokeLinecap="round" />
        ))
      )}
    </svg>
  );
}

export function Sparkle({ className = "", fill = "currentColor" }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden="true">
      <path d="M20 2c1.5 10 8 16.5 18 18-10 1.5-16.500 8-18 18C18.500 28 12 21.500 2 20 12 18.500 18.500 12 20 2Z" fill={fill} />
    </svg>
  );
}

// ------------------------------------------------------------------ Tape
// Slanted "washi tape" ticker bands. transform-only linear drift, disabled
// for visitors who prefer reduced motion.
export function Tape({ items, className = "", reverse = false, duration = 40 }) {
  const row = [...items, ...items];
  return (
    <div className={`overflow-hidden ${className}`} aria-hidden="true">
      <style>{`
        @keyframes lp-tape-left { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        @keyframes lp-tape-right { from { transform: translateX(-50%); } to { transform: translateX(0); } }
      `}</style>
      <div
        className="flex w-max items-center whitespace-nowrap py-3.5 font-(family-name:--lp-font) text-lg font-bold tracking-tight motion-safe:[animation-timing-function:linear] motion-safe:[animation-iteration-count:infinite] sm:text-xl"
        style={{ animationName: reverse ? "lp-tape-right" : "lp-tape-left", animationDuration: `${duration}s` }}
      >
        {[...row, ...row].map((label, i) => (
          <span key={`${label}-${i}`} className="flex items-center">
            <span className="px-5">{label}</span>
            <Sparkle className="h-4 w-4" />
          </span>
        ))}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- Sticker
// Round "sticker" badge with circular text. Static, decorative.
export function Sticker({ text = "LIVE • LEARN • PRACTICE • GROW • ", className = "", children }) {
  return (
    <div className={`grid place-items-center rounded-full ${className}`} aria-hidden="true">
      <svg viewBox="0 0 120 120" className="absolute inset-0 h-full w-full">
        <defs>
          <path id="lp-sticker-circle" d="M60 60 m-43 0 a43 43 0 1 1 86 0 a43 43 0 1 1 -86 0" />
        </defs>
        <text fontSize="12.5" fontWeight="700" letterSpacing="2.4" fill="currentColor">
          <textPath href="#lp-sticker-circle">{text}</textPath>
        </text>
      </svg>
      {children}
    </div>
  );
}
