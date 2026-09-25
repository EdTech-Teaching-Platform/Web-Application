import { Outlet, Route, Navigate } from "react-router-dom";
import { OnboardingProvider } from "./context/OnboardingContext";
import OnboardingBasics from "./pages/onboarding/OnboardingBasics";
import OnboardingDetails from "./pages/onboarding/OnboardingDetails";
import OnboardingInterests from "./pages/onboarding/OnboardingInterests";
import Dashboard from "./pages/Dashboard";
import Landing from "./pages/Landing";
import SearchResults from "./pages/SearchResults";
import EducatorProfile from "./pages/EducatorProfile";
import CourseDetails from "./pages/CourseDetails";
import Wishlist from "./pages/Wishlist";
import Checkout from "./pages/Checkout";
import PaymentResult from "./pages/PaymentResult";
import CoursePlayer from "./pages/CoursePlayer";
import ResourceViewer from "./pages/ResourceViewer";
import Notes from "./pages/Notes";
import LearningHistory from "./pages/LearningHistory";
import ProgressTracking from "./pages/ProgressTracking";
import ManageBooking from "./pages/ManageBooking";
import LiveClassJoin from "./pages/LiveClassJoin";
import LiveClassRating from "./pages/LiveClassRating";
import Recordings from "./pages/Recordings";
import Attendance from "./pages/Attendance";
import Quiz from "./pages/Quiz";
import AssignmentSubmit from "./pages/AssignmentSubmit";
import Certificates from "./pages/Certificates";
import Orders from "./pages/Orders";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import Reviews from "./pages/Reviews";
import ExplorePage from "../../public/pages/ExplorePage";
import LiveClassesDiscover from "./pages/LiveClassesDiscover";
import RecordedClassesDiscover from "./pages/RecordedClassesDiscover";
import Calendar from "./pages/Calendar";
import MyLearning from "./pages/MyLearning";
import Recommended from "./pages/Recommended";
import Profile from "./pages/Profile";
import HelpComplaints from "./pages/HelpComplaints";
import TestSeries from "./pages/TestSeries";
import CourseQuizzes from "./pages/CourseQuizzes";
import SkillAssessments from "./pages/SkillAssessments";
import AssessmentResults from "./pages/AssessmentResults";
import AssessmentRunner from "./pages/AssessmentRunner";
import AssessmentResultDetail from "./pages/AssessmentResultDetail";

// Wraps every onboarding route in ONE OnboardingProvider instance via a
// layout route + <Outlet/>, so the context — and the form state it holds —
// survives navigation between steps. Wrapping each <Route>'s element in its
// own separate <OnboardingProvider> would remount a fresh provider (and
// reset the form) on every step change.
function OnboardingLayoutRoute() {
  return (
    <OnboardingProvider>
      <Outlet />
    </OnboardingProvider>
  );
}

// Onboarding is a self-contained, full-bleed flow with NO sidebar/top-nav
// chrome — per request, it must not render inside StudentLayout. So this is
// exported separately, as a complete absolute-path <Route>, and mounted as
// its own sibling in src/routes/AppRoutes.jsx rather than nested under the
// "/student" + StudentLayout route below. Trimmed to 3 steps per request —
// Basics → Details → Interests — the Review step is gone; Interests now
// creates the account directly (see OnboardingInterests.jsx).
export const studentOnboardingRoutes = (
  <Route path="/student/onboarding" element={<OnboardingLayoutRoute />}>
    <Route index element={<Navigate to="basics" replace />} />
    <Route path="intro" element={<Navigate to="basics" replace />} />
    <Route path="basics" element={<OnboardingBasics />} />
    <Route path="details" element={<OnboardingDetails />} />
    <Route path="interests" element={<OnboardingInterests />} />
    <Route path="terms" element={<Navigate to="interests" replace />} />
    <Route path="review" element={<Navigate to="interests" replace />} />
  </Route>
);

// Mounted at /student/* inside src/routes/AppRoutes.jsx, wrapped in
// StudentLayout (sidebar + top nav). Add new screens here as you build
// them. Onboarding routes live in studentOnboardingRoutes above instead,
// since that flow deliberately has no sidebar.
const studentRoutes = (
  <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="my-learning" element={<MyLearning />} />
      <Route path="recommended" element={<Recommended />} />
      <Route path="explore" element={<ExplorePage />} />
      <Route path="live-classes" element={<LiveClassesDiscover />} />
      <Route path="recorded-classes" element={<RecordedClassesDiscover />} />
      <Route path="assessments/test-series" element={<TestSeries />} />
      <Route path="assessments/test-series/:assessmentId" element={<TestSeries />} />
      <Route path="assessments/course-quizzes" element={<CourseQuizzes />} />
      <Route path="assessments/skill-assessments" element={<SkillAssessments />} />
      <Route path="assessments/my-results" element={<AssessmentResults />} />
      <Route path="assessments/take/:assessmentId" element={<AssessmentRunner />} />
      <Route path="assessments/results/:attemptId/review" element={<AssessmentResultDetail />} />
      <Route path="assessments/results/:attemptId" element={<AssessmentResultDetail />} />
      <Route path="calendar" element={<Calendar />} />
      <Route path="landing" element={<Landing />} />
      <Route path="searchresults" element={<SearchResults />} />
      <Route path="educatorprofile" element={<EducatorProfile />} />
      <Route path="coursedetails" element={<CourseDetails />} />
      <Route path="course/:courseId" element={<CourseDetails />} />
      <Route path="wishlist" element={<Wishlist />} />
      <Route path="checkout" element={<Checkout />} />
      <Route path="paymentresult" element={<PaymentResult />} />
      <Route path="courseplayer" element={<CoursePlayer />} />
      <Route path="resourceviewer" element={<ResourceViewer />} />
      <Route path="notes" element={<Notes />} />
      <Route path="learninghistory" element={<LearningHistory />} />
      <Route path="progresstracking" element={<ProgressTracking />} />
      <Route path="booksession" element={<Navigate to="live-classes" replace />} />
      <Route path="managebooking" element={<ManageBooking />} />
      <Route path="liveclassjoin" element={<LiveClassJoin />} />
      <Route path="liveclassrating" element={<LiveClassRating />} />
      <Route path="recordings" element={<Recordings />} />
      <Route path="attendance" element={<Attendance />} />
      <Route path="quiz" element={<Quiz />} />
      <Route path="assignmentsubmit" element={<AssignmentSubmit />} />
      <Route path="certificates" element={<Certificates />} />
      <Route path="orders" element={<Orders />} />
      <Route path="messages" element={<Messages />} />
      <Route path="help-complaints" element={<HelpComplaints />} />
      <Route path="help-complaints/:ticketId" element={<HelpComplaints />} />
      <Route path="notifications" element={<Notifications />} />
      <Route path="reviews" element={<Reviews />} />
      <Route path="profile" element={<Profile />} />
  </>
);

export default studentRoutes;
