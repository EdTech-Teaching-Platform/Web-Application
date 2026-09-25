import { Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import OtpVerification from "./pages/OtpVerification";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";

// Public auth routes, mounted at root in src/routes/AppRoutes.jsx.
// /register renders the standalone Sign Up page (Register.jsx), styled as
// a mirror of Login.jsx. On successful submit it hands the user into the
// existing student onboarding wizard (unchanged design/flow) to finish
// their profile and actually create the account — see Register.jsx and
// OnboardingContext.jsx's sessionStorage bridge for how the collected
// name/email/password gets carried over.
//
// /terms and /privacy are the standalone legal pages linked from the
// onboarding Terms step, the Login footer, and Register's Terms checkbox —
// public, no auth required, since users need to be able to read them before
// creating an account.
const authRoutes = (
  <>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/verify-otp" element={<OtpVerification />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
  </>
);

export default authRoutes;
