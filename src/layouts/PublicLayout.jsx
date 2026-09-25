import { Link, Outlet, useLocation } from "react-router-dom";
import Button from "../components/ui/Button";
import AmbientPortalBackdrop from "../components/common/AmbientPortalBackdrop";

// New top-level layout — public/marketing chrome, no sidebar. Added per
// the Discovery build spec: Landing + Explore render for visitors who
// aren't logged in and haven't picked a portal yet (doc Section 4.3), so
// they don't fit any of the existing {auth,student,teacher,admin}
// layouts. This is the one legitimate reason to touch
// src/routes/AppRoutes.jsx per the README — a whole new top-level
// layout, not a new screen inside an existing portal.
//
// Nav center links per the Landing Page build spec (Courses/Instructors/
// FAQ) are in-page scroll anchors to that page's own sections — real
// destinations, not decorative, satisfying the Interactivity Rule, since
// this layout only ever wraps LandingPage/ExplorePage today. "How It
// Works" and "Community" have no dedicated section or page yet — Community
// in particular is explicitly Future Scope per the LMS doc, not a current
// module — so both point at the FAQ section for now rather than a dead
// link. Flag: replace with real destinations once those exist.
//
// Auth links keep one neutral login entry point for all supported roles,
// plus the student/educator registration action.
const NAV_LINKS = [
  { href: "#courses", label: "Courses" },
  { href: "#instructors", label: "Instructors" },
  { href: "#faq", label: "FAQ" },
  { href: "#faq", label: "How It Works" },
  { href: "#faq", label: "Community" },
];

export default function PublicLayout() {
  const location = useLocation();
  return (
    <div className="relative min-h-screen bg-bg font-body text-text">
      <header className="flex h-16 items-center justify-between gap-4 px-6 md:px-10">
        <Link to="/" className="font-display text-lg font-bold text-primary">
          Universal Learning
        </Link>

        <nav className="hidden items-center gap-7 text-sm font-medium lg:flex">
          {NAV_LINKS.map((link) => {
            // Item 9 fix: this nav only ever links to in-page scroll anchors
            // on the current page (Landing/Explore), so "active" is real
            // only when we're actually on that hash right now — no more
            // hardcoded "first link is always active" hack, which used to
            // keep "Courses" permanently highlighted on every page/section.
            const isActive = location.pathname === "/" && location.hash === link.href;
            return (
              <a
                key={link.label}
                href={link.href}
                className={
                  isActive
                    ? "border-b-2 border-primary pb-1 text-text"
                    : "text-text/60 hover:text-text"
                }
              >
                {link.label}
              </a>
            );
          })}
        </nav>

        {/* Item 3: Log In removed from the public nav — Sign Up is the
            only auth CTA here, right-aligned on its own. */}
        <div className="flex items-center justify-end">
          <Button as={Link} to="/register" fullWidth={false} className="px-5 py-2.5">
            Sign Up
          </Button>
        </div>
      </header>
      <AmbientPortalBackdrop variant="public" />
      <main className="public-page-content relative z-10">
        <Outlet />
      </main>
    </div>
  );
}
