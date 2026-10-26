// Landing hero, focused on test series. Centred layout: logo mark, headline,
// line, entry buttons and search, framed by two clusters of floating product
// cards: the test screen (question + palette) on the left and the result
// (report + attempt history) on the right. Cards are decorative — sample
// figures only. Then the ticker strip.
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
@media (prefers-reduced-motion: reduce) { .ul-float-a, .ul-float-b, .ul-drift { animation: none; } }
`;

function Sparkle({ className = "", style }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <path d="M12 0c.9 6.4 5.6 11.1 12 12-6.4.9-11.1 5.6-12 12-.9-6.4-5.6-11.1-12-12C6.4 11.1 11.1 6.4 12 0Z" fill="currentColor" />
    </svg>
  );
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

// Left cluster: a live question (the "taking a test" moment) and the question
// palette every real exam screen has. Sample content only.
const PALETTE_SKIPPED = new Set([3, 7]);
const PALETTE_FLAGGED = new Set([5, 9]);
const PALETTE_CURRENT = 12;

function paletteCell(n) {
  if (n === PALETTE_CURRENT) return "bg-white text-(--lp-ink) ring-2 ring-(--lp-ink)";
  if (PALETTE_FLAGGED.has(n)) return "bg-(--lp-yellow) text-(--lp-ink)";
  if (n < PALETTE_CURRENT && !PALETTE_SKIPPED.has(n)) return "bg-(--lp-blue) text-white";
  return "bg-(--lp-grey) text-(--lp-muted)";
}

const OPTIONS = [
  { key: "A", text: "1.5 N" },
  { key: "B", text: "5 N" },
  { key: "C", text: "6 N", selected: true },
  { key: "D", text: "12 N" },
];

function LeftCards() {
  return (
    <div className="pointer-events-none absolute -left-2 top-1/2 hidden h-[480px] w-[330px] origin-left -translate-y-1/2 scale-[0.74] xl:block 2xl:left-4 2xl:scale-100" aria-hidden="true">

      {/* question */}
      <div className={`ul-float-a absolute left-2 top-2 w-[296px] p-4 ${CARD}`} style={{ "--r": "-2deg" }}>
        <div className="flex items-center justify-between">
          <span className="rounded-full bg-(--lp-blue-soft) px-2.5 py-1 text-[10.5px] font-bold text-(--lp-blue-deep)">Physics</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-grey) px-2.5 py-1 text-[11px] font-bold tabular-nums text-(--lp-ink)">
            <ClockIcon className="h-3 w-3 text-(--lp-muted)" /> 42:10
          </span>
        </div>
        <p className="mt-3.5 text-[11px] font-semibold text-(--lp-muted)">Question 12 of 40</p>
        <span className="mt-1.5 block h-1 rounded-full bg-(--lp-grey)"><span className="block h-full w-[30%] rounded-full bg-(--lp-blue)" /></span>
        <p className="mt-3 text-[14px] font-semibold leading-snug tracking-[-0.01em] text-(--lp-ink)">
          A 2 kg mass accelerates at 3 m/s². What is the net force acting on it?
        </p>
        <ul className="mt-3.5 space-y-1.5">
          {OPTIONS.map((o) => (
            <li
              key={o.key}
              className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-[12.5px] font-semibold ${
                o.selected ? "bg-(--lp-blue-soft) text-(--lp-blue-deep) ring-[1.5px] ring-(--lp-blue)" : "text-(--lp-ink) ring-1 ring-(--lp-line)"
              }`}
            >
              <span className={`grid h-5 w-5 place-items-center rounded-md text-[10px] font-bold ${o.selected ? "bg-(--lp-blue-deep) text-white" : "bg-(--lp-grey) text-(--lp-muted)"}`}>{o.key}</span>
              <span className="flex-1">{o.text}</span>
              {o.selected && <CheckIcon className="h-3.5 w-3.5" />}
            </li>
          ))}
        </ul>
        <div className="mt-3.5 flex items-center justify-between">
          <span className="text-[11px] font-semibold text-(--lp-muted)">Mark for review</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-3.5 py-1.5 text-[11px] font-semibold text-white">
            Next <ArrowUpRight className="h-3 w-3" />
          </span>
        </div>
      </div>

      {/* question palette */}
      <div className={`ul-float-b absolute left-12 top-[352px] z-10 w-[270px] p-3.5 ${CARD}`} style={{ "--r": "1.5deg" }}>
        <div className="flex items-baseline justify-between">
          <p className="text-[11.5px] font-bold text-(--lp-ink)">Question palette</p>
          <p className="text-[10.5px] font-semibold text-(--lp-muted)">9 answered</p>
        </div>
        <div className="mt-2.5 grid grid-cols-10 gap-1">
          {Array.from({ length: 40 }, (_, i) => i + 1).map((n) => (
            <span key={n} className={`grid aspect-square place-items-center rounded-[5px] text-[8.5px] font-bold tabular-nums ${paletteCell(n)}`}>{n}</span>
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

const SCORE_PCT = 92;
const DONUT_R = 34;
const DONUT_C = 2 * Math.PI * DONUT_R;

const BREAKDOWN = [
  { label: "Mechanics", pct: 96 },
  { label: "Optics", pct: 90 },
  { label: "Thermodynamics", pct: 83 },
];

// Right cluster: the report a student gets after submitting, plus the attempt
// history that comes with retaking. Sample figures only.
function RightCards() {
  return (
    <div className="pointer-events-none absolute -right-2 top-1/2 hidden h-[480px] w-[340px] origin-right -translate-y-1/2 scale-[0.74] xl:block 2xl:right-4 2xl:scale-100" aria-hidden="true">
      {/* result report */}
      <div className={`ul-float-b absolute right-0 top-2 w-[316px] p-4 ${CARD}`} style={{ "--r": "1.5deg" }}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12.5px] font-bold tracking-[-0.01em] text-(--lp-ink)">Mock Test 3 · Physics</p>
            <p className="mt-0.5 text-[10.5px] font-medium text-(--lp-muted)">40 questions · 42:10 of 60:00</p>
          </div>
          <span className="rounded-full bg-[#e6f5ee] px-2.5 py-1 text-[10.5px] font-bold text-[#17794f]">Passed</span>
        </div>

        <div className="mt-4 flex items-center gap-4">
          <div className="relative h-[88px] w-[88px] shrink-0">
            <svg viewBox="0 0 88 88" className="h-full w-full -rotate-90">
              <circle cx="44" cy="44" r={DONUT_R} fill="none" stroke="var(--lp-grey)" strokeWidth="9" />
              <circle
                cx="44" cy="44" r={DONUT_R} fill="none" stroke="var(--lp-blue)" strokeWidth="9" strokeLinecap="round"
                strokeDasharray={`${(DONUT_C * SCORE_PCT) / 100} ${DONUT_C}`}
              />
            </svg>
            <div className="absolute inset-0 grid place-content-center text-center">
              <span className="font-(family-name:--lp-font) text-[22px] font-bold leading-none tracking-tight text-(--lp-ink)">{SCORE_PCT}%</span>
              <span className="mt-0.5 text-[9px] font-semibold uppercase tracking-wider text-(--lp-muted)">Score</span>
            </div>
          </div>
          <ul className="flex-1 space-y-2 text-[11.5px] font-semibold text-(--lp-ink)">
            <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#1f9d6b]" /><span className="flex-1 text-(--lp-muted)">Correct</span>37</li>
            <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#d64545]" /><span className="flex-1 text-(--lp-muted)">Wrong</span>2</li>
            <li className="flex items-center gap-2"><i className="h-2 w-2 rounded-full bg-[#c4c9d4]" /><span className="flex-1 text-(--lp-muted)">Skipped</span>1</li>
          </ul>
        </div>

        <div className="mt-4 space-y-2 border-t border-(--lp-line) pt-3.5">
          {BREAKDOWN.map((row) => (
            <div key={row.label} className="flex items-center gap-3 text-[11px] font-semibold">
              <span className="w-[92px] text-(--lp-muted)">{row.label}</span>
              <span className="h-1.5 flex-1 rounded-full bg-(--lp-grey)"><span className="block h-full rounded-full bg-(--lp-ink)" style={{ width: `${row.pct}%` }} /></span>
              <span className="w-7 text-right tabular-nums text-(--lp-ink)">{row.pct}%</span>
            </div>
          ))}
        </div>
      </div>

      {/* attempt history */}
      <div className={`ul-float-a absolute bottom-0 right-10 z-10 w-[264px] p-3.5 ${CARD}`} style={{ "--r": "-1.5deg" }}>
        <div className="flex items-center justify-between">
          <p className="text-[11.5px] font-bold text-(--lp-ink)">Attempt history</p>
          <span className="inline-flex items-center rounded-full bg-[#e6f5ee] px-2 py-0.5 text-[10px] font-bold text-[#17794f]">+14% vs last</span>
        </div>
        <svg viewBox="0 0 240 64" className="mt-2 h-16 w-full" fill="none">
          <defs>
            <linearGradient id="ul-hist" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--lp-blue)" stopOpacity="0.22" />
              <stop offset="1" stopColor="var(--lp-blue)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d="M16 46C58 46 76 30 120 30S184 12 224 12V62H16Z" fill="url(#ul-hist)" />
          <path d="M16 46C58 46 76 30 120 30S184 12 224 12" stroke="var(--lp-blue)" strokeWidth="2.2" strokeLinecap="round" />
          <circle cx="16" cy="46" r="3.5" fill="#fff" stroke="var(--lp-blue)" strokeWidth="2" />
          <circle cx="120" cy="30" r="3.5" fill="#fff" stroke="var(--lp-blue)" strokeWidth="2" />
          <circle cx="224" cy="12" r="5" fill="var(--lp-yellow)" stroke="var(--lp-ink)" strokeWidth="2" />
        </svg>
        <div className="flex justify-between px-0.5 text-[10px] font-semibold tabular-nums text-(--lp-muted)">
          <span>64%</span><span>78%</span><span className="text-(--lp-ink)">92%</span>
        </div>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  // Search and the "Popular" chips lead to the student's test series list:
  // straight there when signed in as a student, through Log in first (which
  // returns here afterwards) when signed out. Other roles keep the public list.
  const goToSeries = (query) => {
    const q = String(query ?? "").trim();
    const suffix = q ? `?q=${encodeURIComponent(q)}` : "";
    if (user?.role === "student") return navigate(`/student/test-series${suffix}`);
    if (!user && !authLoading) return navigate(`/login?redirect=${encodeURIComponent(`/student/test-series${suffix}`)}`);
    return navigate(`/test-series${suffix}`);
  };
  return (
    // Fill the first screen: viewport height minus the navbar, hero centred in
    // the space above the ticker strip. Natural height on short/mobile screens.
    <div className="flex flex-col xl:min-h-[calc(100svh-4.5rem)]">
      {/* ───────────────────────────── HERO ───────────────────────────── */}
      <section className="relative isolate flex flex-1 items-start overflow-hidden px-5 pb-10 pt-8 sm:px-8 md:pb-14 md:pt-10 xl:items-center xl:pt-8">
        {/* soft washes + faint dotted grid, static */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <style>{FLOAT_CSS}</style>
          <div className="ul-drift absolute -left-40 top-[10%] h-[460px] w-[460px] rounded-full bg-(--lp-blue-soft) opacity-70 blur-3xl" style={{ "--dx": "60px", "--dy": "40px", "--dur": "34s" }} />
          <div className="ul-drift absolute -right-40 top-[18%] h-[420px] w-[420px] rounded-full bg-(--lp-yellow) opacity-25 blur-3xl" style={{ "--dx": "-50px", "--dy": "50px", "--dur": "40s", "--delay": "-12s" }} />
          <AmbientLayer />
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
          <LeftCards />
          <RightCards />

          <div className="relative z-10 mx-auto flex max-w-[780px] flex-col items-center text-center">
            <Reveal delay={40}><LogoMark /></Reveal>

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
              <div className="mt-8 flex min-h-[56px] flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-x-4">
                {authLoading ? null : user ? (
                  <PillButton tone="ink" className="w-full max-w-[300px] sm:w-auto sm:max-w-none [&>span:first-child]:flex-1 [&>span:first-child]:text-center sm:[&>span:first-child]:flex-none" onClick={() => navigate(homePathForUser(user))}>
                    Go to Dashboard
                  </PillButton>
                ) : (
                  <>
                    <PillButton tone="ink" className="w-full max-w-[300px] sm:w-auto sm:max-w-none [&>span:first-child]:flex-1 [&>span:first-child]:text-center sm:[&>span:first-child]:flex-none" onClick={() => navigate("/register")}>
                      I'm a Student
                    </PillButton>
                    <PillButton tone="outline" className="w-full max-w-[300px] sm:w-auto sm:max-w-none [&>span:first-child]:flex-1 [&>span:first-child]:text-center sm:[&>span:first-child]:flex-none" onClick={() => navigate("/teacher/registration")}>
                      I'm an Educator
                    </PillButton>
                  </>
                )}
              </div>
              {!authLoading && !user && (
                <button
                  type="button"
                  onClick={() => navigate("/admin/login")}
                  className="mt-3 rounded-full px-4 py-2 text-sm font-semibold text-(--lp-muted) underline decoration-(--lp-line) decoration-2 underline-offset-4 transition-colors hover:text-(--lp-ink) hover:decoration-(--lp-blue)"
                >
                  Admin Login
                </button>
              )}
            </Reveal>

            <Reveal delay={290} className="w-full max-w-lg">
              <form
                className="mt-7 flex w-full items-center gap-2 rounded-full bg-white p-2 pl-5 shadow-[0_22px_60px_-14px_rgba(37,87,214,0.28)] ring-1 ring-(--lp-line) transition-shadow focus-within:shadow-[0_26px_70px_-12px_rgba(37,87,214,0.4)] focus-within:ring-2 focus-within:ring-(--lp-blue)"
                onSubmit={(event) => {
                  event.preventDefault();
                  const query = new FormData(event.currentTarget).get("query");
                  goToSeries(query);
                }}
              >
                <SearchIcon className="h-5 w-5 shrink-0 text-(--lp-muted)" />
                <input
                  name="query"
                  placeholder="Search by subject or exam"
                  className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-(--lp-ink) outline-none placeholder:text-(--lp-muted)/70 sm:text-base"
                  aria-label="Search test series"
                />
                <button
                  type="submit"
                  aria-label="Search"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-(--lp-ink) px-5 py-3.5 text-sm font-semibold text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--lp-blue)/40 sm:px-6"
                >
                  <span className="hidden sm:inline">Search</span>
                  <ArrowUpRight className="h-4 w-4" />
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
        </div>
      </section>

      {/* ─────────────────────────── TICKER STRIP ─────────────────────────── */}
      <section aria-hidden="true" className="relative py-6 sm:py-8">
        <style>{`
          @keyframes ul-strip { from { transform: translateX(0); } to { transform: translateX(-50%); } }
          @media (prefers-reduced-motion: reduce) { .ul-strip-track { animation: none !important; } }
        `}</style>
        <div className="relative overflow-hidden bg-(--lp-ink) text-white shadow-[0_18px_40px_-18px_rgba(15,17,21,0.5)]">
          {/* hairline accents */}
          <span className="absolute inset-x-0 top-0 h-px bg-white/15" />
          <span className="absolute inset-x-0 bottom-0 h-[3px] bg-(--lp-yellow)" />
          {/* soft edge fade so the words glide in and out */}
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
