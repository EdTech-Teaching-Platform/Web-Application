import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { COURSES, getCourseById } from "../../../data/catalogMock";
import { useCourseProgress } from "../hooks/useCourseProgress";
import { useLearningStats, formatHoursMinutes } from "../hooks/useLearningStats";
import { flattenCurriculum } from "../components/coursePlayer/lessonContent";
import Button from "../../../components/ui/Button";
import BackButton from "../../../components/common/BackButton";
import {
  ClockIcon,
  FlameIcon,
  PlayIcon,
  ChevronDownIcon,
  CheckCircleIcon,
  BookOpenIcon,
  AwardIcon,
} from "../../../components/ui/icons";

export default function ProgressTracking() {
  const navigate = useNavigate();
  const [selectedCourseId, setSelectedCourseId] = useState("c1");
  const [expandedModules, setExpandedModules] = useState({ m1: true, m2: true, m3: true });
  const stats = useLearningStats();

  const enrolledCourses = useMemo(() => {
    return COURSES.filter((c) => c.enrolled === true);
  }, []);

  const activeCourse = useMemo(() => {
    return getCourseById(selectedCourseId) || enrolledCourses[0] || COURSES[0];
  }, [selectedCourseId, enrolledCourses]);

  const courseProgressHook = useCourseProgress(activeCourse?.id || "c1");

  const flatLessons = useMemo(() => {
    return activeCourse?.curriculum ? flattenCurriculum(activeCourse.curriculum) : [];
  }, [activeCourse]);

  // Compute course-level metrics
  const completedLessonCount = flatLessons.filter(
    (l) => courseProgressHook.getLessonState(l.id).status === "completed"
  ).length;

  const coursePercent = flatLessons.length
    ? Math.round((completedLessonCount / flatLessons.length) * 100)
    : 0;

  // Compute module-level metrics
  const moduleBreakdowns = useMemo(() => {
    if (!activeCourse?.curriculum) return [];
    return activeCourse.curriculum.map((mod) => {
      const totalLessons = mod.lessons.length;
      const completed = mod.lessons.filter(
        (l) => courseProgressHook.getLessonState(l.id).status === "completed"
      ).length;
      const percent = totalLessons ? Math.round((completed / totalLessons) * 100) : 0;
      let status = "not-started";
      if (percent === 100) status = "completed";
      else if (completed > 0 || percent > 0) status = "in-progress";

      return {
        ...mod,
        totalLessons,
        completed,
        percent,
        status,
      };
    });
  }, [activeCourse, courseProgressHook]);

  // Resume item calculation
  const resumeLesson = useMemo(() => {
    if (!flatLessons.length) return null;
    if (courseProgressHook.lastLessonId) {
      const found = flatLessons.find((l) => l.id === courseProgressHook.lastLessonId);
      if (found) return found;
    }
    // First incomplete lesson
    const firstIncomplete = flatLessons.find(
      (l) => courseProgressHook.getLessonState(l.id).status !== "completed"
    );
    return firstIncomplete || flatLessons[0];
  }, [flatLessons, courseProgressHook]);

  const resumeLessonState = resumeLesson
    ? courseProgressHook.getLessonState(resumeLesson.id)
    : null;

  function toggleModule(modId) {
    setExpandedModules((prev) => ({ ...prev, [modId]: !prev[modId] }));
  }

  function handleResume() {
    if (!resumeLesson) return;
    navigate(`/student/courseplayer?course=${activeCourse.id}&lesson=${resumeLesson.id}`);
  }

  function handleOpenLesson(lessonId) {
    navigate(`/student/courseplayer?course=${activeCourse.id}&lesson=${lessonId}`);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
      <BackButton fallback="/student/dashboard" className="mb-4" />
      {/* Page Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
          Progress Tracking & Analytics
        </h1>
        <p className="mt-1 text-sm text-text/60">
          Monitor your lesson completion rates, module milestones, and learning streaks.
        </p>
      </div>

      {/* 5 Lightweight Statistics Cards (Spec Section 11) */}
      <div className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-text/10 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-text/50">
            <ClockIcon className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Total Time</span>
          </div>
          <p className="mt-2 font-display text-xl font-bold text-text">
            {formatHoursMinutes(stats.totalSeconds)}
          </p>
          <p className="mt-0.5 text-[11px] text-text/45">Cumulative learning</p>
        </div>

        <div className="rounded-2xl border border-text/10 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-text/50">
            <FlameIcon className="h-4 w-4 text-warning" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Streak</span>
          </div>
          <p className="mt-2 font-display text-xl font-bold text-text">
            {stats.streakDays} Days
          </p>
          <p className="mt-0.5 text-[11px] text-text/45">Active daily streak</p>
        </div>

        <div className="rounded-2xl border border-text/10 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-text/50">
            <CheckCircleIcon className="h-4 w-4 text-success" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Completed</span>
          </div>
          <p className="mt-2 font-display text-xl font-bold text-text">
            {stats.lessonsCompleted} Lessons
          </p>
          <p className="mt-0.5 text-[11px] text-text/45">Verified completions</p>
        </div>

        <div className="rounded-2xl border border-text/10 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-1.5 text-text/50">
            <ClockIcon className="h-4 w-4 text-rotation-3" />
            <span className="text-[11px] font-bold uppercase tracking-wider">This Week</span>
          </div>
          <p className="mt-2 font-display text-xl font-bold text-text">
            {formatHoursMinutes(stats.thisWeekSeconds)}
          </p>
          <p className="mt-0.5 text-[11px] text-text/45">Past 7 days activity</p>
        </div>

        <div className="col-span-2 rounded-2xl border border-text/10 bg-white p-4 shadow-xs sm:col-span-1">
          <div className="flex items-center gap-1.5 text-text/50">
            <AwardIcon className="h-4 w-4 text-primary" />
            <span className="text-[11px] font-bold uppercase tracking-wider">Courses Done</span>
          </div>
          <p className="mt-2 font-display text-xl font-bold text-text">
            {stats.coursesCompleted || 1}
          </p>
          <p className="mt-0.5 text-[11px] text-text/45">Full certifications</p>
        </div>
      </div>

      {/* Resume Learning Card (Spec Section 12) */}
      {resumeLesson && (
        <div className="mb-8 overflow-hidden rounded-3xl border border-primary/20 bg-gradient-to-r from-primary/5 via-blush/40 to-white p-6 shadow-xs">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-primary px-3 py-0.5 text-xs font-bold text-white uppercase tracking-wider">
                <PlayIcon className="h-3 w-3" /> Resume Learning
              </span>
              <h2 className="mt-2 font-display text-lg font-bold text-text sm:text-xl">
                {activeCourse.title}
              </h2>
              <p className="mt-0.5 text-sm text-text/70">
                Module {resumeLesson.moduleIndex + 1} →{" "}
                <span className="font-semibold text-text">{resumeLesson.title}</span>{" "}
                {resumeLessonState?.maxWatchedPercent > 0 && (
                  <span className="text-xs font-semibold text-primary">
                    ({Math.round(resumeLessonState.maxWatchedPercent)}% watched)
                  </span>
                )}
              </p>
            </div>
            <Button fullWidth={false} onClick={handleResume} className="self-start sm:self-auto">
              <PlayIcon className="mr-1.5 h-4 w-4" /> Resume Lesson
            </Button>
          </div>
        </div>
      )}

      {/* Course Selection Tabs */}
      <div className="mb-6 flex flex-wrap items-center gap-2 border-b border-text/10 pb-3">
        {enrolledCourses.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => setSelectedCourseId(c.id)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition-colors duration-150 ${
              selectedCourseId === c.id
                ? "bg-primary text-white shadow-xs"
                : "border border-primary/20 bg-white text-primary hover:bg-primary/5"
            }`}
          >
            {c.title}
          </button>
        ))}
      </div>

      {/* Main Course Progress Overview (Spec Section 10) */}
      <div className="rounded-3xl border border-text/10 bg-white p-6 shadow-xs sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-xs font-bold uppercase tracking-wider text-text/50">
              COURSE PROGRESS
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold text-text sm:text-3xl">
              {coursePercent}% Complete
            </h2>
            <p className="mt-0.5 text-xs text-text/60">
              {completedLessonCount} of {flatLessons.length} Lessons Completed
            </p>
          </div>

          <Button fullWidth={false} onClick={handleResume}>
            <BookOpenIcon className="mr-1.5 h-4 w-4" /> Continue Learning
          </Button>
        </div>

        {/* Course Progress Bar */}
        <div className="mb-8">
          <div className="h-3 w-full overflow-hidden rounded-full bg-text/10">
            <div
              className={`h-full rounded-full transition-all duration-500 ease-out ${
                coursePercent === 100 ? "bg-success" : "bg-primary"
              }`}
              style={{ width: `${coursePercent}%` }}
            />
          </div>
        </div>

        {/* 3-Level Progress Breakdowns: Modules & Lessons */}
        <div className="space-y-4">
          <h3 className="font-display text-sm font-bold uppercase tracking-wider text-text/70">
            Modules Breakdown
          </h3>

          <div className="space-y-3">
            {moduleBreakdowns.map((mod, modIdx) => {
              const isExpanded = expandedModules[mod.id] ?? true;

              return (
                <div
                  key={mod.id}
                  className="overflow-hidden rounded-2xl border border-text/10 bg-bg/50 transition-colors hover:border-primary/20"
                >
                  {/* Module Header Bar */}
                  <div
                    onClick={() => toggleModule(mod.id)}
                    className="flex cursor-pointer items-center justify-between gap-4 p-4 transition-colors hover:bg-white"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      {/* Status Icon */}
                      <span className="shrink-0 text-base">
                        {mod.status === "completed" ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-success/15 text-success font-bold text-xs">
                            ✓
                          </span>
                        ) : mod.status === "in-progress" ? (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-warning/20 text-warning font-bold text-xs">
                            ◐
                          </span>
                        ) : (
                          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-text/10 text-text/40 font-bold text-xs">
                            ○
                          </span>
                        )}
                      </span>

                      <div className="min-w-0 flex-1">
                        <p className="font-display text-sm font-bold text-text truncate">
                          Module {modIdx + 1} — {mod.title}
                        </p>
                        <p className="text-xs text-text/50">
                          {mod.completed} / {mod.totalLessons} lessons completed
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <span className="font-mono text-xs font-bold text-primary">
                        {mod.percent}%
                      </span>
                      <ChevronDownIcon
                        className={`h-4 w-4 text-text/40 transition-transform duration-200 ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                      />
                    </div>
                  </div>

                  {/* Module Progress Bar */}
                  <div className="h-1.5 w-full bg-text/5">
                    <div
                      className={`h-full transition-all duration-300 ${
                        mod.percent === 100 ? "bg-success" : "bg-primary"
                      }`}
                      style={{ width: `${mod.percent}%` }}
                    />
                  </div>

                  {/* Expandable Lesson List */}
                  {isExpanded && (
                    <div className="divide-y divide-text/5 border-t border-text/5 bg-white px-4 py-2">
                      {mod.lessons.map((lesson, lessonIdx) => {
                        const lState = courseProgressHook.getLessonState(lesson.id);
                        const isDone = lState.status === "completed";
                        const isInProgress = lState.status === "in-progress";

                        return (
                          <div
                            key={lesson.id}
                            className="flex items-center justify-between gap-3 py-2.5 text-xs transition-colors hover:bg-bg/60 rounded-lg px-2"
                          >
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              {/* Lesson State Indicator (○, ◐, ✓) */}
                              <span className="shrink-0 font-bold">
                                {isDone ? (
                                  <span className="text-success text-sm">✓</span>
                                ) : isInProgress ? (
                                  <span className="text-warning text-sm">◐</span>
                                ) : (
                                  <span className="text-text/30 text-sm">○</span>
                                )}
                              </span>

                              <div className="min-w-0 flex-1">
                                <p
                                  className={`truncate font-medium ${
                                    isDone ? "text-text/60 line-through" : "text-text"
                                  }`}
                                >
                                  {lessonIdx + 1}. {lesson.title}
                                </p>
                                <div className="flex items-center gap-2 text-[11px] text-text/40">
                                  <span>{lesson.duration || "10 min"}</span>
                                  <span>·</span>
                                  <span className="capitalize">{lesson.type}</span>
                                  {lState.maxWatchedPercent > 0 && !isDone && (
                                    <>
                                      <span>·</span>
                                      <span className="font-semibold text-primary">
                                        {Math.round(lState.maxWatchedPercent)}% watched
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => handleOpenLesson(lesson.id)}
                              className="shrink-0 rounded-full border border-primary/20 bg-bg px-2.5 py-1 text-[11px] font-semibold text-primary hover:bg-primary hover:text-white transition-colors"
                            >
                              {isDone ? "Review" : isInProgress ? "Resume" : "Start"}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
