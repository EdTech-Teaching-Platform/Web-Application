import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import { SearchIcon } from "../../../components/ui/icons";
import { imageForCategory } from "../../../utils/stockImages";

const COURSES = [
  { id: "c1", title: "Complete Python Bootcamp", educator: "Priya Sharma", description: "Build practical Python skills through projects, core concepts, and guided practice.", category: "Programming", progress: 62, status: "In Progress", accessed: "2 hours ago", enrolled: "Sep 12, 2026", lesson: "Loops & Functions", meta: "12 modules · 48 lessons" },
  { id: "c2", title: "Algebra Foundations", educator: "Rohan Mehta", description: "Strengthen algebra fundamentals with clear explanations and step-by-step problem solving.", category: "Math", progress: 30, status: "In Progress", accessed: "Yesterday", enrolled: "Sep 10, 2026", lesson: "Quadratic Equations", meta: "8 modules · 32 lessons" },
  { id: "c3", title: "IELTS Speaking Mastery", educator: "Anaya Kapoor", description: "Improve fluency, confidence, and speaking strategy with structured IELTS practice.", category: "Languages", progress: 0, status: "Not Started", accessed: "Not accessed", enrolled: "Sep 5, 2026", lesson: "Course introduction", meta: "10 modules · 36 lessons" },
  { id: "c4", title: "Guitar for Beginners", educator: "Vikram Rao", description: "Learn essential chords, rhythm, and practice routines for confident beginner playing.", category: "Music", progress: 100, status: "Completed", accessed: "Sep 1, 2026", enrolled: "Aug 14, 2026", lesson: "Completed", meta: "6 modules · 28 lessons" },
];

const TABS = ["All", "In Progress", "Not Started", "Completed"];

export default function MyLearning() {
  const navigate = useNavigate();
  const [tab, setTab] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("accessed");

  const courses = useMemo(() => {
    const filtered = COURSES.filter((course) => {
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
  }, [query, sort, tab]);

  const inProgressCount = COURSES.filter((course) => course.status === "In Progress").length;
  const completedCount = COURSES.filter((course) => course.status === "Completed").length;
  const averageProgress = Math.round(COURSES.reduce((total, course) => total + course.progress, 0) / COURSES.length);

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
          ["4", "Enrolled courses", "Across your learning library"],
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
              <h2 className="mt-1 font-display text-lg font-bold text-[#17324d]">Make progress in small sessions</h2>
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
            const nextAction = course.status === "Completed" ? "Review course" : course.status === "Not Started" ? "Start with course introduction" : `Continue with ${course.lesson}`;
            return <div key={course.id} className="min-w-0"><ColorBlockCard rotationIndex={index} compact fullWidth image={imageForCategory(course.category)} title={course.title} subtitle={course.educator} description={course.description} progress={course.progress} meta={`${course.meta} · ${course.lesson}`} resumeLabel={course.status === "Completed" ? "View course" : course.status === "Not Started" ? "Start learning" : "Continue"} onClick={() => navigate(destination)} onResume={() => navigate(destination)} /><div className="mt-3 rounded-xl border border-text/10 bg-white p-3"><div className="flex items-center justify-between text-[11px]"><span className="font-semibold text-text/70">Course progress</span><strong className="text-primary">{course.progress}%</strong></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-text/10"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${course.progress}%` }} /></div><div className="mt-2 flex items-center justify-between text-[10px] text-text/45"><span>{course.status === "Completed" ? "Completed" : `${Math.max(1, Math.round(course.progress / 10))} milestones reached`}</span><span>{course.progress === 100 ? "Finished" : `${100 - course.progress}% left`}</span></div><div className="mt-3 border-t border-text/10 pt-3"><p className="text-[10px] font-bold uppercase tracking-wide text-text/40">Next action</p><p className="mt-1 line-clamp-1 text-xs font-semibold text-text">{nextAction}</p><div className="mt-2 flex items-center justify-between text-[10px] text-text/45"><span>Last opened: {course.accessed}</span><button type="button" onClick={() => navigate(destination)} className="font-semibold text-primary">Open →</button></div></div></div></div>;
          })}
        </div>
        <section className="mt-7 rounded-2xl border border-text/10 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-primary/70">COURSE PROGRESS</p>
              <h2 className="mt-1 font-display text-lg font-semibold text-text">Progress across your courses</h2>
            </div>
            <span className="text-xs text-text/50">{courses.length} courses shown</span>
          </div>
          <div className="mt-4 divide-y divide-text/10">
            {courses.map((course) => {
              const player = course.status !== "Completed";
              const destination = player ? `/student/courseplayer?course=${course.id}` : `/student/course/${course.id}`;
              const moduleCount = Number(course.meta.match(/\d+/)?.[0]) || 1;
              const completedModules = course.progress === 100 ? moduleCount : Math.min(moduleCount, Math.max(0, Math.round((moduleCount * course.progress) / 100)));
              const completionText = course.progress === 0 ? "Not started" : course.progress === 100 ? "Course completed" : `${completedModules} of ${moduleCount} modules completed`;
              const action = course.progress === 100 ? "View certificate" : course.progress === 0 ? "Start learning" : "Continue";
              return (
                <div key={course.id} className="group flex flex-col gap-3 px-1 py-4 transition-colors first:pt-3 last:pb-1 hover:rounded-xl hover:bg-[#fffaf7] sm:flex-row sm:items-center">
                  <img src={imageForCategory(course.category, { w: 96, h: 72 })} alt="" className="h-14 w-20 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3 sm:block">
                      <h3 className="truncate text-sm font-semibold text-text">{course.title}</h3>
                      <span className="shrink-0 text-sm font-bold text-primary sm:hidden">{course.progress}%</span>
                    </div>
                    <p className="mt-1 text-xs text-text/50">{course.educator}</p>
                    <p className="mt-2 text-[11px] text-text/50">{completionText}</p>
                  </div>
                  <div className="flex w-full shrink-0 items-center justify-end gap-4 sm:ml-auto sm:w-[190px]">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full" style={{ background: `conic-gradient(${course.progress === 100 ? "#28756f" : "#4a0e0e"} ${course.progress}%, #eee7e3 0)` }}>
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-[11px] font-bold text-primary">{course.progress}%</span>
                    </div>
                    <button type="button" onClick={() => navigate(destination)} className="flex h-8 w-[120px] shrink-0 items-center justify-center rounded-full border border-primary/25 px-2 text-[11px] font-semibold text-primary transition-colors group-hover:bg-primary group-hover:text-white">{action} <span aria-hidden="true">&nbsp;→</span></button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
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
