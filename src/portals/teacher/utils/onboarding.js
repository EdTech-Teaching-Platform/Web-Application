// Educator onboarding and portal rules on the client. They mirror the server
// (adm_educator_validate in 20261028090100 and educator-upload-url's
// validate.ts) so problems show before a request; the server checks again.

export const ONBOARDING_STEPS = [
  { step: 1, key: "personal", title: "Personal and contact", fields: ["full_name", "phone", "location"] },
  { step: 2, key: "qualifications", title: "Qualifications and experience", fields: ["qualifications", "experience_years"] },
  { step: 3, key: "about", title: "Subjects, languages and bio", fields: ["subjects", "languages", "bio"] },
  { step: 4, key: "documents", title: "ID verification", fields: [] },
  { step: 5, key: "review", title: "Review and submit", fields: [] },
];

export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp"];
export const CERTIFICATE_TYPES = ["degree_certificate", "teaching_license", "experience_letter", "subject_certificate"];

// The documents the ID step asks for.
export const REQUIRED_DOCUMENTS = [
  { docType: "government_id", docName: "front", label: "Government ID: front", required: true },
  { docType: "government_id", docName: "back", label: "Government ID: back", required: true },
  { docType: "other", docName: "selfie", label: "A selfie holding the ID", required: false },
];

const trimmed = (v) => String(v ?? "").trim();
const list = (v) => (Array.isArray(v) ? v.map(trimmed) : []);

// {field: message} for one step (1-3) or every step (0); same rules and
// messages as the server.
export function validateOnboarding(data, step = 0) {
  const d = data || {};
  const e = {};
  if (step === 0 || step === 1) {
    const name = trimmed(d.full_name);
    if (name.length < 2 || name.length > 120 || !/\p{L}/u.test(name)) e.full_name = "Enter your full name (2 to 120 characters).";
    const phone = trimmed(d.phone);
    const digits = phone.replace(/\D/g, "").length;
    if (!/^\+?[0-9 ()-]{7,20}$/.test(phone) || digits < 7 || digits > 15) e.phone = "Enter a valid phone number (7 to 15 digits).";
    const location = trimmed(d.location);
    if (location.length < 2 || location.length > 120 || location.toLowerCase() === "not provided") {
      e.location = "Enter your city or location (2 to 120 characters).";
    }
  }
  if (step === 0 || step === 2) {
    const q = trimmed(d.qualifications);
    if (q.length < 2 || q.length > 500) e.qualifications = "Enter your qualifications (2 to 500 characters).";
    const years = trimmed(d.experience_years);
    if (!/^\d{1,2}$/.test(years) || Number(years) > 60) e.experience_years = "Years of experience must be a whole number from 0 to 60.";
  }
  if (step === 0 || step === 3) {
    const subjects = list(d.subjects);
    if (subjects.length === 0 || subjects.length > 20 || subjects.some((s) => !s || s.length > 60)) {
      e.subjects = "Add 1 to 20 subjects (each up to 60 characters).";
    }
    const languages = list(d.languages);
    if (languages.length === 0 || languages.length > 10 || languages.some((s) => !s || s.length > 40)) {
      e.languages = "Add 1 to 10 teaching languages (each up to 40 characters).";
    }
    const bio = trimmed(d.bio);
    if (bio.length < 50 || bio.length > 1000) e.bio = "Write a short bio of 50 to 1000 characters.";
  }
  return e;
}

// The fields a step saves (what educator_save_onboarding_step keeps).
export function stepData(data, step) {
  const def = ONBOARDING_STEPS.find((s) => s.step === step);
  return Object.fromEntries((def?.fields || []).map((f) => [f, data?.[f] ?? (f === "subjects" || f === "languages" ? [] : "")]));
}

// The step to resume at: the one after the last saved step (1..5).
export function resumeStep(onboarding) {
  return Math.min(Math.max(Number(onboarding?.step || 0) + 1, 1), 5);
}

export function missingRequiredDocuments(documents) {
  return REQUIRED_DOCUMENTS.filter((r) => r.required
    && !(documents || []).some((d) => d.doc_type === r.docType && d.doc_name === r.docName));
}

// Field errors from a 22023 "Check the highlighted fields." RPC error (DETAIL is JSON).
export function fieldErrorsFrom(error) {
  if (!error?.details) return {};
  try {
    const parsed = JSON.parse(error.details);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

// null when the file can be uploaded as this document type, else the reason.
export function checkUploadFile(docType, file) {
  if (!file) return "Choose a file.";
  const allowed = CERTIFICATE_TYPES.includes(docType) ? [...IMAGE_TYPES, "application/pdf"] : IMAGE_TYPES;
  if (!allowed.includes(String(file.type).toLowerCase())) {
    return CERTIFICATE_TYPES.includes(docType) ? "Upload a JPEG, PNG, WebP or PDF file." : "Upload a JPEG, PNG or WebP picture.";
  }
  if (!(file.size > 0)) return "The file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) return "The file is larger than 5 MB.";
  return null;
}

// "BSc Physics degree" -> "bsc-physics-degree" (the docName educator-upload-url accepts).
export function certificateSlug(label) {
  return String(label || "").toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "certificate";
}

// ------------------------------------------------------------------ gate
// educator_get_status().status -> what the teacher portal shows.
export const GATE = Object.freeze({
  ONBOARDING: "onboarding", PENDING: "pending", CHANGES: "changes_requested",
  REJECTED: "rejected", SUSPENDED: "suspended", PORTAL: "portal",
});

export function gateFor(status) {
  switch (status?.status) {
    case "verified": return GATE.PORTAL;
    case "draft": return GATE.ONBOARDING;
    case "pending":
    case "under_review": return GATE.PENDING;
    case "changes_requested": return GATE.CHANGES;
    case "rejected": return GATE.REJECTED;
    case "suspended": return GATE.SUSPENDED;
    default: return GATE.PENDING;
  }
}

// ------------------------------------------------------- test series tabs
export const SERIES_TABS = [
  { key: "published", label: "Published", statuses: ["published", "scheduled"] },
  { key: "drafts", label: "Drafts", statuses: ["draft"] },
  { key: "pending", label: "Pending approval", statuses: ["pending_approval"] },
  { key: "rejected", label: "Rejected", statuses: ["rejected"] },
];

// list_test_series rows (own + assigned) -> {published, drafts, pending, rejected}.
export function groupSeriesByTab(rows) {
  const groups = Object.fromEntries(SERIES_TABS.map((t) => [t.key, []]));
  for (const row of rows || []) {
    const tab = SERIES_TABS.find((t) => t.statuses.includes(row.status));
    if (tab) groups[tab.key].push(row);
  }
  return groups;
}

// "Assigned" series are published directly; the educator's own go to approval.
export function seriesActionLabel(row) {
  if (row?.origin === "educator") {
    if (row.status === "rejected") return "Resubmit for approval";
    if (row.status === "draft") return "Submit for approval";
  }
  return row?.status === "published" || row?.status === "scheduled" ? "Manage" : "Publish";
}

// ------------------------------------------------------------ sign-up intent
// Set before an educator sign-up (email or Google) so the first profile is
// created as an educator (educator_start_onboarding) and never as a student.
export const EDUCATOR_INTENT_KEY = "ul_educator_signup";

export function setEducatorIntent(storage = globalThis.sessionStorage) {
  try { storage?.setItem(EDUCATOR_INTENT_KEY, "1"); } catch { /* storage unavailable */ }
}
export function clearEducatorIntent(storage = globalThis.sessionStorage) {
  try { storage?.removeItem(EDUCATOR_INTENT_KEY); } catch { /* storage unavailable */ }
}
export function hasEducatorIntent(user, storage = globalThis.sessionStorage) {
  if (user?.user_metadata?.signup_role === "educator") return true;
  try { return storage?.getItem(EDUCATOR_INTENT_KEY) === "1"; } catch { return false; }
}
