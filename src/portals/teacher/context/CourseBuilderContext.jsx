import { createContext, useContext, useMemo } from "react";
import { Outlet, useParams } from "react-router-dom";
import { editableSections } from "../components/contentData";
import { useTeacherCourses } from "./TeacherCoursesContext";

// CourseBuilderContext — the single shared draft (course + modules +
// lifecycle status) for every screen in the builder: Details, Curriculum,
// Content Upload, Pricing and Review. Now a thin adapter over
// TeacherCoursesContext keyed by the route's :courseId (falling back to
// "c1", the original flagship sample course, when no id is in the URL) —
// there is no separate local draft anymore, so an edit made here is the
// same edit My Courses / Course Management Overview see, and vice versa,
// satisfying the spec's "no page refresh needed" requirement instead of
// each screen carrying its own copy that could drift.
//
// Mounted once, above all four builder routes (see routes.jsx), as a
// pathless layout route nested inside TeacherCoursesProvider — React
// Router keeps this element mounted while only the nested <Outlet/>
// content swaps, so navigating between Details/Curriculum/Content/
// Pricing/Review for the same course preserves exactly what was there,
// same as before this refactor.
const CourseBuilderContext = createContext(null);

export function CourseBuilderProvider() {
  const { courseId: paramId } = useParams();
  const courseId = paramId || "c1";
  const { courses, updateCourse, setCourseStatus, setCourseModules } = useTeacherCourses();
  const course = courses.find((c) => c.id === courseId) || courses[0];

  function setCourse(patch) {
    updateCourse(course.id, (prev) => (typeof patch === "function" ? patch(prev) : { ...prev, ...patch }));
  }

  function setModules(updater) {
    setCourseModules(course.id, updater);
  }

  // Lifecycle transitions all funnel through here so every screen reading
  // `course.status` (and the `sections` lock map derived from it) updates
  // consistently — Publish Flow's submit/approve/request-changes actions
  // are the only callers, but any screen could call it.
  function setStatus(status, extra = {}) {
    setCourseStatus(course.id, status, extra);
  }

  const sections = useMemo(() => editableSections(course.status), [course.status]);

  const value = useMemo(
    () => ({ course, setCourse, modules: course.modules, setModules, sections, setStatus, courseId: course.id }),
    [course, sections]
  );

  return (
    <CourseBuilderContext.Provider value={value}>
      <Outlet />
    </CourseBuilderContext.Provider>
  );
}

export function useCourseBuilder() {
  const ctx = useContext(CourseBuilderContext);
  if (!ctx) throw new Error("useCourseBuilder must be used within CourseBuilderProvider");
  return ctx;
}
