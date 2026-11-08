import { Suspense, useEffect, useRef } from "react";
import { Link, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import { BookOpenIcon, ClockIcon, CompassIcon, FileTextIcon, HomeIcon, UsersIcon } from "../components/ui/icons";
import { useAuth } from "../hooks/useAuth";
import { useSignOut } from "../hooks/useSignOut";
import ErrorBoundary from "../components/common/ErrorBoundary";
import { useAccountStatus } from "../portals/student/hooks/useAccountStatus";
import AccountBlockedScreen from "../portals/student/components/AccountBlockedScreen";
import StudentBackdrop from "../components/common/StudentBackdrop";
import { AUTH_THEME_VARS } from "../auth/components/AuthKit";
import RouteFallback from "../components/common/RouteFallback";
import { useOnboardingGate } from "../portals/student/hooks/useOnboardingGate";
import { useStudentNotifications } from "../portals/student/hooks/useStudentNotifications";
import ResolutionNotice from "../portals/student/components/ResolutionNotice";

// Test-series portal only. Explore / courses, wishlist, payments, messages
// and the other mock-backed screens are hidden (see src/portals/student/routes.jsx).
const navEntries = [
  { href: "/student/dashboard", label: "Dashboard", icon: HomeIcon },
  { href: "/student/test-series", label: "Test Series", icon: CompassIcon },
  { href: "/student/my-tests", label: "My Tests", icon: FileTextIcon },
  { href: "/student/history", label: "History", icon: ClockIcon, alsoActive: ["/student/report"] },
  { href: "/student/account", label: "Account", icon: UsersIcon },
];

function MobileNav() {
  const { pathname } = useLocation();
  const items = [
    { href: "/student/dashboard", label: "Home", icon: HomeIcon },
    { href: "/student/test-series", label: "Series", icon: BookOpenIcon },
    { href: "/student/my-tests", label: "My Tests", icon: FileTextIcon },
    { href: "/student/history", label: "History", icon: ClockIcon, alsoActive: ["/student/report"] },
    { href: "/student/account", label: "Account", icon: UsersIcon },
  ];
  return (
    <nav className="fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-30 grid grid-cols-5 gap-1 rounded-full bg-white/95 p-1.5 shadow-[0_14px_40px_rgba(15,17,21,0.18)] ring-1 ring-(--lp-line) backdrop-blur md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || (!item.exact && pathname.startsWith(`${item.href}/`)) || Boolean(item.alsoActive?.some((p) => pathname === p || pathname.startsWith(`${p}/`)));
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex min-w-0 flex-col items-center gap-0.5 rounded-full px-1 py-2 text-[10px] font-semibold transition-colors duration-150 ${
              active ? "bg-(--lp-ink) text-white" : "text-(--lp-muted)"
            }`}
          >
            <Icon className="h-5 w-5" />
            <span className="truncate">{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

// Page-to-page transition: the incoming page fades in (opacity only, so nothing
// shifts or jumps) and the scroller returns to the top of the new page.
const PAGE_TRANSITION_CSS = `
@keyframes ul-page-in { from { opacity: 0; } to { opacity: 1; } }
.ul-page-in { animation: ul-page-in 0.32s ease-out backwards; }
/* Phones: the whole student portal is sized in rem, so scaling the root down
   a notch gives every screen less "zoomed-in" proportions at once. */
@media (max-width: 639px) { html { font-size: 14px; } }
@media (prefers-reduced-motion: reduce) { .ul-page-in { animation: none; } }
`;

// Screens that sit on a plain background instead of the notebook backdrop.
const CALM_PREFIXES = ["/student/report/", "/student/test-series/", "/student/my-tests/", "/student/dashboard/series/", "/student/test/"];
const CALM_PAGES = ["/student/dashboard", "/student/test-series", "/student/my-tests", "/student/history", "/student/account", "/student/notifications"];

export default function StudentLayout() {
  const location = useLocation();
  const mainRef = useRef(null);
  // New page = start at its top (not wherever the previous page was scrolled to).
  // Only the pathname counts, so typing in a search box (?q=) never scrolls.
  useEffect(() => {
    mainRef.current?.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [location.pathname]);
  // Warm the other student screens while the browser is idle, so switching tabs
  // never waits for a download (same specifiers as the lazy routes = same chunks).
  useEffect(() => {
    const warm = () => {
      import("../portals/student/pages/SeriesList");
      import("../portals/student/pages/MyTests");
      import("../portals/student/pages/History");
      import("../portals/student/pages/Account");
      import("../portals/student/pages/SeriesDetail");
    };
    if (typeof window.requestIdleCallback === "function") {
      const id = window.requestIdleCallback(warm, { timeout: 4000 });
      return () => window.cancelIdleCallback?.(id);
    }
    const t = setTimeout(warm, 2000);
    return () => clearTimeout(t);
  }, []);
  const { user } = useAuth();
  const signOut = useSignOut();
  const isCoursePlayer = location.pathname === "/student/courseplayer";
  // While a test is being taken (/student/test/:id/take) there is no navbar or bottom bar:
  // nothing to tap away to mid-test, and the page gets the full height.
  const isTestRunner = /^\/student\/test\/[^/]+\/take\/?$/.test(location.pathname);
  // QA triage P2: a blocked student sees only the blocked screen (checked on
  // load and focus; any student RPC refused with account_blocked flips it).
  const account = useAccountStatus();
  // QA (07 Nov): missing mandatory profile details -> the onboarding wizard,
  // once per session, however the student signed in.
  const onboarding = useOnboardingGate(user, { path: `${location.pathname}${location.search}` });
  // The inbox: bell badge + "your report was resolved" popup (20261107090000).
  const inbox = useStudentNotifications({ enabled: !account.blocked && !onboarding.redirectTo });
  const navigate = useNavigate();
  if (account.blocked) return <AccountBlockedScreen message={account.reasonPublic} onLogout={signOut} onRetry={account.check} />;
  if (onboarding.redirectTo) return <Navigate to={onboarding.redirectTo} replace />;
  if (onboarding.checking) return <RouteFallback fullscreen />;
  const viewNotice = async (notice) => {
    await inbox.markRead(notice.id);
    navigate(notice.actionUrl || "/student/notifications");
  };

  return (
    <div style={AUTH_THEME_VARS} data-modal-root className="relative isolate flex h-screen flex-col overflow-hidden bg-[#f3f6fd] font-body text-text">
      {/* The navbar floats over the scrolling page (instead of sitting above
          it), so content that scrolls up behind it softens through a frosted
          fade. The page content below gets matching top padding. Wrapper is
          click-through; only the navbar itself (and its modal) take clicks. */}
      {!isTestRunner && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-30 [&>*]:pointer-events-auto">
          <div
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[calc(100%+1.25rem)] bg-linear-to-b from-[#f3f6fd]/80 via-[#f3f6fd]/40 to-transparent backdrop-blur-md [-webkit-mask-image:linear-gradient(to_bottom,black_55%,transparent)] [mask-image:linear-gradient(to_bottom,black_55%,transparent)]"
            aria-hidden="true"
          />
          <Navbar
            title="Universal Learning"
            navEntries={navEntries}
            onSignOut={signOut}
            user={user}
            notificationsHref="/student/notifications"
            notificationsCount={inbox.unread}
          />
        </div>
      )}
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* No global "Back" button here on purpose — it used to show on
            every page except Dashboard, which put it on plain sidebar
            destinations (My Learning, Explore, Profile, etc.) where
            there's nothing to go "back" from. Pages reached by drilling
            into something else (a course, a live session, a booking)
            render their own BackButton / contextual "Back to X" action
            instead, scoped to where that specific page was entered from. */}
        <main ref={mainRef} className={`student-main min-w-0 flex-1 ${isTestRunner ? "" : "pb-24 md:pb-0"} ${isCoursePlayer ? "overflow-hidden" : "overflow-y-auto"}`}>
          {/* SectionShapes used to sit directly on the outer h-screen/
              overflow-hidden shell above, which never scrolls — only this
              <main> does (overflow-y-auto) -- so those shapes stayed glued
              to the viewport instead of moving with the page, unlike
              Landing/Explore where each section's shapes are normal-flow
              content inside the page that actually scrolls. Moving the
              wrapper here, INSIDE <main>, in normal flow with the real
              content (so its height matches the full scrollable content,
              not just the viewport-sized <main> box), fixes that: it now
              scrolls up together with the page exactly like Landing. */}
          <div className="relative min-h-full">
            {/* The dashboard is a calm working screen: no notebook doodles behind it (same for the catalogue). */}
            {!(CALM_PAGES.includes(location.pathname) || CALM_PREFIXES.some((prefix) => location.pathname.startsWith(prefix))) && <StudentBackdrop />}
            <div className={`relative z-10 ${isTestRunner ? "" : "pt-[76px]"}`}>
              <style>{PAGE_TRANSITION_CSS}</style>
              <ErrorBoundary name="student" resetKey={`${location.pathname}${location.search}`} homeHref="/student/dashboard">
                <div key={location.pathname} className="ul-page-in">
                  <Suspense fallback={<RouteFallback />}>
                    <Outlet />
                  </Suspense>
                </div>
              </ErrorBoundary>
            </div>
          </div>
        </main>
      </div>
      {!isTestRunner && <MobileNav />}
      {location.pathname !== "/student/notifications" && (
        <ResolutionNotice notifications={inbox.rows} onView={viewNotice} onOpenInbox={() => navigate("/student/notifications")} />
      )}
    </div>
  );
}
