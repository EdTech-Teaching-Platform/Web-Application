// ListRow — design.md Section 4: spacious horizontal row (orders,
// transactions, students, notifications), not a dense table; status shown
// as a small badge via StatusBadge. Generic enough to cover the Live
// Classes / Deadlines lists on the Student Dashboard.
export default function ListRow({ leading, title, subtitle, meta, trailing, onClick }) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`flex w-full items-center gap-4 rounded-2xl bg-bg px-4 py-3 text-left transition-colors duration-150 ${
        onClick ? "hover:bg-text/5" : ""
      }`}
    >
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-text">{title}</p>
        {subtitle && <p className="truncate text-xs text-text/60">{subtitle}</p>}
      </div>
      {meta && <div className="shrink-0 text-xs text-text/60">{meta}</div>}
      {trailing && <div className="shrink-0">{trailing}</div>}
    </Wrapper>
  );
}
