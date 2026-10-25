// Board-exam countdown banner (landing page, right after the hero + tape
// bands). Ticket-shaped dark card with:
//   • a live flip-clock (digits animate when they change — transform/opacity)
//   • a dynamic headline ("Boards are N days away")
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

// One flip-clock digit pair. The span is re-keyed whenever the value changes
// so the CSS tick animation replays; it is skipped on first paint.
function FlipValue({ value }) {
  const prev = useRef(value);
  const changed = prev.current !== value;
  useEffect(() => {
    prev.current = value;
  });
  return (
    <span key={value} className={`inline-block ${changed ? "ul-flip-tick" : ""}`}>
      {String(value).padStart(2, "0")}
    </span>
  );
}

function ClockCard({ label, value, tone, grow }) {
  return (
    <div className={grow ? "flex-[1.55]" : "flex-1"}>
      <div className={`relative overflow-hidden rounded-2xl sm:rounded-3xl ${tone}`}>
        <div className="relative z-10 grid place-items-center py-6 font-(family-name:--lp-font) text-3xl font-extrabold leading-none tabular-nums tracking-tight sm:py-9 sm:text-5xl lg:text-6xl">
          <FlipValue value={value} />
        </div>
        {/* flip-card details: lighter top half, hinge line, side pins */}
        <span className="pointer-events-none absolute inset-x-0 top-0 h-1/2 bg-white/[0.10]" aria-hidden="true" />
        <span className="pointer-events-none absolute inset-x-0 top-1/2 h-[2px] -translate-y-1/2 bg-black/35" aria-hidden="true" />
        <span className="pointer-events-none absolute -left-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-(--lp-ink)" aria-hidden="true" />
        <span className="pointer-events-none absolute -right-1.5 top-1/2 h-3 w-3 -translate-y-1/2 rounded-full bg-(--lp-ink)" aria-hidden="true" />
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
        @keyframes ul-flip-in { from { opacity: 0; transform: translateY(-30%) scaleY(0.8); } to { opacity: 1; transform: none; } }
        .ul-flip-tick { animation: ul-flip-in 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) both; transform-origin: 50% 0; }
        @media (prefers-reduced-motion: reduce) { .ul-flip-tick { animation: none; } }
      `}</style>

      <div className={SHELL}>
        <Reveal className="relative">
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
