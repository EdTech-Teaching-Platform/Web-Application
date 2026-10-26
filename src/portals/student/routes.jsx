import { lazy } from "react";
import { Navigate, Route, useLocation, useParams } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";
const Dashboard = lazy(() => import("./pages/Dashboard"));
const SeriesList = lazy(() => import("./pages/SeriesList"));
const SeriesDetail = lazy(() => import("./pages/SeriesDetail"));
const TestIntro = lazy(() => import("./pages/TestIntro"));
const TestRunner = lazy(() => import("./pages/TestRunner"));
const TestReport = lazy(() => import("./pages/TestReport"));
const History = lazy(() => import("./pages/History"));
const MyTests = lazy(() => import("./pages/MyTests"));
const Account = lazy(() => import("./pages/Account"));
const ComingSoon = lazy(() => import("./pages/ComingSoon"));
const StudentOnboarding = lazy(() => import("./pages/StudentOnboarding"));
import { homePathForUser } from "../../utils/roles";

// The student portal is test series only for now. Course discovery (Explore,
// course details, live / recorded classes) and the other mock-backed screens
// are unmounted: their files are kept, their routes redirect to the test
// series list or show ComingSoon. See docs/ADMIN_BACKEND_TODO.md.

// Keeps a search (?q= or ?search=) when redirecting old discovery URLs.
export function ToSeriesList() {
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const q = params.get("q") || params.get("search") || params.get("category") || "";
  return <Navigate to={`/student/test-series${q ? `?q=${encodeURIComponent(q)}` : ""}`} replace />;
}

function ToSeriesDetail() {
  const { seriesId } = useParams();
  return <Navigate to={`/student/test-series/${seriesId}`} replace />;
}

// The old multi-step sign-up wizard created demo accounts and stays retired:
// real sign-up is /register. /student/onboarding is now the short profile
// wizard students see after their first Google sign-in (see
// auth/pages/AuthCallback.jsx); it only saves profile details. Signed-out
// visitors still go to /register and other roles to their own home.
function OnboardingEntry() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/register" replace />;
  if (user.role !== "student") return <Navigate to={homePathForUser(user)} replace />;
  return <StudentOnboarding />;
}

export const studentOnboardingRoutes = (
  <Route path="/student/onboarding/*" element={<OnboardingEntry />} />
);

const COMING_SOON = [
  ["messages", "Messages"],
  ["notifications", "Notifications"],
  ["certificates", "Certificates"],
  ["orders", "Payments"],
  ["help-complaints", "Help & complaints"],
  ["help-complaints/:ticketId", "Help & complaints"],
  ["calendar", "Calendar"],
  ["booksession", "Booking a session"],
  ["managebooking", "Bookings"],
  ["liveclassjoin", "Live classes"],
  ["live-course", "Live classes"],
  ["liveclassrating", "Live classes"],
  ["recordings", "Recordings"],
  ["live-recording", "Recordings"],
  ["attendance", "Attendance"],
  ["quiz", "Course quizzes"],
  ["assignmentsubmit", "Assignments"],
  ["reviews", "Reviews"],
  ["notes", "Notes"],
];

// Old routes that now point at the test-series screens.
const TO_LIST = [
  "explore", "live-classes", "recorded-classes", "course/:courseId", "coursedetails", "my-learning",
  "recommended", "searchresults", "educatorprofile", "landing", "wishlist", "checkout", "paymentresult",
  "courseplayer", "resourceviewer", "assessments/test-series", "assessments/test-series/:assessmentId",
  "assessments/course-quizzes", "assessments/skill-assessments", "assessments/take/:assessmentId",
];
const TO_HISTORY = ["learninghistory", "progresstracking", "assessments/my-results", "assessments/results/:attemptId",
  "assessments/results/:attemptId/review"];

// Mounted at /student/* inside StudentLayout (behind ProtectedRoute role="student").
const studentRoutes = (
  <>
    <Route index element={<Navigate to="dashboard" replace />} />
    <Route path="dashboard" element={<Dashboard />} />
    <Route path="test-series" element={<SeriesList />} />
    <Route path="test-series/:seriesId" element={<SeriesDetail />} />
    <Route path="my-tests/:seriesId" element={<SeriesDetail from="mine" />} />
    <Route path="dashboard/series/:seriesId" element={<SeriesDetail from="dashboard" />} />
    <Route path="test-series/:seriesId/checkout" element={<ToSeriesDetail />} />
    <Route path="test/:testId" element={<TestIntro />} />
    <Route path="test/:testId/take" element={<TestRunner />} />
    <Route path="report/:attemptId" element={<TestReport />} />
    <Route path="history" element={<History />} />
    <Route path="my-tests" element={<MyTests />} />
    <Route path="account" element={<Account />} />
    <Route path="profile" element={<Navigate to="/student/account" replace />} />
    {TO_LIST.map((path) => <Route key={path} path={path} element={<ToSeriesList />} />)}
    {TO_HISTORY.map((path) => <Route key={path} path={path} element={<Navigate to="/student/history" replace />} />)}
    {COMING_SOON.map(([path, title]) => <Route key={path} path={path} element={<ComingSoon title={title} />} />)}
  </>
);

export default studentRoutes;
