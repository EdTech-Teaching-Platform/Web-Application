import { Suspense } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import RouteFallback from "../components/common/RouteFallback";
import Button from "../components/ui/Button";
import SectionShapes from "../components/common/SectionShapes";
import { useAuth } from "../hooks/useAuth";
import { homePathForUser } from "../utils/roles";
import { LANDING_THEME_VARS } from "../public/landingTheme";
import { useScrollToHash } from "../hooks/useScrollToHash";
import LandingHeader from "../public/components/landing/LandingHeader";

// New top-level layout — public/marketing chrome, no sidebar. Added per
// the Discovery build spec: Landing + Explore render for visitors who
// aren't logged in and haven't picked a portal yet (doc Section 4.3), so
// they don't fit any of the existing {auth,student,teacher,admin}
// layouts. This is the one legitimate reason to touch
// src/routes/AppRoutes.jsx per the README — a whole new top-level
// layout, not a new screen inside an existing portal.
//
// Nav center links (max five) are in-page scroll anchors that each map to a
// real section on the landing page (#platform, #how-it-works, #courses (test series finder),
// #educators, #faq). Off the landing page they point back to "/#section".
//
// Landing redesign (2026): on "/" the header uses the new landing theme
// (floating glass bar, ink pill CTA with arrow). Every other public page
// (Explore, Instructors, Course details…) keeps its existing header
// styling untouched, so nothing there changes.
const NAV_LINKS = [
  { href: "#platform", label: "Features" },
  { href: "#how-it-works", label: "How It Works" },
  { href: "#courses", label: "Test Series" },
  { href: "#educators", label: "Educators" },
  { href: "#faq", label: "FAQ" },
];

export default function PublicLayout() {
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  useScrollToHash();
  const isHome = location.pathname === "/";
  // The public test series pages (/test-series, /test-series/:id) share the
  // landing look so browsing from the landing page feels like one product.
  const isSeriesBrowse = location.pathname === "/test-series" || location.pathname.startsWith("/test-series/");
  const communityHref = user
    ? "/student/messages"
    : `/register?redirect=${encodeURIComponent("/student/messages")}`;

  if (isHome || isSeriesBrowse) {
    // Off the landing page the section anchors point back to "/#section".
    const links = isHome ? NAV_LINKS : NAV_LINKS.map((l) => ({ ...l, href: `/${l.href}` }));
    return (
      <div style={LANDING_THEME_VARS} className="relative min-h-screen bg-white font-body text-text selection:bg-(--lp-yellow) selection:text-(--lp-ink)">
        <LandingHeader links={links} communityHref={communityHref} />
        <main className="public-page-content relative z-10">
          <Suspense fallback={<RouteFallback />}><Outlet /></Suspense>
        </main>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-white font-body text-text">
      <header className="relative z-10 flex h-16 items-center justify-between gap-4 px-6 md:px-10">
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
            const className = isActive
              ? "border-b-2 border-primary pb-1 text-text"
              : "text-text/60 hover:text-text";
            if (link.label === "Community") {
              return <Link key={link.label} to={communityHref} className={className}>{link.label}</Link>;
            }
            return <Link key={link.label} to={`/${link.href}`} className={className}>{link.label}</Link>;
          })}
        </nav>

        {/* Item 3: Log In removed from the public nav — Sign Up is the
            only auth CTA here, right-aligned on its own. */}
        <div className="flex items-center justify-end">
          {authLoading ? null : user ? (
            <Button as={Link} to={homePathForUser(user)} fullWidth={false} className="px-5 py-2.5">
              Dashboard
            </Button>
          ) : (
            <Button as={Link} to="/login" fullWidth={false} className="px-5 py-2.5">
              Log in
            </Button>
          )}
        </div>
      </header>
      <SectionShapes variant="public" />
      <main className="public-page-content relative z-10">
        <Suspense fallback={<RouteFallback />}><Outlet /></Suspense>
      </main>
    </div>
  );
}
