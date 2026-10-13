import { TrendingUpIcon, TrendingDownIcon } from "./icons";
import IconBadge from "./IconBadge";
import ProgressRing from "./ProgressRing";

// StatCard — compact metric tile for dashboard summary rows. Redesign: large
// rounded white card floating on the peach canvas (soft shadow, no border),
// the icon sits in a pastel IconBadge (`tone`: maroon|blue|sage|lavender|
// orange|pink, default maroon), and an optional `ring` (0-100) swaps the
// plain big number for a ProgressRing next to the value — use it when a
// percentage is the key figure. All new props are optional/additive.
//
// Usage:
//   <StatCard icon={UsersIcon} tone="blue" label="Total Students" value="2,408" trend={{ direction: "up", label: "+12% this month" }} />
//   <StatCard icon={ChartIcon} label="Completion" value="72%" ring={72} />
//
// "action" is an optional slot rendered inside the card, under the label.
// `hero` is the display-number treatment for the one most important stat.
export default function StatCard({
  icon: Icon,
  label,
  value,
  trend,
  action,
  hero = false,
  tone = "maroon",
  ring,
  className = "",
}) {
  const hasRing = typeof ring === "number" && !Number.isNaN(ring);
  return (
    <div
      className={`motion-safe:animate-[rise-in_0.4s_ease-out_both] flex h-full flex-col rounded-3xl bg-surface p-6 shadow-soft transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card ${className}`}
    >
      <div className="flex items-center justify-between">
        {Icon && <IconBadge icon={Icon} tone={tone} />}
        {trend && (
          <span
            className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${
              trend.direction === "down"
                ? "bg-pastel-pink text-pastel-pink-ink"
                : "bg-pastel-sage text-pastel-sage-ink"
            }`}
          >
            {trend.direction === "down" ? <TrendingDownIcon /> : <TrendingUpIcon />}
            {trend.label}
          </span>
        )}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div
            className={
              hero
                ? "gradient-text-hero bg-clip-text text-4xl font-bold tracking-tight text-transparent"
                : "text-3xl font-bold tracking-tight text-text"
            }
          >
            {value}
          </div>
          <div className="mt-1 text-sm text-muted">{label}</div>
        </div>
        {hasRing && <ProgressRing value={ring} size={64} showValue={false} />}
      </div>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
