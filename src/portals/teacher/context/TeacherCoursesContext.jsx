import { createContext, useContext, useMemo, useState } from "react";
import { Outlet } from "react-router-dom";
import { COURSE, INITIAL_MODULES } from "../components/contentData";
import { BUNDLE_SEEDS } from "../data/bundleData";
import { EXTRA_COURSES, C1_STUDENTS, C1_SUBMISSIONS, C1_REVIEWS, C1_HOMEWORK, C1_RESULTS } from "../data/teacherCourses";

// TeacherCoursesContext — the single source of truth for every course this
// educator has built: My Courses (the portfolio grid/list), the Course
// Management Overview (one course's workspace) and — via
// CourseBuilderContext, which now reads/writes through here instead of
// carrying its own local draft — the Course Builder screens themselves.
// A status change, an edit, a review reply or a graded submission made
// anywhere in the app updates this one array, so every screen that reads
// a course (badge, tab counts, revenue figures, admin feedback) reflects
// it immediately, no page refresh needed.
//
// c1 — the flagship sample course used throughout Course Builder,
// Content Upload, Pricing and Publish Flow — is assembled from
// contentData.js's existing COURSE/INITIAL_MODULES rather than redefined
// here, so /teacher/coursebuilder with no :courseId keeps behaving exactly
// as it did before My Courses existed.
// Exported so the header notification feed can read the same seed courses.
export const INITIAL_COURSES = [
  {
    ...COURSE,
    id: "c1",
    modules: INITIAL_MODULES,
    students: C1_STUDENTS,
    submissions: C1_SUBMISSIONS,
    reviews: C1_REVIEWS,
    homeworkItems: C1_HOMEWORK,
    results: C1_RESULTS,
    // contentData.js's original COURSE mock predates real reviews existing
    // (rating: 4.8, ratingCount: 0 was a pre-launch placeholder) — overridden
    // here so the header stat matches the actual C1_REVIEWS array instead of
    // contradicting the reviews visibly listed under it.
    rating: Math.round((C1_REVIEWS.reduce((s, r) => s + r.rating, 0) / C1_REVIEWS.length) * 10) / 10,
    ratingCount: C1_REVIEWS.length,
    createdAt: "2026-03-04",
    updatedAt: "2026-09-18",
    salesThisMonth: 34,
    totalSales: 1240,
  },
  ...EXTRA_COURSES,
];

const TeacherCoursesContext = createContext(null);

export function TeacherCoursesProvider() {
  const [courses, setCourses] = useState(INITIAL_COURSES);
  // Course bundles — owned by their first course (courseIds[0]); kept here
  // beside the courses so the builder, My Courses > Bundles, the course
  // details page and Publish Review all read/write the same list.
  const [bundles, setBundles] = useState(BUNDLE_SEEDS);

  function saveBundle(bundle) {
    setBundles((prev) =>
      prev.some((b) => b.id === bundle.id) ? prev.map((b) => (b.id === bundle.id ? bundle : b)) : [...prev, bundle]
    );
  }
  function deleteBundle(id) {
    setBundles((prev) => prev.filter((b) => b.id !== id));
  }

  function updateCourse(id, patch) {
    setCourses((prev) =>
      prev.map((c) => (c.id === id ? { ...c, ...(typeof patch === "function" ? patch(c) : patch) } : c))
    );
  }

  function setCourseStatus(id, status, extra = {}) {
    updateCourse(id, { status, ...extra, updatedAt: new Date().toISOString().slice(0, 10) });
  }

  function setCourseModules(id, updater) {
    updateCourse(id, (prev) => ({
      ...prev,
      modules: typeof updater === "function" ? updater(prev.modules) : updater,
      updatedAt: new Date().toISOString().slice(0, 10),
    }));
  }

  function replyToReview(courseId, reviewId, reply) {
    updateCourse(courseId, (c) => ({
      ...c,
      reviews: c.reviews.map((r) => (r.id === reviewId ? { ...r, reply } : r)),
    }));
  }

  // Grading actions — three distinct outcomes for one submission, matching
  // the Grading panel's three primary actions: a finalized score ("Submit
  // Grade"/"Save & Next"), an in-progress save that doesn't finalize yet
  // ("Save Draft"), or sending it back to the student instead of scoring
  // it at all ("Request Resubmission").
  function gradeSubmission(courseId, submissionId, { score, feedback }) {
    updateCourse(courseId, (c) => ({
      ...c,
      submissions: c.submissions.map((s) =>
        s.id === submissionId
          ? { ...s, score, feedback, status: "graded", gradedAt: new Date().toISOString().slice(0, 10), gradedBy: "Ansh Mehra" }
          : s
      ),
    }));
  }

  function saveDraftGrade(courseId, submissionId, { score, feedback }) {
    updateCourse(courseId, (c) => ({
      ...c,
      submissions: c.submissions.map((s) => (s.id === submissionId ? { ...s, score, feedback, status: "draft" } : s)),
    }));
  }

  function requestResubmission(courseId, submissionId, { feedback }) {
    updateCourse(courseId, (c) => ({
      ...c,
      submissions: c.submissions.map((s) =>
        s.id === submissionId ? { ...s, feedback, status: "resubmission_requested", score: undefined } : s
      ),
    }));
  }

  // Homework/Notes — supplementary material, kept on the course record
  // separately from `modules` (core curriculum) so sharing one never
  // touches the actual lesson content Content Upload owns.
  function shareHomework(courseId, item) {
    updateCourse(courseId, (c) => ({ ...c, homeworkItems: [item, ...(c.homeworkItems || [])] }));
  }
  function updateHomework(courseId, itemId, patch) {
    updateCourse(courseId, (c) => ({
      ...c,
      homeworkItems: (c.homeworkItems || []).map((h) => (h.id === itemId ? { ...h, ...patch } : h)),
    }));
  }
  function removeHomework(courseId, itemId) {
    updateCourse(courseId, (c) => ({ ...c, homeworkItems: (c.homeworkItems || []).filter((h) => h.id !== itemId) }));
  }

  // Marksheet/Results — a distinct, more formal publishing flow from
  // per-assignment grading, so it gets its own history list on the course
  // record rather than living inside `submissions`.
  function publishResults(courseId, item) {
    updateCourse(courseId, (c) => ({ ...c, results: [item, ...(c.results || [])] }));
  }
  function removeResults(courseId, itemId) {
    updateCourse(courseId, (c) => ({ ...c, results: (c.results || []).filter((r) => r.id !== itemId) }));
  }

  function duplicateCourse(id) {
    setCourses((prev) => {
      const source = prev.find((c) => c.id === id);
      if (!source) return prev;
      const copy = {
        ...source,
        id: `c${Date.now()}`,
        title: `${source.title} (copy)`,
        status: "draft",
        adminFeedback: "",
        submittedAt: null,
        students: [],
        submissions: [],
        reviews: [],
        ratingCount: 0,
        rating: 0,
        salesThisMonth: 0,
        totalSales: 0,
        createdAt: new Date().toISOString().slice(0, 10),
        updatedAt: new Date().toISOString().slice(0, 10),
      };
      const idx = prev.findIndex((c) => c.id === id);
      const next = [...prev];
      next.splice(idx + 1, 0, copy);
      return next;
    });
  }

  const value = useMemo(
    () => ({
      courses,
      updateCourse,
      setCourseStatus,
      setCourseModules,
      replyToReview,
      gradeSubmission,
      saveDraftGrade,
      requestResubmission,
      shareHomework,
      updateHomework,
      removeHomework,
      publishResults,
      removeResults,
      duplicateCourse,
      bundles,
      saveBundle,
      deleteBundle,
    }),
    [courses, bundles]
  );

  return (
    <TeacherCoursesContext.Provider value={value}>
      <Outlet />
    </TeacherCoursesContext.Provider>
  );
}

export function useTeacherCourses() {
  const ctx = useContext(TeacherCoursesContext);
  if (!ctx) throw new Error("useTeacherCourses must be used within TeacherCoursesProvider");
  return ctx;
}
