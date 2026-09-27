import { useEffect, useRef, useState } from "react";

// StatCard — design.md Section 4: no border/box, large --font-display
// numeral in --color-text, small muted label underneath. Numeral count-up
// runs once on scroll into view (~800ms ease-out, per the motion table) —
// used on Student Dashboard "Progress Overview" and the Landing page
// "Platform stats" row.
function useCountUp(target, active) {
  const [value, setValue] = useState(0);

  useEffect(() => {
    if (!active) return;
    const numericTarget = Number(target);
    if (!Number.isFinite(numericTarget)) return;

    const duration = 800;
    const start = performance.now();

    let frame;
    const tick = (now) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out cubic
      setValue(Math.round(numericTarget * eased));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, active]);

  return value;
}

export default function StatCard({ value, label, suffix = "" }) {
  const ref = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          observer.disconnect(); // count up once, never re-trigger
        }
      },
      { threshold: 0.4 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const isNumeric = typeof value === "number";
  const animated = useCountUp(isNumeric ? value : 0, inView && isNumeric);

  return (
    <div ref={ref} className="flex flex-col gap-1">
      <span className="font-display text-3xl font-bold text-text sm:text-4xl">
        {isNumeric ? animated.toLocaleString() : value}
        {suffix}
      </span>
      <span className="text-xs uppercase tracking-wide text-text/50">{label}</span>
    </div>
  );
}
