import { Link, Navigate, useSearchParams } from "react-router-dom";
import { COURSE_QUIZZES } from "../data/assessmentCatalog";

// Legacy course-player/calendar quiz URLs now hand off to the shared
// assessment runner. Resolve by course so a quiz link never opens unrelated
// questions from another course.
export default function Quiz() {
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("course") || "c1";
  const courseQuizzes = COURSE_QUIZZES.filter((item) => item.courseId === courseId);
  const quiz = courseQuizzes.find((item) => item.id === "python-module-2") || courseQuizzes[0];

  if (quiz) {
    return <Navigate to={`/student/assessments/take/${quiz.id}?source=quiz`} replace />;
  }

  return <div className="mx-auto max-w-xl px-4 py-16 text-center"><h1 className="font-display text-2xl font-bold text-text">No course assignment is available yet</h1><p className="mt-2 text-sm text-text/55">Browse your available course assignments and assessments.</p><Link to="/student/assessments/course-quizzes" className="mt-5 inline-flex rounded-full bg-primary px-4 py-2.5 text-sm font-semibold text-white">View assignments</Link></div>;
}
