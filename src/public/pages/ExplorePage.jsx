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
import { useEffect, useMemo, useRef } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ColorBlockCard from "../../components/ui/ColorBlockCard";
import Chip from "../../components/ui/Chip";
import Button from "../../components/ui/Button";
import SectionHeading from "../../components/common/SectionHeading";
import SectionShapes from "../../components/common/SectionShapes";
import CourseCarousel from "../../components/common/CourseCarousel";
import { ChevronDownIcon, SearchIcon, TargetIcon, BriefcaseIcon, FileTextIcon, HeartIcon } from "../../components/ui/icons";
import { useAuth } from "../../hooks/useAuth";
import { useWishlist } from "../../hooks/useWishlist";
import { useToast } from "../../hooks/useToast";
import { useScrollToHash } from "../../hooks/useScrollToHash";
import ToastStack from "../../components/ui/Toast";
import { COURSES as CATALOG_COURSES, EDUCATORS } from "../../data/catalogMock";
import { imageForPerson } from "../../utils/stockImages";
import { getStudentEnrolledCourseIds } from "../../portals/student/data/studentLocalState";

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

// Quick topic shortcuts above the search bar — broader than the formal
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

// Each goal maps to real, existing catalogMock.js/constants.js fields —
// level and COURSE_CATEGORIES — so clicking one actually narrows the
// catalog instead of just changing sort order. "Prepare for exams" is the
// one exception: it routes to the real Test Series feature (structured
// mock exams) instead of the course catalog, since that's a more accurate
// destination for exam prep than any course category.
const GOALS = [
  { icon: TargetIcon, title: "Start a new skill", description: "Beginner-friendly courses to get moving on something brand new.", level: "Beginner", categories: [] },
  { icon: BriefcaseIcon, title: "Build career-ready skills", description: "In-demand, job-focused tracks in tech, design and business.", level: "", categories: ["Programming", "Design", "Business"] },
  { icon: FileTextIcon, title: "Prepare for exams", description: "Structured practice for board, competitive and language exams.", to: "/student/assessments/test-series" },
  { icon: HeartIcon, title: "Learn for personal interest", description: "Music, languages, wellness and creative courses to enjoy.", level: "", categories: ["Music", "Languages"] },
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
  const location = useLocation();
  const { user } = useAuth();
  const userId = user?.identifier || user?.id || "guest";
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();
  useScrollToHash();
  const enrolledIds = useMemo(() => new Set(getStudentEnrolledCourseIds(userId)), [userId]);
  // A logged-out visitor must never be treated as enrolled, regardless of
  // catalogMock.js's course.enrolled flag (some courses hardcode
  // enrolled: true there) — same root-cause fix as CourseDetails.jsx.
  const studentCourses = useMemo(
    () => ALL_COURSES.map((course) => ({ ...course, enrolled: !!user && (course.enrolled || enrolledIds.has(course.id)) })),
    [enrolledIds, user]
  );
  const discoverableCourses = useMemo(() => studentCourses.filter((course) => !course.enrolled), [studentCourses]);
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

  // Root cause of the "clicks filter correctly but doesn't scroll" bug:
  // these same-page interactions call setParams() (via update()) and then
  // tried to scroll right away. A single requestAnimationFrame only
  // guarantees "before the next paint" — it doesn't guarantee React has
  // committed the new filtered render AND the browser has laid out the
  // new content yet, so the first click could fire the scroll against
  // still-stale layout (the id="browse" element itself is always
  // present/never conditionally rendered — that part was already fine).
  // Fix: don't scroll inline in the click handler at all. Just flag that
  // a scroll is pending; a useEffect keyed on `params` (below) then runs
  // AFTER React has actually committed and the DOM has the new content,
  // which is the only point a scroll is guaranteed to land correctly on
  // the very first click, not just the second.
  const pendingScrollRef = useRef(false);
  function scrollToBrowse() {
    pendingScrollRef.current = true;
  }

  useEffect(() => {
    if (!pendingScrollRef.current) return;
    pendingScrollRef.current = false;
    document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [params]);

  function runQuickSearch(term) {
    update((next) => {
      next.set("q", term);
    });
    scrollToBrowse();
  }

  function exploreByGoal(goal) {
    // "Prepare for exams" routes straight to Test Series instead of
    // filtering the course catalog — see GOALS' comment above.
    if (goal.to) {
      navigate(goal.to);
      return;
    }
    update((next) => {
      next.delete("category");
      goal.categories.forEach((category) => next.append("category", category));
      if (goal.level) next.set("level", goal.level);
      else next.delete("level");
    });
    scrollToBrowse();
  }

  const results = useMemo(() => {
    const filtered = studentCourses.filter((course) => {
      // Include description so a plain keyword search (e.g. "programming")
      // also matches on subject/description text, not just title/category.
      const haystack = `${course.title} ${course.subtitle} ${course.category} ${course.description || ""}`.toLowerCase();
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
  }, [categories, educator, filters, level, query, sort, studentCourses]);

  // Curated rows — each pulls a different, mostly non-overlapping slice of
  // the discoverable (not-yet-enrolled) catalog so Popular/Recommended/New
  // don't just repeat the same handful of courses on one page.
  const popularCourses = useMemo(
    () => [...discoverableCourses].sort((a, b) => b.enrolledCount - a.enrolledCount).slice(0, 6),
    [discoverableCourses]
  );
  const popularIds = useMemo(() => new Set(popularCourses.map((c) => c.id)), [popularCourses]);
  const recommendedCourses = useMemo(
    () => discoverableCourses.filter((c) => !popularIds.has(c.id) && c.rating >= 4.5).slice(0, 4),
    [discoverableCourses, popularIds]
  );
  const recommendedIds = useMemo(() => new Set(recommendedCourses.map((c) => c.id)), [recommendedCourses]);
  const newAndTrending = useMemo(
    () =>
      discoverableCourses.filter((c) => !popularIds.has(c.id) && !recommendedIds.has(c.id))
        .slice(-8)
        .reverse()
        .slice(0, 6),
    [discoverableCourses, popularIds, recommendedIds]
  );

  // ExplorePage is mounted at both the public /explore and the protected
  // /student/explore (see student/routes.jsx) -- a logged-in student
  // browsing under /student/ must stay in /student/course/:id
  // (StudentLayout's logged-in navbar), never fall through to the public
  // /course/:id (PublicLayout's logged-out navbar).
  const isStudentContext = location.pathname.startsWith("/student/");
  const coursePath = (id) => (isStudentContext ? `/student/course/${id}` : `/course/${id}`);

  function openCourse(course) {
    navigate(coursePath(course.id));
  }

  function toggleWishlist(course) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(coursePath(course.id))}`);
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
            onKeyDown={(event) => event.key === "Enter" && scrollToBrowse()}
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
      <section className="relative mt-12 rounded-3xl bg-accent-lilac/10 p-6 sm:p-8">
        <SectionShapes variant="goals" />
        <SectionHeading eyebrow="Discovery" title="Explore by goal" subtitle="Not sure where to start? Pick what you're trying to do." />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {GOALS.map((goal) => {
            const Icon = goal.icon;
            return (
              <button
                key={goal.title}
                type="button"
                onClick={() => exploreByGoal(goal)}
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
      <section className="relative mt-12 rounded-3xl border border-text/5 bg-white p-6 sm:p-8">
        <SectionShapes variant="courses" />
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
      <section className="relative mt-12 rounded-3xl bg-accent-sky/10 p-6 sm:p-8">
        <SectionShapes variant="categories" />
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
      <section className="relative mt-12 rounded-3xl bg-bg p-6 sm:p-8">
        <SectionShapes variant="why" />
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
      <section className="relative mt-12 rounded-3xl bg-accent-peach/10 p-6 sm:p-8">
        <SectionShapes variant="paths" />
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
      <section className="relative mt-12 rounded-3xl border border-text/5 bg-white p-6 sm:p-8">
        <SectionShapes variant="educators" />
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
                {results.map((course, index) => <ColorBlockCard key={course.id} rotationIndex={index} compact fullWidth image={course.image} title={course.title} subtitle={course.subtitle} meta={`${course.courseType === "Live" ? "Live" : "Recorded"} · ${course.level} · ${course.duration}`} description={course.description} price={course.price} originalPrice={course.originalPrice} rating={course.rating} reviewCount={course.reviewCount} actionLabel={!!user && course.enrolled ? "Enrolled" : "Enroll"} actionDisabled={!!user && course.enrolled} onAction={() => openCourse(course)} showWishlist wishlisted={wishlist.isWishlisted(course.id)} onToggleWishlist={() => toggleWishlist(course)} onClick={() => openCourse(course)} />)}
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
