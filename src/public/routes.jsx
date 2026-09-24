import { Route } from "react-router-dom";
import LandingPage from "./pages/LandingPage";
import ExplorePage from "./pages/ExplorePage";
import InstructorsPage from "./pages/InstructorsPage";
import CourseDetails from "../portals/student/pages/CourseDetails";
import EducatorProfile from "../portals/student/pages/EducatorProfile";

// Public/pre-portal routes — mounted under PublicLayout in
// src/routes/AppRoutes.jsx. Parallel to src/auth/routes.jsx. Per Section
// 4.3's "How It Works" text, visitors who aren't registered can browse
// these freely; only enroll/wishlist actions gate on auth (redirect to
// /login), handled inside ExplorePage/CourseDetails itself rather than at
// the route level, since the page is otherwise open to everyone.
//
// /educator mounts the same EducatorProfile component already used at
// /student/educatorprofile (kept there too for the logged-in student
// portal's own nav), same pattern as CourseDetails above: Section 5.3's
// "Educator Public Profile" is a Discovery/browse feature, so an
// anonymous visitor clicking "View Profile" from Landing/Explore/
// Instructors must not be bounced to /login the way the student-portal
// route (behind ProtectedRoute role="student") would do.
const publicRoutes = (
  <>
    <Route path="/" element={<LandingPage />} />
    <Route path="/explore" element={<ExplorePage />} />
    <Route path="/instructors" element={<InstructorsPage />} />
    <Route path="/course/:courseId" element={<CourseDetails />} />
    <Route path="/educator" element={<EducatorProfile />} />
  </>
);

export default publicRoutes;
