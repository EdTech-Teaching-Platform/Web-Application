import { Suspense, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation } from "react-router-dom";
import RouteFallback from "../components/common/RouteFallback";
import { useAuth } from "../hooks/useAuth";
import { homePathForUser } from "../utils/roles";
import { AUTH_THEME_VARS, BrandMark } from "../auth/components/AuthKit";
import { AuthoringPortalContext, EDUCATOR_AUTHORING } from "../portals/admin/context/authoringPortal";
import { useEducatorStatus } from "../portals/teacher/hooks/useEducatorStatus";
import EducatorGateScreen from "../portals/teacher/components/EducatorGateScreen";
import { GATE } from "../portals/teacher/utils/onboarding";
import { HomeIcon, AssignmentIcon, FileTextIcon, PencilIcon, ChartIcon, UsersIcon, LogoutIcon } from "../components/ui/icons";

// Educator Studio chrome (sidebar + top bar) for every /teacher/* page, behind
// the verification gate:
//   not signed in -> /teacher/login; not an educator -> their own home;
//   educator_get_status: draft -> /teacher/onboarding; pending / under review,
//   changes requested, rejected, suspended -> a full-page status screen (no
//   navigation, so typed feature URLs land there too); verified -> the portal.
// Data comes from the educator RPCs and the shared test series RPCs; the
// authoring screens are the admin ones, hosted with EDUCATOR_AUTHORING.
const NAV_ITEMS = [
  { to: "/teacher/dashboard", label: "Dashboard", icon: HomeIcon },
  { to: "/teacher/assigned", label: "Assigned", icon: AssignmentIcon },
  { to: "/teacher/test-series", label: "Test Series", icon: FileTextIcon, end: true },
  { to: "/teacher/test-series/new", label: "Create Test Series", icon: PencilIcon },
  { to: "/teacher/stats", label: "Stats", icon: ChartIcon },
  { to: "/teacher/profile", label: "Profile", icon: UsersIcon },
];

const PAGE_TITLES = [
  ["/teacher/test-series/new", "Create Test Series"],
  ["/teacher/test-series", "Test Series"],
  ["/teacher/assigned", "Assigned"],
  ["/teacher/stats", "Stats"],
  ["/teacher/profile", "Profile"],
  ["/teacher/dashboard", "Dashboard"],
];

function navLinkClass({ isActive }) {
  return `group flex items-center gap-3 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-200 ${
    isActive
      ? "bg-(--lp-ink) text-white shadow-[0_10px_22px_-12px_rgba(15,17,21,0.6)]"
      : "text-(--lp-muted) hover:bg-(--lp-blue-tint) hover:text-(--lp-ink)"
  }`;
}

export default function TeacherLayout() {
  const { user, loading, logout } = useAuth();
  if (loading) return <RouteFallback fullscreen />;
  if (!user) return <Navigate to="/teacher/login" replace />;
  if (user.role !== "teacher") return <Navigate to={homePathForUser(user)} replace />;
  return <EducatorGate user={user} onLogout={() => logout()} />;
}

export function EducatorGate({ user, onLogout, statusApi }) {
  const { status, gate, loading, error, refresh } = useEducatorStatus(statusApi ? { api: statusApi } : undefined);
  if (loading && !status) return <RouteFallback fullscreen />;
  if (gate === GATE.ONBOARDING) return <Navigate to="/teacher/onboarding" replace />;
  if (gate !== GATE.PORTAL) {
    return <EducatorGateScreen gate={gate} status={status} error={error} onRetry={refresh} onLogout={onLogout} />;
  }
  return <PortalShell user={user} onLogout={onLogout} />;
}

function PortalShell({ user, onLogout }) {
  const { pathname } = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const pageTitle = PAGE_TITLES.find(([p]) => pathname.startsWith(p))?.[1] ?? "Dashboard";
  const name = user?.name || "Educator";
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");

  return (
    <div style={AUTH_THEME_VARS} className="relative min-h-screen overflow-x-clip bg-[#f3f6fd] font-body text-(--lp-ink)">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 -z-0 overflow-hidden">
        <div className="absolute -right-24 -top-32 h-[26rem] w-[26rem] rounded-full bg-(--lp-blue)/15 blur-3xl" />
        <div className="absolute -left-20 bottom-0 h-[22rem] w-[22rem] rounded-full bg-(--lp-yellow)/20 blur-3xl" />
      </div>

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col p-3 transition-transform duration-200 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}
        aria-label="Educator navigation"
      >
        <div className="flex h-full flex-col rounded-[1.75rem] bg-white px-3 py-4 shadow-[0_18px_40px_-24px_rgba(15,17,21,0.28)] ring-1 ring-(--lp-line)">
          <div className="flex items-center gap-2.5 px-2 pb-5">
            <BrandMark className="h-10 w-10" />
            <div className="min-w-0">
              <div className="truncate font-(family-name:--lp-font) text-[15px] font-bold leading-tight tracking-tight text-(--lp-ink)">Universal Learning</div>
              <span className="mt-1 inline-flex items-center rounded-full bg-(--lp-yellow) px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-(--lp-ink)">Educator Studio</span>
            </div>
          </div>
          <div className="px-3 pb-2 text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-muted)/70">Menu</div>
          <nav className="flex flex-1 flex-col gap-1 overflow-y-auto">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end} className={navLinkClass} onClick={() => setSidebarOpen(false)}>
                <Icon className="shrink-0" />
                <span className="flex-1 truncate">{label}</span>
              </NavLink>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-1 border-t border-(--lp-line) pt-3">
            <button type="button" className={navLinkClass({ isActive: false })} onClick={onLogout}>
              <LogoutIcon className="shrink-0" />
              Log Out
            </button>
          </div>
        </div>
      </aside>

      {sidebarOpen && (
        <button aria-label="Close menu" className="fixed inset-0 z-30 bg-(--lp-ink)/35 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      <div className="relative z-10 flex min-h-screen flex-col lg:pl-64">
        <div className="sticky top-0 z-20 px-3 pt-3 sm:px-5 lg:px-6">
          <header className="mx-auto flex h-14 w-full max-w-[1280px] items-center gap-3 rounded-full bg-white/80 px-3 shadow-[0_12px_30px_-20px_rgba(15,17,21,0.35)] ring-1 ring-(--lp-line) backdrop-blur-xl sm:px-4">
            <button aria-label="Open menu" onClick={() => setSidebarOpen(true)} className="rounded-full bg-(--lp-grey) p-2.5 text-(--lp-ink) transition-colors hover:bg-(--lp-blue-soft) lg:hidden">
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
            <NavLink to="/teacher/profile" className="ml-auto flex items-center gap-2 rounded-full px-2 py-1 text-sm font-semibold hover:bg-(--lp-blue-tint)" aria-label={`Profile of ${name}`}>
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-(--lp-ink) text-xs font-bold text-white" aria-hidden="true">{initials || "E"}</span>
              <span className="hidden max-w-[10rem] truncate sm:inline">{name}</span>
            </NavLink>
          </header>
        </div>

        <main className="flex-1 px-3 pb-8 pt-5 sm:px-5 lg:px-6 lg:pt-6">
          <div className="mx-auto w-full max-w-[1280px]">
            <AuthoringPortalContext.Provider value={EDUCATOR_AUTHORING}>
              <Suspense fallback={<RouteFallback />}>
                <Outlet />
              </Suspense>
            </AuthoringPortalContext.Provider>
          </div>
        </main>
      </div>
    </div>
  );
}
