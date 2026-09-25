import { Link } from "react-router-dom";

// Shared "eyebrow + title + subtitle + View all →" header, used by every
// discovery-page section (Explore, Live Classes, Recorded Classes) so the
// heading pattern doesn't get re-typed with small drifts in each page —
// same visual language LandingPage.jsx and ManageBooking.jsx already use
// inline, just promoted to one place now that 3+ pages need it.
export default function SectionHeading({ id, eyebrow, title, subtitle, viewAllHref, viewAllLabel = "View all" }) {
  return (
    <div id={id} className="mb-5 flex scroll-mt-24 flex-wrap items-end justify-between gap-4">
      <div>
        {eyebrow && <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">{eyebrow}</p>}
        <h2 className="mt-1 font-display text-xl font-bold text-[#17324d] sm:text-2xl">{title}</h2>
        {subtitle && <p className="mt-1 text-sm text-text/60">{subtitle}</p>}
      </div>
      {viewAllHref && (
        <Link to={viewAllHref} className="shrink-0 text-sm font-semibold text-primary hover:underline">
          {viewAllLabel} →
        </Link>
      )}
    </div>
  );
}
