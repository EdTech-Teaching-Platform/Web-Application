// Shared building blocks for the redesigned auth screens (Login, Sign Up,
// Verify, Forgot/Reset password, Admin sign-in) — same electric blue / ink /
// sunshine yellow theme as the public landing page.
//
// Theming approach: rather than forking Input/Button/Checkbox, every auth
// screen is wrapped in a container that re-points the design tokens
// (--color-primary, --color-bg, --color-text, --font-display…) to the new
// palette. Tailwind v4 utilities such as `bg-primary`, `text-primary` and
// `font-display` read those variables, so the existing shared components
// pick up the new look automatically — without any change to how they
// behave and without touching the other portals.
import { Link } from "react-router-dom";
import { LANDING_THEME_VARS } from "../../public/landingTheme";
import { Sparkle, Squiggle, ArrowUpRight } from "../../public/components/landing/LandingUI";
import AuthScene from "./AuthScenes";
import { CheckCircleIcon, StarIcon } from "../../components/ui/icons";

export const AUTH_THEME_VARS = {
  ...LANDING_THEME_VARS,
  "--lp-danger": "#e5484d",
  "--color-primary": "#2557d6",
  "--color-bg": "#f5f6f8",
  "--color-text": "#0f1115",
  "--color-danger": "#e5484d",
  "--color-success": "#1f9d6b",
  "--font-display": "var(--lp-font)",
};

// -------------------------------------------------------------- BrandMark
export function BrandMark({ className = "h-10 w-10", style }) {
  return (
    <span style={style} className={`grid shrink-0 place-items-center rounded-full bg-(--lp-ink) text-white ${className}`} aria-hidden="true">
      <span className="grid h-[62%] w-[62%] place-items-center rounded-full bg-(--lp-blue)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-[58%] w-[58%]">
          <path d="M3 8l9-4 9 4-9 4-9-4Z" />
          <path d="M7 10.5V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
        </svg>
      </span>
    </span>
  );
}

function Highlight({ children, bg, text }) {
  return (
    <span className="relative inline-block">
      <span className={`absolute -inset-x-1.5 bottom-[0.04em] top-[0.14em] -rotate-1 rounded-xl ${bg}`} aria-hidden="true" />
      <span className={`relative ${text}`}>{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------- Showcase
// Left "story" panel configs. Each role gets its own accent so the screens
// feel related but distinct: student = blue, educator = yellow, sign-up =
// ink.
const SHOWCASE = {
  student: {
    line: "rgba(255,255,255,0.14)",
    panel: "bg-(--lp-blue) text-white",
    sun: "bg-(--lp-yellow)",
    blob: "bg-(--lp-blue-deep)/60",
    ring: "border-white/15",
    chip: "bg-white/15 text-white",
    sub: "text-white/80",
    headline: (
      <>
        Learn anything.
        <br />
        From <Highlight bg="bg-(--lp-yellow)" text="text-(--lp-ink)">anyone.</Highlight>
      </>
    ),
    copy: "Courses, live classes and mentors — all in one place, right where you left off.",
    chipLabel: "Student sign in",
    quote: { id: "t1", text: "The live classes completely changed how I study for exams.", name: "Ananya", role: "Grade 11 student" },
  },
  educator: {
    line: "rgba(15,17,21,0.1)",
    panel: "bg-(--lp-yellow) text-(--lp-ink)",
    sun: "bg-(--lp-blue)",
    blob: "bg-white/45",
    ring: "border-(--lp-ink)/10",
    chip: "bg-(--lp-ink) text-white",
    sub: "text-(--lp-ink)/75",
    headline: (
      <>
        Teach what you know.
        <br />
        <Highlight bg="bg-(--lp-blue)" text="text-white">Reach every learner.</Highlight>
      </>
    ),
    copy: "Manage courses, live classes and earnings from one dashboard.",
    chipLabel: "Educator sign in",
    perks: ["Teach your way", "Reach more students", "Request payouts anytime"],
  },
  signup: {
    line: "rgba(255,255,255,0.1)",
    panel: "bg-(--lp-ink) text-white",
    sun: "bg-(--lp-blue)",
    blob: "bg-(--lp-blue)/35",
    ring: "border-white/10",
    chip: "bg-white/10 text-white",
    sub: "text-white/70",
    headline: (
      <>
        Start learning
        <br />
        <Highlight bg="bg-(--lp-yellow)" text="text-(--lp-ink)">today.</Highlight>
      </>
    ),
    copy: "Join Universal Learning and build skills with experienced educators.",
    chipLabel: "Create account",
    quote: { id: "t2", text: "Found an educator who actually explains things clearly.", name: "Karan", role: "Parent" },
  },
};

function Showcase({ variant }) {
  const cfg = SHOWCASE[variant] ?? SHOWCASE.student;
  return (
    <aside className={`relative isolate hidden overflow-hidden rounded-[40px] p-9 lg:sticky lg:top-4 lg:flex lg:h-[calc(100vh-2rem)] lg:flex-col xl:p-12 ${cfg.panel}`}>
      {/* decoration */}
      <div
        className="pointer-events-none absolute inset-0 -z-10 opacity-60"
        aria-hidden="true"
        style={{
          backgroundImage: `linear-gradient(${cfg.line} 1px, transparent 1px), linear-gradient(90deg, ${cfg.line} 1px, transparent 1px)`,
          backgroundSize: "44px 44px",
          maskImage: "linear-gradient(180deg, #000 0%, transparent 85%)",
          WebkitMaskImage: "linear-gradient(180deg, #000 0%, transparent 85%)",
        }}
      />
      <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
        <div className={`absolute -right-28 -top-28 h-80 w-80 rounded-full ${cfg.blob}`} />
        <div className={`absolute -right-12 -top-12 h-52 w-52 rounded-full border ${cfg.ring}`} />
        <div className={`absolute -bottom-32 -left-24 h-72 w-72 rounded-full border-[28px] ${cfg.ring}`} />
      </div>

      <div className="flex items-center justify-between gap-3">
        <Link to="/" className="inline-flex items-center gap-2.5 font-(family-name:--lp-font) text-lg font-bold tracking-tight">
          <BrandMark className="h-10 w-10 ring-2 ring-white/30" />
          Universal Learning
        </Link>
        <span className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ${cfg.chip}`}>{cfg.chipLabel}</span>
      </div>

      <div className="mt-10">
        <h2 className="font-(family-name:--lp-font) text-4xl font-bold leading-[1.06] tracking-tight xl:text-[2.9rem]">{cfg.headline}</h2>
        <p className={`mt-4 max-w-sm text-base leading-relaxed ${cfg.sub}`}>{cfg.copy}</p>
      </div>

      {/* product-style card composition */}
      <div className="relative mt-6 min-h-[300px] flex-1">
        <AuthScene variant={variant} />
      </div>

      {/* bottom: quote or perks */}
      {cfg.quote && (
        <figure className="mt-6 flex items-start gap-3 rounded-3xl bg-black/35 p-4 text-white ring-1 ring-white/20 backdrop-blur-md">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-(--lp-yellow) font-(family-name:--lp-font) text-base font-bold text-(--lp-ink) ring-2 ring-white/40" aria-hidden="true">{cfg.quote.name[0]}</span>
          <div>
            <div className="flex items-center gap-0.5 text-(--lp-yellow)">
              {Array.from({ length: 5 }, (_, i) => <StarIcon key={i} className="h-3.5 w-3.5 fill-current" />)}
            </div>
            <blockquote className="mt-1 text-sm leading-snug">“{cfg.quote.text}”</blockquote>
            <figcaption className="mt-1 text-xs opacity-70">{cfg.quote.name} · {cfg.quote.role}</figcaption>
          </div>
        </figure>
      )}
      {cfg.perks && (
        <div className="mt-6 flex flex-wrap gap-2">
          {cfg.perks.map((perk) => (
            <span key={perk} className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-3.5 py-2 text-xs font-semibold text-white">
              <CheckCircleIcon className="h-3.5 w-3.5 text-(--lp-yellow)" />
              {perk}
            </span>
          ))}
        </div>
      )}
    </aside>
  );
}

// -------------------------------------------------------- AuthSplitLayout
// Full-page two-panel layout for Login / Sign Up: story panel on the left
// (lg+), form on the right. Children are the form-panel contents.
export function AuthSplitLayout({ variant = "student", children }) {
  return (
    <div style={AUTH_THEME_VARS} className="min-h-screen bg-white font-body text-text lg:grid lg:grid-cols-[1.05fr_1fr] lg:gap-4 lg:p-4">
      <Showcase variant={variant} />
      <div className="flex min-h-screen flex-col px-6 py-6 sm:px-12 lg:min-h-0 lg:px-10 xl:px-16">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="inline-flex items-center gap-2.5 font-(family-name:--lp-font) text-base font-bold tracking-tight text-(--lp-ink) lg:invisible">
            <BrandMark className="h-9 w-9" />
            <span className="hidden sm:inline">Universal Learning</span>
          </Link>
          <Link
            to="/"
            className="inline-flex items-center gap-2 rounded-full bg-(--lp-grey) px-4 py-2.5 text-xs font-semibold text-(--lp-ink) transition-transform duration-200 ease-out hover:-translate-y-0.5"
          >
            <span aria-hidden="true">←</span> Back to home
          </Link>
        </div>
        <div className="flex flex-1 items-center py-8">
          <div className="mx-auto w-full max-w-md">{children}</div>
        </div>
      </div>
    </div>
  );
}

// -------------------------------------------------------------- AuthFrame
// Centered-card page frame (Verify / Forgot / Reset / confirmations): soft
// yellow + blue shapes on white.
export function AuthShapes() {
  return (
    <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
      <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-(--lp-yellow)" />
      <div className="absolute -left-10 -top-10 h-56 w-56 rounded-full border border-(--lp-ink)/10" />
      <div className="absolute -bottom-40 -right-32 h-[26rem] w-[26rem] rounded-full bg-(--lp-blue)" />
      <div className="absolute -bottom-16 -right-12 h-52 w-52 rounded-full border border-white/30" />
      <div
        className="absolute inset-0 opacity-60"
        style={{ backgroundImage: "radial-gradient(rgba(15,17,21,0.08) 1px, transparent 1.2px)", backgroundSize: "26px 26px" }}
      />
      <Sparkle className="absolute right-[18%] top-[16%] hidden h-8 w-8 text-(--lp-yellow) sm:block" />
      <Squiggle className="absolute bottom-[14%] left-[14%] hidden h-8 w-20 text-(--lp-blue) sm:block" />
    </div>
  );
}

// `top` aligns content to the top instead of centring — for long wizards.
export function AuthFrame({ children, top = false }) {
  return (
    <div style={AUTH_THEME_VARS} className={`relative isolate flex min-h-screen justify-center overflow-hidden bg-white px-4 py-10 font-body text-text ${top ? "items-start" : "items-center"}`}>
      <AuthShapes />
      <div className="relative z-10 flex w-full justify-center">{children}</div>
    </div>
  );
}

export { ArrowUpRight };
