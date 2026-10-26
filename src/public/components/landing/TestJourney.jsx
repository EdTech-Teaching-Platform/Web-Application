// "How it works" for the public landing page — the real student journey
// through a test series: find the series for your class and subject, enrol,
// sit the test, read the detailed report, improve. Each step shows a small,
// illustrative UI preview (placeholder data, not live screens). Colours come
// from the --lp-* variables set by landingTheme.js on the landing wrapper.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircleIcon, ClockIcon, TrendingUpIcon } from "../../../components/ui/icons";

const DISPLAY = "font-(family-name:--lp-font)";

function Chip({ children, active = false }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-(--lp-ink) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>
      {children}
    </span>
  );
}

function FindPreview() {
  return (
    <div className={"flex h-full flex-col justify-between rounded-xl bg-white p-3 ring-1 ring-(--lp-line)"}>
      <div className="flex flex-wrap gap-1.5">
        <Chip active>Class 11</Chip>
        <Chip active>Physics</Chip>
        <Chip>CBSE</Chip>
      </div>
      <div className="rounded-lg bg-(--lp-grey) p-3">
        <p className="text-[11px] font-semibold text-(--lp-blue-deep)">Matches your class</p>
        <p className={`${DISPLAY} mt-0.5 text-sm font-bold leading-tight`}>Physics Mock Series</p>
        <p className="mt-1 text-[11px] text-(--lp-muted)">20 tests · chapter-wise + full-length</p>
      </div>
    </div>
  );
}

function EnrolPreview() {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl bg-white p-3 ring-1 ring-(--lp-line)">
      <p className={`${DISPLAY} text-sm font-bold leading-tight`}>Physics Mock Series</p>
      <ul className="mt-2 space-y-1 text-[11px] text-(--lp-muted)">
        <li className="flex items-center gap-1.5"><CheckCircleIcon className="h-3.5 w-3.5 text-(--lp-blue)" />20 timed tests</li>
        <li className="flex items-center gap-1.5"><CheckCircleIcon className="h-3.5 w-3.5 text-(--lp-blue)" />Detailed report for each</li>
      </ul>
      <span className="mt-3 block rounded-full bg-(--lp-ink) py-2 text-center text-xs font-semibold text-white">Enrol now</span>
    </div>
  );
}

function TestPreview() {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl bg-white p-3 ring-1 ring-(--lp-line)">
      <div>
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
          <span className="whitespace-nowrap">Question 12 / 50</span>
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-(--lp-ink) px-2 py-0.5 tabular-nums text-white">
            <ClockIcon className="h-3 w-3" /> 34:28
          </span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-(--lp-blue-soft)"><div className="h-full w-[24%] rounded-full bg-(--lp-blue)" /></div>
      </div>
      {/* question + options placeholder so the card reads as a real test screen */}
      <div className="my-2 space-y-1.5" aria-hidden="true">
        <span className="block h-1.5 w-full rounded-full bg-(--lp-grey)" />
        <span className="block h-1.5 w-2/3 rounded-full bg-(--lp-grey)" />
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {[false, true, false, false].map((picked, i) => (
            <span key={i} className={`h-5 rounded-md ring-1 ${picked ? "bg-(--lp-blue-soft) ring-(--lp-blue)" : "bg-white ring-(--lp-line)"}`} />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={`grid aspect-square place-items-center rounded-md text-[9px] font-bold ${
              n <= 8 ? "bg-(--lp-blue) text-white" : n === 12 ? "bg-(--lp-ink) text-white" : n === 9 ? "bg-(--lp-yellow) text-(--lp-ink)" : "bg-(--lp-grey) text-(--lp-muted)"
            }`}
          >
            {n}
          </span>
        ))}
      </div>
    </div>
  );
}

function ReportPreview() {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl bg-white p-3 ring-1 ring-(--lp-line)">
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(var(--lp-blue) 0 82%, var(--lp-blue-soft) 82% 100%)" }}>
          <span className={`${DISPLAY} grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-bold`}>82%</span>
        </span>
        <span className="leading-tight">
          <span className="block whitespace-nowrap text-xs font-semibold">33 / 40 correct</span>
          <span className="whitespace-nowrap text-[11px] text-(--lp-muted)">Final assessment</span>
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {[["Accuracy", "82%", "w-[82%]"], ["Attempted", "95%", "w-[95%]"], ["Speed", "64%", "w-[64%]"]].map(([l, v, w]) => (
          <div key={l} className="flex items-center gap-2 text-[10px] text-(--lp-muted)">
            <span className="w-14 shrink-0">{l}</span>
            <span className="h-1.5 flex-1 rounded-full bg-(--lp-grey)"><span className={`block h-full rounded-full bg-(--lp-blue) ${w}`} /></span>
            <span className="w-7 text-right tabular-nums">{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ImprovePreview() {
  return (
    <div className="flex h-full flex-col justify-between rounded-xl bg-white p-3 ring-1 ring-(--lp-line)">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-(--lp-muted)">Revise next</p>
      <ul className="mt-2 space-y-2">
        {[["Rotational motion", "41%"], ["Thermodynamics", "58%"]].map(([t, v]) => (
          <li key={t} className="flex items-center justify-between gap-2 text-xs">
            <span className="font-medium">{t}</span>
            <span className="rounded-full bg-(--lp-yellow) px-2 py-0.5 text-[10px] font-bold tabular-nums">{v}</span>
          </li>
        ))}
      </ul>
      <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-(--lp-blue-soft) px-2.5 py-2 text-[11px] font-semibold text-(--lp-blue-deep)">
        <TrendingUpIcon className="h-3.5 w-3.5" /> Retake and compare scores
      </div>
    </div>
  );
}

const STEPS = [
  { title: "Find your series", text: "Browse test series matched to your class and subject.", Preview: FindPreview },
  { title: "Enrol", text: "Enrol in a few taps. The tests unlock in your dashboard.", Preview: EnrolPreview },
  { title: "Take the test", text: "Timed like the real exam, with a palette to track every question.", Preview: TestPreview },
  { title: "Get your report", text: "A per-question breakdown of accuracy, time and weak topics.", Preview: ReportPreview },
  { title: "Improve", text: "Revise what the report flagged, retake, and watch the score climb.", Preview: ImprovePreview },
];

export default function TestJourney() {
  // Phones scroll this row sideways; the bar below shows where you are in it.
  const listRef = useRef(null);
  const [pos, setPos] = useState({ thumb: 1, progress: 0 });
  const measure = useCallback(() => {
    const el = listRef.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPos({
      thumb: el.scrollWidth > 0 ? Math.min(1, el.clientWidth / el.scrollWidth) : 1,
      progress: max > 0 ? Math.min(1, Math.max(0, el.scrollLeft / max)) : 0,
    });
  }, []);
  useEffect(() => {
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [measure]);

  return (
    <div className="mt-14">
      {/* phones: a swipeable row of cards (keeps the page short); sm+: the grid */}
      <ol ref={listRef} onScroll={measure} className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-8 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 lg:gap-5 [&::-webkit-scrollbar]:hidden">
        {STEPS.map(({ title, text, Preview }, i) => {
          const last = i === STEPS.length - 1;
          return (
            <li key={title} className="relative flex w-[80%] shrink-0 snap-center flex-col sm:w-auto sm:shrink">
              {!last && (
                <span
                  className={`pointer-events-none absolute left-10 top-5 hidden h-0.5 w-[calc(100%_-_1.25rem)] lg:block ${i === STEPS.length - 2 ? "bg-gradient-to-r from-(--lp-blue) to-(--lp-yellow)" : "bg-(--lp-blue)"}`}
                  aria-hidden="true"
                />
              )}
              <span
                className={`${DISPLAY} relative z-10 grid h-10 w-10 place-items-center rounded-full text-sm font-bold ring-8 ring-white ${last ? "bg-(--lp-yellow) text-(--lp-ink)" : "bg-(--lp-ink) text-white"}`}
              >
                {i + 1}
              </span>
              <div className="mt-5 flex flex-1 flex-col rounded-[22px] bg-(--lp-grey) p-4">
                <div className="h-[212px]">
                  <Preview />
                </div>
                <h3 className={`${DISPLAY} mt-5 text-lg font-bold tracking-tight`}>{title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-(--lp-muted)">{text}</p>
              </div>
            </li>
          );
        })}
      </ol>
      <div className="mx-auto mt-2 h-1.5 w-40 overflow-hidden rounded-full bg-(--lp-ink)/10 sm:hidden" aria-hidden="true">
        <div
          className="h-full rounded-full bg-(--lp-ink) transition-[margin] duration-150 ease-out"
          style={{ width: `${pos.thumb * 100}%`, marginLeft: `${pos.progress * (1 - pos.thumb) * 100}%` }}
        />
      </div>
    </div>
  );
}
