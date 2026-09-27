import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

// Wrap portal routes that require login + a specific role.
// Usage: <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
export default function ProtectedRoute({ role, children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg px-6">
        <div className="w-full max-w-sm space-y-3" aria-label="Restoring your session">
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
  if (role && user.role !== role) return <Navigate to={user.role === "student" ? "/student/dashboard" : "/"} replace />;

  return children ?? <Outlet />;
}
