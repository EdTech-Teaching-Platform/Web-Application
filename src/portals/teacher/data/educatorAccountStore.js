// Educator account + verification store.
//
// ONE record per educator holds everything the unified registration form
// collects (account details AND profile details) plus the single
// verification status that drives the whole portal:
//
//   pending            -> signed up, waiting for admin; portal shell visible,
//                         every section's content locked, ID card provisional
//   approved           -> dashboard unlocked, Digital ID Card is "Verified"
//   changes_requested  -> admin asked for fixes (feedback shown); educator
//                         edits + resubmits, which sets status back to pending
//   rejected           -> admin declined (reason shown)
//
// Every screen reads `status` from here (TeacherLayout is the one place that
// turns it into the lock) — nothing hardcodes a per-screen check.
//
// DEMO_MODE: persisted in localStorage so the Registration -> Login -> locked
// portal -> Admin approval -> unlock loop works end-to-end with no backend,
// and an approval made in the Admin tab reaches an open educator tab live
// (storage event). Swap the functions below for teacherApi calls later; the
// hook API (useEducators / useCurrentEducator) doesn't need to change.
import { useSyncExternalStore } from "react";
import { generateEducatorId, uid } from "./educatorRegistrationData";

const ACCOUNTS_KEY = "ul.educator.accounts.v1";
const SESSION_KEY = "ul.educator.session.v1";
// Set once an educator has registered or signed in on this device, so the
// landing page sends them to Log in instead of the onboarding again.
const SEEN_KEY = "ul.educator.seen.v1";

export const EDUCATOR_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  CHANGES_REQUESTED: "changes_requested",
  REJECTED: "rejected",
};

// Same shape as LIFECYCLE_META (course lifecycle) so the existing
// <StatusBadge> renders it with no new visual pattern.
export const EDUCATOR_STATUS_META = {
  pending: { label: "Pending Verification", badgeStatus: "warning" },
  approved: { label: "Verified", badgeStatus: "success" },
  changes_requested: { label: "Changes Requested", badgeStatus: "danger" },
  rejected: { label: "Rejected", badgeStatus: "danger" },
};

// ---- DEMO-ONLY credential hashing -----------------------------------------
// NOT secure. It only keeps plaintext passwords out of localStorage for the
// demo; the real backend owns credential storage and checking.
function demoHash(email, password) {
  let h = 5381;
  const s = `${email.toLowerCase()}::${password}`;
  for (let i = 0; i < s.length; i += 1) h = ((h << 5) + h + s.charCodeAt(i)) | 0;
  return `demo$${(h >>> 0).toString(36)}`;
}

// ---- Seed data (realistic mock educators) ---------------------------------
// Demo password for every seeded account: Demo@1234
const DEMO_PASSWORD = "Demo@1234";

function seedProfile(over) {
  return {
    dialCode: "+91", altPhone: "", pronouns: "", linkedin: "", website: "", additionalSubjects: [],
    specializations: [], listInDiscovery: true, workExperience: [], education: [], certifications: [],
    volunteering: [], awards: [], referenceList: [], references: "", noBackgroundCheck: false,
    ...over,
  };
}

function seedAccounts() {
  const iso = (daysAgo) => new Date(Date.now() - daysAgo * 86400000).toISOString();
  const mk = (id, email, status, extra, profile) => ({
    id,
    email,
    passwordHash: demoHash(email, DEMO_PASSWORD),
    status,
    submittedAt: iso(extra.submittedDaysAgo),
    reviewedAt: null,
    adminFeedback: "",
    approvedAt: null,
    approvedNoticeSeen: false,
    educatorId: generateEducatorId(profile.fullName),
    issueDate: null,
    expiryDate: null,
    photoUrl: null,
    documents: {
      govId: { name: "aadhaar-card.pdf", size: 412000 },
      certificate: { name: "b-ed-certificate.pdf", size: 903000 },
      backgroundCheck: profile.noBackgroundCheck ? null : { name: "police-clearance.pdf", size: 255000 },
      resume: null,
    },
    profile,
    ...extra.over,
  });

  const priya = mk("edu_priya", "priya.sharma@example.com", "pending", { submittedDaysAgo: 1 }, seedProfile({
    fullName: "Priya Sharma", phone: "9876543210", address: "14 Residency Road", country: "India", state: "Karnataka",
    city: "Bengaluru", zipCode: "560025", headline: "Certified Math Educator, 8+ yrs",
    bio: "I teach middle and high-school mathematics with a focus on building intuition before procedure.",
    qualification: "Master's Degree", institution: "University of Delhi", experience: "8",
    primarySubject: "Mathematics", teachingModes: ["Online", "Hybrid"],
    gradeRows: [{ id: "g1", grade: "9th", subjects: ["Mathematics"] }, { id: "g2", grade: "10th", subjects: ["Mathematics", "Test Prep"] }],
    languages: ["English", "Hindi"], objectives: ["Get certified as a verified educator", "Attract more students"],
    employmentType: "Independent Educator", ageGroups: ["9–12"],
    workExperience: [{ id: "w1", jobTitle: "Senior Math Teacher", employer: "Delhi Public School", location: "Bengaluru, India", startDate: "2018-06", endDate: "", current: true, description: "Lead the grade 9–10 maths department." }],
    education: [{ id: "e1", degree: "Master of Education", institution: "University of Delhi", fieldOfStudy: "Mathematics Education", startYear: "2014", endYear: "2016", gpa: "" }],
  }));
  const rahul = mk("edu_rahul", "rahul.verma@example.com", "approved", { submittedDaysAgo: 20, over: { reviewedAt: iso(17), approvedAt: iso(17), approvedNoticeSeen: true, issueDate: iso(17), expiryDate: new Date(Date.now() + 2 * 365 * 86400000 - 17 * 86400000).toISOString() } }, seedProfile({
    fullName: "Rahul Verma", phone: "9811122233", address: "22 MG Road", country: "India", state: "Maharashtra", city: "Pune",
    zipCode: "411001", headline: "Physics & Test Prep Mentor", bio: "Ten years coaching students for JEE and board exams in physics.",
    qualification: "Doctorate (PhD)", institution: "IIT Bombay", experience: "10", primarySubject: "Science",
    teachingModes: ["Online"], gradeRows: [{ id: "g1", grade: "12th", subjects: ["Science", "Test Prep"] }],
    languages: ["English", "Hindi"], objectives: ["Increase visibility to students"], employmentType: "Both", ageGroups: ["9–12", "College / Adult"],
  }));
  const meera = mk("edu_meera", "meera.nair@example.com", "changes_requested", {
    submittedDaysAgo: 6,
    over: { reviewedAt: iso(2), adminFeedback: "The teaching certificate you uploaded is cropped and the expiry date isn't readable. Please upload a full, clear scan and resubmit." },
  }, seedProfile({
    fullName: "Meera Nair", phone: "9447001122", address: "7 Marine Drive", country: "India", state: "Kerala", city: "Kochi",
    zipCode: "682011", headline: "English & Language Arts Educator", bio: "Language teacher passionate about reading and creative writing for young learners.",
    qualification: "Bachelor's Degree", institution: "Mahatma Gandhi University", experience: "5", primarySubject: "English & Languages",
    teachingModes: ["In-person", "Online"], gradeRows: [{ id: "g1", grade: "6th", subjects: ["English & Languages"] }],
    languages: ["English"], objectives: ["Build trust with parents & students"], employmentType: "Institution-affiliated", ageGroups: ["6–8"],
  }));
  const arjun = mk("edu_arjun", "arjun.rao@example.com", "pending", { submittedDaysAgo: 3 }, seedProfile({
    fullName: "Arjun Rao", phone: "9900112233", address: "31 Park Street", country: "India", state: "West Bengal", city: "Kolkata",
    zipCode: "700016", headline: "Computer Science Instructor", bio: "Software engineer turned teacher: Python, web basics and problem solving for teens.",
    qualification: "Master's Degree", institution: "Jadavpur University", experience: "6", primarySubject: "Computer Science",
    teachingModes: ["Online"], gradeRows: [{ id: "g1", grade: "11th", subjects: ["Computer Science"] }],
    languages: ["English", "Hindi"], objectives: ["Attract more students"], employmentType: "Independent Educator", ageGroups: ["9–12"], noBackgroundCheck: true,
  }));
  return [priya, rahul, meera, arjun];
}

// ---- Persistence + external-store plumbing --------------------------------
function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function safeSet(key, value) {
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* storage blocked/full: in-memory state below still works for this tab */
  }
}

function load() {
  let accounts;
  try {
    accounts = JSON.parse(safeGet(ACCOUNTS_KEY) || "null");
  } catch {
    accounts = null;
  }
  if (!Array.isArray(accounts)) {
    accounts = seedAccounts();
    safeSet(ACCOUNTS_KEY, JSON.stringify(accounts));
  }
  return { accounts, sessionId: safeGet(SESSION_KEY) };
}

let state = load();
const listeners = new Set();

function commit(nextAccounts, nextSessionId = state.sessionId) {
  state = { accounts: nextAccounts, sessionId: nextSessionId };
  safeSet(ACCOUNTS_KEY, JSON.stringify(nextAccounts));
  safeSet(SESSION_KEY, nextSessionId);
  if (nextSessionId) safeSet(SEEN_KEY, "1");
  listeners.forEach((l) => l());
}

function subscribe(listener) {
  listeners.add(listener);
  // Another tab (e.g. the Admin approving) wrote to storage -> reload + notify.
  const onStorage = (e) => {
    if (e.key === ACCOUNTS_KEY || e.key === SESSION_KEY || e.key === null) {
      state = load();
      listeners.forEach((l) => l());
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
const getSnapshot = () => state;

export function useEducatorStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// The logged-in educator (or null). `status` is the single source of truth
// the lock is derived from.
export function useCurrentEducator() {
  const { accounts, sessionId } = useEducatorStore();
  return accounts.find((a) => a.id === sessionId) ?? null;
}

// ---- Registration ----------------------------------------------------------
function normalizeIdentifier(v = "") {
  return v.trim().toLowerCase();
}
function phoneDigits(v = "") {
  return v.replace(/\D/g, "");
}

export function findEducatorByIdentifier(identifier) {
  const id = normalizeIdentifier(identifier);
  if (!id) return null;
  const digits = phoneDigits(id);
  return (
    state.accounts.find((a) => {
      if (a.email === id) return true;
      const p = phoneDigits(`${a.profile.dialCode}${a.profile.phone}`);
      const local = phoneDigits(a.profile.phone);
      return digits.length >= 7 && (digits === p || digits === local);
    }) ?? null
  );
}

// Downscale the chosen photo so the whole record stays small enough for
// localStorage; any failure just means "no photo" (initials fallback).
export async function fileToThumbDataUrl(file, size = 256) {
  if (!file || !file.type?.startsWith("image/")) return null;
  try {
    const url = URL.createObjectURL(file);
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = url;
    });
    const scale = Math.min(1, size / Math.max(img.width, img.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(img.width * scale);
    canvas.height = Math.round(img.height * scale);
    canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
    URL.revokeObjectURL(url);
    return canvas.toDataURL("image/jpeg", 0.8);
  } catch {
    return null;
  }
}

const fileMeta = (f) => (f ? { name: f.name, size: f.size } : null);

// Turn the form into the serialisable profile + document metadata.
async function buildRecordParts(form) {
  const {
    password, confirmPassword, photo, govId, govIdStatus, certificate, certificateStatus, backgroundCheck,
    backgroundCheckStatus, resume, ...profile
  } = form;
  void password; void confirmPassword; void govIdStatus; void certificateStatus; void backgroundCheckStatus;
  return {
    profile,
    photoUrl: await fileToThumbDataUrl(photo),
    documents: {
      govId: fileMeta(govId),
      certificate: fileMeta(certificate),
      backgroundCheck: form.noBackgroundCheck ? null : fileMeta(backgroundCheck),
      resume: fileMeta(resume),
    },
  };
}

// Single submission -> ONE complete record (account + profile + documents),
// logged in immediately, status = pending.
export async function registerEducator(form) {
  await new Promise((r) => setTimeout(r, 900)); // simulated network
  const email = normalizeIdentifier(form.email);
  if (findEducatorByIdentifier(email)) {
    const err = new Error("email_taken");
    err.code = "email_taken";
    throw err;
  }
  const parts = await buildRecordParts(form);
  const account = {
    id: `edu_${uid()}`,
    email,
    passwordHash: demoHash(email, form.password),
    status: EDUCATOR_STATUS.PENDING,
    submittedAt: new Date().toISOString(),
    reviewedAt: null,
    adminFeedback: "",
    approvedAt: null,
    approvedNoticeSeen: false,
    // Provisional until approval: the ID number is reserved now, but issue /
    // expiry dates are only stamped when an admin approves.
    educatorId: generateEducatorId(form.fullName),
    issueDate: null,
    expiryDate: null,
    ...parts,
  };
  commit([...state.accounts, account], account.id);
  return account;
}

// Changes requested / rejected -> educator edits and resubmits the SAME
// record (no second record); status goes back to pending.
export async function resubmitEducator(id, form) {
  await new Promise((r) => setTimeout(r, 900));
  const existing = state.accounts.find((a) => a.id === id);
  if (!existing) throw new Error("not_found");
  const parts = await buildRecordParts(form);
  const next = {
    ...existing,
    ...parts,
    photoUrl: parts.photoUrl ?? existing.photoUrl,
    documents: {
      govId: parts.documents.govId ?? existing.documents.govId,
      certificate: parts.documents.certificate ?? existing.documents.certificate,
      backgroundCheck: parts.documents.backgroundCheck ?? (form.noBackgroundCheck ? null : existing.documents.backgroundCheck),
      resume: parts.documents.resume ?? existing.documents.resume,
    },
    status: EDUCATOR_STATUS.PENDING,
    submittedAt: new Date().toISOString(),
    adminFeedback: "",
    reviewedAt: null,
  };
  commit(state.accounts.map((a) => (a.id === id ? next : a)));
  return next;
}

// ---- Login / session -------------------------------------------------------
// Returns the account on success, null if no educator matches this
// identifier (caller falls through to the normal student login), or throws
// "bad_password" for a matching educator with the wrong password.
export function verifyEducatorCredentials(identifier, password) {
  const account = findEducatorByIdentifier(identifier);
  if (!account) return null;
  if (account.passwordHash !== demoHash(account.email, password)) {
    const err = new Error("bad_password");
    err.code = "bad_password";
    throw err;
  }
  return account;
}

export function loginEducator(identifier, password) {
  const account = verifyEducatorCredentials(identifier, password);
  if (!account) return null;
  commit(state.accounts, account.id);
  return account;
}

export function startEducatorSession(id) {
  commit(state.accounts, id);
}

export function startEducatorSessionForIdentifier(identifier) {
  const account = findEducatorByIdentifier(identifier);
  if (!account) return null;
  commit(state.accounts, account.id);
  return account;
}

// Where "I'm an Educator" should lead:
//   signed in as an educator        -> the dashboard (the portal itself shows the
//                                      "under review" screen until approved)
//   known educator, signed out      -> Log in (no onboarding again)
//   brand-new visitor               -> the onboarding / registration
export function educatorEntryPath() {
  const signedIn = Boolean(state.sessionId) && state.accounts.some((a) => a.id === state.sessionId);
  if (signedIn) return "/teacher/dashboard";
  return safeGet(SEEN_KEY) ? "/teacher/login" : "/teacher/registration";
}

export function endEducatorSession() {
  commit(state.accounts, null);
}

// ---- Admin review ----------------------------------------------------------
// decision: "approved" | "changes_requested" | "rejected"
export function reviewEducator(id, decision, feedback = "") {
  const now = new Date();
  commit(
    state.accounts.map((a) => {
      if (a.id !== id) return a;
      if (decision === EDUCATOR_STATUS.APPROVED) {
        const expiry = new Date(now);
        expiry.setFullYear(expiry.getFullYear() + 2);
        return {
          ...a,
          status: decision,
          adminFeedback: "",
          reviewedAt: now.toISOString(),
          approvedAt: now.toISOString(),
          approvedNoticeSeen: false,
          issueDate: now.toISOString(),
          expiryDate: expiry.toISOString(),
        };
      }
      return { ...a, status: decision, adminFeedback: feedback, reviewedAt: now.toISOString(), approvedAt: null };
    })
  );
}

export function dismissApprovedNotice(id) {
  commit(state.accounts.map((a) => (a.id === id ? { ...a, approvedNoticeSeen: true } : a)));
}

// Demo helper: put every seeded account (and any you registered) back.
export function resetEducatorDemoData() {
  commit(seedAccounts(), null);
}

// What <DigitalIDCard> needs. While the account isn't approved the card is
// provisional: no issue/expiry dates and a "pending" card status.
export function toIdCardProfile(account) {
  const p = account.profile;
  const verified = account.status === EDUCATOR_STATUS.APPROVED;
  return {
    fullName: p.fullName,
    headline: p.headline,
    city: p.city,
    subjects: [...new Set([...(p.gradeRows ?? []).flatMap((r) => r.subjects), p.primarySubject].filter(Boolean))],
    photoUrl: account.photoUrl,
    educatorId: account.educatorId,
    issueDate: verified ? account.issueDate : null,
    expiryDate: verified ? account.expiryDate : null,
    status: verified ? "verified" : "pending",
  };
}
