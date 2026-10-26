import { lazy } from "react";
import { Navigate, Route } from "react-router-dom";
const Registration = lazy(() => import("./pages/Registration"));
const ProfileSetup = lazy(() => import("./pages/ProfileSetup"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const CourseBuilder = lazy(() => import("./pages/CourseBuilder"));
const ContentUpload = lazy(() => import("./pages/ContentUpload"));
const CoursePreview = lazy(() => import("./pages/CoursePreview"));
const PublishFlow = lazy(() => import("./pages/PublishFlow"));
const MyCourses = lazy(() => import("./pages/MyCourses"));
const CourseManagement = lazy(() => import("./pages/CourseManagement"));
const ReviewsAvailability = lazy(() => import("./pages/ReviewsAvailability"));
const Reviews = lazy(() => import("./pages/Reviews"));
const BookingManage = lazy(() => import("./pages/BookingManage"));
const LiveClasses = lazy(() => import("./pages/LiveClasses"));
const Grading = lazy(() => import("./pages/Grading"));
const Earnings = lazy(() => import("./pages/Earnings"));
const Analytics = lazy(() => import("./pages/Analytics"));
const Messaging = lazy(() => import("./pages/Messaging"));
const StudentManagement = lazy(() => import("./pages/StudentManagement"));
const MentorshipHub = lazy(() => import("./pages/MentorshipHub"));
const SessionRequests = lazy(() => import("./pages/SessionRequests"));
const NotificationPrefs = lazy(() => import("./pages/NotificationPrefs"));
const TestSeries = lazy(() => import("./pages/TestSeries"));
const TestSeriesBuilder = lazy(() => import("./pages/TestSeriesBuilder"));
const NewTestSeries = lazy(() => import("./pages/TestSeriesBuilder").then((m) => ({ default: m.NewTestSeries })));
const AssignedSeries = lazy(() => import("./pages/AssignedSeries"));
const TestSeriesDetail = lazy(() => import("./pages/TestSeriesDetail"));
const TestSeriesStudentPreview = lazy(() => import("./pages/TestSeriesStudentPreview"));
import TestSeriesGuard from "./components/TestSeriesGuard";
import { CourseBuilderProvider } from "./context/CourseBuilderContext";
import { TeacherCoursesProvider } from "./context/TeacherCoursesContext";
import { TeacherAvailabilityProvider } from "./context/TeacherAvailabilityContext";
import { MessagingProvider } from "./context/MessagingContext";
import { MentorshipProvider } from "./context/MentorshipContext";

// Registration is ONE unified, full-bleed flow (account + profile + verification
// documents, completed upfront) with NO sidebar/top-nav chrome (same reasoning
// as Student Onboarding). After submitting, the educator signs in straight away
// and lands in the portal shell with its content locked until an admin
// approves them (see TeacherLayout + EducatorStatusBanner). So it's
// exported separately and mounted as its own sibling route in
// src/routes/AppRoutes.jsx, outside "/teacher" + TeacherLayout below.
export const teacherRegistrationRoutes = (
  <Route path="/teacher/registration" element={<Registration />} />
);

// Mounted at /teacher/* inside src/routes/AppRoutes.jsx, wrapped in
// TeacherLayout (sidebar + top nav). Add new screens here as you build them.
// Registration lives in teacherRegistrationRoutes above instead, since that
// flow deliberately has no sidebar.
//
// TeacherCoursesProvider is a pathless layout route wrapping My Courses,
// Course Management Overview AND the whole Course Builder group — it's the
// one shared list of every course this educator has built (see
// TeacherCoursesContext.jsx), and CourseBuilderProvider now reads/writes
// through it by :courseId instead of carrying its own local draft, so an
// edit made in the builder is immediately visible in My Courses/Management
// Overview and vice versa. Each builder route has a plain and a
// "/:courseId" variant — the plain one keeps defaulting to "c1" (the
// original flagship sample course) so existing links/behavior are
// unchanged, while Edit actions elsewhere in the app link to the
// courseId-suffixed path for the course actually being edited.
//
// TeacherAvailabilityProvider now also wraps My Courses + Course
// Management Overview (not just the Availability screen itself) so
// Mentorship Check-In's ScheduleCallModal use and the Session Requests page
// (Part 5 — the general-purpose "Schedule a Call" quick actions were
// removed/replaced there) all read/write the exact same slot list the
// Availability calendar renders from — no separate booking store.
const teacherRoutes = (
  <>
      {/* ===================================================================
          TEMPORARILY HIDDEN PORTAL SECTIONS (Test Series-only mode)
          Every route line tagged "TEMP-HIDDEN" below is commented out on
          purpose; the pages/components/providers still exist untouched.
          To RESTORE: (1) turn each {/* TEMP-HIDDEN: <Route .../> *\/} back
          into the plain <Route .../>, (2) delete the two "TEMP-REDIRECT"
          routes at the bottom of this fragment, (3) likewise restore
          src/layouts/TeacherLayout.jsx (search "TEMP-HIDDEN").
          =================================================================== */}
      {/* Digital ID Card -- the old Profile Setup form now lives inside the unified
          registration flow (Registration.jsx); this route (kept at "profilesetup")
          shows the educator's Digital ID Card: provisional while under review,
          Verified once approved. NOT hidden, and exempt from the pending lock. */}
      <Route path="profilesetup" element={<ProfileSetup />} />
      <Route element={<TeacherCoursesProvider />}>
        <Route element={<MessagingProvider />}>
        {/* Dashboard sits inside MessagingProvider so its recent-announcements widget can read the shared history. */}
          <Route path="dashboard" element={<Dashboard />} />
        <Route element={<CourseBuilderProvider />}>
          {/* TEMP-HIDDEN: <Route path="coursebuilder" element={<CourseBuilder />} /> */}
          {/* TEMP-HIDDEN: <Route path="coursebuilder/:courseId" element={<CourseBuilder />} /> */}
          {/* TEMP-HIDDEN: <Route path="contentupload" element={<ContentUpload />} /> */}
          {/* TEMP-HIDDEN: <Route path="contentupload/:courseId" element={<ContentUpload />} /> */}
          {/* TEMP-HIDDEN: <Route path="coursepreview" element={<CoursePreview />} /> */}
          {/* TEMP-HIDDEN: <Route path="coursepreview/:courseId" element={<CoursePreview />} /> */}
          {/* TEMP-HIDDEN: <Route path="publishflow" element={<PublishFlow />} /> */}
          {/* TEMP-HIDDEN: <Route path="publishflow/:courseId" element={<PublishFlow />} /> */}
        </Route>
        {/* TEMP-HIDDEN: <Route path="reviews" element={<Reviews />} /> */}
        <Route element={<TeacherAvailabilityProvider />}>
          {/* MentorshipProvider needs useTeacherAvailability() (Schedule
              Check-In reads/writes real slots) so it must nest inside
              TeacherAvailabilityProvider -- and it wraps this whole sibling
              group, not just mentorshiphub alone, so its state (accepted
              applications, roadmap edits) survives navigating to My
              Courses/Student Management and back, the same way
              TeacherAvailabilityProvider itself persists across them. */}
          <Route element={<MentorshipProvider />}>
            {/* TEMP-HIDDEN: <Route path="mycourses" element={<MyCourses />} /> */}
            {/* TEMP-HIDDEN: <Route path="coursemanagement/:courseId" element={<CourseManagement />} /> */}
            {/* TEMP-HIDDEN: <Route path="reviewsavailability" element={<ReviewsAvailability />} /> */}
            {/* Scheduled Live Class + Host View reads the exact same booking
                slot list as the Availability calendar above (single source
                of truth), so it shares this same provider rather than
                carrying its own session store. */}
            {/* TEMP-HIDDEN: <Route path="liveclasses" element={<LiveClasses />} /> */}
            {/* Video calling now happens in the external meeting provider;
                old in-app host links land back on the Live Classes page. */}
            {/* TEMP-HIDDEN: <Route path="liveclasshost" element={<Navigate to="/teacher/liveclasses" replace />} /> */}
            {/* TEMP-HIDDEN: <Route path="liveclasshost/:slotId" element={<Navigate to="/teacher/liveclasses" replace />} /> */}
            {/* TEMP-HIDDEN: <Route path="studentmanagement" element={<StudentManagement />} /> */}
            {/* TEMP-HIDDEN: <Route path="mentorshiphub" element={<MentorshipHub />} /> */}
            {/* Session Requests (Part 5) reads/writes the exact same slot
                list via useTeacherAvailability().scheduleCall on Accept, so
                it nests here too rather than carrying its own booking
                path. Its request records themselves live one level up in
                SessionRequestsProvider (wrapping TeacherLayout in
                AppRoutes.jsx) so the nav badge works on every teacher page. */}
            {/* TEMP-HIDDEN: <Route path="requests" element={<SessionRequests />} /> */}
            {/* Announcements needs mentorship programs for its audience builder, so it nests here. */}
            {/* TEMP-HIDDEN: <Route path="messaging" element={<Messaging />} /> */}
          </Route>
        </Route>
        {/* TEMP-HIDDEN: <Route path="earnings" element={<Earnings />} /> */}
        {/* TEMP-HIDDEN: <Route path="analytics" element={<Analytics />} /> */}
        {/* Test Series -- every route here sits behind TestSeriesGuard (admin-
            granted creator access). Series/grading state lives in
            TestSeriesContext, mounted above /admin and /teacher in App.jsx,
            so it persists across all of these siblings without a provider
            of its own. Grading is mounted INSIDE TeacherCoursesProvider so
            the Grading page can merge course submissions with Test Series
            ones. */}
        <Route element={<TestSeriesGuard />}>
          <Route path="testseries" element={<TestSeries />} />
          <Route path="testseries/assigned" element={<AssignedSeries />} />
          <Route path="testseries/new" element={<NewTestSeries />} />
          <Route path="testseries/:seriesId" element={<TestSeriesBuilder />} />
          <Route path="testseries/:seriesId/detail" element={<TestSeriesDetail />} />
          {/* Preview as Student: the nested :testId route renders nothing of its
              own -- the host reads the param, so it stays mounted (keeping its
              local preview state) when moving between selection and a test. */}
          <Route path="testseries/:seriesId/preview" element={<TestSeriesStudentPreview />}>
            <Route path=":testId" />
          </Route>
        </Route>
        {/* TEMP-HIDDEN: <Route path="grading" element={<Grading />} /> */}
        </Route>
      </Route>
      {/* TEMP-HIDDEN: <Route path="bookingmanage" element={<BookingManage />} /> */}
      {/* TEMP-HIDDEN: <Route path="liveclasstools" element={<Navigate to="/teacher/liveclasses" replace />} /> */}
      {/* Notification Preferences -- account-level settings, reached from the header gear/bell,
          so it is NOT hidden and stays open while the profile is under review. */}
      <Route path="notificationprefs" element={<NotificationPrefs />} />
      <Route index element={<Navigate to="/teacher/dashboard" replace />} />
      <Route path="*" element={<Navigate to="/teacher/dashboard" replace />} />
  </>
);

export default teacherRoutes;
