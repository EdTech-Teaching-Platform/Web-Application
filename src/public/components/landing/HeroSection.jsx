// Landing hero, focused on test series. Centred layout: logo mark, headline,
// line, entry buttons and search, framed by two clusters of floating "app"
// cards (question, result, streak, report, difficulty). Cards are decorative
// placeholders — sample figures only. Then the ticker strip.
import { useNavigate } from "react-router-dom";
import { SearchIcon, ClockIcon, CheckCircleIcon } from "../../../components/ui/icons";
import { Reveal, PillButton, ArrowUpRight, Squiggle } from "./LandingUI";
import { imgFallback } from "../../../utils/stockImages";
import { useAuth } from "../../../hooks/useAuth";
import { homePathForUser } from "../../../utils/roles";

// Gentle float for the cards; respects reduced-motion.
const FLOAT_CSS = `
@keyframes ul-float-a { 0%,100% { transform: translateY(0) rotate(var(--r, 0deg)); } 50% { transform: translateY(-8px) rotate(var(--r, 0deg)); } }
@keyframes ul-float-b { 0%,100% { transform: translateY(0) rotate(var(--r, 0deg)); } 50% { transform: translateY(8px) rotate(var(--r, 0deg)); } }
.ul-float-a { transform: rotate(var(--r, 0deg)); animation: ul-float-a 7s ease-in-out infinite; }
.ul-float-b { transform: rotate(var(--r, 0deg)); animation: ul-float-b 8s ease-in-out infinite; }
@media (prefers-reduced-motion: reduce) { .ul-float-a, .ul-float-b { animation: none; } }
`;

function Sparkle({ className = "", style }) {
  return (
    <svg viewBox="0 0 24 24" className={className} style={style} aria-hidden="true">
      <path d="M12 0c.9 6.4 5.6 11.1 12 12-6.4.9-11.1 5.6-12 12-.9-6.4-5.6-11.1-12-12C6.4 11.1 11.1 6.4 12 0Z" fill="currentColor" />
    </svg>
  );
}

const photo = (id, w, h) => `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&w=${w}&h=${h}&q=70`;
// Same hand-picked photos the app already uses elsewhere; imgFallback covers a failed load.
const PHOTO_REPORT = photo("1571260899304-425eee4c7efc", 640, 480);
const PHOTO_THUMB = photo("1522202176988-66273c2fd55f", 200, 200);

const STRIP_ITEMS = [
  "Timed tests", "Instant scoring", "Detailed reports", "Attempt history",
  "Mock exams", "Retake attempts", "Practice tests", "Pass marks",
];

const CARD = "rounded-2xl bg-white shadow-[0_26px_50px_-20px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line)";
const BAR = "h-2 rounded-full bg-(--lp-grey)";

function Dots({ className = "", color = "var(--lp-blue)" }) {
  return (
    <span
      className={`pointer-events-none absolute ${className}`}
      aria-hidden="true"
      style={{
        backgroundImage: `radial-gradient(${color} 2.2px, transparent 2.6px)`,
        backgroundSize: "15px 15px",
        WebkitMaskImage: "radial-gradient(circle at center, #000 30%, transparent 75%)",
        maskImage: "radial-gradient(circle at center, #000 30%, transparent 75%)",
      }}
    />
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

// Left cluster: a question card, a series card and a tilted progress card.
function LeftCards() {
  return (
    <div className="pointer-events-none absolute -left-8 top-1/2 hidden h-[480px] w-[360px] -translate-y-1/2 xl:block 2xl:left-4" aria-hidden="true">
      <style>{FLOAT_CSS}</style>
      <Dots className="-left-6 top-2 h-32 w-32" />
      <Dots className="left-6 top-[400px] h-28 w-28" color="var(--lp-yellow)" />
      <Squiggle className="absolute left-[238px] top-2 h-9 w-14 -rotate-12 text-(--lp-blue)" />

      {/* question card */}
      <div className={`ul-float-a absolute left-10 top-6 w-[250px] p-4 ${CARD}`} style={{ "--r": "-3deg" }}>
        <p className="text-[9px] font-bold uppercase tracking-wider text-(--lp-muted)">Mathematics · Question 12</p>
        <p className="mt-1.5 text-[11px] font-semibold leading-snug text-(--lp-ink)">What is the net force on a 2 kg mass accelerating at 3 m/s²?</p>
        <ul className="mt-3 space-y-1.5">
          <li className="flex items-center gap-2 rounded-lg bg-(--lp-grey) px-2 py-1.5"><span className="text-[9px] font-bold text-(--lp-muted)">A</span><span className={`${BAR} w-16 bg-white`} /></li>
          <li className="flex items-center gap-2 rounded-lg bg-(--lp-blue-soft) px-2 py-1.5 ring-1 ring-(--lp-blue)"><span className="text-[9px] font-bold text-(--lp-blue-deep)">B</span><span className="text-[10px] font-semibold text-(--lp-blue-deep)">6 N</span></li>
          <li className="flex items-center gap-2 rounded-lg bg-(--lp-grey) px-2 py-1.5"><span className="text-[9px] font-bold text-(--lp-muted)">C</span><span className={`${BAR} w-12 bg-white`} /></li>
        </ul>
        <span className="mt-3 block rounded-lg bg-(--lp-ink) py-1.5 text-center text-[10px] font-semibold text-white">Next question</span>
      </div>

      {/* series card */}
      <div className={`ul-float-b absolute left-16 top-[236px] z-10 flex w-[272px] items-center gap-3 p-3 ${CARD}`} style={{ "--r": "2deg" }}>
        <img src={PHOTO_THUMB} alt="" onError={(e) => imgFallback(e, "hero-thumb", 200, 200)} className="h-16 w-16 shrink-0 rounded-xl object-cover" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-bold text-(--lp-ink)">Physics Mock Series</p>
          <p className="mt-0.5 text-[10px] text-(--lp-muted)">40 questions · 1h</p>
          <span className={`${BAR} mt-2 block w-full`}><span className="block h-full w-[62%] rounded-full bg-(--lp-blue)" /></span>
        </div>
      </div>

      {/* tilted progress card */}
      <div className="ul-float-a absolute left-2 top-[372px] w-[250px] rounded-2xl bg-(--lp-blue-deep) p-4 text-white shadow-[0_26px_50px_-18px_rgba(37,87,214,0.7)]" style={{ "--r": "-5deg" }}>
        <p className="text-[11px] font-bold">Question 12 of 40</p>
        <span className="mt-2.5 block h-2 rounded-full bg-white/25"><span className="block h-full w-[30%] rounded-full bg-(--lp-yellow)" /></span>
        <span className="mt-2 block h-2 w-3/4 rounded-full bg-white/25" />
      </div>
    </div>
  );
}

// Right cluster: score card, stacked report cards and difficulty chips.
function RightCards() {
  return (
    <div className="pointer-events-none absolute -right-10 top-1/2 hidden h-[480px] w-[380px] -translate-y-1/2 xl:block 2xl:right-2" aria-hidden="true">
      <Dots className="-right-4 top-[300px] h-36 w-36" />
      <Sparkle className="absolute left-[8px] top-[150px] h-6 w-6 text-(--lp-blue)" />

      {/* score card */}
      <div className={`ul-float-b absolute right-20 top-2 w-[210px] overflow-hidden ${CARD}`} style={{ "--r": "2deg" }}>
        <span className="block h-1.5 bg-(--lp-yellow)" />
        <div className="flex items-center gap-3 p-3.5">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-(--lp-yellow-soft) text-(--lp-ink)"><CheckCircleIcon className="h-6 w-6" /></span>
          <div>
            <p className="font-(family-name:--lp-font) text-3xl font-bold leading-none text-(--lp-ink)">92%</p>
            <p className="mt-1 text-[10px] font-medium text-(--lp-muted)">Best score</p>
          </div>
        </div>
      </div>

      {/* stacked report cards */}
      <div className="absolute right-0 top-[112px] w-[316px]">
        <div className={`absolute inset-x-0 top-0 h-full translate-x-3 translate-y-3 ${CARD}`} />
        <div className={`absolute inset-x-0 top-0 h-full translate-x-1.5 translate-y-1.5 ${CARD}`} />
        <div className={`ul-float-a relative p-3 ${CARD}`} style={{ "--r": "0deg" }}>
          <div className="relative overflow-hidden rounded-xl bg-(--lp-blue-tint)">
            <img src={PHOTO_REPORT} alt="" onError={(e) => imgFallback(e, "hero-report", 640, 480)} className="h-[150px] w-full object-cover" />
            <span className="absolute left-2.5 top-2.5 inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-[10px] font-bold text-(--lp-ink)">
              <ClockIcon className="h-3 w-3 text-(--lp-blue)" /> 42:10
            </span>
          </div>
          <p className="mt-2.5 text-center text-[11px] font-bold text-(--lp-ink)">Mock Test 3 · Report</p>
          <span className={`${BAR} mx-auto mt-2 block w-3/4`} />
          <span className={`${BAR} mx-auto mt-1.5 block w-1/2`} />
        </div>
      </div>

      {/* difficulty chips */}
      <div className={`ul-float-b absolute bottom-2 right-8 flex items-center gap-2 p-2 ${CARD}`} style={{ "--r": "-5deg" }}>
        <span className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-[#1f9d6b] ring-1 ring-[#1f9d6b]/50">Easy</span>
        <span className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-(--lp-ink) ring-1 ring-(--lp-yellow)">Medium</span>
        <span className="rounded-lg bg-white px-3 py-1.5 text-[11px] font-bold text-[#d64545] ring-1 ring-[#d64545]/50">Hard</span>
      </div>
    </div>
  );
}

export default function HeroSection() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  return (
    // Fill the first screen: viewport height minus the navbar, hero centred in
    // the space above the ticker strip. Natural height on short/mobile screens.
    <div className="flex flex-col xl:min-h-[calc(100svh-4.5rem)]">
      {/* ───────────────────────────── HERO ───────────────────────────── */}
      <section className="relative isolate flex flex-1 items-start overflow-hidden px-5 pb-10 pt-8 sm:px-8 md:pb-14 md:pt-10 xl:items-center xl:pt-8">
        {/* soft washes + faint dotted grid, static */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute -left-40 top-[10%] h-[460px] w-[460px] rounded-full bg-(--lp-blue-soft) opacity-70 blur-3xl" />
          <div className="absolute -right-40 top-[18%] h-[420px] w-[420px] rounded-full bg-(--lp-yellow) opacity-25 blur-3xl" />
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
              <div className="mt-8 flex min-h-[56px] flex-wrap items-center justify-center gap-x-4 gap-y-3">
                {authLoading ? null : user ? (
                  <PillButton tone="ink" onClick={() => navigate(homePathForUser(user))}>
                    Go to Dashboard
                  </PillButton>
                ) : (
                  <>
                    <PillButton tone="ink" onClick={() => navigate("/register")}>
                      I'm a Student
                    </PillButton>
                    <PillButton tone="outline" onClick={() => navigate("/teacher/registration")}>
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
                  navigate(`/test-series${query ? `?q=${encodeURIComponent(query)}` : ""}`);
                }}
              >
                <SearchIcon className="h-5 w-5 shrink-0 text-(--lp-muted)" />
                <input
                  name="query"
                  placeholder="Search test series by title, subject or exam"
                  className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-(--lp-ink) outline-none placeholder:text-(--lp-muted)/70 sm:text-base"
                  aria-label="Search test series"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-(--lp-ink) px-6 py-3.5 text-sm font-semibold text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--lp-blue)/40"
                >
                  Search
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </form>
              <div className="mt-4 flex flex-wrap items-center justify-center gap-2.5 text-sm">
                <span className="text-(--lp-muted)">Popular:</span>
                {["School exams", "Mathematics", "Science"].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => navigate(`/test-series?q=${encodeURIComponent(category)}`)}
                    className="rounded-full bg-(--lp-blue-soft) px-3.5 py-1.5 text-xs font-semibold text-(--lp-blue-deep) transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:bg-(--lp-blue) hover:text-white"
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
