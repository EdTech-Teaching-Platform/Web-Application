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

// 8 months of aggregate India-wide new-enrollment figures, used for the
// "All India" trend line and to derive each region's own monthly slice
// proportionally (keeps per-region trends internally consistent with the
// region's headline student count without hand-authoring 8x6 numbers).
export const NATIONAL_TREND_MONTHS = ["Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep"];
const NATIONAL_TREND_INDEX = [3120, 3340, 3510, 3690, 3980, 4260, 4640, 4990];

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

export function getNationalTrend() {
  return NATIONAL_TREND_MONTHS.map((label, index) => ({ label, value: NATIONAL_TREND_INDEX[index] }));
}

export function getRegionTrend(regionId) {
  if (!regionId || regionId === "all") return getNationalTrend();
  const region = REGIONS.find((r) => r.id === regionId);
  if (!region) return getNationalTrend();
  return NATIONAL_TREND_MONTHS.map((label, index) => ({
    label,
    value: Math.round(NATIONAL_TREND_INDEX[index] * region.trendShare),
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
  const totalStudents = REGIONS.reduce((sum, r) => sum + r.students, 0);
  const weighted = REGIONS.reduce((sum, r) => sum + r.momGrowthPct * r.students, 0);
  return totalStudents ? weighted / totalStudents : 0;
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

