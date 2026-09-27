import { Routes, Route } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import PublicLayout from "../layouts/PublicLayout";
import StudentLayout from "../layouts/StudentLayout";
import TeacherLayout from "../layouts/TeacherLayout";
import AdminLayout from "../layouts/AdminLayout";
import NotFound from "../components/common/NotFound";
import ProtectedRoute from "../components/common/ProtectedRoute";
import ScrollToTop from "../components/common/ScrollToTop";


import authRoutes from "../auth/routes";
import publicRoutes from "../public/routes";
import studentRoutes, { studentOnboardingRoutes } from "../portals/student/routes";
import teacherRoutes from "../portals/teacher/routes";
import adminRoutes from "../portals/admin/routes";
import AdminLogin from "../portals/admin/pages/AdminLogin";

// This is the ONLY file that wires all three portals together.
// Each portal owner should only need to touch their own routes.jsx —
// not this file — when adding a new screen.
//
// PublicLayout + src/public/routes.jsx (Landing "/", Explore "/explore")
// is a new top-level layout, added per the Discovery build spec: visitors
// who aren't logged in and haven't picked a portal yet need somewhere to
// land, and none of the existing {auth,student,teacher,admin} layouts fit
// that. "/" now renders the Landing page directly instead of redirecting
// to /login.
export default function AppRoutes() {
  return (
    <>
      <ScrollToTop />
      <Routes>
        <Route element={<PublicLayout />}>{publicRoutes}</Route>

        <Route element={<AuthLayout />}>{authRoutes}</Route>
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Onboarding is mounted as its own sibling, deliberately OUTSIDE
            StudentLayout, so it renders full-bleed with no sidebar/top-nav. */}
        {studentOnboardingRoutes}

        <Route element={<ProtectedRoute role="student" />}>
          <Route path="/student" element={<StudentLayout />}>
            {studentRoutes}
          </Route>
        </Route>

        <Route path="/teacher" element={<TeacherLayout />}>
          {teacherRoutes}
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          {adminRoutes}
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </>
  );
}
