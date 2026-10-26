// "How it works" for the public landing page — the real student journey
// through a test series: find the series for your class and subject, enrol,
// sit the test, read the detailed report, improve. The five cards themselves
// are static (no entrance, lift or highlight animation). What moves is the
// small illustrative UI inside each card: every preview runs its own looping
// "live" demo (chips get picked, the enrol button is pressed, the timer runs
// and questions get answered, the score counts up, weak topics improve after a
// retake). A preview only plays while its card is on screen, and is shown in
// its finished state for visitors who prefer reduced motion. Colours come from
// the --lp-* variables set by landingTheme.js. opacity/transform, ease-out.
import { useCallback, useEffect, useRef, useState } from "react";
import { CheckCircleIcon, ClockIcon, TrendingUpIcon } from "../../../components/ui/icons";

const DISPLAY = "font-(family-name:--lp-font)";
const prefersReducedMotion = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Fade + rise helper for things inside a preview.
const appear = (on) =>
  `transition-[opacity,transform] duration-500 ease-out motion-reduce:transition-none ${on ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0"}`;

// True while the element is on screen (always true without IntersectionObserver).
function useInView(ref) {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof IntersectionObserver === "undefined") {
      setInView(true);
      return undefined;
    }
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.2 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref]);
  return inView;
}

// Loops 0..n-1 every `ms` while `live`. Paused off-screen; sits on `rest`
// (the finished-looking frame) before the first play and for reduced motion.
function useTicker(n, ms, live, rest) {
  const [tick, setTick] = useState(rest);
  useEffect(() => {
    if (!live || prefersReducedMotion()) return undefined;
    setTick(0);
    const id = setInterval(() => setTick((t) => (t + 1) % n), ms);
    return () => clearInterval(id);
  }, [live, n, ms]);
  return tick;
}

// Eased count from 0 to `to` while `active`; snaps back to 0 when it stops.
function useCountUp(active, to, ms = 1300) {
  const [value, setValue] = useState(to);
  useEffect(() => {
    if (!active) {
      setValue(0);
      return undefined;
    }
    if (prefersReducedMotion()) {
      setValue(to);
      return undefined;
    }
    let raf;
    let start = null;
    const tick = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / ms);
      setValue(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [active, to, ms]);
  return value;
}

// Eases a number from wherever it is now to `target`.
function useTween(target, ms = 900) {
  const [value, setValue] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (prefersReducedMotion()) {
      cur.current = target;
      setValue(target);
      return undefined;
    }
    const from = cur.current;
    let raf;
    let start = null;
    const tick = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / ms);
      const v = from + (target - from) * (1 - Math.pow(1 - p, 3));
      cur.current = v;
      setValue(Math.round(v));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return value;
}

function Chip({ children, active = false }) {
  return (
    <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${active ? "bg-(--lp-ink) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>
      {children}
    </span>
  );
}

const PREVIEW_ROOT =
  "flex h-full flex-1 flex-col justify-center gap-4 rounded-xl bg-white p-4 ring-1 ring-(--lp-line) lg:justify-between lg:gap-0 lg:p-3";

// 1 — chips get picked one by one, then the matching series slides in.
function FindPreview({ live }) {
  const t = useTicker(9, 650, live, 7);
  const chips = [["Class 11", true], ["Physics", true], ["CBSE", false]];
  return (
    <div className={PREVIEW_ROOT}>
      <div className="flex flex-wrap gap-1.5">
        {chips.map(([label, on], i) => (
          <span key={label} className={appear(t >= i + 1 && t < 8)}>
            <span className={`inline-block transition-transform duration-300 ease-out motion-reduce:transition-none ${t === i + 1 ? "scale-110" : "scale-100"}`}>
              <Chip active={on}>{label}</Chip>
            </span>
          </span>
        ))}
      </div>
      <div className={`relative overflow-hidden rounded-lg bg-(--lp-grey) p-3 ${appear(t >= 4 && t < 8)}`}>
        <p className="flex items-center gap-1.5 text-[11px] font-semibold text-(--lp-blue-deep)">
          <span className="relative inline-flex h-1.5 w-1.5">
            <span className="ul-pulse absolute inset-0 rounded-full bg-(--lp-blue)" aria-hidden="true" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-(--lp-blue)" />
          </span>
          Matches your class
        </p>
        <p className={`${DISPLAY} mt-0.5 text-sm font-bold leading-tight`}>Physics Mock Series</p>
        <p className="mt-1 text-[11px] text-(--lp-muted)">20 tests · chapter-wise + full-length</p>
        <span className="ul-sheen pointer-events-none absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/70 to-transparent" aria-hidden="true" />
      </div>
    </div>
  );
}

// 2 — perks tick in, the button is pressed and flips to Enrolled.
function EnrolPreview({ live }) {
  const t = useTicker(9, 650, live, 6);
  const done = t >= 5;
  return (
    <div className={PREVIEW_ROOT}>
      <p className={`${DISPLAY} text-sm font-bold leading-tight`}>Physics Mock Series</p>
      <ul className="mt-2 space-y-1 text-[11px] text-(--lp-muted)">
        {["20 timed tests", "Detailed report for each"].map((label, i) => (
          <li key={label} className={`flex items-center gap-1.5 ${appear(t >= i + 1)}`}>
            <CheckCircleIcon className={`h-3.5 w-3.5 text-(--lp-blue) transition-transform duration-300 ease-out motion-reduce:transition-none ${t >= i + 1 ? "scale-100" : "scale-50"}`} />
            {label}
          </li>
        ))}
      </ul>
      <span className="relative mt-3 block">
        {t >= 4 && t <= 5 && <span className="ul-ripple pointer-events-none absolute inset-0 rounded-full bg-(--lp-blue)" aria-hidden="true" />}
        <span
          className={`relative flex items-center justify-center gap-1.5 rounded-full py-2 text-center text-xs font-semibold text-white transition-[background-color,transform] duration-300 ease-out motion-reduce:transition-none ${
            done ? "scale-[1.02] bg-(--lp-blue)" : t === 4 ? "scale-95 bg-(--lp-ink)" : "scale-100 bg-(--lp-ink)"
          }`}
        >
          {done && <CheckCircleIcon className="h-3.5 w-3.5" />}
          {done ? "Enrolled" : "Enrol now"}
        </span>
      </span>
    </div>
  );
}

// 3 — the clock runs, an answer is picked, the palette advances to the next question.
function TestPreview({ live }) {
  const START = 34 * 60 + 28;
  const [left, setLeft] = useState(START);
  const t = useTicker(10, 650, live, 4);
  useEffect(() => {
    if (!live || prefersReducedMotion()) return undefined;
    const id = setInterval(() => setLeft((v) => (v > 60 ? v - 1 : START)), 1000);
    return () => clearInterval(id);
  }, [live, START]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  const moved = t >= 6; // answered Q12, now on Q13
  const cur = moved ? 13 : 12;
  const picked = moved ? (t >= 8 ? 2 : -1) : t >= 3 ? 1 : -1;
  const hover = !moved && t === 2 ? 1 : -1;
  return (
    <div className={PREVIEW_ROOT}>
      <div>
        <div className="flex items-center justify-between gap-2 text-[11px] font-semibold">
          <span className="whitespace-nowrap tabular-nums">Question {cur} / 50</span>
          <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-(--lp-ink) px-2 py-0.5 tabular-nums text-white">
            <ClockIcon className="h-3 w-3" /> {mm}:{ss}
          </span>
        </div>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-(--lp-blue-soft)">
          <div className={`h-full origin-left rounded-full bg-(--lp-blue) transition-[width] duration-700 ease-out motion-reduce:transition-none ${moved ? "w-[30%]" : "w-[24%]"}`} />
        </div>
      </div>
      {/* question + options placeholder so the card reads as a real test screen */}
      <div className="my-2 space-y-1.5" aria-hidden="true">
        <span className="block h-1.5 w-full rounded-full bg-(--lp-grey)" />
        <span className={`block h-1.5 rounded-full bg-(--lp-grey) transition-[width] duration-500 ease-out motion-reduce:transition-none ${moved ? "w-4/5" : "w-2/3"}`} />
        <div className="grid grid-cols-2 gap-1.5 pt-1">
          {[0, 1, 2, 3].map((i) => (
            <span
              key={i}
              className={`h-5 rounded-md ring-1 transition-[background-color,box-shadow] duration-300 ease-out motion-reduce:transition-none ${
                picked === i ? "bg-(--lp-blue-soft) ring-2 ring-(--lp-blue)" : hover === i ? "bg-white ring-2 ring-(--lp-blue)/40" : "bg-white ring-(--lp-line)"
              }`}
            />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-8 gap-1">
        {Array.from({ length: 16 }, (_, i) => i + 1).map((n) => {
          const answered = n <= 8 || (moved && n === 12);
          const isCur = n === cur;
          return (
            <span
              key={n}
              className={`grid aspect-square place-items-center rounded-md text-[9px] font-bold transition-[background-color,color,transform] duration-300 ease-out motion-reduce:transition-none ${
                isCur ? "scale-110 bg-(--lp-ink) text-white" : answered ? "bg-(--lp-blue) text-white" : n === 9 ? "bg-(--lp-yellow) text-(--lp-ink)" : "bg-(--lp-grey) text-(--lp-muted)"
              }`}
            >
              {n}
            </span>
          );
        })}
      </div>
    </div>
  );
}

// 4 — the score ring fills, correct count climbs, the bars grow; then it replays.
function ReportPreview({ live }) {
  const t = useTicker(9, 700, live, 3);
  const active = t >= 1 && t < 8;
  const pct = useCountUp(active, 82);
  const correct = useCountUp(active, 33);
  return (
    <div className={PREVIEW_ROOT}>
      <div className="flex items-center gap-3">
        <span className="grid h-14 w-14 shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(var(--lp-blue) 0 ${pct}%, var(--lp-blue-soft) ${pct}% 100%)` }}>
          <span className={`${DISPLAY} grid h-10 w-10 place-items-center rounded-full bg-white text-sm font-bold tabular-nums`}>{pct}%</span>
        </span>
        <span className="leading-tight">
          <span className="block whitespace-nowrap text-xs font-semibold tabular-nums">{correct} / 40 correct</span>
          <span className="whitespace-nowrap text-[11px] text-(--lp-muted)">Final assessment</span>
        </span>
      </div>
      <div className="mt-3 space-y-1.5">
        {[["Accuracy", 82, "w-[82%]"], ["Attempted", 95, "w-[95%]"], ["Speed", 64, "w-[64%]"]].map(([l, v, w], i) => (
          <div key={l} className="flex items-center gap-2 text-[10px] text-(--lp-muted)">
            <span className="w-14 shrink-0">{l}</span>
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--lp-grey)">
              <span
                className={`block h-full origin-left rounded-full bg-(--lp-blue) transition-transform duration-1000 ease-out motion-reduce:transition-none ${w} ${active ? "scale-x-100" : "scale-x-0"}`}
                style={{ transitionDelay: active ? `${300 + i * 150}ms` : "0ms" }}
              />
            </span>
            <span className="w-7 text-right tabular-nums">{active ? `${v}%` : "–"}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// 5 — weak topics show, "Retake" is pressed, and the scores climb.
function ImprovePreview({ live }) {
  const t = useTicker(11, 650, live, 10);
  const improved = t >= 7;
  const topics = [["Rotational motion", 41, 67], ["Thermodynamics", 58, 74]];
  const a = useTween(improved ? topics[0][2] : topics[0][1]);
  const b = useTween(improved ? topics[1][2] : topics[1][1]);
  const shown = [a, b];
  return (
    <div className={PREVIEW_ROOT}>
      <p className="text-[11px] font-semibold uppercase tracking-wider text-(--lp-muted)">Revise next</p>
      <ul className="mt-2 space-y-2">
        {topics.map(([label], i) => (
          <li key={label} className={`flex items-center justify-between gap-2 text-xs ${appear(t >= i + 1)}`}>
            <span className="font-medium">{label}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums transition-[background-color,color,transform] duration-500 ease-out motion-reduce:transition-none ${
                improved ? "scale-105 bg-(--lp-blue) text-white" : "scale-100 bg-(--lp-yellow) text-(--lp-ink)"
              }`}
            >
              {shown[i]}%
            </span>
          </li>
        ))}
      </ul>
      <div
        className={`mt-3 flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold transition-[background-color,color,transform] duration-300 ease-out motion-reduce:transition-none ${
          t === 5 ? "scale-95 bg-(--lp-blue-soft) text-(--lp-blue-deep)" : t >= 6 ? "scale-100 bg-(--lp-blue) text-white" : "scale-100 bg-(--lp-blue-soft) text-(--lp-blue-deep)"
        }`}
      >
        <TrendingUpIcon className={`h-3.5 w-3.5 transition-transform duration-500 ease-out motion-reduce:transition-none ${improved ? "-translate-y-0.5" : "translate-y-0"}`} /> Retake and compare scores
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

// One static card. It never animates itself; it only tells its preview
// whether it is on screen so the demo inside can play.
function StepCard({ index, step, last }) {
  const ref = useRef(null);
  const live = useInView(ref);
  const { title, text, Preview } = step;
  return (
    <li ref={ref} className="relative flex w-[80%] shrink-0 snap-center flex-col sm:w-auto sm:shrink">
      {!last && (
        <span className="pointer-events-none absolute left-10 top-5 hidden h-0.5 w-[calc(100%_-_1.25rem)] overflow-hidden rounded-full lg:block" aria-hidden="true">
          <span className={`block h-full w-full ${index === STEPS.length - 2 ? "bg-gradient-to-r from-(--lp-blue) to-(--lp-yellow)" : "bg-(--lp-blue)"}`} />
        </span>
      )}
      <span className="relative z-10 grid h-10 w-10 place-items-center">
        <span
          className={`${DISPLAY} relative grid h-10 w-10 place-items-center rounded-full text-sm font-bold ring-8 ring-white ${
            last ? "bg-(--lp-yellow) text-(--lp-ink)" : "bg-(--lp-ink) text-white"
          }`}
        >
          {index + 1}
        </span>
      </span>
      <div className="mt-5 flex flex-1 flex-col rounded-[22px] bg-(--lp-grey) p-4">
        <div className="flex min-h-[190px] flex-1 flex-col lg:block lg:h-[212px] lg:flex-none">
          <Preview live={live} />
        </div>
        <h3 className={`${DISPLAY} mt-5 text-lg font-bold tracking-tight`}>{title}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-(--lp-muted)">{text}</p>
      </div>
    </li>
  );
}

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
      <style>{`
        @keyframes ul-ripple { from { opacity: 0.45; transform: scale(0.7); } to { opacity: 0; transform: scale(1.35); } }
        @keyframes ul-pulse { 0% { opacity: 0.6; transform: scale(1); } 100% { opacity: 0; transform: scale(2.6); } }
        @keyframes ul-sheen { 0% { opacity: 0; transform: translateX(-120%); } 20% { opacity: 1; } 60%, 100% { opacity: 0; transform: translateX(360%); } }
        .ul-ripple { animation: ul-ripple 0.7s ease-out 1 both; }
        .ul-pulse { animation: ul-pulse 1.6s ease-out infinite; }
        .ul-sheen { animation: ul-sheen 3.2s ease-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ul-ripple, .ul-pulse, .ul-sheen { animation: none; opacity: 0; } }
      `}</style>
      {/* phones: a swipeable row of cards (keeps the page short); sm+: the grid */}
      <ol ref={listRef} onScroll={measure} className="-mx-5 flex snap-x snap-mandatory gap-4 overflow-x-auto px-5 pb-4 [-ms-overflow-style:none] [scrollbar-width:none] sm:mx-0 sm:grid sm:snap-none sm:grid-cols-2 sm:gap-8 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-5 lg:gap-5 [&::-webkit-scrollbar]:hidden">
        {STEPS.map((step, i) => (
          <StepCard key={step.title} index={i} step={step} last={i === STEPS.length - 1} />
        ))}
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
