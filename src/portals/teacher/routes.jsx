import { Navigate, Route } from "react-router-dom";
import Registration from "./pages/Registration";
import ProfileSetup from "./pages/ProfileSetup";
import Dashboard from "./pages/Dashboard";
import CourseBuilder from "./pages/CourseBuilder";
import ContentUpload from "./pages/ContentUpload";
import PublishFlow from "./pages/PublishFlow";
import MyCourses from "./pages/MyCourses";
import ReviewsAvailability from "./pages/ReviewsAvailability";
import BookingManage from "./pages/BookingManage";
import LiveClassHost from "./pages/LiveClassHost";
import LiveClassTools from "./pages/LiveClassTools";
import Grading from "./pages/Grading";
import Earnings from "./pages/Earnings";
import Messaging from "./pages/Messaging";
import NotificationPrefs from "./pages/NotificationPrefs";

// Mounted at /teacher/* inside src/routes/AppRoutes.jsx
// Add new screens here as you build them.
const teacherRoutes = (
  <>
      <Route index element={<Navigate to="dashboard" replace />} />
      <Route path="registration" element={<Registration />} />
      <Route path="profilesetup" element={<ProfileSetup />} />
      <Route path="dashboard" element={<Dashboard />} />
      <Route path="coursebuilder" element={<CourseBuilder />} />
      <Route path="contentupload" element={<ContentUpload />} />
      <Route path="publishflow" element={<PublishFlow />} />
      <Route path="mycourses" element={<MyCourses />} />
      <Route path="reviewsavailability" element={<ReviewsAvailability />} />
      <Route path="bookingmanage" element={<BookingManage />} />
      <Route path="liveclasshost" element={<LiveClassHost />} />
      <Route path="liveclasstools" element={<LiveClassTools />} />
      <Route path="grading" element={<Grading />} />
      <Route path="earnings" element={<Earnings />} />
      <Route path="messaging" element={<Messaging />} />
      <Route path="notificationprefs" element={<NotificationPrefs />} />
  </>
);

export default teacherRoutes;
