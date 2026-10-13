import { useEffect, useId, useRef, useState } from "react";
import { joinState } from "../data/liveJoin";
import { LockIcon, PlayIcon } from "../../../components/ui/icons";

// JoinSessionButton — the one Join control for every live class entry
// point. All unlock rules come from data/liveJoin.js's joinState, so the
// Live Classes panel/calendar, Availability upcoming/agenda and the
// booking drawer can never disagree.
//   locked : aria-disabled (stays focusable so the tooltip shows on
//            keyboard focus too), lock icon, hover/focus tooltip + title.
//   open   : prominent maroon pill with a subtle pulse ring (opacity/
//            transform only, motion-safe) and a pop when it flips open.
//   ended  : quiet disabled pill.
// `now` comes from the parent's useNow() so the whole list ticks together.
export default function JoinSessionButton({ session, now, onJoin, size = "md", fullWidth = false, className = "" }) {
  const js = joinState(session, now);
  const tipId = useId();
  const prev = useRef(js.state);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (prev.current !== js.state) {
      prev.current = js.state;
      setPop(true);
      const t = window.setTimeout(() => setPop(false), 600);
      return () => window.clearTimeout(t);
    }
    return undefined;
  }, [js.state]);

  const sizing = size === "sm" ? "px-3 py-1.5 text-xs" : size === "lg" ? "px-5 py-3 text-sm" : "px-4 py-2 text-xs";
  const width = fullWidth ? "w-full" : "";
  const base = `relative inline-flex items-center justify-center gap-1.5 rounded-full font-semibold transition-all duration-300 ${sizing} ${width}`;

  if (js.state === "ended") {
    return (
      <button type="button" aria-disabled="true" disabled className={`${base} cursor-not-allowed bg-text/[0.06] text-text/35 ${className}`}>
        Ended
      </button>
    );
  }

  if (js.state === "locked") {
    return (
      <span className={`group relative inline-flex ${width}`}>
        <button
          type="button"
          aria-disabled="true"
          aria-describedby={tipId}
          title={js.reason}
          onClick={(e) => e.preventDefault()}
          className={`${base} cursor-not-allowed bg-text/[0.06] text-text/45 ${pop ? "motion-safe:animate-[celebrate-pop_0.5s_ease-out]" : ""} ${className}`}
        >
          <LockIcon className="h-3.5 w-3.5" />
          Locked
        </button>
        <span
          id={tipId}
          role="tooltip"
          className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-1.5 w-max max-w-[220px] -translate-x-1/2 translate-y-1 rounded-xl bg-text px-3 py-2 text-center text-[11px] font-medium leading-snug text-white opacity-0 shadow-lg transition-all duration-150 group-focus-within:translate-y-0 group-focus-within:opacity-100 group-hover:translate-y-0 group-hover:opacity-100"
        >
          {js.reason}
        </span>
      </span>
    );
  }

  const live = session.liveClass?.status === "live";
  return (
    <span className={`relative inline-flex ${width}`}>
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-full bg-primary/30 motion-safe:animate-ping motion-safe:[animation-duration:2.4s]"
      />
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onJoin?.(session);
        }}
        className={`${base} bg-primary text-white shadow-soft hover:-translate-y-0.5 hover:bg-primary/90 hover:shadow-glow-primary active:scale-[0.97] ${
          pop ? "motion-safe:animate-[celebrate-pop_0.5s_ease-out]" : ""
        } ${className}`}
      >
        <PlayIcon className="h-3.5 w-3.5" />
        {live ? "Join — Live now" : "Join Now"}
      </button>
    </span>
  );
}
