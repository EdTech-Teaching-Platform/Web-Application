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
    // Blue-tinted backdrop + logo mark, same as the student/landing pages (no old
    // cream/pink flash on refresh).
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f3f6fd] px-6" role="status" aria-label="Restoring your session">
        <div className="flex flex-col items-center gap-5">
          <span className="relative grid h-14 w-14 place-items-center" aria-hidden="true">
            <span className="absolute inset-0 rounded-full bg-[#3d7bf7]/30 motion-safe:animate-ping" />
            <span className="relative grid h-14 w-14 place-items-center rounded-full bg-[#0f1115]">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-[#3d7bf7] text-white">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                  <path d="M3 8l9-4 9 4-9 4-9-4Z" />
                  <path d="M7 10.5V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-4.5" />
                </svg>
              </span>
            </span>
          </span>
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
