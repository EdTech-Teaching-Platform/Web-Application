import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ColorBlockCard from "../../components/ui/ColorBlockCard";
import Chip from "../../components/ui/Chip";
import Button from "../../components/ui/Button";
import { ChevronDownIcon, SearchIcon } from "../../components/ui/icons";
import { COURSE_CATEGORIES } from "../../utils/constants";
import { useAuth } from "../../hooks/useAuth";
import { useWishlist } from "../../hooks/useWishlist";
import { useToast } from "../../hooks/useToast";
import ToastStack from "../../components/ui/Toast";
import { COURSES as CATALOG_COURSES } from "../../data/catalogMock";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const FILTER_GROUPS = [
  { key: "type", label: "Course type", options: ["Self-paced", "Live"] },
  { key: "duration", label: "Duration", options: ["Under 2 hours", "2–6 hours", "6+ hours"] },
  { key: "price", label: "Price", options: ["Free", "Under ₹1,000", "₹1,000+"] },
  { key: "rating", label: "Rating", options: ["4.5 & up", "4.0 & up"] },
];
const SORT_OPTIONS = [
  ["popular", "Recommended"],
  ["rating", "Highest Rated"],
  ["newest", "Newest"],
  ["price-low", "Price: Low to High"],
  ["price-high", "Price: High to Low"],
];
const ALL_COURSES = CATALOG_COURSES.filter((course) => course.status === "active");
const RECORDED_PROGRESS = {
  c2: 38,
  c4: 62,
};

function RecordedCourseProgress({ value }) {
  return (
    <div
      className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-full"
      style={{ background: `conic-gradient(#4a0e0e ${value * 3.6}deg, rgba(74, 14, 14, 0.12) 0deg)` }}
      aria-label={`${value}% complete`}
    >
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white">
        <span className="text-[11px] font-bold text-primary">{value}%</span>
      </div>
    </div>
  );
}

function CheckGroup({ label, options, selected, onToggle }) {
  return (
    <details open className="border-b border-text/10 pb-4 last:border-0">
      <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-sm font-semibold text-text">
        {label}
        <ChevronDownIcon className="h-4 w-4 text-text/40" />
      </summary>
      <div className="space-y-2 pt-2">
        {options.map((option) => (
          <label key={option} className="flex cursor-pointer items-center gap-2 text-sm text-text/65">
            <input type="checkbox" checked={selected.includes(option)} onChange={() => onToggle(option)} className="accent-primary" />
            {option}
          </label>
        ))}
      </div>
    </details>
  );
}

export default function ExplorePage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();
  const query = params.get("q") || "";
  const categories = params.getAll("category");
  const filters = params.getAll("filter");
  const level = params.get("level") || "";
  const sort = params.get("sort") || "popular";
  const mode = params.get("mode") === "live" ? "live" : "recorded";
  const educator = params.get("educator") || "";

  function update(mutator) {
    const next = new URLSearchParams(params);
    mutator(next);
    setParams(next);
  }

  function toggleMulti(key, value) {
    update((next) => {
      const current = next.getAll(key);
      next.delete(key);
      const values = current.includes(value) ? current.filter((item) => item !== value) : [...current, value];
      values.forEach((item) => next.append(key, item));
    });
  }

  const results = useMemo(() => {
    const filtered = ALL_COURSES.filter((course) => {
      const haystack = `${course.title} ${course.subtitle} ${course.category}`.toLowerCase();
      const hours = Number.parseFloat(course.duration) || 0;
      return (
        haystack.includes(query.toLowerCase()) &&
        (mode === "live" ? course.courseType === "Live" : course.courseType !== "Live") &&
        (!educator || course.educatorId === educator) &&
        (!categories.length || categories.includes(course.category)) &&
        (!level || course.level === level) &&
        (!filters.includes("4.5 & up") || course.rating >= 4.5) &&
        (!filters.includes("4.0 & up") || course.rating >= 4) &&
        (!filters.includes("Free") || course.price === 0) &&
        (!filters.includes("Under ₹1,000") || course.price < 1000) &&
        (!filters.includes("₹1,000+") || course.price >= 1000) &&
        (!filters.includes("Live") || course.courseType === "Live") &&
        (!filters.includes("Self-paced") || course.courseType !== "Live") &&
        (!filters.includes("Under 2 hours") || hours < 2) &&
        (!filters.includes("2–6 hours") || (hours >= 2 && hours <= 6)) &&
        (!filters.includes("6+ hours") || hours > 6)
      );
    });
    return [...filtered].sort((a, b) => {
      if (sort === "rating") return b.rating - a.rating;
      if (sort === "price-low") return a.price - b.price;
      if (sort === "price-high") return b.price - a.price;
      return 0;
    });
  }, [categories, educator, filters, level, mode, query, sort]);

  function openCourse(course) {
    navigate(`/course/${course.id}`);
  }

  function toggleWishlist(course) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(`/course/${course.id}`)}`);
      return;
    }

    const saved = !wishlist.isWishlisted(course.id);
    wishlist.toggle(course);
    showToast(saved ? "Added to wishlist" : "Removed from wishlist");
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <div className="mb-7">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary">Discovery</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Choose how you want to learn</h1>
        <p className="mt-2 max-w-2xl text-sm text-text/60">Explore recorded courses and learn from educators you trust at your own pace.</p>
      </div>
      <div className="mb-6">
        <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 rounded-2xl border border-[#e7cfc2] bg-[#fbf0ea] px-5 py-3.5 shadow-sm">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-text/50">Flexible learning</span>
              <strong className="font-display text-lg">Recorded Classes</strong>
            </div>
            <span className="mt-1 block text-sm text-text/65">Watch recorded lessons at your pace, revisit modules and continue where you stopped.</span>
          </div>
          <span className="shrink-0 text-xs font-bold text-primary">Browsing recorded classes →</span>
        </div>
      </div>
      {mode === "live" && <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-primary/[0.06] px-5 py-4"><div><p className="font-semibold text-text">Looking for a class happening now?</p><p className="mt-1 text-sm text-text/60">See all available, upcoming and completed live sessions.</p></div><Button fullWidth={false} onClick={() => navigate("/student/live-classes")}>View all live classes</Button></div>}
      {mode === "recorded" && <section className="mb-6 rounded-2xl border border-[#eadbd3] bg-[#fbf0ea] p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Your learning</p><h2 className="mt-1 font-display text-xl font-bold text-text">Continue your recorded courses</h2><p className="mt-1 text-sm text-text/60">Pick up exactly where you left off.</p></div><Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/my-learning")}>Open My Learning</Button></div><div className="mt-4 grid gap-3 sm:grid-cols-2">{ALL_COURSES.filter((course) => course.enrolled && course.courseType !== "Live").length ? ALL_COURSES.filter((course) => course.enrolled && course.courseType !== "Live").map((course) => { const progress = RECORDED_PROGRESS[course.id] ?? 0; return <button type="button" key={course.id} onClick={() => openCourse(course)} className="flex items-center gap-3 rounded-xl bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"><RecordedCourseProgress value={progress} /><span className="min-w-0"><p className="truncate text-sm font-semibold text-text">{course.title}</p><p className="mt-1 text-xs text-text/50">Continue learning · {course.subtitle}</p><p className="mt-1 text-[11px] font-medium text-primary/70">{progress}% complete</p></span></button>; }) : <p className="text-sm text-text/60">You have no recorded course in progress yet. Explore below to enroll.</p>}</div></section>}
      <div className="relative">
        <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text/35" />
        <input value={query} onChange={(event) => update((next) => next.set("q", event.target.value))} placeholder="Search courses, subjects, educators..." className="w-full rounded-2xl border border-text/10 bg-white py-4 pl-12 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10" />
      </div>
      <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
        {COURSE_CATEGORIES.map((category) => <Chip key={category} active={categories.includes(category)} onClick={() => toggleMulti("category", category)}>{category}</Chip>)}
      </div>
      <div className="mt-8 grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
        <aside className="h-fit rounded-2xl border border-text/10 bg-white p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto">
          <div className="flex items-center justify-between border-b border-text/10 pb-3">
            <h2 className="font-display font-semibold text-text">Filters</h2>
            <button type="button" onClick={() => setParams({})} className="text-xs font-semibold text-primary hover:underline">Clear all</button>
          </div>
          <div className="mt-3 space-y-3">
            <CheckGroup label="Level" options={LEVELS} selected={level ? [level] : []} onToggle={(value) => update((next) => next.set("level", level === value ? "" : value))} />
            {FILTER_GROUPS.map((group) => <CheckGroup key={group.key} label={group.label} options={group.options} selected={filters} onToggle={(value) => toggleMulti("filter", value)} />)}
          </div>
        </aside>
        <section className="min-w-0">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-text/60"><strong className="text-text">{results.length}</strong> courses</p>
            <select value={sort} onChange={(event) => update((next) => next.set("sort", event.target.value))} className="rounded-full border border-text/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary">
              {SORT_OPTIONS.map(([value, label]) => <option key={value} value={value}>Sort by: {label}</option>)}
            </select>
          </div>
          {results.length ? (
            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
              {results.map((course, index) => <ColorBlockCard key={course.id} rotationIndex={index} compact fullWidth image={course.image} title={course.title} subtitle={course.subtitle} meta={`${course.courseType === "Live" ? "Live" : "Recorded"} · ${course.level} · ${course.duration}`} description={course.description} price={course.price} originalPrice={course.originalPrice} rating={course.rating} reviewCount={course.reviewCount} actionLabel={course.enrolled ? undefined : "Enroll"} onAction={() => user ? navigate(`/student/checkout?course=${course.id}`) : navigate(`/login?redirect=${encodeURIComponent(`/student/checkout?course=${course.id}`)}`)} showWishlist wishlisted={wishlist.isWishlisted(course.id)} onToggleWishlist={() => toggleWishlist(course)} onClick={() => openCourse(course)} />)}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-text/15 bg-white px-6 py-16 text-center"><h2 className="font-display text-lg font-semibold text-text">No courses match these filters</h2><p className="mt-2 text-sm text-text/55">Try a broader search or clear the filters.</p><Button fullWidth={false} className="mt-5" onClick={() => setParams({})}>Clear filters</Button></div>
          )}
        </section>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
