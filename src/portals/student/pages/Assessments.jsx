import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import { SearchIcon } from "../../../components/ui/icons";
import { imageForCategory } from "../../../utils/stockImages";
import { getCourseById } from "../../../data/catalogMock";
import { ASSIGNMENT, getAssignmentState, QUIZ, getQuizState } from "../data/assessmentMock";

const ENROLLED_COURSE_IDS = ["c1", "c2"];

function assessmentItems(courseId, quizState, assignmentState) {
  if (courseId !== "c1") return [];

  const latestAttempt = quizState.attempts[quizState.attempts.length - 1];
  const latestSubmission = assignmentState.submissions[assignmentState.submissions.length - 1];

  return [
    {
      id: QUIZ.id,
      type: "Quiz",
      title: QUIZ.title,
      module: "Module 2 · Core Concepts",
      lesson: "Loops & Functions",
      due: "Due today",
      status: latestAttempt ? "Submitted" : "Upcoming",
      score: latestAttempt ? `${latestAttempt.percentage}%` : null,
      action: `/student/quiz?course=${QUIZ.courseId}`,
      actionLabel: latestAttempt ? "View result" : "Start quiz",
    },
    {
      id: ASSIGNMENT.id,
      type: "Assignment",
      title: ASSIGNMENT.title,
      module: "Module 3 · Applying What You’ve Learned",
      lesson: "Guided project walkthrough",
      due: `Due ${ASSIGNMENT.dueDate}`,
      status: latestSubmission?.status || "Upcoming",
      score: latestSubmission?.score != null ? `${latestSubmission.score}/100` : null,
      action: `/student/assignmentsubmit?item=${ASSIGNMENT.id}`,
      actionLabel: latestSubmission?.status === "Graded" ? "View feedback" : "Open assignment",
    },
  ];
}

export default function Assessments() {
  const navigate = useNavigate();
  const quizState = getQuizState();
  const assignmentState = getAssignmentState();
  const courses = ENROLLED_COURSE_IDS.map(getCourseById).filter(Boolean);
  const [selectedId, setSelectedId] = useState(courses[0]?.id || "");
  const [query, setQuery] = useState("");
  const filteredCourses = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return courses;
    return courses.filter((course) =>
      `${course.title} ${course.subtitle} ${course.category}`.toLowerCase().includes(normalizedQuery)
    );
  }, [courses, query]);
  const selectedCourse = courses.find((course) => course.id === selectedId) || courses[0];
  const selectedItems = useMemo(
    () => assessmentItems(selectedCourse?.id, quizState, assignmentState),
    [assignmentState, quizState, selectedCourse?.id]
  );

  return (
    <div className="px-4 py-7 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Practice</p>
      <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text">Assessments</h1>
      <p className="mt-2 max-w-2xl text-sm text-text/60">
        Select an enrolled course to see the quizzes, assignments, and tasks remaining on your learning path.
      </p>

      <section className="mt-7">
        <div className="mb-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-bold text-[#17324d]">Your enrolled courses</h2>
            <p className="mt-1 text-sm text-text/55">Assessment progress is grouped by course.</p>
          </div>
          <label className="relative block w-full sm:w-72">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search enrolled courses"
              aria-label="Search enrolled courses"
              className="w-full rounded-full border border-text/10 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
            />
          </label>
        </div>
        {filteredCourses.length ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {filteredCourses.map((course, index) => {
            const items = assessmentItems(course.id, quizState, assignmentState);
            const remaining = items.filter((item) => item.status === "Upcoming" || item.status === "Pending").length;
            return (
              <div
                role="button"
                tabIndex={0}
                key={course.id}
                onClick={() => setSelectedId(course.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") setSelectedId(course.id);
                }}
                className={`w-full max-w-[280px] rounded-2xl text-left transition ${selectedCourse?.id === course.id ? "rounded-2xl ring-2 ring-primary ring-offset-2" : ""}`}
              >
                <ColorBlockCard
                  rotationIndex={index}
                  fullWidth
                  compact
                  image={course.image || imageForCategory(course.category)}
                  title={course.title}
                  subtitle={course.subtitle}
                  meta={`${course.category} · ${course.courseType === "Live" ? "Live" : "Recorded"}`}
                  description={course.description}
                  onClick={() => setSelectedId(course.id)}
                />
                <div className="-mt-1 rounded-b-2xl border border-t-0 border-text/10 bg-white px-4 py-3 shadow-sm">
                  <p className="text-xs font-semibold text-text/55">
                    {items.length ? `${items.length} assessment${items.length === 1 ? "" : "s"} total` : "No assessments assigned yet"}
                  </p>
                  <p className={`mt-1 text-sm font-bold ${remaining ? "text-primary" : "text-success"}`}>
                    {remaining ? `${remaining} task${remaining === 1 ? "" : "s"} left` : "All caught up"}
                  </p>
                </div>
              </div>
            );
          })}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-text/15 bg-white px-6 py-12 text-center">
            <h3 className="font-display text-lg font-semibold text-text">No enrolled course found</h3>
            <p className="mt-2 text-sm text-text/55">Try a different course title, subject, or educator name.</p>
          </div>
        )}
      </section>

      {selectedCourse && (
        <section className="mt-8 rounded-2xl border border-text/10 bg-white p-5 shadow-[0_8px_24px_rgba(23,50,77,0.05)] sm:p-6">
          <div className="flex flex-col gap-4 border-b border-text/10 pb-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">Course assessments</p>
              <h2 className="mt-1 font-display text-2xl font-bold text-[#17324d]">{selectedCourse.title}</h2>
              <p className="mt-1 text-sm text-text/55">Tasks, quizzes, and submission status for {selectedCourse.subtitle}’s course.</p>
            </div>
            <Button fullWidth={false} variant="secondary" onClick={() => navigate(`/student/course/${selectedCourse.id}`)}>
              View course
            </Button>
          </div>

          {selectedItems.length ? (
            <div className="mt-5 space-y-3">
              {selectedItems.map((item) => (
                <article key={item.id} className="flex flex-col gap-4 rounded-2xl border border-text/10 bg-[#fcfbfa] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-[0.14em] text-text/45">{item.type}</span>
                      <StatusBadge status={item.status === "Graded" || item.status === "Submitted" ? "success" : "warning"}>{item.status}</StatusBadge>
                    </div>
                    <h3 className="mt-2 font-display text-base font-semibold text-text">{item.title}</h3>
                    <p className="mt-1 text-sm text-text/55">{item.module} · {item.lesson}</p>
                    <p className="mt-1 text-xs text-text/45">{item.due}{item.score ? ` · Latest score: ${item.score}` : ""}</p>
                  </div>
                  <Button fullWidth={false} onClick={() => navigate(item.action)}>{item.actionLabel}</Button>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-2xl border border-dashed border-text/15 bg-bg px-6 py-12 text-center">
              <h3 className="font-display text-lg font-semibold text-text">No assessments left</h3>
              <p className="mt-2 text-sm text-text/55">New quizzes and assignments will appear here when your educator adds them.</p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
