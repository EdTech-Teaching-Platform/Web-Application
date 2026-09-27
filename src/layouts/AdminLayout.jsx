import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import AdminSidebar from "../portals/admin/components/AdminSidebar";
import AdminTopbar from "../portals/admin/components/AdminTopbar";
import {
  IconBook,
  IconLightbulb,
  IconPencil,
  IconGlobe,
  IconGraduationCap,
  IconChart,
  IconCalculator,
  IconAtom,
} from "../portals/admin/components/icons";
import "../portals/admin/adminTheme.css";
import "../portals/admin/components/AdminChrome.css";

// Faint drifting line icons behind every /admin/* page's content —
// rendered once here (shared layout) rather than per-page, positioned
// toward the margins so they read as ambient texture in the gaps
// around cards instead of ever competing with page content.
const DASHBOARD_BG_ICONS = [
  { Icon: IconBook, size: 30, top: "8%", left: "30%", duration: 17, delay: 0 },
  { Icon: IconLightbulb, size: 26, top: "70%", left: "4%", duration: 18, delay: 1.1 },
  { Icon: IconPencil, size: 26, top: "40%", left: "96%", duration: 16, delay: 0.6 },
  { Icon: IconGlobe, size: 30, top: "85%", left: "60%", duration: 19, delay: 1.6 },
  { Icon: IconGraduationCap, size: 30, top: "14%", left: "94%", duration: 18, delay: 0.4 },
  { Icon: IconChart, size: 26, top: "60%", left: "40%", duration: 17, delay: 1.4 },
  { Icon: IconCalculator, size: 25, top: "90%", left: "20%", duration: 20, delay: 0.9 },
  { Icon: IconAtom, size: 24, top: "24%", left: "6%", duration: 18, delay: 1.9 },
];

function DashboardFloatingIcons() {
  return (
    <div className="ul-main-wrap__floating-icons" aria-hidden="true">
      {DASHBOARD_BG_ICONS.map(({ Icon, size, top, left, duration, delay }, i) => (
        <span
          key={i}
          className="ul-main-wrap__float-icon"
          style={{ top, left, animationDuration: `${duration}s`, animationDelay: `${delay}s` }}
        >
          <Icon size={size} />
        </span>
      ))}
    </div>
  );
}

// Guards every /admin/* route: mirrors ProtectedRoute's logic inline so we
// don't need to touch AppRoutes.jsx / portals/admin/routes.jsx (per the
// project README, portal work shouldn't require editing those files).
export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  // Mobile-only slide-in drawer state for AdminSidebar (see AdminChrome.css
  // — hidden off-canvas below 900px, opened via the hamburger in AdminTopbar).
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Whenever the route changes: close the mobile drawer (e.g. after
  // tapping a nav link on a phone) and reset scroll to the top, so every
  // Admin page always opens at (0, 0) instead of inheriting wherever the
  // previous page happened to be scrolled to.
  useEffect(() => {
    setMobileNavOpen(false);
    window.scrollTo(0, 0);
  }, [location.pathname]);

  if (!user) {
    return <Navigate to="/login" replace />;
  }
  if (user.role !== "admin") {
    return <Navigate to="/" replace />;
  }

  // The search bar + notification/security/theme icons only make sense as
  // a "what needs my attention right now" strip on the Dashboard itself —
  // every other Admin page hides it entirely (not just visually: it isn't
  // rendered at all, so it reserves no vertical space and content starts
  // right at the top).
  const isDashboard = location.pathname === "/admin/logindashboard";

  return (
    <div className="ul-shell">
      <AdminSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="ul-main-wrap">
        <DashboardFloatingIcons />
        {isDashboard && <AdminTopbar onMenuClick={() => setMobileNavOpen(true)} />}
        <main className="ul-main">
          {/* key={pathname} forces this wrapper to remount on every route
              change, replaying its slide-in animation each time — most
              noticeably the very first hop from Login straight into the
              Dashboard. */}
          <div className="ul-main__page" key={location.pathname}>
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
