import { useNavigate } from "react-router-dom";
import Button from "../../../../components/ui/Button";
import { LESSON_TYPE_ICON, LESSON_TYPE_LABEL } from "./lessonContent";

const ROUTE_BY_TYPE = {
  quiz: "/student/quiz",
  assignment: "/student/assignmentsubmit",
  live: "/student/recordings",
};

const CTA_BY_TYPE = {
  quiz: "Start Quiz",
  assignment: "Open Assignment",
  live: "Watch Recording",
};

// Quiz/Assignment/Live-recording lessons already have their own dedicated,
// previously-built flows (Quiz.jsx, AssignmentSubmit.jsx, Recordings.jsx)
// with their own grading/attempt-limit/attendance rules per Sec 8/7 — spec
// Section 1 only asks the Course Player to show these lesson types in the
// nav with the right icon "if already supported," not to rebuild their
// content inline. So selecting one of these in the player hands off to
// that existing screen rather than reimplementing a second quiz/assignment
// UI here.
export default function OtherLessonCard({ lesson, courseId }) {
  const navigate = useNavigate();
  const Icon = LESSON_TYPE_ICON[lesson.type];
  const route = ROUTE_BY_TYPE[lesson.type] ?? "/student/dashboard";

  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl bg-text/5 px-6 py-16 text-center">
      {Icon && <Icon className="h-8 w-8 text-primary" />}
      <p className="font-display text-base font-semibold text-text">{lesson.title}</p>
      <p className="max-w-sm text-sm text-text/55">
        This is a {LESSON_TYPE_LABEL[lesson.type] ?? "lesson"} — it opens in its own flow so your attempts and
        submissions are tracked separately from lesson playback.
      </p>
      <Button fullWidth={false} onClick={() => navigate(`${route}?course=${courseId}&lesson=${lesson.id}`)}>
        {CTA_BY_TYPE[lesson.type] ?? "Open"}
      </Button>
    </div>
  );
}
