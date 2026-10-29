// Landing "Same student, two paths" section: one chart, two score lines.
// A flat, wobbly grey line (studying alone) against a climbing blue line
// (regular Universal Learning mock tests + reports), with a live gap marker
// the visitor can scrub across six milestones (hover / touch). The lines
// draw in once when the section scrolls into view; reduced-motion visitors
// get the finished chart.
//
// The numbers are an ILLUSTRATIVE sample journey, not measured results, and
// the section says so in a footnote. Pure presentation: no data, auth or
// routing is touched (the CTA just calls the `onStart` prop).
import { useEffect, useRef, useState } from "react";
import { PillButton, Reveal } from "./LandingUI";

const DISPLAY = "font-(family-name:--lp-font)";
const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";
const prefersReduced = () =>
  typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// Sample journey of one student across eight weeks of practice.
const LABELS = ["Start", "Mock 2", "Mock 4", "Mock 6", "Mock 8", "Exam day"];
const ALONE = [52, 54, 53, 56, 55, 57];
const WITH = [52, 60, 67, 74, 81, 88];
const TARGET = 85;
const LAST = LABELS.length - 1;

// Chart geometry (SVG user units).
const W = 640;
const H = 340;
const X0 = 52;
const X1 = 568;
const Y0 = 28;
const Y1 = 292;
const xAt = (i) => X0 + (i * (X1 - X0)) / LAST;
const yAt = (v) => Y1 - ((v - 40) / 60) * (Y1 - Y0);

// Catmull-Rom -> cubic bezier so the lines flow instead of zig-zagging.
function smoothPath(vals) {
  const pts = vals.map((v, i) => [xAt(i), yAt(v)]);
  let d = `M ${pts[0][0]} ${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i += 1) {
    const p0 = pts[i - 1] || pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] || p2;
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C ${c1[0]} ${c1[1]}, ${c2[0]} ${c2[1]}, ${p2[0]} ${p2[1]}`;
  }
  return d;
}
const ALONE_PATH = smoothPath(ALONE);
const WITH_PATH = smoothPath(WITH);
const AREA_PATH = `${WITH_PATH} L ${xAt(LAST)} ${Y1} L ${xAt(0)} ${Y1} Z`;
const TICKS = [50, 60, 70, 80, 90, 100];

function useSeenOnce(ref) {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    if (seen) return undefined;
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setSeen(true);
        io.disconnect();
      }
    }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ref, seen]);
  return seen;
}

// Eases the displayed number toward `target` whenever it changes.
function useTween(target, enabled, start) {
  const reduced = useRef(prefersReduced());
  const [val, setVal] = useState(reduced.current ? target : start);
  const cur = useRef(val);
  useEffect(() => {
    if (!enabled) return undefined;
    if (reduced.current) {
      cur.current = target;
      setVal(target);
      return undefined;
    }
    const from = cur.current;
    const t0 = performance.now();
    let raf = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - t0) / 800);
      const v = from + (target - from) * (1 - (1 - p) ** 3);
      cur.current = v;
      setVal(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, enabled]);
  return Math.round(val);
}

// Motion for the gold "with Universal Learning" card. All of it stops for
// visitors who prefer reduced motion.
const GOLD_CSS = `
@keyframes ulgap-shine { 0%, 55% { transform: translateX(0) skewX(-20deg); opacity: 0; } 60% { opacity: 1; } 100% { transform: translateX(520%) skewX(-20deg); opacity: 0; } }
.ulgap-shine { animation: ulgap-shine 5.5s ease-in-out infinite; }
@keyframes ulgap-glow { 0%, 100% { opacity: 0.4; transform: scale(0.98); } 50% { opacity: 0.75; transform: scale(1.03); } }
.ulgap-glow { animation: ulgap-glow 4.2s ease-in-out infinite; }
@keyframes ulgap-spin { to { transform: rotate(360deg); } }
.ulgap-spin { animation: ulgap-spin 22s linear infinite; }
@keyframes ulgap-ping { 0% { transform: scale(1); opacity: 0.7; } 80%, 100% { transform: scale(2.6); opacity: 0; } }
.ulgap-ping { animation: ulgap-ping 1.8s cubic-bezier(0, 0, 0.2, 1) infinite; }
@keyframes ulgap-bar { 0% { transform: translateX(0); } 100% { transform: translateX(420%); } }
.ulgap-bar { animation: ulgap-bar 2.6s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .ulgap-shine, .ulgap-glow, .ulgap-spin, .ulgap-ping, .ulgap-bar { animation: none; } }
`;

const Cross = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" className="h-2.5 w-2.5" aria-hidden="true">
    <path d="m6 6 12 12M18 6 6 18" />
  </svg>
);
const Tick = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" className="h-2.5 w-2.5" aria-hidden="true">
    <path d="m5 12.5 4.5 4.5L19 7.5" />
  </svg>
);

const ALONE_POINTS = ["Practice without a timer", "No idea which topics cost you marks", "The same mistakes, exam after exam"];
const WITH_POINTS = ["Timed mocks that feel like the real exam", "A topic-wise report after every attempt", "Retake, compare and watch your history climb"];

export default function ScoreGap({ onStart }) {
  const ref = useRef(null);
  const seen = useSeenOnce(ref);
  const [active, setActive] = useState(LAST);

  const aloneNow = useTween(ALONE[active], seen, 52);
  const withNow = useTween(WITH[active], seen, 52);
  const gap = WITH[active] - ALONE[active];

  const draw = (delay) => ({
    strokeDasharray: 1,
    strokeDashoffset: seen ? 0 : 1,
    transition: `stroke-dashoffset 1.7s cubic-bezier(0.4, 0, 0.2, 1) ${delay}ms`,
  });
  const colW = (X1 - X0) / LAST;
  const gx = xAt(active);
  const chipLeft = active >= LAST - 1; // keep the "+N pts" chip inside the chart on the right edge
  const move = "transform 380ms cubic-bezier(0.22, 1, 0.36, 1)";

  return (
    <section id="score-gap" className="relative hidden scroll-mt-24 md:block overflow-hidden bg-gradient-to-b from-(--lp-blue-tint) to-white pb-14 pt-6 md:pb-24 md:pt-10">
      <div className={SHELL}>
        <div ref={ref} className="relative">
          {/* soft backdrop: pale blue / yellow glows + faint dot grid, no panel */}
          <div className="pointer-events-none absolute -inset-x-6 -inset-y-10" aria-hidden="true">
            <div className="absolute -left-10 top-0 h-72 w-72 rounded-full bg-(--lp-blue-soft) opacity-80 blur-3xl" />
            <div className="absolute -bottom-10 right-0 h-72 w-72 rounded-full bg-(--lp-yellow)/25 blur-3xl" />
            <div
              className="absolute inset-0 opacity-50"
              style={{
                backgroundImage: "radial-gradient(rgba(15,17,21,0.08) 1px, transparent 1.2px)",
                backgroundSize: "26px 26px",
                maskImage: "radial-gradient(ellipse at 50% 35%, black 0%, transparent 70%)",
                WebkitMaskImage: "radial-gradient(ellipse at 50% 35%, black 0%, transparent 70%)",
              }}
            />
          </div>

          <div className="relative">
            <div className="max-w-3xl">
              {/* washi-tape label, torn at both ends, slightly crooked like it was stuck on by hand */}
              <Reveal>
              <span
                className={`inline-block -rotate-2 bg-(--lp-yellow)/90 px-5 py-1.5 text-sm font-bold text-(--lp-ink) shadow-[0_6px_10px_-6px_rgba(15,17,21,0.35)] ${DISPLAY}`}
                style={{ clipPath: "polygon(0 0, 100% 0, 98.5% 25%, 100% 50%, 98.5% 75%, 100% 100%, 0 100%, 1.5% 75%, 0 50%, 1.5% 25%)" }}
              >
                Same student, two paths
              </span>
              </Reveal>
              <Reveal delay={80}>
              <h2 className={`mt-4 text-balance text-3xl font-bold leading-[1.1] tracking-tight text-(--lp-ink) sm:text-4xl md:text-5xl ${DISPLAY}`}>
                Same syllabus. Same hours.{" "}
                <span className="relative inline-block">
                  <span className="absolute -inset-x-2 bottom-[0.02em] top-[0.12em] -rotate-1 rounded-xl bg-(--lp-yellow)" aria-hidden="true" />
                  <span className="relative text-(--lp-ink)">Different</span>
                </span>{" "}
                score.
              </h2>
              </Reveal>
              <Reveal delay={160}>
              <p className="mt-4 max-w-2xl text-base leading-relaxed text-(--lp-muted)">
                Reading alone feels like progress, but without timed tests and honest feedback the number barely moves. See how the same student's
                score changes once regular Universal Learning mock tests come in. Drag across the chart to compare any point.
              </p>
              </Reveal>
            </div>

            <div className="mt-10 grid gap-6 lg:grid-cols-[1.5fr_1fr] lg:items-stretch">
              {/* ---------------- chart ---------------- */}
              <Reveal delay={120} className="h-full">
              <div className="h-full rounded-3xl bg-white p-4 shadow-[0_1px_2px_rgb(15_17_21/0.04),0_24px_50px_-26px_rgb(15_17_21/0.22)] ring-1 ring-(--lp-line) sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 text-xs font-semibold">
                  <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5">
                    <span className="inline-flex items-center gap-2 text-(--lp-muted)">
                      <span className="h-[3px] w-5 rounded-full bg-[#aab0bd]" aria-hidden="true" /> Studying alone
                    </span>
                    <span className="inline-flex items-center gap-2 text-(--lp-ink)">
                      <span className="h-1 w-5 rounded-full bg-(--lp-blue)" aria-hidden="true" /> With Universal Learning
                    </span>
                  </div>
                  <span className="rounded-full bg-(--lp-grey) px-3 py-1 text-(--lp-muted)">Sample student · score by mock test</span>
                </div>

                <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 block h-auto w-full touch-pan-y select-none" role="img"
                  aria-label={`Illustrative chart: a student studying alone moves from ${ALONE[0]}% to ${ALONE[LAST]}%, while the same student taking regular Universal Learning mock tests moves from ${WITH[0]}% to ${WITH[LAST]}%.`}>
                  <defs>
                    <linearGradient id="ulgap-fill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3d7bf7" stopOpacity="0.22" />
                      <stop offset="100%" stopColor="#3d7bf7" stopOpacity="0" />
                    </linearGradient>
                  </defs>

                  {TICKS.map((t) => (
                    <g key={t}>
                      <line x1={X0} x2={X1} y1={yAt(t)} y2={yAt(t)} stroke="rgba(15,17,21,0.09)" strokeDasharray="3 6" />
                      <text x={X0 - 12} y={yAt(t) + 4} textAnchor="end" fontSize="11" fill="#8a91a0">{t}%</text>
                    </g>
                  ))}

                  {/* target score */}
                  <line x1={X0} x2={X1} y1={yAt(TARGET)} y2={yAt(TARGET)} stroke="rgba(15,17,21,0.4)" strokeWidth="1.5" strokeDasharray="7 6" />
                  <text x={X0 + 6} y={yAt(TARGET) - 8} fontSize="11" fontWeight="700" fill="#0f1115">Target score {TARGET}%</text>

                  <path d={AREA_PATH} fill="url(#ulgap-fill)" style={{ opacity: seen ? 1 : 0, transition: "opacity 1.2s ease 1s" }} />
                  <path d={ALONE_PATH} pathLength="1" fill="none" stroke="#aab0bd" strokeWidth="3" strokeLinecap="round" className="motion-reduce:transition-none" style={draw(0)} />
                  <path d={WITH_PATH} pathLength="1" fill="none" stroke="#3d7bf7" strokeWidth="4.5" strokeLinecap="round" className="motion-reduce:transition-none" style={draw(250)} />

                  {/* milestone dots */}
                  {LABELS.map((l, i) => (
                    <g key={l} style={{ opacity: seen ? 1 : 0, transition: `opacity 400ms ease ${400 + i * 220}ms` }}>
                      <circle cx={xAt(i)} cy={yAt(ALONE[i])} r="3.5" fill="#fff" stroke="#aab0bd" strokeWidth="2" />
                      <circle cx={xAt(i)} cy={yAt(WITH[i])} r="4.5" fill="#fff" stroke="#3d7bf7" strokeWidth="2.5" />
                    </g>
                  ))}

                  {/* live gap marker */}
                  <g style={{ opacity: seen ? 1 : 0, transition: "opacity 500ms ease 1.5s" }}>
                    <g style={{ transform: `translateX(${gx}px)`, transition: move }}>
                      <line x1="0" x2="0" y1={Y0 - 6} y2={Y1} stroke="rgba(15,17,21,0.22)" strokeDasharray="3 5" />
                    </g>
                    <g style={{ transform: `translate(${gx}px, ${yAt(ALONE[active])}px)`, transition: move }}>
                      <circle r="7" fill="#fff" stroke="#7c8494" strokeWidth="3" />
                    </g>
                    <g style={{ transform: `translate(${gx}px, ${yAt(WITH[active])}px)`, transition: move }}>
                      <circle r="12" fill="rgba(61,123,247,0.2)" />
                      <circle r="7.5" fill="#3d7bf7" stroke="#fff" strokeWidth="2.5" />
                    </g>
                    <g style={{ transform: `translate(${gx}px, ${(yAt(ALONE[active]) + yAt(WITH[active])) / 2}px)`, transition: move }}>
                      <line x1="0" x2="0" y1={(yAt(WITH[active]) - yAt(ALONE[active])) / 2 + 12} y2={(yAt(ALONE[active]) - yAt(WITH[active])) / 2 - 12} stroke="#3d7bf7" strokeWidth="2" strokeLinecap="round" />
                      <g transform={`translate(${chipLeft ? -76 : 12}, -13)`}>
                        <rect width="64" height="26" rx="13" fill="#ffd84d" />
                        <text x="32" y="17.5" textAnchor="middle" fontSize="12.5" fontWeight="800" fill="#0f1115">+{gap} pts</text>
                      </g>
                    </g>
                  </g>

                  {LABELS.map((l, i) => (
                    <text key={l} x={xAt(i)} y={Y1 + 28} textAnchor="middle" fontSize="12" fontWeight={i === active ? 800 : 500} fill={i === active ? "#0f1115" : "#8a91a0"} style={{ transition: "fill 200ms" }}>{l}</text>
                  ))}

                  {/* hover / touch columns */}
                  {LABELS.map((l, i) => (
                    <rect key={l} x={xAt(i) - colW / 2} y={Y0 - 10} width={colW} height={Y1 - Y0 + 48} fill="transparent" style={{ cursor: "crosshair" }}
                      onPointerEnter={() => setActive(i)} onPointerDown={() => setActive(i)} />
                  ))}
                </svg>
              </div>
              </Reveal>

              {/* ---------------- score cards ---------------- */}
              <div className="flex flex-col gap-4">
                <Reveal delay={200}>
                <div className="rounded-3xl bg-white p-5 shadow-[0_1px_2px_rgb(15_17_21/0.04),0_24px_50px_-26px_rgb(15_17_21/0.18)] ring-1 ring-(--lp-line) sm:p-6">
                  <p className="inline-flex items-center gap-2 text-xs font-semibold text-(--lp-muted)">
                    <span className="h-2 w-2 rounded-full bg-[#aab0bd]" aria-hidden="true" /> Studying alone · {LABELS[active]}
                  </p>
                  <div className="mt-2 flex items-center gap-3">
                    <span className="relative inline-block">
                      <span className={`text-6xl font-bold leading-none tracking-tight text-(--lp-ink)/70 ${DISPLAY}`}>{aloneNow}%</span>
                      {/* red-pen circle, like a marked paper */}
                      <svg viewBox="0 0 150 80" fill="none" className="pointer-events-none absolute -inset-x-3 -inset-y-2.5 h-[calc(100%+20px)] w-[calc(100%+24px)]" preserveAspectRatio="none" aria-hidden="true">
                        <path d="M78 5C38 3 6 18 7 42c1 24 36 34 74 32 40-2 64-16 61-38C140 16 108 6 72 7c-10 0-19 1-27 4" stroke="#e5484d" strokeWidth="2.6" strokeLinecap="round" opacity="0.9" />
                      </svg>
                    </span>
                  </div>
                  <ul className="mt-5 space-y-2.5">
                    {ALONE_POINTS.map((p) => (
                      <li key={p} className="flex items-start gap-2.5 text-sm text-(--lp-muted)">
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-(--lp-grey) text-(--lp-muted)"><Cross /></span>
                        {p}
                      </li>
                    ))}
                  </ul>
                </div>
                </Reveal>

                {/* hero card: gold gradient, slow light sweep, breathing glow, progress bar and a "target reached" stamp */}
                <Reveal delay={300}>
                <div className="group relative lg:-rotate-[0.8deg]">
                  <style>{GOLD_CSS}</style>
                  <span className="ulgap-glow pointer-events-none absolute -inset-3 rounded-[2.2rem] bg-(--lp-yellow) opacity-60 blur-2xl" aria-hidden="true" />
                  <div
                    className="relative overflow-hidden rounded-3xl p-5 text-(--lp-ink) ring-1 ring-white/70 transition-transform duration-300 ease-out group-hover:-translate-y-1 sm:p-6"
                    style={{
                      background: "linear-gradient(135deg, #ffe98a 0%, #ffd84d 42%, #ffc61f 100%)",
                      boxShadow: "inset 0 1px 0 rgba(255,255,255,0.85), inset 0 -18px 30px -18px rgba(176,122,0,0.35), 0 30px 60px -28px rgba(176,122,0,0.65)",
                    }}
                  >
                    {/* gloss + paper-dot texture + sweeping shine */}
                    <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-gradient-to-b from-white/40 to-transparent" aria-hidden="true" />
                    <span
                      className="pointer-events-none absolute inset-0 opacity-[0.12]"
                      style={{ backgroundImage: "radial-gradient(#0f1115 1px, transparent 1.2px)", backgroundSize: "14px 14px", maskImage: "linear-gradient(135deg, transparent 40%, black 100%)", WebkitMaskImage: "linear-gradient(135deg, transparent 40%, black 100%)" }}
                      aria-hidden="true"
                    />
                    <span className="ulgap-shine pointer-events-none absolute inset-y-[-10%] -left-1/3 w-1/4 -skew-x-[20deg] bg-gradient-to-r from-transparent via-white/70 to-transparent" aria-hidden="true" />

                    {/* "target reached" stamp, pops in once the score passes the target */}
                    <svg
                      viewBox="0 0 100 100"
                      className={`absolute right-4 top-4 h-[84px] w-[84px] transition-[opacity,transform] duration-500 ease-out sm:right-5 sm:top-5 ${withNow >= TARGET ? "rotate-[12deg] scale-100 opacity-100" : "-rotate-[24deg] scale-50 opacity-0"}`}
                      style={{ transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)", filter: "drop-shadow(0 8px 10px rgba(15,17,21,0.28))" }}
                      aria-hidden="true"
                    >
                      <defs>
                        <path id="ulgap-ring" d="M50 50 m-34 0 a34 34 0 1 1 68 0 a34 34 0 1 1 -68 0" />
                      </defs>
                      <circle cx="50" cy="50" r="48" fill="#0f1115" />
                      <circle cx="50" cy="50" r="44.5" fill="none" stroke="#ffd84d" strokeOpacity="0.5" strokeWidth="1" strokeDasharray="2 3" />
                      <g className="ulgap-spin" style={{ transformOrigin: "50px 50px" }}>
                        <text fontSize="8.5" fontWeight="800" fill="#ffd84d">
                          <textPath href="#ulgap-ring" textLength="209" lengthAdjust="spacing">TARGET REACHED • TARGET REACHED •</textPath>
                        </text>
                      </g>
                      <circle cx="50" cy="50" r="20" fill="#ffd84d" />
                      <path d="m40.5 50.5 7 7 12.5-14" fill="none" stroke="#0f1115" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>

                    <div className="relative">
                      <p className="inline-flex items-center gap-2 text-xs font-bold text-(--lp-ink)/70">
                        <span className="relative flex h-2 w-2" aria-hidden="true">
                          <span className="ulgap-ping absolute inline-flex h-full w-full rounded-full bg-(--lp-ink)/60" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-(--lp-ink)" />
                        </span>
                        With Universal Learning · {LABELS[active]}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-3">
                        <span className={`text-7xl font-bold leading-none tracking-tight ${DISPLAY}`} style={{ textShadow: "0 2px 0 rgba(255,255,255,0.55), 0 10px 24px rgba(176,122,0,0.28)" }}>{withNow}%</span>
                        <span className="rounded-full bg-(--lp-ink) px-3 py-1 text-xs font-bold text-(--lp-yellow) shadow-[0_8px_16px_-8px_rgba(15,17,21,0.6)]">+{WITH[active] - WITH[0]} pts since start</span>
                      </div>

                      {/* progress toward the target score */}
                      <div className="mt-4" aria-hidden="true">
                        <div className="relative h-2.5 overflow-hidden rounded-full bg-(--lp-ink)/15 shadow-[inset_0_1px_2px_rgba(15,17,21,0.25)]">
                          <div className="relative h-full rounded-full bg-gradient-to-r from-[#0f1115] via-[#1b2a55] to-[#2f5fe0]" style={{ width: `${Math.max(0, Math.min(100, ((withNow - 40) / 60) * 100))}%` }}>
                            <span className="ulgap-bar absolute inset-y-0 -left-1/2 w-1/2 bg-gradient-to-r from-transparent via-white/45 to-transparent" />
                          </div>
                          <span className="absolute inset-y-0 w-[2px] bg-white/90" style={{ left: `${((TARGET - 40) / 60) * 100}%` }} />
                        </div>
                        <div className="relative mt-1 h-3 text-[10px] font-bold text-(--lp-ink)/60">
                          <span className="absolute -translate-x-1/2" style={{ left: `${((TARGET - 40) / 60) * 100}%` }}>Target {TARGET}%</span>
                        </div>
                      </div>

                      <ul className="mt-4 space-y-2.5">
                        {WITH_POINTS.map((p) => (
                          <li key={p} className="flex items-start gap-2.5 text-sm font-medium text-(--lp-ink)/85">
                            <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full bg-(--lp-ink) text-(--lp-yellow)"><Tick /></span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
                </Reveal>
              </div>
            </div>

            <Reveal delay={120} className="mt-8 flex flex-col items-start justify-between gap-5 sm:flex-row sm:items-center">
              <PillButton tone="ink" onClick={onStart}>Start your first mock test</PillButton>
              <p className="max-w-md text-xs leading-relaxed text-(--lp-muted)">
                Illustrative example of one student's typical progress with regular timed practice and review. Individual results vary.
              </p>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}
