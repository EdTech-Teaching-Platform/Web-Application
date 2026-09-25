import { Link, useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { BookOpenIcon, CheckCircleIcon, ClockIcon, FileTextIcon } from "../../../components/ui/icons";
import { COURSES, getCourseById } from "../../../data/catalogMock";
import { imageForCategory } from "../../../utils/stockImages";
import { COURSE_QUIZZES, getSavedAttempts } from "../data/assessmentCatalog";
import { useAuth } from "../../../hooks/useAuth";
import { getStudentEnrolledCourseIds } from "../data/studentLocalState";

export default function CourseQuizzes() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const enrolled = getStudentEnrolledCourseIds(user).map((id) => COURSES.find((course) => course.id === id) || getCourseById(id)).filter(Boolean);
  const attempts = getSavedAttempts();

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
    <Link to="/student/assessments/course-quizzes" className="text-xs font-semibold text-primary">← Assignments</Link>
    <header className="mt-4 flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#28756f]">Learning checks inside your courses</p><h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Assignments</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text/55">Short, focused checks tied to your enrolled course modules. Your results help you decide when you’re ready to move on.</p></div><div className="rounded-2xl bg-[#e7f1ef] px-4 py-3 text-xs font-semibold text-[#28756f]">{enrolled.length} enrolled courses · {COURSE_QUIZZES.length} assignments</div></header>
    {enrolled.map((course) => {
      const quizzes = COURSE_QUIZZES.filter((quiz) => quiz.courseId === course.id);
      const completedCount = quizzes.filter((quiz) => attempts.some((attempt) => attempt.assessmentId === quiz.id) || quiz.status === "Completed").length;
      return <section key={course.id} className="mt-7 overflow-hidden rounded-2xl border border-text/10 bg-white shadow-[0_4px_18px_rgba(23,50,77,0.04)]">
        <div className="flex flex-col gap-4 bg-[#fffaf7] p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div className="flex min-w-0 items-center gap-4"><img src={imageForCategory(course.category, { w: 96, h: 72 })} alt="" className="h-16 w-24 shrink-0 rounded-xl object-cover" /><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-[0.14em] text-primary/65">Enrolled course</p><h2 className="mt-1 truncate font-display text-xl font-bold text-text">{course.title}</h2><p className="mt-1 text-xs text-text/50">{course.subtitle} · {completedCount} of {quizzes.length} checks completed</p></div></div><Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/courseplayer?course=" + course.id)}>Continue Learning</Button></div>
        {quizzes.length ? <div className="divide-y divide-text/10 px-5 sm:px-6">{quizzes.map((quiz) => {
          const attemptsForQuiz = attempts.filter((attempt) => attempt.assessmentId === quiz.id);
          const latest = attemptsForQuiz[0];
          const done = Boolean(latest) || quiz.status === "Completed";
          const status = latest ? (latest.passed ? "Passed" : "Completed") : quiz.status;
          return <article key={quiz.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className="text-[10px] font-bold uppercase tracking-wider text-text/40">{quiz.module}</span><StatusBadge status={done ? "success" : status === "In Progress" ? "warning" : "neutral"}>{status}</StatusBadge></div><h3 className="mt-1 font-display text-base font-semibold text-text">{quiz.title}</h3><div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-text/50"><span className="inline-flex items-center gap-1.5"><FileTextIcon className="h-3.5 w-3.5" />{quiz.items.length} questions</span><span className="inline-flex items-center gap-1.5"><ClockIcon className="h-3.5 w-3.5" />About {quiz.durationMinutes} min</span>{latest ? <span>Latest score: <strong className="text-text">{latest.percentage}%</strong></span> : done && <span>Score: <strong className="text-text">{quiz.score}%</strong></span>}</div></div>
            <Button fullWidth={false} variant={done ? "secondary" : "primary"} onClick={() => navigate("/student/assessments/take/" + quiz.id + "?source=quiz")}>{done ? "Review / Retake" : quiz.status === "In Progress" ? "Resume Assignment" : "Start Assignment"}</Button>
          </article>;
        })}</div> : <div className="p-6 text-sm text-text/50">No assignments are available for this course yet.</div>}
      </section>;
    })}
    {enrolled.length === 0 && <div className="mt-7 rounded-2xl border border-dashed border-text/15 bg-white px-6 py-14 text-center"><BookOpenIcon className="mx-auto h-8 w-8 text-text/30" /><h2 className="mt-3 font-display text-lg font-bold text-text">No enrolled courses yet</h2><p className="mt-2 text-sm text-text/50">Assignments will appear here after you enroll.</p></div>}
    <div className="mt-7 flex items-center gap-3 rounded-2xl border border-[#d9e9e5] bg-[#eef7f4] p-4 text-sm leading-5 text-[#28756f]"><CheckCircleIcon className="h-5 w-5 shrink-0" /><p>Course assignments are short learning checks. Longer timed tests and mock exams are in <Link className="font-bold underline" to="/student/assessments/test-series">Test Series</Link>.</p></div>
  </div>;
}
