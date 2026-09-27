import { useLocation, Link } from "react-router-dom";

// Shared sidebar shell — each portal layout supplies its own nav items.
// Re-themed off the neutral slate placeholder to design.md's actual
// tokens: active item filled --color-primary + white text (the same
// active-state language as FilterPill/Chip), inactive items muted text,
// optional per-item icon, and an optional colored `footer` slot for a
// promo/status card (Student passes one; other portals can opt in later).
// Dashboard chrome itself stays neutral per design.md — the color here is
// confined to the active-state pill, matching "boldness lives in content,
// not chrome" while still giving the rail some visual weight.
export default function Sidebar({ items = [], groups, footer }) {
  const { pathname } = useLocation();

  return (
    <aside className="hidden h-full w-50 shrink-0 flex-col border-r border-text/10 bg-white p-3 md:flex">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="space-y-6">
        {(groups ?? [{ items }]).map((group, groupIndex) => (
          <div key={group.label ?? groupIndex}>
            {group.label && (
              <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.16em] text-text/35">
                {group.label}
              </p>
            )}
            <ul className="space-y-1 text-sm">
              {group.items.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;
          return (
            <li key={item.href}>
              <Link
                to={item.href}
                className={`flex items-center gap-3 rounded-xl px-3 py-2.5 font-medium transition-colors duration-150 ${
                active ? "bg-blush text-primary" : "text-text/60 hover:bg-text/5 hover:text-text"
                }`}
              >
                {Icon && <Icon className={active ? "text-white" : "text-text/40"} />}
                {item.label}
              </Link>
            </li>
          );
              })}
            </ul>
          </div>
        ))}
        </div>
      </div>

      {footer && <div className="mt-6 shrink-0">{footer}</div>}
    </aside>
  );
}
