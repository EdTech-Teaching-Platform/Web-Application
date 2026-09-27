// Financial Analytics mock data for the Admin analytics screen.
// Replace this deterministic dataset with API-backed reporting queries when available.

import { TRANSACTION_STATUS_LABEL } from "./paymentsMock";

const DAY_MS = 86400000;

const ANALYTICS_COMMISSION_RATE = 0.2;
const transactionSeeds = [
  ["TXN-FA-1028", "2026-09-16", 2499, "paid", "UPI", "Aarav Mehta", "Advanced React Patterns", "STU-8412"],
  ["TXN-FA-1027", "2026-09-15", 1799, "paid", "Razorpay", "Priya Sharma", "Data Analytics with Python", "STU-8398"],
  ["TXN-FA-1026", "2026-09-14", 3499, "processing", "Credit Card", "Vikram Singh", "AWS Cloud Practitioner", "STU-8364"],
  ["TXN-FA-1025", "2026-09-13", 999, "paid", "UPI", "Neha Kapoor", "Spoken English Masterclass", "STU-8321"],
  ["TXN-FA-1024", "2026-09-12", 2199, "refunded", "NetBanking", "Rohan Desai", "Financial Literacy 101", "STU-8287"],
  ["TXN-FA-1023", "2026-09-11", 4999, "paid", "EMI", "Aarav Mehta", "Full Stack Development Bootcamp", "STU-8246"],
  ["TXN-FA-1022", "2026-09-10", 1299, "pending", "Wallet", "Priya Sharma", "UI Design Fundamentals", "STU-8190"],
  ["TXN-FA-1021", "2026-09-09", 1599, "paid", "UPI", "Vikram Singh", "SQL for Business Analysts", "STU-8144"],
  ["TXN-FA-1020", "2026-09-08", 2899, "paid", "Credit Card", "Neha Kapoor", "Digital Marketing Strategy", "STU-8097"],
  ["TXN-FA-1019", "2026-09-07", 799, "failed", "UPI", "Rohan Desai", "Excel Productivity Course", "STU-8042"],
  ["TXN-FA-1018", "2026-09-06", 2399, "paid", "Razorpay", "Aarav Mehta", "Node.js API Engineering", "STU-7984"],
  ["TXN-FA-1017", "2026-09-05", 1899, "refunded", "Credit Card", "Priya Sharma", "Business Communication", "STU-7933"],
  ["TXN-FA-1016", "2026-09-04", 3299, "paid", "NetBanking", "Vikram Singh", "Azure Fundamentals", "STU-7882"],
  ["TXN-FA-1015", "2026-09-03", 1499, "paid", "UPI", "Neha Kapoor", "Content Writing Essentials", "STU-7819"],
  ["TXN-FA-1014", "2026-09-02", 2699, "processing", "Razorpay", "Rohan Desai", "Power BI Dashboards", "STU-7764"],
  ["TXN-FA-1013", "2026-09-01", 899, "paid", "Wallet", "Aarav Mehta", "Git and GitHub Basics", "STU-7701"],
  ["TXN-FA-1012", "2026-08-28", 3999, "paid", "EMI", "Priya Sharma", "Machine Learning Foundations", "STU-7630"],
  ["TXN-FA-1011", "2026-08-24", 1199, "pending", "UPI", "Vikram Singh", "Presentation Skills", "STU-7568"],
  ["TXN-FA-1010", "2026-08-20", 2299, "paid", "Credit Card", "Neha Kapoor", "SEO and Growth Marketing", "STU-7491"],
  ["TXN-FA-1009", "2026-08-16", 1599, "refunded", "NetBanking", "Rohan Desai", "Accounting with Tally", "STU-7425"],
  ["TXN-FA-1008", "2026-08-12", 2799, "paid", "UPI", "Aarav Mehta", "React and TypeScript", "STU-7364"],
  ["TXN-FA-1007", "2026-08-08", 999, "failed", "Wallet", "Priya Sharma", "Interview Preparation", "STU-7298"],
  ["TXN-FA-1006", "2026-08-04", 4499, "paid", "EMI", "Vikram Singh", "DevOps with Docker", "STU-7210"],
  ["TXN-FA-1005", "2026-07-28", 1899, "paid", "Razorpay", "Neha Kapoor", "Social Media Management", "STU-7147"],
  ["TXN-FA-1004", "2026-07-20", 1399, "paid", "UPI", "Rohan Desai", "Personal Finance Planning", "STU-7066"],
  ["TXN-FA-1003", "2026-07-11", 2599, "paid", "Credit Card", "Aarav Mehta", "JavaScript Advanced Concepts", "STU-6988"],
  ["TXN-FA-1002", "2026-06-29", 1699, "paid", "NetBanking", "Priya Sharma", "Leadership Essentials", "STU-6872"],
  ["TXN-FA-1001", "2026-06-15", 3199, "paid", "Razorpay", "Vikram Singh", "Kubernetes for Beginners", "STU-6754"],
  ["TXN-FA-1000", "2026-06-02", 1299, "paid", "UPI", "Neha Kapoor", "Canva Design Workshop", "STU-6618"],
  ["TXN-FA-0999", "2026-05-19", 2099, "paid", "Credit Card", "Rohan Desai", "GST and Small Business Tax", "STU-6490"],
];

export const financialAnalyticsTransactions = transactionSeeds.map(
  ([id, date, amount, status, method, educatorName, courseTitle, studentId], index) => ({
    id,
    date,
    amount,
    status,
    method,
    educatorId: `EDU-FA-${(index % 5) + 1}`,
    educatorName,
    courseTitle,
    studentId,
    commission: Math.round(amount * ANALYTICS_COMMISSION_RATE),
    net: Math.round(amount * (1 - ANALYTICS_COMMISSION_RATE)),
  })
);

export function getAnalyticsMetrics(transactions) {
  const completed = transactions.filter((t) => t.status === "paid" || t.status === "refunded");
  const grossRevenue = completed.reduce((sum, t) => sum + t.amount, 0);
  const refunds = transactions.filter((t) => t.status === "refunded").reduce((sum, t) => sum + t.amount, 0);
  const commission = transactions.filter((t) => t.status === "paid").reduce((sum, t) => sum + t.commission, 0);
  const educatorPayouts = transactions.filter((t) => t.status === "paid").reduce((sum, t) => sum + t.net, 0);
  return { grossRevenue, refunds, commission, educatorPayouts, netRevenue: grossRevenue - refunds - educatorPayouts };
}

export function getAnalyticsTrend(transactions, range, latestTransactionTime) {
  const days = range === "all" ? 7 : Math.min(7, Math.max(3, Math.ceil(Number(range) / 7)));
  const bucketSize = Math.max(1, Math.ceil(Number(range === "all" ? 30 : range) / days));
  const end = new Date(latestTransactionTime || Date.UTC(2026, 0, 1));

  return Array.from({ length: days }, (_, index) => {
    const start = new Date(end);
    start.setDate(end.getDate() - (days - 1 - index) * bucketSize);
    const dayKey = start.toISOString().slice(0, 10);
    const nextKey = new Date(start.getTime() + bucketSize * DAY_MS).toISOString().slice(0, 10);
    const bucket = transactions.filter((t) => t.date >= dayKey && t.date < nextKey);
    return {
      label: new Date(`${dayKey}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      revenue: bucket.filter((t) => t.status === "paid" || t.status === "refunded").reduce((sum, t) => sum + t.amount, 0),
      commission: bucket.filter((t) => t.status === "paid").reduce((sum, t) => sum + t.commission, 0),
      refunds: bucket.filter((t) => t.status === "refunded").reduce((sum, t) => sum + t.amount, 0),
    };
  });
}

export function getAnalyticsStatusRows(transactions) {
  const counts = {};
  transactions.forEach((t) => { counts[t.status] = (counts[t.status] || 0) + 1; });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([status, count]) => ({ status, label: TRANSACTION_STATUS_LABEL[status] || status, count }));
}

export function getAnalyticsMethodRows(transactions) {
  const methods = {};
  transactions.forEach((t) => { methods[t.method] = (methods[t.method] || 0) + t.amount; });
  return Object.entries(methods)
    .sort((a, b) => b[1] - a[1])
    .map(([method, amount]) => ({ method, amount }));
}

export function getAnalyticsEducatorRows(transactions) {
  const educators = {};
  transactions.filter((t) => t.status === "paid").forEach((t) => {
    const row = educators[t.educatorId] || { name: t.educatorName, revenue: 0, payout: 0, commission: 0 };
    row.revenue += t.amount;
    row.payout += t.net;
    row.commission += t.commission;
    educators[t.educatorId] = row;
  });
  return Object.values(educators).sort((a, b) => b.revenue - a.revenue).slice(0, 6);
}

// Top performing courses by revenue, for the Financial Analytics dashboard.
export const TOP_PERFORMING_COURSES = [
  { name: "Full Stack Development Bootcamp", category: "Computer Science", enrollments: 1284, revenue: 6412000, performance: 96 },
  { name: "Data Analytics with Python", category: "Data & AI", enrollments: 968, revenue: 4184000, performance: 91 },
  { name: "Digital Marketing Strategy", category: "Business", enrollments: 1102, revenue: 3196000, performance: 87 },
  { name: "AWS Cloud Practitioner", category: "Computer Science", enrollments: 741, revenue: 2593000, performance: 84 },
  { name: "UI Design Fundamentals", category: "Design", enrollments: 856, revenue: 1972000, performance: 79 },
];
