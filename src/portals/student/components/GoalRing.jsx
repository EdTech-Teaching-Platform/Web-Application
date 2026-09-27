// GoalRing — new component, MINUTO-reference-inspired ("Today's Goal" donut
// ring). Not a named design.md component and not literally called for by
// the LMS doc's Section 15 row (which only lists "progress bars"), but the
// dashboard restyle explicitly asked to match this reference's density —
// flagged here as a visual enrichment layered on the doc's existing
// "overall progress percentage" metric, not a new data requirement. Built
// with only --color-primary + --color-bg tokens (a plain SVG stroke ring,
// no gradients/foreign colors) so it stays inside the existing palette per
// the "match richness, keep our tokens" decision.
export default function GoalRing({ percent = 0, size = 96, strokeWidth = 10, label }) {
  const clamped = Math.min(Math.max(percent, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped / 100);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-white/25"
            strokeWidth={strokeWidth}
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            className="text-white"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 600ms ease-out" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-xl font-bold text-white">{clamped}%</span>
        </div>
      </div>
      {label && <span className="text-xs font-medium text-white/80">{label}</span>}
    </div>
  );
}
