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
