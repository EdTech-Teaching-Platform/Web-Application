// DonutChart — single-ring proportion chart with a center headline number
// (design.md's named list doesn't cover one yet; built to spec so Admin's
// Course Stat / compliance breakdowns can reuse it rather than forking).
// Segments are drawn in the fixed order given — categorical hues stay
// assigned to the entity, never re-cycled if the segment list changes.
// A legend is always rendered (2+ segments), each swatch a text token,
// never the segment's own hue used for the label text.
//
// Usage:
//   <DonutChart
//     centerLabel="70%"
//     centerSub="Engagement"
//     segments={[
//       { label: "Course Sale", value: 40, colorClass: "stroke-rotation-1" },
//       { label: "Course Watched", value: 30, colorClass: "stroke-rotation-2" },
//     ]}
//   />
const SIZE = 160;
const STROKE = 16;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;

export default function DonutChart({ segments, centerLabel, centerSub, className = "" }) {
  let offset = 0;
  const total = 100;

  return (
    <div className={`flex flex-col items-center ${className}`}>
      <div className="relative">
        <svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`} className="-rotate-90">
          <circle cx={SIZE / 2} cy={SIZE / 2} r={R} fill="none" strokeWidth={STROKE} className="stroke-primary/[0.07]" />
          {segments.map((s) => {
            const dash = (s.value / total) * CIRC;
            const gap = CIRC - dash;
            const circle = (
              <circle
                key={s.label}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={R}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${Math.max(dash - 2, 0)} ${gap + 2}`}
                strokeDashoffset={-offset}
                strokeLinecap="round"
                className={`${s.colorClass} transition-all duration-300`}
              />
            );
            offset += dash;
            return circle;
          })}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-text">{centerLabel}</span>
          {centerSub && <span className="text-xs text-muted">{centerSub}</span>}
        </div>
      </div>

      <div className="mt-4 flex w-full flex-col gap-2">
        {segments.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-sm">
            <span className="inline-flex items-center gap-2 text-muted">
              <span className={`h-2 w-2 rounded-full ${s.colorClass.replace("stroke-", "bg-")}`} />
              {s.label}
            </span>
            <span className="font-semibold text-text">{s.value}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
