import { Outlet } from "react-router-dom";

// Deliberately unopinionated: Login needs a full-bleed split-screen layout
// (design mockup, Image 1), while Register/Verify/Forgot/Reset use a
// centered card (see src/auth/components/AuthCard.jsx). Forcing one
// wrapper shape here would fight the Login mockup, so each page owns its
// own top-level layout and this just sets the shared page background.
export default function AuthLayout() {
  return (
    <div className="min-h-screen bg-bg font-body text-text">
      <Outlet />
    </div>
  );
}
