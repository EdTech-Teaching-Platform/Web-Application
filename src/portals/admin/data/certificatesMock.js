// Certificate Management — mock data.
// Jira: Day 13 — Settings & permissions + certificate mgmt
// Certificates are normally auto-issued on course completion and
// idempotent (re-completing a course never issues a duplicate). Admin
// additionally gets a manual "Issue Certificate" action for edge cases
// (e.g. a completion recorded outside the normal flow) and a "Revoke"
// action with a required reason — both are audit-relevant actions that
// should be written to the audit log (conceptual only here; no real
// audit-log integration is wired up).
//
// UI-only placeholder data; replace with real calls through
// ../services/adminApi.js once the certificate endpoints exist. Follows
// the same tiny pub/sub "store" pattern already used by
// data/studentsMock.js / data/educatorsMock.js so SettingsPermissions.jsx
// stays in sync across re-renders without a real API layer.

import { useSyncExternalStore } from "react";

export const CERT_STATUS = {
  ISSUED: "issued",
  REVOKED: "revoked",
};

export const CERT_STATUS_LABEL = {
  [CERT_STATUS.ISSUED]: "Issued",
  [CERT_STATUS.REVOKED]: "Revoked",
};

export const CERT_STATUS_BADGE_CLASS = {
  [CERT_STATUS.ISSUED]: "is-approved",
  [CERT_STATUS.REVOKED]: "is-rejected",
};

const SEED_CERTIFICATES = [
  { certNumber: "CERT-2026-00142", studentName: "Aarav Sharma", courseName: "Data Structures & Algorithms — Foundations", educatorName: "Dr. Kavita Menon", issueDate: "Sep 18, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00143", studentName: "Meera Iyer", courseName: "Spoken English for Working Professionals", educatorName: "James Fernandes", issueDate: "Sep 17, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00144", studentName: "Kabir Malhotra", courseName: "Applied Machine Learning for Developers", educatorName: "Dr. Sameer Joshi", issueDate: "Sep 15, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00145", studentName: "Ananya Reddy", courseName: "Business Analytics with Excel & SQL", educatorName: "Lakshmi Narayan", issueDate: "Sep 14, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00146", studentName: "Ishaan Verma", courseName: "Cryptocurrency Trading Masterclass", educatorName: "Rohit Ahuja", issueDate: "Sep 12, 2026", status: CERT_STATUS.REVOKED, revokedReason: "Course completion flagged as fraudulent — video watch-time did not match completion timestamp.", revokedDate: "Sep 16, 2026", revokedBy: "Radhika Krishnan" },
  { certNumber: "CERT-2026-00147", studentName: "Diya Nair", courseName: "Modern World History: 1900–Present", educatorName: "Prof. Anand Pillai", issueDate: "Sep 10, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00148", studentName: "Rohan Gupta", courseName: "Advanced Data Structures", educatorName: "Dr. Kavita Menon", issueDate: "Sep 9, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00149", studentName: "Sneha Joshi", courseName: "Applied Machine Learning for Developers", educatorName: "Dr. Sameer Joshi", issueDate: "Sep 8, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00150", studentName: "Tanvi Kulkarni", courseName: "UI/UX Design Fundamentals", educatorName: "Rhea Kapadia", issueDate: "Sep 6, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00151", studentName: "Aditya Singh", courseName: "Spoken English for Working Professionals", educatorName: "James Fernandes", issueDate: "Sep 5, 2026", status: CERT_STATUS.REVOKED, revokedReason: "Duplicate account — original certificate already issued under a merged account.", revokedDate: "Sep 7, 2026", revokedBy: "Arjun Kapoor" },
  { certNumber: "CERT-2026-00152", studentName: "Priyanka Das", courseName: "Business Analytics with Excel & SQL", educatorName: "Lakshmi Narayan", issueDate: "Sep 4, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00153", studentName: "Karan Malhotra", courseName: "Data Structures & Algorithms — Foundations", educatorName: "Dr. Kavita Menon", issueDate: "Sep 3, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00154", studentName: "Simran Kaur", courseName: "Modern World History: 1900–Present", educatorName: "Prof. Anand Pillai", issueDate: "Sep 1, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00155", studentName: "Yash Trivedi", courseName: "UI/UX Design Fundamentals", educatorName: "Rhea Kapadia", issueDate: "Aug 29, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00156", studentName: "Nikita Shah", courseName: "Cryptocurrency Trading Masterclass", educatorName: "Rohit Ahuja", issueDate: "Aug 27, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00157", studentName: "Devansh Patel", courseName: "Advanced Data Structures", educatorName: "Dr. Kavita Menon", issueDate: "Aug 25, 2026", status: CERT_STATUS.ISSUED },
  { certNumber: "CERT-2026-00158", studentName: "Riya Chatterjee", courseName: "Applied Machine Learning for Developers", educatorName: "Dr. Sameer Joshi", issueDate: "Aug 22, 2026", status: CERT_STATUS.REVOKED, revokedReason: "Student requested account and certificate deletion under a data-privacy request.", revokedDate: "Aug 24, 2026", revokedBy: "Radhika Krishnan" },
  { certNumber: "CERT-2026-00159", studentName: "Manav Bhatia", courseName: "Business Analytics with Excel & SQL", educatorName: "Lakshmi Narayan", issueDate: "Aug 20, 2026", status: CERT_STATUS.ISSUED },
];

// ---------- tiny mock "store" (mirrors ../data/studentsMock.js) ----------
let _certificates = [...SEED_CERTIFICATES];
const _listeners = new Set();
function _notify() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}

export function useCertificates() {
  return useSyncExternalStore(_subscribe, () => _certificates);
}

// Manual issue — for edge cases only; normal issuance is automatic and
// idempotent on course completion. Generates a sequential cert
// number in the same CERT-YYYY-##### shape as the seed data.
export function issueCertificate({ studentName, courseName, educatorName }) {
  const year = new Date().getFullYear();
  const nextSeq = _certificates.length + 143;
  const certNumber = `CERT-${year}-${String(nextSeq).padStart(5, "0")}`;
  const issueDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  _certificates = [
    { certNumber, studentName, courseName, educatorName, issueDate, status: CERT_STATUS.ISSUED },
    ..._certificates,
  ];
  _notify();
  return certNumber;
}

export function revokeCertificate(certNumber, reason, revokedBy = "Admin User") {
  const revokedDate = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  _certificates = _certificates.map((c) =>
    c.certNumber === certNumber
      ? { ...c, status: CERT_STATUS.REVOKED, revokedReason: reason || "Revoked by admin.", revokedDate, revokedBy }
      : c
  );
  _notify();
}
