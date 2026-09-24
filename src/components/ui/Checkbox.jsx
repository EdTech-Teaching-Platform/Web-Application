export default function Checkbox({ label, className = "", ...props }) {
  return (
    <label className={`flex cursor-pointer items-start gap-2.5 text-sm text-text ${className}`}>
      <input
        type="checkbox"
        className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--color-primary)]"
        {...props}
      />
      <span>{label}</span>
    </label>
  );
}
