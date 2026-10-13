import { useEffect, useState } from "react";

// Shared progress -> color helper. Low = warm orange/pink, mid = amber-ish
// orange, high = sage green; "brand" forces the maroon accent. Returns an
// SVG stroke color (token var) so every ring/bar traces back to @theme.
export function progressColor(pct) {
  if (pct >= 75) return "var(--color-pastel-sage-ink)";
  if (pct >= 40) return "var(--color-chart-5)";
  return "var(--color-pastel-pink-ink)";
}

// ProgressRing — SVG circular ring with a centered percentage. Animates on
// load via a stroke-dashoffset transition (ease-out; skipped for reduced
// motion through the motion-safe variant). `tone="auto"` colors by value,
// "brand" uses maroon.
//
// Usage: <ProgressRing value={72} size={72} />
export default function ProgressRing({
  value = 0,
  size = 64,
  stroke = 7,
  tone = "auto",
  label,
  showValue = true,
  className = "",
}) {
  const pct = Math.max(0, Math.min(100, Number(value) || 0));
  const [shown, setShown] = useState(0);
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(pct));
    return () => cancelAnimationFrame(raf);
  }, [pct]);

  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const color = tone === "brand" ? "var(--color-primary)" : progressColor(pct);

  return (
    <div
      role="img"
      aria-label={label ?? `${Math.round(pct)}%`}
      className={`relative inline-flex shrink-0 items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          stroke="var(--color-primary)"
          strokeOpacity="0.09"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          stroke={color}
          strokeDasharray={circ}
          strokeDashoffset={circ * (1 - shown / 100)}
          className="motion-safe:transition-[stroke-dashoffset] motion-safe:duration-700 motion-safe:ease-out"
        />
      </svg>
      {showValue && (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold tracking-tight text-text"
          style={{ fontSize: Math.max(10, Math.round(size * 0.24)) }}
        >
          {Math.round(pct)}%
        </span>
      )}
    </div>
  );
}
