// Educator Management — mock data.
// Everything here is dummy/local data for the UI-only Educator
// Management module; replace
// with real calls through ../services/adminApi.js once the backend exists.
// A small seeded generator fills in students/courses/documents/messages/
// payments per educator so the numbers on each profile stay internally
// consistent (studentsCount === students.length, etc.) without hand-typing
// hundreds of rows.

// React 19's useSyncExternalStore is the standard way to subscribe a
// component to an external mutable store — used by the store block near
// the bottom of this file.
import { useSyncExternalStore } from "react";

// ---------- tiny deterministic PRNG (seeded, so data is stable across reloads) ----------
function hashSeed(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i += 1) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return h >>> 0;
}
function mulberry32(seed) {
  let a = seed;
  return function rand() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (rand, arr) => arr[Math.floor(rand() * arr.length)];
const pickN = (rand, arr, n) => {
  const pool = [...arr];
  const out = [];
  for (let i = 0; i < n && pool.length; i += 1) {
    out.push(pool.splice(Math.floor(rand() * pool.length), 1)[0]);
  }
  return out;
};
const round1 = (n) => Math.round(n * 10) / 10;

// ---------- pools ----------
const STUDENT_FIRST_NAMES = [
  "Aarav", "Meera", "Kabir", "Ananya", "Ishaan", "Diya", "Rohan", "Sneha",
  "Vikram", "Priya", "Arjun", "Neha", "Karan", "Tanvi", "Rahul", "Isha",
  "Aditya", "Pooja", "Nikhil", "Riya", "Sofia", "Liam", "Emma", "Noah",
  "Olivia", "Lucas", "Mia", "Ethan", "Ava", "Mason",
];
const STUDENT_LAST_NAMES = [
  "Sharma", "Verma", "Iyer", "Nair", "Gupta", "Reddy", "Mehta", "Kapoor",
  "Rao", "Chatterjee", "Bose", "Malhotra", "Bansal", "Kumar", "Joshi",
  "Fernandes", "Thomas", "Coleman", "Bennett", "Morgan", "Foster", "Reyes",
];
const SUBJECT_POOL = [
  "Mathematics", "Physics", "Computer Science", "English Literature",
  "World History", "Biology", "Chemistry", "Economics", "Data Structures",
  "Machine Learning", "Spoken English", "Digital Marketing",
];
const CITY_POOL = [
  { city: "Bengaluru", state: "Karnataka", country: "India" },
  { city: "Pune", state: "Maharashtra", country: "India" },
  { city: "Delhi", state: "Delhi", country: "India" },
  { city: "Hyderabad", state: "Telangana", country: "India" },
  { city: "London", state: "England", country: "United Kingdom" },
  { city: "Austin", state: "Texas", country: "United States" },
  { city: "Toronto", state: "Ontario", country: "Canada" },
  { city: "Singapore", state: "", country: "Singapore" },
];
const SKILL_POOL = [
  "Curriculum Design", "Assessment Design", "Public Speaking", "LMS Tools",
  "Video Production", "Classroom Management", "Mentoring", "Research",
  "Data Analysis", "Adaptive Learning", "Gamification", "Rubric Design",
];
const CERT_POOL = [
  { name: "Certified Online Instructor", issuer: "EdTech Board", year: 2022 },
  { name: "Advanced Pedagogy Certificate", issuer: "TeachWell Institute", year: 2021 },
  { name: "Instructional Design Certification", issuer: "LearnDesign Academy", year: 2023 },
  { name: "Subject-Matter Expert Badge", issuer: "Universal Learning", year: 2024 },
];
const DOC_TYPES = [
  { key: "govtId", label: "Government ID" },
  { key: "qualification", label: "Qualification Certificate" },
  { key: "experience", label: "Experience Certificate" },
  { key: "resume", label: "Resume / CV" },
  { key: "teachingCert", label: "Teaching Certification" },
];
const PAYMENT_METHODS = ["Bank Transfer", "UPI", "PayPal", "Wire Transfer"];
const COURSE_TITLES = {
  Mathematics: ["Calculus Foundations", "Linear Algebra Essentials"],
  Physics: ["Classical Mechanics", "Electromagnetism 101"],
  "Computer Science": ["Intro to Programming", "Operating Systems Deep Dive"],
  "English Literature": ["Modern Poetry", "The 19th-Century Novel"],
  "World History": ["Modern World History 101", "The Age of Empires"],
  Biology: ["Cell Biology Basics", "Human Anatomy & Physiology"],
  Chemistry: ["Organic Chemistry I", "Chemical Reactions Lab"],
  Economics: ["Microeconomics Principles", "Behavioral Economics"],
  "Data Structures": ["Advanced Data Structures", "Algorithms in Practice"],
  "Machine Learning": ["Intro to Machine Learning", "Applied Deep Learning"],
  "Spoken English": ["Spoken English for Professionals", "Business Communication"],
  "Digital Marketing": ["Digital Marketing Fundamentals", "Growth Marketing Playbook"],
};

// ---------- raw seeds: identity + status fields hand-set for coverage ----------
const SEEDS = [
  { id: "EDU-1001", first: "Sarah", last: "Jenkins", gender: "Female", dob: "1986-04-12", subjects: ["Data Structures", "Computer Science"], qualification: "Ph.D. in Computer Science, Stanford University", years: 9, accountStatus: "active", verificationStatus: "verified", joined: "2024-11-02", lastActiveDaysAgo: 0, ratingBase: 4.8, studentCount: 11, courseCount: 2 },
  { id: "EDU-1002", first: "Marcus", last: "Thorne", gender: "Male", dob: "1990-09-03", subjects: ["World History"], qualification: "M.A. in History, Columbia University", years: 6, accountStatus: "active", verificationStatus: "pending", joined: "2026-09-08", lastActiveDaysAgo: 1, ratingBase: 0, studentCount: 0, courseCount: 0 },
  { id: "EDU-1003", first: "Elena", last: "Rodriguez", gender: "Female", dob: "1994-01-21", subjects: ["Machine Learning", "Computer Science"], qualification: "M.Sc. in Artificial Intelligence, University of Edinburgh", years: 5, accountStatus: "active", verificationStatus: "under_review", joined: "2026-09-06", lastActiveDaysAgo: 2, ratingBase: 0, studentCount: 0, courseCount: 0 },
  { id: "EDU-1004", first: "Priya", last: "Kapoor", gender: "Female", dob: "1992-06-30", subjects: ["Spoken English"], qualification: "B.Ed., Delhi University", years: 4, accountStatus: "active", verificationStatus: "pending", joined: "2026-09-05", lastActiveDaysAgo: 3, ratingBase: 0, studentCount: 0, courseCount: 0 },
  { id: "EDU-1005", first: "Alan", last: "Turing", gender: "Male", dob: "1978-06-23", subjects: ["Data Structures", "Mathematics"], qualification: "Ph.D. in Mathematics, University of Cambridge", years: 14, accountStatus: "active", verificationStatus: "verified", joined: "2023-02-18", lastActiveDaysAgo: 0, ratingBase: 4.9, studentCount: 14, courseCount: 3 },
  { id: "EDU-1006", first: "Howard", last: "Zinn", gender: "Male", dob: "1975-12-08", subjects: ["World History"], qualification: "Ph.D. in History, Boston University", years: 11, accountStatus: "active", verificationStatus: "verified", joined: "2023-06-11", lastActiveDaysAgo: 1, ratingBase: 4.6, studentCount: 9, courseCount: 2 },
  { id: "EDU-1007", first: "Daniel", last: "Osei", gender: "Male", dob: "1996-03-14", subjects: ["Digital Marketing"], qualification: "No formal qualification submitted", years: 1, accountStatus: "suspended", verificationStatus: "rejected", joined: "2026-08-18", lastActiveDaysAgo: 25, ratingBase: 2.4, studentCount: 2, courseCount: 1 },
  { id: "EDU-1008", first: "Meredith", last: "Chan", gender: "Female", dob: "1988-11-02", subjects: ["Chemistry", "Biology"], qualification: "Ph.D. in Chemistry, National University of Singapore", years: 8, accountStatus: "active", verificationStatus: "verified", joined: "2024-03-27", lastActiveDaysAgo: 0, ratingBase: 4.7, studentCount: 13, courseCount: 3 },
  { id: "EDU-1009", first: "Rohan", last: "Malhotra", gender: "Male", dob: "1991-07-19", subjects: ["Mathematics", "Physics"], qualification: "M.Sc. in Physics, IIT Bombay", years: 7, accountStatus: "inactive", verificationStatus: "verified", joined: "2023-10-09", lastActiveDaysAgo: 46, ratingBase: 4.2, studentCount: 6, courseCount: 2 },
  { id: "EDU-1010", first: "Grace", last: "Whitfield", gender: "Female", dob: "1983-05-27", subjects: ["English Literature"], qualification: "M.A. in English, University of Oxford", years: 13, accountStatus: "active", verificationStatus: "verified", joined: "2022-09-14", lastActiveDaysAgo: 0, ratingBase: 4.9, studentCount: 15, courseCount: 3 },
  { id: "EDU-1011", first: "Vikram", last: "Nair", gender: "Male", dob: "1989-02-16", subjects: ["Economics"], qualification: "M.A. in Economics, Delhi School of Economics", years: 8, accountStatus: "suspended", verificationStatus: "verified", joined: "2023-12-01", lastActiveDaysAgo: 60, ratingBase: 3.1, studentCount: 5, courseCount: 1 },
  { id: "EDU-1012", first: "Fatima", last: "Al-Sayed", gender: "Female", dob: "1993-10-05", subjects: ["Biology", "Chemistry"], qualification: "M.Sc. in Biotechnology, University of Toronto", years: 6, accountStatus: "active", verificationStatus: "verified", joined: "2024-07-22", lastActiveDaysAgo: 1, ratingBase: 4.5, studentCount: 10, courseCount: 2 },
  { id: "EDU-1013", first: "James", last: "Whitmore", gender: "Male", dob: "1985-08-30", subjects: ["Digital Marketing", "Economics"], qualification: "MBA, London Business School", years: 10, accountStatus: "active", verificationStatus: "rejected", joined: "2026-08-29", lastActiveDaysAgo: 14, ratingBase: 0, studentCount: 0, courseCount: 0 },
];

const DAY = 24 * 60 * 60 * 1000;
const TODAY = new Date("2026-09-14T00:00:00Z");
const fmtDate = (d) => d.toISOString().slice(0, 10);
const daysAgo = (n) => fmtDate(new Date(TODAY.getTime() - n * DAY));
const relativeLabel = (n) => {
  if (n <= 0) return "Today";
  if (n === 1) return "Yesterday";
  if (n < 7) return `${n} days ago`;
  if (n < 30) return `${Math.floor(n / 7)} week${Math.floor(n / 7) > 1 ? "s" : ""} ago`;
  return `${Math.floor(n / 30)} month${Math.floor(n / 30) > 1 ? "s" : ""} ago`;
};

const STUDENT_STATUS_POOL = ["active", "active", "active", "completed", "at_risk", "inactive"];

function buildEducator(seed) {
  const rand = mulberry32(hashSeed(seed.id));
  const name = `${seed.first} ${seed.last}`;
  const initials = `${seed.first[0]}${seed.last[0]}`.toUpperCase();
  const avatarColors = ["#5B0F14", "#50C3E5", "#F9A044", "#B85DD5", "#6B1117"];
  const avatarColor = avatarColors[hashSeed(seed.id) % avatarColors.length];
  const location = pick(rand, CITY_POOL);

  // ---- students ----
  const students = Array.from({ length: seed.studentCount }, (_, i) => {
    const fn = pick(rand, STUDENT_FIRST_NAMES);
    const ln = pick(rand, STUDENT_LAST_NAMES);
    const status = pick(rand, STUDENT_STATUS_POOL);
    const enrolledDaysAgo = Math.floor(rand() * 220) + 5;
    const lastActiveDaysAgo = status === "inactive" ? Math.floor(rand() * 60) + 20 : Math.floor(rand() * 10);
    const progress = status === "completed" ? 100 : status === "at_risk" ? Math.floor(rand() * 30) + 5 : Math.floor(rand() * 70) + 20;
    return {
      id: `${seed.id}-S${i + 1}`,
      name: `${fn} ${ln}`,
      initials: `${fn[0]}${ln[0]}`.toUpperCase(),
      email: `${fn.toLowerCase()}.${ln.toLowerCase()}@example.com`,
      course: pick(rand, seed.subjects.flatMap((s) => COURSE_TITLES[s] || [s])),
      enrolledDate: daysAgo(enrolledDaysAgo),
      progress,
      lastActive: relativeLabel(lastActiveDaysAgo),
      status,
    };
  });
  const activeStudents = students.filter((s) => s.status === "active").length;
  const completedStudents = students.filter((s) => s.status === "completed").length;
  const atRiskStudents = students.filter((s) => s.status === "at_risk" || s.status === "inactive").length;

  // ---- courses ----
  const courseTitlesPool = seed.subjects.flatMap((s) => COURSE_TITLES[s] || [s]);
  const courseTitles = pickN(rand, courseTitlesPool, Math.min(seed.courseCount, courseTitlesPool.length)) || [];
  const courses = courseTitles.map((title, i) => ({
    id: `${seed.id}-C${i + 1}`,
    title,
    students: Math.max(1, Math.round(seed.studentCount / Math.max(1, courseTitles.length)) + Math.floor(rand() * 3) - 1),
    completionRate: Math.floor(rand() * 30) + 65,
    avgScore: Math.floor(rand() * 20) + 72,
    rating: seed.ratingBase ? round1(seed.ratingBase - rand() * 0.4) : 0,
  }));

  // ---- performance ----
  const isVerified = seed.verificationStatus === "verified";
  const months = ["Apr", "May", "Jun", "Jul", "Aug", "Sep"];
  const enrollmentTrend = months.map((m, i) => ({
    month: m,
    value: isVerified ? Math.max(0, Math.round(seed.studentCount * (0.4 + i * 0.12) + rand() * 2)) : 0,
  }));
  const ratingTrend = months.map((m) => ({
    month: m,
    value: seed.ratingBase ? round1(Math.min(5, Math.max(2.5, seed.ratingBase - 0.3 + rand() * 0.6))) : 0,
  }));
  const completionTrend = months.map((m, i) => ({
    month: m,
    value: isVerified ? Math.min(96, 55 + i * 6 + Math.floor(rand() * 6)) : 0,
  }));
  const performance = {
    totalStudents: students.length,
    activeStudents,
    completedStudents,
    atRiskStudents,
    totalCourses: courses.length,
    avgCompletionRate: courses.length ? Math.round(courses.reduce((s, c) => s + c.completionRate, 0) / courses.length) : 0,
    avgStudentScore: courses.length ? Math.round(courses.reduce((s, c) => s + c.avgScore, 0) / courses.length) : 0,
    avgRating: seed.ratingBase || 0,
    engagementScore: isVerified ? Math.floor(rand() * 20) + 70 : 0,
    assignmentCompletionRate: isVerified ? Math.floor(rand() * 25) + 68 : 0,
    sessionsConducted: isVerified ? Math.floor(rand() * 80) + 20 : 0,
    enrollmentTrend,
    ratingTrend,
    completionTrend,
  };

  // ---- documents ----
  const docStatusForVerification = {
    verified: "verified",
    pending: "pending",
    under_review: "pending",
    rejected: "rejected",
  };
  const baseDocStatus = docStatusForVerification[seed.verificationStatus] || "pending";
  const documents = DOC_TYPES.map((d, i) => {
    let status = baseDocStatus;
    // sprinkle a little per-document variation instead of every doc being identical
    if (seed.verificationStatus === "under_review" && i % 2 === 0) status = "verified";
    if (seed.verificationStatus === "rejected" && i === 0) status = "verified";
    return {
      id: `${seed.id}-D${i + 1}`,
      type: d.label,
      fileName: `${d.key}_${seed.last}.pdf`,
      uploadedDate: daysAgo(seed.studentCount ? 90 + i * 3 : 3 + i),
      status,
      rejectionReason: status === "rejected" ? "Document is unclear or does not match applicant details." : null,
    };
  });

  // ---- messages ----
  const messageTemplates = [
    { subject: "Welcome to Universal Learning", body: `Hi ${seed.first}, welcome aboard! Let us know if you need anything while setting up your first course.` },
    { subject: "Course quality check-in", body: `Hi ${seed.first}, your course metrics look great this month — nice work keeping completion rates up.` },
    { subject: "Please update your syllabus", body: `Hi ${seed.first}, could you refresh the syllabus for your next course revision by end of week?` },
  ];
  const messages = pickN(rand, messageTemplates, Math.min(3, messageTemplates.length)).map((m, i) => ({
    id: `${seed.id}-M${i + 1}`,
    direction: "sent",
    subject: m.subject,
    body: m.body,
    date: daysAgo(3 + i * 9),
  }));

  // ---- payments ----
  const commissionRate = 0.2;
  const payoutsCount = isVerified ? Math.floor(rand() * 4) + 3 : 0;
  const statusPool = ["paid", "paid", "paid", "processing", "pending", "failed"];
  const history = isVerified
    ? Array.from({ length: payoutsCount }, (_, i) => {
        const amount = Math.round((seed.studentCount * 40 + rand() * 300) * 100) / 100;
        const commission = round1(amount * commissionRate);
        const status = i === 0 ? "processing" : i === 1 ? "pending" : pick(rand, statusPool);
        return {
          id: `PAY-${seed.id}-${1000 + i}`,
          date: daysAgo(10 + i * 18),
          amount,
          commission,
          net: round1(amount - commission),
          status,
          method: pick(rand, PAYMENT_METHODS),
        };
      })
    : [];
  const paidTotal = round1(history.filter((h) => h.status === "paid").reduce((s, h) => s + h.net, 0));
  const pendingTotal = round1(history.filter((h) => h.status === "pending" || h.status === "processing").reduce((s, h) => s + h.net, 0));
  const payments = {
    totalEarnings: round1(paidTotal + pendingTotal),
    paidAmount: paidTotal,
    pendingAmount: pendingTotal,
    nextPayoutDate: isVerified ? daysAgo(-14) : null,
    nextPayoutAmount: history.length ? history[1]?.net ?? 0 : 0,
    commissionRate: commissionRate * 100,
    payoutsCount: history.length,
    history,
  };

  return {
    id: seed.id,
    name,
    initials,
    avatarColor,
    firstName: seed.first,
    lastName: seed.last,
    gender: seed.gender,
    dob: seed.dob,
    email: `${seed.first.toLowerCase()}.${seed.last.toLowerCase()}@example.com`,
    phone: `+1 555-${String(200 + (hashSeed(seed.id) % 700)).padStart(3, "0")}-${String((hashSeed(seed.id) % 9000) + 1000)}`,
    address: `${location.city}${location.state ? ", " + location.state : ""}, ${location.country}`,
    subjects: seed.subjects,
    qualification: seed.qualification,
    yearsExperience: seed.years,
    skills: pickN(rand, SKILL_POOL, 5),
    certifications: seed.verificationStatus === "verified" ? pickN(rand, CERT_POOL, 2) : pickN(rand, CERT_POOL, 1),
    previousExperience: [
      { role: "Course Instructor", org: pick(rand, ["Bright Minds Academy", "EdgeLearn Institute", "Skillverse", "Nova Learning Co."]), years: Math.max(1, Math.round(seed.years * 0.4)) },
    ],
    professionalSummary: `${name} brings ${seed.years} year${seed.years === 1 ? "" : "s"} of experience teaching ${seed.subjects.join(" and ")}, with a focus on practical, outcome-driven instruction.`,
    accountStatus: seed.accountStatus,
    verificationStatus: seed.verificationStatus,
    role: "Educator",
    permissions: ["Create Courses", "Schedule Live Classes", "Grade Assignments", "Message Students"],
    joinedDate: seed.joined,
    lastActive: relativeLabel(seed.lastActiveDaysAgo),
    lastActiveDaysAgo: seed.lastActiveDaysAgo,
    rating: seed.ratingBase || 0,
    coursesCount: courses.length,
    studentsCount: students.length,
    students,
    courses,
    performance,
    documents,
    messages,
    payments,
  };
}

export const SUBJECT_OPTIONS = SUBJECT_POOL;
export const SKILL_OPTIONS = SKILL_POOL;
export const DOCUMENT_TYPE_OPTIONS = DOC_TYPES;

// ---------- tiny mock "store" ----------
// UI-only stand-in for a real backend: a shared, mutable array plus a
// minimal pub/sub so the Educator List and Educator Profile pages (and any
// tab within a profile) stay in sync when an admin action changes an
// educator, without needing a real API layer. Swap this whole block for
// real adminApi.js calls + a data-fetching layer later; the useEducators()/
// useEducator() hooks below are the only thing screens should depend on.
let _educators = SEEDS.map(buildEducator);
let _nextEducatorSeq = SEEDS.reduce((max, s) => Math.max(max, parseInt(s.id.split("-")[1], 10) || 0), 0) + 1;
const _listeners = new Set();
function _notify() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _snapshot() {
  return _educators;
}

// Admin-added teacher: reuses buildEducator's full generation pipeline (so
// the new record has the same shape as every seeded one — empty student/
// course lists since they're brand new) instead of hand-assembling a
// partial object.
export function addEducator(input) {
  const id = `EDU-${_nextEducatorSeq}`;
  _nextEducatorSeq += 1;
  const seed = {
    id,
    first: input.firstName.trim(),
    last: input.lastName.trim(),
    gender: input.gender || "Prefer not to say",
    dob: input.dob || "",
    subjects: input.subjects && input.subjects.length ? input.subjects : [SUBJECT_POOL[0]],
    qualification: input.qualification.trim(),
    years: Number(input.years) || 0,
    // Overridable so a caller (e.g. the bulk CSV/Excel import, which adds
    // teachers as not-yet-active/pending until they accept their invite)
    // can seed a different starting status than the individual "Add
    // Teacher" form's default of immediately active + verified.
    accountStatus: input.accountStatus || "active",
    verificationStatus: input.verificationStatus || "verified",
    joined: fmtDate(TODAY),
    lastActiveDaysAgo: 0,
    ratingBase: 0,
    studentCount: 0,
    courseCount: 0,
  };
  const built = buildEducator(seed);
  const newEducator = {
    ...built,
    email: input.email?.trim() || built.email,
    phone: input.phone?.trim() || built.phone,
  };
  _educators = [newEducator, ..._educators];
  _notify();
  return newEducator;
}

export function updateEducator(id, patch) {
  _educators = _educators.map((e) => (e.id === id ? { ...e, ...patch } : e));
  _notify();
}

export function updateEducatorDocument(id, docId, patch) {
  _educators = _educators.map((e) =>
    e.id === id ? { ...e, documents: e.documents.map((d) => (d.id === docId ? { ...d, ...patch } : d)) } : e
  );
  _notify();
}

export function addEducatorMessage(id, message) {
  _educators = _educators.map((e) =>
    e.id === id ? { ...e, messages: [{ ...message, id: `${id}-M${e.messages.length + 1}` }, ...e.messages] } : e
  );
  _notify();
}

export function deleteEducator(id) {
  _educators = _educators.filter((e) => e.id !== id);
  _notify();
}

export function useEducators() {
  return useSyncExternalStore(_subscribe, _snapshot);
}

// Non-hook accessor for modules that aren't React components (e.g.
// staffAssignmentsMock.js) but need to read the current educator list —
// same underlying store as useEducators(), just without the subscription.
export function getEducatorsSnapshot() {
  return _snapshot();
}

export function useEducator(id) {
  const all = useEducators();
  return all.find((e) => e.id === id) || null;
}
