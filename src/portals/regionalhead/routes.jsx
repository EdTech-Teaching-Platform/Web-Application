import { lazy } from "react";
import { Route } from "react-router-dom";
const RHDashboard = lazy(() => import("./pages/RHDashboard"));
const RHOnboarding = lazy(() => import("./pages/RHOnboarding"));
const RHStudents = lazy(() => import("./pages/RHStudents"));
const RHProgress = lazy(() => import("./pages/RHProgress"));
const RHQueries = lazy(() => import("./pages/RHQueries"));

// Mounted at /regionalhead/* (inside RegionalHeadLayout) by src/routes/AppRoutes.jsx
const regionalHeadRoutes = (
  <>
    <Route index element={<RHDashboard />} />
    <Route path="onboarding" element={<RHOnboarding />} />
    <Route path="students" element={<RHStudents />} />
    <Route path="progress" element={<RHProgress />} />
    <Route path="queries" element={<RHQueries />} />
  </>
);
export default regionalHeadRoutes;
