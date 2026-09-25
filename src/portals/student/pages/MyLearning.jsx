import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import { SearchIcon } from "../../../components/ui/icons";
import { imageForCategory } from "../../../utils/stockImages";
import { getCourseById } from "../../../data/catalogMock";
import { useAuth } from "../../../hooks/useAuth";
import { getStudentEnrolledCourseIds } from "../data/studentLocalState";

const COURSES = [
  { id: "c1", title: "Complete Python Bootcamp", educator: "Priya Sharma", description: "Build practical Python skills through projects, core concepts, and guided practice.", category: "Programming", progress: 62, status: "In Progress", accessed: "2 hours ago", enrolled: "Sep 12, 2026", lesson: "Loops & Functions", meta: "12 modules · 48 lessons" },
  { id: "c2", title: "Algebra Foundations", educator: "Rohan Mehta", description: "Strengthen algebra fundamentals with clear explanations and step-by-step problem solving.", category: "Math", progress: 30, status: "In Progress", accessed: "Yesterday", enrolled: "Sep 10, 2026", lesson: "Quadratic Equations", meta: "8 modules · 32 lessons" },
  { id: "c3", title: "IELTS Speaking Mastery", educator: "Anaya Kapoor", description: "Improve fluency, confidence, and speaking strategy with structured IELTS practice.", category: "Languages", progress: 0, status: "Not Started", accessed: "Not accessed", enrolled: "Sep 5, 2026", lesson: "Course introduction", meta: "10 modules · 36 lessons" },
  { id: "c4", title: "Guitar for Beginners", educator: "Vikram Rao", description: "Learn essential chords, rhythm, and practice routines for confident beginner playing.", category: "Music", progress: 100, status: "Completed", accessed: "Sep 1, 2026", enrolled: "Aug 14, 2026", lesson: "Completed", meta: "6 modules · 28 lessons" },
];

const TABS = ["All", "In Progress", "Not Started", "Completed"];

export default function MyLearning() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("accessed");
  const userId = user?.identifier || user?.id || "guest";

  const enrolledCourses = useMemo(() => {
    const ids = getStudentEnrolledCourseIds(userId);
    const seedById = new Map(COURSES.map((course) => [course.id, course]));
    return ids.map((id) => {
      if (seedById.has(id)) return seedById.get(id);
      const course = getCourseById(id);
      if (!course) return null;
      const lessons = course.curriculum.reduce((total, module) => total + module.lessons.length, 0);
      return {
        id: course.id,
        title: course.title,
        educator: course.subtitle,
        description: course.description,
        category: course.category,
        progress: 0,
        status: "Not Started",
        accessed: "Not accessed",
        enrolled: "Recently",
        lesson: "Course introduction",
        meta: `${course.curriculum.length} modules · ${lessons} lessons`,
      };
    }).filter(Boolean);
  }, [userId]);

  const courses = useMemo(() => {
    const filtered = enrolledCourses.filter((course) => {
      const matchesTab = tab === "All" || course.status === tab;
      const text = `${course.title} ${course.educator} ${course.category}`.toLowerCase();
      return matchesTab && text.includes(query.toLowerCase().trim());
    });
    return [...filtered].sort((a, b) => {
      if (sort === "progress") return b.progress - a.progress;
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "enrolled") return a.enrolled < b.enrolled ? 1 : -1;
      return a.accessed.localeCompare(b.accessed);
    });
  }, [enrolledCourses, query, sort, tab]);

  const inProgressCount = enrolledCourses.filter((course) => course.status === "In Progress").length;
  const completedCount = enrolledCourses.filter((course) => course.status === "Completed").length;
  const averageProgress = enrolledCourses.length ? Math.round(enrolledCourses.reduce((total, course) => total + course.progress, 0) / enrolledCourses.length) : 0;

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="flex flex-col gap-5 border-b border-text/10 pb-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Your library</p>
          <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text">My Learning</h1>
          <p className="mt-2 text-sm text-text/60">Every enrolled course, with the next useful action in reach.</p>
        </div>
        <Button fullWidth={false} onClick={() => navigate("/student/explore")}>Explore more courses</Button>
      </div>
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">{TABS.map((item) => <Chip key={item} active={tab === item} onClick={() => setTab(item)}>{item}</Chip>)}</div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <label className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text/35" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search my courses" className="w-full rounded-full border border-text/10 bg-white py-2.5 pl-9 pr-4 text-sm outline-none focus:border-primary sm:w-64" />
          </label>
          <select value={sort} onChange={(event) => setSort(event.target.value)} className="rounded-full border border-text/10 bg-white px-4 py-2.5 text-sm text-text outline-none focus:border-primary">
            <option value="accessed">Recently accessed</option>
            <option value="enrolled">Recently enrolled</option>
            <option value="progress">Progress</option>
            <option value="az">A–Z</option>
          </select>
        </div>
      </div>
      <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[
          [String(enrolledCourses.length), "Enrolled courses", "Across your learning library"],
          [String(inProgressCount), "In progress", "Ready for your next session"],
          [`${averageProgress}%`, "Average progress", "Across all enrolled courses"],
          [String(completedCount), "Completed", "Certificates and milestones"],
        ].map(([value, label, detail], index) => (
          <div key={label} className={`rounded-2xl border border-text/10 p-4 ${index === 1 ? "bg-[#fbf0ea]" : "bg-white"}`}>
            <strong className="block font-display text-2xl text-[#17324d]">{value}</strong>
            <span className="mt-1 block text-sm font-semibold text-text">{label}</span>
            <span className="mt-1 block text-xs text-text/45">{detail}</span>
          </div>
        ))}
      </section>
      <section className="mt-5 grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-[#eadbd3] bg-[#fffaf7] p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-primary/70">Your learning plan</p>
              <h2 className="mt-1 font-display text-lg font-bold text-[#17324d]">Your weekly study plan</h2>
              <p className="mt-2 max-w-xl text-xs leading-5 text-text/55">You have two active courses waiting for you. Pick one lesson today and keep your weekly rhythm going.</p>
            </div>
            <span className="rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-primary">4 of 5 sessions</span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <div className="flex items-center gap-1.5" aria-label="4 of 5 learning sessions complete">
              {[0, 1, 2, 3, 4].map((session) => (
                <span key={session} className={`h-2.5 w-2.5 rounded-full ${session < 4 ? "bg-primary" : "border border-primary/25 bg-white"}`} />
              ))}
            </div>
            <span className="text-[11px] font-semibold text-text/50">1 session left this week</span>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full bg-white px-3 py-1.5 text-xs text-text/60">Next focus: Python · Loops & Functions</span>
            <span className="rounded-full bg-white px-3 py-1.5 text-xs text-text/60">Estimated time: 25 min</span>
          </div>
          <Button fullWidth={false} className="mt-4" onClick={() => navigate("/student/courseplayer?course=c1")}>Continue Python course</Button>
        </div>
        <div className="rounded-2xl border border-[#d9e9e5] bg-[#eef7f4] p-5">
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#28756f]">Learning reminder</p>
          <h2 className="mt-1 font-display text-lg font-bold text-[#17324d]">Your next milestone</h2>
          <p className="mt-2 text-xs leading-5 text-text/60">Complete 3 more lessons in Python to unlock the next module checkpoint.</p>
          <button type="button" onClick={() => navigate("/student/courseplayer?course=c1")} className="mt-4 rounded-full bg-[#28756f] px-4 py-2.5 text-xs font-semibold text-white">Open course →</button>
        </div>
      </section>
      {courses.length ? (
        <>
        <div className="mt-7 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
          {courses.map((course, index) => {
            const player = course.status === "Not Started" || course.status === "In Progress";
            const destination = player ? `/student/courseplayer?course=${course.id}` : `/student/course/${course.id}`;
            return <div key={course.id} className="min-w-0"><ColorBlockCard rotationIndex={index} compact fullWidth image={imageForCategory(course.category)} title={course.title} subtitle={course.educator} description={course.description} progressCircle={course.progress} meta={`${course.meta} · ${course.lesson}`} resumeLabel={course.status === "Completed" ? "View course" : course.status === "Not Started" ? "Start learning" : "Continue"} onClick={() => navigate(destination)} onResume={() => navigate(destination)} /></div>;
          })}
        </div>
        </>
      ) : (
        <div className="mt-8 rounded-2xl border border-dashed border-text/15 bg-white px-6 py-16 text-center">
          <h2 className="font-display text-lg font-semibold text-text">No courses match this view</h2>
          <p className="mt-2 text-sm text-text/55">Try another filter or explore the catalog for your next course.</p>
          <Button fullWidth={false} className="mt-5" onClick={() => navigate("/student/explore")}>Explore Courses</Button>
        </div>
      )}
    </div>
  );
}
