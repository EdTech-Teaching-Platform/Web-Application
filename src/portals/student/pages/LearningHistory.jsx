import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { CheckIcon, CheckCircleIcon, ClockIcon, DownloadIcon, FileTextIcon, PlayIcon, SearchIcon } from "../../../components/ui/icons";
import { COURSES } from "../../../data/catalogMock";
import { useAuth } from "../../../hooks/useAuth";
import { getStudentEnrolledCourseIds } from "../data/studentLocalState";
import { imageForCategory } from "../../../utils/stockImages";
import { useActivityLog } from "../hooks/useActivityLog";
import { getAllCourseProgress } from "../hooks/useCourseProgress";
import { ATTENDANCE_SESSIONS } from "../data/sessionMock";
import SectionShapes from "../../../components/common/SectionShapes";

const FILTERS = [
  { id: "all", label: "All activity" },
  { id: "video", label: "Videos" },
  { id: "pdf", label: "PDFs & resources" },
  { id: "text", label: "Reading" },
  { id: "completed", label: "Completed" },
];

function lessonTotal(course) {
  return (course.curriculum || []).reduce((total, module) => total + (module.lessons || []).length, 0);
}

function activityTime(timestamp) {
  if (!timestamp) return "Time not recorded";
  return new Date(timestamp).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

function courseProgress(course, activities, stored) {
  const total = lessonTotal(course);
  const storedLessons = stored[course.id]?.lessons || {};
  const completed = new Set(
    Object.entries(storedLessons).filter(([, lesson]) => lesson.status === "completed").map(([id]) => id)
  );
  activities.forEach((activity) => {
    if (activity.lessonId && (activity.activityType === "completed" || activity.percent === 100)) completed.add(activity.lessonId);
  });
  const denominator = total || Object.keys(storedLessons).length;
  return { completed: Math.min(completed.size, denominator), total: denominator, percent: denominator ? Math.round(Math.min(completed.size, denominator) / denominator * 100) : 0 };
}

function CourseCard({ course, activities, progress, onSelect }) {
  const lastActivity = activities[0];
  return <button type="button" onClick={onSelect} className="group flex h-full flex-col overflow-hidden rounded-2xl border border-text/10 bg-white text-left shadow-[0_3px_14px_rgba(23,50,77,0.04)] transition hover:-translate-y-0.5 hover:border-primary/25 hover:shadow-md">
    <img src={imageForCategory(course.category, { w: 640, h: 360 })} alt="" className="aspect-[16/8] w-full object-cover" />
    <div className="flex flex-1 flex-col p-5"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/65">{course.category} · {course.level}</p><h2 className="mt-1 font-display text-lg font-bold text-text group-hover:text-primary">{course.title}</h2><p className="mt-1 text-xs text-text/50">{course.subtitle}</p>
      <div className="mt-5 flex items-end justify-between gap-3"><div><strong className="font-display text-xl text-text">{progress.completed}<span className="text-sm font-medium text-text/40"> / {progress.total || "—"}</span></strong><p className="mt-0.5 text-[11px] text-text/45">Lessons completed</p></div><span className="rounded-full bg-[#e7f1ef] px-3 py-1.5 text-xs font-bold text-[#28756f]">{progress.percent}%</span></div>
      <div className="mt-2 h-2 overflow-hidden rounded-full bg-text/10"><div className="h-full rounded-full bg-primary" style={{ width: `${progress.percent}%` }} /></div>
      <p className="mt-4 min-h-4 text-[11px] text-text/45">{lastActivity ? `Last activity ${activityTime(lastActivity.createdAt)}` : "No activity yet"}</p>
      <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-primary">View course history <span aria-hidden="true">→</span></span>
    </div>
  </button>;
}

function ActivityRow({ activity, onContinue }) {
  const completed = activity.activityType === "completed" || activity.percent === 100;
  const video = activity.lessonType === "video" || activity.activityType === "watched";
  const resource = activity.lessonType === "resource" || activity.lessonType === "pdf" || activity.activityType === "viewed";
  const Icon = completed ? CheckIcon : video ? PlayIcon : resource ? DownloadIcon : FileTextIcon;
  const status = completed ? "Completed" : activity.activityType === "watched" && activity.percent ? `${Math.round(activity.percent)}% watched` : activity.activityType === "note" ? "Note added" : "In progress";
  return <article className="flex flex-col justify-between gap-3 rounded-2xl border border-text/10 bg-white p-4 sm:flex-row sm:items-center"><div className="flex min-w-0 items-start gap-3"><span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${completed ? "bg-success/10 text-success" : "bg-primary/5 text-primary"}`}><Icon className="h-5 w-5" /></span><div className="min-w-0"><p className="text-[11px] font-semibold text-text/45">{activity.moduleTitle || "Course activity"} · {activityTime(activity.createdAt)}</p><h3 className="mt-1 truncate font-display text-sm font-bold text-text">{activity.lessonTitle || "Lesson"}</h3><p className="text-xs text-text/45">{video ? "Video lesson" : resource ? "Course resource" : activity.lessonType === "article" ? "Reading" : "Learning activity"}</p></div></div><div className="flex items-center justify-between gap-3 border-t border-text/5 pt-3 sm:border-0 sm:pt-0"><StatusBadge status={completed ? "success" : "warning"}>{status}</StatusBadge><Button variant="secondary" fullWidth={false} className="!px-3 !py-1.5 text-xs" onClick={() => onContinue(activity)}>Continue →</Button></div></article>;
}

export default function LearningHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.identifier || user?.id || "guest";
  const [searchParams, setSearchParams] = useSearchParams();
  const { entries } = useActivityLog();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const selectedId = searchParams.get("course");
  const enrolledCourses = useMemo(() => {
    const enrolledIds = new Set(getStudentEnrolledCourseIds(userId));
    return COURSES.filter((course) => course.enrolled || enrolledIds.has(course.id));
  }, [userId]);
  const selectedCourse = enrolledCourses.find((course) => course.id === selectedId);
  const storedProgress = getAllCourseProgress();

  const visibleCourses = useMemo(() => enrolledCourses.filter((course) => `${course.title} ${course.subtitle} ${course.category}`.toLowerCase().includes(query.trim().toLowerCase())), [enrolledCourses, query]);
  // Missed live classes -- reuses the same ATTENDANCE_SESSIONS data and
  // recordingId/sessionId fields already wired up in CourseDetails.jsx's
  // attendance card ("Watch recording" -> /student/recordings?session=...
  // when recordingId exists, otherwise -> /student/attendance"). "Missed"
  // is simply attended === false on a session for a course the student is
  // currently enrolled in -- no new missed/recording data model.
  const missedSessions = useMemo(
    () =>
      ATTENDANCE_SESSIONS.filter(
        (session) => session.attended === false && enrolledCourses.some((course) => course.id === session.courseId)
      ),
    [enrolledCourses]
  );
  const courseActivities = useMemo(() => entries.filter((activity) => activity.courseId === selectedId).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)), [entries, selectedId]);
  const filteredActivities = useMemo(() => courseActivities.filter((activity) => {
    const matchesFilter = filter === "all" || (filter === "video" && (activity.lessonType === "video" || activity.activityType === "watched")) || (filter === "pdf" && ["resource", "pdf"].includes(activity.lessonType)) || (filter === "text" && ["article", "text"].includes(activity.lessonType)) || (filter === "completed" && (activity.activityType === "completed" || activity.percent === 100));
    return matchesFilter && `${activity.lessonTitle || ""} ${activity.moduleTitle || ""}`.toLowerCase().includes(query.trim().toLowerCase());
  }), [courseActivities, filter, query]);

  function openCourse(courseId) {
    setQuery("");
    setFilter("all");
    setSearchParams({ course: courseId });
  }

  function backToCourses() {
    setQuery("");
    setFilter("all");
    setSearchParams({});
  }

  function continueActivity(activity) {
    navigate(`/student/courseplayer?course=${selectedCourse.id}${activity.lessonId ? `&lesson=${activity.lessonId}` : ""}`);
  }

  if (selectedId && selectedCourse) {
    const progress = courseProgress(selectedCourse, courseActivities, storedProgress);
    const latest = courseActivities[0];
    const completed = courseActivities.filter((activity) => activity.activityType === "completed" || activity.percent === 100).length;
    const modules = new Set(courseActivities.map((activity) => activity.moduleId).filter(Boolean)).size;
    return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <button type="button" onClick={backToCourses} className="inline-flex items-center gap-2 rounded-full border border-text/10 bg-white px-3.5 py-2 text-xs font-semibold text-text/65 shadow-sm hover:border-primary/30 hover:text-primary"><span aria-hidden="true">←</span> All courses</button>
      <header className="mt-5 flex flex-col gap-5 rounded-2xl border border-text/10 bg-white p-5 sm:flex-row sm:items-center sm:p-6"><img src={imageForCategory(selectedCourse.category, { w: 480, h: 240 })} alt="" className="h-32 w-full rounded-xl object-cover sm:h-28 sm:w-48"/><div className="min-w-0 flex-1"><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Course learning history</p><h1 className="mt-1 font-display text-2xl font-bold text-text sm:text-3xl">{selectedCourse.title}</h1><p className="mt-1 text-sm text-text/50">{selectedCourse.subtitle} · {selectedCourse.category}</p><button type="button" onClick={() => navigate(`/student/courseplayer?course=${selectedCourse.id}`)} className="mt-3 text-sm font-semibold text-primary">Continue course →</button></div></header>
      <section className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">{[[`${progress.completed}/${progress.total || "—"}`, "Lessons completed"], [`${progress.percent}%`, "Course progress"], [courseActivities.length, "Learning activities"], [modules, "Modules visited"]].map(([value, label]) => <div key={label} className="rounded-2xl border border-text/10 bg-white p-4"><strong className="font-display text-xl text-text sm:text-2xl">{value}</strong><p className="mt-1 text-xs text-text/45">{label}</p></div>)}</section>
      <section className="mt-6 rounded-2xl border border-text/10 bg-white p-5 sm:p-6"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Your timeline</p><h2 className="mt-1 font-display text-xl font-bold text-text">Activity in this course</h2><p className="mt-1 text-xs text-text/50">{latest ? `Last activity ${activityTime(latest.createdAt)}` : "Your lesson activity will appear here as you learn."} · {completed} completed items</p></div><label className="relative w-full sm:w-64"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search lessons..." className="w-full rounded-full border border-text/10 bg-bg py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary"/></label></div>
        <div className="mt-4 flex flex-wrap gap-2">{FILTERS.map((item) => <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={`rounded-full px-3.5 py-2 text-xs font-semibold ${filter === item.id ? "bg-primary text-white" : "border border-primary/15 bg-white text-primary hover:bg-primary/5"}`}>{item.label}</button>)}</div>
        {filteredActivities.length ? <div className="mt-4 space-y-3">{filteredActivities.map((activity) => <ActivityRow key={activity.id} activity={activity} onContinue={continueActivity}/>)}</div> : <div className="mt-4 rounded-2xl border border-dashed border-text/15 bg-[#fcfbfa] px-5 py-10 text-center"><CheckCircleIcon className="mx-auto h-8 w-8 text-text/30"/><h3 className="mt-3 font-display text-lg font-bold text-text">{courseActivities.length ? "No matching course activity" : "No activity recorded yet"}</h3><p className="mt-1 text-sm text-text/50">{courseActivities.length ? "Try a different filter or search term." : "Start a lesson and your progress will be tracked here."}</p>{!courseActivities.length && <Button fullWidth={false} className="mt-4" onClick={() => navigate(`/student/courseplayer?course=${selectedCourse.id}`)}>Start learning</Button>}</div>}
      </section>
    </div>;
  }

  return <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Your learning, organized by course</p><h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Learning History</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-text/55">Choose an enrolled course to review your lessons, progress, and recent activity.</p></div><label className="relative w-full sm:w-72"><SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35"/><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your courses..." className="w-full rounded-full border border-text/10 bg-white py-3 pl-9 pr-4 text-sm outline-none focus:border-primary"/></label></header>
    {missedSessions.length > 0 && (
      <section className="relative mt-6 overflow-hidden rounded-2xl bg-bg p-5 sm:p-6">
        <SectionShapes variant="why" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Catch up</p>
          <h2 className="mt-1 font-display text-lg font-bold text-text">Missed live classes</h2>
          <p className="mt-1 text-xs text-text/50">Live sessions you were enrolled in but didn't attend. Watch the recording if one is available.</p>
          <div className="mt-4 space-y-2">
            {missedSessions.map((session) => {
              const missedCourse = enrolledCourses.find((course) => course.id === session.courseId);
              return (
                <div key={session.id} className="flex flex-col gap-3 rounded-xl border border-text/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold text-text/45">{missedCourse?.title || "Course"} · {session.date}</p>
                    <h3 className="mt-1 truncate font-display text-sm font-bold text-text">{session.topic}</h3>
                    <p className="text-xs text-text/45">{session.educator}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status="warning">Missed</StatusBadge>
                    {session.recordingId ? (
                      <Button
                        fullWidth={false}
                        variant="secondary"
                        className="!px-3 !py-1.5 text-xs"
                        onClick={() => navigate(`/student/recordings?session=${session.sessionId}`)}
                      >
                        Watch recording →
                      </Button>
                    ) : (
                      <span className="text-xs text-text/40">No recording available</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>
    )}
    {visibleCourses.length ? <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{visibleCourses.map((course) => {
      const activities = entries.filter((activity) => activity.courseId === course.id).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      const progress = courseProgress(course, activities, storedProgress);
      return <CourseCard key={course.id} course={course} activities={activities} progress={progress} onSelect={() => openCourse(course.id)}/>;
    })}</div> : <div className="mt-6 rounded-2xl border border-dashed border-text/15 bg-white px-6 py-14 text-center"><ClockIcon className="mx-auto h-8 w-8 text-text/30"/><h2 className="mt-3 font-display text-lg font-bold text-text">No enrolled courses found</h2><p className="mt-1 text-sm text-text/50">Enroll in a course to see its learning history here.</p></div>}
  </div>;
}
