// Switch — animated on/off toggle (sliding thumb, transform/opacity only,
// 200ms ease-out, matches design.md's motion rules). design.md doesn't name
// a toggle control yet, but Content Upload alone needs six independent
// on/off settings (Free preview, Required for completion, Shuffle
// questions, Time limit, Allow resubmission, Accept late) so this is built
// once, generically, rather than six hand-rolled checkboxes.
//
// Usage:
//   <Switch checked={preview} onChange={setPreview} label="Free preview" description="Visible without enrolling" />
//   <Switch checked={on} onChange={setOn} /> // bare track, no label row
export default function Switch({ checked, onChange, label, description, disabled = false, className = "" }) {
  const track = (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors duration-200 ease-out disabled:cursor-not-allowed disabled:opacity-40 ${
        checked ? "bg-primary" : "bg-text/15"
      }`}
    >
      <span
        className={`inline-block h-4.5 w-4.5 rounded-full bg-white shadow-card transition-transform duration-200 ease-out ${
          checked ? "translate-x-[22px]" : "translate-x-1"
        }`}
      />
    </button>
  );

  if (!label) return <span className={className}>{track}</span>;

  return (
    <label className={`flex items-center justify-between gap-4 ${disabled ? "" : "cursor-pointer"} ${className}`}>
      <span className="min-w-0">
        <span className="block text-sm font-medium text-text">{label}</span>
        {description && <span className="mt-0.5 block text-xs text-muted">{description}</span>}
      </span>
      {track}
    </label>
  );
}
