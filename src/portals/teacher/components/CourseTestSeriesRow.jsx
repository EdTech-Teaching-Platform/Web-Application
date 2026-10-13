// "Test series" row attached to a course: the course-wise series linked to it
// (own or admin-assigned), with status + deadline, and a way to add another.
// Shown on the Course Management overview and in the Course Builder.
import { NavLink } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import IconBadge from "../../../components/ui/IconBadge";
import { QuizIcon, PlusIcon, ArrowRightIcon } from "../../../components/ui/icons";
import { DeadlineChip, OriginTags, SeriesStatusBadge } from "./TestSeriesStatus";
import { seriesQuestionCount } from "../data/testSeriesData";

export default function CourseTestSeriesRow({ courseId, className = "" }) {
  const { courseSeries, hasAccess } = useTestSeries();
  if (!hasAccess || !courseId) return null;
  const list = courseSeries(courseId);
  return (
    <section className={`rounded-3xl bg-surface p-5 shadow-soft sm:p-6 ${className}`} aria-labelledby={`course-ts-${courseId}`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <IconBadge icon={QuizIcon} tone="lavender" size="sm" />
          <div>
            <h2 id={`course-ts-${courseId}`} className="text-base font-bold text-text">Test series</h2>
            <p className="text-xs text-muted">{list.length === 0 ? "No test series attached to this course yet." : `${list.length} attached. Enrolled students get access by default.`}</p>
          </div>
        </div>
        <NavLink to="/teacher/testseries/new" className="inline-flex items-center gap-1.5 rounded-full border border-primary/25 px-4 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.05]">
          <PlusIcon className="h-3.5 w-3.5" />
          Add test series
        </NavLink>
      </div>
      {list.length > 0 && (
        <ul className="mt-4 divide-y divide-text/[0.06]">
          {list.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 py-3">
              <div className="min-w-0 flex-1">
                <NavLink to={`/teacher/testseries/${s.id}/detail`} className="block truncate text-sm font-semibold text-text hover:text-primary">{s.title}</NavLink>
                <p className="mt-0.5 text-xs text-muted">{seriesQuestionCount(s)} questions · {s.enrollments.toLocaleString()} enrolled</p>
                <OriginTags series={s} className="mt-1" />
              </div>
              <DeadlineChip series={s} />
              <SeriesStatusBadge series={s} size="sm" />
              <NavLink to={`/teacher/testseries/${s.id}`} aria-label={`Open ${s.title}`} className="rounded-full p-2 text-muted hover:bg-bg hover:text-primary"><ArrowRightIcon className="h-4 w-4" /></NavLink>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
