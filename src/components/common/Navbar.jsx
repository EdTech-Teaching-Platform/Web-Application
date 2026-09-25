import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { BellIcon, ChevronDownIcon } from "../../components/ui/icons";

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
      className="group relative h-full shrink-0"
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
      <button type="button" aria-haspopup="true" aria-expanded={open} className={`inline-flex h-full items-center gap-1 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium transition-colors duration-150 ${active ? "text-primary" : "text-text/60 hover:text-primary"}`}>
        {group.label}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-150 ${open ? "rotate-180" : ""}`} />
      </button>
      <div className={`absolute left-0 top-full z-40 w-48 rounded-xl border border-text/10 bg-white p-2 shadow-[0_12px_28px_rgba(23,50,77,0.12)] transition-all duration-150 ${open ? "visible translate-y-0 opacity-100" : "invisible translate-y-1 opacity-0"}`}>
        <p className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-[0.14em] text-text/40">{group.label}</p>
        {group.items.map((item) => (
          <Link
            key={item.href}
            to={item.href}
            onClick={(event) => {
              setOpen(false);
              setDismissed(true);
              event.currentTarget.blur();
            }}
            className={`block rounded-lg px-3 py-2.5 text-sm transition-colors ${pathname === item.href || pathname.startsWith(`${item.href}/`) ? "bg-primary/5 font-semibold text-primary" : "text-text/65 hover:bg-primary/5 hover:text-primary"}`}
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
  const [signOutConfirmOpen, setSignOutConfirmOpen] = useState(false);
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
    <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-text/10 bg-bg/95 px-4 backdrop-blur sm:px-5">
      <Link to="/" className="shrink-0 font-display text-lg font-bold tracking-tight text-primary">
        {title}
      </Link>

      {(navItems || navGroups || navEntries) && (
        <nav className="hidden min-w-0 flex-1 items-center gap-0 lg:flex">
          {navItems?.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`shrink-0 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium transition-colors duration-150 ${
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-primary"
                  : "text-text/60 hover:text-primary"
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
              className={`inline-flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-2 text-[13px] font-medium transition-colors duration-150 ${
                  pathname === entry.href || pathname.startsWith(`${entry.href}/`)
                    ? "text-primary"
                    : "text-text/60 hover:text-primary"
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
            className="flex h-9 w-9 items-center justify-center rounded-full text-text/55 transition-colors hover:bg-text/5 hover:text-primary"
          >
            <BellIcon className="h-5 w-5" />
          </Link>
        )}
        {initials && (
          <Link to="/student/profile" className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-xs font-semibold text-white" aria-label="Open profile">
            {initials}
          </Link>
        )}
        {onSignOut && (
          <button
            type="button"
            onClick={() => setSignOutConfirmOpen(true)}
            className="hidden text-xs font-semibold text-text/45 hover:text-primary lg:inline"
          >
            Sign out
          </button>
        )}
      </nav>
    </header>
    {signOutConfirmOpen && (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#17324d]/35 p-4" onMouseDown={(event) => { if (event.target === event.currentTarget) setSignOutConfirmOpen(false); }} onKeyDown={(event) => { if (event.key === "Escape") setSignOutConfirmOpen(false); }}>
        <section role="dialog" aria-modal="true" aria-labelledby="sign-out-title" className="w-full max-w-md rounded-2xl border border-text/10 bg-white p-6 shadow-[0_20px_60px_rgba(23,50,77,0.22)]">
          <h2 id="sign-out-title" className="font-display text-xl font-bold text-text">Sign out?</h2>
          <p className="mt-2 text-sm leading-6 text-text/60">Are you sure you want to sign out of Universal Learning?</p>
          <div className="mt-6 flex justify-end gap-3">
            <button type="button" autoFocus onClick={() => setSignOutConfirmOpen(false)} className="rounded-full border border-text/15 px-4 py-2.5 text-sm font-semibold text-text/70 hover:bg-text/5">Stay signed in</button>
            <button type="button" onClick={() => { setSignOutConfirmOpen(false); onSignOut?.(); }} className="rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white hover:bg-primary/90">Sign out</button>
          </div>
        </section>
      </div>
    )}
    </>
  );
}
