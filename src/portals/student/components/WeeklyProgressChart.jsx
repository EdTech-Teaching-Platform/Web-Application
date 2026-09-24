// WeeklyProgressChart — new component, MINUTO-reference-inspired weekly
// line/area chart with a day-of-week axis and a hover tooltip on data
// points. Not in the LMS doc's literal Section 15 feature list — an
// enrichment layered on top of "progress bars" per the density this
// ticket asked for. Built with only --color-primary (line + a translucent
// fill of the same token, no gradient/foreign hue) so the palette rule
// holds; area fill is a flat `fill-primary/10`, not a gradient.
import { useState } from "react";

export default function WeeklyProgressChart({ data = [] }) {
  const [hoverIndex, setHoverIndex] = useState(null);
  if (data.length === 0) return null;

  const w = 600;
  const h = 180;
  const padX = 20;
  const padY = 20;
  const max = Math.max(...data.map((d) => d.value), 1);

  const coords = data.map((d, i) => {
    const x = padX + (i / (data.length - 1)) * (w - padX * 2);
    const y = h - padY - (d.value / max) * (h - padY * 2);
    return { x, y, ...d };
  });

  const linePath = coords.map((c, i) => `${i === 0 ? "M" : "L"}${c.x},${c.y}`).join(" ");
  const areaPath = `${linePath} L${coords[coords.length - 1].x},${h - padY} L${coords[0].x},${h - padY} Z`;

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        <path d={areaPath} className="fill-primary/10" stroke="none" />
        <path d={linePath} fill="none" className="stroke-primary" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        {coords.map((c, i) => (
          <circle
            key={c.day}
            cx={c.x}
            cy={c.y}
            r={hoverIndex === i ? 6 : 4}
            className="cursor-pointer fill-primary"
            onMouseEnter={() => setHoverIndex(i)}
            onMouseLeave={() => setHoverIndex(null)}
          />
        ))}
      </svg>
      <div className="mt-1 flex justify-between px-1 text-xs text-text/50">
        {data.map((d) => (
          <span key={d.day}>{d.day}</span>
        ))}
      </div>
      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute -translate-x-1/2 -translate-y-full rounded-lg bg-text px-2 py-1 text-xs font-medium text-white"
          style={{
            left: `${(coords[hoverIndex].x / w) * 100}%`,
            top: `${(coords[hoverIndex].y / h) * 100}%`,
          }}
        >
          {data[hoverIndex].value} min
        </div>
      )}
    </div>
  );
}
