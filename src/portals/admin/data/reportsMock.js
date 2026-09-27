// Admin Reports & Analytics mock data and selectors.
// The report builder reads the same realistic INR transactions as Financial Analytics,
// enriched with deterministic synthetic joins (category, test series, region, student)
// so every builder filter below is genuinely functional. Report Type drives which
// columns/summary totals are shown: some types are record-level (Revenue, Enrollment,
// Student Activity) and some are aggregated roll-ups (Course/Test Series/Educator
// Performance, Regional Growth, User Growth).

import { financialAnalyticsTransactions } from "./financialAnalyticsMock";
import { CATEGORY_OPTIONS } from "./coursesMock";
import { REGIONS } from "./regionalAnalyticsMock";

export const REPORT_FIELD_OPTIONS = [
  { key: "date", label: "Date" },
  { key: "course", label: "Course" },
  { key: "category", label: "Category" },
  { key: "testSeries", label: "Test Series" },
  { key: "educator", label: "Educator" },
  { key: "courses", label: "Courses" },
  { key: "student", label: "Student" },
  { key: "amount", label: "Amount" },
  { key: "revenue", label: "Revenue" },
  { key: "enrollments", label: "Enrollments" },
  { key: "newStudents", label: "New Students" },
  { key: "region", label: "Region / Branch" },
  { key: "month", label: "Month" },
  { key: "status", label: "Status" },
];

// Report type determines the columns shown in the generated report/preview —
// no manual field picker needed. "none" is the unselected placeholder state.
export const REPORT_TYPE_COLUMNS = {
  revenue: ["date", "course", "educator", "amount", "status"],
  enrollment: ["date", "student", "course", "category", "status"],
  course_performance: ["course", "category", "enrollments", "revenue"],
  test_series_performance: ["testSeries", "enrollments", "revenue"],
  educator_performance: ["educator", "courses", "enrollments", "revenue"],
  student_activity: ["date", "student", "course", "testSeries", "status"],
  regional_growth: ["region", "enrollments", "revenue"],
  user_growth: ["month", "newStudents", "enrollments", "revenue"],
};

export const REPORT_TYPE_OPTIONS = [
  { value: "none", label: "None" },
  { value: "revenue", label: "Revenue" },
  { value: "enrollment", label: "Enrollment" },
  { value: "course_performance", label: "Course Performance" },
  { value: "test_series_performance", label: "Test Series Performance" },
  { value: "educator_performance", label: "Educator Performance" },
  { value: "student_activity", label: "Student Activity" },
  { value: "regional_growth", label: "Regional Growth" },
  { value: "user_growth", label: "User Growth" },
];

export const REPORT_STATUS_OPTIONS = ["none", "all", "paid", "processing", "pending", "failed", "refunded"];

// Which filter fields are relevant to each Report Type — the builder only
// shows the fields that actually matter for that report, and they reset
// whenever the Report Type changes.
export const REPORT_TYPE_FIELDS = {
  revenue: ["status", "category", "course", "educator", "region", "student"],
  enrollment: ["status", "category", "course", "region", "student"],
  course_performance: ["status", "category", "course", "region"],
  test_series_performance: ["status", "testSeries", "region"],
  educator_performance: ["status", "educator", "region"],
  student_activity: ["status", "student", "course", "testSeries"],
  regional_growth: ["status", "region"],
  user_growth: ["status", "region"],
};

const TEST_SERIES_NAME_POOL = [
  "JEE Main Physics Test Series 2026",
  "NEET Biology Full Mock Series",
  "CBSE Class 10 Mathematics Test Series",
  "Bank PO Reasoning & Aptitude Series",
  "UPSC Prelims General Studies Test Series",
];
const STUDENT_NAME_POOL = [
  "Kavya Nair", "Arjun Reddy", "Sanya Kapoor", "Dev Patel",
  "Ishita Rao", "Yash Malhotra", "Tanya Bose", "Rahul Menon",
];

function hashIndex(str, mod) {
  let h = 0;
  for (let i = 0; i < String(str).length; i++) h = (h * 31 + String(str).charCodeAt(i)) >>> 0;
  return h % mod;
}

function deriveCategory(title) {
  const t = title.toLowerCase();
  if (/machine learning|data analytics|\bai\b/.test(t)) return "Data & AI";
  if (/marketing|seo|business|finance|accounting|tally|\bgst\b|leadership/.test(t)) return "Business";
  if (/english|communication|writing|presentation/.test(t)) return "Language";
  if (/react|javascript|python|node|typescript|docker|kubernetes|azure|\baws\b|\bsql\b|power bi|git|api|full stack|devops|design|canva|\bui\b/.test(t)) return "Computer Science";
  return CATEGORY_OPTIONS[hashIndex(title, CATEGORY_OPTIONS.length)];
}

const regionLabels = REGIONS.map((r) => `${r.state} (${r.city})`);

export const REPORT_CATEGORY_OPTIONS = ["none", "all", ...CATEGORY_OPTIONS];
export const REPORT_TEST_SERIES_OPTIONS = ["none", "all", ...TEST_SERIES_NAME_POOL];
export const REPORT_REGION_OPTIONS = ["none", "all", ...regionLabels];
export const REPORT_STUDENT_OPTIONS = ["none", "all", ...STUDENT_NAME_POOL];
export const REPORT_EDUCATOR_OPTIONS = ["none", "all", ...new Set(financialAnalyticsTransactions.map((row) => row.educatorName))];
export const REPORT_COURSE_OPTIONS = ["none", "all", ...new Set(financialAnalyticsTransactions.map((row) => row.courseTitle))];

export const reportRows = financialAnalyticsTransactions.map((row, i) => ({
  ...row,
  student: row.studentId,
  category: deriveCategory(row.courseTitle),
  // Only a portion of purchases are test-series enrollments — deterministic, not random.
  testSeriesName: hashIndex(row.id, 4) === 0 ? TEST_SERIES_NAME_POOL[hashIndex(row.id + "ts", TEST_SERIES_NAME_POOL.length)] : null,
  region: regionLabels[hashIndex(row.id + "r", regionLabels.length)],
  studentName: STUDENT_NAME_POOL[hashIndex(row.studentId, STUDENT_NAME_POOL.length)],
}));

function matchesFilters(row, config) {
  const { status, educator, course, category, testSeries, region, student } = config;
  return (
    (status === "all" || row.status === status) &&
    (educator === "all" || row.educatorName === educator) &&
    (course === "all" || row.courseTitle === course) &&
    (category === "all" || row.category === category) &&
    (testSeries === "all" || row.testSeriesName === testSeries) &&
    (region === "all" || row.region === region) &&
    (student === "all" || row.studentName === student)
  );
}

// Record-level rows (filters + date range applied), used directly by the
// record-level report types and as the source rows for every aggregation.
export function getReportRows(config) {
  const { range } = config;
  const latestTime = reportRows.reduce((latest, row) => Math.max(latest, new Date(`${row.date}T00:00:00`).getTime()), 0);
  const cutoff = range === "all" ? 0 : latestTime - Number(range) * 86400000;
  return reportRows.filter((row) => {
    const inRange = new Date(`${row.date}T00:00:00`).getTime() >= cutoff;
    return inRange && matchesFilters(row, config);
  });
}

function sortByDateDesc(rows) {
  return [...rows].sort((a, b) => new Date(b.date) - new Date(a.date));
}
function sortByRevenueDesc(rows) {
  return [...rows].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));
}

function aggregate(rows, keyFn, seed) {
  const grouped = new Map();
  rows.forEach((row) => {
    const key = keyFn(row);
    if (key == null) return;
    if (!grouped.has(key)) grouped.set(key, seed(key));
    const bucket = grouped.get(key);
    bucket.enrollments += 1;
    bucket.revenue += row.status === "paid" || row.status === "refunded" ? row.amount : 0;
    if (bucket._courseSet) bucket._courseSet.add(row.courseTitle);
  });
  return Array.from(grouped.values()).map((bucket) => {
    const { _courseSet, ...rest } = bucket;
    if (_courseSet) rest.courses = _courseSet.size;
    return rest;
  });
}

// Builds the report table rows shown in the generated-report preview: either
// the filtered record-level rows, or a roll-up aggregated by the dimension
// that the selected Report Type is about.
export function getReportTableRows(reportType, filteredRows) {
  switch (reportType) {
    case "revenue":
    case "enrollment":
    case "student_activity":
      return sortByDateDesc(filteredRows);
    case "course_performance":
      return sortByRevenueDesc(
        aggregate(filteredRows, (r) => r.courseTitle, (key) => ({ id: key, course: key, category: deriveCategory(key), enrollments: 0, revenue: 0 }))
      );
    case "test_series_performance":
      return sortByRevenueDesc(
        aggregate(filteredRows.filter((r) => r.testSeriesName), (r) => r.testSeriesName, (key) => ({ id: key, testSeries: key, enrollments: 0, revenue: 0 }))
      );
    case "educator_performance":
      return sortByRevenueDesc(
        aggregate(filteredRows, (r) => r.educatorName, (key) => ({ id: key, educator: key, enrollments: 0, revenue: 0, _courseSet: new Set() }))
      );
    case "regional_growth":
      return sortByRevenueDesc(
        aggregate(filteredRows, (r) => r.region, (key) => ({ id: key, region: key, enrollments: 0, revenue: 0 }))
      );
    case "user_growth": {
      const grouped = new Map();
      filteredRows.forEach((row) => {
        const key = row.date.slice(0, 7);
        if (!grouped.has(key)) {
          grouped.set(key, {
            id: key,
            month: new Date(`${key}-01T00:00:00`).toLocaleDateString(undefined, { month: "short", year: "numeric" }),
            enrollments: 0,
            revenue: 0,
            _studentSet: new Set(),
          });
        }
        const bucket = grouped.get(key);
        bucket.enrollments += 1;
        bucket.revenue += row.status === "paid" || row.status === "refunded" ? row.amount : 0;
        bucket._studentSet.add(row.studentName);
      });
      return Array.from(grouped.keys())
        .sort()
        .map((key) => {
          const { _studentSet, ...rest } = grouped.get(key);
          return { ...rest, newStudents: _studentSet.size };
        });
    }
    default:
      return [];
  }
}

// Summary cards shown above the generated report — tailored per report type
// so they always reflect real totals for what's on screen, never leftover
// financial-report fields (commission/payout/gateway) that no longer apply.
export function getReportSummary(reportType, tableRows, filteredRows) {
  const total = (rows, key) => rows.reduce((sum, row) => sum + (row[key] || 0), 0);
  switch (reportType) {
    case "revenue":
      return [
        { label: "Total revenue", value: filteredRows.filter((r) => r.status === "paid" || r.status === "refunded").reduce((s, r) => s + r.amount, 0), money: true },
        { label: "Refunded amount", value: filteredRows.filter((r) => r.status === "refunded").reduce((s, r) => s + r.amount, 0), money: true },
        { label: "Matching rows", value: filteredRows.length },
      ];
    case "enrollment":
      return [
        { label: "Total enrollments", value: filteredRows.length },
        { label: "Paid enrollments", value: filteredRows.filter((r) => r.status === "paid").length },
        { label: "Matching rows", value: filteredRows.length },
      ];
    case "course_performance":
      return [
        { label: "Courses", value: tableRows.length },
        { label: "Total revenue", value: total(tableRows, "revenue"), money: true },
        { label: "Total enrollments", value: total(tableRows, "enrollments") },
      ];
    case "test_series_performance":
      return [
        { label: "Test series", value: tableRows.length },
        { label: "Total revenue", value: total(tableRows, "revenue"), money: true },
        { label: "Total enrollments", value: total(tableRows, "enrollments") },
      ];
    case "educator_performance":
      return [
        { label: "Educators", value: tableRows.length },
        { label: "Total revenue", value: total(tableRows, "revenue"), money: true },
        { label: "Total enrollments", value: total(tableRows, "enrollments") },
      ];
    case "student_activity":
      return [
        { label: "Active students", value: new Set(filteredRows.map((r) => r.studentName)).size },
        { label: "Activity records", value: filteredRows.length },
        { label: "Matching rows", value: filteredRows.length },
      ];
    case "regional_growth":
      return [
        { label: "Regions", value: tableRows.length },
        { label: "Total revenue", value: total(tableRows, "revenue"), money: true },
        { label: "Total enrollments", value: total(tableRows, "enrollments") },
      ];
    case "user_growth":
      return [
        { label: "Months tracked", value: tableRows.length },
        { label: "New students", value: total(tableRows, "newStudents") },
        { label: "Total enrollments", value: total(tableRows, "enrollments") },
      ];
    default:
      return [];
  }
}
