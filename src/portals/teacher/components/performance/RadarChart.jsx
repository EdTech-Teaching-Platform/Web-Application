// Small radar chart: student polygon (maroon) against the cohort average (gold dashed).
const SIZE = 280;
const C = SIZE / 2;
const R = 88;

export default function RadarChart({ axes }) {
  const n = axes.length;
  const ang = (i) => -Math.PI / 2 + (i * 2 * Math.PI) / n;
  const pt = (i, v) => [C + Math.cos(ang(i)) * R * (Math.max(0, Math.min(100, v ?? 0)) / 100), C + Math.sin(ang(i)) * R * (Math.max(0, Math.min(100, v ?? 0)) / 100)];
  const poly = (key) => axes.map((a, i) => pt(i, a[key]).map((v) => v.toFixed(1)).join(",")).join(" ");
  return (
    <figure>
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="mx-auto w-full max-w-[18rem]" role="img" aria-label={`Section radar. ${axes.map((a) => `${a.label}: student ${a.mine ?? "no data"}%, cohort ${a.cohort}%`).join("; ")}`}>
        {[25, 50, 75, 100].map((ring) => (
          <polygon key={ring} points={axes.map((_, i) => pt(i, ring).map((v) => v.toFixed(1)).join(",")).join(" ")} fill="none" stroke="currentColor" className="text-text/[0.1]" />
        ))}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 100);
          const [lx, ly] = [C + Math.cos(ang(i)) * (R + 16), C + Math.sin(ang(i)) * (R + 16)];
          const anchor = Math.abs(Math.cos(ang(i))) < 0.2 ? "middle" : Math.cos(ang(i)) > 0 ? "start" : "end";
          return (
            <g key={a.label}>
              <line x1={C} y1={C} x2={x} y2={y} stroke="currentColor" className="text-text/[0.1]" />
              <text x={lx} y={ly + 3} textAnchor={anchor} className="fill-muted text-[9px] font-medium">{a.label.length > 16 ? `${a.label.slice(0, 15)}…` : a.label}</text>
            </g>
          );
        })}
        <polygon points={poly("cohort")} className="fill-secondary/10 stroke-secondary" strokeWidth={2} strokeDasharray="4 3" />
        <polygon points={poly("mine")} className="fill-primary/15 stroke-primary" strokeWidth={2.5} strokeLinejoin="round">
          <title>Student section scores</title>
        </polygon>
        {axes.map((a, i) => { const [x, y] = pt(i, a.mine); return <circle key={a.label} cx={x} cy={y} r={3.5} className="fill-primary"><title>{`${a.label}: ${a.mine ?? "no data"}%`}</title></circle>; })}
      </svg>
      <figcaption className="mt-1 flex justify-center gap-4 text-xs font-medium text-muted">
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-primary" /> This student</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-secondary" /> Cohort average</span>
      </figcaption>
    </figure>
  );
}
