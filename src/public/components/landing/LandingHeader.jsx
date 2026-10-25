// Landing-page header (floating glass pill). Scoped to "/" — every other
// public page keeps the original header in PublicLayout.
//
// Behaviour:
//   • on scroll the pill tightens (shorter, narrower, firmer shadow)
//   • a thin blue reading-progress line runs along its bottom edge
//   • the nav is a segmented control: the section currently in view gets the
//     raised white "chip" (hash links only — scroll-spy via IntersectionObserver)
//   • mobile menu is an animated sheet with Log in / Sign Up inside
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { MenuIcon, XIcon } from "../../../components/ui/icons";
import { ArrowUpRight } from "./LandingUI";

function LogoMark() {
  return (
    <span className="grid h-10 w-10 place-items-center rounded-full bg-(--lp-ink) text-white transition-transform duration-300 ease-out group-hover:-rotate-12">
      <span className="grid h-6 w-6 place-items-center rounded-full bg-(--lp-blue)">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" className="h-3.5 w-3.5" aria-hidden="true">
          <path d="M3 8l9-4 9 4-9 4-9-4Z" />
          <path d="M7 10.5V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
        </svg>
      </span>
    </span>
  );
}

function NavItem({ link, communityHref, active, className, onClick }) {
  if (link.label === "Community") {
    return <Link to={communityHref} onClick={onClick} className={className}>{link.label}</Link>;
  }
  if (link.href.startsWith("/")) {
    return <Link to={link.href} onClick={onClick} className={className}>{link.label}</Link>;
  }
  return (
    <a href={link.href} onClick={onClick} aria-current={active ? "location" : undefined} className={className}>
      {link.label}
    </a>
  );
}

export default function LandingHeader({ links, communityHref }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeHref, setActiveHref] = useState(null);
  const frame = useRef(0);

  // scroll state + reading progress (rAF-throttled, passive)
  useEffect(() => {
    const update = () => {
      frame.current = 0;
      const y = window.scrollY;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      setScrolled(y > 16);
      setProgress(max > 0 ? Math.min(1, y / max) : 0);
      if (y < 200) setActiveHref(null);
    };
    const onScroll = () => {
      if (!frame.current) frame.current = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, []);

  // scroll-spy for in-page anchors
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return undefined;
    const targets = links
      .filter((l) => l.href.startsWith("#") && l.label !== "Community")
      .map((l) => ({ href: l.href, el: document.getElementById(l.href.slice(1)) }))
      .filter((t) => t.el);
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setActiveHref(`#${e.target.id}`);
        });
      },
      { rootMargin: "-35% 0px -55% 0px" },
    );
    targets.forEach((t) => io.observe(t.el));
    return () => io.disconnect();
  }, [links]);

  // close the mobile sheet with Escape
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onKey = (e) => e.key === "Escape" && setMenuOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const isActive = (link) => link.label !== "Community" && link.href === activeHref;

  return (
    <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
      <div
        className={`relative mx-auto flex items-center justify-between gap-4 rounded-full pl-3 pr-2 ring-1 ring-(--lp-line) backdrop-blur-xl transition-[max-width,height,background-color,box-shadow] duration-300 ease-out sm:pl-4 ${
          scrolled
            ? "h-14 max-w-[1080px] bg-white/90 shadow-[0_14px_44px_rgba(15,17,21,0.13)]"
            : "h-16 max-w-[1200px] bg-white/70 shadow-[0_6px_24px_rgba(15,17,21,0.05)]"
        }`}
      >
        <Link to="/" className="group flex items-center gap-2.5 font-(family-name:--lp-font) text-lg font-bold tracking-tight text-(--lp-ink)">
          <LogoMark />
          <span className="hidden sm:inline">Universal Learning</span>
        </Link>

        {/* segmented nav */}
        <nav className="hidden items-center gap-0.5 rounded-full bg-(--lp-grey)/80 p-1 text-sm font-medium lg:flex" aria-label="Primary">
          {links.map((link) => {
            const active = isActive(link);
            return (
              <NavItem
                key={link.label}
                link={link}
                communityHref={communityHref}
                active={active}
                className={`rounded-full px-4 py-1.5 transition-[background-color,color,box-shadow] duration-200 ease-out ${
                  active ? "bg-white text-(--lp-ink) shadow-[0_2px_8px_rgba(15,17,21,0.10)]" : "text-(--lp-muted) hover:bg-white/70 hover:text-(--lp-ink)"
                }`}
              />
            );
          })}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <Link
            to="/login"
            className="hidden rounded-full px-4 py-2 text-sm font-semibold text-(--lp-ink) transition-colors duration-150 hover:bg-(--lp-grey) md:inline-flex"
          >
            Log in
          </Link>
          <Link
            to="/register"
            className="group inline-flex items-center gap-2 rounded-full bg-(--lp-ink) py-1.5 pl-5 pr-1.5 text-sm font-semibold text-white transition-transform duration-200 ease-out hover:-translate-y-0.5"
          >
            Sign Up
            <span className="grid h-8 w-8 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink) transition-transform duration-200 ease-out group-hover:rotate-45">
              <ArrowUpRight className="h-4 w-4" />
            </span>
          </Link>
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="landing-mobile-menu"
            onClick={() => setMenuOpen((open) => !open)}
            className="grid h-10 w-10 place-items-center rounded-full bg-(--lp-grey) text-(--lp-ink) transition-colors hover:bg-(--lp-blue-soft) lg:hidden"
          >
            {menuOpen ? <XIcon className="h-5 w-5" /> : <MenuIcon className="h-5 w-5" />}
          </button>
        </div>

        {/* reading-progress line */}
        <span
          className={`pointer-events-none absolute inset-x-8 bottom-0 h-[2px] overflow-hidden rounded-full transition-opacity duration-300 ${scrolled ? "opacity-100" : "opacity-0"}`}
          aria-hidden="true"
        >
          <span className="block h-full origin-left rounded-full bg-(--lp-blue)" style={{ transform: `scaleX(${progress})` }} />
        </span>
      </div>

      {/* mobile sheet */}
      <nav
        id="landing-mobile-menu"
        aria-label="Mobile"
        className={`mx-auto mt-2 max-w-[1200px] origin-top rounded-3xl bg-white p-3 shadow-[0_24px_60px_rgba(15,17,21,0.16)] ring-1 ring-(--lp-line) transition-[opacity,transform,visibility] duration-200 ease-out lg:hidden ${
          menuOpen ? "visible translate-y-0 opacity-100" : "invisible -translate-y-2 opacity-0"
        }`}
      >
        {links.map((link) => (
          <NavItem
            key={link.label}
            link={link}
            communityHref={communityHref}
            active={isActive(link)}
            onClick={() => setMenuOpen(false)}
            className={`flex items-center justify-between rounded-2xl px-4 py-3 text-[15px] font-semibold transition-colors hover:bg-(--lp-grey) ${isActive(link) ? "bg-(--lp-blue-tint) text-(--lp-blue-deep)" : "text-(--lp-ink)"}`}
          />
        ))}
        <div className="mt-2 grid grid-cols-2 gap-2 border-t border-(--lp-line) pt-3">
          <Link to="/login" onClick={() => setMenuOpen(false)} className="rounded-full bg-(--lp-grey) py-3 text-center text-sm font-semibold text-(--lp-ink)">
            Log in
          </Link>
          <Link to="/register" onClick={() => setMenuOpen(false)} className="rounded-full bg-(--lp-ink) py-3 text-center text-sm font-semibold text-white">
            Sign Up
          </Link>
        </div>
      </nav>
    </header>
  );
}
