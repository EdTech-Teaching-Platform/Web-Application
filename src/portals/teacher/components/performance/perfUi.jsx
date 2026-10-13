// Shared building blocks for the Performance tab: panel shell, avatar, delta
// arrow, heat colour and a tiny bar row. Colours come from @theme tokens only.
import { initialsOf } from "../../data/testSeriesData";
import { TrendingUpIcon, TrendingDownIcon } from "../../../../components/ui/icons";

const AVATAR_TONES = [
  "bg-pastel-blue text-pastel-blue-ink",
  "bg-pastel-sage text-pastel-sage-ink",
  "bg-pastel-lavender text-pastel-lavender-ink",
  "bg-pastel-orange text-pastel-orange-ink",
  "bg-pastel-pink text-pastel-pink-ink",
];

export function Panel({ id, eyebrow, title, subtitle, action, children, className = "" }) {
  return (
    <section id={id} className={`scroll-mt-24 rounded-3xl bg-surface p-5 shadow-soft sm:p-6 ${className}`}>
      {(eyebrow || title || action) && (
        <header className="mb-4 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            {eyebrow && <div className="eyebrow mb-1">{eyebrow}</div>}
            {title && <h2 className="text-base font-bold text-text">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function Avatar({ name, size = "md" }) {
  let h = 0;
  for (let i = 0; i < name.length; i += 1) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  const dim = size === "lg" ? "h-14 w-14 text-lg" : size === "sm" ? "h-8 w-8 text-[11px]" : "h-10 w-10 text-xs";
  return (
    <span aria-hidden="true" className={`flex shrink-0 items-center justify-center rounded-full font-bold ${dim} ${AVATAR_TONES[h % AVATAR_TONES.length]}`}>
      {initialsOf(name)}
    </span>
  );
}

// Up / down / flat change. `value` in points (or ranks when unit="rank", where positive = moved up).
export function Delta({ value, unit = "pts", className = "" }) {
  if (value === null || value === undefined) return <span className={`text-xs text-muted ${className}`} aria-label="No previous test">–</span>;
  const flat = Math.abs(value) < (unit === "rank" ? 1 : 2);
  const up = value > 0;
  const tone = flat ? "text-muted" : up ? "text-success" : "text-danger";
  const word = flat ? "No change" : up ? "Up" : "Down";
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${tone} ${className}`}>
      {flat ? <span aria-hidden="true">–</span> : up ? <TrendingUpIcon className="h-3.5 w-3.5" /> : <TrendingDownIcon className="h-3.5 w-3.5" />}
      <span className="sr-only">{word} </span>
      {flat ? "0" : `${Math.abs(Math.round(value * 10) / 10)}`}
      <span className="sr-only"> {unit === "rank" ? "places" : "points"}</span>
    </span>
  );
}

// Red -> green via the success/danger tokens, softened toward the card surface.
export function heatBg(pct) {
  if (pct === null || pct === undefined) return "transparent";
  const p = Math.max(0, Math.min(100, pct));
  return `color-mix(in srgb, color-mix(in srgb, var(--color-success) ${p}%, var(--color-danger)) 40%, var(--color-surface))`;
}
export const HEAT_GRADIENT = "linear-gradient(to right, color-mix(in srgb, var(--color-danger) 40%, var(--color-surface)), color-mix(in srgb, color-mix(in srgb, var(--color-success) 50%, var(--color-danger)) 40%, var(--color-surface)), color-mix(in srgb, var(--color-success) 40%, var(--color-surface)))";

export const fmtPct = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 10) / 10}%`);
export const fmtMin = (v) => (v === null || v === undefined ? "–" : `${Math.round(v * 10) / 10} min`);
export function fmtClock(sec) {
  if (sec === null || sec === undefined) return "–";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}
export function fmtDate(iso) {
  if (!iso) return "";
  return new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Horizontal value bar with an optional cohort marker tick.
export function BarRow({ label, value, marker, suffix = "%", max = 100, tone = "bg-primary", title }) {
  const w = value === null || value === undefined ? 0 : Math.max(0, Math.min(100, (value / max) * 100));
  const mk = marker === null || marker === undefined ? null : Math.max(0, Math.min(100, (marker / max) * 100));
  return (
    <div className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-xs" title={title}>
      <span className="truncate font-medium text-text">{label}</span>
      <span className="relative h-2.5 rounded-full bg-primary/[0.08]" role="img" aria-label={`${label}: ${value ?? "no data"}${suffix}${mk !== null ? `, cohort ${marker}${suffix}` : ""}`}>
        <span className={`absolute inset-y-0 left-0 rounded-full ${tone}`} style={{ width: `${w}%` }} />
        {mk !== null && <span className="absolute -inset-y-1 w-0.5 rounded-full bg-secondary" style={{ left: `calc(${mk}% - 1px)` }} />}
      </span>
      <span className="w-16 text-right font-semibold tabular-nums text-text">{value === null || value === undefined ? "–" : `${value}${suffix}`}</span>
    </div>
  );
}

export const CHIP_TONES = {
  "Top 10%": "bg-pastel-sage text-pastel-sage-ink",
  "Most improved": "bg-pastel-lavender text-pastel-lavender-ink",
  Fastest: "bg-pastel-blue text-pastel-blue-ink",
  "Perfect section": "bg-pastel-orange text-pastel-orange-ink",
};
export function MiniChip({ children, tone = "bg-primary/[0.07] text-text", title }) {
  return <span title={title} className={`inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${tone}`}>{children}</span>;
}

export function Pager({ page, pages, onPage, total, label = "rows" }) {
  if (pages <= 1) return <p className="mt-3 text-xs text-muted">{total} {label}</p>;
  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-xs text-muted">
      <span>{total} {label} · page {page + 1} of {pages}</span>
      <span className="flex gap-2">
        <button type="button" disabled={page === 0} onClick={() => onPage(page - 1)} className="rounded-full border border-primary/25 px-3 py-1.5 font-semibold text-text transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-40">Previous</button>
        <button type="button" disabled={page >= pages - 1} onClick={() => onPage(page + 1)} className="rounded-full border border-primary/25 px-3 py-1.5 font-semibold text-text transition-colors hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-40">Next</button>
      </span>
    </div>
  );
}
