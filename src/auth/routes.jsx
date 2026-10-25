import { Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import AuthCallback from "./pages/AuthCallback";
import Terms from "./pages/legal/Terms";
import Privacy from "./pages/legal/Privacy";

// Public auth routes, mounted at root in src/routes/AppRoutes.jsx.
// Real Supabase Auth: Login, Register, Forgot Password, Reset Password.
// Legal pages (/terms and /privacy) are public without auth.
const authRoutes = (
  <>
    <Route path="/login" element={<Login />} />
    <Route path="/teacher/login" element={<Login role="teacher" />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
    <Route path="/auth/callback" element={<AuthCallback />} />
    <Route path="/terms" element={<Terms />} />
    <Route path="/privacy" element={<Privacy />} />
  </>
);

export default authRoutes;
