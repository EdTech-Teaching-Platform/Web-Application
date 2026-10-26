// StatBlock — solid colour-block stat tile (design.md "color-block" language).
// Wrap a StatCard in it; the tile sets the text colour, the card sets the sizes.
const TONES = {
  blue: "bg-(--lp-blue-deep) text-white",
  yellow: "bg-(--lp-yellow) text-(--lp-ink)",
  sky: "bg-rotation-3 text-(--lp-ink)",
  peach: "bg-rotation-2 text-(--lp-ink)",
  ink: "bg-(--lp-ink) text-white",
};

export const STAT_BLOCK_VALUE = "font-display text-4xl font-bold leading-none tracking-tight";
export const STAT_BLOCK_LABEL = "text-[11px] font-bold uppercase tracking-[0.14em] opacity-70";

export const STAT_BLOCK_VALUE_COMPACT = "font-display text-2xl font-bold leading-none tracking-tight sm:text-[1.75rem]";

// `compact` (opt-in, used by the Dashboard) is a slimmer tile for at-a-glance figures.
export default function StatBlock({ icon: Icon, tone = "blue", children, compact = false }) {
  return (
    <div className={`group relative flex flex-col justify-end overflow-hidden shadow-[0_22px_36px_-26px_rgb(15_17_21/0.55)] transition-transform ${compact ? "min-h-[96px] rounded-3xl p-4" : "min-h-[148px] rounded-[1.75rem] p-5"} duration-300 ease-out hover:-translate-y-1 ${TONES[tone] ?? TONES.blue}`}>
      <span
        className="pointer-events-none absolute inset-0 opacity-40"
        aria-hidden="true"
        style={{
          backgroundImage: "radial-gradient(rgba(255,255,255,0.35) 1px, transparent 1.3px)",
          backgroundSize: "18px 18px",
          maskImage: "linear-gradient(to bottom left, black, transparent 65%)",
          WebkitMaskImage: "linear-gradient(to bottom left, black, transparent 65%)",
        }}
      />
      {Icon && <Icon className={`pointer-events-none absolute opacity-[0.16] transition-transform duration-500 ease-out group-hover:-rotate-6 group-hover:scale-110 ${compact ? "-right-2 -top-2 h-16 w-16" : "-right-4 -top-4 h-28 w-28"}`} aria-hidden="true" />}
      <div className="relative">{children}</div>
    </div>
  );
}
