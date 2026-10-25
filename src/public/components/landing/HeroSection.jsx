// Landing hero (restored previous layout): headline + search + entry buttons
// on the left, the live-class product window on the right, then the two
// tilted ticker bands. Product window content is illustrative placeholder data.
import { useNavigate } from "react-router-dom";
import { heroPhoto, imgFallback } from "../../../utils/stockImages";
import { SearchIcon, UsersIcon, PlayIcon, ChatIcon, CheckCircleIcon, LockIcon } from "../../../components/ui/icons";
import { Reveal, PillButton, ArrowUpRight, Squiggle, Tape } from "./LandingUI";

const SHELL = "mx-auto w-full max-w-[1200px] px-5 sm:px-8";

export default function HeroSection() {
  const navigate = useNavigate();
  return (
    // Fill the first screen: viewport height minus the navbar, hero centred in
    // the space above the ticker bands. Natural height on short/mobile screens.
    <div className="flex min-h-[calc(100svh-4.5rem)] flex-col">
      {/* ───────────────────────────── HERO ───────────────────────────── */}
      <section className="relative isolate flex flex-1 items-center overflow-hidden pb-8 pt-4 md:pb-10 md:pt-6">
        {/* soft blue wash + dotted grid, static */}
        <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
          <div className="absolute -right-40 -top-40 h-[620px] w-[620px] rounded-full bg-(--lp-blue-soft) opacity-70 blur-3xl" />
          <div className="absolute -left-32 top-[6%] h-[440px] w-[440px] rounded-full bg-(--lp-yellow) opacity-30 blur-3xl" />
          <div
            className="absolute inset-0 opacity-[0.55]"
            style={{
              backgroundImage: "radial-gradient(rgba(15,17,21,0.09) 1px, transparent 1.2px)",
              backgroundSize: "26px 26px",
              maskImage: "radial-gradient(ellipse at 30% 30%, black 0%, transparent 65%)",
              WebkitMaskImage: "radial-gradient(ellipse at 30% 30%, black 0%, transparent 65%)",
            }}
          />
        </div>

        <div className={`${SHELL} grid items-center gap-14 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10`}>
          <div className="flex min-w-0 flex-col items-start">
            <Reveal delay={80}>
              <h1 className="font-(family-name:--lp-font) text-[2.4rem] font-bold leading-[1.04] tracking-[-0.03em] sm:text-6xl lg:text-[4rem]">
                Build skills that{" "}
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

            <Reveal delay={160}>
              <p className="mt-7 max-w-xl text-base leading-relaxed text-(--lp-muted) md:text-lg">
                Learn from experienced educators through structured courses, live classes, practice, and projects designed for real progress.
              </p>
            </Reveal>

            <Reveal delay={220} className="w-full max-w-xl">
              <form
                className="mt-8 flex w-full items-center gap-2 rounded-full bg-white p-2 pl-5 shadow-[0_18px_50px_rgba(15,17,21,0.10)] ring-1 ring-(--lp-line) transition-shadow focus-within:ring-2 focus-within:ring-(--lp-blue)"
                onSubmit={(event) => {
                  event.preventDefault();
                  const query = new FormData(event.currentTarget).get("query");
                  // #browse scrolls straight to ExplorePage's filtered results
                  // (same fix as the category chips below), so a search
                  // actually looks like it did something instead of landing
                  // above the fold with the match buried off-screen.
                  navigate(`/explore${query ? `?q=${encodeURIComponent(query)}#browse` : ""}`);
                }}
              >
                <SearchIcon className="h-5 w-5 shrink-0 text-(--lp-muted)" />
                <input
                  name="query"
                  placeholder="What do you want to learn?"
                  className="min-w-0 flex-1 bg-transparent px-1 py-3 text-sm text-(--lp-ink) outline-none placeholder:text-(--lp-muted)/70 sm:text-base"
                  aria-label="Search courses"
                />
                <button
                  type="submit"
                  className="inline-flex shrink-0 items-center gap-2 rounded-full bg-(--lp-ink) px-6 py-3.5 text-sm font-semibold text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-(--lp-blue)/40"
                >
                  Search
                  <ArrowUpRight className="h-4 w-4" />
                </button>
              </form>
            </Reveal>

            <Reveal delay={260}>
              <div className="mt-5 flex flex-wrap items-center gap-2.5 text-sm">
                <span className="text-(--lp-muted)">Popular:</span>
                {["Programming", "Design", "Languages"].map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => navigate(`/explore?category=${encodeURIComponent(category)}#browse`)}
                    className="rounded-full bg-(--lp-blue-soft) px-3.5 py-1.5 text-xs font-semibold text-(--lp-blue-deep) transition-transform duration-200 ease-out hover:-translate-y-0.5 hover:bg-(--lp-blue) hover:text-white"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </Reveal>

            <Reveal delay={320}>
              <div className="mt-9 flex flex-wrap items-center gap-x-4 gap-y-3">
                <PillButton tone="ink" onClick={() => navigate("/register")}>
                  I'm a Student
                </PillButton>
                <PillButton tone="outline" onClick={() => navigate("/teacher/registration")}>
                  I'm an Educator
                </PillButton>
                <button
                  type="button"
                  onClick={() => navigate("/admin/login")}
                  className="rounded-full px-4 py-3 text-sm font-semibold text-(--lp-muted) underline decoration-(--lp-line) decoration-2 underline-offset-4 transition-colors hover:text-(--lp-ink) hover:decoration-(--lp-blue)"
                >
                  Admin Login
                </button>
              </div>
            </Reveal>
          </div>

          {/* Hero visual: a "live class" app window — real photo as the video
              feed, lesson rail and doubts panel. Illustrative preview, placeholder
              data. */}
          <Reveal delay={140} className="relative mx-auto w-full max-w-[600px] lg:max-w-none">
            {/* soft backing plate gives the window depth */}
            <div className="absolute -inset-x-4 -bottom-5 -top-5 -z-10 rounded-[36px] bg-(--lp-blue-soft)" aria-hidden="true" />
            <div className="absolute -bottom-8 left-8 -z-10 h-24 w-40 rounded-full bg-(--lp-yellow) blur-2xl" aria-hidden="true" />

            <div className="overflow-hidden rounded-[22px] bg-white shadow-[0_44px_80px_-30px_rgba(15,17,21,0.45)] ring-1 ring-(--lp-ink)/10">
              {/* window chrome */}
              <div className="flex items-center gap-3 border-b border-(--lp-line) bg-(--lp-grey)/80 px-4 py-2.5">
                <span className="flex gap-1.5" aria-hidden="true">
                  <i className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                  <i className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                  <i className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                </span>
                <span className="mx-auto flex min-w-0 max-w-[260px] flex-1 items-center justify-center gap-1.5 truncate rounded-md bg-white px-3 py-1 text-[11px] font-medium text-(--lp-muted) ring-1 ring-(--lp-line)">
                  <LockIcon className="h-3 w-3 shrink-0" />
                  <span className="truncate">universallearning.app/live</span>
                </span>
                <span className="w-10 shrink-0" aria-hidden="true" />
              </div>

              <div className="grid sm:grid-cols-[1fr_200px]">
                {/* video */}
                <div className="relative aspect-[4/3] bg-(--lp-ink) sm:aspect-auto sm:min-h-[360px]">
                  <img
                    src={heroPhoto({ w: 900, h: 700 })}
                    onError={(e) => imgFallback(e, "landing-hero", 900, 700)}
                    alt="Students attending a live class"
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-(--lp-ink)/80 via-transparent to-(--lp-ink)/25" aria-hidden="true" />
                  <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-red-600 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-white">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" /> Live
                  </span>
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-md bg-(--lp-ink)/60 px-2 py-1 text-[11px] font-medium text-white backdrop-blur">
                    <UsersIcon className="h-3.5 w-3.5" /> 128 watching
                  </span>
                  <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                    <p className="text-sm font-semibold leading-tight">Laws of Motion — Class 11 Physics</p>
                    <p className="mt-0.5 text-xs text-white/70">with Dr. R. Menon</p>
                    <div className="mt-3 flex items-center gap-3">
                      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-white text-(--lp-ink)" aria-hidden="true">
                        <PlayIcon className="h-3.5 w-3.5" />
                      </span>
                      <span className="h-1 flex-1 overflow-hidden rounded-full bg-white/25" aria-hidden="true">
                        <span className="block h-full w-[58%] rounded-full bg-(--lp-yellow)" />
                      </span>
                      <span className="text-[11px] tabular-nums text-white/80">42:10</span>
                    </div>
                  </div>
                </div>

                {/* lesson rail + doubts */}
                <div className="hidden flex-col border-l border-(--lp-line) bg-white sm:flex">
                  <p className="border-b border-(--lp-line) px-3.5 py-3 text-[11px] font-semibold uppercase tracking-wider text-(--lp-muted)">Lessons</p>
                  <ul className="space-y-1 p-2 text-xs">
                    {[["Newton's first law", "done"], ["Inertia in daily life", "done"], ["Newton's second law", "now"], ["Free-body diagrams", ""]].map(([t, s]) => (
                      <li key={t} className={`flex items-center gap-2 rounded-lg px-2 py-2 ${s === "now" ? "bg-(--lp-blue-soft) font-semibold text-(--lp-blue-deep)" : "text-(--lp-ink)/75"}`}>
                        {s === "done" ? <CheckCircleIcon className="h-4 w-4 shrink-0 text-(--lp-blue)" /> : <span className={`h-4 w-4 shrink-0 rounded-full border ${s === "now" ? "border-(--lp-blue-deep)" : "border-(--lp-line)"}`} />}
                        <span className="leading-tight">{t}</span>
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto border-t border-(--lp-line) p-3">
                    <p className="flex items-center gap-1.5 text-[11px] font-semibold text-(--lp-muted)"><ChatIcon className="h-3.5 w-3.5" /> Doubts</p>
                    <p className="mt-1.5 rounded-lg bg-(--lp-grey) px-2.5 py-2 text-[11px] leading-snug text-(--lp-ink)/80">Why does acceleration double when force doubles?</p>
                  </div>
                </div>
              </div>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ─────────────────────────── TAPE BANDS ─────────────────────────── */}
      <section aria-hidden="true" className="relative h-36 overflow-hidden sm:h-40">
        <Tape
          className="absolute inset-x-[-6%] top-5 -rotate-2 bg-(--lp-yellow) text-(--lp-ink) shadow-[0_8px_24px_rgba(15,17,21,0.10)]"
          items={["Programming", "Design", "Languages", "Math", "Science", "Music", "Business"]}
          duration={50}
        />
        <Tape
          reverse
          className="absolute inset-x-[-6%] top-14 rotate-[1.5deg] bg-(--lp-ink) text-white sm:top-16"
          items={["Live classes", "Test series", "1-on-1 mentors", "Certificates", "Practice", "Projects"]}
          duration={55}
        />
      </section>
    </div>
  );
}
