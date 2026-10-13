import { Route } from "react-router-dom";
import RHDashboard from "./pages/RHDashboard";
import RHOnboarding from "./pages/RHOnboarding";
import RHStudents from "./pages/RHStudents";
import RHProgress from "./pages/RHProgress";
import RHQueries from "./pages/RHQueries";

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
