import { Route } from "react-router-dom";
import LoginDashboard from "./pages/LoginDashboard";
import EducatorVerification from "./pages/EducatorVerification";
import EducatorProfile from "./pages/EducatorProfile";
import CourseApproval from "./pages/CourseApproval";
import TestSeries from "./pages/TestSeries";
import TestSeriesDetail from "./pages/TestSeriesDetail";
import TestDetail from "./pages/TestDetail";
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

// Mounted at /admin/* inside src/routes/AppRoutes.jsx
// Add new screens here as you build them.
const adminRoutes = (
  <>
      <Route path="logindashboard" element={<LoginDashboard />} />
      <Route path="educatorverification" element={<EducatorVerification />} />
      <Route path="educatorverification/:educatorId" element={<EducatorProfile />} />
      <Route path="courseapproval" element={<CourseApproval />} />
      <Route path="testseries" element={<TestSeries />} />
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
