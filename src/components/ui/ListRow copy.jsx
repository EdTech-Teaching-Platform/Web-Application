// ListRow — generic row for agenda/activity/feed lists (design.md's named
// component list). One shape, many callers: upcoming sessions, recent
// activity, notifications — don't fork a per-feature row component.
//
// Usage:
//   <ListRow
//     leading={<span className="...">14</span>}   // date badge, avatar, icon chip — caller's choice
//     title="Portfolio Review"
//     subtitle="10:00 AM – 11:00 AM"
//     trailing={<StatusBadge status="success">Confirmed</StatusBadge>}
//     onClick={...}
//   />
export default function ListRow({ leading, title, subtitle, trailing, onClick, className = "" }) {
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`flex w-full items-center gap-4 rounded-2xl px-3 py-3 text-left transition-colors duration-150 ${
        onClick ? "hover:bg-bg" : ""
      } ${className}`}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-semibold text-text">{title}</div>
        {subtitle && <div className="mt-0.5 truncate text-xs text-muted">{subtitle}</div>}
      </div>
      {trailing && <div className="shrink-0">{trailing}</div>}
    </Wrapper>
  );
}
