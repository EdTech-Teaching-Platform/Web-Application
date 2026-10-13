import { LockIcon } from "./icons";

// LockedSection — generic "this whole area is frozen" wrapper. Used by
// Course Builder wherever a lifecycle state (Pending Review, Published,
// Archived) freezes a section: Curriculum/Content once Published, or the
// entire builder once Pending Review/Archived. Keeps the section's real
// content mounted underneath (so data/preview state doesn't unmount) but
// disables interaction and mutes it visually, with a small lock chip
// explaining why — never just fading a form to look "broken" with no
// explanation, per design.md's disabled-state rule.
//
// Usage:
//   <LockedSection locked={status === "published"} reason="Curriculum is locked once a course is published.">
//     <CurriculumBuilder ... />
//   </LockedSection>
//
// Optional `blur` (soft-blur + inert/aria-hidden the muted content, for "waiting" states like a
// profile under verification), `icon` (override the lock glyph) and `title`
// (bold first line in the chip) — all default to the original look.
export default function LockedSection({ locked, reason, children, className = "", blur = false, icon: Icon = LockIcon, title }) {
  if (!locked) return <div className={className}>{children}</div>;

  return (
    <div className={`relative ${className}`}>
      <div
        {...(blur ? { inert: true, "aria-hidden": true } : {})}
        className={`pointer-events-none select-none opacity-50 grayscale-[0.35] ${blur ? "blur-[3px]" : ""}`}
      >
        {children}
      </div>
      <div className="absolute inset-0 flex items-start justify-center pt-10">
        <div role="status" className="mx-4 flex max-w-sm items-start gap-3 rounded-2xl bg-white px-4 py-3.5 shadow-sm ring-1 ring-text/[0.08]">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-text/[0.08] text-text/50">
            <Icon className="h-4 w-4" />
          </span>
          <div className="text-sm text-text/60">
            {title && <p className="font-semibold text-text">{title}</p>}
            <p>{reason || "This section is locked right now."}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
