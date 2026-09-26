import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import BackButton from "../../../components/common/BackButton";
import Button from "../../../components/ui/Button";
import ConfirmationCard from "../../../components/ui/ConfirmationCard";
import { getCourseById } from "../../../data/catalogMock";
import { useAuth } from "../../../hooks/useAuth";
import { getLiveCourseSchedule } from "../data/liveCourseSchedule";
import { isStudentCourseEnrolled } from "../data/studentLocalState";

function countdownTo(startAt, now) {
  const minutes = Math.max(0, Math.floor((startAt.getTime() - now.getTime()) / 60000));
  const days = Math.floor(minutes / 1440);
  const hours = Math.floor((minutes % 1440) / 60);
  const remainder = minutes % 60;
  if (days) return `Starts in ${days}d ${hours}h`;
  if (hours) return `Starts in ${hours}h ${remainder}m`;
  return `Starts in ${remainder}m`;
}

export default function LiveCourseSchedule() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const courseId = searchParams.get("course");
  const course = courseId ? getCourseById(courseId) : null;
  const isEnrolled = Boolean(user && course && (course.enrolled || isStudentCourseEnrolled(course.id, user)));
  const [now, setNow] = useState(() => new Date());
  const schedule = useMemo(() => course ? getLiveCourseSchedule(course.id, now) : null, [course, now]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  if (!course || course.courseType !== "Live") {
    return <div className="mx-auto max-w-xl px-4 py-12"><BackButton fallback="/student/live-classes" className="mb-4" /><ConfirmationCard state="warning" heading="Live class not found" message="This schedule is only available for a live class." primaryAction={<Button onClick={() => navigate("/student/live-classes")}>Browse Live Classes</Button>} /></div>;
  }

  if (!isEnrolled) {
    return <div className="mx-auto max-w-xl px-4 py-12"><BackButton fallback={`/student/course/${course.id}`} className="mb-4" /><ConfirmationCard state="warning" heading="Enroll to view your class schedule" message={`Enroll in ${course.title} to see its session time and join when class begins.`} primaryAction={<Button onClick={() => navigate(`/student/course/${course.id}`)}>View Class Details</Button>} /></div>;
  }

  if (!schedule) return null;
  const isLive = schedule.status === "live";

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-10">
      <BackButton fallback="/student/my-learning" className="mb-5" />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Your live class</p>
      <h1 className="mt-2 font-display text-3xl font-bold text-text">{course.title}</h1>
      <p className="mt-2 text-sm text-text/60">Your enrollment is confirmed. Review your class schedule and return here when it begins.</p>

      <section className="mt-6 rounded-3xl border border-text/10 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <span className={`inline-flex rounded-full px-3 py-1.5 text-xs font-bold ${isLive ? "bg-success/10 text-success" : "bg-[#fff0eb] text-primary"}`}>
              {isLive ? "LIVE NOW" : "UPCOMING CLASS"}
            </span>
            <h2 className="mt-4 font-display text-2xl font-bold text-text">{schedule.classTitle}</h2>
            <p className="mt-1 text-sm text-text/55">with {schedule.educator}</p>
          </div>
          {!isLive && <p className="rounded-2xl bg-[#eef7f4] px-4 py-3 text-sm font-semibold text-[#28756f]">{countdownTo(schedule.startAt, now)}</p>}
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-bg p-4"><p className="text-xs font-semibold uppercase tracking-wide text-text/45">Date</p><p className="mt-2 font-semibold text-text">{schedule.date}</p></div>
          <div className="rounded-2xl bg-bg p-4"><p className="text-xs font-semibold uppercase tracking-wide text-text/45">Class time</p><p className="mt-2 font-semibold text-text">{schedule.time}</p></div>
          <div className="rounded-2xl bg-bg p-4"><p className="text-xs font-semibold uppercase tracking-wide text-text/45">Duration</p><p className="mt-2 font-semibold text-text">{schedule.duration}</p></div>
        </div>

        <div className="mt-5 rounded-2xl border border-text/10 p-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-text/45">Class details</p>
          <p className="mt-2 text-sm leading-6 text-text/65">Join the scheduled group session for {course.title}. The room opens when the class starts. This class is separate from prerecorded lessons in Recorded Classes.</p>
          <p className="mt-2 text-sm text-text/55">Educator: <strong className="text-text">{schedule.educator}</strong> · Online group class · {schedule.duration}</p>
        </div>

        {isLive ? (
          <Button className="mt-6" onClick={() => navigate(`/student/liveclassjoin?session=${schedule.id}&join=1`)}>Join Live Class</Button>
        ) : (
          <Button className="mt-6" variant="secondary" disabled>Join Live Class · available when class starts</Button>
        )}
      </section>
    </div>
  );
}
