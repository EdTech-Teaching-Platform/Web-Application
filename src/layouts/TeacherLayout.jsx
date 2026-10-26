import { useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useSessionRequests } from "../portals/teacher/context/SessionRequestsContext";
import { useTestSeries } from "../context/TestSeriesContext";
import { useCurrentEducator, dismissApprovedNotice, endEducatorSession, EDUCATOR_STATUS } from "../portals/teacher/data/educatorAccountStore";
import EducatorStatusBanner from "../portals/teacher/components/EducatorStatusBanner";
import EducatorApprovalGate from "../portals/teacher/components/EducatorApprovalGate";
import HeaderActions from "../portals/teacher/components/HeaderActions";
import LockedSection from "../components/ui/LockedSection";
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
  { to: "/teacher/testseries", label: "Test Series", icon: QuizIcon, requiresTestSeries: true, excludePrefix: "/teacher/testseries/assigned" },
  // Sub-item: series an admin assigned to this educator; badge = items needing action.
  { to: "/teacher/testseries/assigned", label: "Assigned to me", icon: FlagIcon, requiresTestSeries: true, sub: true, badgeKey: "assigned" },
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
  // Digital ID Card -- always reachable (provisional "Pending Verification"
  // card while under review, the Verified card once approved), so unlike the
  // sections above it is NOT locked behind admin approval.
  { to: "/teacher/profilesetup", label: "Digital ID Card", icon: CertificateIcon },
];

// Paths whose content stays usable while the profile is still under review.
// Notification Preferences is account-level settings (reached from the header
// gear + bell), so it stays usable while the profile is under review.
const ALWAYS_OPEN_PREFIXES = ["/teacher/profilesetup", "/teacher/notificationprefs"];

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
  return `group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-150 ${
    isActive ? "bg-primary text-white shadow-soft" : "text-muted hover:bg-primary/[0.07] hover:text-text"
  }`;
}

export default function TeacherLayout() {
  const { user, logout } = useAuth();
  const account = useCurrentEducator();
  const { pendingCount } = useSessionRequests();
  const { hasAccess: hasTestSeriesAccess, assignedActionCount } = useTestSeries();
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="min-h-screen bg-bg">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-surface px-4 py-5 shadow-card transition-transform duration-200 lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex items-center gap-2.5 px-2 pb-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
            UL
          </span>
          <div>
            <div className="text-sm font-bold leading-tight text-text">Educator Studio</div>
            <div className="eyebrow-muted !text-[10px]">Universal Learning</div>
          </div>
        </div>

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
                <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white" aria-label={`${assignedActionCount} assigned series need action`}>
                  {assignedActionCount}
                </span>
              )}
              {badgeKey === "requests" && pendingCount > 0 && (
                <span className="flex h-5 min-w-[1.25rem] shrink-0 items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">
                  {pendingCount}
                </span>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="mt-4 flex flex-col gap-1 border-t border-line pt-4">
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
      </aside>

      {sidebarOpen && (
        <button
          aria-label="Close menu"
          className="fixed inset-0 z-30 bg-text/30 backdrop-blur-[1px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Main column */}
      <div className="flex min-h-screen flex-col lg:pl-64">
        {/* Top bar */}
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 bg-surface px-5 shadow-soft">
          <button
            aria-label="Open menu"
            onClick={() => setSidebarOpen(true)}
            className="rounded-full p-2 text-muted hover:bg-bg lg:hidden"
          >
            <span className="block h-0.5 w-5 bg-current" />
            <span className="mt-1 block h-0.5 w-5 bg-current" />
            <span className="mt-1 block h-0.5 w-5 bg-current" />
          </button>

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

        <main className="flex-1 px-5 py-6 lg:px-8 lg:py-8">
          <div className="mx-auto w-full max-w-[1280px]">
            <EducatorStatusBanner
              account={account}
              className="mb-6"
              onDismissApproved={() => dismissApprovedNotice(account.id)}
            />
            <LockedSection locked={locked} blur icon={ClockIcon} title={lockCopy.title} reason={lockCopy.reason}>
              <Outlet />
            </LockedSection>
          </div>
        </main>
      </div>
    </div>
  );
}
