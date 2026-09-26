// Test Series marketplace catalog — a TEST SERIES is a purchasable package
// containing multiple TESTS (see project-context.md's information
// architecture: Test Series ≠ Test ≠ Question ≠ Result). This is a
// separate concept from the flat practice-test catalog in
// assessmentCatalog.js (TEST_SERIES there is really a list of individual
// tests, kept as-is so the existing /student/assessments/test-series
// catalog and exam runner keep working unchanged).
//
// Where a package's tests reuse a real assessment id from
// assessmentCatalog.js, "Start Test" links into the existing, fully
// working exam-taking flow (AssessmentRunner). Packages built around
// curricula we don't have real question banks for yet (e.g. CBSE Class 10
// Maths) list their tests for browsing/marketplace purposes only — no
// fabricated live test-taking for content that doesn't exist — flagged
// with `comingSoon: true` per test, matching the "Scheduled / Not Yet
// Available" access state in the spec rather than pretending it's ready.
import { TEST_SERIES as ASSESSMENTS } from "./assessmentCatalog";
import { getSavedAttempts } from "./assessmentCatalog";

export const CLASS_LEVELS = ["Class 6", "Class 7", "Class 8", "Class 9", "Class 10", "Class 11", "Class 12", "College / University", "Competitive Exams", "Other"];
export const SERIES_SUBJECTS = ["Mathematics", "Physics", "Chemistry", "Biology", "English", "Computer Science", "Social Science", "Other"];
export const EXAM_GOALS = ["School Exams", "Board Exams", "Entrance Exams", "Competitive Exams", "University Exams", "Skill Tests"];
export const SERIES_TEST_TYPES = ["Topic Test", "Chapter Test", "Subject Test", "Sectional Test", "Full-Length Test", "Mock Exam"];
export const SERIES_DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];
export const SERIES_LANGUAGES = ["English", "Hindi", "Tamil"];
export const SERIES_PRICE_FILTERS = ["Free", "Paid"];
export const SERIES_SORT_OPTIONS = ["Popular", "Newest", "Most Tests", "Highest Rated", "Price: Low to High"];

function findAssessment(id) {
  return ASSESSMENTS.find((item) => item.id === id);
}

// Builds one package "test" row from a real assessment id, so the row's
// question/duration counts can never drift out of sync with the linked
// assessment.
function linkedTest(assessmentId, testType) {
  const assessment = findAssessment(assessmentId);
  if (!assessment) return null;
  return {
    id: assessment.id,
    title: assessment.title,
    testType,
    questions: assessment.questions.length,
    durationMinutes: assessment.durationMinutes,
    negativeMarking: false,
    comingSoon: false,
    assessmentId: assessment.id, // present => "Start Test" can link to the real runner
  };
}

// A browsing-only test row for curricula without a real question bank yet.
function plannedTest(id, title, testType, questions, durationMinutes) {
  return { id, title, testType, questions, durationMinutes, negativeMarking: true, comingSoon: true, assessmentId: null };
}

function sumQuestions(tests) {
  return tests.reduce((sum, test) => sum + test.questions, 0);
}

function durationRange(tests) {
  const values = tests.map((test) => test.durationMinutes);
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min === max ? `${min} min` : `${min}–${max} min`;
}

const programmingSections = [
  { id: "skill-tests", title: "Skill Tests", tests: ["ml-skill", "cyber-skill", "communication-check"].map((id) => linkedTest(id, "Sectional Test")).filter(Boolean) },
  { id: "practice-tests", title: "Practice Tests", tests: ["sql-practice", "cloud-practice"].map((id) => linkedTest(id, "Topic Test")).filter(Boolean) },
  { id: "course-tests", title: "Course Tests", tests: ["python-final", "java-oop", "web-final"].map((id) => linkedTest(id, "Chapter Test")).filter(Boolean) },
  { id: "mock-exams", title: "Mock Exams", tests: ["dsa-mock", "aptitude-series"].map((id) => linkedTest(id, "Mock Exam")).filter(Boolean) },
];

const mathsSections = [
  { id: "chapter-tests", title: "Chapter Tests", tests: [
    plannedTest("maths-real-numbers", "Real Numbers", "Chapter Test", 20, 30),
    plannedTest("maths-polynomials", "Polynomials", "Chapter Test", 20, 30),
    plannedTest("maths-linear-equations", "Pair of Linear Equations", "Chapter Test", 25, 35),
    plannedTest("maths-quadratic-equations", "Quadratic Equations", "Chapter Test", 20, 30),
    plannedTest("maths-arithmetic-progressions", "Arithmetic Progressions", "Chapter Test", 20, 30),
    plannedTest("maths-triangles", "Triangles", "Chapter Test", 20, 30),
    plannedTest("maths-coordinate-geometry", "Coordinate Geometry", "Chapter Test", 20, 30),
  ] },
  { id: "subject-tests", title: "Subject Tests", tests: [
    plannedTest("maths-algebra", "Algebra", "Subject Test", 50, 60),
    plannedTest("maths-geometry", "Geometry", "Subject Test", 50, 60),
  ] },
  { id: "full-length", title: "Full-Length Tests", tests: [
    plannedTest("maths-mock-1", "Mock Test 01", "Full-Length Test", 100, 180),
    plannedTest("maths-mock-2", "Mock Test 02", "Full-Length Test", 100, 180),
  ] },
];

const scienceSections = [
  { id: "subject-tests", title: "Subject Tests", tests: [
    plannedTest("science-physics", "Physics — Full Syllabus", "Subject Test", 45, 90),
    plannedTest("science-chemistry", "Chemistry — Full Syllabus", "Subject Test", 45, 90),
    plannedTest("science-biology", "Biology — Full Syllabus", "Subject Test", 45, 90),
  ] },
  { id: "full-length", title: "Full-Length Tests", tests: [
    plannedTest("science-mock-1", "Full-Length Mock 01", "Full-Length Test", 90, 150),
    plannedTest("science-mock-2", "Full-Length Mock 02", "Full-Length Test", 90, 150),
  ] },
];

function topicsFromAssessments(ids) {
  const counts = new Map();
  ids.forEach((id) => {
    const assessment = findAssessment(id);
    if (!assessment) return;
    (assessment.topics || []).forEach((topic) => {
      const entry = counts.get(topic) || { topic, tests: 0, questions: 0 };
      entry.tests += 1;
      entry.questions += assessment.questions.filter((question) => question.topic === topic).length || Math.ceil(assessment.questions.length / (assessment.topics.length || 1));
      counts.set(topic, entry);
    });
  });
  return Array.from(counts.values());
}

export const TEST_SERIES_PACKAGES = [
  {
    id: "programming-cs-series",
    title: "Programming & Computer Science Test Series",
    classGrade: "College / University",
    subject: "Computer Science",
    examGoal: "Skill Tests",
    difficulty: "Intermediate",
    language: "English",
    price: 0,
    rating: 4.7,
    studentsEnrolled: 6420,
    badges: ["FREE", "POPULAR"],
    sections: programmingSections,
    description: "Nine practice tests and mock exams spanning programming fundamentals, databases, cloud, machine learning, security and workplace communication — a broad skills check for anyone building a software career.",
    audience: "Students and self-learners who want an honest read on where their programming and CS fundamentals stand before applying for internships, certifications or courses.",
    negativeMarking: { enabled: false, correct: null, incorrect: null, unanswered: 0 },
    passingScoreLabel: "60–75% (varies by test)",
    attemptsLabel: "Varies by test (2–3, some unlimited)",
    accessLabel: "On demand",
    certificateLabel: "On eligible tests",
    questionTypes: ["MCQ", "Multiple Select"],
    access: "on-demand",
  },
  {
    id: "class10-maths-board",
    title: "Class 10 Mathematics — Board Exam Test Series",
    classGrade: "Class 10",
    subject: "Mathematics",
    examGoal: "Board Exams",
    difficulty: "Intermediate",
    language: "English",
    price: 499,
    rating: 4.8,
    studentsEnrolled: 3180,
    badges: ["POPULAR", "FULL SYLLABUS"],
    sections: mathsSections,
    description: "A complete board-exam-style test series covering every Class 10 Maths chapter, built up from chapter tests to subject tests to two full-length mock exams under real exam timing.",
    audience: "Class 10 students preparing for board exams who want structured, chapter-by-chapter practice before attempting full-length mocks.",
    negativeMarking: { enabled: true, correct: 4, incorrect: 1, unanswered: 0 },
    passingScoreLabel: "33%",
    attemptsLabel: "3 per test",
    accessLabel: "On demand",
    certificateLabel: "Yes, on full-length tests",
    questionTypes: ["MCQ", "Numerical Answer"],
    access: "on-demand",
    comingSoonNotice: "This series's question bank is being finalized — tests are listed for preview and will open for attempts soon.",
  },
  {
    id: "science-competitive-series",
    title: "Class 11–12 Science — Competitive Exam Test Series",
    classGrade: "Class 11",
    subject: "Physics",
    examGoal: "Competitive Exams",
    difficulty: "Advanced",
    language: "English",
    price: 0,
    rating: 4.6,
    studentsEnrolled: 2050,
    badges: ["FREE", "NEW"],
    sections: scienceSections,
    description: "Full-syllabus subject tests and full-length mocks across Physics, Chemistry and Biology, paced for entrance-exam-style practice.",
    audience: "Class 11–12 students preparing for competitive entrance exams who want subject-wise depth plus full-length timed practice.",
    negativeMarking: { enabled: true, correct: 4, incorrect: 1, unanswered: 0 },
    passingScoreLabel: "50%",
    attemptsLabel: "Unlimited",
    accessLabel: "On demand",
    certificateLabel: "No",
    questionTypes: ["MCQ"],
    access: "on-demand",
    comingSoonNotice: "This series's question bank is being finalized — tests are listed for preview and will open for attempts soon.",
  },
];

// Derived, read-only fields every package needs on cards/detail pages —
// computed here (once) so numbers can never drift from the section/test
// data above.
TEST_SERIES_PACKAGES.forEach((pkg) => {
  const allTests = pkg.sections.flatMap((section) => section.tests);
  pkg.numberOfTests = allTests.length;
  pkg.totalQuestions = sumQuestions(allTests);
  pkg.durationRangeLabel = durationRange(allTests);
  pkg.testTypeSummary = Object.entries(
    allTests.reduce((acc, test) => { acc[test.testType] = (acc[test.testType] || 0) + 1; return acc; }, {})
  ).map(([type, count]) => ({ type, count }));
  pkg.topics = topicsFromAssessments(allTests.filter((test) => test.assessmentId).map((test) => test.assessmentId));
  if (!pkg.topics.length) {
    // Curriculum-preview packages (no linked assessments) — list the
    // chapter/subject test titles themselves as the syllabus topics.
    pkg.topics = pkg.sections[0].tests.map((test) => ({ topic: test.title, tests: 1, questions: test.questions }));
  }
});

export function getSeriesById(seriesId) {
  return TEST_SERIES_PACKAGES.find((pkg) => pkg.id === seriesId);
}

function learnerScope(userOrId) {
  const raw = typeof userOrId === "string" ? userOrId : userOrId?.identifier || userOrId?.id || userOrId?.name || "guest";
  return encodeURIComponent(String(raw).trim().toLowerCase() || "guest");
}

const PURCHASES_KEY = "ul_test_series_purchases_v1";

export function getPurchasedSeriesIds(userOrId) {
  try {
    const saved = JSON.parse(localStorage.getItem(`${PURCHASES_KEY}:${learnerScope(userOrId)}`) || "[]");
    return Array.isArray(saved) ? saved : [];
  } catch {
    return [];
  }
}

export function isSeriesPurchased(seriesId, userOrId) {
  return getPurchasedSeriesIds(userOrId).includes(seriesId);
}

// Mock purchase — this is the discovery/detail phase only. There is no
// real payment gateway wired up yet (see Checkout.jsx's course-only
// checkoutApi); a free series enrolls instantly, a paid one still records
// the purchase locally so "My Test Series"/dashboard states can be built
// against real data in the next phase, rather than faking a payment result.
export function purchaseSeries(seriesId, userOrId) {
  const key = `${PURCHASES_KEY}:${learnerScope(userOrId)}`;
  const ids = getPurchasedSeriesIds(userOrId);
  if (ids.includes(seriesId)) return;
  try {
    localStorage.setItem(key, JSON.stringify([...ids, seriesId]));
    window.dispatchEvent(new Event("ul-test-series-purchases-changed"));
  } catch {
    // Best-effort mock persistence; page still renders without it.
  }
}


// Aggregates a purchased package's progress from real saved attempts
// (assessmentCatalog's getSavedAttempts), cross-referenced against the
// package's own linked (non comingSoon) tests by assessmentId — never a
// separate, parallel progress store, so this can never drift from what
// AssessmentRunner/AssessmentResultDetail already recorded.
export function getSeriesProgress(pkg, userOrId) {
  const gradableTests = pkg.sections.flatMap((section) => section.tests).filter((test) => !test.comingSoon && test.assessmentId);
  const attempts = getSavedAttempts();
  const perTest = gradableTests.map((test) => {
    const testAttempts = attempts
      .filter((attempt) => attempt.assessmentId === test.assessmentId)
      .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt));
    const latest = testAttempts[0] || null;
    const best = testAttempts.reduce((max, attempt) => Math.max(max, attempt.percentage), 0);
    return { test, attempted: testAttempts.length > 0, attemptsCount: testAttempts.length, latest, bestPercentage: testAttempts.length ? best : null };
  });
  const completed = perTest.filter((row) => row.attempted);
  const testsCompleted = completed.length;
  const totalTests = gradableTests.length;
  const averageScore = completed.length ? Math.round(completed.reduce((sum, row) => sum + row.latest.percentage, 0) / completed.length) : null;
  const bestScore = completed.length ? Math.max(...completed.map((row) => row.bestPercentage)) : null;
  const lastAttempt = completed
    .map((row) => row.latest)
    .sort((a, b) => new Date(b.submittedAt) - new Date(a.submittedAt))[0] || null;
  const status = testsCompleted === 0 ? "Not Started" : testsCompleted >= totalTests && totalTests > 0 ? "Completed" : "In Progress";
  // The next test to actually take — first not-yet-attempted gradable
  // test, in package order, so "Continue Series" / "Start Series" can
  // jump straight into a real test instead of just re-opening the
  // package detail page (which was the bug: it looked like Continue
  // Series did nothing because it always landed back on the same page).
  const nextTest = (perTest.find((row) => !row.attempted) || perTest[0])?.test || null;
  return { perTest, testsCompleted, totalTests, averageScore, bestScore, lastAttempt, status, nextTest, purchased: isSeriesPurchased(pkg.id, userOrId) };
}
