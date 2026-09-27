import { useEffect, useRef } from "react";
import { formatSeconds, transcriptFor } from "./lessonContent";

// Transcript tab (spec Section 3) — clickable timestamps seek the video,
// the segment containing the current playhead is highlighted and
// auto-scrolled into view. Only rendered for video lessons; when
// `transcriptFor` has no data for this lesson, shows the plain
// unavailable message rather than fabricating transcript text — spec is
// explicit: "Do not create fake transcript functionality if the backend
// does not support it."
export default function TranscriptTab({ lesson, currentTime, duration, onSeek }) {
  const segments = transcriptFor(lesson);
  const activeRef = useRef(null);

  const activeIndex = segments
    ? segments.reduce((acc, seg, i) => {
        const startSec = (seg.startPercent / 100) * (duration || 0);
        return currentTime >= startSec ? i : acc;
      }, 0)
    : -1;

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  }, [activeIndex]);

  if (!segments) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center">
        <p className="text-sm text-text/50">Transcript unavailable for this lesson.</p>
      </div>
    );
  }

  return (
    <div className="max-h-[420px] overflow-y-auto rounded-2xl bg-white p-2">
      {segments.map((seg, i) => {
        const startSec = (seg.startPercent / 100) * (duration || 0);
        const active = i === activeIndex;
        return (
          <button
            key={seg.id}
            ref={active ? activeRef : undefined}
            type="button"
            onClick={() => onSeek(startSec)}
            className={`flex w-full items-start gap-3 rounded-xl px-3 py-2.5 text-left transition-colors duration-150 ${
              active ? "bg-primary/10" : "hover:bg-text/5"
            }`}
          >
            <span className={`shrink-0 text-xs font-semibold tabular-nums ${active ? "text-primary" : "text-text/40"}`}>
              {formatSeconds(startSec)}
            </span>
            <span className={`text-sm leading-relaxed ${active ? "font-medium text-text" : "text-text/65"}`}>{seg.text}</span>
          </button>
        );
      })}
    </div>
  );
}
