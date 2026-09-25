import { Link, Outlet, useLocation } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import {
  AwardIcon,
  ClockIcon,
  ChatIcon,
  CompassIcon,
  FileTextIcon,
  HeartIcon,
  HomeIcon,
  SearchIcon,
  WalletIcon,
} from "../components/ui/icons";
import { useAuth } from "../hooks/useAuth";
import StudentErrorBoundary from "../components/common/StudentErrorBoundary";
import AmbientPortalBackdrop from "../components/common/AmbientPortalBackdrop";

const groups = [
  {
    label: "Learn",
    items: [
      { href: "/student/dashboard", label: "Dashboard", icon: HomeIcon },
      { href: "/student/explore", label: "Explore", icon: CompassIcon },
      { href: "/student/my-learning", label: "My Learning", icon: HomeIcon },
      { href: "/student/live-classes", label: "Live Classes", icon: ClockIcon },
    ],
  },
  {
    label: "Practice",
    items: [
      { href: "/student/assessments", label: "Assessments", icon: FileTextIcon },
      { href: "/student/calendar", label: "Calendar", icon: ClockIcon },
      { href: "/student/messages", label: "Discussions", icon: ChatIcon },
    ],
  },
  {
    label: "Achievements",
    items: [
      { href: "/student/wishlist", label: "Wishlist", icon: HeartIcon },
      { href: "/student/certificates", label: "Certificates", icon: AwardIcon },
      { href: "/student/learninghistory", label: "Learning History", icon: SearchIcon },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/student/orders", label: "My Payments", icon: WalletIcon },
      { href: "/student/profile", label: "Profile", icon: HomeIcon },
    ],
  },
];

const sidebarItems = groups.flatMap((group) => group.items);

// What actually sits directly in the top bar (Navbar's `navItems`) —
// Dashboard now gets its own explicit link (previously only reachable via
// the logo) plus the two most-used destinations beyond it. Everything else
// lives in the grouped "Menu" dropdown below instead of its own row of a
// dozen items.
const topNavItems = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/explore", label: "Explore" },
  { href: "/student/my-learning", label: "My Learning" },
];

// Same four categories as `groups` above, minus the three destinations
// already reachable directly (logo → Dashboard, plus the two links in
// topNavItems) so nothing is listed twice.
const menuGroups = [
  { label: "Learn", items: [{ href: "/student/live-classes", label: "Live Classes" }, { href: "/student/explore?mode=recorded", label: "Recorded Classes" }] },
  {
    label: "Practice",
    items: [
      { href: "/student/assessments", label: "Assessments" },
      { href: "/student/calendar", label: "Calendar" },
      { href: "/student/messages", label: "Discussions" },
    ],
  },
  {
    label: "Achievements",
    items: [
      { href: "/student/wishlist", label: "Wishlist" },
      { href: "/student/certificates", label: "Certificates" },
      { href: "/student/learninghistory", label: "Learning History" },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/student/orders", label: "My Payments" },
      { href: "/student/profile", label: "Profile" },
    ],
  },
];

function MobileNav() {
  const { pathname } = useLocation();
  const items = sidebarItems.slice(0, 5);
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
    <div className="relative flex h-screen flex-col overflow-hidden bg-bg">
      <Navbar
        title="Universal Learning"
        navItems={topNavItems}
        navGroups={menuGroups}
        notificationsHref="/student/notifications"
        onSignOut={logout}
        user={user}
      />
      <AmbientPortalBackdrop />
      <div className="relative z-10 flex min-h-0 flex-1">
        {/* No global "Back" button here on purpose — it used to show on
            every page except Dashboard, which put it on plain sidebar
            destinations (My Learning, Explore, Profile, etc.) where
            there's nothing to go "back" from. Pages reached by drilling
            into something else (a course, a live session, a booking)
            render their own BackButton / contextual "Back to X" action
            instead, scoped to where that specific page was entered from. */}
        <main className={`student-main min-w-0 flex-1 pb-20 md:pb-0 ${isCoursePlayer ? "overflow-hidden" : "overflow-y-auto"}`}>
          <StudentErrorBoundary key={`${location.pathname}${location.search}`}>
            <Outlet />
          </StudentErrorBoundary>
        </main>
      </div>
      <MobileNav />
    </div>
  );
}
