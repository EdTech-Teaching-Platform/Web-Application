// Admin Reports & Analytics mock data and selectors.
// The report builder reads the same realistic INR transactions as Financial Analytics.

import { financialAnalyticsTransactions } from "./financialAnalyticsMock";

export const REPORT_FIELD_OPTIONS = [
  { key: "date", label: "Date" },
  { key: "transaction", label: "Transaction" },
  { key: "educator", label: "Educator" },
  { key: "course", label: "Course" },
  { key: "amount", label: "Amount" },
  { key: "commission", label: "Commission" },
  { key: "payout", label: "Educator payout" },
  { key: "status", label: "Payment status" },
  { key: "method", label: "Payment method" },
];

export const REPORT_TYPE_OPTIONS = [
  { value: "revenue", label: "Revenue & commission" },
  { value: "transactions", label: "Transaction activity" },
  { value: "educators", label: "Educator payouts" },
  { value: "refunds", label: "Refund & payment status" },
];

export const REPORT_FORMAT_OPTIONS = [
  { value: "table", label: "Table" },
  { value: "chart", label: "Bar chart" },
];

export const REPORT_STATUS_OPTIONS = ["all", "paid", "processing", "pending", "failed", "refunded"];
export const REPORT_METHOD_OPTIONS = ["all", ...new Set(financialAnalyticsTransactions.map((row) => row.method))];
export const REPORT_EDUCATOR_OPTIONS = ["all", ...new Set(financialAnalyticsTransactions.map((row) => row.educatorName))];

export const reportRows = financialAnalyticsTransactions.map((row) => ({ ...row, student: row.studentId }));

export function getReportRows({ range, reportType, status, method, educator }) {
  const latestTime = reportRows.reduce((latest, row) => Math.max(latest, new Date(`${row.date}T00:00:00`).getTime()), 0);
  const cutoff = range === "all" ? 0 : latestTime - Number(range) * 86400000;
  return reportRows.filter((row) => {
    const inRange = new Date(`${row.date}T00:00:00`).getTime() >= cutoff;
    const matchesType = reportType === "educators" ? row.status === "paid" : reportType === "refunds" ? ["refunded", "failed", "pending", "processing"].includes(row.status) : true;
    return inRange && matchesType && (status === "all" || row.status === status) && (method === "all" || row.method === method) && (educator === "all" || row.educatorName === educator);
  });
}

export function getReportSummary(rows) {
  const revenue = rows.filter((row) => row.status === "paid" || row.status === "refunded").reduce((sum, row) => sum + row.amount, 0);
  const commission = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.commission, 0);
  const payout = rows.filter((row) => row.status === "paid").reduce((sum, row) => sum + row.net, 0);
  const refunds = rows.filter((row) => row.status === "refunded").reduce((sum, row) => sum + row.amount, 0);
  return { revenue, commission, payout, refunds, transactions: rows.length };
}

export function getReportTrend(rows) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = row.date.slice(0, 7);
    const current = grouped.get(key) || { key, label: new Date(`${row.date}T00:00:00`).toLocaleDateString(undefined, { month: "short" }), amount: 0, commission: 0 };
    if (row.status === "paid" || row.status === "refunded") current.amount += row.amount;
    if (row.status === "paid") current.commission += row.commission;
    grouped.set(key, current);
  });
  return Array.from(grouped.values()).sort((a, b) => a.key.localeCompare(b.key));
}