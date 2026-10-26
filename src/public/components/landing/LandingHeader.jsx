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
import { Link, useNavigate } from "react-router-dom";
import { LogoutIcon, MenuIcon, XIcon } from "../../../components/ui/icons";
import { useAuth } from "../../../hooks/useAuth";
import { useSignOut } from "../../../hooks/useSignOut";
import { homePathForUser } from "../../../utils/roles";
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
  // Smooth-scroll to the section ourselves (sections carry scroll-mt-24 so the
  // sticky pill never covers the heading) and keep the hash in the URL.
  const handleClick = (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const target = document.getElementById(link.href.slice(1));
    if (target) {
      e.preventDefault();
      target.scrollIntoView({ behavior: "smooth", block: "start" });
      window.history.replaceState(null, "", link.href);
    }
    onClick?.(e);
  };
  return (
    <a href={link.href} onClick={handleClick} aria-current={active ? "location" : undefined} className={className}>
      {link.label}
    </a>
  );
}

function AccountMenu({ initials, name, email, onSignOut }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  // close on outside click / Escape
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative hidden md:block">
      <button
        type="button"
        aria-label="Account menu"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="grid h-10 w-10 place-items-center rounded-full bg-(--lp-yellow) text-xs font-bold text-(--lp-ink) ring-2 ring-white transition-transform duration-200 ease-out hover:-translate-y-0.5"
      >
        {initials}
      </button>
      <div
        role="menu"
        className={`absolute right-0 top-[calc(100%+0.75rem)] z-50 w-60 origin-top-right rounded-[1.25rem] bg-white p-2 shadow-[0_24px_60px_-12px_rgba(15,17,21,0.28)] ring-1 ring-(--lp-line) transition-[opacity,transform,visibility] duration-200 ease-out ${
          open ? "visible translate-y-0 scale-100 opacity-100" : "invisible -translate-y-1 scale-95 opacity-0"
        }`}
      >
        {/* caret pointing at the avatar */}
        <span className="absolute -top-[7px] right-[0.95rem] h-3.5 w-3.5 rotate-45 rounded-tl-[4px] border-l border-t border-(--lp-line) bg-white" aria-hidden="true" />
        <div className="flex items-center gap-3 rounded-2xl bg-(--lp-grey) px-3 py-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-(--lp-yellow) text-xs font-bold text-(--lp-ink)" aria-hidden="true">{initials}</span>
          <span className="min-w-0">
            {name && <span className="block truncate text-sm font-bold text-(--lp-ink)">{name}</span>}
            {email && <span className="block truncate text-xs text-(--lp-muted)">{email}</span>}
          </span>
        </div>
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            setOpen(false);
            onSignOut();
          }}
          className="group mt-1.5 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left text-sm font-semibold text-(--lp-ink) transition-colors duration-150 hover:bg-[#fdecec] hover:text-[#b42318] focus-visible:bg-[#fdecec] focus-visible:text-[#b42318] focus-visible:outline-none"
        >
          <span className="grid h-8 w-8 place-items-center rounded-xl bg-(--lp-grey) transition-colors duration-150 group-hover:bg-white group-focus-visible:bg-white">
            <LogoutIcon className="h-4 w-4" aria-hidden="true" />
          </span>
          Sign out
        </button>
      </div>
    </div>
  );
}

export default function LandingHeader({ links, communityHref }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();
  const signOut = useSignOut();
  const [scrolled, setScrolled] = useState(false);
  const [progress, setProgress] = useState(0);
  const [activeHref, setActiveHref] = useState(null);
  const frame = useRef(0);
  // Signed-in visitors get a way back into their portal instead of Log in / Sign Up.
  const { user, loading: authLoading } = useAuth();
  const homePath = homePathForUser(user);
  const initials = (user?.name || user?.email || "")
    .split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();

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
      {/* Frosted fade across the whole top strip: content scrolling up behind
          or around the pill blurs out instead of showing sharp in the gaps. */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+1.25rem)] bg-linear-to-b from-white/80 via-white/40 to-transparent backdrop-blur-md [-webkit-mask-image:linear-gradient(to_bottom,black_55%,transparent)] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
        aria-hidden="true"
      />
      <div
        className={`relative mx-auto flex items-center justify-between gap-4 rounded-full pl-3 pr-2 ring-1 ring-(--lp-line) backdrop-blur-xl transition-[max-width,height,background-color,box-shadow] duration-300 ease-out sm:pl-4 ${
          scrolled
            ? "h-14 max-w-[1080px] bg-white/90 shadow-[0_14px_44px_rgba(15,17,21,0.13)]"
            : "h-16 max-w-[1200px] bg-white/60 shadow-[0_6px_24px_rgba(15,17,21,0.05)]"
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
          {authLoading ? (
            <span className="h-11 w-28" aria-hidden="true" />
          ) : user ? (
            <>
              {initials && <AccountMenu initials={initials} name={user?.name} email={user?.email} onSignOut={signOut} />}
              <Link
                to={homePath}
                onClick={(e) => {
                  // explicit navigation so the click always lands on the dashboard
                  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
                  e.preventDefault();
                  navigate(homePath);
                }}
                className="group inline-flex items-center gap-2 rounded-full bg-(--lp-ink) py-1.5 pl-5 pr-1.5 text-sm font-semibold text-white transition-transform duration-200 ease-out hover:-translate-y-0.5"
              >
                Dashboard
                <span className="grid h-8 w-8 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink) transition-transform duration-200 ease-out group-hover:rotate-45">
                  <ArrowUpRight className="h-4 w-4" />
                </span>
              </Link>
            </>
          ) : (
            <Link
              to="/login"
              className="group inline-flex items-center gap-2 rounded-full bg-(--lp-ink) py-1.5 pl-5 pr-1.5 text-sm font-semibold text-white transition-transform duration-200 ease-out hover:-translate-y-0.5"
            >
              Log in
              <span className="grid h-8 w-8 place-items-center rounded-full bg-(--lp-yellow) text-(--lp-ink) transition-transform duration-200 ease-out group-hover:rotate-45">
                <ArrowUpRight className="h-4 w-4" />
              </span>
            </Link>
          )}
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
        className={`absolute left-3 right-3 top-full z-50 mx-auto mt-2 max-w-[1200px] origin-top rounded-3xl bg-white p-3 shadow-[0_24px_60px_rgba(15,17,21,0.16)] ring-1 ring-(--lp-line) transition-[opacity,transform,visibility] duration-200 ease-out sm:left-6 sm:right-6 lg:hidden ${
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
        {!authLoading && (
          user ? (
            <div className="mt-2 border-t border-(--lp-line) pt-3">
              <Link to={homePath} onClick={() => setMenuOpen(false)} className="block rounded-full bg-(--lp-ink) py-3 text-center text-sm font-semibold text-white">
                Dashboard
              </Link>
              <button
                type="button"
                onClick={() => { setMenuOpen(false); signOut(); }}
                className="mt-2 block w-full rounded-full bg-(--lp-grey) py-3 text-center text-sm font-semibold text-(--lp-ink)"
              >
                Sign out
              </button>
            </div>
          ) : (
            <div className="mt-2 border-t border-(--lp-line) pt-3">
              <Link to="/login" onClick={() => setMenuOpen(false)} className="block rounded-full bg-(--lp-ink) py-3 text-center text-sm font-semibold text-white">
                Log in
              </Link>
            </div>
          )
        )}
      </nav>
    </header>
  );
}
