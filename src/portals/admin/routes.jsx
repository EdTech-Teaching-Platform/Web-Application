import { Route, Navigate, useParams } from "react-router-dom";
import DiscountManagement from "./pages/discounts/DiscountManagement";
import LoginDashboard from "./pages/LoginDashboard";
import EducatorVerification from "./pages/EducatorVerification";
import EducatorProfile from "./pages/EducatorProfile";
import RegionalHeads from "./pages/RegionalHeads";
import Escalations from "./pages/Escalations";
import CourseApproval from "./pages/CourseApproval";
import TestSeries from "./pages/TestSeries";
import TestSeriesWizard from "./pages/TestSeriesWizard";
import AITestBuilder from "./pages/AITestBuilder";
import TestSeriesDetail from "./pages/TestSeriesDetail";
import TestDetail from "./pages/TestDetail";
import AssignEducators from "./pages/AssignEducators";
import TestSeriesTracker from "./pages/TestSeriesTracker";
import TestPerformanceAnalytics from "./pages/TestPerformanceAnalytics";
import UserManagement from "./pages/UserManagement";
import PaymentOversight from "./pages/PaymentOversight";
import TransactionHistory from "./pages/TransactionHistory";
import FinancialAnalytics from "./pages/FinancialAnalytics";
import ReportsBuilder from "./pages/ReportsBuilder";
import ContentModeration from "./pages/ContentModeration";
import AuditLogs from "./pages/AuditLogs";
import SettingsPermissions from "./pages/SettingsPermissions";
import RegionalAnalytics from "./pages/RegionalAnalytics";
import SupportTickets from "./pages/SupportTickets";
import SecurityCenter from "./pages/SecurityCenter";
import ChangePassword from "./pages/ChangePassword";
import Notifications from "./pages/Notifications";

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
