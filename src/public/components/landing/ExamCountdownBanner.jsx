// Board-exam countdown banner (landing page, right after the hero + tape
// bands). Ticket-shaped dark card with:
//   • a live flip-clock (each card turns like a calendar page when its number changes)
//   • a dynamic headline ("Boards are N days away")
//   • a clock hanging from the ticker strip above, swinging in on scroll
//   • a prep roadmap: Chapter tests → Full-length mocks → Revision → Boards,
//     with a progress line that fills and a pulsing "you are here" marker
//
// Dates are suggestions for urgency/pacing only — official CBSE dates may
// change, and the footnote says so. Update BOARD_EXAM_START (and the phase
// end dates) each academic year.
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CheckCircleIcon, ClockIcon, TargetIcon } from "../../../components/ui/icons";
import { ArrowUpRight, PillButton, Reveal, Sticker } from "./LandingUI";

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

const ist = (d) => new Date(`${d}T00:00:00+05:30`).getTime();

const BOARD_EXAM_START = ist("2027-02-15");
const ROADMAP_START = ist("2026-10-01");

// Each phase ends where the next begins. The last phase ends on exam day.
const PHASES = [
  { label: "Chapter-wise tests", short: "Chapters", note: "Till 15 Dec", end: ist("2026-12-15") },
  { label: "Full-length mocks", short: "Mocks", note: "Till 31 Jan", end: ist("2027-02-01") },
  { label: "Revision & reports", short: "Revision", note: "Till 14 Feb", end: BOARD_EXAM_START },
];

const DAY = 86400;

function useNow() {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

const pad2 = (v) => String(v).padStart(2, "0");
const prefersReducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

// One half of a flip card (top or bottom of the number). The number is laid out
// at full card height and clipped, so the two halves always line up.
function Half({ pos, text, className = "", shade = "" }) {
  const top = pos === "top";
  return (
    <span className={`absolute inset-x-0 ${top ? "top-0" : "bottom-0"} h-1/2 overflow-hidden bg-inherit ${className}`}>
      <span className={`absolute inset-x-0 ${top ? "top-0" : "bottom-0"} grid h-[200%] place-items-center`}>{text}</span>
      {top && <span className="absolute inset-0 bg-white/[0.10]" />}
      {shade && <span className={`absolute inset-0 bg-black ${shade}`} />}
    </span>
  );
}

// Calendar-style page flip. When the value changes, the old top half folds down
// over the hinge and the new bottom half drops into place, like turning a page.
// The new number sits underneath the whole time, so nothing ever blinks.
function FlipValue({ value }) {
  const [view, setView] = useState({ cur: value, prev: value, key: 0, flipping: false });
  if (value !== view.cur) {
    // derived from props during render (React-approved): start a flip
    setView({ cur: value, prev: view.cur, key: view.key + 1, flipping: !prefersReducedMotion() });
  }
  const cur = pad2(view.cur);
  const prev = pad2(view.prev);

  return (
    <span className="absolute inset-0 bg-inherit" style={{ perspective: 520 }} aria-hidden="true">
      <Half pos="top" text={cur} />
      <Half pos="bottom" text={view.flipping ? prev : cur} />
      {view.flipping && (
        <>
          <Half key={`t${view.key}`} pos="top" text={prev} className="ul-leaf-top z-10" shade="ul-shade-top" />
          <Half
            key={`b${view.key}`}
            pos="bottom"
            text={cur}
            className="ul-leaf-bot z-10"
            shade="ul-shade-bot"
          />
          {/* the bottom leaf lands last, so it ends the flip */}
          <span
            key={`e${view.key}`}
            className="ul-flip-end absolute"
            onAnimationEnd={() => setView((v) => (v.key === view.key ? { ...v, flipping: false } : v))}
          />
        </>
      )}
    </span>
  );
}

function ClockCard({ label, value, tone, grow }) {
  return (
    <div className={grow ? "flex-[1.55]" : "flex-1"}>
      <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl ${tone}`}>
        <div className="relative z-10 bg-inherit font-(family-name:--lp-font) text-3xl font-extrabold leading-none tabular-nums tracking-tight sm:text-5xl lg:text-6xl">
          {/* invisible copy gives the card its height; FlipValue fills it */}
          <div className="invisible grid place-items-center py-6 sm:py-9">{pad2(value)}</div>
          <FlipValue value={value} />
        </div>
        {/* hinge line and side pins, above the flipping leaves */}
        <span className="pointer-events-none absolute inset-x-0 top-1/2 z-20 h-[2px] -translate-y-1/2 bg-black/35" aria-hidden="true" />
        <span className="pointer-events-none absolute -left-1.5 top-1/2 z-20 h-3 w-3 -translate-y-1/2 rounded-full bg-(--lp-ink)" aria-hidden="true" />
        <span className="pointer-events-none absolute -right-1.5 top-1/2 z-20 h-3 w-3 -translate-y-1/2 rounded-full bg-(--lp-ink)" aria-hidden="true" />
      </div>
      <p className="mt-3 text-center text-[10px] font-semibold uppercase tracking-[0.16em] text-white/60 sm:text-xs">{label}</p>
    </div>
  );
}

function Roadmap({ activeIdx, fraction }) {
  const nodes = [...PHASES.map((p) => ({ label: p.short, note: p.note })), { label: "Boards", note: "15 Feb" }];
  const fill = Math.min(1, (activeIdx + fraction) / (nodes.length - 1));

  return (
    <div className="relative">
      <div className="absolute left-[12.5%] right-[12.5%] top-4 h-[3px] -translate-y-1/2 rounded-full bg-white/15" aria-hidden="true">
        <div
          className="h-full origin-left rounded-full bg-(--lp-yellow) transition-transform duration-1000 ease-out"
          style={{ transform: `scaleX(${fill})` }}
        />
      </div>
      <ol className="relative grid grid-cols-4">
        {nodes.map((n, i) => {
          const isBoards = i === nodes.length - 1;
          const done = i < activeIdx;
          const active = i === activeIdx;
          return (
            <li key={n.label} className="flex flex-col items-center text-center" aria-current={active ? "step" : undefined}>
              <span className="relative grid h-8 w-8 place-items-center">
                {active && <span className="absolute inset-0 rounded-full bg-(--lp-yellow)/50 motion-safe:animate-ping" aria-hidden="true" />}
                <span
                  className={`relative grid h-8 w-8 place-items-center rounded-full ring-4 ring-(--lp-ink) ${
                    isBoards
                      ? "bg-(--lp-blue) text-white"
                      : done || active
                        ? "bg-(--lp-yellow) text-(--lp-ink)"
                        : "border-2 border-white/25 bg-(--lp-ink-soft) text-white/40"
                  }`}
                >
                  {isBoards ? <TargetIcon className="h-4 w-4" /> : done ? <CheckCircleIcon className="h-4 w-4" /> : <span className="h-2 w-2 rounded-full bg-current" />}
                </span>
              </span>
              <span className={`mt-2.5 text-xs font-bold leading-tight sm:text-[13px] ${active ? "text-(--lp-yellow)" : done ? "text-white/80" : "text-white/55"}`}>
                {n.label}
              </span>
              <span className="mt-0.5 text-[10px] font-medium text-white/45 sm:text-xs">{n.note}</span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}


// ─── Hanging alarm clock ───────────────────────────────────────────────────
// Hangs on two chains from the black ticker strip above this section. When it
// scrolls into view it lowers out from under the strip, swings like a pendulum
// and keeps swaying slowly and never stops. The second hand steps once per second in
// time with the countdown. Large screens only; static under reduced motion.
const HANG_CSS = `
.ul-hang { position: absolute; left: 45%; top: -100px; width: 140px; height: 290px; margin-left: -70px; z-index: 20; pointer-events: none; }
.ul-hang-mount { position: absolute; top: 0; left: 50%; z-index: 2; width: 46px; height: 12px; margin-left: -23px; border-radius: 0 0 10px 10px; background: var(--lp-ink-soft); box-shadow: inset 0 0 0 1px rgba(255,255,255,0.24); }
.ul-hang-mount::after { content: ""; position: absolute; left: 50%; bottom: 2.5px; width: 5px; height: 5px; margin-left: -2.5px; border-radius: 50%; background: var(--lp-yellow); }
.ul-hang-clip { position: absolute; inset: 10px 0 0 0; clip-path: inset(0 -120px -200px -120px); }
.ul-hang-drop { transform: translateY(-100%); }
.ul-hang-swing { transform-origin: 50% 0; }
.ul-hang-hover { transform-origin: 50% 0; transition: transform 1.3s cubic-bezier(0.3, 1.9, 0.45, 1); }
.ul-hang-hover[data-held="true"] { transition: transform 0.35s cubic-bezier(0.2, 0.7, 0.3, 1); }
.ul-hang-zone { position: absolute; left: 0; right: 0; top: 70px; bottom: 0; z-index: 3; pointer-events: auto; cursor: grab; }
.ul-hang[data-live="true"] .ul-hang-drop { animation: ul-hang-drop 1s cubic-bezier(0.22, 0.8, 0.3, 1) both; }
.ul-hang[data-live="true"] .ul-hang-swing { animation: ul-hang-swing 5.6s ease-out 0.8s both, ul-hang-idle 6s ease-in-out 6.4s infinite; }
.ul-hang-chains { display: block; width: 116px; height: 90px; margin: 0 auto; overflow: visible; }
.ul-hang-clock { position: relative; width: 104px; height: 104px; margin: -4px auto 0; filter: drop-shadow(0 16px 18px rgba(0,0,0,0.5)); }
.ul-hang-bell { position: absolute; top: -8px; width: 30px; height: 15px; border-radius: 15px 15px 0 0; background: var(--lp-yellow); box-shadow: inset 0 -3px 0 rgba(15,17,21,0.18); }
.ul-hang-bell.l { left: 8px; transform: rotate(-26deg); }
.ul-hang-bell.r { right: 8px; transform: rotate(26deg); }
.ul-hang-face { position: relative; display: block; width: 100%; height: 100%; }
.ul-hang-sec { transition: transform 0.3s cubic-bezier(0.34, 1.7, 0.5, 1); }
@keyframes ul-hang-drop { from { transform: translateY(-100%); } to { transform: translateY(0); } }
@keyframes ul-hang-swing {
  0% { transform: rotate(0deg); } 11% { transform: rotate(-24deg); } 28% { transform: rotate(18deg); }
  44% { transform: rotate(-12deg); } 60% { transform: rotate(8deg); } 74% { transform: rotate(-4.5deg); }
  88% { transform: rotate(2deg); } 100% { transform: rotate(0deg); }
}
@keyframes ul-hang-idle { 0%, 100% { transform: rotate(0deg); } 25% { transform: rotate(3.6deg); } 75% { transform: rotate(-3.6deg); } }
@media (prefers-reduced-motion: reduce) {
  .ul-hang-drop { transform: none; animation: none !important; }
  .ul-hang-swing { animation: none !important; }
  .ul-hang-hover { transform: none !important; transition: none; }
  .ul-hang-sec { transition: none; }
}
`;

const FACE_TICKS = Array.from({ length: 60 }, (_, i) => i);

function HangingClock({ now }) {
  const ref = useRef(null);
  const [live, setLive] = useState(() => typeof IntersectionObserver === "undefined");
  // bumped every time the clock re-enters the viewport, so the big swing replays
  const [swingRun, setSwingRun] = useState(0);
  const [tilt, setTilt] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") return undefined;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setLive(true);
          setSwingRun((n) => n + 1);
        }
      },
      { threshold: 0.4, rootMargin: "0px 0px -8% 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Hover: the clock swings toward the side the cursor is on (up to ~20deg),
  // then springs back with a little overshoot when the cursor leaves.
  const handleMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const dx = (e.clientX - (rect.left + rect.width / 2)) / (rect.width / 2);
    setHeld(true);
    setTilt(-Math.max(-1, Math.min(1, dx)) * 20);
  };
  const handleLeave = () => {
    setHeld(false);
    setTilt(0);
  };

  const date = new Date(now);
  const secAngle = Math.floor(now / 1000) * 6; // keeps counting up, so it never rewinds at :59
  const minAngle = date.getMinutes() * 6 + date.getSeconds() * 0.1;
  const hourAngle = (date.getHours() % 12) * 30 + date.getMinutes() * 0.5;
  const rot = (deg) => ({ transformOrigin: "60px 60px", transform: `rotate(${deg}deg)` });

  return (
    <div ref={ref} className="ul-hang hidden lg:block" data-live={live ? "true" : "false"} aria-hidden="true">
      <style>{HANG_CSS}</style>
      <span className="ul-hang-mount" />
      <div className="ul-hang-clip">
        <div className="ul-hang-drop">
          <div className="ul-hang-hover" data-held={held ? "true" : "false"} style={{ transform: `rotate(${tilt}deg)` }}>
          <div key={swingRun} className="ul-hang-swing">
            <svg className="ul-hang-chains" viewBox="0 0 116 100" preserveAspectRatio="none" fill="none">
              <path d="M58 0 29 100" stroke="#2a2f3a" strokeWidth="2.6" strokeDasharray="5 2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path d="M58 0 87 100" stroke="#2a2f3a" strokeWidth="2.6" strokeDasharray="5 2.5" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="ul-hang-clock">
              <span className="ul-hang-bell l" />
              <span className="ul-hang-bell r" />
              <svg className="ul-hang-face" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="58" fill="var(--lp-yellow)" />
                <circle cx="60" cy="60" r="50" fill="#fff" />
                {FACE_TICKS.map((i) => {
                  const major = i % 5 === 0;
                  return (
                    <line
                      key={i}
                      x1="60" x2="60" y1={major ? 13 : 14.5} y2={major ? 22 : 17.5}
                      stroke="var(--lp-ink)" strokeOpacity={major ? 1 : 0.3} strokeWidth={major ? 2.6 : 1}
                      strokeLinecap="round" transform={`rotate(${i * 6} 60 60)`}
                    />
                  );
                })}
                <g style={rot(hourAngle)}><rect x="58.4" y="32" width="3.2" height="30" rx="1.6" fill="var(--lp-ink)" /></g>
                <g style={rot(minAngle)}><rect x="58.8" y="21" width="2.4" height="41" rx="1.2" fill="var(--lp-ink)" /></g>
                <g className="ul-hang-sec" style={rot(secAngle)}>
                  <rect x="59.2" y="19" width="1.6" height="52" rx="0.8" fill="var(--lp-blue-deep)" />
                </g>
                <circle cx="60" cy="60" r="4.2" fill="var(--lp-yellow)" stroke="var(--lp-ink)" strokeWidth="1.6" />
              </svg>
            </div>
          </div>
          </div>
        </div>
      </div>
      <span className="ul-hang-zone" onMouseMove={handleMove} onMouseLeave={handleLeave} />
    </div>
  );
}

export default function ExamCountdownBanner() {
  const navigate = useNavigate();
  const now = useNow();

  const remaining = Math.max(0, Math.floor((BOARD_EXAM_START - now) / 1000));
  const days = Math.floor(remaining / DAY);
  const weeks = Math.floor(days / 7);
  const clock = [
    { label: "Days", value: days },
    { label: "Hours", value: Math.floor((remaining % DAY) / 3600) },
    { label: "Minutes", value: Math.floor((remaining % 3600) / 60) },
    { label: "Seconds", value: remaining % 60 },
  ];

  // Which roadmap phase are we in, and how far through it?
  const idx = PHASES.findIndex((p) => now < p.end);
  const activeIdx = idx === -1 ? PHASES.length : idx;
  const phaseStart = activeIdx === 0 ? ROADMAP_START : PHASES[activeIdx - 1]?.end;
  const phaseEnd = PHASES[activeIdx]?.end;
  const fraction = phaseEnd ? Math.min(1, Math.max(0, (now - phaseStart) / (phaseEnd - phaseStart))) : 0;
  const phase = PHASES[activeIdx];

  const tones = [
    "bg-(--lp-yellow) text-(--lp-ink) shadow-[0_0_60px_-10px_rgba(255,216,77,0.55)]",
    "bg-(--lp-ink-soft) text-white ring-1 ring-white/10",
    "bg-(--lp-ink-soft) text-white ring-1 ring-white/10",
    "bg-(--lp-blue) text-white",
  ];

  return (
    <section className="py-10 md:py-14" aria-labelledby="exam-countdown-title">
      <style>{`
        .ul-leaf-top { transform-origin: 50% 100%; backface-visibility: hidden; animation: ul-leaf-top 0.3s cubic-bezier(0.55, 0, 1, 0.8) both; }
        .ul-leaf-bot { transform-origin: 50% 0%; backface-visibility: hidden; transform: rotateX(90deg); animation: ul-leaf-bot 0.36s cubic-bezier(0.1, 0.8, 0.3, 1) 0.28s both; }
        .ul-shade-top { opacity: 0; animation: ul-shade-top 0.3s linear both; }
        .ul-shade-bot { opacity: 0.4; animation: ul-shade-bot 0.36s ease-out 0.28s both; }
        .ul-flip-end { width: 0; height: 0; animation: ul-flip-end 0.64s linear both; }
        @keyframes ul-leaf-top { from { transform: rotateX(0deg); } to { transform: rotateX(-90deg); } }
        @keyframes ul-leaf-bot { from { transform: rotateX(90deg); } to { transform: rotateX(0deg); } }
        @keyframes ul-shade-top { from { opacity: 0; } to { opacity: 0.45; } }
        @keyframes ul-shade-bot { from { opacity: 0.4; } to { opacity: 0; } }
        @keyframes ul-flip-end { from { opacity: 1; } to { opacity: 0.99; } }
      `}</style>

      <div className={SHELL}>
        <Reveal className="relative">
          <HangingClock now={now} />
          <div className="relative overflow-hidden rounded-[40px] bg-(--lp-ink) px-6 py-12 text-white sm:px-12 sm:py-14">
            {/* background atmosphere */}
            <div className="pointer-events-none absolute inset-0" aria-hidden="true">
              <div className="absolute -right-32 -top-32 h-[26rem] w-[26rem] rounded-full border border-white/10" />
              <div className="absolute -right-16 -top-16 h-[18rem] w-[18rem] rounded-full border border-white/10" />
              <div className="absolute -right-4 -top-4 h-[10rem] w-[10rem] rounded-full bg-(--lp-blue)/80" />
              <div className="absolute -bottom-40 left-[22%] h-80 w-80 rounded-full bg-(--lp-blue)/20" />
              <div className="absolute -left-24 top-1/3 h-72 w-72 rounded-full bg-(--lp-yellow)/[0.07] blur-3xl" />
              <div
                className="absolute inset-0 opacity-40"
                style={{
                  backgroundImage: "radial-gradient(rgba(255,255,255,0.12) 1px, transparent 1.2px)",
                  backgroundSize: "24px 24px",
                  maskImage: "linear-gradient(to right, black, transparent 60%)",
                  WebkitMaskImage: "linear-gradient(to right, black, transparent 60%)",
                }}
              />
            </div>

            <div className="relative grid items-center gap-10 lg:grid-cols-[1fr_auto_1.15fr] lg:gap-12">
              {/* ───────── left: the message ───────── */}
              <div>
                <span className="inline-flex items-center gap-2 rounded-full bg-(--lp-yellow) px-3.5 py-1.5 text-xs font-bold uppercase tracking-wider text-(--lp-ink)">
                  <ClockIcon className="h-3.5 w-3.5" />
                  Board exams are coming up
                </span>

                <h2 id="exam-countdown-title" className="mt-5 max-w-md text-balance font-(family-name:--lp-font) text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
                  Boards are <span className="text-(--lp-yellow)">{days} days</span> away.
                  <span className="mt-1 block text-white/90">Practise like it.</span>
                </h2>

                <p className="mt-4 max-w-sm text-sm leading-6 text-white/65 sm:text-base">
                  Get exam ready with focused test series practice — every test you take now is one less surprise on exam day.
                </p>

                <div className="mt-5 flex flex-wrap gap-2">
                  {["Chapter-wise tests", "Full-length mocks", "Per-question reports"].map((perk) => (
                    <span key={perk} className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white/85 ring-1 ring-white/10">
                      <CheckCircleIcon className="h-3.5 w-3.5 text-(--lp-yellow)" />
                      {perk}
                    </span>
                  ))}
                </div>

                <div className="mt-8">
                  <PillButton tone="yellow" onClick={() => navigate("/test-series")}>
                    Start practising today
                  </PillButton>
                </div>
              </div>

              {/* ticket perforation */}
              <div className="hidden h-full min-h-[200px] border-l-2 border-dashed border-white/20 lg:block" aria-hidden="true" />

              {/* ───────── right: the clock + roadmap ───────── */}
              <div>
                <p className="sr-only">
                  {days} days until the expected start of the CBSE board exam season on 15 February 2027.
                </p>

                {phase && (
                  <p className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/[0.07] px-3.5 py-1.5 text-xs font-semibold text-white/80 ring-1 ring-white/10">
                    <span className="relative grid h-2 w-2 place-items-center" aria-hidden="true">
                      <span className="absolute inset-0 rounded-full bg-(--lp-yellow) motion-safe:animate-ping" />
                      <span className="relative h-2 w-2 rounded-full bg-(--lp-yellow)" />
                    </span>
                    {weeks} weeks to go · Right now: <span className="text-(--lp-yellow)">{phase.label}</span>
                  </p>
                )}

                <div className="flex items-start gap-2.5 sm:gap-4" role="img" aria-label={`${days} days, ${clock[1].value} hours, ${clock[2].value} minutes left`}>
                  {clock.map((c, i) => (
                    <ClockCard key={c.label} label={c.label} value={c.value} tone={tones[i]} grow={i === 0} />
                  ))}
                </div>

                <div className="mt-8 rounded-3xl bg-white/[0.04] px-3 pb-4 pt-5 ring-1 ring-white/10 sm:px-5">
                  <p className="mb-4 px-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/50 sm:text-xs">Your prep roadmap</p>
                  <Roadmap activeIdx={activeIdx} fraction={fraction} />
                </div>

                <p className="mt-4 text-xs leading-5 text-white/50">Expected CBSE exam season start: 15 Feb 2027; official dates may change. Roadmap is a suggested plan.</p>
              </div>
            </div>
          </div>

          {/* ticket notches */}
          <span className="pointer-events-none absolute -left-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-white sm:block" aria-hidden="true" />
          <span className="pointer-events-none absolute -right-5 top-1/2 hidden h-10 w-10 -translate-y-1/2 rounded-full bg-white sm:block" aria-hidden="true" />
          <Sticker
            text="PRACTICE • EVERY • DAY • "
            className="absolute -top-7 right-10 hidden h-24 w-24 -rotate-12 bg-(--lp-blue) text-white shadow-[0_14px_30px_rgba(15,17,21,0.3)] ring-4 ring-white md:grid"
          >
            <span className="grid h-9 w-9 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink)"><ArrowUpRight className="h-4 w-4" /></span>
          </Sticker>
        </Reveal>
      </div>
    </section>
  );
}
