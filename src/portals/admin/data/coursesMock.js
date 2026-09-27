// Course Management & Approval Queue — mock data.
// Jira: Day 3 — Course management & approval queue (updated pass)
// A course starts in draft, fully editable only by its owning educator.
// Submitting for review freezes it for the educator and surfaces it to
// Admin. Only an Admin approval can move a course to published — an
// educator cannot publish their own course directly. Who Uses It:
// Educator (creation and management), Admin (approval), Student (read
// access once published).
//
// This is UI-only placeholder data for the Course Approval screen; replace
// with real calls through ../services/adminApi.js once the course-review
// endpoints exist. Shape (id/status/feedback/curriculum/...) should carry
// over as-is. Follows the same tiny pub/sub "store" pattern already used
// by data/educatorsMock.js so CourseApproval.jsx stays in sync across
// re-renders without a real API layer.
//
// `educatorId` values below are real ids from ../data/educatorsMock.js
// (EDU-1001..EDU-1013) so the review modal's "View Educator Profile" link
// (-> /admin/educatorverification/:educatorId) resolves to a real profile
// instead of a dead link. `educatorVerificationStatus` mirrors that same
// educator's verificationStatus there — kept as a plain mock field here
// (rather than importing the live educators store) so this file has no
// dependency on educatorsMock.js and stays a drop-in stand-in for a real
// "course + its educator's verification status" API response.
//
// `curriculum[].lessons` is an array of { title, type } so the review
// modal can expand a module to show individual lesson titles and content
// type (video / reading / quiz / assignment / assessment) — module-level
// lesson counts are simply curriculum[].lessons.length.

import { useSyncExternalStore } from "react";

export const COURSE_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

export const COURSE_STATUS_LABEL = {
  [COURSE_STATUS.PENDING]: "Pending Review",
  [COURSE_STATUS.APPROVED]: "Approved",
  [COURSE_STATUS.REJECTED]: "Rejected",
};

export const CATEGORY_OPTIONS = [
  "Computer Science",
  "Mathematics",
  "Data & AI",
  "Language",
  "Business",
  "Test Prep",
];

export const LESSON_TYPE = {
  VIDEO: "video",
  READING: "reading",
  QUIZ: "quiz",
  ASSIGNMENT: "assignment",
  ASSESSMENT: "assessment",
};

export const LESSON_TYPE_LABEL = {
  [LESSON_TYPE.VIDEO]: "Video",
  [LESSON_TYPE.READING]: "Reading",
  [LESSON_TYPE.QUIZ]: "Quiz",
  [LESSON_TYPE.ASSIGNMENT]: "Assignment",
  [LESSON_TYPE.ASSESSMENT]: "Assessment",
};

// Thumbnail accent — rotates through the palette already defined in
// adminTheme.css (--color-primary-dark / financial-cyan / regional-purple
// / analytics-orange) so course "thumbnails" (no real image assets yet)
// stay inside the existing colour system instead of introducing new hues.
export const THUMBNAIL_ACCENTS = [
  "var(--color-primary-dark)",
  "var(--color-financial-cyan)",
  "var(--color-regional-purple)",
  "var(--color-analytics-orange)",
];

const SEED_COURSES = [
  {
    id: "crs-101",
    title: "Data Structures & Algorithms — Foundations",
    thumbnailInitials: "DS",
    thumbnailAccent: THUMBNAIL_ACCENTS[0],
    category: "Computer Science",
    subCategory: "Programming Fundamentals",
    level: "Beginner",
    language: "English",
    courseType: "Recorded",
    educator: "Dr. Sarah Jenkins",
    educatorId: "EDU-1001",
    educatorEmail: "sarah.jenkins@example.com",
    educatorPhone: "+1 (415) 555-0142",
    educatorVerificationStatus: "verified",
    submittedDate: "Sep 14, 2026",
    lastUpdatedDate: "Sep 14, 2026",
    status: COURSE_STATUS.PENDING,
    price: "₹4,999",
    lessons: 42,
    duration: "18h 30m",
    description:
      "A ground-up course covering arrays, linked lists, trees, graphs and core algorithmic techniques (sorting, searching, dynamic programming), aimed at undergraduate CS students and interview prep.",
    learningOutcomes: [
      "Implement core data structures (arrays, linked lists, stacks, queues, trees, graphs) from scratch",
      "Analyze time and space complexity of common algorithms",
      "Apply sorting, searching and dynamic-programming techniques to solve interview-style problems",
    ],
    prerequisites: ["Basic programming in any language (loops, functions, conditionals)", "High-school level mathematics"],
    skillsCovered: ["Data Structures", "Algorithm Design", "Complexity Analysis", "Problem Solving"],
    curriculum: [
      {
        module: "Module 1: Arrays & Strings",
        lessons: [
          { title: "Array fundamentals & memory layout", type: LESSON_TYPE.VIDEO },
          { title: "Two-pointer technique", type: LESSON_TYPE.VIDEO },
          { title: "String manipulation patterns", type: LESSON_TYPE.READING },
          { title: "Sliding window problems", type: LESSON_TYPE.VIDEO },
          { title: "Module 1 quiz", type: LESSON_TYPE.QUIZ },
          { title: "Problem set: arrays", type: LESSON_TYPE.ASSIGNMENT },
        ],
      },
      {
        module: "Module 2: Linked Lists & Stacks",
        lessons: [
          { title: "Singly vs. doubly linked lists", type: LESSON_TYPE.VIDEO },
          { title: "Stack & queue implementations", type: LESSON_TYPE.VIDEO },
          { title: "Reading: amortized analysis", type: LESSON_TYPE.READING },
          { title: "Module 2 quiz", type: LESSON_TYPE.QUIZ },
        ],
      },
      {
        module: "Module 3: Trees & Graphs",
        lessons: [
          { title: "Binary trees & traversals", type: LESSON_TYPE.VIDEO },
          { title: "Binary search trees", type: LESSON_TYPE.VIDEO },
          { title: "Graph representations", type: LESSON_TYPE.VIDEO },
          { title: "BFS & DFS", type: LESSON_TYPE.VIDEO },
          { title: "Reading: balanced trees overview", type: LESSON_TYPE.READING },
          { title: "Problem set: trees & graphs", type: LESSON_TYPE.ASSIGNMENT },
        ],
      },
      {
        module: "Module 4: Dynamic Programming",
        lessons: [
          { title: "Memoization vs. tabulation", type: LESSON_TYPE.VIDEO },
          { title: "Classic DP problems", type: LESSON_TYPE.VIDEO },
          { title: "Module 4 quiz", type: LESSON_TYPE.QUIZ },
        ],
      },
      {
        module: "Module 5: Capstone Problem Sets",
        lessons: [
          { title: "Mixed-topic mock interview set", type: LESSON_TYPE.ASSIGNMENT },
          { title: "Final assessment", type: LESSON_TYPE.ASSESSMENT },
        ],
      },
    ],
    feedback: null,
    previousFeedback: null,
    reviewedDate: null,
    reviewedBy: null,
  },
  {
    id: "crs-102",
    title: "Modern World History: 1900–Present",
    thumbnailInitials: "MH",
    thumbnailAccent: THUMBNAIL_ACCENTS[1],
    category: "Business",
    subCategory: "General Knowledge",
    level: "Beginner",
    language: "English",
    courseType: "Recorded",
    educator: "Marcus Thorne",
    educatorId: "EDU-1002",
    educatorEmail: "marcus.thorne@example.com",
    educatorPhone: "+1 (212) 555-0198",
    educatorVerificationStatus: "pending",
    submittedDate: "Sep 13, 2026",
    lastUpdatedDate: "Sep 13, 2026",
    status: COURSE_STATUS.PENDING,
    price: "₹2,499",
    lessons: 28,
    duration: "12h 10m",
    description:
      "A primary-source-driven survey of 20th- and 21st-century world history, built for high-school and early-college learners preparing for exams and general knowledge.",
    learningOutcomes: [
      "Explain the causes and consequences of the World Wars and Cold War",
      "Read and interpret primary historical sources",
      "Connect 20th-century events to present-day geopolitics",
    ],
    prerequisites: ["None — suitable for beginners"],
    skillsCovered: ["Historical Analysis", "Source Interpretation", "Essay Writing"],
    curriculum: [
      {
        module: "Module 1: The World Wars",
        lessons: [
          { title: "Causes of WWI", type: LESSON_TYPE.VIDEO },
          { title: "The interwar years", type: LESSON_TYPE.VIDEO },
          { title: "WWII: a global overview", type: LESSON_TYPE.VIDEO },
          { title: "Primary source reading: wartime letters", type: LESSON_TYPE.READING },
          { title: "Module 1 quiz", type: LESSON_TYPE.QUIZ },
        ],
      },
      {
        module: "Module 2: Cold War Era",
        lessons: [
          { title: "Origins of the Cold War", type: LESSON_TYPE.VIDEO },
          { title: "Proxy conflicts", type: LESSON_TYPE.VIDEO },
          { title: "Reading: the Cuban Missile Crisis", type: LESSON_TYPE.READING },
          { title: "Essay assignment", type: LESSON_TYPE.ASSIGNMENT },
        ],
      },
      {
        module: "Module 3: Decolonization & Globalization",
        lessons: [
          { title: "Decolonization movements", type: LESSON_TYPE.VIDEO },
          { title: "Rise of globalization", type: LESSON_TYPE.VIDEO },
          { title: "Module 3 quiz", type: LESSON_TYPE.QUIZ },
        ],
      },
      {
        module: "Module 4: The 21st Century",
        lessons: [
          { title: "Post-9/11 world order", type: LESSON_TYPE.VIDEO },
          { title: "Final assessment", type: LESSON_TYPE.ASSESSMENT },
        ],
      },
    ],
    feedback: null,
    previousFeedback: null,
    reviewedDate: null,
    reviewedBy: null,
  },
  {
    id: "crs-103",
    title: "Applied Machine Learning for Developers",
    thumbnailInitials: "ML",
    thumbnailAccent: THUMBNAIL_ACCENTS[2],
    category: "Data & AI",
    subCategory: "Machine Learning",
    level: "Intermediate",
    language: "English",
    courseType: "Hybrid",
    educator: "Elena Rodriguez",
    educatorId: "EDU-1003",
    educatorEmail: "elena.rodriguez@example.com",
    educatorPhone: "+34 91 555 0176",
    educatorVerificationStatus: "under_review",
    submittedDate: "Sep 12, 2026",
    lastUpdatedDate: "Sep 15, 2026",
    status: COURSE_STATUS.PENDING,
    price: "₹6,999",
    lessons: 36,
    duration: "20h 45m",
    description:
      "A hands-on ML course for working developers switching into AI roles — covers supervised/unsupervised learning, model evaluation, and deploying models behind an API. Includes two live cohort Q&A sessions alongside the recorded curriculum.",
    learningOutcomes: [
      "Train and evaluate supervised and unsupervised ML models",
      "Choose appropriate metrics for a given problem and tune models against them",
      "Deploy a trained model behind a simple API",
    ],
    prerequisites: ["Working knowledge of Python", "Basic statistics (mean, variance, probability)"],
    skillsCovered: ["Machine Learning", "Model Evaluation", "Python", "Model Deployment"],
    curriculum: [
      {
        module: "Module 1: ML Foundations",
        lessons: [
          { title: "What is machine learning?", type: LESSON_TYPE.VIDEO },
          { title: "Data preprocessing", type: LESSON_TYPE.VIDEO },
          { title: "Reading: bias-variance tradeoff", type: LESSON_TYPE.READING },
        ],
      },
      {
        module: "Module 2: Supervised Learning",
        lessons: [
          { title: "Linear & logistic regression", type: LESSON_TYPE.VIDEO },
          { title: "Decision trees & random forests", type: LESSON_TYPE.VIDEO },
          { title: "Live session: Q&A on model selection", type: LESSON_TYPE.VIDEO },
          { title: "Module 2 quiz", type: LESSON_TYPE.QUIZ },
          { title: "Assignment: build a classifier", type: LESSON_TYPE.ASSIGNMENT },
        ],
      },
      {
        module: "Module 3: Unsupervised Learning",
        lessons: [
          { title: "Clustering (k-means, hierarchical)", type: LESSON_TYPE.VIDEO },
          { title: "Dimensionality reduction", type: LESSON_TYPE.VIDEO },
          { title: "Module 3 quiz", type: LESSON_TYPE.QUIZ },
        ],
      },
      {
        module: "Module 4: Model Evaluation & Tuning",
        lessons: [
          { title: "Cross-validation & metrics", type: LESSON_TYPE.VIDEO },
          { title: "Hyperparameter tuning", type: LESSON_TYPE.VIDEO },
          { title: "Reading: avoiding overfitting", type: LESSON_TYPE.READING },
        ],
      },
      {
        module: "Module 5: Deployment",
        lessons: [
          { title: "Serving a model behind an API", type: LESSON_TYPE.VIDEO },
          { title: "Live session: deployment walkthrough", type: LESSON_TYPE.VIDEO },
          { title: "Final assessment", type: LESSON_TYPE.ASSESSMENT },
        ],
      },
    ],
    feedback: null,
    previousFeedback: null,
    reviewedDate: null,
    reviewedBy: null,
  },
  {
    id: "crs-104",
    title: "Spoken English for Working Professionals",
    thumbnailInitials: "SE",
    thumbnailAccent: THUMBNAIL_ACCENTS[3],
    category: "Language",
    subCategory: "Business Communication",
    level: "Beginner",
    language: "English",
    courseType: "Recorded",
    educator: "Priya Kapoor",
    educatorId: "EDU-1004",
    educatorEmail: "priya.kapoor@example.com",
    educatorPhone: "+91 98765 43210",
    educatorVerificationStatus: "pending",
    submittedDate: "Sep 8, 2026",
    lastUpdatedDate: "Sep 9, 2026",
    status: COURSE_STATUS.APPROVED,
    price: "₹1,999",
    lessons: 24,
    duration: "9h 20m",
    description:
      "A beginner-to-intermediate spoken English course focused on workplace communication, interviews and presentations.",
    learningOutcomes: [
      "Hold everyday workplace conversations confidently",
      "Deliver a short structured presentation in English",
      "Perform well in an English-language job interview",
    ],
    prerequisites: ["Basic reading and writing in English"],
    skillsCovered: ["Spoken English", "Public Speaking", "Interview Skills"],
    curriculum: [
      {
        module: "Module 1: Everyday Conversation",
        lessons: [
          { title: "Small talk basics", type: LESSON_TYPE.VIDEO },
          { title: "Phone & email etiquette", type: LESSON_TYPE.VIDEO },
          { title: "Practice quiz", type: LESSON_TYPE.QUIZ },
        ],
      },
      {
        module: "Module 2: Workplace Communication",
        lessons: [
          { title: "Meetings & discussions", type: LESSON_TYPE.VIDEO },
          { title: "Giving feedback", type: LESSON_TYPE.VIDEO },
          { title: "Assignment: record a mock meeting", type: LESSON_TYPE.ASSIGNMENT },
        ],
      },
      {
        module: "Module 3: Interviews & Presentations",
        lessons: [
          { title: "Structuring a presentation", type: LESSON_TYPE.VIDEO },
          { title: "Common interview questions", type: LESSON_TYPE.VIDEO },
          { title: "Final assessment", type: LESSON_TYPE.ASSESSMENT },
        ],
      },
    ],
    feedback: null,
    previousFeedback: null,
    reviewedDate: "Sep 9, 2026",
    reviewedBy: "Admin User",
  },
  {
    id: "crs-105",
    title: "Advanced Data Structures",
    thumbnailInitials: "AD",
    thumbnailAccent: THUMBNAIL_ACCENTS[0],
    category: "Computer Science",
    subCategory: "Programming Fundamentals",
    level: "Advanced",
    language: "English",
    courseType: "Recorded",
    educator: "Prof. Alan Turing",
    educatorId: "EDU-1005",
    educatorEmail: "alan.turing@example.com",
    educatorPhone: "+44 20 7946 0958",
    educatorVerificationStatus: "verified",
    submittedDate: "Sep 4, 2026",
    lastUpdatedDate: "Sep 5, 2026",
    status: COURSE_STATUS.APPROVED,
    price: "₹5,499",
    lessons: 30,
    duration: "16h 00m",
    description:
      "A graduate-level continuation covering advanced tree structures, graph algorithms, and amortized analysis.",
    learningOutcomes: [
      "Implement and analyze balanced tree structures",
      "Apply advanced graph algorithms to real-world problems",
      "Reason formally about amortized complexity",
    ],
    prerequisites: ["Completion of a foundational data structures course", "Comfort with proofs and formal notation"],
    skillsCovered: ["Advanced Data Structures", "Graph Algorithms", "Algorithmic Proofs"],
    curriculum: [
      {
        module: "Module 1: Balanced Trees",
        lessons: [
          { title: "AVL trees", type: LESSON_TYPE.VIDEO },
          { title: "Red-black trees", type: LESSON_TYPE.VIDEO },
          { title: "Module 1 quiz", type: LESSON_TYPE.QUIZ },
        ],
      },
      {
        module: "Module 2: Advanced Graph Algorithms",
        lessons: [
          { title: "Shortest paths (Dijkstra, Bellman-Ford)", type: LESSON_TYPE.VIDEO },
          { title: "Minimum spanning trees", type: LESSON_TYPE.VIDEO },
          { title: "Network flow", type: LESSON_TYPE.VIDEO },
          { title: "Problem set", type: LESSON_TYPE.ASSIGNMENT },
        ],
      },
      {
        module: "Module 3: Amortized Analysis",
        lessons: [
          { title: "Aggregate & accounting methods", type: LESSON_TYPE.VIDEO },
          { title: "Reading: potential method", type: LESSON_TYPE.READING },
          { title: "Final assessment", type: LESSON_TYPE.ASSESSMENT },
        ],
      },
    ],
    feedback: null,
    previousFeedback: null,
    reviewedDate: "Sep 5, 2026",
    reviewedBy: "Admin User",
  },
  {
    id: "crs-106",
    title: "Cryptocurrency Trading Masterclass",
    thumbnailInitials: "CT",
    thumbnailAccent: THUMBNAIL_ACCENTS[3],
    category: "Business",
    subCategory: "Trading & Investing",
    level: "Intermediate",
    language: "English",
    courseType: "Recorded",
    educator: "Daniel Osei",
    educatorId: "EDU-1007",
    educatorEmail: "daniel.osei@example.com",
    educatorPhone: "+233 24 555 0117",
    educatorVerificationStatus: "rejected",
    submittedDate: "Aug 19, 2026",
    lastUpdatedDate: "Aug 19, 2026",
    status: COURSE_STATUS.REJECTED,
    price: "₹3,999",
    lessons: 14,
    duration: "6h 40m",
    description:
      "A trading course covering technical analysis and portfolio strategy for cryptocurrency markets.",
    learningOutcomes: ["Read basic technical-analysis charts", "Build a simple diversified crypto portfolio"],
    prerequisites: ["None stated"],
    skillsCovered: ["Technical Analysis", "Portfolio Strategy"],
    curriculum: [
      {
        module: "Module 1: Market Basics",
        lessons: [
          { title: "How crypto markets work", type: LESSON_TYPE.VIDEO },
          { title: "Reading: exchange basics", type: LESSON_TYPE.READING },
        ],
      },
      {
        module: "Module 2: Technical Analysis",
        lessons: [
          { title: "Candlestick patterns", type: LESSON_TYPE.VIDEO },
          { title: "Indicators overview", type: LESSON_TYPE.VIDEO },
        ],
      },
      {
        module: "Module 3: Risk & Portfolio Strategy",
        lessons: [
          { title: "Position sizing", type: LESSON_TYPE.VIDEO },
          { title: "Final assessment", type: LESSON_TYPE.ASSESSMENT },
        ],
      },
    ],
    feedback:
      "Curriculum lacks risk-disclosure content required for financial-trading courses, and several lesson previews are missing. Please add a compliance/risk-disclosure module and complete all lesson uploads before resubmitting.",
    previousFeedback: null,
    reviewedDate: "Aug 20, 2026",
    reviewedBy: "Admin User",
  },
  {
    id: "crs-107",
    title: "Business Analytics with Excel & SQL",
    thumbnailInitials: "BA",
    thumbnailAccent: THUMBNAIL_ACCENTS[1],
    category: "Business",
    subCategory: "Data Analytics",
    level: "Intermediate",
    language: "English",
    courseType: "Recorded",
    educator: "Marcus Thorne",
    educatorId: "EDU-1002",
    educatorEmail: "marcus.thorne@example.com",
    educatorPhone: "+1 (212) 555-0198",
    educatorVerificationStatus: "pending",
    submittedDate: "Sep 15, 2026",
    lastUpdatedDate: "Sep 15, 2026",
    status: COURSE_STATUS.PENDING,
    price: "₹3,499",
    lessons: 20,
    duration: "10h 05m",
    description:
      "Practical business analytics course teaching Excel modeling and SQL querying for decision-making, aimed at early-career analysts. Resubmitted after an earlier round of feedback on missing SQL content.",
    learningOutcomes: [
      "Build analytical models in Excel",
      "Write SQL queries to answer business questions",
      "Present findings through a simple dashboard",
    ],
    prerequisites: ["Basic spreadsheet literacy"],
    skillsCovered: ["Excel Modeling", "SQL", "Dashboards"],
    curriculum: [
      {
        module: "Module 1: Excel for Analysis",
        lessons: [
          { title: "Pivot tables & lookups", type: LESSON_TYPE.VIDEO },
          { title: "Building a simple model", type: LESSON_TYPE.VIDEO },
          { title: "Module 1 quiz", type: LESSON_TYPE.QUIZ },
        ],
      },
      {
        module: "Module 2: SQL Fundamentals",
        lessons: [
          { title: "SELECT, WHERE, JOIN", type: LESSON_TYPE.VIDEO },
          { title: "Aggregations & GROUP BY", type: LESSON_TYPE.VIDEO },
          { title: "Assignment: write 5 business queries", type: LESSON_TYPE.ASSIGNMENT },
        ],
      },
      {
        module: "Module 3: Dashboards & Reporting",
        lessons: [
          { title: "Designing a one-page dashboard", type: LESSON_TYPE.VIDEO },
          { title: "Final assessment", type: LESSON_TYPE.ASSESSMENT },
        ],
      },
    ],
    feedback: null,
    previousFeedback:
      "The original submission didn't include any SQL content despite being listed in the course description. Please add a dedicated SQL module with hands-on queries before resubmitting.",
    reviewedDate: "Sep 10, 2026",
    reviewedBy: "Admin User",
  },
];

// ---------- tiny mock "store" (mirrors ../data/educatorsMock.js) ----------
let _courses = [...SEED_COURSES];
const _listeners = new Set();
function _notify() {
  _listeners.forEach((fn) => fn());
}
function _subscribe(fn) {
  _listeners.add(fn);
  return () => _listeners.delete(fn);
}
function _snapshot() {
  return _courses;
}

export function approveCourse(id, reviewer = "Admin User") {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  _courses = _courses.map((c) =>
    c.id === id
      ? { ...c, status: COURSE_STATUS.APPROVED, feedback: null, reviewedDate: today, reviewedBy: reviewer, lastUpdatedDate: today }
      : c
  );
  _notify();
}

export function rejectCourse(id, feedback, reviewer = "Admin User") {
  const today = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  _courses = _courses.map((c) =>
    c.id === id
      ? { ...c, status: COURSE_STATUS.REJECTED, feedback, reviewedDate: today, reviewedBy: reviewer, lastUpdatedDate: today }
      : c
  );
  _notify();
}

export function useCourses() {
  return useSyncExternalStore(_subscribe, _snapshot);
}

export function useCourse(id) {
  const all = useCourses();
  return all.find((c) => c.id === id) || null;
}
