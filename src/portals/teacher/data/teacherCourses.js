// Shared mock data for the My Courses portfolio + Course Management
// Overview. This is the multi-course counterpart to contentData.js's
// single COURSE/INITIAL_MODULES mock (which stays exactly as-is and
// becomes course "c1" below, via TeacherCoursesContext, so the Course
// Builder's existing default behavior at /teacher/coursebuilder with no
// :courseId is untouched).
//
// "Today" is fixed so days-pending/last-active/at-risk math in the demo
// stays stable across renders instead of drifting off `new Date()`.
export const TODAY = new Date("2026-09-20T12:00:00");

import { PLATFORM_COMMISSION_RATE, computeEducatorEarnings } from "../components/contentData";

// Single place every screen that shows "this course's revenue" computes
// it from — course cards, the Overview tab and the Analytics tab all call
// this instead of each hardcoding a number, so they can never drift apart.
export function courseMonthlyRevenue(course) {
  if (course.pricingModel === "free") return 0;
  const { earnings } = computeEducatorEarnings(course.price);
  return Math.round(earnings * (course.salesThisMonth || 0) * 100) / 100;
}

export function courseTotalRevenue(course) {
  if (course.pricingModel === "free") return 0;
  const { earnings } = computeEducatorEarnings(course.price);
  return Math.round(earnings * (course.totalSales || 0) * 100) / 100;
}

export function daysAgo(dateStr) {
  const ms = TODAY - new Date(dateStr);
  return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export function isAtRisk(student) {
  return student.completionStatus !== "completed" && daysAgo(student.lastActive) >= 14;
}

function id(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

function makeStudents(count, seedRevenueTier = "mid") {
  const names = [
    "Priya Sharma", "Daniel Osei", "Mei Lin", "Carlos Ibarra", "Fatima Noor",
    "Jonas Weber", "Aisha Bello", "Ravi Kapoor", "Sofia Rossi", "Liam Carter",
    "Noor Haddad", "Yuki Tanaka", "Elena Petrova", "Tariq Malik", "Grace Kim",
  ];
  return Array.from({ length: count }).map((_, i) => {
    const progress = [100, 100, 82, 64, 40, 15, 0][i % 7];
    const completionStatus = progress === 100 ? "completed" : progress === 0 ? "not-started" : "in-progress";
    const lastActiveDaysAgo = [1, 3, 6, 10, 15, 20, 30][i % 7];
    const lastActive = new Date(TODAY.getTime() - lastActiveDaysAgo * 86400000).toISOString().slice(0, 10);
    const enrolledDaysAgo = 20 + i * 9;
    const enrolledAt = new Date(TODAY.getTime() - enrolledDaysAgo * 86400000).toISOString().slice(0, 10);
    return {
      id: id("stu"),
      name: names[(i + (seedRevenueTier === "mid" ? 0 : 7)) % names.length],
      enrolledAt,
      progress,
      completionStatus,
      lastActive,
      certificateIssued: progress === 100,
    };
  });
}

const C1_STUDENTS = makeStudents(9, "mid");

// Each submission carries a real studentId from C1_STUDENTS (never a
// separately hardcoded name) so a graded result always attributes back to
// the exact same student record the Students tab reads from. `content`
// shapes the submission viewer per submissionType (file/text/link); a
// `quiz` submission is a manually-reviewed open-ended item and carries its
// own `manualMaxScore` since quiz lessons don't author a rubric/maxScore
// the way Assignment lessons do. Dates are relative to TODAY
// (2026-09-20) so "days pending"/"late" read realistically without drifting.
const C1_SUBMISSIONS = [
  {
    id: id("sub"), studentId: C1_STUDENTS[0].id, studentName: C1_STUDENTS[0].name,
    lessonId: "l6", moduleTitle: "Building a Design System", type: "assignment",
    submittedAt: "2026-09-12", late: false, status: "pending",
    content: { kind: "link", value: "https://figma.com/file/priya-token-set" },
  },
  {
    id: id("sub"), studentId: C1_STUDENTS[1].id, studentName: C1_STUDENTS[1].name,
    lessonId: "l6", moduleTitle: "Building a Design System", type: "assignment",
    submittedAt: "2026-09-08", late: false, status: "pending",
    content: { kind: "file", value: "daniel-tokens-v2.fig", fileSize: 1_960_000 },
  },
  {
    id: id("sub"), studentId: C1_STUDENTS[2].id, studentName: C1_STUDENTS[2].name,
    lessonId: "l6", moduleTitle: "Building a Design System", type: "assignment",
    submittedAt: "2026-08-30", late: false, status: "graded",
    content: { kind: "link", value: "https://figma.com/file/mei-color-system" },
    score: 92, feedback: "<p>Excellent naming discipline — great use of tiered tokens.</p>",
    gradedAt: "2026-09-01", gradedBy: "Ansh Mehra",
  },
  {
    id: id("sub"), studentId: C1_STUDENTS[3].id, studentName: C1_STUDENTS[3].name,
    lessonId: "l6", moduleTitle: "Building a Design System", type: "assignment",
    submittedAt: "2026-09-03", late: true, status: "pending",
    content: {
      kind: "text",
      value: "For this token set I started from our existing brand palette and layered semantic aliases on top — primary/secondary/surface — then mapped spacing to an 8pt base scale. Screenshots of the applied component are linked in the doc below.",
    },
  },
  {
    id: id("sub"), studentId: C1_STUDENTS[4].id, studentName: C1_STUDENTS[4].name,
    lessonId: "l6", moduleTitle: "Building a Design System", type: "assignment",
    submittedAt: "2026-09-18", late: false, status: "pending",
    content: { kind: "file", value: null },
  },
  {
    id: id("sub"), studentId: C1_STUDENTS[5].id, studentName: C1_STUDENTS[5].name,
    lessonId: "l4", moduleTitle: "Foundations of Color Theory", type: "quiz",
    submittedAt: "2026-09-15", late: false, status: "pending", manualMaxScore: 10,
    content: {
      kind: "text",
      value: "A perceptually uniform color space keeps equal numeric steps looking like equal visual steps — HSL doesn't guarantee that, since lightness perception varies by hue, which is why two colors at the same L value can look like very different brightness.",
    },
  },
  {
    id: id("sub"), studentId: C1_STUDENTS[6].id, studentName: C1_STUDENTS[6].name,
    lessonId: "l6", moduleTitle: "Building a Design System", type: "assignment",
    submittedAt: "2026-09-05", late: false, status: "draft",
    content: { kind: "link", value: "https://figma.com/file/aisha-tokens-draft" },
    score: 70, feedback: "<p>Good start on the color ramp — still reviewing the spacing scale before finalizing.</p>",
  },
];

const C1_REVIEWS = [
  { id: id("rev"), studentName: "Sofia Rossi", rating: 5, text: "The color theory module alone was worth it — I finally understand contrast ratios.", date: "2026-09-10", verified: true, reply: "So glad it clicked, Sofia — thank you!" },
  { id: id("rev"), studentName: "Liam Carter", rating: 5, text: "Best design-systems course I've taken. Practical, not just theory.", date: "2026-09-05", verified: true, reply: null },
  { id: id("rev"), studentName: "Noor Haddad", rating: 4, text: "Great content, wish the live critique session was recorded for more time zones.", date: "2026-08-28", verified: true, reply: null },
  { id: id("rev"), studentName: "Yuki Tanaka", rating: 5, text: "Module 2's token naming conventions changed how our whole team works.", date: "2026-08-20", verified: true, reply: "Amazing to hear it reached your whole team!" },
  { id: id("rev"), studentName: "Elena Petrova", rating: 3, text: "Solid fundamentals but I wanted more on dark-mode tokens specifically.", date: "2026-08-14", verified: false, reply: null },
];

// -- Homework/Notes shared with students, separate from core lesson
// content — attached to "course" / a specific module / a specific lesson
// using the exact same modules/lessons ids as Curriculum, never a
// separately hardcoded structure.
const C1_HOMEWORK = [
  {
    id: id("hw"), title: "Extra practice: naming conventions cheat sheet", description: "<p>A one-page reference for the naming pattern we used in class — keep it open while you work on the assignment.</p>",
    attachTo: { level: "lesson", moduleId: "m2", lessonId: "l6" },
    files: [{ id: id("f"), name: "naming-cheat-sheet.pdf", size: 240_000 }],
    availability: "immediate", availableAt: null, notify: true,
    sharedAt: "2026-09-10",
  },
  {
    id: id("hw"), title: "Module 1 recap notes", description: "<p>Condensed notes covering hue, saturation and perceptual lightness — useful before the quiz.</p>",
    attachTo: { level: "module", moduleId: "m1", lessonId: null },
    files: [{ id: id("f"), name: "module-1-recap.pdf", size: 410_000 }, { id: id("f"), name: "hsl-diagram.png", size: 180_000 }],
    availability: "immediate", availableAt: null, notify: true,
    sharedAt: "2026-08-22",
  },
  {
    id: id("hw"), title: "Bonus: dark-mode token checklist", description: "<p>Optional supplementary material for anyone extending their token set to dark mode.</p>",
    attachTo: { level: "course", moduleId: null, lessonId: null },
    files: [{ id: id("f"), name: "dark-mode-checklist.pdf", size: 96_000 }],
    availability: "scheduled", availableAt: "2026-09-25T09:00", notify: false,
    sharedAt: "2026-09-19",
  },
];

// -- Marksheets/Results published to students, separate from per-assignment
// grading — either one shared document ("all enrolled") or one file per
// selected student ("individual").
const C1_RESULTS = [
  {
    id: id("res"), title: "Mid-Term Results — October 2026", resultType: "Term Result",
    scope: "all", studentIds: [],
    files: [{ id: id("f"), name: "midterm-results-oct-2026.pdf", size: 320_000 }],
    note: "Great overall performance across the cohort — see individual comments in the doc for anyone below 70%.",
    notify: true, publishedAt: "2026-09-14",
  },
  {
    id: id("res"), title: "Design Systems Mock Test — Practice Series 2", resultType: "Mock Test",
    scope: "individual", studentIds: [C1_STUDENTS[0].id, C1_STUDENTS[2].id, C1_STUDENTS[5].id],
    files: [
      { id: id("f"), name: `${C1_STUDENTS[0].name.replace(/\s+/g, "-").toLowerCase()}-result.pdf`, size: 84_000, studentId: C1_STUDENTS[0].id },
      { id: id("f"), name: `${C1_STUDENTS[2].name.replace(/\s+/g, "-").toLowerCase()}-result.pdf`, size: 79_000, studentId: C1_STUDENTS[2].id },
      { id: id("f"), name: `${C1_STUDENTS[5].name.replace(/\s+/g, "-").toLowerCase()}-result.pdf`, size: 91_000, studentId: C1_STUDENTS[5].id },
    ],
    note: "Individual score breakdowns attached — resit is available on request.",
    notify: true, publishedAt: "2026-09-02",
  },
];

export const RESULT_TYPES = ["Term Result", "Mock Test", "Practice Series", "Custom"];

// Shared "how urgent does this look" color ramp for the Grading queue —
// neutral while fresh, amber once it's dragging, red past a week, since a
// FIFO queue only works if aging is visible at a glance.
export function submissionUrgency(daysPending) {
  if (daysPending > 7) return "danger";
  if (daysPending > 3) return "warning";
  return "neutral";
}

// -- Course 2: a second, lighter-weight published course --------------
const C2_MODULES = [
  {
    id: "c2m1", title: "Component Architecture",
    lessons: [
      { id: "c2l1", type: "video", title: "Composable vs. prop-driven components", duration: "9:40", hasContent: true, preview: true },
      { id: "c2l2", type: "video", title: "Custom hooks for shared logic", duration: "14:02", hasContent: true, preview: false },
      { id: "c2l3", type: "article", title: "When to reach for context vs. props", hasContent: true, preview: false },
    ],
  },
  {
    id: "c2m2", title: "Performance in Production",
    lessons: [
      { id: "c2l4", type: "video", title: "Memoization without the guesswork", duration: "11:15", hasContent: true, preview: false },
      { id: "c2l5", type: "quiz", title: "Knowledge check: render performance", hasContent: true, preview: false, questions: [
        { id: id("q"), text: "useMemo recomputes on every render regardless of dependencies.", type: "truefalse", points: 1, options: [{ id: id("o"), text: "True", correct: false }, { id: id("o"), text: "False", correct: true }] },
      ] },
      { id: "c2l6", type: "assignment", title: "Profile and fix a slow list view", hasContent: true, preview: false,
        instructions: "<p>Given the provided repo, use the React Profiler to find the slowest render path in the list view and submit a short write-up of your fix.</p>",
        maxScore: 50, submissionType: "link",
        rubric: [{ id: id("r"), label: "Correctly identifies the bottleneck", points: 20 }, { id: id("r"), label: "Fix measurably improves render time", points: 20 }, { id: id("r"), label: "Write-up is clear", points: 10 }],
      },
    ],
  },
  {
    id: "c2m3", title: "Testing & Shipping",
    lessons: [
      { id: "c2l7", type: "video", title: "Testing hooks in isolation", duration: "10:30", hasContent: true, preview: false },
      { id: "c2l8", type: "resource", title: "CI config starter pack", hasContent: true, preview: false, files: [{ id: id("f"), name: "ci-starter.zip", size: 340_000 }] },
    ],
  },
];

const C2_STUDENTS = makeStudents(6, "hi");

const C2_SUBMISSIONS = [
  { id: id("sub"), studentName: "Tariq Malik", lessonId: "c2l6", moduleTitle: "Performance in Production", submittedAt: "2026-09-16", type: "assignment", contentPreview: "https://github.com/tariqm/profiler-fix (PR link)", status: "pending" },
  { id: id("sub"), studentName: "Grace Kim", lessonId: "c2l6", moduleTitle: "Performance in Production", submittedAt: "2026-09-01", type: "assignment", contentPreview: "https://github.com/gracek/list-perf (PR link)", status: "graded", score: 45, feedback: "Nice catch on the unmemoized selector — clean fix." },
];

const C2_REVIEWS = [
  { id: id("rev"), studentName: "Ravi Kapoor", rating: 5, text: "Finally a React course that talks about production tradeoffs, not toy examples.", date: "2026-09-14", verified: true, reply: null },
  { id: id("rev"), studentName: "Aisha Bello", rating: 4, text: "Dense but worth it. More testing content would be great.", date: "2026-09-02", verified: false, reply: "Testing module is getting a refresh next quarter — thank you!" },
];

// -- Remaining lifecycle-variety courses (lighter mocks) ---------------
const C3_MODULES = [
  { id: "c3m1", title: "Getting Started", lessons: [
    { id: "c3l1", type: "video", title: "What makes a portfolio review useful", duration: "6:12", hasContent: true, preview: true },
    { id: "c3l2", type: "article", title: "A framework for giving feedback", hasContent: false, preview: false },
  ] },
  { id: "c3m2", title: "Live Reviews", lessons: [
    { id: "c3l3", type: "live", title: "Group review session 1", hasContent: false, preview: false, scheduledAt: "" },
  ] },
];

const C4_MODULES = [
  { id: "c4m1", title: "Type Fundamentals", lessons: [
    { id: "c4l1", type: "video", title: "Anatomy of a typeface", duration: "8:50", hasContent: true, preview: true },
    { id: "c4l2", type: "video", title: "Type scales that actually scale", duration: "10:20", hasContent: true, preview: false },
    { id: "c4l3", type: "quiz", title: "Knowledge check: type scales", hasContent: true, preview: false, questions: [] },
  ] },
  { id: "c4m2", title: "Applying a Type System", lessons: [
    { id: "c4l4", type: "assignment", title: "Build a 3-tier type scale", hasContent: true, preview: false, maxScore: 100, submissionType: "file", rubric: [] },
  ] },
];

const C5_MODULES = [
  { id: "c5m1", title: "Foundations of Accessibility", lessons: [
    { id: "c5l1", type: "video", title: "Why accessibility is a design constraint, not an afterthought", duration: "7:35", hasContent: true, preview: true },
    { id: "c5l2", type: "article", title: "Screen readers 101", hasContent: true, preview: false },
  ] },
  { id: "c5m2", title: "Building Accessible Components", lessons: [
    { id: "c5l3", type: "video", title: "Focus management in modals", duration: "9:10", hasContent: true, preview: false },
    { id: "c5l4", type: "assignment", title: "Audit a real component for a11y gaps", hasContent: true, preview: false, maxScore: 100, submissionType: "file", rubric: [] },
  ] },
];

const C6_MODULES = [
  { id: "c6m1", title: "Tokens & Foundations", lessons: [
    { id: "c6l1", type: "video", title: "From palette to token", duration: "8:00", hasContent: true, preview: true },
    { id: "c6l2", type: "video", title: "Spacing and layout tokens", duration: "9:44", hasContent: true, preview: false },
  ] },
  { id: "c6m2", title: "Component Library", lessons: [
    { id: "c6l3", type: "article", title: "Documenting components for handoff", hasContent: true, preview: false },
    { id: "c6l4", type: "resource", title: "Starter component library file", hasContent: true, preview: false, files: [{ id: id("f"), name: "components-starter.fig", size: 1_800_000 }] },
  ] },
];

const C6_STUDENTS = makeStudents(5, "hi");
const C6_REVIEWS = [
  { id: id("rev"), studentName: "Jonas Weber", rating: 5, text: "This was the course that got our team to actually adopt a token system.", date: "2026-05-02", verified: true, reply: "So happy it stuck — congrats to the whole team." },
];

// -- The six courses this educator has built ---------------------------
// c1 is deliberately NOT redefined here — TeacherCoursesContext builds it
// from contentData.js's existing COURSE + INITIAL_MODULES so the Course
// Builder's current default (no :courseId) keeps behaving exactly as it
// did before this file existed.
export const EXTRA_COURSES = [
  {
    id: "c2",
    title: "Modern React Patterns for Production",
    subtitle: "Component architecture, performance and testing patterns that hold up at scale.",
    thumbnail: null,
    category: "Development",
    subCategory: "Frontend Engineering",
    level: "Advanced",
    language: "English",
    outcomes: ["Design composable component APIs", "Profile and fix real render-performance issues", "Test hooks and components in isolation"],
    requirements: ["Solid working knowledge of React"],
    certificate: true,
    rating: 4.7,
    ratingCount: 342,
    instructor: { name: "Ansh Mehra", headline: "Product Designer · 8 years teaching design systems", photoUrl: null },
    pricingModel: "paid", price: 2499, compareAtPrice: 3499, currency: "INR", couponsEnabled: true,
    status: "published", adminFeedback: "", submittedAt: "2026-06-02T10:00:00",
    createdAt: "2026-05-20", updatedAt: "2026-09-15",
    salesThisMonth: 34, totalSales: 864,
    modules: C2_MODULES, students: C2_STUDENTS, submissions: C2_SUBMISSIONS, reviews: C2_REVIEWS,
  },
  {
    id: "c3",
    title: "Portfolio Reviews for Junior Designers",
    subtitle: "A structured, feedback-first path to a portfolio that gets interviews.",
    thumbnail: null,
    category: "Career",
    subCategory: "Design Careers",
    level: "Beginner",
    language: "English",
    outcomes: ["Curate 4-6 strong case studies", "Give and receive structured design feedback"],
    requirements: ["A rough draft portfolio, even an incomplete one"],
    certificate: false,
    rating: 0, ratingCount: 0,
    instructor: { name: "Ansh Mehra", headline: "Product Designer · 8 years teaching design systems", photoUrl: null },
    pricingModel: "paid", price: 9999, compareAtPrice: 14999, currency: "INR", couponsEnabled: true,
    status: "draft", adminFeedback: "", submittedAt: null,
    createdAt: "2026-09-01", updatedAt: "2026-09-18",
    salesThisMonth: 0, totalSales: 0,
    modules: C3_MODULES, students: [], submissions: [], reviews: [],
  },
  {
    id: "c4",
    title: "Intro to Typography Systems",
    subtitle: "Type scales, pairing and rhythm for interfaces, not just posters.",
    thumbnail: null,
    category: "Design",
    subCategory: "Typography",
    level: "Beginner",
    language: "English",
    outcomes: ["Build a modular type scale", "Pair typefaces with intent"],
    requirements: ["A free Figma account"],
    certificate: true,
    rating: 0, ratingCount: 0,
    instructor: { name: "Ansh Mehra", headline: "Product Designer · 8 years teaching design systems", photoUrl: null },
    pricingModel: "paid", price: 1499, compareAtPrice: null, currency: "INR", couponsEnabled: true,
    status: "pending_review", adminFeedback: "", submittedAt: "2026-09-16T09:30:00",
    createdAt: "2026-08-10", updatedAt: "2026-09-16",
    salesThisMonth: 0, totalSales: 0,
    modules: C4_MODULES, students: [], submissions: [], reviews: [],
  },
  {
    id: "c5",
    title: "Accessible Web Fundamentals",
    subtitle: "Practical, standards-based accessibility for real product teams.",
    thumbnail: null,
    category: "Development",
    subCategory: "Web Accessibility",
    level: "Intermediate",
    language: "English",
    outcomes: ["Audit a component against WCAG 2.1 AA", "Manage focus correctly in dynamic UI"],
    requirements: ["Basic HTML/CSS/JS"],
    certificate: true,
    rating: 0, ratingCount: 0,
    instructor: { name: "Ansh Mehra", headline: "Product Designer · 8 years teaching design systems", photoUrl: null },
    pricingModel: "paid", price: 1299, compareAtPrice: null, currency: "INR", couponsEnabled: true,
    status: "changes_requested",
    adminFeedback: "The intro video is missing captions, and Module 2's assignment needs a rubric with at least one accessibility-specific criterion. Please add both and resubmit.",
    submittedAt: "2026-09-05T14:00:00",
    createdAt: "2026-07-22", updatedAt: "2026-09-09",
    salesThisMonth: 0, totalSales: 0,
    modules: C5_MODULES, students: [], submissions: [], reviews: [],
  },
  {
    id: "c6",
    title: "Design Systems 101",
    subtitle: "The fundamentals course this educator's flagship course grew out of.",
    thumbnail: null,
    category: "Design",
    subCategory: "Design Systems",
    level: "Beginner",
    language: "English",
    outcomes: ["Understand tokens, components and documentation", "Ship a small but real component library"],
    requirements: ["A free Figma account"],
    certificate: true,
    rating: 4.9, ratingCount: 128,
    instructor: { name: "Ansh Mehra", headline: "Product Designer · 8 years teaching design systems", photoUrl: null },
    pricingModel: "paid", price: 799, compareAtPrice: null, currency: "INR", couponsEnabled: false,
    status: "archived", adminFeedback: "", submittedAt: "2025-11-01T10:00:00",
    createdAt: "2025-10-01", updatedAt: "2026-04-18",
    salesThisMonth: 0, totalSales: 612,
    modules: C6_MODULES, students: C6_STUDENTS, submissions: [], reviews: C6_REVIEWS,
  },
];

// -- Analytics mocks (Overview sparkline + Analytics deep-dive) --------
// Kept as plain per-course fields rather than computed-on-render, but every
// screen that shows revenue still runs the actual number through
// courseMonthlyRevenue/courseTotalRevenue above, not a separately hardcoded
// figure — only the *shape* of the trend (relative movement month to
// month) is mocked here.
export const C1_ANALYTICS = {
  enrollmentTrend: [
    { label: "Apr", count: 640 }, { label: "May", count: 780 }, { label: "Jun", count: 890 },
    { label: "Jul", count: 980 }, { label: "Aug", count: 1120 }, { label: "Sep", count: 1240 },
  ],
  revenueTrend: [
    { label: "Apr", sales: 210, revenue: 313800 }, { label: "May", sales: 240, revenue: 359400 },
    { label: "Jun", sales: 260, revenue: 384700 }, { label: "Jul", sales: 280, revenue: 420100 },
    { label: "Aug", sales: 310, revenue: 478400 }, { label: "Sep", sales: 340, revenue: 627700 },
  ],
  dropoffFunnel: [
    { label: "Started", pct: 100 }, { label: "Module 1 complete", pct: 88 },
    { label: "Module 2 complete", pct: 64 }, { label: "Module 3 complete", pct: 41 }, { label: "Course complete", pct: 33 },
  ],
  quizPerformance: [
    { question: "Which value in HSL controls closeness to white or black?", correctPct: 58 },
    { question: "WCAG AA requires 4.5:1 contrast for normal body text.", correctPct: 91 },
  ],
  deviceBreakdown: [
    { label: "Desktop", value: 58, colorClass: "stroke-rotation-1" },
    { label: "Mobile", value: 31, colorClass: "stroke-rotation-3" },
    { label: "Tablet", value: 11, colorClass: "stroke-rotation-4" },
  ],
};

export const COURSE_ANALYTICS = {
  c1: C1_ANALYTICS,
  c2: {
    enrollmentTrend: [
      { label: "Apr", count: 520 }, { label: "May", count: 590 }, { label: "Jun", count: 660 },
      { label: "Jul", count: 720 }, { label: "Aug", count: 800 }, { label: "Sep", count: 864 },
    ],
    revenueTrend: [
      { label: "Apr", sales: 22, revenue: 43982 }, { label: "May", sales: 24, revenue: 47981 },
      { label: "Jun", sales: 26, revenue: 51979 }, { label: "Jul", sales: 27, revenue: 53978 },
      { label: "Aug", sales: 30, revenue: 59976 }, { label: "Sep", sales: 34, revenue: 67973 },
    ],
    dropoffFunnel: [
      { label: "Started", pct: 100 }, { label: "Module 1 complete", pct: 82 },
      { label: "Module 2 complete", pct: 55 }, { label: "Module 3 complete", pct: 37 },
    ],
    quizPerformance: [{ question: "useMemo recomputes on every render regardless of dependencies.", correctPct: 74 }],
    deviceBreakdown: [
      { label: "Desktop", value: 71, colorClass: "stroke-rotation-1" },
      { label: "Mobile", value: 22, colorClass: "stroke-rotation-3" },
      { label: "Tablet", value: 7, colorClass: "stroke-rotation-4" },
    ],
  },
  c6: {
    enrollmentTrend: [
      { label: "Dec", count: 480 }, { label: "Jan", count: 520 }, { label: "Feb", count: 555 },
      { label: "Mar", count: 580 }, { label: "Apr", count: 605 }, { label: "May", count: 612 },
    ],
    revenueTrend: [
      { label: "Dec", sales: 40, revenue: 25568 }, { label: "Jan", sales: 34, revenue: 21733 },
      { label: "Feb", sales: 28, revenue: 17898 }, { label: "Mar", sales: 20, revenue: 12784 },
      { label: "Apr", sales: 18, revenue: 11506 }, { label: "May", sales: 6, revenue: 3835 },
    ],
    dropoffFunnel: [
      { label: "Started", pct: 100 }, { label: "Module 1 complete", pct: 90 }, { label: "Module 2 complete", pct: 71 },
    ],
    quizPerformance: [],
    deviceBreakdown: [
      { label: "Desktop", value: 64, colorClass: "stroke-rotation-1" },
      { label: "Mobile", value: 28, colorClass: "stroke-rotation-3" },
      { label: "Tablet", value: 8, colorClass: "stroke-rotation-4" },
    ],
  },
};

export function courseAnalytics(courseId) {
  return (
    COURSE_ANALYTICS[courseId] || {
      enrollmentTrend: [], revenueTrend: [], dropoffFunnel: [], quizPerformance: [], deviceBreakdown: [],
    }
  );
}

export { C1_STUDENTS, C1_SUBMISSIONS, C1_REVIEWS, C1_HOMEWORK, C1_RESULTS };

// 5-star distribution used by both the Overview tab's rating breakdown and
// the Reviews tab's summary header — synthesized deterministically from a
// course's rating/ratingCount (skewed toward the recorded average) rather
// than stored as separate mock counts, so the two can never disagree.
export function starDistribution(course) {
  const total = course.ratingCount || 0;
  if (!total) return [5, 4, 3, 2, 1].map((star) => ({ star, count: 0, pct: 0 }));
  const weights = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const r = course.rating || 0;
  if (r >= 4.5) Object.assign(weights, { 5: 0.72, 4: 0.2, 3: 0.05, 2: 0.02, 1: 0.01 });
  else if (r >= 4) Object.assign(weights, { 5: 0.5, 4: 0.32, 3: 0.12, 2: 0.04, 1: 0.02 });
  else if (r >= 3) Object.assign(weights, { 5: 0.28, 4: 0.3, 3: 0.24, 2: 0.12, 1: 0.06 });
  else Object.assign(weights, { 5: 0.12, 4: 0.18, 3: 0.25, 2: 0.25, 1: 0.2 });
  return [5, 4, 3, 2, 1].map((star) => {
    const count = Math.round(total * weights[star]);
    return { star, count, pct: total ? Math.round((count / total) * 100) : 0 };
  });
}

// Deterministic per-lesson completion % for the Curriculum tab's
// mini-analytics badge — synthesized from lesson position (earlier lessons
// have more finishers) rather than a separately hardcoded value per lesson.
export function lessonCompletionPct(index) {
  return Math.max(6, Math.min(96, 94 - index * 8));
}
