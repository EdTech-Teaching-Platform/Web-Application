// PageHero — the dark "ticket" header shared by the student pages (same look as
// the landing countdown card and the dashboard hero). Presentation only:
// callers pass the same text and buttons they always did; `theme` now picks the
// accent colour (eyebrow chip, art panel, glow) instead of the whole background.
import { HERO_ART } from "./HeroArt";
import { MOTION_CSS } from "./StudentKit";

const THEMES = {
  yellow: { panel: "bg-(--lp-yellow)", chip: "bg-(--lp-yellow) text-(--lp-ink)", glow: "bg-(--lp-yellow)/[0.09]", dot: "bg-(--lp-ink)" },
  sky: { panel: "bg-rotation-3", chip: "bg-rotation-3 text-(--lp-ink)", glow: "bg-rotation-3/[0.12]", dot: "bg-(--lp-ink)" },
  peach: { panel: "bg-rotation-2", chip: "bg-rotation-2 text-(--lp-ink)", glow: "bg-rotation-2/[0.12]", dot: "bg-(--lp-ink)" },
  blue: { panel: "bg-(--lp-blue)", chip: "bg-(--lp-blue) text-white", glow: "bg-(--lp-blue)/[0.16]", dot: "bg-white" },
  ink: { panel: "bg-(--lp-yellow)", chip: "bg-(--lp-yellow) text-(--lp-ink)", glow: "bg-(--lp-yellow)/[0.09]", dot: "bg-(--lp-ink)" },
};

// One faint symbol drifting in the background, chosen by the illustration.
const ART_GLYPH = { study: "E = mc²", shelf: "∑", clock: "π", card: "Δ", chart: "%", search: "√" };

// Shared look for the buttons that sit inside a hero (the hero is dark now).
export const HERO_BTN =
  "inline-flex items-center gap-2 rounded-full px-5 py-2.5 text-sm font-semibold transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_24px_rgb(0_0_0/0.35)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--lp-yellow)";
export const HERO_BTN_LIGHT = `${HERO_BTN} bg-white text-(--lp-ink)`;
export const HERO_BTN_DARK = `${HERO_BTN} bg-white/10 text-white ring-1 ring-white/25`;
export const HERO_BTN_YELLOW = `${HERO_BTN} bg-(--lp-yellow) text-(--lp-ink)`;

// The eyebrow chip is hidden by default (it only repeated the nav label); pages
// where it carries real information pass `showEyebrow`.
// `compact` gives a slimmer banner; the default is a little roomier.
export default function PageHero({ theme = "yellow", art = "study", eyebrow, showEyebrow = false, title, subtitle, lead, children, compact = false }) {
  const t = THEMES[theme] ?? THEMES.yellow;
  const Art = HERO_ART[art];
  const glyph = ART_GLYPH[art] ?? "π";
  return (
    <header className="relative isolate overflow-hidden rounded-[1.5rem] bg-(--lp-ink) sm:rounded-[2rem] text-white shadow-[0_30px_60px_-30px_rgb(15_17_21/0.55)]">
      <style>{MOTION_CSS}</style>
      <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden="true">
        <div className="absolute -right-28 -top-28 h-[22rem] w-[22rem] rounded-full border border-white/10" />
        <div className="absolute -right-14 -top-14 h-[15rem] w-[15rem] rounded-full border border-white/10" />
        <div className="ul-dash-drift absolute -right-5 -top-5 h-20 w-20 rounded-full sm:h-[7.5rem] sm:w-[7.5rem] bg-(--lp-blue)/80" style={{ "--dx": "-8px", "--dy": "10px", "--dur": "28s" }} />
        <div className={`ul-dash-drift absolute -left-20 top-1/4 h-60 w-60 rounded-full blur-3xl ${t.glow}`} style={{ "--dx": "26px", "--dy": "18px", "--dur": "32s" }} />
        <div
          className="absolute inset-0 opacity-40"
          style={{
            backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1.2px)",
            backgroundSize: "24px 24px",
            maskImage: "linear-gradient(to right, black, transparent 60%)",
            WebkitMaskImage: "linear-gradient(to right, black, transparent 60%)",
          }}
        />
        <span className="ul-dash-drift absolute right-[34%] top-[10%] hidden font-display text-5xl font-bold italic text-white/[0.06] md:block" style={{ "--r": "-6deg", "--dur": "26s" }}>{glyph}</span>
      </div>

      <div className={`relative grid items-center gap-6 px-4 sm:px-8 md:grid-cols-[1.35fr_0.65fr] ${compact ? "py-5 sm:py-6" : "py-6 sm:py-8"}`}>
        <div className="flex items-center gap-5">
          {lead}
          <div className="min-w-0">
            {eyebrow && showEyebrow && (
              <span className={`inline-flex max-w-full items-center gap-2 rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${t.chip}`}>
                <span className="relative grid h-2 w-2 shrink-0 place-items-center" aria-hidden="true">
                  <span className={`absolute inset-0 rounded-full opacity-40 motion-safe:animate-ping ${t.dot}`} />
                  <span className={`relative h-2 w-2 rounded-full ${t.dot}`} />
                </span>
                <span className="truncate">{eyebrow}</span>
              </span>
            )}
            <h1 className={`break-words font-display font-bold tracking-tight ${eyebrow && showEyebrow ? "mt-3.5" : ""} ${compact ? "text-[1.65rem] leading-tight sm:text-4xl" : "text-[1.65rem] leading-[1.1] sm:text-4xl lg:text-[2.75rem]"}`}>{title}</h1>
            {subtitle && <p className="mt-2 max-w-md text-[13px] leading-relaxed text-white/70 sm:mt-3 sm:text-[15px]">{subtitle}</p>}
            {children && <div className="mt-5 flex flex-wrap gap-2.5">{children}</div>}
          </div>
        </div>
        {Art && (
          <div className="pointer-events-none hidden justify-end md:flex" aria-hidden="true">
            <div className={`w-full rotate-2 ${compact ? "max-w-[210px]" : "max-w-[250px]"}`}>
              <div className={`ul-dash-float rounded-3xl p-2.5 shadow-[0_24px_44px_-22px_rgb(0_0_0/0.7)] ring-4 ring-white/10 ${t.panel}`}>
                <Art className="h-auto w-full" />
              </div>
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
