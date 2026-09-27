import { Link, Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import { CompassIcon, HelpCircleIcon, HomeIcon } from "../components/ui/icons";
import { useAuth } from "../hooks/useAuth";
import StudentErrorBoundary from "../components/common/StudentErrorBoundary";
import SectionShapes from "../components/common/SectionShapes";

const navEntries = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/explore", label: "Explore" },
  { href: "/student/my-learning", label: "My Learning" },
  {
    label: "Test Series",
    items: [
      { href: "/student/test-series", label: "Browse Test Series" },
      { href: "/student/assessments/my-results", label: "My Results" },
    ],
  },
  {
    label: "Classes",
    items: [
      { href: "/student/live-classes", label: "Live Classes" },
      { href: "/student/learninghistory", label: "Learning History" },
    ],
  },
  { href: "/student/assessments/course-quizzes", label: "Assignments" },
  { label: "Engage", items: [
    { href: "/student/calendar", label: "Calendar" },
    { href: "/student/messages", label: "Discussions" },
  ] },
  { href: "/student/certificates", label: "Achievements" },
  {
    label: "Account",
    items: [
      { href: "/student/profile", label: "Profile" },
      { href: "/student/wishlist", label: "Wishlist" },
      { href: "/student/orders", label: "Payments" },
      { href: "/student/help-complaints", label: "Help & Complaints" },
    ],
  },
];

function MobileNav() {
  const { pathname } = useLocation();
  const items = [
    { href: "/student/dashboard", label: "Dashboard", icon: HomeIcon },
    { href: "/student/explore", label: "Explore", icon: CompassIcon },
    { href: "/student/my-learning", label: "My Learning", icon: HomeIcon },
    { href: "/student/help-complaints", label: "Help", icon: HelpCircleIcon },
    { href: "/student/profile", label: "Account", icon: HomeIcon },
  ];
  return (
    <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-text/10 bg-white/95 px-2 py-2 backdrop-blur md:hidden">
      {items.map((item) => {
        const Icon = item.icon;
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            to={item.href}
            className={`flex min-w-0 flex-col items-center gap-1 rounded-xl px-1 py-1 text-[10px] font-semibold ${
              active ? "text-primary" : "text-text/45"
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
    <div className="relative isolate flex h-screen flex-col overflow-hidden bg-bg">
      <Navbar
        title="Universal Learning"
        navEntries={navEntries}
        notificationsHref="/student/notifications"
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
        <main className={`student-main min-w-0 flex-1 pb-20 md:pb-0 ${isCoursePlayer ? "overflow-hidden" : "overflow-y-auto"}`}>
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
            <SectionShapes visible variant="student" />
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
