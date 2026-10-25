// Student Dashboard (home)
// Jira: Day 2 (2026-09-15) — Student Dashboard (home) UI, restyled to
// match the "MINUTO" reference mockup's layout/density.
// Doc reference: Sec 15 — Dashboard Overview (re-checked against the
// updated LMS doc; row content is unchanged from the original build:
// "Continue Learning shortcuts, upcoming schedule, progress bars,
// upcoming deadlines, personalized recommendations, notifications bell,
// learning streaks, and earned certificates" + metrics "Courses
// completed, overall progress percentage, upcoming sessions." The doc's
// only Section 15 addition in this edition is a new *Parent* Dashboard
// row (separate role, not this screen) — nothing new applies here beyond
// what was already built.
//
// Restyle decision (user confirmed via question): match the reference
// image's layout and visual richness, but stay entirely inside design.md's
// existing tokens/components rather than adopting its purple/orange/coral
// palette. New building blocks introduced for this pass — GoalRing (donut
// "Today's Goal"), StreakRow (weekly day-pill row), MiniTrendCard
// (sparkline stat card), WeeklyProgressChart (line/area chart + tooltip),
// AchievementBadge grid — are all flagged in their own files as visual
// enrichments layered on top of the doc's actual feature list, not new
// backend requirements. None of them are named components in design.md;
// each is scoped to this screen only (portals/student/components) per the
// "promote once a 2nd consumer needs it" rule.
//
// Section count: 6 top-level sections now (Hero, Continue Learning,
// Schedule & Deadlines, Progress & Achievements, Recommended, Certificates)
// — one over design.md's "max ~4-5" guidance, accepted deliberately for
// this ticket since matching the reference's density was the explicit ask;
// notifications/streak stay folded into chrome (header bell, hero streak
// row) rather than becoming their own sections, same as before.
//
// Data below is mock/placeholder — wire to studentApi.js once dashboard
// endpoints exist; kept local so the screen renders and is reviewable
// without a backend.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Hatch, Sparkle, ArrowUpRight, PillButton } from "../../../public/components/landing/LandingUI";
import { AwardIcon, CheckIcon, ClockIcon, FileTextIcon, FlameIcon, HeartIcon, PlayIcon, StarIcon } from "../../../components/ui/icons";
import { imageForCategory, imgFallback } from "../../../utils/stockImages";
import { useAuth } from "../../../hooks/useAuth";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import ToastStack from "../../../components/ui/Toast";
import { RECOMMENDED } from "../data/recommendedMock";
import { COURSES } from "../../../data/catalogMock";
import { isStudentCourseEnrolled } from "../data/studentLocalState";
import MyTestSeriesSection from "../components/MyTestSeriesSection";
import { formatClassStart, getLiveCourseSchedule } from "../data/liveCourseSchedule";
import { getAllCourseProgress } from "../hooks/useCourseProgress";
import { getCourseById } from "../../../data/catalogMock";
import { flattenCurriculum } from "../components/coursePlayer/lessonContent";

// `category` drives the card's placeholder photo (imageForCategory) — see
// src/utils/stockImages.js.
// `currentLesson` + `updatedAt` back the hero's "Continue: <course> / Lesson:
// <lesson>" copy below — the hero picks whichever course has the most
// recent `updatedAt` (real "last activity" timestamp once wired to
// studentApi.js) rather than hardcoding index 0, so the button and its
// label can never point at different courses.
// ids matched to src/data/catalogMock.js's real course ids (c1/c2/c3 are
// the same Python/Algebra/IELTS courses by title+educator) — Day 4 Course
// Player fix, so "Continue Learning" here actually resolves to a real
// course/curriculum instead of the placeholder e1/e2/e3 ids CoursePlayer
// can't look up.
const IN_PROGRESS_COURSES = [
  { id: "c1", title: "Complete Python Bootcamp", subtitle: "Priya Sharma", description: "Build practical Python skills through projects, core concepts, and guided practice.", progress: 62, category: "Programming", currentLesson: "Loops & Functions", updatedAt: "2026-09-17T08:30:00" },
  { id: "c2", title: "Algebra Foundations", subtitle: "Rohan Mehta", description: "Strengthen algebra fundamentals with clear explanations and step-by-step problem solving.", progress: 30, category: "Math", currentLesson: "Quadratic Equations", updatedAt: "2026-09-15T18:00:00" },
  { id: "c3", title: "IELTS Speaking Mastery", subtitle: "Anaya Kapoor", description: "Improve fluency, confidence, and speaking strategy with structured IELTS practice.", progress: 85, category: "Languages", currentLesson: "Fluency Drills, Part 3", updatedAt: "2026-09-16T20:00:00" },
  { id: "c6", title: "UI Design Fundamentals", subtitle: "Meera Iyer", description: "Learn the principles, systems, and workflows behind clear and engaging digital products.", progress: 18, category: "Design", currentLesson: "Design Tokens & Systems", updatedAt: "2026-09-14T11:00:00" },
  { id: "c8", title: "JavaScript Essentials", subtitle: "Priya Sharma", description: "Get comfortable with modern JavaScript fundamentals through hands-on practice.", progress: 45, category: "Programming", currentLesson: "Arrays & Objects", updatedAt: "2026-09-13T09:15:00" },
  { id: "c40", title: "Music Theory Fundamentals", subtitle: "Vikram Rao", description: "Understand scales, chords, and rhythm well enough to apply them on any instrument.", progress: 9, category: "Music", currentLesson: "Reading Sheet Music", updatedAt: "2026-09-12T19:45:00" },
];

const LIVE_CLASSES = [
  { id: "l1", courseId: "c1", educator: "Priya Sharma", subject: "Python — Functions in practice" },
];

const LEARNING_ACTIVITY = [
  { icon: CheckIcon, title: "Completed “Loops & Functions”", course: "Complete Python Bootcamp", time: "2 hours ago", tone: "bg-(--lp-blue-soft) text-(--lp-blue-deep)" },
  { icon: CheckIcon, title: "Finished “Python Variables”", course: "Complete Python Bootcamp", time: "Yesterday", tone: "bg-(--lp-yellow-soft) text-(--lp-ink)" },
  { icon: FileTextIcon, title: "Submitted project assignment", course: "Algebra Foundations", time: "2 days ago", tone: "bg-(--lp-ink) text-white" },
  { icon: AwardIcon, title: "Earned a course certificate", course: "Guitar for Beginners", time: "4 days ago", tone: "bg-(--lp-yellow) text-(--lp-ink)" },
];

const COMING_UP = [
  { icon: FileTextIcon, type: "Assignment", title: "Build a calculator", course: "Complete Python Bootcamp", when: "Due tomorrow", action: "View", href: "/student/assignmentsubmit?item=assignment-project" },
  { icon: ClockIcon, type: "Live class", courseId: "c1", title: "Functions in practice", course: "Complete Python Bootcamp", action: "View Schedule" },
  { icon: PlayIcon, type: "Quiz", title: "Knowledge check", course: "Algebra Foundations", when: "Sep 27 · Due soon", action: "View", href: "/student/quiz?course=c2" },
];

// Ids match src/data/catalogMock.js (c5, c6, c4, c3) rather than a separate
// r1..r4 set, so clicking through actually opens a real Course Details
// page instead of a search-by-title workaround.
export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();
  const [courseProgress, setCourseProgress] = useState(getAllCourseProgress);

  useEffect(() => {
    const refreshProgress = () => setCourseProgress(getAllCourseProgress());
    window.addEventListener("ul-course-progress-changed", refreshProgress);
    window.addEventListener("storage", refreshProgress);
    return () => {
      window.removeEventListener("ul-course-progress-changed", refreshProgress);
      window.removeEventListener("storage", refreshProgress);
    };
  }, []);

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const overallProgress = 68;
  const streakDays = 7;

  // The saved lastAccessedAt timestamp is written whenever a lesson opens.
  // Keep the sample dates as a first-visit fallback, then let real student
  // activity decide which course the welcome card resumes.
  const currentCourse = [...IN_PROGRESS_COURSES]
    .map((course) => {
      const saved = courseProgress[course.id];
      const lesson = saved?.lastLessonId
        ? flattenCurriculum(getCourseById(course.id)?.curriculum ?? []).find((item) => item.id === saved.lastLessonId)
        : null;
      const savedLessonActivity = saved?.lastLessonId
        ? saved.lessons?.[saved.lastLessonId]?.updatedAt
        : null;
      return {
        ...course,
        currentLesson: lesson?.title ?? course.currentLesson,
        activityAt: Number(saved?.lastAccessedAt || savedLessonActivity) || new Date(course.updatedAt).getTime(),
      };
    })
    .sort((a, b) => b.activityAt - a.activityAt)[0];

  const weekDone = [0, 1, 2, 3, 4, 5];
  const liveClasses = LIVE_CLASSES.concat({ id: "l3", courseId: "c3", educator: "Anaya Kapoor", subject: "IELTS — Speaking Practice" });
  const progressStats = [
    { label: "Courses", value: "3 / 5", pct: 60, tile: "bg-white text-(--lp-ink) ring-1 ring-(--lp-line)", bar: "bg-(--lp-blue)", track: "bg-(--lp-grey)", sub: "text-(--lp-muted)" },
    { label: "Assessments", value: "2 / 4", pct: 50, tile: "bg-(--lp-ink) text-white", bar: "bg-(--lp-yellow)", track: "bg-white/15", sub: "text-white/60" },
    { label: "Assignments", value: "1 / 3", pct: 33, tile: "bg-(--lp-blue-soft) text-(--lp-ink)", bar: "bg-(--lp-blue)", track: "bg-white", sub: "text-(--lp-muted)" },
    { label: "Live classes", value: "4 / 8", pct: 50, tile: "bg-(--lp-yellow-soft) text-(--lp-ink)", bar: "bg-(--lp-ink)", track: "bg-white", sub: "text-(--lp-muted)" },
  ];

  return (
    <div className="mx-auto max-w-[1320px] space-y-4 px-4 py-5 sm:px-7 sm:py-7 lg:px-10">
      {/* ------------------------------------------------------------ Hero */}
      <section className="grid gap-4 lg:grid-cols-[1.7fr_1fr]">
        <div className="relative isolate min-w-0 overflow-hidden rounded-[36px] bg-(--lp-blue) p-6 text-white sm:p-9">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-(--lp-yellow)" />
            <div className="absolute -right-6 -top-10 h-44 w-44 rounded-full border border-(--lp-ink)/10" />
            <div className="absolute -bottom-28 -left-20 h-64 w-64 rounded-full border-[26px] border-white/10" />
            <Hatch className="absolute bottom-8 right-8 hidden h-14 w-14 text-white/40 sm:block" />
            <Sparkle className="absolute right-[38%] top-8 hidden h-6 w-6 text-white/80 sm:block" />
          </div>

          <span className="inline-flex rounded-full bg-white/15 px-3.5 py-1.5 text-xs font-semibold">Student home</span>
          <h1 className="mt-4 font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-5xl">
            Welcome back,
            <br />
            <span className="relative inline-block">
              <span className="absolute -inset-x-1.5 bottom-[0.04em] top-[0.14em] -rotate-1 rounded-xl bg-(--lp-yellow)" aria-hidden="true" />
              <span className="relative text-(--lp-ink)">{firstName}</span>
            </span>{" "}
            <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-3 text-sm text-white/80">You're on a 7-day streak — keep it going!</p>

          {currentCourse && (
            <div className="mt-6 flex flex-col gap-4 rounded-3xl bg-white p-4 text-(--lp-ink) shadow-[0_24px_50px_rgba(15,17,21,0.2)] sm:flex-row sm:items-center">
              <img
                src={imageForCategory(currentCourse.category)}
                alt=""
                className="h-24 w-full rounded-2xl object-cover sm:h-20 sm:w-28 sm:shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-bold uppercase tracking-wider text-(--lp-blue-deep)">Continue</p>
                <p className="truncate font-display text-base font-bold">{currentCourse.title}</p>
                <p className="truncate text-xs text-(--lp-muted)">Lesson: {currentCourse.currentLesson}</p>
                <div className="mt-2 flex items-center gap-2.5">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-(--lp-grey)">
                    <div className="h-full rounded-full bg-(--lp-blue)" style={{ width: `${currentCourse.progress}%` }} />
                  </div>
                  <span className="text-xs font-bold text-(--lp-blue-deep)">{currentCourse.progress}%</span>
                </div>
              </div>
              <PillButton
                tone="ink"
                size="sm"
                disabled={!currentCourse}
                onClick={() => currentCourse && navigate(`/student/courseplayer?course=${currentCourse.id}`)}
                className="shrink-0 self-start sm:self-center"
              >
                Continue Learning
              </PillButton>
            </div>
          )}

          <div className="mt-5 flex items-center gap-2" aria-label="This week">
            {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => {
              const done = weekDone.includes(i);
              return (
                <span
                  key={i}
                  title={done ? "Lesson completed" : "No lesson yet"}
                  className={`grid h-9 w-9 place-items-center rounded-full text-xs font-bold ${done ? "bg-(--lp-yellow) text-(--lp-ink)" : "bg-white/15 text-white/70"}`}
                >
                  {d}
                </span>
              );
            })}
            <span className="ml-2 text-xs font-semibold text-white/80">{weekDone.length}/7 this week</span>
          </div>
        </div>

        <div className="relative isolate flex min-w-0 flex-col justify-between overflow-hidden rounded-[36px] bg-(--lp-yellow) p-6 text-(--lp-ink) sm:p-8">
          <div className="pointer-events-none absolute inset-0 -z-10" aria-hidden="true">
            <div className="absolute -bottom-24 -right-16 h-60 w-60 rounded-full bg-white/45" />
            <div className="absolute -left-10 -top-10 h-36 w-36 rounded-full border-[18px] border-white/40" />
          </div>
          <div className="flex items-start justify-between gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-(--lp-ink) px-3.5 py-2 text-xs font-semibold text-white">
              <FlameIcon className="h-3.5 w-3.5 text-(--lp-yellow)" /> {streakDays} <span className="font-normal text-white/70">day streak</span>
            </span>
            <Sparkle className="h-7 w-7 text-(--lp-ink)" />
          </div>
          <div className="my-6 flex items-center gap-5">
            <div
              role="img"
              aria-label={`${overallProgress}% overall progress`}
              className="grid h-36 w-36 shrink-0 place-items-center rounded-full"
              style={{ background: `conic-gradient(var(--lp-ink) ${overallProgress}%, rgba(255,255,255,0.7) 0)` }}
            >
              <div className="grid h-[104px] w-[104px] place-items-center rounded-full bg-white">
                <div className="text-center leading-none">
                  <strong className="font-display text-3xl font-bold">{overallProgress}%</strong>
                  <span className="mt-1 block text-[10px] font-semibold text-(--lp-muted)">overall</span>
                </div>
              </div>
            </div>
            <p className="font-display text-xl font-bold leading-tight">Great pace — you're ahead of last week.</p>
          </div>
          <PillButton tone="ink" size="sm" onClick={() => navigate("/student/learninghistory")} className="self-start">
            View progress
          </PillButton>
        </div>
      </section>

      {/* ----------------------------------------------------- Progress strip */}
      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Your progress">
        {progressStats.map((s) => (
          <div key={s.label} className={`rounded-[28px] p-5 ${s.tile}`}>
            <p className={`text-xs font-semibold ${s.sub}`}>{s.label}</p>
            <p className="mt-1 font-display text-3xl font-bold tracking-tight">{s.value}</p>
            <div className={`mt-3 h-2 overflow-hidden rounded-full ${s.track}`}>
              <div className={`h-full rounded-full ${s.bar}`} style={{ width: `${s.pct}%` }} />
            </div>
          </div>
        ))}
      </section>

      {/* ------------------------------------------------ Continue learning */}
      <section className="min-w-0 rounded-[36px] bg-white p-5 ring-1 ring-(--lp-line) sm:p-7">
        <SectionHeader eyebrow="Pick up where you left off" title="Continue Learning" action="View all" onAction={() => navigate("/student/my-learning")} />
        <div className="-mx-1 mt-5 flex snap-x gap-4 overflow-x-auto px-1 pb-3">
          {IN_PROGRESS_COURSES.map((c, i) => {
            const tone = TILE_TONES[i % TILE_TONES.length];
            const open = () => navigate(`/student/courseplayer?course=${c.id}`);
            return (
              <article
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={open}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") open(); }}
                className={`group relative w-[250px] shrink-0 snap-start cursor-pointer rounded-[28px] p-3 outline-none transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-(--lp-blue)/35 ${tone.card}`}
              >
                <div className="relative overflow-hidden rounded-[20px]">
                  <img src={imageForCategory(c.category)} alt="" onError={(e) => imgFallback(e, c.title, 480, 360)} className="aspect-[16/10] w-full object-cover" />
                  {c.id === currentCourse?.id && (
                    <span className="absolute left-2.5 top-2.5 rounded-full bg-(--lp-ink) px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-white">In progress</span>
                  )}
                </div>
                <div className="px-1.5 pb-1 pt-3">
                  <p className={`text-[11px] font-semibold ${tone.sub}`}>{c.category} · Self-paced</p>
                  <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] font-display text-[15px] font-bold leading-snug">{c.title}</h3>
                  <p className={`mt-0.5 truncate text-xs ${tone.sub}`}>{c.subtitle}</p>
                  <div className="mt-3 flex items-center gap-2.5">
                    <div className={`h-2 flex-1 overflow-hidden rounded-full ${tone.track}`}>
                      <div className={`h-full rounded-full ${tone.bar}`} style={{ width: `${c.progress}%` }} />
                    </div>
                    <span className="text-xs font-bold">{c.progress}%</span>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); open(); }}
                    className={`mt-3 inline-flex w-full items-center justify-center gap-1.5 rounded-full px-4 py-2.5 text-xs font-semibold transition-transform duration-200 ease-out group-hover:-translate-y-0.5 ${tone.btn}`}
                  >
                    Resume <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* ------------------------------------------ Live classes + coming up */}
      <div className="grid gap-4 lg:grid-cols-[1.25fr_1fr]">
        <section className="relative isolate min-w-0 overflow-hidden rounded-[36px] bg-(--lp-ink) p-5 text-white sm:p-7">
          <div className="pointer-events-none absolute -right-16 -top-16 -z-10 h-56 w-56 rounded-full bg-(--lp-blue)/40" aria-hidden="true" />
          <SectionHeader dark eyebrow="Join from anywhere" title="Upcoming Live Classes" action="View all" onAction={() => navigate("/student/managebooking")} />
          <div className="mt-5 space-y-3">
            {liveClasses.map((s) => {
              const schedule = getLiveCourseSchedule(s.courseId);
              const liveNow = schedule?.status === "live";
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-4 rounded-3xl bg-white/[0.07] p-3.5 ring-1 ring-white/10 sm:flex-nowrap">
                  <div className="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-(--lp-yellow) text-center text-(--lp-ink)">
                    <div className="leading-tight">
                      <span className="block text-[10px] font-bold uppercase">{schedule?.startAt.toLocaleDateString("en-IN", { weekday: "short" })}</span>
                      <span className="block font-display text-2xl font-bold">{schedule?.startAt.getDate()}</span>
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="flex items-center gap-2 truncate text-sm font-semibold">
                      {liveNow && <span className="inline-flex items-center gap-1 rounded-full bg-(--lp-danger) px-2 py-0.5 text-[10px] font-bold uppercase">Live</span>}
                      <span className="truncate">{s.subject}</span>
                    </p>
                    <p className="mt-0.5 truncate text-xs text-white/60">{s.educator} · {schedule ? formatClassStart(schedule.startAt) : "Schedule unavailable"}</p>
                  </div>
                  <PillButton
                    tone="yellow"
                    size="sm"
                    onClick={() => navigate(liveNow ? `/student/liveclassjoin?session=${schedule.id}&join=1` : `/student/live-course?course=${s.courseId}`)}
                  >
                    {liveNow ? "Join Live Class" : "View Schedule"}
                  </PillButton>
                </div>
              );
            })}
          </div>
        </section>

        <section className="min-w-0 rounded-[36px] bg-white p-5 ring-1 ring-(--lp-line) sm:p-7">
          <SectionHeader eyebrow="Don't miss" title="Coming up" action="Calendar" onAction={() => navigate("/student/calendar")} />
          <div className="mt-5 space-y-3">
            {COMING_UP.map(({ icon: Icon, type, title, course, when, action, href, courseId }, i) => {
              const schedule = type === "Live class" ? getLiveCourseSchedule(courseId) : null;
              const liveNow = schedule?.status === "live";
              const destination = schedule
                ? liveNow ? `/student/liveclassjoin?session=${schedule.id}&join=1` : `/student/live-course?course=${courseId}`
                : href;
              const tones = ["bg-(--lp-blue-soft) text-(--lp-blue-deep)", "bg-(--lp-yellow-soft) text-(--lp-ink)", "bg-(--lp-grey) text-(--lp-ink)"];
              return (
                <div key={title} className="flex items-center gap-3.5 rounded-3xl bg-(--lp-grey) p-3.5">
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${tones[i % tones.length]}`}><Icon className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-(--lp-blue-deep)">{type}</p>
                    <p className="truncate text-sm font-semibold text-(--lp-ink)">{title}</p>
                    <p className="truncate text-xs text-(--lp-muted)">{course} · {schedule ? formatClassStart(schedule.startAt) : when}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(destination)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-(--lp-ink) ring-1 ring-(--lp-line) transition-transform duration-200 ease-out hover:-translate-y-0.5"
                  >
                    {schedule && liveNow ? "Join" : schedule ? "Schedule" : action}
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      {/* ------------------------------------------------------ Recommended */}
      <section className="rounded-[36px] bg-(--lp-blue-tint) p-5 ring-1 ring-(--lp-blue-soft) sm:p-7">
        <SectionHeader eyebrow="Picked for you" title="Recommended for You" action="View all" onAction={() => navigate("/student/recommended")} />
        <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {RECOMMENDED.map((c, i) => {
            const enrolled = COURSES.find((course) => course.id === c.id)?.enrolled === true || isStudentCourseEnrolled(c.id, user);
            const saved = wishlist.isWishlisted(c.id);
            const go = () => navigate(`/student/course/${c.id}`);
            return (
              <article
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={go}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") go(); }}
                className="group flex cursor-pointer flex-col rounded-[28px] bg-white p-3 outline-none ring-1 ring-(--lp-line) transition-transform duration-200 ease-out hover:-translate-y-1 focus-visible:ring-4 focus-visible:ring-(--lp-blue)/35"
              >
                <div className="relative overflow-hidden rounded-[20px]">
                  <img src={imageForCategory(c.category)} alt="" onError={(e) => imgFallback(e, c.title, 480, 360)} className="aspect-[16/10] w-full object-cover" />
                  <span className={`absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide ${TILE_TONES[i % TILE_TONES.length].chip}`}>{c.category}</span>
                  <button
                    type="button"
                    aria-pressed={saved}
                    aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
                    onClick={(e) => {
                      e.stopPropagation();
                      const nowSaved = !saved;
                      wishlist.toggle(c);
                      showToast(nowSaved ? "Added to wishlist" : "Removed from wishlist");
                    }}
                    className="absolute right-2.5 top-2.5 grid h-9 w-9 place-items-center rounded-full bg-white text-(--lp-ink) shadow transition-transform duration-150 ease-out hover:scale-110"
                  >
                    <HeartIcon filled={saved} />
                  </button>
                </div>
                <div className="flex flex-1 flex-col px-1.5 pb-1 pt-3">
                  <h3 className="line-clamp-2 min-h-[2.5rem] font-display text-[15px] font-bold leading-snug text-(--lp-ink)">{c.title}</h3>
                  <p className="mt-0.5 truncate text-xs text-(--lp-muted)">{c.subtitle}</p>
                  {c.description && <p className="mt-2 line-clamp-2 text-[11px] leading-4 text-(--lp-muted)">{c.description}</p>}
                  <div className="mt-3 flex items-center justify-between text-sm font-bold text-(--lp-ink)">
                    <span className="flex items-baseline gap-1.5">
                      {c.price === 0 ? "Free" : `₹${c.price}`}
                      {typeof c.originalPrice === "number" && c.originalPrice > c.price && (
                        <span className="text-xs font-normal text-(--lp-muted) line-through">₹{c.originalPrice}</span>
                      )}
                    </span>
                    {c.rating !== undefined && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-(--lp-yellow-soft) px-2 py-1 text-xs font-semibold">
                        <StarIcon className="h-3.5 w-3.5 fill-current text-(--lp-ink)" />{c.rating}
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    disabled={enrolled}
                    onClick={(e) => { e.stopPropagation(); navigate(enrolled ? `/student/courseplayer?course=${c.id}` : `/student/course/${c.id}`); }}
                    className={`mt-3 w-full rounded-full px-4 py-2.5 text-xs font-semibold transition-colors duration-150 ${enrolled ? "cursor-not-allowed bg-(--lp-blue-soft) text-(--lp-blue-deep)" : "bg-(--lp-ink) text-white hover:bg-(--lp-ink)/90"}`}
                  >
                    {enrolled ? "Enrolled" : "Enroll"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <MyTestSeriesSection variant="compact" />

      {/* -------------------------------------------------- Learning activity */}
      <section className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <article className="min-w-0 rounded-[36px] bg-white p-5 ring-1 ring-(--lp-line) sm:p-7">
          <SectionHeader eyebrow="Your latest wins" title="Recent activity" action="History" onAction={() => navigate("/student/learninghistory")} />
          <ol className="relative mt-5 space-y-1">
            {LEARNING_ACTIVITY.map(({ icon: Icon, title, course, time, tone }) => (
              <li key={title} className="flex items-center gap-3.5 rounded-2xl px-2 py-3 transition-colors duration-150 hover:bg-(--lp-grey)">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-(--lp-ink)">{title}</p>
                  <p className="truncate text-xs text-(--lp-muted)">{course}</p>
                </div>
                <span className="shrink-0 rounded-full bg-(--lp-grey) px-2.5 py-1 text-[11px] font-medium text-(--lp-muted)">{time}</span>
              </li>
            ))}
          </ol>
        </article>

        <article className="relative isolate min-w-0 overflow-hidden rounded-[36px] bg-(--lp-yellow-soft) p-5 sm:p-7">
          <div className="pointer-events-none absolute -bottom-20 -right-14 -z-10 h-52 w-52 rounded-full bg-(--lp-yellow)/70" aria-hidden="true" />
          <p className="text-xs font-semibold text-(--lp-muted)">Weekly goal</p>
          <h2 className="mt-1 font-display text-2xl font-bold tracking-tight text-(--lp-ink)">4 of 5 study sessions</h2>
          <div className="mt-5 flex gap-1.5" aria-label="80% of weekly goal">
            {[0, 1, 2, 3, 4].map((n) => (
              <span key={n} className={`h-3 flex-1 rounded-full ${n < 4 ? "bg-(--lp-ink)" : "bg-white"}`} />
            ))}
          </div>
          <p className="mt-3 text-sm text-(--lp-muted)">One more focused session will complete your goal.</p>
          <div className="mt-6 rounded-3xl bg-white p-4">
            <p className="text-[11px] font-bold uppercase tracking-wider text-(--lp-blue-deep)">Learning insight</p>
            <p className="mt-1 text-sm leading-6 text-(--lp-muted)">
              You've completed <strong className="text-(--lp-ink)">3 lessons this week</strong> — 75% of your lesson target. Keep your momentum going.
            </p>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-(--lp-grey)"><div className="h-full w-3/4 rounded-full bg-(--lp-blue)" /></div>
          </div>
        </article>
      </section>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}

// ------------------------------------------------------------ local pieces
const TILE_TONES = [
  { card: "bg-(--lp-blue-tint) text-(--lp-ink) ring-1 ring-(--lp-blue-soft)", sub: "text-(--lp-muted)", track: "bg-white", bar: "bg-(--lp-blue)", btn: "bg-(--lp-ink) text-white", chip: "bg-(--lp-blue) text-white" },
  { card: "bg-(--lp-yellow-soft) text-(--lp-ink)", sub: "text-(--lp-muted)", track: "bg-white", bar: "bg-(--lp-ink)", btn: "bg-(--lp-ink) text-white", chip: "bg-(--lp-yellow) text-(--lp-ink)" },
  { card: "bg-(--lp-ink) text-white", sub: "text-white/60", track: "bg-white/15", bar: "bg-(--lp-yellow)", btn: "bg-(--lp-yellow) text-(--lp-ink)", chip: "bg-(--lp-ink) text-white" },
  { card: "bg-(--lp-grey) text-(--lp-ink)", sub: "text-(--lp-muted)", track: "bg-white", bar: "bg-(--lp-blue)", btn: "bg-(--lp-blue) text-white", chip: "bg-white text-(--lp-ink)" },
];

function SectionHeader({ eyebrow, title, action, onAction, dark = false }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className={`text-xs font-semibold ${dark ? "text-white/60" : "text-(--lp-muted)"}`}>{eyebrow}</p>
        <h2 className={`mt-0.5 font-display text-2xl font-bold tracking-tight ${dark ? "text-white" : "text-(--lp-ink)"}`}>{title}</h2>
      </div>
      {action && (
        <button
          type="button"
          onClick={onAction}
          className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold transition-transform duration-200 ease-out hover:-translate-y-0.5 ${dark ? "bg-white/10 text-white" : "bg-(--lp-grey) text-(--lp-ink)"}`}
        >
          {action} <ArrowUpRight className="h-3.5 w-3.5" />
        </button>
      )}
    </div>
  );
}
