import { Route, Navigate } from "react-router-dom";
import Login from "./pages/Login";
import OtpVerification from "./pages/OtpVerification";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";

// Public auth routes, mounted at root in src/routes/AppRoutes.jsx.
// /register is gone as a standalone screen — Student sign-up now happens
// inside the Onboarding wizard (src/portals/student/pages/Onboarding.jsx),
// whose Basics step absorbed the old Register form's fields. This redirect
// exists only so an old /register link doesn't 404.
//
// /terms and /privacy are the standalone legal pages linked from the
// onboarding Terms step, the Login footer, and Register's Terms checkbox —
// public, no auth required, since users need to be able to read them before
// creating an account.
const authRoutes = (
  <>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Navigate to="/student/onboarding" replace />} />
    <Route path="/verify-otp" element={<OtpVerification />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
  </>
);

export default authRoutes;
