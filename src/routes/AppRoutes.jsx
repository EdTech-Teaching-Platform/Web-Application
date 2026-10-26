import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import PublicLayout from "../layouts/PublicLayout";
// Portal shells are loaded on demand: a visitor on the landing page or a
// student never downloads the teacher / admin / regional-head code.
const StudentLayout = lazy(() => import("../layouts/StudentLayout"));
const TeacherLayout = lazy(() => import("../layouts/TeacherLayout"));
const AdminLayout = lazy(() => import("../layouts/AdminLayout"));
const RegionalHeadLayout = lazy(() => import("../layouts/RegionalHeadLayout"));
import NotFound from "../components/common/NotFound";
import ProtectedRoute from "../components/common/ProtectedRoute";
import ScrollToTop from "../components/common/ScrollToTop";



import authRoutes from "../auth/routes";
import publicRoutes from "../public/routes";
import studentRoutes, { studentOnboardingRoutes } from "../portals/student/routes";
import teacherRoutes, { teacherRegistrationRoutes } from "../portals/teacher/routes";
import adminRoutes from "../portals/admin/routes";
import regionalHeadRoutes from "../portals/regionalhead/routes";
import RouteFallback from "../components/common/RouteFallback";
const RegionalHeadLogin = lazy(() => import("../portals/regionalhead/pages/RegionalHeadLogin"));
const AdminLogin = lazy(() => import("../portals/admin/pages/AdminLogin"));
const RegionalHeadInvite = lazy(() => import("../portals/admin/pages/RegionalHeadInvite"));

import { SessionRequestsProvider } from "../portals/teacher/context/SessionRequestsContext";

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
      <Suspense fallback={<RouteFallback fullscreen />}>
      <Routes>
        <Route element={<PublicLayout />}>{publicRoutes}</Route>

        <Route element={<AuthLayout />}>{authRoutes}</Route>
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Onboarding is mounted as its own sibling, deliberately OUTSIDE
            StudentLayout, so it renders full-bleed with no sidebar/top-nav. */}
        {studentOnboardingRoutes}
        {teacherRegistrationRoutes}

        <Route element={<ProtectedRoute role="student" />}>
          <Route path="/student" element={<StudentLayout />}>
            {studentRoutes}
          </Route>
        </Route>

        <Route element={<SessionRequestsProvider />}>
          <Route path="/teacher" element={<TeacherLayout />}>
            {teacherRoutes}
          </Route>
        </Route>

        <Route path="/admin" element={<AdminLayout />}>
          {adminRoutes}
        </Route>

        {/* Regional Head portal (still on regionalPortalMock / regionalHeadsMock).
            Login and the invite link (built by regionalHeadsMock as
            /invite/regional-head/:token) sit outside RegionalHeadLayout,
            which redirects anyone who isn't a signed-in Regional Head. */}
        <Route path="/regionalhead/login" element={<RegionalHeadLogin />} />
        <Route path="/invite/regional-head/:token" element={<RegionalHeadInvite />} />
        <Route path="/regionalhead" element={<RegionalHeadLayout />}>
          {regionalHeadRoutes}
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
      </Suspense>
    </>
  );
}
