import { Link, Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import { BookOpenIcon, ClockIcon, HomeIcon, UsersIcon } from "../components/ui/icons";
import { useAuth } from "../hooks/useAuth";
import StudentErrorBoundary from "../components/common/StudentErrorBoundary";
import { AUTH_THEME_VARS } from "../auth/components/AuthKit";

// Test-series portal only. Explore / courses, wishlist, payments, messages
// and the other mock-backed screens are hidden (see src/portals/student/routes.jsx).
const navEntries = [
  { href: "/student/dashboard", label: "Dashboard" },
  {
    label: "Test Series",
    items: [
      { href: "/student/test-series", label: "Browse Test Series" },
      { href: "/student/my-tests", label: "My Tests" },
      { href: "/student/history", label: "History" },
    ],
  },
  { href: "/student/account", label: "Account" },
];

function MobileNav() {
  const { pathname } = useLocation();
  const items = [
    { href: "/student/dashboard", label: "Dashboard", icon: HomeIcon },
    { href: "/student/test-series", label: "Series", icon: BookOpenIcon },
    { href: "/student/my-tests", label: "My Tests", icon: BookOpenIcon },
    { href: "/student/history", label: "History", icon: ClockIcon },
    { href: "/student/account", label: "Account", icon: UsersIcon },
  ];
  return (
    <nav className="fixed inset-x-3 bottom-3 z-30 grid grid-cols-5 rounded-full bg-white/95 px-2 py-1.5 shadow-[0_14px_40px_rgba(15,17,21,0.18)] ring-1 ring-(--lp-line) backdrop-blur md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex min-w-0 flex-col items-center gap-0.5 rounded-full px-1 py-1.5 text-[10px] font-semibold transition-colors duration-150 ${
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

export default function StudentLayout() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const isCoursePlayer = location.pathname === "/student/courseplayer";

  return (
    <div style={AUTH_THEME_VARS} className="relative isolate flex h-screen flex-col overflow-hidden bg-(--lp-grey) font-body text-text">
      <Navbar
        title="Universal Learning"
        navEntries={navEntries}
        onSignOut={logout}
        user={user}
      />
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* No global "Back" button here on purpose — it used to show on
            every page except Dashboard, which put it on plain sidebar
            destinations (My Learning, Explore, Profile, etc.) where
            there's nothing to go "back" from. Pages reached by drilling
            into something else (a course, a live session, a booking)
            render their own BackButton / contextual "Back to X" action
            instead, scoped to where that specific page was entered from. */}
        <main className={`student-main min-w-0 flex-1 pb-24 md:pb-0 ${isCoursePlayer ? "overflow-hidden" : "overflow-y-auto"}`}>
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
            <div className="relative z-10">
              <StudentErrorBoundary key={`${location.pathname}${location.search}`}>
                <Outlet />
              </StudentErrorBoundary>
            </div>
          </div>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
