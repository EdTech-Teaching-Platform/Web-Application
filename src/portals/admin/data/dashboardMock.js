// Placeholder dashboard data. Replace with real calls through
// src/portals/admin/services/adminApi.js once the backend endpoints
// (Administration & Governance / Dashboard Overview) are available.

export const platformStats = [
  { key: "users", label: "Total Users", value: "124,802", trend: "+12%", trendUp: true, note: "vs last month" },
  { key: "revenue", label: "Platform Revenue", value: "₹12,40,000", trend: "+9%", trendUp: true, note: "this month" },
  { key: "courses", label: "Active Courses", value: "1,450", trend: "+34", trendUp: true, note: "this week" },
  { key: "registrations", label: "New Registrations", value: "3,482", trend: "+18%", trendUp: true, note: "last 7 days" },
];

export const pendingApprovals = {
  educators: [
    { id: "e1", name: "Dr. Sarah Jenkins", submitted: "Sep 12", initials: "SJ" },
    { id: "e2", name: "Marcus Thorne", submitted: "Sep 11", initials: "MT" },
    { id: "e3", name: "Elena Rodriguez", submitted: "Sep 10", initials: "ER" },
  ],
  courses: [
    { id: "c1", title: "Advanced Data Structures", author: "Prof. Alan Turing" },
    { id: "c2", title: "Modern World History 101", author: "Dr. H. Zinn" },
    { id: "c3", title: "Intro to Machine Learning", author: "AI Institute" },
  ],
};

// weekly approvals throughput, used by the "approvals handled" card
export const approvalsWeekly = [
  { day: "Mon", value: 55 },
  { day: "Tue", value: 70 },
  { day: "Wed", value: 48 },
  { day: "Thu", value: 88 },
  { day: "Fri", value: 100 },
  { day: "Sat", value: 62 },
  { day: "Sun", value: 40 },
];

export const moderators = [
  { initials: "A", color: "#5B0F14" },
  { initials: "R", color: "#50C3E5" },
  { initials: "K", color: "#F9A044" },
  { initials: "N", color: "#B85DD5" },
];

// last 7 days revenue vs refunds, used by the "Revenue Trend" card
export const revenueTrend = [
  { day: "Mon", revenue: 62, refunds: 20 },
  { day: "Tue", revenue: 68, refunds: 18 },
  { day: "Wed", revenue: 58, refunds: 24 },
  { day: "Thu", revenue: 80, refunds: 15 },
  { day: "Fri", revenue: 92, refunds: 12 },
  { day: "Sat", revenue: 74, refunds: 20 },
  { day: "Sun", revenue: 66, refunds: 22 },
];

export const complianceNote = {
  title: "Accreditation report due",
  body: "Three institutional partners need an updated compliance report before their renewal window closes. Include:",
  checklist: [
    { label: "Course completion & outcomes data", done: true },
    { label: "Educator verification records", done: true },
    { label: "Attendance & audit-log export", done: false },
  ],
  due: "Due Sep 20, 2026",
};

export const approvalTasks = [
  { id: "t1", label: "Educator Verifications", progress: 62, meta: "3 of 8 reviewed", color: "#5B0F14" },
  { id: "t2", label: "Course Approvals", progress: 40, meta: "2 of 5 reviewed", color: "#50C3E5" },
  { id: "t3", label: "Institution Onboarding", progress: 100, meta: "Riverdale — complete", color: "#F9A044", done: true },
];

export const monthlyGoal = {
  label: "Monthly enrollment target",
  value: 82,
  detail: "3,42,000 of 4,17,000 enrollments this quarter",
};

export const quickActions = [
  { key: "financial", label: "Financial Reports", to: "/admin/financialanalytics", color: "#50C3E5" },
  { key: "regional", label: "Regional Growth", to: "/admin/regionalanalytics", color: "#B85DD5" },
  { key: "callback", label: "Callback Request", to: "/admin/supporttickets", color: "#E08A3E", icon: "phone" },
];

export const recentActivity = [
  { id: "a1", actor: "Admin", text: 'approved course "Intro to Statistics"', time: "12 minutes ago" },
  { id: "a2", actor: "System", text: 'flagged "React Basics" reviews for moderation', time: "48 minutes ago" },
  { id: "a3", actor: "Priya K.", text: 'onboarded institution "Riverdale Community College"', time: "2 hours ago" },
  { id: "a4", actor: "Admin", text: "processed refund for order #48213", time: "3 hours ago" },
];

// ---------------------------------------------------------------------
// Reference-layout dashboard (Welcome hero + stat cards + Platform
// Revenue / Transaction Overview + Top Performing Courses / Students by
// Region / My Notepad). Additive — everything above this line still
// powers nothing else, kept for any other consumer, this is only used
// by LoginDashboard's current layout.
// ---------------------------------------------------------------------

export const dashboardQuote = "Empowering educators. Enabling learners. Building brighter futures.";

export const dashboardStatCards = [
  { key: "students", label: "Total Students", value: "5,548", trend: "+12%", note: "from last month", icon: "users", accent: "rose", spark: [4, 6, 5, 7, 6, 8, 7, 9, 10] },
  { key: "educators", label: "Total Educators", value: "224", trend: "+8%", note: "from last month", icon: "teach", accent: "amber", spark: [5, 4, 6, 5, 7, 6, 8, 7, 9] },
  { key: "courses", label: "Total Courses", value: "186", trend: "+15%", note: "from last month", icon: "course", accent: "violet", spark: [3, 5, 4, 6, 5, 8, 6, 9, 8] },
  { key: "testseries", label: "Total Test Series", value: "48", trend: "+10%", note: "from last month", icon: "report", accent: "sky", spark: [2, 4, 3, 5, 6, 5, 7, 6, 8] },
];

export const dashboardRevenuePoints = [
  { label: "Aug 10", value: 2200 },
  { label: "Aug 17", value: 4600 },
  { label: "Aug 24", value: 11800 },
  { label: "Aug 31", value: 9000 },
  { label: "Sep 7", value: 11600 },
  { label: "Sep 14", value: 17600 },
  { label: "Today", value: 18240 },
];

export const dashboardNetRevenue = { value: "₹8,820", trend: "+18%" };

export const dashboardTransactions = [
  { key: "successful", label: "Successful", count: 342, pct: 67, tone: "success" },
  { key: "refunded", label: "Refunded", count: 48, pct: 11, tone: "amber" },
  { key: "processing", label: "Processing", count: 36, pct: 7, tone: "amber" },
  { key: "pending", label: "Pending", count: 32, pct: 6, tone: "amber" },
  { key: "failed", label: "Failed", count: 28, pct: 5, tone: "danger" },
];

export const dashboardNotepadSeed = [
  "Review pending refunds",
  "Check August revenue report",
  "Call with educator team",
  "Prepare announcement",
  "Plan new features",
];
