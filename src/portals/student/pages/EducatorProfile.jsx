// Educator public profile
// Jira: Day 3 — Educator public profile
// Doc reference: Sec 5.3 ("Educator Search & Public Profile — Browse/search
// educators; view bio, qualifications, ratings, courses, live sessions —
// Expected outcome: informed choice of educator.")
//
// Mounted at TWO routes: the public "/educator?educator=<id>" (see
// src/public/routes.jsx — reachable by anonymous visitors, since browsing
// an educator's profile is Discovery, not an enroll/book action per
// Section 4.3) and the logged-in student portal's own
// "/student/educatorprofile?educator=<id>" (src/portals/student/routes.jsx).
// Kept in the student portal folder alongside the existing Checkout/
// CourseDetails/Wishlist stubs rather than moved under src/public, same as
// CourseDetails.jsx. Mock ids ed1..ed8 in src/data/catalogMock.js.
// Auth-gated Follow redirects to /login; course questions stay in shared
// course Q&A rather than creating private educator inboxes.
// using the CURRENT url (see requireAuth below) rather than a hardcoded
// path, so this works correctly from either route.
import { useState } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import StatusBadge from "../../../components/ui/StatusBadge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import ToastStack from "../../../components/ui/Toast";
import SectionShapes from "../../../components/common/SectionShapes";
import { useAuth } from "../../../hooks/useAuth";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import { isStudentCourseEnrolled } from "../data/studentLocalState";
import {
  getEducatorById,
  getCoursesByEducator,
  imageForEducator,
} from "../../../data/catalogMock";
import {
  StarIcon,
  AwardIcon,
  MapPinIcon,
  ShareIcon,
  ChatIcon,
  BellIcon,
  ChevronLeftIcon,
  BookOpenIcon,
} from "../../../components/ui/icons";

function StatBlock({ value, label }) {
  return (
    <div className="flex flex-col">
      <span className="font-display text-xl font-bold text-text">{value}</span>
      <span className="text-xs text-text/50">{label}</span>
    </div>
  );
}

export default function EducatorProfile() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();

  const educatorId = searchParams.get("educator") ?? "ed1";
  const educator = getEducatorById(educatorId);

  const [bioExpanded, setBioExpanded] = useState(false);
  const [following, setFollowing] = useState(() => {
    try {
      return JSON.parse(window.localStorage.getItem("universal-learning-followed-educators") || "[]").includes(educatorId);
    } catch {
      return false;
    }
  });
  const [shareOpen, setShareOpen] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [reviewSort, setReviewSort] = useState("newest");
  const [showAllReviews, setShowAllReviews] = useState(false);

  if (!educator) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-xl font-semibold text-text">Educator not found</h1>
        <p className="mt-2 text-sm text-text/60">This educator profile doesn't exist or is no longer public.</p>
        <Button fullWidth={false} className="mt-6" onClick={() => navigate("/explore")}>
          Back to Explore
        </Button>
      </div>
    );
  }

  const courses = getCoursesByEducator(educator.id);
  const reviews = [...(courses[0]?.reviews ?? [])]
    .filter((review) => reviewFilter === "all" || review.rating === Number(reviewFilter))
    .sort((a, b) => reviewSort === "highest" ? b.rating - a.rating : reviewSort === "lowest" ? a.rating - b.rating : new Date(b.date) - new Date(a.date));
  const visibleReviews = showAllReviews ? reviews : reviews.slice(0, 3);
  const featuredCourses = courses.slice(0, 5);
  const enrolledCourse = user ? courses.find((course) => course.enrolled || isStudentCourseEnrolled(course.id, user)) : null;
  const liveCourseCount = courses.filter((course) => course.courseType === "Live").length;
  const recordedCourseCount = courses.length - liveCourseCount;
  const hasAboutDetails = Boolean(educator.aboutSections?.length);
  const currentPath =
    typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : `/educator?educator=${educator.id}`;
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${currentPath}`;
  const allCoursesPath = `${location.pathname.startsWith("/student/") ? "/student/explore" : "/explore"}?educator=${encodeURIComponent(educator.id)}#browse`;
  // Same "which route family am I in" check as CourseDetails/TestSeries use
  // elsewhere -- a logged-in student browsing under /student/ must stay in
  // /student/course/:id (StudentLayout's logged-in navbar), never fall
  // through to the public /course/:id (PublicLayout's logged-out navbar).
  const coursePath = (id) => (location.pathname.startsWith("/student/") ? `/student/course/${id}` : `/course/${id}`);

  function requireAuth(action) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    action();
  }

  function toggleFollow() {
    requireAuth(() => {
      const nextFollowing = !following;
      setFollowing(nextFollowing);
      try {
        const followed = JSON.parse(window.localStorage.getItem("universal-learning-followed-educators") || "[]");
        const next = nextFollowing
          ? [...new Set([...followed, educator.id])]
          : followed.filter((id) => id !== educator.id);
        window.localStorage.setItem("universal-learning-followed-educators", JSON.stringify(next));
      } catch {
        showToast("Your follow preference could not be saved.");
      }
    });
  }

  function handleCopyLink() {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    showToast("Profile link copied to clipboard");
    setShareOpen(false);
  }

  return (
    <div className="mx-auto max-w-[1240px] px-6 py-8">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-text/60 transition-colors duration-150 hover:text-text"
      >
        <ChevronLeftIcon /> Back
      </button>

      {/* Header */}
      <div className="relative flex flex-col gap-6 rounded-3xl bg-bg p-6 sm:flex-row sm:items-start sm:p-8">
        <SectionShapes variant="hero" />
        <img
          src={imageForEducator(educator)}
          alt={educator.name}
          className="h-28 w-28 shrink-0 rounded-2xl object-cover"
        />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-2xl font-bold text-text">{educator.name}</h1>
            <StatusBadge status="success">
              <span className="flex items-center gap-1">
                <AwardIcon className="h-3.5 w-3.5" /> Verified Educator
              </span>
            </StatusBadge>
          </div>
          <p className="mt-1 text-sm font-medium text-text/70">{educator.headline}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-text/50">
            <MapPinIcon /> {educator.city}
          </p>

          <div className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
            <StatBlock value={`${educator.rating} ★`} label={`${educator.reviewCount} reviews`} />
            <StatBlock value={educator.studentsCount.toLocaleString()} label="Students taught" />
            <StatBlock value={courses.length} label="Published courses" />
            <StatBlock value={`${educator.experienceYears}+ yrs`} label="Experience" />
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            {courses.length > 0 && <Button fullWidth={false} onClick={() => document.getElementById("educator-courses")?.scrollIntoView({ behavior: "smooth", block: "start" })}><BookOpenIcon className="h-4 w-4" /> Browse courses</Button>}
            {enrolledCourse && <Button fullWidth={false} variant="secondary" onClick={() => navigate(`/student/courseplayer?course=${enrolledCourse.id}&tab=qa`)} title="Questions are shared with learners in this course"><ChatIcon className="h-4 w-4" /> Ask in course Q&amp;A</Button>}
            <Button
              fullWidth={false}
              variant="secondary"
              onClick={toggleFollow}
            >
              <BellIcon className="h-4 w-4" /> {following ? "Following" : "Follow educator"}
            </Button>
            <button
              type="button"
              onClick={() => setShareOpen(true)}
              aria-label="Share profile"
              className="flex h-11 w-11 items-center justify-center rounded-full text-primary transition-colors duration-150 hover:bg-primary/5"
            >
              <ShareIcon />
            </button>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className="relative mt-8 rounded-3xl bg-white p-6 sm:p-8">
        <SectionShapes variant="courses" />
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Educator profile</p><h2 className="mt-1 font-display text-2xl font-bold text-[#17324d]">About {educator.name}</h2></div>
          <span className="rounded-full bg-[#e7f1ef] px-3 py-1.5 text-xs font-semibold text-[#28756f]">{educator.experienceYears}+ years of experience</span>
        </div>
        <p className="mt-4 max-w-4xl text-sm leading-7 text-text/70">{educator.bio}</p>
        {bioExpanded && educator.aboutSections?.length > 0 && (
          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {educator.aboutSections.map((section, index) => (
              <article key={section.title} className={`rounded-2xl border border-text/10 p-5 ${index === 0 ? "bg-[#fff7f2]" : index === 1 ? "bg-[#eef7f4]" : "bg-[#fcfbfa]"}`}>
                <h3 className="font-display text-base font-bold text-[#17324d]">{section.title}</h3>
                <p className="mt-2 text-sm leading-6 text-text/65">{section.text}</p>
              </article>
            ))}
          </div>
        )}
        {hasAboutDetails && (
          <button
            type="button"
            onClick={() => setBioExpanded((v) => !v)}
            aria-expanded={bioExpanded}
            className="mt-4 text-sm font-semibold text-primary hover:underline"
          >
            {bioExpanded ? "Show less" : `Read full profile for ${educator.name.split(" ")[0]}`}
          </button>
        )}

        <div className="mt-6 grid gap-6 sm:grid-cols-2">
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text/50">Qualifications</h3>
            <ul className="mt-2 space-y-1.5 text-sm text-text/70">
              {educator.qualifications.map((q) => (
                <li key={q}>{q}</li>
              ))}
            </ul>
          </div>
          <div>
            <h3 className="text-xs font-semibold uppercase tracking-wide text-text/50">Teaching Languages</h3>
            <div className="mt-2 flex flex-wrap gap-2">
              {educator.languages.map((l) => (
                <span key={l} className="rounded-full border border-primary/30 bg-bg px-3 py-1 text-xs font-medium text-primary">
                  {l}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="mt-6 rounded-2xl bg-accent-lilac/10 p-4">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text/50">Subjects & Expertise</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {educator.subjects.map((s) => (
              <span key={s} className="rounded-full border border-primary/30 bg-white px-3 py-1 text-xs font-medium text-primary">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Courses */}
      {courses.length > 0 && (
        <section id="educator-courses" className="relative mt-8 scroll-mt-24 rounded-3xl bg-bg p-5 sm:p-7">
          <SectionShapes variant="paths" />
          <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
            <div><p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Learn from {educator.name.split(" ")[0]}</p><h2 className="mt-1 font-display text-xl font-semibold text-text">Courses by {educator.name.split(" ")[0]}</h2><p className="mt-1 text-sm text-text/55">Compare course formats and choose what fits your learning goals.</p></div>
            <div className="flex flex-wrap gap-2 text-xs font-medium text-text/60"><span className="rounded-full bg-[#fff4ed] px-3 py-1.5">{courses.length} courses</span><span className="rounded-full bg-[#e7f1ef] px-3 py-1.5">{liveCourseCount} live</span><span className="rounded-full bg-[#f1eefb] px-3 py-1.5">{recordedCourseCount} recorded / self-paced</span></div>
          </div>
          <p className="mb-4 text-xs text-text/45">Showing {featuredCourses.length} of {courses.length} courses. Course questions are shared with enrolled learners.</p>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {featuredCourses.map((course, i) => {
              const enrolled = Boolean(user && (course.enrolled || isStudentCourseEnrolled(course.id, user)));
              return (
              <ColorBlockCard
                key={course.id}
                rotationIndex={i}
                image={course.image}
                title={course.title}
                subtitle={course.subtitle}
                description={course.description}
                price={course.price}
                originalPrice={course.originalPrice}
                rating={course.rating}
                actionLabel={enrolled ? "Enrolled" : "Enroll"}
                actionDisabled={enrolled}
                onAction={() => navigate(coursePath(course.id))}
                showWishlist
                wishlisted={wishlist.isWishlisted(course.id)}
                onToggleWishlist={() =>
                  requireAuth(() => {
                    const nowSaved = !wishlist.isWishlisted(course.id);
                    wishlist.toggle(course);
                    showToast(nowSaved ? "Added to wishlist" : "Removed from wishlist");
                  })
                }
                onClick={() => navigate(coursePath(course.id))}
              />
              );
            })}
          </div>
          {courses.length > featuredCourses.length && <div className="mt-5 flex justify-center"><Button fullWidth={false} variant="secondary" onClick={() => navigate(allCoursesPath)}>View more courses ({courses.length - featuredCourses.length})</Button></div>}
        </section>
      )}

      {/* Learner reviews */}
      <section className="relative mt-8 mb-4 rounded-3xl border border-text/10 bg-white p-5 shadow-[0_8px_28px_rgba(23,50,77,0.045)] sm:p-7">
        <SectionShapes variant="testimonials" />
        <div className="mb-6">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Learner feedback</p>
          <h2 className="mt-1 font-display text-2xl font-bold text-[#17324d]">Reviews for {educator.name.split(" ")[0]}</h2>
          <p className="mt-1 text-sm text-text/55">Ratings and feedback from learners across this educator’s courses.</p>
        </div>

        <div className="grid gap-5 lg:grid-cols-[250px_minmax(0,1fr)]">
          <aside className="h-fit rounded-2xl bg-[#fff7f2] p-5 text-center lg:sticky lg:top-24">
            <p className="text-xs font-semibold uppercase tracking-wide text-text/45">Educator rating</p>
            <p className="mt-2 font-display text-5xl font-bold tracking-tight text-[#17324d]">{educator.rating.toFixed(1)}</p>
            <div className="mt-2 flex justify-center gap-1" aria-label={`${educator.rating} out of 5 stars`}>
              {Array.from({ length: 5 }, (_, index) => <StarIcon key={index} className={`h-5 w-5 ${index < Math.round(educator.rating) ? "fill-current text-[#d39a43]" : "text-text/15"}`} />)}
            </div>
            <p className="mt-2 text-xs font-medium text-text/55">Based on {educator.reviewCount.toLocaleString()} learner ratings</p>
            <div className="mt-5 border-t border-text/10 pt-4 text-left">
              <p className="text-xs font-semibold text-text">What this rating covers</p>
              <p className="mt-1 text-xs leading-5 text-text/50">Learners rate their experience across courses taught by {educator.name.split(" ")[0]}.</p>
            </div>
          </aside>

          <div className="min-w-0">
            <div className="mb-4 flex flex-col gap-3 border-b border-text/10 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap gap-2" aria-label="Filter reviews by rating">
                {["all", "5", "4", "3"].map((rating) => <button key={rating} type="button" onClick={() => { setReviewFilter(rating); setShowAllReviews(false); }} aria-pressed={reviewFilter === rating} className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${reviewFilter === rating ? "border-primary bg-primary text-white" : "border-text/10 bg-white text-text/60 hover:border-primary/30 hover:text-primary"}`}>{rating === "all" ? "All reviews" : `${rating} stars`}</button>)}
              </div>
              <label className="flex items-center gap-2 text-xs text-text/50">Sort by <select value={reviewSort} onChange={(event) => setReviewSort(event.target.value)} className="rounded-full border border-text/10 bg-white px-3 py-2 text-xs font-semibold text-text/70 outline-none focus:border-primary"><option value="newest">Most recent</option><option value="highest">Highest rated</option><option value="lowest">Lowest rated</option></select></label>
            </div>

            <p className="mb-3 text-xs text-text/45">Featured written reviews · {courses[0]?.title}</p>
            {visibleReviews.length ? <div className="space-y-3">
              {visibleReviews.map((review) => <article key={review.id} className="rounded-2xl border border-text/10 bg-white p-4 transition hover:border-primary/20 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f3e8e2] text-xs font-bold text-primary">{review.name.split(" ").map((part) => part[0]).join("").slice(0, 2)}</span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div><h3 className="text-sm font-bold text-text">{review.name}</h3><p className="mt-0.5 text-[11px] text-text/45">{new Date(review.date).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p></div>
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#fff7e8] px-2.5 py-1 text-xs font-bold text-[#8b5c16]"><StarIcon className="h-3.5 w-3.5 fill-current" />{review.rating}.0</span>
                    </div>
                    <p className="mt-3 text-sm leading-6 text-text/70">{review.text}</p>
                  </div>
                </div>
              </article>)}
            </div> : <div className="rounded-2xl border border-dashed border-text/15 bg-[#fcfbfa] px-5 py-10 text-center"><p className="text-sm font-semibold text-text">No reviews with this rating</p><p className="mt-1 text-xs text-text/50">Choose another rating filter to see more learner feedback.</p></div>}
            {reviews.length > 3 && <button type="button" onClick={() => setShowAllReviews((current) => !current)} className="mt-4 text-sm font-semibold text-primary hover:underline">{showAllReviews ? "Show fewer reviews" : `Show all ${reviews.length} featured reviews`}</button>}
          </div>
        </div>
      </section>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share this profile">
        <p className="mb-3 text-sm text-text/60">Anyone with this link can view {educator.name}'s public profile.</p>
        <div className="flex items-center gap-2 rounded-full border border-text/15 bg-bg px-4 py-2.5 text-sm text-text/70">
          <span className="min-w-0 flex-1 truncate">{shareUrl}</span>
        </div>
        <Button className="mt-4" onClick={handleCopyLink}>
          Copy Link
        </Button>
      </Modal>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
