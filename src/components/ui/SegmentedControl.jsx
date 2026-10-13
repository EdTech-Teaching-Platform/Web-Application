// SegmentedControl — single-choice pill group with a sliding active
// background (design.md doesn't name one yet; built to spec since
// Difficulty here and Student Onboarding's "learning pace" style questions
// are the same shape — a Chip row without the multi-select semantics).
//
// Usage:
//   <SegmentedControl options={["Beginner","Intermediate","Advanced"]} value={level} onChange={setLevel} />
export default function SegmentedControl({ options, value, onChange, className = "" }) {
  return (
    <div className={`inline-flex rounded-full bg-surface p-1 shadow-soft ring-1 ring-text/[0.06] ${className}`}>
      {options.map((opt) => {
        const active = opt === value;
        return (
          <button
            key={opt}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt)}
            className={`rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              active ? "bg-primary text-white shadow-sm" : "text-muted hover:text-text"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}
