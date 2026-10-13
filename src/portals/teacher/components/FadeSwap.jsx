import { useEffect, useState } from "react";

// FadeSwap — enter transition for content that swaps in place (month
// pagination, calendar view/range changes). Each time `swapKey` changes
// the wrapper restarts from opacity-0 + a small horizontal offset (in the
// `direction` of travel) and eases to rest. Opacity/transform only,
// ease-out, and skipped entirely under prefers-reduced-motion.
export default function FadeSwap({ swapKey, direction = 1, className = "", children }) {
  const [entered, setEntered] = useState(true);

  useEffect(() => {
    setEntered(false);
    const raf = requestAnimationFrame(() => setEntered(true));
    return () => cancelAnimationFrame(raf);
  }, [swapKey]);

  const from = direction >= 0 ? "motion-safe:translate-x-3" : "motion-safe:-translate-x-3";
  return (
    <div
      className={`transition-all duration-200 ease-out motion-reduce:transition-none ${entered ? "translate-x-0 opacity-100" : `${from} opacity-0`} ${className}`}
    >
      {children}
    </div>
  );
}
