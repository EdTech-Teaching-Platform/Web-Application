import { Link, useNavigate } from "react-router-dom";
import { AuthFrame, BrandMark } from "./AuthKit";

// Shared centered-card shell for Verify / Forgot / Reset — keeps those
// screens visually consistent without forcing Login's split-screen layout
// into the same wrapper. Auth-only, so it lives under src/auth/ rather than
// src/components/ui/ (promote it later if a second portal ever needs the
// same shell).
//
// Redesign: same props and behaviour as before (brand button goes back,
// optional "Back to home" link, eyebrow/title/subtitle/children/footer) —
// only the look changed, to the blue / ink / yellow theme (see AuthKit).
export default function AuthCard({ eyebrow, title, subtitle, children, footer, showBackToHome = true }) {
  const navigate = useNavigate();
  const goBack = () => (window.history.length > 1 ? navigate(-1) : navigate("/"));
  return (
    <AuthFrame>
      <div className="relative w-full max-w-md rounded-[36px] bg-white px-7 py-9 shadow-[0_30px_80px_rgba(37,87,214,0.18)] ring-1 ring-(--lp-line) sm:px-10 sm:py-11">
        <div className="mb-8 flex items-center justify-between gap-3">
          <button type="button" onClick={goBack} className="inline-flex items-center gap-2.5 font-display text-base font-bold tracking-tight text-(--lp-ink)">
            <BrandMark className="h-9 w-9" />
            Universal Learning
          </button>
          {showBackToHome && (
            <Link to="/" className="inline-flex shrink-0 items-center gap-2 rounded-full bg-(--lp-grey) px-3.5 py-2 text-xs font-semibold text-(--lp-ink) transition-transform duration-200 ease-out hover:-translate-y-0.5">
              <span aria-hidden="true">←</span> Back to home
            </Link>
          )}
        </div>
        {eyebrow && (
          <span className="inline-flex rounded-full bg-(--lp-yellow) px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-(--lp-ink)">
            {eyebrow}
          </span>
        )}
        {title && <h1 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-text">{title}</h1>}
        {subtitle && <p className="mt-2 text-sm leading-relaxed text-text/60">{subtitle}</p>}
        <div className="mt-8">{children}</div>
        {footer && <div className="mt-6">{footer}</div>}
      </div>
    </AuthFrame>
  );
}
