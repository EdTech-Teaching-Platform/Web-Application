// "Prepare. Practice. Perform." — Test Series showcase (landing page).
//
// A main Phase-1 product, so it gets a full-width stage: marketing copy on
// the left, and on the right a *working-looking* exam mock — live ticking
// timer, clickable answer options, question palette — with a result card
// overlapping it (animated score ring + per-skill bars).
//
// Everything on the right is an illustrative preview, not the real exam
// shell. Motion is transform/opacity/stroke only and is disabled for
// prefers-reduced-motion.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpenIcon, CheckCircleIcon, ClockIcon, FileTextIcon } from "../../../components/ui/icons";
import { ArrowUpRight, PillButton, Reveal } from "./LandingUI";

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

const OPTIONS = [
  { key: "A", text: "4.9 m/s²" },
  { key: "B", text: "9.8 m/s²" },
  { key: "C", text: "8.5 m/s²" },
  { key: "D", text: "2.5 m/s²" },
];

// Illustrative per-question time bars (seconds) for the report mini-chart.
const TIME_BARS = [38, 52, 44, 61, 33, 49, 160, 41];

const SCORE = 82;
const RING_R = 34;
const RING_C = 2 * Math.PI * RING_R;

function useInView() {
  const ref = useRef(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setSeen(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen];
}

function useCountUp(target, active, ms = 1400) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return undefined;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) {
      setValue(target);
      return undefined;
    }
    let raf;
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      setValue(Math.round(target * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, active, ms]);
  return value;
}

// Exam timer: counts down from 34:28, then loops so the demo never "ends".
function useDemoTimer(startSeconds = 34 * 60 + 28) {
  const [left, setLeft] = useState(startSeconds);
  useEffect(() => {
    const id = window.setInterval(() => setLeft((s) => (s <= 1 ? startSeconds : s - 1)), 1000);
    return () => window.clearInterval(id);
  }, [startSeconds]);
  const mm = String(Math.floor(left / 60)).padStart(2, "0");
  const ss = String(left % 60).padStart(2, "0");
  return `${mm}:${ss}`;
}

function paletteState(n, answeredCurrent) {
  if (n <= 8) return "answered";
  if (n === 12) return answeredCurrent ? "answered-current" : "current";
  if (n === 9 || n === 15) return "flagged";
  if (n === 13) return "unanswered";
  return "unvisited";
}

const PALETTE_TONE = {
  answered: "bg-(--lp-blue) text-white",
  "answered-current": "bg-(--lp-blue) text-white ring-2 ring-(--lp-ink) ring-offset-2",
  current: "bg-(--lp-ink) text-white ring-2 ring-(--lp-ink) ring-offset-2",
  flagged: "bg-(--lp-yellow) text-(--lp-ink)",
  unanswered: "bg-(--lp-blue-soft) text-(--lp-blue-deep)",
  unvisited: "bg-(--lp-grey) text-(--lp-muted)",
};

function ExamMock() {
  const timer = useDemoTimer();
  const [picked, setPicked] = useState(null);

  return (
    <div className="rounded-[32px] bg-white p-5 shadow-[0_30px_70px_rgba(37,87,214,0.18)] ring-1 ring-(--lp-line) sm:p-7">
      <div className="flex items-center justify-between text-sm font-semibold">
        <span>Question 12 / 50</span>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-3 py-1 text-xs tabular-nums text-white">
          <span className="relative grid h-2 w-2 place-items-center" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-red-400 motion-safe:animate-ping" />
            <span className="relative h-1.5 w-1.5 rounded-full bg-red-400" />
          </span>
          <ClockIcon className="h-3.5 w-3.5" />
          {timer}
        </span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--lp-blue-soft)">
        <div className="h-full w-[24%] rounded-full bg-(--lp-blue)" />
      </div>

      <p className="mt-5 text-[15px] font-semibold leading-snug text-(--lp-ink)">
        A 2 kg block slides down a frictionless incline of 30°. What is its acceleration along the plane?
      </p>

      <div className="mt-4 grid gap-2.5 sm:grid-cols-2" role="radiogroup" aria-label="Sample answer options (demo)">
        {OPTIONS.map((o) => {
          const on = picked === o.key;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => setPicked(o.key)}
              className={`flex items-center gap-2.5 rounded-2xl px-3.5 py-2.5 text-left text-sm font-medium ring-1 transition-[transform,background-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 ${
                on ? "bg-(--lp-blue-soft) text-(--lp-blue-deep) ring-2 ring-(--lp-blue)" : "bg-white text-(--lp-ink) ring-(--lp-line) hover:ring-(--lp-blue)/40"
              }`}
            >
              <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full text-[11px] font-bold ${on ? "bg-(--lp-blue) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>{o.key}</span>
              {o.text}
            </button>
          );
        })}
      </div>

      <p className="mt-2.5 text-[11px] text-(--lp-muted)/80">Tap an answer to try it — the palette updates.</p>

      <p className="mt-5 text-[11px] font-bold uppercase tracking-wider text-(--lp-muted)">Question palette</p>
      <div className="mt-3 grid grid-cols-8 gap-2 sm:grid-cols-12">
        {Array.from({ length: 24 }, (_, i) => i + 1).map((n) => (
          <span
            key={n}
            className={`grid aspect-square place-items-center rounded-full text-[11px] font-bold transition-colors duration-300 ${PALETTE_TONE[paletteState(n, Boolean(picked))]}`}
          >
            {n}
          </span>
        ))}
      </div>
      <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-[11px] text-(--lp-muted)">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-(--lp-blue)" />Answered</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-(--lp-blue-soft)" />Unanswered</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-(--lp-yellow)" />Marked</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-(--lp-grey) ring-1 ring-(--lp-line)" />Not visited</span>
      </div>
    </div>
  );
}

function ResultCard({ active }) {
  const score = useCountUp(SCORE, active);
  const bars = [
    ["Accuracy", 82],
    ["Attempted", 95],
    ["Speed", 64],
  ];
  return (
    <div className="relative z-10 -mt-4 ml-auto w-[94%] -rotate-1 rounded-[28px] bg-(--lp-ink) p-5 text-white shadow-[0_24px_60px_rgba(15,17,21,0.35)] sm:p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-white/55">Python Programming</p>
          <h3 className="mt-1 font-(family-name:--lp-font) text-lg font-bold">Final Assessment</h3>
        </div>
        <span className="rounded-full bg-(--lp-yellow) px-3 py-1 text-[11px] font-bold text-(--lp-ink)">PASSED</span>
      </div>

      <div className="mt-5 flex items-center gap-5">
        <div className="relative h-[88px] w-[88px] shrink-0">
          <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="44" cy="44" r={RING_R} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="9" />
            <circle
              cx="44"
              cy="44"
              r={RING_R}
              fill="none"
              stroke="var(--lp-yellow)"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={RING_C}
              strokeDashoffset={active ? RING_C * (1 - SCORE / 100) : RING_C}
              style={{ transition: "stroke-dashoffset 1.4s cubic-bezier(0.2, 0.8, 0.2, 1)" }}
            />
          </svg>
          <strong className="absolute inset-0 grid place-items-center font-(family-name:--lp-font) text-xl leading-none tabular-nums">{score}%</strong>
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">33 / 40 correct</p>
          <div className="mt-2.5 space-y-2">
            {bars.map(([label, v], i) => (
              <div key={label} className="flex items-center gap-2 text-[10px] text-white/55">
                <span className="w-14 shrink-0">{label}</span>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/15">
                  <span
                    className="block h-full origin-left rounded-full bg-(--lp-yellow) transition-transform duration-1000 ease-out"
                    style={{ width: `${v}%`, transform: `scaleX(${active ? 1 : 0})`, transitionDelay: `${300 + i * 150}ms` }}
                  />
                </span>
                <span className="w-7 text-right tabular-nums text-white/80">{v}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureCards() {
  return (
    <div className="mt-8 grid gap-4 sm:grid-cols-2">
      <article className="group rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(37,87,214,0.08)] transition-transform duration-300 ease-out hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-(--lp-yellow) text-(--lp-ink)"><FileTextIcon className="h-5 w-5" /></span>
          <span className="font-(family-name:--lp-font) text-sm font-bold text-(--lp-muted)/60">01</span>
        </div>
        <h3 className="mt-4 font-(family-name:--lp-font) text-base font-bold">Structured Test Series</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-(--lp-muted)">Chapter, subject and full-length mock exams, timed just like the real thing.</p>
        <div className="mt-4 flex flex-wrap gap-1.5" aria-hidden="true">
          {["Chapter", "Subject", "Full-length"].map((t, i) => (
            <span key={t} className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${i === 2 ? "bg-(--lp-ink) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>{t}</span>
          ))}
        </div>
      </article>

      <article className="group rounded-3xl bg-white p-5 shadow-[0_10px_30px_rgba(37,87,214,0.08)] transition-transform duration-300 ease-out hover:-translate-y-1">
        <div className="flex items-center justify-between">
          <span className="grid h-10 w-10 place-items-center rounded-xl bg-(--lp-blue) text-white"><BookOpenIcon className="h-5 w-5" /></span>
          <span className="font-(family-name:--lp-font) text-sm font-bold text-(--lp-muted)/60">02</span>
        </div>
        <h3 className="mt-4 font-(family-name:--lp-font) text-base font-bold">Per-Question Reporting</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-(--lp-muted)">Detailed breakdowns of time spent and accuracy per question, so you know exactly where to improve.</p>
        <div className="mt-4" aria-hidden="true">
          <div className="flex h-10 items-end gap-1">
            {TIME_BARS.map((s, i) => (
              <span
                key={i}
                className={`flex-1 rounded-t-md ${s > 100 ? "bg-(--lp-yellow)" : "bg-(--lp-blue-soft)"}`}
                style={{ height: `${Math.max(14, (s / 160) * 100)}%` }}
              />
            ))}
          </div>
          <p className="mt-1.5 text-[11px] font-medium text-(--lp-muted)">Q7 took the longest — revisit it</p>
        </div>
      </article>
    </div>
  );
}

export default function TestSeriesShowcase() {
  const navigate = useNavigate();
  const [stageRef, stageSeen] = useInView();

  return (
    <section className="py-10 md:py-14" aria-labelledby="test-series-title">
      <style>{`
        @keyframes ts-float { 0%, 100% { transform: translateY(0) rotate(var(--r, 0deg)); } 50% { transform: translateY(-8px) rotate(var(--r, 0deg)); } }
        .ts-float { animation: ts-float 6s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .ts-float { animation: none; } }
      `}</style>
      <div className={SHELL}>
        <div className="relative overflow-hidden rounded-[44px] bg-(--lp-yellow-soft) p-6 ring-1 ring-(--lp-yellow) sm:p-10 lg:p-14">
          {/* atmosphere */}
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-(--lp-yellow)/60" />
            <div className="absolute -bottom-32 right-[-6rem] h-96 w-96 rounded-full bg-(--lp-blue)/15 blur-2xl" />
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage: "radial-gradient(rgba(15,17,21,0.10) 1px, transparent 1.2px)",
                backgroundSize: "26px 26px",
                maskImage: "radial-gradient(ellipse at 70% 50%, black, transparent 70%)",
                WebkitMaskImage: "radial-gradient(ellipse at 70% 50%, black, transparent 70%)",
              }}
            />
          </div>

          <div className="relative grid items-center gap-12 lg:grid-cols-[1fr_0.95fr]">
            <Reveal>
              <span className="inline-flex rounded-full bg-(--lp-ink) px-3.5 py-1.5 text-xs font-semibold tracking-wide text-white">Test Series</span>
              <h2 id="test-series-title" className="mt-5 max-w-lg font-(family-name:--lp-font) text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                Prepare. Practice.{" "}
                <span className="relative inline-block text-white">
                  <span className="absolute -inset-x-2 bottom-[0.02em] top-[0.12em] -rotate-1 rounded-2xl bg-(--lp-blue)" aria-hidden="true" />
                  <span className="relative">Perform.</span>
                </span>
              </h2>
              <p className="mt-5 max-w-lg text-base leading-relaxed text-(--lp-muted)">
                Practice with topic-wise, subject-wise and full-length test series designed to help you understand your preparation, improve your speed and identify areas that need more work.
              </p>

              <FeatureCards />

              <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                <PillButton tone="ink" onClick={() => navigate("/test-series")}>
                  Explore Test Series
                </PillButton>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-(--lp-ink)/70">
                  <CheckCircleIcon className="h-4 w-4 text-(--lp-blue)" />
                  Instant report after every test
                </span>
              </div>
            </Reveal>

            <Reveal delay={120} className="relative">
              <div ref={stageRef} className="relative md:rotate-[1.5deg]">

                {/* floating callout chips */}
                <div
                  className="ts-float pointer-events-none absolute -left-6 top-[38%] z-20 hidden items-center gap-2 rounded-2xl bg-white px-3.5 py-2 text-xs font-semibold shadow-[0_14px_30px_rgba(15,17,21,0.14)] ring-1 ring-(--lp-line) xl:flex"
                  style={{ "--r": "-4deg" }}
                  aria-hidden="true"
                >
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink)"><ClockIcon className="h-3.5 w-3.5" /></span>
                  1m 12s per question
                </div>
                <div
                  className="ts-float pointer-events-none absolute -right-3 -top-5 z-20 hidden items-center gap-1.5 rounded-full bg-(--lp-blue) px-3.5 py-2 text-xs font-bold text-white shadow-[0_14px_30px_rgba(37,87,214,0.35)] sm:flex"
                  style={{ "--r": "5deg", animationDelay: "-2.5s" }}
                  aria-hidden="true"
                >
                  <ArrowUpRight className="h-3.5 w-3.5" />
                  +12% vs last mock
                </div>

                <ExamMock />
                <ResultCard active={stageSeen} />
              </div>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
