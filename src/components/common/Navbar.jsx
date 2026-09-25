import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { SearchIcon, BellIcon, ChevronDownIcon } from "../../components/ui/icons";

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
      className="group relative h-full"
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
      <button type="button" aria-haspopup="true" aria-expanded={open} className={`inline-flex h-full items-center gap-1 rounded-full px-3 py-2 text-sm font-medium transition-colors duration-150 ${active ? "text-primary" : "text-text/60 hover:text-primary"}`}>
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

export default function Navbar({ title, links = [], navItems, navGroups, user, notificationsHref, onSignOut }) {
  const { pathname } = useLocation();
  const initials = user?.name
    ? user.name
        .split(" ")
        .map((p) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : null;

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b border-text/10 bg-bg/95 px-4 backdrop-blur sm:px-6">
      <Link to="/" className="shrink-0 font-display text-lg font-bold tracking-tight text-primary">
        {title}
      </Link>

      {(navItems || navGroups) && (
        <nav className="hidden min-w-0 items-center gap-0.5 lg:flex">
          {navItems?.map((item) => (
            <Link
              key={item.href}
              to={item.href}
              className={`rounded-full px-3 py-2 text-sm font-medium transition-colors duration-150 ${
                pathname === item.href || pathname.startsWith(`${item.href}/`)
                  ? "text-primary"
                  : "text-text/60 hover:text-primary"
              }`}
            >
              {item.label}
            </Link>
          ))}
          {navGroups?.map((group) => <NavGroup key={group.label} group={group} pathname={pathname} />)}
        </nav>
      )}

      <Link
        to="/student/searchresults"
        className="ml-auto hidden shrink-0 items-center gap-2 rounded-full border border-text/10 bg-white px-3 py-2 text-xs text-text/45 sm:flex sm:w-56"
      >
        <SearchIcon className="h-4 w-4 shrink-0" />
        <span className="truncate">Search courses and educators</span>
      </Link>

      <nav className="flex shrink-0 items-center gap-3 text-sm text-text/60">
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
            onClick={onSignOut}
            className="hidden text-xs font-semibold text-text/45 hover:text-primary lg:inline"
          >
            Sign out
          </button>
        )}
      </nav>
    </header>
  );
}
