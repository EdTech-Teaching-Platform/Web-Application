// PageHero — the illustrated colour-block header shared by the student pages.
// Presentation only: callers pass the same text they always showed.
import { HERO_ART } from "./HeroArt";

const THEMES = {
  yellow: { bg: "bg-(--lp-yellow)", fg: "text-(--lp-ink)", sub: "text-(--lp-ink)/70", eyebrow: "text-(--lp-ink)", bar: "bg-(--lp-ink)" },
  sky: { bg: "bg-rotation-3", fg: "text-(--lp-ink)", sub: "text-(--lp-ink)/70", eyebrow: "text-(--lp-ink)", bar: "bg-(--lp-ink)" },
  peach: { bg: "bg-rotation-2", fg: "text-(--lp-ink)", sub: "text-(--lp-ink)/70", eyebrow: "text-(--lp-ink)", bar: "bg-(--lp-ink)" },
  blue: { bg: "bg-(--lp-blue-deep)", fg: "text-white", sub: "text-white/75", eyebrow: "text-(--lp-yellow)", bar: "bg-(--lp-yellow)" },
  ink: { bg: "bg-(--lp-ink)", fg: "text-white", sub: "text-white/70", eyebrow: "text-(--lp-yellow)", bar: "bg-(--lp-yellow)" },
};

// Shared look for the buttons that sit inside a hero.
export const HERO_BTN =
  "inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgb(15_17_21/0.25)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-ink)";
export const HERO_BTN_LIGHT = `${HERO_BTN} bg-white text-primary`;
export const HERO_BTN_DARK = `${HERO_BTN} bg-(--lp-ink) text-white`;
export const HERO_BTN_YELLOW = `${HERO_BTN} bg-(--lp-yellow) text-(--lp-ink)`;

// `compact` (opt-in, used by the Dashboard) gives a slimmer banner; every other
// page keeps the original full-size hero.
export default function PageHero({ theme = "yellow", art = "study", eyebrow, title, subtitle, lead, children, compact = false }) {
  const t = THEMES[theme] ?? THEMES.yellow;
  const Art = HERO_ART[art];
  return (
    <header className={`relative isolate overflow-hidden rounded-[2rem] ${t.bg} ${t.fg}`}>
      <svg className="pointer-events-none absolute -left-28 -top-28 h-96 w-96 text-black/[0.07]" viewBox="0 0 200 200" fill="none" aria-hidden="true">
        <circle cx="100" cy="100" r="96" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="72" stroke="currentColor" strokeWidth="1.5" />
        <circle cx="100" cy="100" r="48" stroke="currentColor" strokeWidth="1.5" />
      </svg>
      <div className="relative grid md:grid-cols-[1.05fr_1fr]">
        <div className={`flex items-center gap-5 px-6 ${compact ? "py-6 sm:px-8 sm:py-7" : "py-9 sm:px-10 sm:py-12"}`}>
          {lead}
          <div className="min-w-0">
            {eyebrow && (
              <p className={`flex items-center gap-3 text-xs font-bold uppercase tracking-[0.18em] ${t.eyebrow}`}>
                <span className={`h-0.5 w-7 rounded-full ${t.bar}`} aria-hidden="true" />
                <span className="truncate">{eyebrow}</span>
              </p>
            )}
            <h1 className={`break-words font-display font-bold tracking-tight ${compact ? "mt-2 text-3xl leading-tight sm:text-4xl" : "mt-3 text-4xl leading-[0.98] sm:text-5xl lg:text-[3.5rem]"}`}>{title}</h1>
            {subtitle && <p className={`max-w-md text-sm leading-relaxed sm:text-base ${compact ? "mt-2" : "mt-4"} ${t.sub}`}>{subtitle}</p>}
            {children && <div className="mt-6 flex flex-wrap gap-3">{children}</div>}
          </div>
        </div>
        {Art && (
          <div className={`pointer-events-none hidden justify-end md:flex ${compact ? "items-center pr-8 py-3" : "items-end pr-6 pt-6 lg:pr-10"}`} aria-hidden="true">
            <Art className={`h-auto w-full ${compact ? "max-w-[250px]" : "max-w-[460px]"}`} />
          </div>
        )}
      </div>
    </header>
  );
}
