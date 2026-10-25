import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
import { homePathForUser } from "../../utils/roles";

// Wrap portal routes that require login + a specific role. Waits for the
// session to be restored (AuthContext.loading) before deciding, so a reload
// never bounces a signed-in user to /login.
// Usage: <Route element={<ProtectedRoute role="student" />}>…</Route>
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-sm space-y-3" role="status" aria-label="Restoring your session">
          <div className="h-3 w-32 animate-pulse rounded-full bg-text/10" />
          <div className="h-10 w-full animate-pulse rounded-2xl bg-text/10" />
          <div className="h-3 w-48 animate-pulse rounded-full bg-text/10" />
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
