import { useEffect, useState } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../hooks/useAuth";
import { useAdminTheme } from "../portals/admin/hooks/useAdminTheme";
import AdminSidebar from "../portals/admin/components/AdminSidebar";
import AdminTopbar from "../portals/admin/components/AdminTopbar";
import "../portals/admin/adminTheme.css";
import "../portals/admin/components/AdminChrome.css";

// Guards every /admin/* route: mirrors ProtectedRoute's logic inline so we
// don't need to touch AppRoutes.jsx / portals/admin/routes.jsx (per the
// project README, portal work shouldn't require editing those files).
export default function AdminLayout() {
  const { user } = useAuth();
  const location = useLocation();
  const theme = useAdminTheme();
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
    <div className="ul-shell" data-theme={theme}>
      <AdminSidebar open={mobileNavOpen} onClose={() => setMobileNavOpen(false)} />
      <div className="ul-main-wrap">
        {isDashboard && <AdminTopbar onMenuClick={() => setMobileNavOpen(true)} />}
        <main className="ul-main">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
