import { UsersIcon } from "../../../components/ui/icons";

function initialsOf(name) {
  return name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
}

// AttendeeStack — overlapping avatar initials + "attending/enrolled"
// count. Numbers come from the caller (liveSessions.attendeeInfo → real
// course enrollment + the occurrence's roster), never hardcoded here.
export default function AttendeeStack({ names = [], attending, enrolled, max = 3, className = "" }) {
  const shown = names.slice(0, max);
  const extra = names.length - shown.length;
  return (
    <span className={`inline-flex items-center gap-2 text-xs text-muted ${className}`}>
      {shown.length > 0 ? (
        <span className="flex -space-x-2" aria-hidden="true">
          {shown.map((n, i) => (
            <span
              key={`${n}-${i}`}
              className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-[9px] font-semibold text-primary ring-2 ring-surface"
            >
              {initialsOf(n)}
            </span>
          ))}
          {extra > 0 && (
            <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-text/[0.08] px-1 text-[9px] font-semibold text-muted ring-2 ring-surface">
              +{extra}
            </span>
          )}
        </span>
      ) : (
        <UsersIcon className="h-3.5 w-3.5" />
      )}
      <span>
        {attending} attending{enrolled !== attending ? ` · ${enrolled} enrolled` : ""}
      </span>
    </span>
  );
}
