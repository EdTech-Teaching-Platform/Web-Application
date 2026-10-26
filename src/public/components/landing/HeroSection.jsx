// Landing hero, focused on test series. Centred layout: logo mark, headline,
// line, entry buttons and search, framed by two clusters of floating product
// cards: the test screen (question + palette) on the left and the result
// (report + attempt history) on the right. Cards are decorative — sample
// figures only. Then the ticker strip.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { SearchIcon, ClockIcon, CheckIcon } from "../../../components/ui/icons";
import { Reveal, PillButton, ArrowUpRight, Squiggle } from "./LandingUI";
import { useAuth } from "../../../hooks/useAuth";
import { homePathForUser } from "../../../utils/roles";

// Gentle float for the cards; respects reduced-motion.
const FLOAT_CSS = `
@keyframes ul-float-a { 0%,100% { transform: translateY(0) rotate(var(--r, 0deg)); } 50% { transform: translateY(-6px) rotate(var(--r, 0deg)); } }
@keyframes ul-float-b { 0%,100% { transform: translateY(0) rotate(var(--r, 0deg)); } 50% { transform: translateY(6px) rotate(var(--r, 0deg)); } }
.ul-float-a { transform: rotate(var(--r, 0deg)); animation: ul-float-a 7s ease-in-out infinite; }
.ul-float-b { transform: rotate(var(--r, 0deg)); animation: ul-float-b 8s ease-in-out infinite; }
@keyframes ul-drift { 0%,100% { transform: translate3d(0,0,0) rotate(var(--r, 0deg)); } 50% { transform: translate3d(var(--dx, 14px), var(--dy, -18px), 0) rotate(calc(var(--r, 0deg) + 6deg)); } }
.ul-drift { transform: rotate(var(--r, 0deg)); animation: ul-drift var(--dur, 24s) ease-in-out var(--delay, 0s) infinite; will-change: transform; }
@keyframes ul-rise { from { opacity: 0; transform: translateY(24px); } to { opacity: 1; transform: none; } }
.ul-rise { animation: ul-rise 0.95s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0s) both; }
@keyframes ul-draw { from { stroke-dasharray: 0 var(--c); } }
.ul-draw { animation: ul-draw 1.5s cubic-bezier(0.22, 1, 0.36, 1) 0.7s both; }
@keyframes ul-grow { from { transform: scaleX(0); } }
.ul-grow { transform-origin: left center; animation: ul-grow 1.2s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 0.8s) both; }
@keyframes ul-line { from { stroke-dashoffset: 1; } to { stroke-dashoffset: 0; } }
.ul-line { stroke-dasharray: 1; animation: ul-line 1.4s cubic-bezier(0.22, 1, 0.36, 1) 0.5s both; }
@keyframes ul-fade { from { opacity: 0; } }
.ul-fade { animation: ul-fade 0.9s ease-out var(--d, 0.6s) both; }
@keyframes ul-pop { from { opacity: 0; transform: scale(0); } }
.ul-pop { transform-box: fill-box; transform-origin: center; animation: ul-pop 0.5s cubic-bezier(0.22, 1, 0.36, 1) var(--d, 1s) both; }
@keyframes ul-swap { from { opacity: 0; transform: translateX(14px); } to { opacity: 1; transform: none; } }
.ul-swap { animation: ul-swap 0.5s cubic-bezier(0.22, 1, 0.36, 1) both; }
@media (prefers-reduced-motion: reduce) { .ul-float-a, .ul-float-b, .ul-drift, .ul-rise, .ul-draw, .ul-grow, .ul-line, .ul-fade, .ul-pop, .ul-swap { animation: none; } }
`;

function Sparkle({ className = "", style }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <path d="M12 0c.9 6.4 5.6 11.1 12 12-6.4.9-11.1 5.6-12 12-.9-6.4-5.6-11.1-12-12C6.4 11.1 11.1 6.4 12 0Z" fill="currentColor" />
    </svg>
  );
}

// Counts down from a mm:ss start so the sample test screen feels live. Static
// for visitors who prefer reduced motion.
function LiveTimer({ from = 42 * 60 + 10 }) {
  const [left, setLeft] = useState(from);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => setLeft((t) => (t > 60 ? t - 1 : from)), 1000);
    return () => clearInterval(id);
  }, [from]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return <>{mm}:{ss}</>;
}

// Search placeholder that cycles through real browse terms until the visitor
// focuses the field. Plain text swap, no animation.
const PLACEHOLDERS = ["Search by subject or exam", "Try \u201cMathematics\u201d", "Try \u201cScience\u201d", "Try \u201cSchool exams\u201d"];
function useRotatingPlaceholder(paused) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (paused) return undefined;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % PLACEHOLDERS.length), 3200);
    return () => clearInterval(id);
  }, [paused]);
  return paused ? PLACEHOLDERS[0] : PLACEHOLDERS[i];
}

const STRIP_ITEMS = [
  "Timed tests", "Instant scoring", "Detailed reports", "Attempt history",
  "Mock exams", "Retake attempts", "Practice tests", "Pass marks",
];

const CARD = "rounded-[18px] bg-white ring-1 ring-(--lp-line) shadow-[0_1px_0_rgba(15,17,21,0.04),0_28px_44px_-26px_rgba(15,17,21,0.32)]";

// Slow-drifting backdrop details: faint exam symbols and the E = mc²
// formula. Pure decoration; sits behind the copy and the cards.
const AMBIENT = [
  { ch: "π", pos: "left-[9%] top-[8%]", size: "text-6xl", tone: "text-(--lp-blue) opacity-[0.18]", dx: 16, dy: -20, r: -8, dur: 26, delay: 0 },
  { ch: "∑", pos: "right-[10%] top-[7%]", size: "text-7xl", tone: "text-(--lp-ink) opacity-[0.07]", dx: -14, dy: 18, r: 6, dur: 30, delay: -6 },
  { ch: "x²", pos: "left-[21%] top-[36%]", size: "text-4xl", tone: "text-(--lp-ink) opacity-[0.08]", dx: 12, dy: 16, r: 5, dur: 22, delay: -3 },
  { ch: "Δ", pos: "right-[19%] top-[40%]", size: "text-5xl", tone: "text-(--lp-blue) opacity-[0.16]", dx: -10, dy: -16, r: -6, dur: 28, delay: -11 },
  { ch: "%", pos: "right-[6%] bottom-[12%]", size: "text-6xl", tone: "text-(--lp-yellow) opacity-60", dx: -12, dy: -14, r: 8, dur: 25, delay: -8 },
  { ch: "√", pos: "left-[7%] bottom-[7%]", size: "text-6xl", tone: "text-(--lp-ink) opacity-[0.08]", dx: 14, dy: -12, r: -5, dur: 27, delay: -14 },
];

function Formula({ className = "", dur = 24, delay = 0 }) {
  return (
    <span
      className={`ul-drift absolute select-none font-(family-name:--lp-font) text-5xl font-bold italic leading-none tracking-tight text-(--lp-blue-deep) opacity-[0.2] ${className}`}
      style={{ "--dx": "12px", "--dy": "-16px", "--r": "-5deg", "--dur": `${dur}s`, "--delay": `${delay}s` }}
    >
      E = mc<sup className="text-[0.6em]">2</sup>
    </span>
  );
}

function AmbientLayer() {
  return (
    <div className="absolute inset-0 hidden overflow-hidden sm:block">
      {AMBIENT.map((g) => (
        <span
          key={g.ch}
          className={`ul-drift absolute select-none font-(family-name:--lp-font) font-bold leading-none ${g.pos} ${g.size} ${g.tone}`}
          style={{ "--dx": `${g.dx}px`, "--dy": `${g.dy}px`, "--r": `${g.r}deg`, "--dur": `${g.dur}s`, "--delay": `${g.delay}s` }}
        >
          {g.ch}
        </span>
      ))}
      <Formula className="bottom-[9%] left-[24%]" dur={25} delay={-5} />
      {/* small accents */}
      <span className="ul-drift absolute left-[30%] top-[16%] h-3 w-3 rounded-full bg-(--lp-yellow)" style={{ "--dx": "8px", "--dy": "16px", "--dur": "19s" }} />
      <span className="ul-drift absolute right-[31%] bottom-[16%] h-4 w-4 rounded-full ring-2 ring-(--lp-blue)/50" style={{ "--dx": "-10px", "--dy": "-12px", "--dur": "21s", "--delay": "-7s" }} />
      <Sparkle className="ul-drift absolute left-[14%] top-[27%] h-4 w-4 text-(--lp-blue)/60" style={{ "--dx": "6px", "--dy": "-10px", "--dur": "17s" }} />
      <Sparkle className="ul-drift absolute right-[13%] bottom-[30%] h-5 w-5 text-(--lp-yellow)" style={{ "--dx": "-6px", "--dy": "10px", "--dur": "20s", "--delay": "-4s" }} />
    </div>
  );
}

function LogoMark() {
  return (
    <span className="grid h-14 w-14 place-items-center rounded-full bg-white shadow-[0_14px_34px_-10px_rgba(15,17,21,0.3)] ring-1 sm:h-16 sm:w-16 ring-(--lp-line)">
      <span className="grid h-9 w-9 place-items-center rounded-full bg-(--lp-ink) text-white sm:h-10 sm:w-10">
        <span className="grid h-6 w-6 place-items-center rounded-full bg-(--lp-blue)">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
            <path d="M3 8l9-4 9 4-9 4-9-4Z" />
            <path d="M7 10.5V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
          </svg>
        </span>
      </span>
    </span>
  );
}

// ───────────────────────── live sample data ─────────────────────────
// The hero cards play a small loop so the page feels alive: on the test screen
// a question gets answered, "Next" is pressed and the palette fills in; on the
// result side a fresh report lands every few seconds (score counts up, bars
// fill, the history line redraws). All sample content, nothing is real data.
// Everything is static for visitors who prefer reduced motion.
const prefersReduced = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

const LIVE_QUESTIONS = [
  { q: "A 2 kg mass accelerates at 3 m/s². What is the net force acting on it?", opts: ["1.5 N", "5 N", "6 N", "12 N"], ans: 2 },
  { q: "Which unit is used to measure electric current?", opts: ["Volt", "Ampere", "Ohm", "Watt"], ans: 1 },
  { q: "What is the SI unit of pressure?", opts: ["Newton", "Joule", "Pascal", "Watt"], ans: 2 },
  { q: "The speed of light in vacuum is closest to…", opts: ["3 × 10⁴ m/s", "3 × 10⁶ m/s", "3 × 10⁸ m/s", "3 × 10¹² m/s"], ans: 2 },
];
const FIRST_Q = 12;
const LAST_Q = FIRST_Q + LIVE_QUESTIONS.length - 1;
const OPTION_KEYS = ["A", "B", "C", "D"];

function useLiveTest() {
  const [cur, setCur] = useState(FIRST_Q);
  const [sel, setSel] = useState(() => (prefersReduced() ? LIVE_QUESTIONS[0].ans : null));
  const [press, setPress] = useState(false);
  useEffect(() => {
    if (prefersReduced()) return undefined;
    const q = LIVE_QUESTIONS[cur - FIRST_Q];
    setSel(null);
    setPress(false);
    const timers = [
      setTimeout(() => setSel(q.ans), 1500),
      setTimeout(() => setPress(true), 3200),
      setTimeout(() => {
        setPress(false);
        setCur((c) => (c >= LAST_Q ? FIRST_Q : c + 1));
      }, 3550),
    ];
    return () => timers.forEach(clearTimeout);
  }, [cur]);
  return { cur, sel, press, q: LIVE_QUESTIONS[cur - FIRST_Q] };
}

const REPORT_SETS = [
  { title: "Mock Test 3 · Physics", meta: "40 questions · 42:10 of 60:00", score: 92, correct: 37, wrong: 2, skipped: 1, delta: "+14% vs last", history: [64, 78, 92],
    rows: [["Mechanics", 96], ["Optics", 90], ["Thermodynamics", 83]] },
  { title: "Mock Test 4 · Mathematics", meta: "40 questions · 51:20 of 60:00", score: 95, correct: 38, wrong: 1, skipped: 1, delta: "+3% vs last", history: [78, 92, 95],
    rows: [["Algebra", 98], ["Geometry", 94], ["Trigonometry", 91]] },
  { title: "Mock Test 5 · Chemistry", meta: "40 questions · 47:05 of 60:00", score: 97, correct: 39, wrong: 1, skipped: 0, delta: "+2% vs last", history: [92, 95, 97],
    rows: [["Organic", 98], ["Physical", 97], ["Inorganic", 95]] },
];

function useLiveReport() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (prefersReduced()) return undefined;
    const id = setInterval(() => setI((n) => (n + 1) % REPORT_SETS.length), 8000);
    return () => clearInterval(id);
  }, []);
  return { i, data: REPORT_SETS[i] };
}

// Eased count from 0 to `to`, restarting whenever `trigger` changes.
function useCountUp(trigger, to, ms = 1500, delay = 0) {
  const [v, setV] = useState(() => (prefersReduced() ? to : 0));
  useEffect(() => {
    if (prefersReduced()) {
      setV(to);
      return undefined;
    }
    setV(0);
    let raf;
    let start = null;
    const tick = (t) => {
      if (start === null) start = t;
      const p = Math.min(1, (t - start) / ms);
      setV(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    const id = setTimeout(() => {
      raf = requestAnimationFrame(tick);
    }, delay);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [trigger, to, ms, delay]);
  return v;
}

// Attempt-history line for three scores, in the 240×64 chart box.
const histY = (v) => Math.max(6, Math.min(58, 46 - (v - 64) * 1.214));
function historyPaths(vals) {
  const [a, b, c] = vals.map(histY);
  const line = `M16 ${a}C58 ${a} 76 ${b} 120 ${b}S184 ${c} 224 ${c}`;
  return { line, area: `${line}V62H16Z`, ys: [a, b, c] };
}

// Left cluster: a live question (the "taking a test" moment) and the question
// palette every real exam screen has. Sample content only.
const PALETTE_SKIPPED = new Set([3, 7]);
const PALETTE_FLAGGED = new Set([5, 9]);

function paletteCell(n, cur) {
  if (n === cur) return "bg-white text-(--lp-ink) ring-2 ring-(--lp-ink)";
  if (PALETTE_FLAGGED.has(n)) return "bg-(--lp-yellow) text-(--lp-ink)";
  if (n < cur && !PALETTE_SKIPPED.has(n)) return "bg-(--lp-blue) text-white";
  return "bg-(--lp-grey) text-(--lp-muted)";
}
const answeredCount = (cur) => Array.from({ length: cur - 1 }, (_, i) => i + 1).filter((n) => !PALETTE_SKIPPED.has(n)).length;

function LeftCards() {
  const { cur, sel, press, q } = useLiveTest();
  return (
    <div className="pointer-events-none absolute -left-2 top-1/2 hidden h-[480px] w-[330px] origin-left -translate-y-1/2 scale-[0.74] xl:block 2xl:left-4 2xl:scale-100 ul-rise" style={{ "--d": "0.25s" }} aria-hidden="true">
      <span className="ul-float-b absolute -top-3 right-1 z-20 inline-flex items-center gap-1.5 rounded-full bg-(--lp-yellow) px-3.5 py-1.5 text-[11px] font-bold text-(--lp-ink) shadow-[0_14px_28px_-12px_rgba(15,17,21,0.45)] ring-2 ring-white" style={{ "--r": "5deg" }}>
        <ClockIcon className="h-3 w-3" /> Timed like the real exam
      </span>

      {/* question */}
      <div className={`ul-float-a absolute left-2 top-2 w-[296px] p-4 ${CARD}`} style={{ "--r": "-2deg" }}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-(--lp-blue-soft) px-2.5 py-1 text-[10.5px] font-bold text-(--lp-blue-deep)">Physics</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-grey) px-2.5 py-1 text-[11px] font-bold tabular-nums text-(--lp-ink)">
            <ClockIcon className="h-3 w-3 text-(--lp-muted)" /> <LiveTimer />
          </span>
        </div>
        <p className="mt-3.5 text-[11px] font-semibold tabular-nums text-(--lp-muted)">Question {cur} of 40</p>
        <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-(--lp-grey)">
          <span className="block h-full rounded-full bg-(--lp-blue) transition-[width] duration-700 ease-out" style={{ width: `${(cur / 40) * 100}%` }} />
        </span>
        <div key={cur} className="ul-swap">
          <p className="mt-3 min-h-[2.6rem] text-[14px] font-semibold leading-snug tracking-[-0.01em] text-(--lp-ink)">{q.q}</p>
          <ul className="mt-3.5 space-y-1.5">
            {q.opts.map((text, idx) => {
              const selected = sel === idx;
              return (
                <li
                  key={text}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold transition-[background-color,box-shadow,color] duration-300 ease-out ${
                    selected ? "bg-(--lp-blue-soft) text-(--lp-blue-deep) ring-[1.5px] ring-(--lp-blue)" : "text-(--lp-ink) ring-1 ring-(--lp-line)"
                  }`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold transition-colors duration-300 ${selected ? "bg-(--lp-blue-deep) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>{OPTION_KEYS[idx]}</span>
                  <span className="flex-1">{text}</span>
                  {selected && <CheckIcon className="h-3.5 w-3.5" />}
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-(--lp-muted)">Mark for review</span>
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[11px] font-semibold text-white transition-[background-color,transform] duration-200 ease-out ${
              press ? "scale-90 bg-(--lp-blue)" : sel !== null ? "scale-105 bg-(--lp-ink)" : "bg-(--lp-ink)"
            }`}
          >
            Next <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* question palette */}
      <div className={`ul-float-b absolute left-12 top-[352px] z-10 w-[270px] p-3.5 ${CARD}`} style={{ "--r": "1.5deg" }}>
        <div className="flex items-baseline justify-between">
          <p className="text-[11.5px] font-bold text-(--lp-ink)">Question palette</p>
          <p className="text-[10.5px] font-semibold tabular-nums text-(--lp-muted)">{answeredCount(cur)} answered</p>
        </div>
        <div className="mt-2.5 grid grid-cols-10 gap-1">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => (
            <span key={n} className={`grid aspect-square place-items-center rounded-[5px] text-[8.5px] font-bold tabular-nums transition-[background-color,color,box-shadow] duration-300 ease-out ${paletteCell(n, cur)}`}>{n}</span>
          ))}
        </div>
        <div className="mt-2.5 flex items-center gap-3 text-[10px] font-semibold text-(--lp-muted)">
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-(--lp-blue)" />Answered</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-(--lp-yellow)" />Review</span>
          <span className="inline-flex items-center gap-1"><i className="h-2 w-2 rounded-sm bg-(--lp-grey) ring-1 ring-(--lp-line)" />Left</span>
        </div>
      </div>
    </div>
  );
}

const DONUT_R = 34;
const DONUT_C = 2 * Math.PI * DONUT_R;

// Right cluster: the report a student gets after submitting, plus the attempt
// history that comes with retaking. A new sample report lands every 8 seconds.
function RightCards() {
  const { i, data } = useLiveReport();
  const score = useCountUp(i, data.score, 1500, 700);
  const correct = useCountUp(i, data.correct, 1500, 700);
  const hist = historyPaths(data.history);
  return (
    <div className="pointer-events-none absolute -right-2 top-1/2 hidden h-[480px] w-[340px] origin-right -translate-y-1/2 scale-[0.74] xl:block 2xl:right-4 2xl:scale-100 ul-rise" style={{ "--d": "0.4s" }} aria-hidden="true">
      <span className="ul-float-a absolute -top-3 left-3 z-20 inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-3.5 py-1.5 text-[11px] font-bold text-white shadow-[0_14px_28px_-12px_rgba(15,17,21,0.6)]" style={{ "--r": "-5deg" }}>
        <Sparkle className="h-3 w-3 text-(--lp-yellow)" /> Instant score
      </span>
      {/* result report */}
      <div className={`ul-float-b absolute right-0 top-2 w-[316px] overflow-hidden p-4 ${CARD}`} style={{ "--r": "1.5deg" }}>
        <div key={i} className="ul-swap">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-[12.5px] font-bold tracking-[-0.01em] text-(--lp-ink)">{data.title}</p>
              <p className="mt-0.5 text-[10.5px] font-medium text-(--lp-muted)">{data.meta}</p>
            </div>
            <span className="rounded-full bg-[#e6f5ee] px-2.5 py-1 text-[10.5px] font-bold text-[#17794f]">Passed</span>
          </div>

          <div className="mt-4 flex items-center gap-4">
            <div className="relative h-[88px] w-[88px] shrink-0">
              <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
                <circle cx="44" cy="44" r={DONUT_R} fill="none" stroke="var(--lp-grey)" strokeWidth="9" />
                <circle
                  cx="44" cy="44" r={DONUT_R} fill="none" stroke="var(--lp-blue)" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(DONUT_C * data.score) / 100} ${DONUT_C}`}
                  className="ul-draw" style={{ "--c": DONUT_C }}
                />
              </svg>
              <div className="absolute inset-0 grid place-content-center text-center">
                <span className="font-(family-name:--lp-font) text-[22px] font-bold leading-none tracking-tight tabular-nums text-(--lp-ink)">{score}%</span>
                <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-(--lp-muted)">Score</span>
              </div>
            </div>
            <ul className="flex-1 space-y-2 text-[11.5px] font-semibold tabular-nums text-(--lp-ink)">
              <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#1f9d6b]" /><span className="flex-1 text-(--lp-muted)">Correct</span>{correct}</li>
              <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#d64545]" /><span className="flex-1 text-(--lp-muted)">Wrong</span>{data.wrong}</li>
              <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#c4c9d4]" /><span className="flex-1 text-(--lp-muted)">Skipped</span>{data.skipped}</li>
            </ul>
          </div>

          <div className="mt-4 space-y-2 border-t border-(--lp-line) pt-3.5">
            {data.rows.map(([label, pct], idx) => (
              <div key={label} className="flex items-center gap-3 text-[11px] font-semibold">
                <span className="w-[92px] text-(--lp-muted)">{label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--lp-grey)"><span className="ul-grow block h-full rounded-full bg-(--lp-ink)" style={{ width: `${pct}%`, "--d": `${0.9 + idx * 0.15}s` }} /></span>
                <span className="w-7 text-right tabular-nums text-(--lp-ink)">{pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* attempt history */}
      <div className={`ul-float-a absolute bottom-0 right-10 z-10 w-[264px] p-3.5 ${CARD}`} style={{ "--r": "-1.5deg" }}>
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-bold text-(--lp-ink)">Attempt history</p>
          <span key={`d${i}`} className="ul-swap inline-flex items-center rounded-full bg-[#e6f5ee] px-2 py-0.5 text-[10px] font-bold text-[#17794f]">{data.delta}</span>
        </div>
        <svg key={`h${i}`} viewBox="0 0 240 64" className="mt-2 h-16 w-full" fill="none">
          <defs>
            <linearGradient id="ul-hist" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--lp-blue)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--lp-blue)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={hist.area} fill="url(#ul-hist)" className="ul-fade" style={{ "--d": "1.1s" }} />
          <path d={hist.line} pathLength="1" stroke="var(--lp-blue)" strokeWidth="2.2" strokeLinecap="round" className="ul-line" />
          <circle cx="16" cy={hist.ys[0]} r="3.5" fill="#fff" stroke="var(--lp-blue)" strokeWidth="2" className="ul-pop" style={{ "--d": "0.5s" }} />
          <circle cx="120" cy={hist.ys[1]} r="3.5" fill="#fff" stroke="var(--lp-blue)" strokeWidth="2" className="ul-pop" style={{ "--d": "1s" }} />
          <circle cx="224" cy={hist.ys[2]} r="5" fill="var(--lp-yellow)" stroke="var(--lp-ink)" strokeWidth="2" className="ul-pop" style={{ "--d": "1.6s" }} />
        </svg>
        <div className="flex justify-between px-0.5 text-[10px] font-semibold tabular-nums text-(--lp-muted)">
          <span>{data.history[0]}%</span><span>{data.history[1]}%</span><span className="text-(--lp-ink)">{data.history[2]}%</span>
        </div>
      </div>
    </div>
  );
}

// ─────────── Mobile / tablet hero extras (hidden from xl up, where the two
// floating card clusters take over). Decorative only, sample figures.

function MobileAmbient() {
  return (
    <div className="absolute inset-0 overflow-hidden sm:hidden">
      {[
        { ch: "π", pos: "left-[5%] top-[2%]", size: "text-5xl", tone: "text-(--lp-blue) opacity-[0.2]", dx: 10, dy: -12, r: -8, dur: 22, delay: 0 },
        { ch: "∑", pos: "right-[5%] top-[13%]", size: "text-6xl", tone: "text-(--lp-ink) opacity-[0.07]", dx: -10, dy: 12, r: 6, dur: 26, delay: -6 },
        { ch: "Δ", pos: "left-[4%] top-[47%]", size: "text-4xl", tone: "text-(--lp-blue) opacity-[0.16]", dx: 8, dy: -10, r: -6, dur: 24, delay: -9 },
        { ch: "%", pos: "right-[6%] top-[55%]", size: "text-5xl", tone: "text-(--lp-yellow) opacity-70", dx: -8, dy: -10, r: 8, dur: 21, delay: -4 },
      ].map((g) => (
        <span
          key={g.ch}
          className={`ul-drift absolute select-none font-(family-name:--lp-font) font-bold leading-none ${g.pos} ${g.size} ${g.tone}`}
          style={{ "--dx": `${g.dx}px`, "--dy": `${g.dy}px`, "--r": `${g.r}deg`, "--dur": `${g.dur}s`, "--delay": `${g.delay}s` }}
        >
          {g.ch}
        </span>
      ))}
      <Sparkle className="ul-drift absolute left-[16%] top-[22%] h-4 w-4 text-(--lp-blue)/60" style={{ "--dx": "6px", "--dy": "-10px", "--dur": "17s" }} />
      <Sparkle className="ul-drift absolute right-[12%] top-[36%] h-5 w-5 text-(--lp-yellow)" style={{ "--dx": "-6px", "--dy": "10px", "--dur": "20s", "--delay": "-4s" }} />
      <span className="ul-drift absolute right-[22%] top-[3%] h-3 w-3 rounded-full bg-(--lp-yellow)" style={{ "--dx": "6px", "--dy": "12px", "--dur": "19s" }} />
    </div>
  );
}

// Quiet one-line label above the headline on phones. Plain sentence case,
// no pulsing dot or all-caps tracking, so it reads as part of the page
// rather than a badge.
function MobileEyebrow() {
  return (
    <span className="mt-5 inline-flex items-center rounded-full bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-(--lp-muted) ring-1 ring-(--lp-line) sm:hidden">
      Online mock tests for school exams
    </span>
  );
}

// A compact version of the desktop product cards: the live question with a
// result report tucked underneath, plus two floating chips. Gives phones the
// same "this is what you get" moment the desktop hero has, and plays the same
// live loop.
function MobileShowcase() {
  const { cur, sel, q } = useLiveTest();
  const { i, data } = useLiveReport();
  const score = useCountUp(i, data.score, 1500, 700);
  return (
    <div className="relative mx-auto mt-12 h-[468px] w-full max-w-[340px] text-left xl:hidden" aria-hidden="true">
      <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-(--lp-blue)/15 blur-3xl" />
      <div className="pointer-events-none absolute -right-6 top-4 h-28 w-28 rounded-full bg-(--lp-yellow)/60 blur-2xl" />

      {/* live question */}
      <div className={`ul-float-a absolute left-0 top-4 w-[276px] p-3.5 ${CARD}`} style={{ "--r": "-3deg" }}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-(--lp-blue-soft) px-2.5 py-1 text-[10.5px] font-bold text-(--lp-blue-deep)">Physics</span>
          <span className="text-[10.5px] font-semibold tabular-nums text-(--lp-muted)">Question {cur} of 40</span>
        </div>
        <span className="mt-2.5 block h-1 overflow-hidden rounded-full bg-(--lp-grey)">
          <span className="block h-full rounded-full bg-(--lp-blue) transition-[width] duration-700 ease-out" style={{ width: `${(cur / 40) * 100}%` }} />
        </span>
        <div key={cur} className="ul-swap">
          <p className="mt-3 min-h-[2.5rem] text-[13.5px] font-semibold leading-snug tracking-[-0.01em] text-(--lp-ink)">{q.q}</p>
          <ul className="mt-3 space-y-1.5">
            {q.opts.map((text, idx) => {
              const selected = sel === idx;
              return (
                <li
                  key={text}
                  className={`flex items-center gap-2.5 rounded-xl px-2.5 py-1.5 text-[12px] font-semibold transition-[background-color,box-shadow,color] duration-300 ease-out ${
                    selected ? "bg-(--lp-blue-soft) text-(--lp-blue-deep) ring-[1.5px] ring-(--lp-blue)" : "text-(--lp-ink) ring-1 ring-(--lp-line)"
                  }`}
                >
                  <span className={`grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold transition-colors duration-300 ${selected ? "bg-(--lp-blue-deep) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>{OPTION_KEYS[idx]}</span>
                  <span className="flex-1">{text}</span>
                  {selected && <CheckIcon className="h-3.5 w-3.5" />}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* result report */}
      <div className={`ul-float-b absolute bottom-0 right-0 z-10 w-[256px] overflow-hidden p-3.5 ${CARD}`} style={{ "--r": "2.5deg" }}>
        <div key={i} className="ul-swap">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[12px] font-bold tracking-[-0.01em] text-(--lp-ink)">{data.title}</p>
              <p className="mt-0.5 text-[10px] font-medium text-(--lp-muted)">{data.meta}</p>
            </div>
            <span className="rounded-full bg-[#e6f5ee] px-2 py-0.5 text-[10px] font-bold text-[#17794f]">Passed</span>
          </div>
          <div className="mt-3 flex items-center gap-3.5">
            <div className="relative h-[72px] w-[72px] shrink-0">
              <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
                <circle cx="44" cy="44" r={DONUT_R} fill="none" stroke="var(--lp-grey)" strokeWidth="9" />
                <circle
                  cx="44" cy="44" r={DONUT_R} fill="none" stroke="var(--lp-blue)" strokeWidth="9" strokeLinecap="round"
                  strokeDasharray={`${(DONUT_C * data.score) / 100} ${DONUT_C}`}
                  className="ul-draw" style={{ "--c": DONUT_C }}
                />
              </svg>
              <div className="absolute inset-0 grid place-content-center text-center">
                <span className="font-(family-name:--lp-font) text-[18px] font-bold leading-none tracking-tight tabular-nums text-(--lp-ink)">{score}%</span>
                <span className="mt-0.5 text-[8px] font-semibold uppercase tracking-wider text-(--lp-muted)">Score</span>
              </div>
            </div>
            <div className="flex-1 space-y-2">
              {data.rows.map(([label, pct], idx) => (
                <div key={label} className="flex items-center gap-2 text-[10.5px] font-semibold">
                  <span className="w-[74px] truncate text-(--lp-muted)">{label}</span>
                  <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-(--lp-grey)"><span className="ul-grow block h-full rounded-full bg-(--lp-ink)" style={{ width: `${pct}%`, "--d": `${0.9 + idx * 0.15}s` }} /></span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* floating chips */}
      <span className="ul-float-b absolute right-1 top-0 z-20 inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-3 py-1.5 text-[11px] font-bold tabular-nums text-white shadow-[0_14px_28px_-12px_rgba(15,17,21,0.6)]" style={{ "--r": "3deg" }}>
        <ClockIcon className="h-3 w-3 text-(--lp-yellow)" /> <LiveTimer /> left
      </span>
      <span className="ul-float-a absolute bottom-3 left-0 z-20 inline-flex items-center gap-1 rounded-full bg-(--lp-yellow) px-3 py-1.5 text-[11px] font-bold text-(--lp-ink) shadow-[0_14px_28px_-12px_rgba(15,17,21,0.45)] ring-2 ring-white" style={{ "--r": "-4deg" }}>
        <ArrowUpRight className="h-3 w-3" /> {data.delta.split(" ")[0]}
      </span>
    </div>
  );
}

export default function HeroSection() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [searchFocused, setSearchFocused] = useState(false);
  const placeholder = useRotatingPlaceholder(searchFocused);

  // Search and the "Popular" chips lead to the test series list. Signed-in
  // students go straight to their portal's list (where they can enrol);
  // everyone else, signed out or another role, browses the public list, where
  // enrolling asks them to log in first.
  const goToSeries = (query) => {
    const q = String(query ?? "").trim();
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    if (user?.role === "student") return navigate(`/student/test-series${suffix}`);
    return navigate(`/test-series${suffix}`);
  };
  return (
    // Fill the first screen: viewport height minus the navbar, hero centred in
    // the space above the ticker strip. Natural height on short/mobile screens.
    <div className="flex flex-col xl:min-h-[calc(100svh-4.5rem)]">
      {/* ───────────────────────────── HERO ───────────────────────────── */}
      <section className="relative isolate flex flex-1 items-start overflow-hidden px-5 pb-12 pt-8 sm:px-8 md:pb-14 md:pt-10 xl:items-center xl:pt-8">
        {/* soft washes + faint dotted grid, static */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <style>{FLOAT_CSS}</style>
          <div className="ul-drift absolute -left-40 top-[10%] h-[460px] w-[460px] rounded-full bg-(--lp-blue-soft) opacity-70 blur-3xl" style={{ "--dx": "60px", "--dy": "40px", "--dur": "34s" }} />
          <div className="ul-drift absolute -right-40 top-[18%] h-[420px] w-[420px] rounded-full bg-(--lp-yellow) opacity-25 blur-3xl" style={{ "--dx": "-50px", "--dy": "50px", "--dur": "40s", "--delay": "-12s" }} />
          <AmbientLayer />
          <MobileAmbient />
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-(--lp-blue-tint) to-transparent" />
          <div
            className="absolute inset-0 opacity-[0.5]"
            style={{
              backgroundImage: "radial-gradient(rgba(15,17,21,0.08) 1px, transparent 1.2px)",
              backgroundSize: "26px 26px",
              maskImage: "radial-gradient(ellipse at 50% 40%, black 0%, transparent 70%)",
              WebkitMaskImage: "radial-gradient(ellipse at 50% 40%, black 0%, transparent 70%)",
            }}
          />
        </div>

        <div className="relative mx-auto w-full max-w-[1500px]">
          <div className="pointer-events-none absolute left-1/2 top-[8%] -z-10 hidden h-[460px] w-[820px] -translate-x-1/2 rounded-full bg-white/80 blur-3xl md:block" aria-hidden="true" />
          <LeftCards />
          <RightCards />

          <div className="relative z-10 mx-auto flex max-w-[780px] flex-col items-center text-center">
            <Reveal delay={40}><LogoMark /></Reveal>
            <Reveal delay={70}><MobileEyebrow /></Reveal>

            <Reveal delay={100}>
              <h1 className="mt-6 font-(family-name:--lp-font) text-[2.4rem] font-bold leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-[4.4rem]">
                Test series that
                <br />
                <span className="relative inline-block">
                  <span className="absolute -inset-x-2 bottom-[0.04em] top-[0.14em] -rotate-1 rounded-2xl bg-(--lp-yellow)" aria-hidden="true" />
                  <span className="relative">move</span>
                </span>{" "}
                you{" "}
                <span className="relative inline-block">
                  <span className="relative z-10">forward.</span>
                  <Sparkle className="ul-drift absolute -right-6 -top-4 hidden h-7 w-7 text-(--lp-yellow) sm:block" style={{ "--dx": "4px", "--dy": "-6px", "--r": "8deg", "--dur": "9s" }} />
                  <Squiggle className="absolute -bottom-3 left-0 -z-0 h-4 w-full text-(--lp-blue)" />
                </span>
              </h1>
            </Reveal>

            <Reveal delay={170}>
              <p className="mt-6 max-w-md text-base leading-relaxed text-(--lp-muted) md:text-lg">
                Practice tests with a timer, instant scoring and a detailed report after every attempt.
              </p>
            </Reveal>

            <Reveal delay={230}>
              {user && (
                <div className="mt-8 flex min-h-[56px] flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-x-4">
                  <PillButton tone="ink" className="w-full max-w-[300px] sm:w-auto sm:max-w-none [&>span:first-child]:flex-1 [&>span:first-child]:text-center sm:[&>span:first-child]:flex-none" onClick={() => navigate(homePathForUser(user))}>
                    Go to Dashboard
                  </PillButton>
                </div>
              )}
              {!user && (
                <button
                  type="button"
                  onClick={() => navigate("/admin/login")}
                  className="mt-8 rounded-full px-4 py-2 text-sm font-semibold text-(--lp-muted) underline decoration-(--lp-line) decoration-2 underline-offset-4 transition-colors hover:text-(--lp-ink) hover:decoration-(--lp-blue)"
                >
                  Admin Login
                </button>
              )}
            </Reveal>

            <Reveal delay={290} className="w-full max-w-lg">
              <form
                className="mt-7 flex w-full items-center gap-2 rounded-full bg-white p-2 pl-5 shadow-[0_2px_0_rgba(255,255,255,0.9)_inset,0_26px_60px_-18px_rgba(37,87,214,0.38)] ring-1 ring-(--lp-ink)/10 transition-[box-shadow,transform] duration-300 ease-out hover:-translate-y-0.5 focus-within:-translate-y-0.5 focus-within:shadow-[0_30px_70px_-14px_rgba(37,87,214,0.5)] focus-within:ring-2 focus-within:ring-(--lp-blue)"
                onSubmit={(event) => {
                  event.preventDefault();
                  const query = new FormData(event.currentTarget).get("query");
                  goToSeries(query);
                }}
              >
                <SearchIcon className="h-5 w-5 shrink-0 text-(--lp-muted)" />
                <input
                  name="query"
                  placeholder={placeholder}
                  onFocus={() => setSearchFocused(true)}
                  onBlur={() => setSearchFocused(false)}
                  className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-(--lp-ink) outline-none placeholder:text-(--lp-muted)/70 sm:text-base"
                  aria-label="Search test series"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="group inline-flex shrink-0 items-center gap-2.5 rounded-full bg-(--lp-ink) py-2 pl-5 pr-2 text-sm font-semibold text-white transition-colors duration-200 ease-out hover:bg-(--lp-ink-soft) focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--lp-blue)/40 sm:pl-6"
                >
                  <span className="hidden sm:inline">Search</span>
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink) transition-transform duration-200 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5">
                    <ArrowUpRight className="h-4 w-4" />
                  </span>
                </button>
              </form>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-sm sm:gap-2.5">
                <span className="hidden text-(--lp-muted) sm:inline">Popular:</span>
                {["School exams", "Mathematics", "Science"].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => goToSeries(category)}
                    className="rounded-full bg-(--lp-blue-soft) px-3 py-1.5 text-xs font-semibold sm:px-3.5 text-(--lp-blue-deep) transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:bg-(--lp-blue) hover:text-white"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </Reveal>
          </div>

          <Reveal delay={360} className="w-full xl:hidden">
            <MobileShowcase />
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────── TICKER STRIP ─────────────────────────── */}
      <section aria-hidden="true" className="relative overflow-hidden py-12 sm:py-16">
        <style>{`
          @keyframes ul-strip { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          @media (prefers-reduced-motion: reduce) { .ul-strip-track { animation: none !important; } }
        `}</style>
        {/* back tape: yellow, tilted the other way, peeks out at the ends */}
        <div className="absolute -inset-x-[6%] top-1/2 h-16 -translate-y-1/2 rotate-[1.4deg] bg-(--lp-yellow) sm:h-[4.5rem]" />
        {/* front tape: ink, words glide through with soft edge fade */}
        <div className="relative -mx-[6%] -rotate-[1.1deg] overflow-hidden bg-(--lp-ink) text-white shadow-[0_22px_44px_-20px_rgba(15,17,21,0.6)]">
          <span className="absolute inset-x-0 top-0 h-px bg-white/15" />
          <div
            className="py-4 sm:py-5"
            style={{
              maskImage: "linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%)",
              WebkitMaskImage: "linear-gradient(90deg, transparent 0, #000 9%, #000 91%, transparent 100%)",
            }}
          >
            <div
              className="ul-strip-track flex w-max items-center whitespace-nowrap font-(family-name:--lp-font) text-base font-semibold tracking-tight sm:text-lg"
              style={{ animation: "ul-strip 60s linear infinite" }}
            >
              {[...STRIP_ITEMS, ...STRIP_ITEMS].map((label, i) => (
                <span key={`${label}-${i}`} className="flex items-center">
                  <span className="px-6 text-white/90 sm:px-8">{label}</span>
                  <Sparkle className={`h-3 w-3 ${i % 2 ? "text-(--lp-blue)" : "text-(--lp-yellow)"}`} />
                </span>
              ))}
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
