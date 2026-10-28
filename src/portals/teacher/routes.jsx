import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";

// Teacher portal (verified educators), mounted at /teacher/* inside
// TeacherLayout, which runs the verification gate first. Everything comes
// from the educator RPCs (docs/EDUCATOR_RPC_CONTRACT.md); the test series
// screens are the admin ones (wizard, series manage view, question builder),
// hosted with EDUCATOR_AUTHORING by TeacherLayout.
//
// The earlier mock-data screens (courses, live classes, messaging, earnings,
// the old Test Series pages, Registration / ProfileSetup / EditProfile, ...)
// are no longer mounted; their files are kept. Old URLs redirect below.
const EducatorDashboard = lazy(() => import("./pages/EducatorDashboard"));
const AssignmentList = lazy(() => import("./pages/AssignedWork").then((m) => ({ default: m.AssignmentList })));
const AssignmentDetail = lazy(() => import("./pages/AssignedWork").then((m) => ({ default: m.AssignmentDetail })));
const EducatorTestSeries = lazy(() => import("./pages/EducatorTestSeries"));
const EducatorStats = lazy(() => import("./pages/EducatorStats"));
const EducatorProfilePage = lazy(() => import("./pages/EducatorProfilePage"));
const EducatorOnboarding = lazy(() => import("./pages/EducatorOnboarding"));
const TestSeriesWizard = lazy(() => import("../admin/pages/TestSeriesWizard"));
const TestSeriesDetail = lazy(() => import("../admin/pages/TestSeriesDetail"));
const TestDetail = lazy(() => import("../admin/pages/TestDetail"));

// Full-page routes outside TeacherLayout (no portal chrome). Registration is
// /teacher/register (src/auth/routes.jsx).
export const teacherRegistrationRoutes = (
  <>
    <Route path="/teacher/onboarding" element={<EducatorOnboarding />} />
    <Route path="/teacher/registration" element={<Navigate to="/teacher/register" replace />} />
  </>
);

const teacherRoutes = (
  <>
    <Route path="dashboard" element={<EducatorDashboard />} />
    <Route path="assigned" element={<AssignmentList />} />
    <Route path="assigned/:assignmentId" element={<AssignmentDetail />} />
    <Route path="test-series" element={<EducatorTestSeries />} />
    <Route path="test-series/new" element={<TestSeriesWizard />} />
    <Route path="test-series/:seriesId" element={<TestSeriesDetail />} />
    <Route path="test-series/:seriesId/tests/:testId" element={<TestDetail />} />
    <Route path="stats" element={<EducatorStats />} />
    <Route path="profile" element={<EducatorProfilePage />} />

    {/* old URLs */}
    <Route path="testseries/*" element={<Navigate to="/teacher/test-series" replace />} />
    <Route path="profilesetup" element={<Navigate to="/teacher/profile" replace />} />
    <Route path="editprofile" element={<Navigate to="/teacher/profile" replace />} />
    <Route index element={<Navigate to="/teacher/dashboard" replace />} />
    <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
  </>
);

export default teacherRoutes;
