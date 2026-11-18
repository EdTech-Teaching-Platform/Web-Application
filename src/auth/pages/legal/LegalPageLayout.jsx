// Shared shell for the standalone Terms of Service / Privacy Policy pages
// (Screen Prompt "Standalone Legal Pages"). Redesigned to the blue / ink /
// yellow theme (see auth/components/AuthKit): a bold hero band, a sticky
// pill-style table of contents beside the body on desktop (a simple list on
// mobile), and a readable white document sheet. Content, anchors and
// navigation are unchanged. The footer never dead-ends: it goes back to
// wherever the user came from (onboarding, login footer, account settings).
import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { AUTH_THEME_VARS, BrandMark } from "../../components/AuthKit";
import { Sparkle, Squiggle } from "../../../public/components/landing/LandingUI";

export default function LegalPageLayout({ title, lastUpdated, sections, backLabel = "Back" }) {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));

  return (
    <div style={AUTH_THEME_VARS} className="min-h-screen bg-white font-body text-text">
      <div className="p-3 sm:p-4">
        <div className="relative isolate overflow-hidden rounded-[36px] bg-(--lp-blue) px-6 pb-14 pt-6 text-white sm:rounded-[44px] sm:px-10 sm:pb-20">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute -right-24 -top-28 h-80 w-80 rounded-full bg-(--lp-yellow)" />
            <div className="absolute -right-8 -top-12 h-52 w-52 rounded-full border border-white/25" />
            <div className="absolute -bottom-32 -left-20 h-72 w-72 rounded-full border-[28px] border-white/10" />
            <Sparkle className="absolute right-[34%] top-16 hidden h-7 w-7 text-white/80 sm:block" />
          </div>

          <header className="mx-auto flex max-w-5xl items-center justify-between gap-3">
            <button type="button" onClick={goBack} className="inline-flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-white">
              <BrandMark className="h-9 w-9" />
              Universal Learning
            </button>
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-semibold text-(--lp-ink) transition-transform duration-200 ease-out hover:-translate-y-0.5"
            >
              <span aria-hidden="true">←</span> Back
            </button>
          </header>

          <div className="mx-auto mt-12 max-w-5xl sm:mt-16">
            <span className="inline-flex rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold">Legal</span>
            <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
              <span className="relative inline-block">
                <span className="absolute -inset-x-1.5 bottom-[0.04em] top-[0.14em] -rotate-1 rounded-xl bg-(--lp-yellow)" aria-hidden="true" />
                <span className="relative text-(--lp-ink)">{title}</span>
              </span>
            </h1>
            <Squiggle className="mt-3 h-5 w-24 text-white/70" />
            <p className="mt-4 text-sm text-white/80">Last updated: {lastUpdated}</p>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-16 pt-8 sm:px-10">
        <div className="grid gap-8 lg:grid-cols-[240px_1fr]">
          {/* Desktop: sticky anchored TOC. Mobile: a plain top-of-page list
              (same <nav>, just not sticky/side-by-side below lg). */}
          <nav className="rounded-3xl bg-(--lp-grey) p-5 lg:sticky lg:top-6 lg:self-start">
            <span className="inline-flex rounded-full bg-(--lp-yellow) px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-(--lp-ink)">
              Contents
            </span>
            <ul className="mt-3 space-y-1 text-sm">
              {sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="flex items-center gap-2.5 rounded-full px-2 py-1.5 font-medium text-(--lp-muted) transition-colors duration-150 hover:bg-white hover:text-(--lp-ink)"
                  >
                    <span className="grid h-6 w-6 shrink-0 place-items-center rounded-full bg-white text-[11px] font-bold text-(--lp-blue-deep)">{i + 1}</span>
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          <div className="space-y-5 text-sm leading-relaxed text-(--lp-muted)">
            {sections.map((s, i) => (
              <section key={s.id} id={s.id} className="scroll-mt-6 rounded-3xl bg-white p-6 ring-1 ring-(--lp-line) sm:p-8">
                <h2 className="flex items-center gap-3 font-display text-xl font-bold tracking-tight text-(--lp-ink)">
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-(--lp-ink) text-xs text-white">{i + 1}</span>
                  {s.heading}
                </h2>
                <div className="mt-3 space-y-3 text-text/80">{s.body}</div>
              </section>
            ))}
          </div>
        </div>

        <div className="mt-10 flex flex-wrap items-center justify-between gap-4 rounded-3xl bg-(--lp-ink) px-6 py-5 text-white">
          <p className="text-sm text-white/70">Questions about this page? Reach us at <a className="font-semibold text-(--lp-yellow) hover:underline" href="mailto:support@universallearning.app">support@universallearning.app</a></p>
          <div className="flex items-center gap-3">
            <Link to="/" className="text-sm font-semibold text-white/80 hover:text-white">Home</Link>
            <Button variant="secondary" fullWidth={false} className="border-white/0 bg-(--lp-yellow) px-7 text-(--lp-ink) hover:bg-(--lp-yellow)/90" onClick={() => navigate(-1)}>
              {backLabel}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
