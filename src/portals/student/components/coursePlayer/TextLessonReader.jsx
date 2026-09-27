import { useEffect, useRef, useState } from "react";
import Button from "../../../../components/ui/Button";
import { CheckIcon } from "../../../../components/ui/icons";
import { textBodyFor } from "./lessonContent";

// Text Lesson Reader (spec Section 5) — comfortable reading width, clear
// typography, a real scroll-driven reading-progress indicator (not a
// fake/simulated one), and manual completion.
export default function TextLessonReader({ lesson, moduleTitle, isCompleted, onMarkComplete }) {
  const containerRef = useRef(null);
  const [readPercent, setReadPercent] = useState(0);
  const paragraphs = textBodyFor(lesson, moduleTitle);

  useEffect(() => {
    setReadPercent(0);
    const el = containerRef.current;
    if (!el) return;

    function onScroll() {
      const scrollable = el.scrollHeight - el.clientHeight;
      const percent = scrollable > 0 ? Math.min(100, Math.round((el.scrollTop / scrollable) * 100)) : 100;
      setReadPercent((prev) => Math.max(prev, percent));
    }

    el.addEventListener("scroll", onScroll);
    onScroll();
    return () => el.removeEventListener("scroll", onScroll);
  }, [lesson.id]);

  return (
    <div>
      <div className="mb-3 flex items-center justify-between px-1">
        <p className="text-xs font-semibold uppercase tracking-wide text-text/40">Reading progress</p>
        <p className="text-xs font-semibold text-primary">{readPercent}%</p>
      </div>
      <div className="mb-4 h-1.5 overflow-hidden rounded-full bg-text/10">
        <div className="h-full rounded-full bg-primary transition-[width] duration-300 ease-out" style={{ width: `${readPercent}%` }} />
      </div>

      <div
        ref={containerRef}
        className="max-h-[520px] overflow-y-auto rounded-2xl bg-white p-6 sm:p-8"
      >
        <div className="mx-auto max-w-[62ch]">
          <h1 className="mb-5 font-display text-2xl font-bold leading-tight text-text">{lesson.title}</h1>
          <div className="space-y-4 font-body text-[15px] leading-relaxed text-text/75">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {isCompleted ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-success">
            <CheckIcon className="h-4 w-4" /> Lesson completed
          </p>
        ) : (
          <Button fullWidth={false} onClick={onMarkComplete}>
            Mark as Complete
          </Button>
        )}
      </div>
    </div>
  );
}
