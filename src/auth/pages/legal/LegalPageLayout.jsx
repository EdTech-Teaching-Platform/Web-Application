// Shared shell for the standalone Terms of Service / Privacy Policy pages
// (Screen Prompt "Standalone Legal Pages"). Deliberately plain — --color-bg
// background, --color-text body copy, --font-body throughout, no
// color-blocking, no hero, no cards, since these are reference documents,
// not marketing surfaces. A sticky in-page table of contents sits alongside
// the body on desktop and collapses to a simple top-of-page list on mobile.
// The footer never dead-ends: it goes back to wherever the user came from
// (onboarding, the login footer, or — once it exists — Account Settings).
import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";

export default function LegalPageLayout({ title, lastUpdated, sections, backLabel = "Back" }) {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-bg">
      <header className="border-b border-text/10 px-6 py-5 sm:px-10">
        <span className="font-display text-sm font-semibold tracking-tight text-primary">
          Universal Learning
        </span>
      </header>

      <div className="mx-auto max-w-5xl px-6 py-10 sm:px-10">
        <Link to="/" className="mb-5 inline-flex items-center gap-2 rounded-full border border-text/10 bg-white px-3.5 py-2 text-xs font-semibold text-text/65 shadow-sm transition-colors hover:border-primary/30 hover:text-primary">
          <span aria-hidden="true">←</span> Back to home
        </Link>
        <h1 className="font-display text-3xl tracking-tight text-text">{title}</h1>
        <p className="mt-2 text-sm text-text/50">Last updated: {lastUpdated}</p>

        <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
          {/* Desktop: sticky anchored TOC. Mobile: a plain top-of-page list
              (same <nav>, just not sticky/side-by-side below lg). */}
          <nav className="lg:sticky lg:top-10 lg:self-start">
            <span className="text-xs font-semibold uppercase tracking-wide text-text/40">
              Contents
            </span>
            <ul className="mt-3 space-y-2 text-sm">
              {sections.map((s) => (
                <li key={s.id}>
                  <a href={`#${s.id}`} className="text-text/60 hover:text-primary hover:underline">
                    {s.heading}
                  </a>
                </li>
              ))}
            </ul>
          </nav>

          {/* Hairline divider only between the TOC and body — nothing else
              on the page is bordered/boxed. */}
          <div className="border-t border-text/10 pt-8 lg:border-t-0 lg:border-l lg:pl-10 lg:pt-0">
            <div className="space-y-10 text-sm leading-relaxed text-text/80">
              {sections.map((s, i) => (
                <section key={s.id} id={s.id}>
                  <h2 className="font-display text-lg text-text">
                    {i + 1}. {s.heading}
                  </h2>
                  <div className="mt-3 space-y-3">{s.body}</div>
                </section>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-12 border-t border-text/10 pt-8">
          <Button variant="secondary" fullWidth={false} className="px-7" onClick={() => navigate(-1)}>
            {backLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
