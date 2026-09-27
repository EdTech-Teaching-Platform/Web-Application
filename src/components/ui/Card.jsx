// Generic panel per design.md Section 3 (Shape & Elevation): 16-20px radius,
// no border/shadow by default — separation comes from bg contrast.
export default function Card({ children, className = "" }) {
  return <div className={`rounded-2xl bg-bg p-4 ${className}`}>{children}</div>;
}
