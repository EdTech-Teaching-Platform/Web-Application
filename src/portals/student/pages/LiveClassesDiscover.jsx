// Live Classes — discovery/marketplace page for live learning. This is
// deliberately NOT the student's schedule: it's where a student finds a
// NEW live class to book, the same way Explore is for courses generally.
// The student's own booked/upcoming live classes live under My Learning →
// My Courses, and are actually managed at /student/managebooking (booked
// slots, reschedule, cancel) — several other screens (Dashboard's
// "Upcoming Live Classes" widget, Calendar's "View class" action) point
// there rather than here, on purpose, so this page never mixes enrolled
// sessions into a discovery grid.
import { useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import Button from "../../../components/ui/Button";
import SectionHeading from "../../../components/common/SectionHeading";
import SectionShapes from "../../../components/common/SectionShapes";
import CourseCarousel from "../../../components/common/CourseCarousel";
import { ChevronDownIcon, SearchIcon } from "../../../components/ui/icons";
import { COURSE_CATEGORIES, CATEGORY_META } from "../../../utils/constants";
import { useAuth } from "../../../hooks/useAuth";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import { useScrollToHash } from "../../../hooks/useScrollToHash";
import ToastStack from "../../../components/ui/Toast";
import { COURSES, EDUCATORS } from "../../../data/catalogMock";
import { formatClassStart, getLiveCourseSchedule } from "../data/liveCourseSchedule";
import { isStudentCourseEnrolled } from "../data/studentLocalState";

const LEVELS = ["Beginner", "Intermediate", "Advanced"];
const LIVE_COURSES = COURSES.filter((c) => c.status === "active" && c.courseType === "Live");
const LIVE_EDUCATOR_IDS = [...new Set(LIVE_COURSES.map((c) => c.educatorId))];

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

export default function LiveClassesDiscover() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();
  useScrollToHash();

  const [query, setQuery] = useState("");
  const [categories, setCategories] = useState([]);
  const [level, setLevel] = useState("");
  const [educatorId, setEducatorId] = useState("");
  const availableLiveCourses = LIVE_COURSES.filter((course) => !course.enrolled && !isStudentCourseEnrolled(course.id, user));

  function toggleCategory(category) {
    setCategories((prev) => (prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]));
  }

  function goToBrowse(category) {
    if (category) setCategories([category]);
    document.getElementById("browse")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const filtered = useMemo(
    () =>
      availableLiveCourses.filter((course) => {
        const haystack = `${course.title} ${course.subtitle} ${course.category}`.toLowerCase();
        return (
          haystack.includes(query.toLowerCase()) &&
          (!categories.length || categories.includes(course.category)) &&
          (!level || course.level === level) &&
          (!educatorId || course.educatorId === educatorId)
        );
      }),
    [availableLiveCourses, query, categories, level, educatorId]
  );

  const liveAndSoon = [...availableLiveCourses].sort((a, b) => getLiveCourseSchedule(a.id).startAt - getLiveCourseSchedule(b.id).startAt).slice(0, 6);
  const popular = useMemo(() => [...availableLiveCourses].sort((a, b) => b.enrolledCount - a.enrolledCount).slice(0, 6), [availableLiveCourses]);
  const popularIds = useMemo(() => new Set(popular.map((c) => c.id)), [popular]);
  const recommended = useMemo(() => availableLiveCourses.filter((c) => !popularIds.has(c.id) && c.rating >= 4.5).slice(0, 4), [availableLiveCourses, popularIds]);

  const scheduleMeta = (course) => {
    const schedule = getLiveCourseSchedule(course.id);
    return schedule ? `${formatClassStart(schedule.startAt)} · ${schedule.time} · ${schedule.duration}` : course.duration;
  };

  const scheduleBadge = (course) => {
    const schedule = getLiveCourseSchedule(course.id);
    if (schedule?.status === "live") return "LIVE NOW";
    if (schedule && schedule.startAt.getTime() - Date.now() < 30 * 60 * 1000) return "STARTING SOON";
    return undefined;
  };

  // Mounted at both the public /live-classes and the protected
  // /student/live-classes (see public/routes.jsx) -- a logged-in student
  // browsing under /student/ must stay in /student/course/:id
  // (StudentLayout's logged-in navbar), never fall through to the public
  // /course/:id (PublicLayout's logged-out navbar), same pattern as
  // EducatorProfile's coursePath and TestSeriesMarketplace's detailPath.
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
      {/* Hero */}
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">Live learning</p>
        <h1 className="mt-2 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Learn live with expert educators</h1>
        <p className="mx-auto mt-3 max-w-xl text-sm text-text/60">
          Join interactive classes, ask questions in real time and learn with a community.
        </p>
        <div className="relative mt-6">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-text/35" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && document.getElementById("browse")?.scrollIntoView({ behavior: "smooth" })}
            placeholder="Search live classes..."
            className="w-full rounded-2xl border border-text/10 bg-white py-4 pl-12 pr-4 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/10"
          />
        </div>
      </div>

      {/* Live now / Starting soon */}
      <section className="relative mt-12 rounded-3xl bg-accent-peach/10 p-6 sm:p-8">
        <SectionShapes variant="hero" />
        <SectionHeading eyebrow="Happening today" title="Live now & starting soon" subtitle="Jump into a session that's live, or catch one about to start." />
        <CourseCarousel
          courses={liveAndSoon}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onCourseClick={openCourse}
          onAction={openCourse}
          actionLabel="View Details"
          metaFor={scheduleMeta}
          badgeFor={scheduleBadge}
        />
      </section>

      {/* Popular */}
      <section className="relative mt-12 rounded-3xl border border-text/5 bg-white p-6 sm:p-8">
        <SectionShapes variant="courses" />
        <SectionHeading eyebrow="Trending" title="Popular live classes" subtitle="The live sessions students are booking the most." viewAllHref="#browse" />
        <CourseCarousel
          courses={popular}
          wishlist={wishlist}
          onToggleWishlist={toggleWishlist}
          onCourseClick={openCourse}
          onAction={openCourse}
          actionLabel="View Details"
          metaFor={(c) => `${scheduleMeta(c)} · ${c.level}`}
        />
      </section>

      {/* Recommended */}
      <section className="relative mt-12 rounded-3xl bg-accent-teal/10 p-6 sm:p-8">
        <SectionShapes variant="why" />
        <SectionHeading eyebrow="For you" title="Recommended live classes" subtitle="Highly rated sessions in subjects you've shown interest in." />
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {recommended.map((course, index) => (
            <ColorBlockCard
              key={course.id}
              rotationIndex={index}
              fullWidth
              image={course.image}
              title={course.title}
              subtitle={course.subtitle}
              meta={scheduleMeta(course)}
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

      {/* Browse by subject */}
      <section className="relative mt-12 rounded-3xl bg-bg p-6 sm:p-8">
        <SectionShapes variant="categories" />
        <SectionHeading eyebrow="Browse" title="Browse by subject" />
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
      <div id="browse" className="relative mt-14 scroll-mt-24 border-t border-text/10 bg-white rounded-3xl pt-10 p-6 sm:p-8">
        <SectionShapes variant="educators" />
        <SectionHeading eyebrow="All live classes" title="Browse live classes" subtitle="Filter by category, level or educator to find your next session." />
        <div className="grid gap-8 lg:grid-cols-[240px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl border border-text/10 bg-white p-4 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:self-start lg:overflow-y-auto">
            <div className="flex items-center justify-between border-b border-text/10 pb-3">
              <h2 className="font-display font-semibold text-text">Filters</h2>
              <button type="button" onClick={() => { setCategories([]); setLevel(""); setEducatorId(""); setQuery(""); }} className="text-xs font-semibold text-primary hover:underline">Clear all</button>
            </div>
            <div className="mt-3 space-y-3">
              <CheckGroup label="Category" options={COURSE_CATEGORIES} selected={categories} onToggle={toggleCategory} />
              <CheckGroup label="Level" options={LEVELS} selected={level ? [level] : []} onToggle={(value) => setLevel(level === value ? "" : value)} />
              <details open className="pb-1">
                <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-sm font-semibold text-text">
                  Educator
                  <ChevronDownIcon className="h-4 w-4 text-text/40" />
                </summary>
                <select value={educatorId} onChange={(event) => setEducatorId(event.target.value)} className="mt-2 w-full rounded-lg border border-text/10 bg-white px-3 py-2 text-sm outline-none focus:border-primary">
                  <option value="">All educators</option>
                  {LIVE_EDUCATOR_IDS.map((id) => {
                    const ed = EDUCATORS.find((e) => e.id === id);
                    return ed ? <option key={id} value={id}>{ed.name}</option> : null;
                  })}
                </select>
              </details>
            </div>
          </aside>
          <section className="min-w-0">
            <p className="mb-5 text-sm text-text/60"><strong className="text-text">{filtered.length}</strong> live classes</p>
            {filtered.length ? (
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                {filtered.map((course, index) => (
                  <ColorBlockCard
                    key={course.id}
                    rotationIndex={index}
                    compact
                    fullWidth
                    image={course.image}
                    badge="Live"
                    title={course.title}
                    subtitle={course.subtitle}
                    meta={scheduleMeta(course)}
                    description={`${course.level} · ${course.enrolledCount.toLocaleString()} learners`}
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
                <h2 className="font-display text-lg font-semibold text-text">No live classes match these filters</h2>
                <p className="mt-2 text-sm text-text/55">Try a broader search or clear the filters.</p>
                <Button fullWidth={false} className="mt-5" onClick={() => { setCategories([]); setLevel(""); setEducatorId(""); setQuery(""); }}>Clear filters</Button>
              </div>
            )}
          </section>
        </div>
      </div>
      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
