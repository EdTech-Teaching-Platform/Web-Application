import { Suspense, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import RouteFallback from "../components/common/RouteFallback";
import { useAuth } from "../hooks/useAuth";
import { useSessionRequests } from "../portals/teacher/context/SessionRequestsContext";
import { useTestSeries } from "../context/TestSeriesContext";
import { useCurrentEducator, dismissApprovedNotice, endEducatorSession, EDUCATOR_STATUS } from "../portals/teacher/data/educatorAccountStore";
import EducatorStatusBanner from "../portals/teacher/components/EducatorStatusBanner";
import EducatorApprovalGate from "../portals/teacher/components/EducatorApprovalGate";
import HeaderActions from "../portals/teacher/components/HeaderActions";
import LockedSection from "../components/ui/LockedSection";
import { AUTH_THEME_VARS, BrandMark } from "../auth/components/AuthKit";
import {
  HomeIcon,
  BookIcon,
  VideoIcon,
  UsersIcon,
  MentorIcon,
  WalletIcon,
  ChartIcon,
  MegaphoneIcon,
  CalendarIcon,
  SearchIcon,
  HelpIcon,
  LogoutIcon,
  QuizIcon,
  FlagIcon,
  CertificateIcon,
  ClockIcon,
  PencilIcon,
  FileTextIcon,
  AssignmentIcon,
  CreditCardIcon,
} from "../components/ui/icons";

// Educator Studio chrome — sidebar + top bar shared by every /teacher/* page.
// Custom-built for this portal (rather than the generic Sidebar/Navbar
// shells in src/components/common) because the educator nav set, active
// styling and top-bar actions are portal-specific; other portals keep using
// the generic shells until their own chrome needs the same treatment.
// Most portal sections are temporarily hidden while Test Series is developed.
const NAV_ITEMS = [
  { to: "/teacher/dashboard", label: "Dashboard", icon: HomeIcon },
  // TEMP-HIDDEN: { to: "/teacher/mycourses", label: "My Courses", icon: BookIcon },
  // Test Series -- only rendered when an admin has granted creator access
  // (filtered out below, so it is hidden entirely, not disabled).
  { to: "/teacher/testseries", label: "Test Series", icon: FileTextIcon, requiresTestSeries: true, excludePrefix: "/teacher/testseries/assigned" },
  // Series an admin assigned to this educator; badge = items needing action.
  { to: "/teacher/testseries/assigned", label: "Assigned to me", icon: AssignmentIcon, requiresTestSeries: true, badgeKey: "assigned" },
  // TEMP-HIDDEN: { to: "/teacher/liveclasses", label: "Live Classes", icon: VideoIcon },
  // TEMP-HIDDEN: { to: "/teacher/messaging", label: "Announcements", icon: MegaphoneIcon },
  // TEMP-HIDDEN: { to: "/teacher/studentmanagement", label: "Student Management", icon: UsersIcon },
  // TEMP-HIDDEN: { to: "/teacher/mentorshiphub", label: "Mentorship Hub", icon: MentorIcon },
  // Requests (Part 5) — pending count badge is filled in at render time
  // below (SessionRequestsProvider wraps this whole layout, so the count
  // is always live here, no matter which /teacher/* page is open).
  // TEMP-HIDDEN: { to: "/teacher/requests", label: "Requests", icon: CalendarIcon, badgeKey: "requests" },
  // TEMP-HIDDEN: { to: "/teacher/earnings", label: "Revenue", icon: WalletIcon },
  // TEMP-HIDDEN: { to: "/teacher/analytics", label: "Analytics", icon: ChartIcon },
  // Earnings -- per-test-series revenue and enrollment tracking.
  { to: "/teacher/earnings", label: "Earnings", icon: WalletIcon, requiresTestSeries: true },
  // Digital ID Card -- always reachable (provisional "Pending Verification"
  // card while under review, the Verified card once approved), so unlike the
  // sections above it is NOT locked behind admin approval.
  { to: "/teacher/profilesetup", label: "Digital ID Card", icon: CreditCardIcon },
  // Edit profile -- all onboarding details, editable after sign-up.
  { to: "/teacher/editprofile", label: "Edit profile", icon: PencilIcon },
];

// Paths whose content stays usable while the profile is still under review.
// Notification Preferences is account-level settings (reached from the header
// gear + bell), so it stays usable while the profile is under review.
const ALWAYS_OPEN_PREFIXES = ["/teacher/profilesetup", "/teacher/editprofile", "/teacher/notificationprefs"];

// Calm, reassuring copy for the lock chip, per verification status.
const LOCK_COPY = {
  pending: {
    title: "Available once you're approved",
    reason: "This section unlocks as soon as our team finishes verifying your profile. Nothing is wrong — it's a normal step.",
  },
  changes_requested: {
    title: "Waiting on your updates",
    reason: "Update your profile with the requested changes and resubmit — this section unlocks once it's approved.",
  },
  rejected: {
    title: "Not available yet",
    reason: "This section unlocks once an updated profile is approved. See the note above for what to fix.",
  },
};

function navLinkClass({ isActive }) {
  return `group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
    isActive
      ? "bg-(--lp-ink) text-white shadow-[0_10px_22px_-12px_rgba(15,17,21,0.6)]"
      : "text-(--lp-muted) hover:bg-(--lp-blue-tint) hover:text-(--lp-ink)"
  }`;
}

const PAGE_TITLES = [
  ["/teacher/testseries/assigned", "Assigned to me"],
  ["/teacher/testseries", "Test Series"],
  ["/teacher/profilesetup", "Digital ID Card"],
  ["/teacher/editprofile", "Edit profile"],
  ["/teacher/notificationprefs", "Notifications"],
  ["/teacher/earnings", "Earnings"],
  ["/teacher/grading", "Grading"],
  ["/teacher/dashboard", "Dashboard"],
];

export default function TeacherLayout() {
  const { user, logout } = useAuth();
  const account = useCurrentEducator();
  const { pendingCount } = useSessionRequests();
  const { hasAccess: hasTestSeriesAccess, assignedActionCount } = useTestSeries();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle = PAGE_TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "Dashboard";
  const name = account?.profile?.fullName || user?.name || "Educator";
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

  // No educator signed in -> back to login. (The portal shell is shown to
  // every signed-in educator, pending or not; only CONTENT is locked below.)
  if (!account) return <Navigate to="/teacher/login" replace />;

  // Not approved yet (pending / changes requested / rejected): no dashboard.
  // The gate screen explains the status; approval re-renders this straight
  // into the portal.
  if (account.status !== EDUCATOR_STATUS.APPROVED) {
    return <EducatorApprovalGate account={account} onLogout={() => { endEducatorSession(); logout(); }} />;
  }

  // The single verification-status check for the whole portal: every screen
  // rendered through <Outlet/> is locked/unlocked here, not per screen.
  const locked =
    account.status !== EDUCATOR_STATUS.APPROVED && !ALWAYS_OPEN_PREFIXES.some((p) => pathname.startsWith(p));
  const lockCopy = LOCK_COPY[account.status] ?? LOCK_COPY.pending;

  return (
    <div style={AUTH_THEME_VARS} className="relative min-h-screen overflow-x-clip bg-[#f3f6fd] font-body text-(--lp-ink)">
      {/* Soft ambient glow behind the portal, purely decorative */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-(--lp-blue)/15 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-[22rem] w-[22rem] rounded-full bg-(--lp-yellow)/20 blur-3xl" />
      </div>

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col p-3 transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-full flex-col rounded-[1.75rem] bg-white px-3 py-4 shadow-[0_18px_40px_-24px_rgba(15,17,21,0.28)] ring-1 ring-(--lp-line)">
          <div className="flex items-center gap-2.5 px-2 pb-5">
            <BrandMark className="h-10 w-10" />
            <div className="min-w-0">
              <div className="truncate font-(family-name:--lp-font) text-[15px] font-bold leading-tight tracking-tight text-(--lp-ink)">Universal Learning</div>
              <span className="mt-1 inline-flex items-center rounded-full bg-(--lp-yellow) px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-(--lp-ink)">
                Educator Studio
              </span>
            </div>
          </div>

          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)/70">Menu</div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {NAV_ITEMS.filter((item) => !item.requiresTestSeries || hasTestSeriesAccess).map(({ to, label, icon: Icon, badgeKey, sub, excludePrefix }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `${navLinkClass({ isActive: isActive && !(excludePrefix && pathname.startsWith(excludePrefix)) })}${sub ? " ml-5 !py-2 !text-[13px]" : ""}`
                }
                onClick={() => setSidebarOpen(false)}
              >
                <Icon className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
                {badgeKey === "assigned" && assignedActionCount > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-(--lp-yellow) px-1.5 text-[10px] font-bold text-(--lp-ink)" aria-label={`${assignedActionCount} assigned series need action`}>
                    {assignedActionCount}
                  </span>
                )}
                {badgeKey === "requests" && pendingCount > 0 && (
                  <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-(--lp-yellow) px-1.5 text-[10px] font-bold text-(--lp-ink)">
                    {pendingCount}
                  </span>
                )}
              </NavLink>
            ))}
          </nav>

          <div className="mt-3 flex flex-col gap-1 border-t border-(--lp-line) pt-3">
            {/* TEMP-HIDDEN: Help Center (-> hidden /teacher/notificationprefs)
            <NavLink to="/teacher/notificationprefs" className={navLinkClass}>
              <HelpIcon className="shrink-0" />
              Help Center
            </NavLink>
            */}
            <NavLink to="/teacher/login" className={navLinkClass} onClick={() => { endEducatorSession(); logout(); }}>
              <LogoutIcon className="shrink-0" />
              Log Out
            </NavLink>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-(--lp-ink)/35 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="relative z-10 flex min-h-screen flex-col lg:pl-64">
        {/* Floating glass top bar */}
        <div className="sticky top-0 z-20 px-3 pt-3 sm:px-5 lg:px-6">
          <header className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-3 rounded-full bg-white/80 px-3 shadow-[0_12px_30px_-20px_rgba(15,17,21,0.35)] ring-1 ring-(--lp-line) backdrop-blur-xl sm:px-4">
            <button
              aria-label="Open menu"
              onClick={() => setSidebarOpen(true)}
              className="rounded-full bg-(--lp-grey) p-2.5 text-(--lp-ink) transition-colors hover:bg-(--lp-blue-soft) lg:hidden"
            >
              <span className="block h-0.5 w-4 bg-current" />
              <span className="mt-1 block h-0.5 w-4 bg-current" />
              <span className="mt-1 block h-0.5 w-4 bg-current" />
            </button>
            <div className="flex min-w-0 items-center gap-2.5">
              <BrandMark className="h-8 w-8 lg:hidden" />
              <div className="min-w-0">
                <div className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)">Educator Studio</div>
                <div className="truncate font-(family-name:--lp-font) text-[15px] font-bold leading-tight tracking-tight text-(--lp-ink)">{pageTitle}</div>
              </div>
            </div>

            {/* TEMP-HIDDEN: global header search (searches courses/students/sessions, all currently hidden).
                Restore by deleting this comment wrapper. HeaderActions stays right-aligned via ml-auto, so no layout change is needed.
            <div className="relative hidden max-w-sm flex-1 sm:block">
              <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
              <input
                type="text"
                placeholder="Search courses, students, sessions…"
                className="w-full rounded-full border border-line bg-bg py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-muted/80 outline-none transition-colors focus:border-primary/40 focus:bg-surface"
              />
            </div>
            */}

            <HeaderActions account={account} initials={initials} />
          </header>
        </div>

        <main className="flex-1 px-3 pb-8 pt-5 sm:px-5 lg:px-6 lg:pt-6">
          <div className="mx-auto w-full max-w-[1280px]">
            <EducatorStatusBanner
              account={account}
              className="mb-6"
              onDismissApproved={() => dismissApprovedNotice(account.id)}
            />
            <LockedSection locked={locked} blur icon={ClockIcon} title={lockCopy.title} reason={lockCopy.reason}>
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </LockedSection>
          </div>
        </main>
      </div>
    </div>
  );
}
