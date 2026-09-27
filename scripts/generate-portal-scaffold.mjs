import fs from "fs";
import path from "path";

const ROOT = process.argv[2];
if (!ROOT) {
  console.error("Usage: node scaffold.mjs <projectRoot>");
  process.exit(1);
}
const SRC = path.join(ROOT, "src");

function write(relPath, content) {
  const full = path.join(SRC, relPath);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}

function pageStub(componentName, title, docRef, dayLabel) {
  return `// ${title}
// Jira: ${dayLabel}
// Doc reference: ${docRef}
//
// TODO: build this screen here. Keep any screen-specific pieces
// (small sub-components, local hooks) inside this same portal folder.
// Only promote something to /src/components if 2+ portals need it.

export default function ${componentName}() {
  return (
    <div className="p-6">
      <h1 className="text-2xl font-semibold text-slate-900">${title}</h1>
      <p className="mt-2 text-slate-500">TODO: implement — ${docRef}</p>
    </div>
  );
}
`;
}

function readme(portalName, ownerLabel, rows) {
  const list = rows
    .map(
      (r) =>
        `- **${r.day}** — ${r.title}  \n  Doc ref: ${r.docRef}  \n  File: \`src/portals/${portalName}/pages/${r.file}.jsx\``
    )
    .join("\n");
  return `# ${ownerLabel} Portal — Frontend

Owner: **${ownerLabel} Dev** (per Jira import)

Everything for this portal lives under this folder. Please don't edit files
inside \`src/portals/student\`, \`src/portals/teacher\`, or \`src/portals/admin\`
unless it's the portal you own — shared UI belongs in \`src/components\`.

## Structure

- \`pages/\` — one file per screen/flow (mapped to Jira stories below)
- \`components/\` — components used only within this portal
- \`hooks/\` — hooks used only within this portal
- \`services/\` — API calls for this portal (\`${portalName}Api.js\`)
- \`routes.jsx\` — this portal's routes, mounted once in \`src/routes/AppRoutes.jsx\`

## Screens (from Jira sprint import)

${list}

## Working here

1. Build your screen inside \`pages/<Name>.jsx\`.
2. If a screen needs its own small pieces, put them in \`components/\` here,
   not in the shared folder.
3. Wire real API calls in \`services/${portalName}Api.js\` using the shared
   \`src/services/apiClient.js\` (axios instance with base URL + auth header
   already configured).
4. Add/adjust the route in \`routes.jsx\` — you do not need to touch any other
   portal's files or the root router.
`;
}

// ---------------------------------------------------------------------------
// Story data (condensed from jira_frontend_sprint_import.csv)
// ---------------------------------------------------------------------------

const student = [
  ["Day 2", "Onboarding", "Onboarding", "Sec 5.1, 6.1"],
  ["Day 3", "Dashboard", "Student Dashboard (home)", "Sec 15"],
  ["Day 4", "Landing", "Public landing page", "Sec 5.3"],
  ["Day 4", "SearchResults", "Search & category browsing", "Sec 5.3"],
  ["Day 5", "EducatorProfile", "Educator public profile", "Sec 5.3"],
  ["Day 5", "CourseDetails", "Course details page", "Sec 5.3"],
  ["Day 5", "Wishlist", "Wishlist", "Sec 5.3"],
  ["Day 6", "Checkout", "Checkout & payment UI", "Sec 5.10"],
  ["Day 6", "PaymentResult", "Payment success / failure", "Sec 5.10"],
  ["Day 7", "CoursePlayer", "Course player shell + video", "Sec 5.5, 10.1"],
  ["Day 7", "ResourceViewer", "PDF / resource viewer", "Sec 5.5, 10.1"],
  ["Day 8", "Notes", "Notes panel", "Sec 5.5"],
  ["Day 8", "LearningHistory", "Learning history", "Sec 12"],
  ["Day 8", "ProgressTracking", "Progress tracking UI", "Sec 12"],
  ["Day 9", "BookSession", "Book a session / availability", "Sec 5.6"],
  ["Day 9", "ManageBooking", "Reschedule / cancel booking", "Sec 5.6"],
  ["Day 10", "LiveClassJoin", "Join live class experience", "Sec 5.7"],
  ["Day 11", "LiveClassRating", "Post-session rating modal", "Sec 5.7"],
  ["Day 11", "Recordings", "Lecture recordings (view-only)", "Sec 5.7"],
  ["Day 11", "Attendance", "Attendance display", "Sec 5.7"],
  ["Day 12", "Quiz", "Quiz-taking UI", "Sec 5.8, 11.1-11.2"],
  ["Day 12", "AssignmentSubmit", "Assignment submission UI", "Sec 5.8, 11.1-11.2"],
  ["Day 13", "Certificates", "Certificate view/download", "Sec 5.9, 5.10"],
  ["Day 13", "Orders", "Orders / wallet / coupons / refunds", "Sec 5.9, 5.10"],
  ["Day 14", "Messages", "Student to educator chat", "Sec 5.12"],
  ["Day 14", "Notifications", "Notification center & prefs", "Sec 5.12"],
  ["Day 15", "Reviews", "Course reviews & ratings", "Sec 5.9"],
];

const teacher = [
  ["Day 1", "Registration", "Educator registration & verification", "Sec 5.1"],
  ["Day 2", "ProfileSetup", "Profile setup + digital ID card", "Sec 5.1"],
  ["Day 3", "Dashboard", "Educator dashboard (home)", "Sec 15"],
  ["Day 4", "CourseBuilder", "Course builder + curriculum structure", "Sec 5.4, 9"],
  ["Day 5", "ContentUpload", "Content upload UI + course preview", "Sec 5.4, 11.1"],
  ["Day 6", "PublishFlow", "Pricing + publish flow + lifecycle states", "Sec 5.4"],
  ["Day 7", "MyCourses", "My courses list + management overview", "Sec 5.4"],
  ["Day 8", "ReviewsAvailability", "Reviews (read) + availability calendar", "Sec 5.4, 5.6"],
  ["Day 9", "BookingManage", "Scheduled call booking + reschedule/cancel", "Sec 5.6"],
  ["Day 10", "LiveClassHost", "Schedule/host live class + whiteboard", "Sec 5.7"],
  ["Day 11", "LiveClassTools", "In-class tools: chat, hand-raise, polls", "Sec 5.7"],
  ["Day 12", "Grading", "Grading UI + homework/marksheet upload", "Sec 5.8"],
  ["Day 13", "Earnings", "Earnings ledger, revenue, payout request", "Sec 5.11"],
  ["Day 14", "Messaging", "Chat + announcements + broadcast", "Sec 5.12"],
  ["Day 15", "NotificationPrefs", "Notification prefs", "Sec 5.12"],
];

const admin = [
  ["Day 1", "LoginDashboard", "Admin/Super Admin login (MFA) + dashboard", "Sec 5.1, 5.13"],
  ["Day 2", "EducatorVerification", "Educator management & verification queue", "Sec 5.13"],
  ["Day 3", "CourseApproval", "Course management & approval queue", "Sec 5.13"],
  ["Day 4", "UserManagement", "User management & student details", "Sec 5.13"],
  ["Day 5", "InstitutionManagement", "Institution management + details view", "Sec 5.2"],
  ["Day 6", "RegionBranchHierarchy", "Region/branch hierarchy + staff assignment", "Sec 5.2"],
  ["Day 7", "ManagementDashboards", "Head Teacher/Regional Head dashboards", "Sec 8.2, 15"],
  ["Day 8", "PaymentOversight", "Payment/revenue oversight + commission & refunds", "Sec 5.13"],
  ["Day 9", "FinancialAnalytics", "Detailed financial analytics", "Sec 5.10"],
  ["Day 10", "ReportsBuilder", "Reports & analytics + custom report builder", "Sec 5.13, 8"],
  ["Day 11", "ContentModeration", "Content moderation + CMS", "Sec 5.13"],
  ["Day 12", "AuditLogs", "Notifications management + audit logs", "Sec 5.13"],
  ["Day 13", "SettingsPermissions", "Settings & permissions + certificate mgmt", "Sec 5.13, 5.9"],
  ["Day 14", "RegionalAnalytics", "Regional growth analytics + compliance reports", "Sec 5.13"],
  ["Day 15", "SupportTickets", "Help desk / support tickets + callback requests", "Sec 5.13"],
];

const portals = [
  { key: "student", label: "Student", rows: student },
  { key: "teacher", label: "Teacher (Educator)", rows: teacher },
  { key: "admin", label: "Admin", rows: admin },
];

for (const portal of portals) {
  const rows = portal.rows.map(([day, file, title, docRef]) => ({
    day,
    file,
    title,
    docRef,
  }));

  for (const r of rows) {
    write(
      `portals/${portal.key}/pages/${r.file}.jsx`,
      pageStub(r.file, r.title, r.docRef, `${r.day} — ${r.title}`)
    );
  }

  write(`portals/${portal.key}/components/.gitkeep`, "");
  write(`portals/${portal.key}/hooks/.gitkeep`, "");

  write(
    `portals/${portal.key}/services/${portal.key}Api.js`,
    `import apiClient from "../../../services/apiClient";

// ${portal.label} portal API calls go here.
// Example:
// export const getDashboard = () => apiClient.get("/${portal.key}/dashboard");
`
  );

  const importLines = rows
    .map((r) => `import ${r.file} from "./pages/${r.file}";`)
    .join("\n");
  const routeLines = rows
    .map(
      (r) =>
        `      <Route path="${r.file.toLowerCase()}" element={<${r.file} />} />`
    )
    .join("\n");

  write(
    `portals/${portal.key}/routes.jsx`,
    `import { Route } from "react-router-dom";
${importLines}

// Mounted at /${portal.key}/* inside src/routes/AppRoutes.jsx
// Add new screens here as you build them.
const ${portal.key}Routes = (
  <>
${routeLines}
  </>
);

export default ${portal.key}Routes;
`
  );

  fs.writeFileSync(
    path.join(SRC, `portals/${portal.key}/README.md`),
    readme(portal.key, portal.label, rows)
  );
}

// ---------------------------------------------------------------------------
// Shared / global structure
// ---------------------------------------------------------------------------

write(
  "components/ui/Button.jsx",
  `export default function Button({ children, className = "", ...props }) {
  return (
    <button
      className={\`inline-flex items-center justify-center rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50 \${className}\`}
      {...props}
    >
      {children}
    </button>
  );
}
`
);

write(
  "components/ui/Card.jsx",
  `export default function Card({ children, className = "" }) {
  return (
    <div className={\`rounded-xl border border-slate-200 bg-white p-4 shadow-sm \${className}\`}>
      {children}
    </div>
  );
}
`
);

write(
  "components/ui/Input.jsx",
  `export default function Input({ label, className = "", ...props }) {
  return (
    <label className="block">
      {label && (
        <span className="mb-1 block text-sm font-medium text-slate-700">
          {label}
        </span>
      )}
      <input
        className={\`w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 \${className}\`}
        {...props}
      />
    </label>
  );
}
`
);

write(
  "components/common/Navbar.jsx",
  `// Shared top navbar shell — each portal layout can pass its own links/title.
export default function Navbar({ title, links = [] }) {
  return (
    <header className="flex h-14 items-center justify-between border-b border-slate-200 bg-white px-6">
      <span className="font-semibold text-slate-900">{title}</span>
      <nav className="flex gap-4 text-sm text-slate-600">
        {links.map((l) => (
          <a key={l.href} href={l.href} className="hover:text-indigo-600">
            {l.label}
          </a>
        ))}
      </nav>
    </header>
  );
}
`
);

write(
  "components/common/Sidebar.jsx",
  `// Shared sidebar shell — each portal layout supplies its own nav items.
export default function Sidebar({ items = [] }) {
  return (
    <aside className="hidden w-56 shrink-0 border-r border-slate-200 bg-white p-4 md:block">
      <ul className="space-y-1 text-sm">
        {items.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className="block rounded-lg px-3 py-2 text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </a>
          </li>
        ))}
      </ul>
    </aside>
  );
}
`
);

write(
  "components/common/ProtectedRoute.jsx",
  `import { Navigate } from "react-router-dom";
import { useAuth } from "../../hooks/useAuth";

// Wrap portal routes that require login + a specific role.
// Usage: <ProtectedRoute role="student"><StudentDashboard /></ProtectedRoute>
export default function ProtectedRoute({ role, children }) {
  const { user } = useAuth();

  if (!user) return <Navigate to="/login" replace />;
  if (role && user.role !== role) return <Navigate to="/" replace />;

  return children;
}
`
);

// Auth screens (shared — used before a user lands in any portal)
const authPages = [
  ["Login", "Login (password / OTP / Google)"],
  ["Register", "Registration (email/phone signup)"],
  ["OtpVerification", "OTP / email verification"],
  ["ForgotPassword", "Forgot password (request link)"],
  ["ResetPassword", "Reset password form"],
];
for (const [file, title] of authPages) {
  write(
    `auth/pages/${file}.jsx`,
    pageStub(file, title, "Sec 5.1", "Day 1 — Auth screens")
  );
}
write(
  "auth/routes.jsx",
  `import { Route } from "react-router-dom";
import Login from "./pages/Login";
import Register from "./pages/Register";
import OtpVerification from "./pages/OtpVerification";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";

// Public auth routes, mounted at root in src/routes/AppRoutes.jsx
const authRoutes = (
  <>
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/verify-otp" element={<OtpVerification />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route path="/reset-password" element={<ResetPassword />} />
  </>
);

export default authRoutes;
`
);

write(
  "layouts/StudentLayout.jsx",
  `import { Outlet } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Sidebar from "../components/common/Sidebar";

const links = [
  { href: "/student/dashboard", label: "Dashboard" },
  { href: "/student/landing", label: "Explore" },
];

export default function StudentLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar title="Student Portal" links={links} />
      <div className="flex flex-1">
        <Sidebar items={links} />
        <main className="flex-1 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
`
);

write(
  "layouts/TeacherLayout.jsx",
  `import { Outlet } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Sidebar from "../components/common/Sidebar";

const links = [
  { href: "/teacher/dashboard", label: "Dashboard" },
  { href: "/teacher/mycourses", label: "My Courses" },
];

export default function TeacherLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar title="Educator Portal" links={links} />
      <div className="flex flex-1">
        <Sidebar items={links} />
        <main className="flex-1 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
`
);

write(
  "layouts/AdminLayout.jsx",
  `import { Outlet } from "react-router-dom";
import Navbar from "../components/common/Navbar";
import Sidebar from "../components/common/Sidebar";

const links = [
  { href: "/admin/logindashboard", label: "Dashboard" },
  { href: "/admin/usermanagement", label: "Users" },
];

export default function AdminLayout() {
  return (
    <div className="flex min-h-screen flex-col">
      <Navbar title="Admin Portal" links={links} />
      <div className="flex flex-1">
        <Sidebar items={links} />
        <main className="flex-1 bg-slate-50">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
`
);

write(
  "layouts/AuthLayout.jsx",
  `import { Outlet } from "react-router-dom";

export default function AuthLayout() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <Outlet />
      </div>
    </div>
  );
}
`
);

write(
  "context/AuthContext.jsx",
  `import { createContext, useMemo, useState } from "react";

export const AuthContext = createContext(null);

// Minimal placeholder auth state — replace with real token/session logic.
export function AuthProvider({ children }) {
  const [user, setUser] = useState(null); // e.g. { id, role: "student" | "teacher" | "admin" }

  const value = useMemo(() => ({ user, setUser }), [user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
`
);

write(
  "hooks/useAuth.js",
  `import { useContext } from "react";
import { AuthContext } from "../context/AuthContext";

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
`
);

write(
  "services/apiClient.js",
  `import axios from "axios";

// Single shared axios instance. Set VITE_API_BASE_URL in your .env file.
const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "/api",
});

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem("authToken");
  if (token) config.headers.Authorization = \`Bearer \${token}\`;
  return config;
});

export default apiClient;
`
);

write(
  "utils/constants.js",
  `export const ROLES = {
  STUDENT: "student",
  TEACHER: "teacher",
  ADMIN: "admin",
};
`
);

write(
  "routes/AppRoutes.jsx",
  `import { Routes, Route, Navigate } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import StudentLayout from "../layouts/StudentLayout";
import TeacherLayout from "../layouts/TeacherLayout";
import AdminLayout from "../layouts/AdminLayout";

import authRoutes from "../auth/routes";
import studentRoutes from "../portals/student/routes";
import teacherRoutes from "../portals/teacher/routes";
import adminRoutes from "../portals/admin/routes";

// This is the ONLY file that wires all three portals together.
// Each portal owner should only need to touch their own routes.jsx —
// not this file — when adding a new screen.
export default function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/login" replace />} />

      <Route element={<AuthLayout />}>{authRoutes}</Route>

      <Route path="/student" element={<StudentLayout />}>
        {studentRoutes}
      </Route>

      <Route path="/teacher" element={<TeacherLayout />}>
        {teacherRoutes}
      </Route>

      <Route path="/admin" element={<AdminLayout />}>
        {adminRoutes}
      </Route>
    </Routes>
  );
}
`
);

write(
  "App.jsx",
  `import { BrowserRouter } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import AppRoutes from "./routes/AppRoutes";

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
`
);

write(
  "main.jsx",
  `import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>
);
`
);

write(
  "index.css",
  `@import "tailwindcss";
`
);

console.log("Scaffold written.");
