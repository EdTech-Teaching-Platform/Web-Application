import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BellIcon, ChevronDownIcon } from "../../components/ui/icons";
import { useAuth } from "../../hooks/useAuth";
import { BrandMark } from "../../auth/components/AuthKit";

// Shared top navbar shell — each portal layout can pass its own
// links/title. Re-themed off the neutral slate placeholder to design.md
// tokens (--color-bg / --color-text / hairline border), plus an optional
// `user` prop that renders a small primary-colored initials avatar.
//
// Student categories stay visible in the primary bar. Each category owns a
// small hover/focus dropdown so related destinations remain close without
// turning the navbar into a large mega-menu.
function NavGroup({ group, pathname }) {
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const active = group.items.some((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

  return (
    <div
      className="group relative h-10 shrink-0"
      onMouseEnter={() => {
        if (!dismissed) setOpen(true);
      }}
      onMouseLeave={() => {
        setOpen(false);
        setDismissed(false);
      }}
      onFocus={() => {
        if (!dismissed) setOpen(true);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") {
          setOpen(false);
          setDismissed(true);
          event.currentTarget.blur();
        }
      }}
    >
      <button type="button" aria-haspopup="true" aria-expanded={open} className={`inline-flex h-full items-center gap-1 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-colors duration-150 ${active ? "bg-(--lp-ink) text-white" : "text-(--lp-muted) hover:bg-(--lp-grey) hover:text-(--lp-ink)"}`}>
        {group.label}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`absolute left-0 top-[calc(100%+0.25rem)] z-40 w-56 before:absolute before:-top-3 before:left-0 before:h-3 before:w-full before:content-[''] rounded-3xl bg-white p-2 shadow-[0_20px_50px_rgba(15,17,21,0.16)] ring-1 ring-(--lp-line) transition-all duration-150 ${open ? "visible translate-y-0 opacity-100" : "invisible translate-y-1 opacity-0"}`}>
        <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)">{group.label}</p>
        {group.items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={(event) => {
              setOpen(false);
              setDismissed(true);
              event.currentTarget.blur();
            }}
            className={`block rounded-2xl px-3 py-2.5 text-sm transition-colors ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-(--lp-blue-soft) font-semibold text-(--lp-blue-deep)" : "text-(--lp-muted) hover:bg-(--lp-grey) hover:text-(--lp-ink)"}`}
          >
            {item.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

// `navEntries` is a single ORDERED list mixing bare links ({href, label})
// and dropdowns ({label, items}) — kept as one array rather than separate
// navItems/navGroups props so a caller can put a bare link anywhere in
// the row (e.g. between two dropdowns) instead of every link always
// rendering before every dropdown regardless of the order it was given
// in. `navItems`/`navGroups` are still accepted for backward
// compatibility (they render, in that fixed order, before navEntries).
export default function Navbar({ title, links = [], navItems, navGroups, navEntries, user, notificationsHref, onSignOut }) {
  const { pathname } = useLocation();
  const { user: authUser, logout } = useAuth();
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
  const [homeConfirmOpen, setHomeConfirmOpen] = useState(false);

  const handleBrandClick = (event) => {
    if (!authUser) return; // logged-out visitors navigate normally
    event.preventDefault();
    setHomeConfirmOpen(true);
  };

  const confirmGoHome = async () => {
    setHomeConfirmOpen(false);
    // Real sign-out (Supabase session + per-user storage), then a full load of
    // "/" so the protected page's guard never flashes /login on the way.
    try {
      await logout();
    } finally {
      window.location.replace("/");
    }
  };
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  return (
    <>
    <header className="relative z-30 px-3 pt-3 sm:px-5">
     <div className="mx-auto flex h-16 max-w-[1320px] items-center gap-2 rounded-full bg-white/90 pl-3 pr-2 shadow-[0_10px_40px_rgba(15,17,21,0.08)] ring-1 ring-(--lp-line) backdrop-blur-xl sm:pl-4">
      <Link to="/" onClick={handleBrandClick} className="inline-flex shrink-0 items-center gap-2.5 font-display text-base font-bold tracking-tight text-(--lp-ink) sm:text-lg">
        <BrandMark className="h-10 w-10" />
        <span className="hidden sm:inline">{title}</span>
      </Link>

      {(navItems || navGroups || navEntries) && (
        <nav className="hidden min-w-0 flex-1 items-center gap-1 pl-4 lg:flex">
          {navItems?.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`shrink-0 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "bg-(--lp-ink) text-white"
                  : "text-(--lp-muted) hover:bg-(--lp-grey) hover:text-(--lp-ink)"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {navGroups?.map((group) => <NavGroup key={group.label} group={group} pathname={pathname} />)}
          {navEntries?.map((entry) =>
            entry.items ? (
              <NavGroup key={entry.label} group={entry} pathname={pathname} />
            ) : (
              <Link
                key={entry.href}
                to={entry.href}
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors duration-150 ${
                  pathname === entry.href || pathname.startsWith(`${entry.href}/`)
                    ? "bg-(--lp-ink) text-white"
                    : "text-(--lp-muted) hover:bg-(--lp-grey) hover:text-(--lp-ink)"
                }`}
              >
                {entry.icon && <entry.icon className="h-4 w-4" aria-hidden="true" />}
                {entry.label}
              </Link>
            )
          )}
        </nav>
      )}

      {/* Nav-bar search box removed per request — Explore's own hero
          search (src/public/pages/ExplorePage.jsx) remains the real
          search entry point. `ml-auto` moves here so the bell/avatar
          group stays cleanly right-aligned without the gap it left. */}
      <nav className="ml-auto flex shrink-0 items-center gap-2 text-sm text-text/60">
        {links.map((l) => (
          <Link key={l.href} to={l.href} className="hover:text-primary">
            {l.label}
          </Link>
        ))}
        {notificationsHref && (
          <Link
            to={notificationsHref}
            aria-label="Notifications"
            className="flex h-10 w-10 items-center justify-center rounded-full bg-(--lp-grey) text-(--lp-ink) transition-transform duration-200 ease-out hover:-translate-y-0.5"
          >
            <BellIcon className="h-5 w-5" />
          </Link>
        )}
        {initials && (
          <Link to="/student/profile" className="flex h-10 w-10 items-center justify-center rounded-full bg-(--lp-yellow) text-xs font-bold text-(--lp-ink) ring-2 ring-white" aria-label="Open profile">
            {initials}
          </Link>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={() => setSignOutConfirmOpen(true)}
            className="hidden rounded-full bg-(--lp-ink) px-4 py-2.5 text-xs font-semibold text-white transition-transform duration-200 ease-out hover:-translate-y-0.5 lg:inline"
          >
            Sign out
          </button>
        )}
      </nav>
     </div>
    </header>
    {homeConfirmOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-(--lp-ink)/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setHomeConfirmOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setHomeConfirmOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="go-home-title" className="w-full max-w-md rounded-[32px] bg-white p-7 shadow-[0_30px_80px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line)">
          <h2 id="go-home-title" className="font-display text-xl font-bold text-text">Go to the homepage?</h2>
          <p className="mt-2 text-sm leading-6 text-text/60">Going back to the homepage will sign you out. Continue?</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" autoFocus onClick={() => setHomeConfirmOpen(false)} className="rounded-full bg-(--lp-grey) px-5 py-2.5 text-sm font-semibold text-(--lp-ink) hover:bg-(--lp-line)">Cancel</button>
            <button type="button" onClick={confirmGoHome} className="rounded-full bg-(--lp-ink) px-5 py-2.5 text-sm font-semibold text-white hover:bg-(--lp-ink)/90">Continue</button>
          </div>
        </section>
      </div>
    )}
    {signOutConfirmOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-(--lp-ink)/45 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSignOutConfirmOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setSignOutConfirmOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="sign-out-title" className="w-full max-w-md rounded-[32px] bg-white p-7 shadow-[0_30px_80px_rgba(15,17,21,0.3)] ring-1 ring-(--lp-line)">
          <h2 id="sign-out-title" className="font-display text-xl font-bold text-text">Sign out?</h2>
          <p className="mt-2 text-sm leading-6 text-text/60">Are you sure you want to sign out of Universal Learning?</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" autoFocus onClick={() => setSignOutConfirmOpen(false)} className="rounded-full bg-(--lp-grey) px-5 py-2.5 text-sm font-semibold text-(--lp-ink) hover:bg-(--lp-line)">Stay signed in</button>
            <button type="button" onClick={() => { setSignOutConfirmOpen(false); onSignOut?.(); }} className="rounded-full bg-(--lp-ink) px-5 py-2.5 text-sm font-semibold text-white hover:bg-(--lp-ink)/90">Sign out</button>
          </div>
        </section>
      </div>
    )}
    </>
  );
}
