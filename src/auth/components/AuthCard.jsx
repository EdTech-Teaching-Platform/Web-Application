import { Link } from "react-router-dom";

// Shared centered-card shell for Register / Verify / Forgot / Reset —
// keeps those 4 screens visually consistent without forcing Login's
// split-screen layout into the same wrapper. Auth-only, so it lives under
// src/auth/ rather than src/components/ui/ (promote it later if a second
// portal ever needs the same shell).
export default function AuthCard({ eyebrow, title, subtitle, children, footer }) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10">
      <div className="w-full max-w-md rounded-2xl bg-bg px-8 py-10 sm:px-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="font-display text-lg tracking-tight text-primary">Universal Learning</Link>
          <Link to="/" className="inline-flex shrink-0 items-center gap-2 rounded-full border border-text/10 bg-white px-3 py-2 text-xs font-semibold text-text/65 shadow-sm transition-colors hover:border-primary/30 hover:text-primary">
            <span aria-hidden="true">←</span> Back to home
          </Link>
        </div>
        {eyebrow && (
          <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-text/40">
            {eyebrow}
          </span>
        )}
        {title && <h1 className="font-display text-2xl text-text">{title}</h1>}
        {subtitle && <p className="mt-2 text-sm text-text/60">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </div>
  );
}
