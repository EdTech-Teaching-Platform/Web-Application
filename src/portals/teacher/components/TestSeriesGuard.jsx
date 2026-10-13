import { Outlet, NavLink } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import EmptyState from "../../../components/ui/EmptyState";
import { LockIcon } from "../../../components/ui/icons";

// TestSeriesGuard — route-level gate for EVERY /teacher/testseries* route
// (wraps them as a pathless layout route in routes.jsx). The sidebar item is
// already hidden without access; this stops a typed/bookmarked URL too.
// Revoked teachers get a friendly access-denied state rather than a silent
// redirect. Note: revoking blocks the whole section (view included) -- the
// simplest rule consistent with "can't create or edit".
export default function TestSeriesGuard() {
  const { hasAccess } = useTestSeries();
  if (hasAccess) return <Outlet />;
  return (
    <div className="mx-auto max-w-lg pt-10">
      <EmptyState
        icon={LockIcon}
        heading="You don't have access to Test Series"
        message="Creating test series is enabled by an admin. If you think you should have it, ask your admin to grant Test Series creator access."
        action={
          <NavLink
            to="/teacher/dashboard"
            className="inline-flex items-center rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft transition-all duration-150 hover:-translate-y-0.5 hover:shadow-glow-primary"
          >
            Back to dashboard
          </NavLink>
        }
      />
    </div>
  );
}
