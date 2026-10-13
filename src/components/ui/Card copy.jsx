// Generic panel (redesign): large 24px radius, white surface floating on the
// peach canvas via a soft warm shadow instead of a hard border, generous
// padding. Callers that pass their own `p-*` / `rounded-*` in className still
// override via the usual Tailwind cascade order they already relied on.
export default function Card({ children, className = "" }) {
  return <div className={`rounded-3xl bg-surface p-6 shadow-soft ${className}`}>{children}</div>;
}
