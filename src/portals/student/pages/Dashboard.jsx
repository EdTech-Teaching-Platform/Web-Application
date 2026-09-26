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
import { useNavigate } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import ListRow from "../../../components/ui/ListRow";
import Button from "../../../components/ui/Button";
import StreakRow from "../components/StreakRow";
import { AwardIcon, CheckIcon, ClockIcon, FileTextIcon, FlameIcon, PlayIcon } from "../../../components/ui/icons";
import { imageForCategory } from "../../../utils/stockImages";
import { useAuth } from "../../../hooks/useAuth";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import ToastStack from "../../../components/ui/Toast";
import { RECOMMENDED } from "../data/recommendedMock";
import { COURSES } from "../../../data/catalogMock";
import { isStudentCourseEnrolled } from "../data/studentLocalState";
import MyTestSeriesSection from "../components/MyTestSeriesSection";
import { formatClassStart, getLiveCourseSchedule } from "../data/liveCourseSchedule";

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
  { icon: CheckIcon, title: "Completed “Loops & Functions”", course: "Complete Python Bootcamp", time: "2 hours ago", tone: "bg-[#e7f1ef] text-[#28756f]" },
  { icon: CheckIcon, title: "Finished “Python Variables”", course: "Complete Python Bootcamp", time: "Yesterday", tone: "bg-[#fff0eb] text-primary" },
  { icon: FileTextIcon, title: "Submitted project assignment", course: "Algebra Foundations", time: "2 days ago", tone: "bg-[#fff8df] text-[#9b7510]" },
  { icon: AwardIcon, title: "Earned a course certificate", course: "Guitar for Beginners", time: "4 days ago", tone: "bg-[#f1eefb] text-[#6a54a3]" },
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

  const firstName = user?.name?.split(" ")[0] ?? "there";
  const overallProgress = 68;
  const streakDays = 7;

  // Whichever in-progress course has the most recent activity — same
  // source array the "Continue Learning" cards below render from, so the
  // hero's course/lesson and its button target always match a real card,
  // never a guess or a duplicate/conflicting summary.
  const currentCourse = [...IN_PROGRESS_COURSES].sort(
    (a, b) => new Date(b.updatedAt) - new Date(a.updatedAt)
  )[0];

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 lg:px-10">
      <section className="mb-6 flex flex-col justify-between gap-6 rounded-2xl border border-text/10 bg-white p-5 shadow-sm sm:p-6 lg:flex-row lg:items-center">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70">Student home</p>
          <h1 className="mt-2 font-display text-2xl font-bold tracking-tight text-[#17324d] sm:text-3xl">
            Welcome back, {firstName} <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-2 text-sm text-text/55">You're on a 7-day streak — keep it going!</p>
          {currentCourse && (
            <p className="mt-3 text-sm text-text/70">
              Continue: <strong>{currentCourse.title}</strong>
              <span className="text-text/45"> · Lesson: {currentCourse.currentLesson}</span>
            </p>
          )}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <Button
              fullWidth={false}
              disabled={!currentCourse}
              onClick={() => currentCourse && navigate(`/student/courseplayer?course=${currentCourse.id}`)}
              className="rounded-full px-5"
            >
              ◉&nbsp; Continue Learning
            </Button>
            <StreakRow completedDays={[0, 1, 2, 3, 4, 5]} />
          </div>
        </div>
        <div className="flex items-start gap-3">
          <span
            className={`flex items-center gap-1.5 rounded-full border px-4 py-2 text-xs font-semibold ${
              streakDays > 0
                ? "border-[#f2994a]/25 bg-[#f2994a]/10 text-[#e7743a]"
                : "border-text/10 bg-white text-text/40"
            }`}
          >
            <FlameIcon /> {streakDays} <span className="font-normal">Day streak</span>
          </span>
        </div>
      </section>

      <section className="mb-6 rounded-2xl border border-[#eadbd3] bg-[#fbf0ea] p-5 sm:p-6">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="font-display text-lg font-bold text-[#17324d]">Continue Learning</h2>
            <p className="mt-1 text-xs text-text/50">Pick up where you left off</p>
          </div>
          <button type="button" onClick={() => navigate("/student/my-learning")} className="text-xs font-semibold text-primary">View all →</button>
        </div>
        <div className="flex gap-2.5 overflow-x-auto pb-2">
          {IN_PROGRESS_COURSES.map((c, i) => (
            <ColorBlockCard key={c.id} rotationIndex={i} size="sm" image={imageForCategory(c.category)} badge={c.id === currentCourse?.id ? "In Progress" : undefined} title={c.title} subtitle={c.subtitle} meta={`${c.category} · Self-paced`} progress={c.progress} compact onClick={() => navigate(`/student/courseplayer?course=${c.id}`)} onResume={() => navigate(`/student/courseplayer?course=${c.id}`)} />
          ))}
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.45fr_1fr]">
        <section className="rounded-2xl border border-text/10 bg-white p-4 shadow-[0_8px_24px_rgba(23,50,77,0.04)] sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#17324d]">Upcoming Live Classes</h2>
            <button type="button" onClick={() => navigate("/student/managebooking")} className="text-xs font-semibold text-primary">View all →</button>
          </div>
          <div className="space-y-2">
            {LIVE_CLASSES.concat({ id: "l3", courseId: "c3", educator: "Anaya Kapoor", subject: "IELTS — Speaking Practice" }).map((s) => {
              const schedule = getLiveCourseSchedule(s.courseId);
              const liveNow = schedule?.status === "live";
              return <ListRow key={s.id} leading={<div className="w-16 rounded-xl bg-[#f3f6fb] px-2 py-2 text-center text-[10px] font-semibold text-text/55"><span className="block text-primary">{schedule?.startAt.toLocaleDateString("en-IN", { weekday: "short" })}</span><span>{schedule?.startAt.getDate()}</span></div>} title={s.subject} subtitle={`${s.educator} · ${schedule ? formatClassStart(schedule.startAt) : "Schedule unavailable"}`} trailing={<Button fullWidth={false} className="rounded-full px-4 py-2 text-xs" onClick={() => navigate(liveNow ? `/student/liveclassjoin?session=${schedule.id}&join=1` : `/student/live-course?course=${s.courseId}`)}>{liveNow ? "Join Live Class" : "View Schedule"}</Button>} />;
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-text/10 bg-white p-4 shadow-[0_8px_24px_rgba(23,50,77,0.04)] sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-base font-bold text-[#17324d]">Your Progress</h2>
            <button type="button" onClick={() => navigate("/student/learninghistory")} className="text-xs font-semibold text-primary">View details →</button>
          </div>
          <div className="flex items-center gap-5">
            <div className="flex h-28 w-28 shrink-0 items-center justify-center rounded-full" style={{ background: `conic-gradient(#168bd0 ${overallProgress}%, #e6edf2 0)` }}>
              <div className="flex h-20 w-20 flex-col items-center justify-center rounded-full bg-white"><strong className="text-2xl text-[#17324d]">{overallProgress}%</strong><span className="text-[9px] text-text/45">Overall Progress</span></div>
            </div>
            <div className="min-w-0 flex-1 space-y-3 text-xs">
              {[["Courses", "3 / 5", "#df5965"], ["Assessments", "2 / 4", "#74b89d"], ["Assignments", "1 / 3", "#e6b84c"], ["Live Classes", "4 / 8", "#51a9c7"]].map(([label, value, color]) => <div key={label} className="flex items-center justify-between gap-3"><span className="flex items-center gap-2 text-text/65"><i className="h-2 w-2 rounded-full" style={{ backgroundColor: color }} />{label}</span><strong className="text-text/70">{value}</strong></div>)}
            </div>
          </div>
        </section>
      </div>

      <section className="mt-6 rounded-2xl border border-text/10 bg-white p-4 shadow-[0_8px_24px_rgba(23,50,77,0.04)] sm:p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-base font-bold text-[#17324d]">Recommended for You</h2>
          <button type="button" onClick={() => navigate("/student/recommended")} className="text-xs font-semibold text-primary">View all →</button>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {RECOMMENDED.map((c, i) => {
            const enrolled = COURSES.find((course) => course.id === c.id)?.enrolled === true || isStudentCourseEnrolled(c.id, user);
            return <ColorBlockCard key={c.id} rotationIndex={i} image={imageForCategory(c.category)} title={c.title} subtitle={c.subtitle} description={c.description} price={c.price} originalPrice={c.originalPrice} rating={c.rating} actionLabel={enrolled ? "Enrolled" : "Enroll"} actionDisabled={enrolled} onAction={() => navigate(enrolled ? `/student/courseplayer?course=${c.id}` : `/student/course/${c.id}`)} compact fullWidth showWishlist wishlisted={wishlist.isWishlisted(c.id)} onToggleWishlist={() => { const nowSaved = !wishlist.isWishlisted(c.id); wishlist.toggle(c); showToast(nowSaved ? "Added to wishlist" : "Removed from wishlist"); }} onClick={() => navigate(`/student/course/${c.id}`)} />;
          })}
        </div>
      </section>

      <MyTestSeriesSection variant="compact" />

      <section className="mt-6 rounded-2xl border border-text/10 bg-white p-5 shadow-[0_8px_24px_rgba(23,50,77,0.04)] sm:p-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary/70">Stay on track</p>
            <h2 className="mt-1 font-display text-xl font-bold text-[#17324d]">Your Learning Activity</h2>
            <p className="mt-1 text-xs text-text/50">See what you completed and what deserves your attention next.</p>
          </div>
          <button type="button" onClick={() => navigate("/student/learninghistory")} className="text-xs font-semibold text-primary">View learning history →</button>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-[1.5fr_0.85fr]">
          <article className="overflow-hidden rounded-2xl border border-[#eadbd3] bg-[#fbf0ea]">
            <div className="flex items-center justify-between border-b border-[#eadbd3] px-5 py-4">
              <div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/70">Continue learning</p><h3 className="mt-1 font-display text-base font-bold text-[#17324d]">Pick up where you left off</h3></div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-primary">{currentCourse.progress}% complete</span>
            </div>
            <div className="grid gap-4 p-5 sm:grid-cols-[150px_1fr] sm:items-center">
              <img src={imageForCategory(currentCourse.category)} alt="" className="h-28 w-full rounded-xl object-cover sm:h-32" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-primary">{currentCourse.subtitle}</p>
                <h3 className="mt-1 font-display text-lg font-bold text-[#17324d]">{currentCourse.title}</h3>
                <p className="mt-2 text-xs text-text/60">Current lesson · {currentCourse.currentLesson}</p>
                <div className="mt-4 flex items-center gap-3"><div className="h-2 flex-1 overflow-hidden rounded-full bg-white"><div className="h-full rounded-full bg-primary" style={{ width: `${currentCourse.progress}%` }} /></div><span className="text-xs font-bold text-primary">{currentCourse.progress}%</span></div>
                <button type="button" onClick={() => navigate(`/student/courseplayer?course=${currentCourse.id}`)} className="mt-4 inline-flex items-center gap-2 rounded-full bg-primary px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-primary/90">Continue Learning <span aria-hidden="true">→</span></button>
              </div>
            </div>
          </article>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <article className="rounded-2xl border border-text/10 bg-white p-5">
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/45">Learning streak</p><h3 className="mt-1 font-display text-base font-bold text-[#17324d]"><FlameIcon className="mr-1 inline-block text-[#e7743a]" />5 day streak</h3></div><span className="text-xs font-semibold text-text/45">Keep it going!</span></div>
              <div className="mt-4 grid grid-cols-7 gap-1.5 text-center text-[10px] text-text/45">
                {["M", "T", "W", "T", "F", "S", "S"].map((day, index) => <div key={`${day}-${index}`}><span className="block">{day}</span><span className={`mx-auto mt-2 flex h-7 w-7 items-center justify-center rounded-lg ${index < 5 ? "bg-primary text-white" : "bg-bg text-text/35"}`}>{index < 5 ? "✓" : "·"}</span></div>)}
              </div>
            </article>
            <article className="rounded-2xl border border-[#d9e9e5] bg-[#eef7f4] p-5">
              <div className="flex items-center justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#28756f]">Weekly goal</p><h3 className="mt-1 font-display text-base font-bold text-[#17324d]">4 of 5 study sessions</h3></div><span className="text-lg font-bold text-[#28756f]">80%</span></div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-white"><div className="h-full w-4/5 rounded-full bg-[#28756f]" /></div>
              <p className="mt-2 text-xs text-text/55">One more focused session will complete your goal.</p>
            </article>
          </div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-[1.5fr_0.85fr]">
          <article className="rounded-2xl border border-text/10 bg-white">
            <div className="flex items-center justify-between border-b border-text/10 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/45">Recent activity</p><h3 className="mt-1 font-display text-base font-bold text-[#17324d]">Your latest wins</h3></div><button type="button" onClick={() => navigate("/student/learninghistory")} className="text-xs font-semibold text-primary">View all →</button></div>
            <div className="divide-y divide-text/10">
              {LEARNING_ACTIVITY.map(({ icon: Icon, title, course, time, tone }) => <div key={title} className="flex items-center gap-3 px-5 py-3.5"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${tone}`}><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-text">{title}</p><p className="mt-0.5 truncate text-xs text-text/50">{course}</p></div><span className="shrink-0 text-[11px] text-text/40">{time}</span></div>)}
            </div>
          </article>

          <article className="rounded-2xl border border-text/10 bg-white">
            <div className="border-b border-text/10 px-5 py-4"><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/45">Learning insight</p><h3 className="mt-1 font-display text-base font-bold text-[#17324d]">You’re close to your goal</h3></div>
            <div className="p-5"><p className="text-sm leading-6 text-text/65">You’ve completed <strong className="text-text">3 lessons this week</strong>. Keep your momentum with one more focused session.</p><div className="mt-4 h-2 overflow-hidden rounded-full bg-bg"><div className="h-full w-3/4 rounded-full bg-primary" /></div><p className="mt-2 text-xs font-semibold text-primary">75% of your weekly lesson target</p></div>
          </article>
        </div>

        <article className="mt-4 rounded-2xl border border-text/10 bg-white">
          <div className="flex items-center justify-between border-b border-text/10 px-5 py-4"><div><p className="text-[10px] font-bold uppercase tracking-[0.16em] text-text/45">Coming up</p><h3 className="mt-1 font-display text-base font-bold text-[#17324d]">Next learning tasks</h3></div><button type="button" onClick={() => navigate("/student/calendar")} className="text-xs font-semibold text-primary">Open calendar →</button></div>
          <div className="grid divide-y divide-text/10 sm:grid-cols-3 sm:divide-x sm:divide-y-0">
            {COMING_UP.map(({ icon: Icon, type, title, course, when, action, href, courseId }) => {
              const schedule = type === "Live class" ? getLiveCourseSchedule(courseId) : null;
              const liveNow = schedule?.status === "live";
              const destination = schedule
                ? liveNow ? `/student/liveclassjoin?session=${schedule.id}&join=1` : `/student/live-course?course=${courseId}`
                : href;
              return <div key={title} className="flex items-center gap-3 px-5 py-4"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#fff0eb] text-primary"><Icon className="h-4 w-4" /></span><div className="min-w-0 flex-1"><p className="text-[10px] font-bold uppercase tracking-wide text-primary/65">{type}</p><p className="mt-1 truncate text-sm font-semibold text-text">{title}</p><p className="mt-0.5 truncate text-xs text-text/50">{course}</p><p className="mt-1 text-[11px] text-text/45">{schedule ? formatClassStart(schedule.startAt) : when}</p></div><button type="button" onClick={() => navigate(destination)} className="shrink-0 text-xs font-semibold text-primary">{schedule && liveNow ? "Join Live Class" : schedule ? "View Schedule" : action} →</button></div>;
            })}
          </div>
        </article>
      </section>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
