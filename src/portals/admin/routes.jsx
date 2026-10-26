import { lazy } from "react";
import { Route, Navigate, useParams } from "react-router-dom";
const DiscountManagement = lazy(() => import("./pages/discounts/DiscountManagement"));
const LoginDashboard = lazy(() => import("./pages/LoginDashboard"));
const EducatorVerification = lazy(() => import("./pages/EducatorVerification"));
const EducatorProfile = lazy(() => import("./pages/EducatorProfile"));
const RegionalHeads = lazy(() => import("./pages/RegionalHeads"));
const Escalations = lazy(() => import("./pages/Escalations"));
const CourseApproval = lazy(() => import("./pages/CourseApproval"));
const TestSeries = lazy(() => import("./pages/TestSeries"));
const TestSeriesWizard = lazy(() => import("./pages/TestSeriesWizard"));
const AITestBuilder = lazy(() => import("./pages/AITestBuilder"));
const TestSeriesDetail = lazy(() => import("./pages/TestSeriesDetail"));
const TestDetail = lazy(() => import("./pages/TestDetail"));
const AssignEducators = lazy(() => import("./pages/AssignEducators"));
const TestSeriesTracker = lazy(() => import("./pages/TestSeriesTracker"));
const TestPerformanceAnalytics = lazy(() => import("./pages/TestPerformanceAnalytics"));
const UserManagement = lazy(() => import("./pages/UserManagement"));
const PaymentOversight = lazy(() => import("./pages/PaymentOversight"));
const TransactionHistory = lazy(() => import("./pages/TransactionHistory"));
const FinancialAnalytics = lazy(() => import("./pages/FinancialAnalytics"));
const ReportsBuilder = lazy(() => import("./pages/ReportsBuilder"));
const ContentModeration = lazy(() => import("./pages/ContentModeration"));
const AuditLogs = lazy(() => import("./pages/AuditLogs"));
const SettingsPermissions = lazy(() => import("./pages/SettingsPermissions"));
const RegionalAnalytics = lazy(() => import("./pages/RegionalAnalytics"));
const SupportTickets = lazy(() => import("./pages/SupportTickets"));
const SecurityCenter = lazy(() => import("./pages/SecurityCenter"));
const ChangePassword = lazy(() => import("./pages/ChangePassword"));
const Notifications = lazy(() => import("./pages/Notifications"));

function SectionRedirect() {
  const { section } = useParams();
  return <Navigate to={`/admin/discounts?tab=${section}`} replace />;
}
function EditRedirect() {
  const { id } = useParams();
  return <Navigate to={`/admin/discounts?tab=create&edit=${id}`} replace />;
}

// Mounted at /admin/* inside src/routes/AppRoutes.jsx
// Add new screens here as you build them.
const adminRoutes = (
  <>
      <Route path="logindashboard" element={<LoginDashboard />} />
      <Route path="educatorverification" element={<EducatorVerification />} />
      <Route path="regionalheads" element={<RegionalHeads />} />
      <Route path="escalations" element={<Escalations />} />
      <Route path="discounts" element={<DiscountManagement />} />
      {/* earlier per-section URLs now open the matching section of the single page */}
      <Route path="discounts/edit/:id" element={<EditRedirect />} />
      <Route path="discounts/:section" element={<SectionRedirect />} />
      <Route path="educatorverification/:educatorId" element={<EducatorProfile />} />
      <Route path="courseapproval" element={<CourseApproval />} />
      <Route path="testseries" element={<TestSeries />} />
      <Route path="testseries/new" element={<TestSeriesWizard />} />
      <Route path="testseries/ai-builder" element={<AITestBuilder />} />
      <Route path="testseries/assign-educators" element={<AssignEducators />} />
      <Route path="testseries/tracker" element={<TestSeriesTracker />} />
      <Route path="testseries/performance-analytics" element={<TestPerformanceAnalytics />} />
      <Route path="testseries/:seriesId" element={<TestSeriesDetail />} />
      <Route path="testseries/:seriesId/tests/:testId" element={<TestDetail />} />
      <Route path="usermanagement" element={<UserManagement />} />
      <Route path="paymentoversight" element={<PaymentOversight />} />
      <Route path="transactionhistory" element={<TransactionHistory />} />
      <Route path="financialanalytics" element={<FinancialAnalytics />} />
      <Route path="reportsbuilder" element={<ReportsBuilder />} />
      <Route path="contentmoderation" element={<ContentModeration />} />
      <Route path="auditlogs" element={<AuditLogs />} />
      <Route path="settingspermissions" element={<SettingsPermissions />} />
      <Route path="regionalanalytics" element={<RegionalAnalytics />} />
      <Route path="supporttickets" element={<SupportTickets />} />
      <Route path="security" element={<SecurityCenter />} />
      <Route path="security/change-password" element={<ChangePassword />} />
      <Route path="notifications" element={<Notifications />} />
  </>
);

export default adminRoutes;
