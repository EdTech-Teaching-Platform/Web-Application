// EmptyState — shared "nothing here yet" pattern (2026 elevation pass).
// Replaces one-off plain-text empty states across the app (no students, no
// reviews, no requests, no reports) with a small icon composition + heading
// + subtext, so an empty screen still reads as designed rather than
// unfinished. Purely additive/new file — existing bespoke empty states are
// migrated to this call by call, not all at once (see final report).
//
// Usage:
//   <EmptyState icon={UsersIcon} heading="No students yet" message="Once a student enrolls, they'll show up here." action={<Button .../>} />
import IconBadge from "./IconBadge";

export default function EmptyState({ icon: Icon, heading, message, action, className = "" }) {
  return (
    <div className={`flex flex-col items-center gap-1 rounded-3xl bg-surface px-8 py-14 text-center shadow-soft ${className}`}>
      {Icon && (
        <IconBadge tone="lavender" size="lg" className="mb-3">
          <Icon className="h-6 w-6" />
        </IconBadge>
      )}
      <p className="text-base font-bold text-text">{heading}</p>
      {message && <p className="max-w-xs text-sm text-muted">{message}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
