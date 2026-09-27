// Regional Growth Analytics + Accreditation/Compliance Reports — mock data.
// Jira: Day 14 — Regional growth analytics + compliance reports
// August 2026 additions — "Regional growth analytics (India-focused)"
// and "Accreditation/compliance reports". Both are newer,
// backend-undetailed additions (treat as UI-only,
// illustrative reporting until real endpoints exist).
//
// Regions here intentionally reuse the same states/cities already seeded
// in institutionsMock.js (Karnataka/Bengaluru, Maharashtra/Pune, Delhi,
// Telangana/Hyderabad, West Bengal/Kolkata, Kerala/Kochi) plus two more
// India regions (Tamil Nadu/Chennai, Gujarat/Ahmedabad) for a fuller
// state-by-state comparison — so numbers stay plausible next to the
// Institution Management screen. Static, deterministic dataset (not the
// pub/sub store pattern — this screen is read-only reporting, like
// FinancialAnalytics/ReportsBuilder, not an editable record list).
//
// UI-only placeholder data; replace with real calls through
// ../services/adminApi.js once the regional-analytics / accreditation
// endpoints exist.

// ---------- Regional growth ----------

export const TIME_PERIOD_OPTIONS = [
  { value: "10d", label: "Last 10 Days" },
  { value: "20d", label: "Last 20 Days" },
  { value: "30d", label: "Last 30 Days" },
  { value: "3m", label: "Last 3 Months" },
  { value: "6m", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
  { value: "custom", label: "Custom Range" },
];

export const REGIONS = [
  {
    id: "REG-KA", state: "Karnataka", city: "Bengaluru", institutions: 2,
    students: 770, educators: 32, revenue: 4820000, momGrowthPct: 8.4, yoyGrowthPct: 34.1,
    trendShare: 0.155,
  },
  {
    id: "REG-MH", state: "Maharashtra", city: "Pune", institutions: 3,
    students: 2122, educators: 82, revenue: 9640000, momGrowthPct: 11.2, yoyGrowthPct: 41.6,
    trendShare: 0.226,
  },
  {
    id: "REG-DL", state: "Delhi", city: "Delhi", institutions: 1,
    students: 340, educators: 11, revenue: 2180000, momGrowthPct: -2.6, yoyGrowthPct: 9.8,
    trendShare: 0.072,
  },
  {
    id: "REG-TS", state: "Telangana", city: "Hyderabad", institutions: 1,
    students: 540, educators: 22, revenue: 3560000, momGrowthPct: 6.1, yoyGrowthPct: 28.4,
    trendShare: 0.108,
  },
  {
    id: "REG-WB", state: "West Bengal", city: "Kolkata", institutions: 2,
    students: 540, educators: 22, revenue: 2940000, momGrowthPct: 4.3, yoyGrowthPct: 19.7,
    trendShare: 0.108,
  },
  {
    id: "REG-KL", state: "Kerala", city: "Kochi", institutions: 2,
    students: 339, educators: 16, revenue: 1860000, momGrowthPct: 9.7, yoyGrowthPct: 37.2,
    trendShare: 0.068,
  },
  {
    id: "REG-TN", state: "Tamil Nadu", city: "Chennai", institutions: 2,
    students: 612, educators: 26, revenue: 3380000, momGrowthPct: 7.5, yoyGrowthPct: 30.9,
    trendShare: 0.123,
  },
  {
    id: "REG-GJ", state: "Gujarat", city: "Ahmedabad", institutions: 1,
    students: 285, educators: 13, revenue: 1620000, momGrowthPct: -0.8, yoyGrowthPct: 14.2,
    trendShare: 0.057,
  },
];

// Sanity note (not enforced at runtime): trendShare across REGIONS sums to
// ~1.0 so per-region monthly trends stay proportional to the national line.

const REFERENCE_DATE = new Date("2026-09-25T00:00:00");

function formatDate(date, includeMonth = true) {
  return date.toLocaleDateString("en-IN", { day: "numeric", month: includeMonth ? "short" : "numeric" });
}

function periodPoints(period, customStart, customEnd) {
  if (period === "custom" && customStart && customEnd) {
    const start = new Date(`${customStart}T00:00:00`);
    const end = new Date(`${customEnd}T00:00:00`);
    if (start <= end) {
      const days = Math.max(1, Math.round((end - start) / 86400000) + 1);
      const count = Math.min(12, Math.max(2, Math.ceil(days / 7)));
      return Array.from({ length: count }, (_, index) => {
        const date = new Date(start);
        date.setDate(start.getDate() + Math.round((days - 1) * (index / (count - 1))));
        return { label: formatDate(date), days };
      });
    }
  }

  const dailyCounts = { "10d": 10, "20d": 20, "30d": 30 };
  if (dailyCounts[period]) {
    return Array.from({ length: dailyCounts[period] }, (_, index) => {
      const date = new Date(REFERENCE_DATE);
      date.setDate(REFERENCE_DATE.getDate() - dailyCounts[period] + index + 1);
      return { label: formatDate(date), days: dailyCounts[period] };
    });
  }

  const monthCounts = { "3m": 3, "6m": 6, year: 9 };
  const count = monthCounts[period] || 3;
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(REFERENCE_DATE.getFullYear(), REFERENCE_DATE.getMonth() - count + index + 1, 1);
    return { label: date.toLocaleDateString("en-IN", { month: "short" }), days: count * 30 };
  });
}

export function getRegionTrend(regionId, period = "30d", customStart = "", customEnd = "") {
  const region = REGIONS.find((r) => r.id === regionId);
  const baseRevenue = region ? region.revenue : REGIONS.reduce((sum, item) => sum + item.revenue, 0);
  const points = periodPoints(period, customStart, customEnd);
  const periodRevenue = baseRevenue * (points[0].days / 30);
  const growth = region?.momGrowthPct || 7.4;

  return points.map((point, index) => ({
    label: point.label,
    value: Math.round((periodRevenue / points.length) * (0.88 + ((index + 1) / points.length) * (growth / 100))),
  }));
}

export function getRegionTotals() {
  return REGIONS.reduce(
    (totals, r) => ({
      institutions: totals.institutions + r.institutions,
      students: totals.students + r.students,
      educators: totals.educators + r.educators,
      revenue: totals.revenue + r.revenue,
    }),
    { institutions: 0, students: 0, educators: 0, revenue: 0 }
  );
}

export function getAverageGrowth() {
  const totalRevenue = REGIONS.reduce((sum, r) => sum + r.revenue, 0);
  const weighted = REGIONS.reduce((sum, r) => sum + r.momGrowthPct * r.revenue, 0);
  return totalRevenue ? weighted / totalRevenue : 0;
}

// ---------- Accreditation & compliance ----------

export const ACCREDITATION_STATUS = {
  ACCREDITED: "accredited",
  PENDING_REVIEW: "pending-review",
  EXPIRING_SOON: "expiring-soon",
  EXPIRED: "expired",
};

export const ACCREDITATION_STATUS_LABEL = {
  [ACCREDITATION_STATUS.ACCREDITED]: "Accredited",
  [ACCREDITATION_STATUS.PENDING_REVIEW]: "Pending Review",
  [ACCREDITATION_STATUS.EXPIRING_SOON]: "Expiring Soon",
  [ACCREDITATION_STATUS.EXPIRED]: "Expired",
};

export const ACCREDITATION_STATUS_BADGE_CLASS = {
  [ACCREDITATION_STATUS.ACCREDITED]: "is-approved",
  [ACCREDITATION_STATUS.PENDING_REVIEW]: "is-pending",
  [ACCREDITATION_STATUS.EXPIRING_SOON]: "is-expiring",
  [ACCREDITATION_STATUS.EXPIRED]: "is-rejected",
};

const CHECKLIST_TEMPLATE = [
  "Curriculum standards alignment",
  "Educator qualification verification",
  "Student data privacy & consent management",
  "Facility / platform safety certification",
  "Financial audit & fee-transparency review",
];

function checklist(statuses) {
  return CHECKLIST_TEMPLATE.map((item, i) => ({ item, status: statuses[i] }));
}

export const COMPLIANCE_RECORDS = [
  {
    id: "ACC-001", institution: "Greenwood International School", state: "Karnataka", city: "Bengaluru",
    accreditationBody: "National Council for Learning Standards (NCLS)",
    status: ACCREDITATION_STATUS.ACCREDITED, complianceScore: 96,
    lastAuditDate: "Jul 12, 2026", expiryDate: "Jul 11, 2027",
    checklist: checklist(["pass", "pass", "pass", "pass", "pass"]),
  },
  {
    id: "ACC-002", institution: "Deccan Regional Education Trust", state: "Maharashtra", city: "Pune",
    accreditationBody: "State Education Board — Maharashtra",
    status: ACCREDITATION_STATUS.ACCREDITED, complianceScore: 91,
    lastAuditDate: "Jun 3, 2026", expiryDate: "Jun 2, 2027",
    checklist: checklist(["pass", "pass", "pass", "pass", "pending"]),
  },
  {
    id: "ACC-003", institution: "Nova Achievers Coaching Centre", state: "Delhi", city: "Delhi",
    accreditationBody: "ISO 21001:2018 (Educational Organizations)",
    status: ACCREDITATION_STATUS.PENDING_REVIEW, complianceScore: 68,
    lastAuditDate: "Feb 20, 2026", expiryDate: "—",
    checklist: checklist(["pass", "pending", "pending", "pass", "pending"]),
    notes: "First-time accreditation application — initial document review in progress.",
  },
  {
    id: "ACC-004", institution: "Sunrise Public School", state: "Telangana", city: "Hyderabad",
    accreditationBody: "National Council for Learning Standards (NCLS)",
    status: ACCREDITATION_STATUS.EXPIRING_SOON, complianceScore: 83,
    lastAuditDate: "Nov 5, 2025", expiryDate: "Oct 30, 2026",
    checklist: checklist(["pass", "pass", "pass", "pending", "pass"]),
    notes: "Facility safety re-certification due before renewal.",
  },
  {
    id: "ACC-005", institution: "Eastern Frontier School Group", state: "West Bengal", city: "Kolkata",
    accreditationBody: "State Education Board — West Bengal",
    status: ACCREDITATION_STATUS.ACCREDITED, complianceScore: 88,
    lastAuditDate: "May 18, 2026", expiryDate: "May 17, 2027",
    checklist: checklist(["pass", "pass", "pass", "pass", "pass"]),
  },
  {
    id: "ACC-006", institution: "Coastal Coaching Academy", state: "Kerala", city: "Kochi",
    accreditationBody: "ISO 21001:2018 (Educational Organizations)",
    status: ACCREDITATION_STATUS.EXPIRED, complianceScore: 54,
    lastAuditDate: "Mar 9, 2025", expiryDate: "Mar 8, 2026",
    checklist: checklist(["pass", "fail", "pass", "fail", "pending"]),
    notes: "Renewal application overdue — data-privacy consent workflow failed re-audit.",
  },
];

export function getComplianceSummary() {
  const accredited = COMPLIANCE_RECORDS.filter((r) => r.status === ACCREDITATION_STATUS.ACCREDITED).length;
  const pending = COMPLIANCE_RECORDS.filter((r) => r.status === ACCREDITATION_STATUS.PENDING_REVIEW).length;
  const expiringSoon = COMPLIANCE_RECORDS.filter((r) => r.status === ACCREDITATION_STATUS.EXPIRING_SOON).length;
  const expired = COMPLIANCE_RECORDS.filter((r) => r.status === ACCREDITATION_STATUS.EXPIRED).length;
  const avgScore = Math.round(
    COMPLIANCE_RECORDS.reduce((sum, r) => sum + r.complianceScore, 0) / COMPLIANCE_RECORDS.length
  );
  return { accredited, pending, expiringSoon, expired, avgScore, total: COMPLIANCE_RECORDS.length };
}

// Recently generated / scheduled compliance & accreditation reports —
// mirrors the "downloadable/scheduled reports" August addition. Download
// is a mock action (no real file generation) same as elsewhere in Admin.
export const COMPLIANCE_REPORTS = [
  { id: "CR-2026-041", name: "Q3 Accreditation Status Summary", type: "Accreditation", region: "All India", generatedDate: "Sep 18, 2026", format: "PDF" },
  { id: "CR-2026-040", name: "Data Privacy & Consent Compliance Audit", type: "Compliance", region: "All India", generatedDate: "Sep 15, 2026", format: "PDF" },
  { id: "CR-2026-039", name: "Karnataka Region — Growth & Enrollment", type: "Regional Growth", region: "Karnataka", generatedDate: "Sep 10, 2026", format: "CSV" },
  { id: "CR-2026-038", name: "Facility Safety Re-certification Tracker", type: "Compliance", region: "Telangana", generatedDate: "Sep 4, 2026", format: "PDF" },
  { id: "CR-2026-037", name: "Maharashtra Region — Growth & Enrollment", type: "Regional Growth", region: "Maharashtra", generatedDate: "Aug 29, 2026", format: "CSV" },
  { id: "CR-2026-036", name: "Annual Accreditation Renewal Schedule", type: "Accreditation", region: "All India", generatedDate: "Aug 20, 2026", format: "PDF" },
];

