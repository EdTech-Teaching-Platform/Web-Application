import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { homePathForUser } from "../../utils/roles";
import brandLogo from "../../assets/brand-logo.png";

// Wrap portal routes that require login + a specific role. Waits for the
// session to be restored (AuthContext.loading) before deciding, so a reload
// never bounces a signed-in user to /login.
// Usage: <Route element={<ProtectedRoute role="student" />}>…</Route>
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    // Blue-tinted backdrop + logo mark, same as the student/landing pages (no old
    // cream/pink flash on refresh).
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6fd] px-6" role="status" aria-label="Restoring your session">
        <div className="flex flex-col items-center gap-5">
          <img src={brandLogo} alt="" aria-hidden="true" draggable={false} className="h-20 w-20 object-contain motion-safe:animate-pulse" />
          <span className="h-1.5 w-28 rounded-full bg-[#dfe6f7] motion-safe:animate-pulse" aria-hidden="true" />
          <span className="sr-only">Restoring your session</span>
        </div>
      </div>
    );
  }
  if (!user) {
    const redirect = `${location.pathname}${location.search}${location.hash}`;
    return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
  }
  if (role && user.role !== role) {
    // A role with no portal of its own (e.g. parent) would loop back here.
    const home = homePathForUser(user);
    return <Navigate to={location.pathname.startsWith(home) ? "/" : home} replace />;
  }

  return children ?? <Outlet />;
}
