// Explore — discovery/marketplace homepage. Redesigned per the "Explore
// should feel like a real LMS marketplace" spec: this page is ONLY about
// finding something new to learn. It must never show the student's own
// enrolled/in-progress courses (that content lives in My Learning) — see
// the content-separation rule below each section that filters courses.
//
// Shared between the public pre-login route ("/explore", src/public/
// routes.jsx) and the logged-in student portal ("/student/explore",
// src/portals/student/routes.jsx) — same file, same marketplace content
// either way; only the wishlist/enroll actions branch on `user`.
import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ColorBlockCard from "../../components/ui/ColorBlockCard";
import Chip from "../../components/ui/Chip";
import Button from "../../components/ui/Button";
import SectionHeading from "../../components/common/SectionHeading";
import CourseCarousel from "../../components/common/CourseCarousel";
import { ChevronDownIcon, SearchIcon, TargetIcon, BriefcaseIcon, FileTextIcon, HeartIcon } from "../../components/ui/icons";
import { COURSE_CATEGORIES, CATEGORY_META } from "../../utils/constants";
import { useAuth } from "../../hooks/useAuth";
import { useWishlist } from "../../hooks/useWishlist";
import { useToast } from "../../hooks/useToast";
import { useScrollToHash } from "../../hooks/useScrollToHash";
import ToastStack from "../../components/ui/Toast";
import { COURSES as CATALOG_COURSES, EDUCATORS } from "../../data/catalogMock";
import { imageForPerson } from "../../utils/stockImages";

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
// Everything a signed-in student is already enrolled in — kept OUT of the
// curated discovery rows below (Popular/Recommended/New & Trending) per
// the content-separation rule: a course already in My Learning shouldn't
// also be pitched back to the student as something to discover.
const DISCOVERABLE_COURSES = ALL_COURSES.filter((course) => !course.enrolled);

// Quick topic shortcuts above the search bar — broader than the formal
// COURSE_CATEGORIES taxonomy used by the Categories section/filters below
// (that 8-value taxonomy is shared with Onboarding and the filter sidebar
// and shouldn't drift into a second copy). These act as search shortcuts:
// clicking one runs it through the same search box below, so a topic the
// catalog doesn't have yet (there's no dedicated "Cybersecurity" category
// in the mock catalog today) honestly returns "no courses match" rather
// than silently mapping to an unrelated category.
const QUICK_TOPICS = [
  "Programming",
  "AI & Machine Learning",
  "Data Science",
  "Design",
  "Business",
  "Languages",
  "Cybersecurity",
  "Personal Development",
];

const GOALS = [
  { icon: TargetIcon, title: "Start a new skill", description: "Beginner-friendly courses to get moving on something brand new.", sort: "newest" },
  { icon: BriefcaseIcon, title: "Build career-ready skills", description: "In-demand, job-focused tracks in tech, design and business.", sort: "popular" },
  { icon: FileTextIcon, title: "Prepare for exams", description: "Structured practice for board, competitive and language exams.", sort: "rating" },
  { icon: HeartIcon, title: "Learn for personal interest", description: "Music, languages, wellness and creative courses to enjoy.", sort: "popular" },
];

const TRENDING_SKILLS = [
  "Python",
  "Artificial Intelligence",
  "Data Analytics",
  "Web Development",
  "Cybersecurity",
  "Cloud Computing",
  "UI/UX Design",
  "Communication",
];

// Presentational only — there's no "Learning Path" entity in the catalog
// data yet, so "Explore Path" filters the browse grid by the closest
// matching category instead of linking to a path detail page that
// doesn't exist. Flagging rather than inventing a fake destination.
const LEARNING_PATHS = [
  { title: "Full Stack Developer", courses: 6, hours: "48h", skills: ["JavaScript", "React", "Node.js", "SQL"], category: "Programming" },
  { title: "Data Analyst", courses: 5, hours: "34h", skills: ["Python", "SQL", "Statistics"], category: "Math" },
  { title: "AI & ML Foundations", courses: 4, hours: "30h", skills: ["Python", "Machine Learning"], category: "Programming" },
  { title: "UI/UX Designer", courses: 4, hours: "26h", skills: ["UI Design", "Prototyping", "Research"], category: "Design" },
];

const POPULAR_EDUCATOR_IDS = ["ed4", "ed6", "ed7", "ed8"];

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
  useScrollToHash();
  const query = params.get("q") || "";
  const categories = params.getAll("category");
  const filters = params.getAll("filter");
  const level = params.get("level") || "";
  const sort = params.get("sort") || "popular";
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

  function runQuickSearch(term) {
    update((next) => {
      next.set("q", term);
    });
    document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exploreByCategory(category) {
    update((next) => {
      next.delete("category");
      next.append("category", category);
    });
    document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function exploreByGoal(goalSort) {
    update((next) => next.set("sort", goalSort));
    document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const results = useMemo(() => {
    const filtered = ALL_COURSES.filter((course) => {
      const haystack = `${course.title} ${course.subtitle} ${course.category}`.toLowerCase();
      const hours = Number.parseFloat(course.duration) || 0;
      return (
        haystack.includes(query.toLowerCase()) &&
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
  }, [categories, educator, filters, level, query, sort]);

  // Curated rows — each pulls a different, mostly non-overlapping slice of
  // the discoverable (not-yet-enrolled) catalog so Popular/Recommended/New
  // don't just repeat the same handful of courses on one page.
  const popularCourses = useMemo(
    () => [...DISCOVERABLE_COURSES].sort((a, b) => b.enrolledCount - a.enrolledCount).slice(0, 6),
    []
  );
  const popularIds = useMemo(() => new Set(popularCourses.map((c) => c.id)), [popularCourses]);
  const recommendedCourses = useMemo(
    () => DISCOVERABLE_COURSES.filter((c) => !popularIds.has(c.id) && c.rating >= 4.5).slice(0, 4),
    [popularIds]
  );
  const recommendedIds = useMemo(() => new Set(recommendedCourses.map((c) => c.id)), [recommendedCourses]);
  const newAndTrending = useMemo(
    () =>
      DISCOVERABLE_COURSES.filter((c) => !popularIds.has(c.id) && !recommendedIds.has(c.id))
        .slice(-8)
        .reverse()
        .slice(0, 6),
    [popularIds, recommendedIds]
  );

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
      {/* A. Hero / discovery */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Discovery</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">
          What do you want to learn today?
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text/60">
          Explore courses, skills, live classes and learning paths designed to help you reach your goals.
        </p>
        <div className="relative mt-6">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text/35" />
          <input
            value={query}
            onChange={(event) => update((next) => next.set("q", event.target.value))}
            onKeyDown={(event) => event.key === "Enter" && document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" })}
            placeholder="Search courses, skills, educators..."
            className="w-full rounded-2xl border border-text/10 bg-white py-4 pl-12 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {QUICK_TOPICS.map((topic) => (
            <Chip key={topic} active={query === topic} onClick={() => runQuickSearch(topic)}>
              {topic}
            </Chip>
          ))}
        </div>
      </div>

      {/* B. Explore by goal */}
      <section className="mt-12">
        <SectionHeading eyebrow="Discovery" title="Explore by goal" subtitle="Not sure where to start? Pick what you're trying to do." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GOALS.map((goal) => {
            const Icon = goal.icon;
            return (
              <button
                key={goal.title}
                type="button"
                onClick={() => exploreByGoal(goal.sort)}
                className="group flex flex-col items-start gap-3 rounded-2xl border border-text/10 bg-white p-4 text-left transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/30"
              >
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-5 w-5" />
                </span>
                <span>
                  <span className="block font-display text-sm font-semibold text-text group-hover:text-primary">{goal.title}</span>
                  <span className="mt-1 block text-xs leading-5 text-text/55">{goal.description}</span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {/* C. Popular courses */}
      <section className="mt-12">
        <SectionHeading id="popular" eyebrow="Trending now" title="Popular courses" subtitle="Learn what students are exploring right now." viewAllHref="/student/explore?sort=popular#browse" />
        <CourseCarousel
          courses={popularCourses}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onCourseClick={openCourse}
          onAction={openCourse}
          metaFor={(c) => `${c.courseType === "Live" ? "Live" : "Self-paced"} · ${c.level} · ${c.duration}`}
        />
      </section>

      {/* D. Trending skills */}
      <section className="mt-12">
        <SectionHeading title="Trending skills" subtitle="Jump straight to what learners are searching for." />
        <div className="flex flex-wrap gap-2">
          {TRENDING_SKILLS.map((skill) => (
            <Chip key={skill} active={query === skill} onClick={() => runQuickSearch(skill)}>
              {skill}
            </Chip>
          ))}
        </div>
      </section>

      {/* E. Recommended for you */}
      <section className="mt-12">
        <SectionHeading
          id="recommended"
          eyebrow="For you"
          title="Recommended for you"
          subtitle="Based on your interests and learning goals."
          viewAllHref="/student/explore?sort=rating#browse"
        />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {recommendedCourses.map((course, index) => (
            <ColorBlockCard
              key={course.id}
              rotationIndex={index}
              fullWidth
              image={course.image}
              title={course.title}
              subtitle={course.subtitle}
              meta={`${course.category} · ${course.level}`}
              price={course.price}
              originalPrice={course.originalPrice}
              rating={course.rating}
              reviewCount={course.reviewCount}
              actionLabel="View Course"
              onAction={() => openCourse(course)}
              showWishlist
              wishlisted={wishlist.isWishlisted(course.id)}
              onToggleWishlist={() => toggleWishlist(course)}
              onClick={() => openCourse(course)}
            />
          ))}
        </div>
      </section>

      {/* F. New & trending */}
      <section className="mt-12">
        <SectionHeading id="new-trending" eyebrow="Just added" title="New & trending" subtitle="Recently added courses and what's picking up momentum." viewAllHref="/student/explore?sort=newest#browse" />
        <CourseCarousel
          courses={newAndTrending}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onCourseClick={openCourse}
          onAction={openCourse}
          badgeFor={(c, i) => (i % 2 === 0 ? "NEW" : "TRENDING")}
        />
      </section>

      {/* G. Popular educators */}
      <section className="mt-12">
        <SectionHeading eyebrow="Learn from the best" title="Learn from popular educators" viewAllHref="/instructors" />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {POPULAR_EDUCATOR_IDS.map((id, i) => {
            const educatorData = EDUCATORS.find((e) => e.id === id);
            if (!educatorData) return null;
            return (
              <ColorBlockCard
                key={educatorData.id}
                rotationIndex={i}
                fullWidth
                image={imageForPerson(educatorData.name)}
                badge="Popular Educator"
                title={educatorData.name}
                subtitle={educatorData.headline}
                description={`${educatorData.subjects.slice(0, 2).join(", ")} · ${educatorData.experienceYears}+ yrs experience`}
                rating={educatorData.rating}
                reviewCount={educatorData.reviewCount}
                actionLabel="View Profile"
                onAction={() => navigate(`/educator?educator=${educatorData.id}`)}
                onClick={() => navigate(`/educator?educator=${educatorData.id}`)}
              />
            );
          })}
        </div>
      </section>

      {/* H. Learning paths */}
      <section className="mt-12">
        <SectionHeading eyebrow="Go further" title="Build a learning path" subtitle="A guided sequence of courses that build on each other." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {LEARNING_PATHS.map((path) => (
            <div key={path.title} className="flex flex-col justify-between rounded-2xl border border-text/10 bg-white p-4">
              <div>
                <h3 className="font-display text-sm font-semibold text-text">{path.title}</h3>
                <p className="mt-1 text-xs text-text/50">{path.courses} courses · {path.hours}</p>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {path.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-primary/[0.06] px-2.5 py-1 text-[10px] font-medium text-primary/80">{skill}</span>
                  ))}
                </div>
              </div>
              <button
                type="button"
                onClick={() => exploreByCategory(path.category)}
                className="mt-4 self-start text-xs font-semibold text-primary hover:underline"
              >
                Explore path →
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Categories — the real, filterable taxonomy (shared with
          Onboarding + the sidebar filters below), distinct from the
          broader quick-topic chips in the hero. */}
      <section className="mt-12">
        <SectionHeading id="categories" eyebrow="Browse by subject" title="Categories" subtitle="Every subject on Universal Learning, in one place." />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {COURSE_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <button
                key={category}
                type="button"
                onClick={() => exploreByCategory(category)}
                className="group flex min-h-24 flex-col items-start justify-between rounded-xl border border-text/10 bg-white p-3 text-left transition-transform duration-150 hover:-translate-y-0.5 hover:border-primary/30"
              >
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg ${meta.tint}`}>
                  <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                </span>
                <span className="text-xs font-semibold text-text group-hover:text-primary">{category}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Browse / full searchable catalog — "Explore Courses" in the
          navbar dropdown lands here. This is the one section that
          intentionally shows every active course (live + self-paced,
          enrolled or not) since it's a real search+filter tool, not a
          curated pitch — a student searching shouldn't find courses
          mysteriously missing because they're already enrolled. */}
      <div id="browse" className="mt-14 scroll-mt-24 border-t border-text/10 pt-10">
        <SectionHeading eyebrow="Full catalog" title="Explore all courses" subtitle="Search and filter the entire Universal Learning catalog." />
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
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
                {results.map((course, index) => <ColorBlockCard key={course.id} rotationIndex={index} compact fullWidth image={course.image} title={course.title} subtitle={course.subtitle} meta={`${course.courseType === "Live" ? "Live" : "Recorded"} · ${course.level} · ${course.duration}`} description={course.description} price={course.price} originalPrice={course.originalPrice} rating={course.rating} reviewCount={course.reviewCount} actionLabel={course.enrolled ? "Enrolled" : "Enroll"} actionDisabled={course.enrolled} onAction={() => openCourse(course)} showWishlist wishlisted={wishlist.isWishlisted(course.id)} onToggleWishlist={() => toggleWishlist(course)} onClick={() => openCourse(course)} />)}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-text/15 bg-white px-6 py-16 text-center"><h2 className="font-display text-lg font-semibold text-text">No courses match these filters</h2><p className="mt-2 text-sm text-text/55">Try a broader search or clear the filters.</p><Button fullWidth={false} className="mt-5" onClick={() => setParams({})}>Clear filters</Button></div>
            )}
          </section>
        </div>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
