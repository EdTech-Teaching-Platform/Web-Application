// ColorBlockCard — design.md's named color-block card. Cycles through the
// four fixed rotation tokens in order (never random) so a course/educator
// grid always reads as a consistent set. Student and Educator course cards
// are this same component with different meta-row data — do not fork a
// parallel "EducatorCourseCard".
//
// Usage:
//   <ColorBlockCard
//     rotation={0}                       // 0-3, cycles through rotation-1..4
//     eyebrow="Design"
//     title="Advanced UI Principles"
//     status={<StatusBadge status="success">Published</StatusBadge>}
//     metaRow={[{ label: "Students", value: "1,240" }, { label: "Rating", value: "4.9" }]}
//     onClick={...}
//   />
// Redesign: the four rotation blocks are now the soft pastel tones (orange,
// blue, sage-ish lavender set) so cards stay in the pastel family; order and
// cycling stay fixed, never random.
const ROTATION_CLASSES = [
  "bg-pastel-orange",
  "bg-pastel-blue",
  "bg-pastel-sage",
  "bg-pastel-lavender",
];

export default function ColorBlockCard({
  rotation = 0,
  eyebrow,
  title,
  status,
  metaRow = [],
  footer,
  onClick,
  className = "",
}) {
  const blockClass = ROTATION_CLASSES[rotation % ROTATION_CLASSES.length];
  const Wrapper = onClick ? "button" : "div";

  return (
    <Wrapper
      onClick={onClick}
      type={onClick ? "button" : undefined}
      className={`group flex w-full flex-col overflow-hidden rounded-3xl bg-surface text-left shadow-soft transition-all duration-200 ${
        onClick ? "hover:-translate-y-1 hover:shadow-card" : ""
      } ${className}`}
    >
      <div className={`relative h-24 w-full ${blockClass}`}>
        {status && <div className="absolute right-3 top-3">{status}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-3 p-6">
        <div>
          {eyebrow && <div className="eyebrow-muted">{eyebrow}</div>}
          <h3 className="mt-1 text-lg font-bold leading-snug text-text">{title}</h3>
        </div>

        {metaRow.length > 0 && (
          <div className="mt-auto flex items-center gap-4 border-t border-line pt-3">
            {metaRow.map((m) => (
              <div key={m.label} className="flex flex-col">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">{m.label}</span>
                <span className="text-sm font-semibold text-text">{m.value}</span>
              </div>
            ))}
          </div>
        )}
        {footer}
      </div>
    </Wrapper>
  );
}
