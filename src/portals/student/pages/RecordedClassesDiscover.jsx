// Recorded Classes — discovery/marketplace page for self-paced learning.
// Same rule as Live Classes: this is where a student finds a NEW recorded
// course, not where they resume one they're already taking. Enrolled
// recorded courses (with progress, "Continue watching") live under My
// Learning → My Courses instead — never duplicated here.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import Button from "../../../components/ui/Button";
import SectionHeading from "../../../components/common/SectionHeading";
import CourseCarousel from "../../../components/common/CourseCarousel";
import { ChevronDownIcon, SearchIcon } from "../../../components/ui/icons";
import { COURSE_CATEGORIES, CATEGORY_META } from "../../../utils/constants";
import { useAuth } from "../../../hooks/useAuth";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import { useScrollToHash } from "../../../hooks/useScrollToHash";
import ToastStack from "../../../components/ui/Toast";
import { COURSES } from "../../../data/catalogMock";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const RECORDED_COURSES = COURSES.filter((c) => c.status === "active" && c.courseType !== "Live" && !c.enrolled);

function lessonCountFor(course) {
  return course.curriculum.reduce((total, module) => total + module.lessons.length, 0);
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

export default function RecordedClassesDiscover() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();
  useScrollToHash();

  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [level, setLevel] = useState("");
  const [priceFilters, setPriceFilters] = useState([]);
  const [minRating, setMinRating] = useState(0);

  function toggleCategory(category) {
    setCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  }

  function togglePrice(value) {
    setPriceFilters((prev) => (prev.includes(value) ? prev.filter((p) => p !== value) : [...prev, value]));
  }

  function clearAll() {
    setQuery("");
    setCategories([]);
    setLevel("");
    setPriceFilters([]);
    setMinRating(0);
  }

  function goToBrowse(category) {
    if (category) setCategories([category]);
    document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filtered = useMemo(
    () =>
      RECORDED_COURSES.filter((course) => {
        const haystack = `${course.title} ${course.subtitle} ${course.category}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (!categories.length || categories.includes(course.category)) &&
          (!level || course.level === level) &&
          course.rating >= minRating &&
          (!priceFilters.includes("Free") || course.price === 0) &&
          (!priceFilters.includes("Under ₹1,000") || course.price < 1000) &&
          (!priceFilters.includes("₹1,000+") || course.price >= 1000)
        );
      }),
    [query, categories, level, priceFilters, minRating]
  );

  const popular = useMemo(() => [...RECORDED_COURSES].sort((a, b) => b.enrolledCount - a.enrolledCount).slice(0, 6), []);
  const popularIds = useMemo(() => new Set(popular.map((c) => c.id)), [popular]);
  const trending = useMemo(() => [...RECORDED_COURSES].filter((c) => !popularIds.has(c.id)).sort((a, b) => b.rating - a.rating).slice(0, 6), [popularIds]);
  const trendingIds = useMemo(() => new Set(trending.map((c) => c.id)), [trending]);
  const recommended = useMemo(
    () => RECORDED_COURSES.filter((c) => !popularIds.has(c.id) && !trendingIds.has(c.id) && c.rating >= 4.4).slice(0, 4),
    [popularIds, trendingIds]
  );
  const newlyAdded = useMemo(() => [...RECORDED_COURSES].slice(-6).reverse(), []);

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
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Self-paced learning</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Learn at your own pace</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text/60">
          Explore recorded classes and self-paced courses from expert educators.
        </p>
        <div className="relative mt-6">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" })}
            placeholder="Search recorded classes..."
            className="w-full rounded-2xl border border-text/10 bg-white py-4 pl-12 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Popular recorded classes */}
      <section className="mt-12">
        <SectionHeading eyebrow="Trending now" title="Popular recorded classes" subtitle="Self-paced courses students are enrolling in most." viewAllHref="#browse" />
        <CourseCarousel
          courses={popular}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onCourseClick={openCourse}
          onAction={openCourse}
          actionLabel="View Details"
          metaFor={(c) => `${c.level} · ${lessonCountFor(c)} lessons · ${c.duration}`}
        />
      </section>

      {/* Trending this week */}
      <section className="mt-12">
        <SectionHeading eyebrow="This week" title="Trending this week" subtitle="Highly rated courses picking up momentum." />
        <CourseCarousel
          courses={trending}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onCourseClick={openCourse}
          onAction={openCourse}
          actionLabel="View Details"
          badgeFor={() => "TRENDING"}
          metaFor={(c) => `${c.level} · ${lessonCountFor(c)} lessons · ${c.duration}`}
        />
      </section>

      {/* Recommended for you */}
      <section className="mt-12">
        <SectionHeading eyebrow="For you" title="Recommended for you" subtitle="Based on your interests and learning goals." />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {recommended.map((course, index) => (
            <ColorBlockCard
              key={course.id}
              rotationIndex={index}
              fullWidth
              image={course.image}
              title={course.title}
              subtitle={course.subtitle}
              meta={`${course.level} · ${lessonCountFor(course)} lessons`}
              price={course.price}
              originalPrice={course.originalPrice}
              rating={course.rating}
              reviewCount={course.reviewCount}
              actionLabel="View Details"
              onAction={() => openCourse(course)}
              showWishlist
              wishlisted={wishlist.isWishlisted(course.id)}
              onToggleWishlist={() => toggleWishlist(course)}
              onClick={() => openCourse(course)}
            />
          ))}
        </div>
      </section>

      {/* Newly added */}
      <section className="mt-12">
        <SectionHeading eyebrow="Fresh" title="Newly added" subtitle="The latest recorded courses on Universal Learning." />
        <CourseCarousel
          courses={newlyAdded}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onCourseClick={openCourse}
          onAction={openCourse}
          actionLabel="View Details"
          badgeFor={() => "NEW"}
          metaFor={(c) => `${c.level} · ${lessonCountFor(c)} lessons · ${c.duration}`}
        />
      </section>

      {/* Browse by category */}
      <section className="mt-12">
        <SectionHeading eyebrow="Browse" title="Browse by category" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {COURSE_CATEGORIES.map((category) => {
            const meta = CATEGORY_META[category];
            const Icon = meta.icon;
            return (
              <button
                key={category}
                type="button"
                onClick={() => goToBrowse(category)}
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

      {/* Browse / full filterable grid */}
      <div id="browse" className="mt-14 scroll-mt-24 border-t border-text/10 pt-10">
        <SectionHeading eyebrow="All recorded classes" title="Browse recorded classes" subtitle="Filter by category, level, price or rating." />
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-text/10 bg-white p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-text/10 pb-3">
              <h2 className="font-display font-semibold text-text">Filters</h2>
              <button type="button" onClick={clearAll} className="text-xs font-semibold text-primary hover:underline">Clear all</button>
            </div>
            <div className="mt-3 space-y-3">
              <CheckGroup label="Category" options={COURSE_CATEGORIES} selected={categories} onToggle={toggleCategory} />
              <CheckGroup label="Level" options={LEVELS} selected={level ? [level] : []} onToggle={(value) => setLevel(level === value ? "" : value)} />
              <CheckGroup label="Price" options={["Free", "Under ₹1,000", "₹1,000+"]} selected={priceFilters} onToggle={togglePrice} />
              <CheckGroup label="Rating" options={["4.5 & up", "4.0 & up"]} selected={minRating === 4.5 ? ["4.5 & up"] : minRating === 4 ? ["4.0 & up"] : []} onToggle={(value) => setMinRating(minRating === (value === "4.5 & up" ? 4.5 : 4) ? 0 : value === "4.5 & up" ? 4.5 : 4)} />
            </div>
          </aside>
          <section className="min-w-0">
            <p className="mb-5 text-sm text-text/60"><strong className="text-text">{filtered.length}</strong> recorded classes</p>
            {filtered.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {filtered.map((course, index) => (
                  <ColorBlockCard
                    key={course.id}
                    rotationIndex={index}
                    compact
                    fullWidth
                    image={course.image}
                    title={course.title}
                    subtitle={course.subtitle}
                    meta={`${course.level} · ${lessonCountFor(course)} lessons · ${course.duration}`}
                    description={`${course.enrolledCount.toLocaleString()} learners`}
                    price={course.price}
                    originalPrice={course.originalPrice}
                    rating={course.rating}
                    reviewCount={course.reviewCount}
                    actionLabel="View Details"
                    onAction={() => openCourse(course)}
                    showWishlist
                    wishlisted={wishlist.isWishlisted(course.id)}
                    onToggleWishlist={() => toggleWishlist(course)}
                    onClick={() => openCourse(course)}
                  />
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-text/15 bg-white px-6 py-16 text-center">
                <h2 className="font-display text-lg font-semibold text-text">No recorded classes match these filters</h2>
                <p className="mt-2 text-sm text-text/55">Try a broader search or clear the filters.</p>
                <Button fullWidth={false} className="mt-5" onClick={clearAll}>Clear filters</Button>
              </div>
            )}
          </section>
        </div>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
