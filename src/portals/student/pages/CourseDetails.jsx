// Course details page
// Jira: Day 3 — Course details page
// Doc reference: Sec 5.3 ("Course Details Page — Banner, instructor info,
// full curriculum, reviews, FAQs, pricing, related courses — Expected
// outcome: informed enrollment decision.")
//
// Route: /student/coursedetails?course=<id> — mock ids c1..c7 in
// src/data/catalogMock.js (c7 is deliberately archived, to exercise the
// "course unavailable/archived" state without a real backend flag).
import { useMemo, useState } from "react";
import { useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import Accordion from "../../../components/ui/Accordion";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import ToastStack from "../../../components/ui/Toast";
import { useAuth } from "../../../hooks/useAuth";
import { isStudentCourseEnrolled } from "../data/studentLocalState";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import { getCourseById, getEducatorById, getRelatedCourses, imageForEducator } from "../../../data/catalogMock";
import { imgFallback } from "../../../utils/stockImages";
import SectionShapes from "../../../components/common/SectionShapes";
import AttendanceCard from "../components/AttendanceCard";
import { ATTENDANCE_SESSIONS } from "../data/sessionMock";
import {
  StarIcon,
  HeartIcon,
  ShareIcon,
  AwardIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  VideoIcon,
  FileTextIcon,
  HelpCircleIcon,
  DownloadIcon,
  CheckIcon,
  AlertTriangleIcon,
} from "../../../components/ui/icons";

const LESSON_ICONS = {
  video: VideoIcon,
  article: FileTextIcon,
  quiz: HelpCircleIcon,
  assignment: FileTextIcon,
  resource: DownloadIcon,
  live: VideoIcon,
};

function formatUpdated(dateStr) {
  try {
    return new Date(dateStr).toLocaleDateString("en-IN", { month: "short", year: "numeric" });
  } catch {
    return dateStr;
  }
}

// Curriculum accordion — a course-specific variant of the shared Accordion
// (design.md names Accordion for "Course Details Curriculum tab", but its
// current API only takes plain question/answer text; a lesson list with
// per-row icons/durations/preview badges needs richer content per item, so
// this stays local to this screen rather than forcing that shape onto the
// shared component for every other Accordion consumer).
function CurriculumAccordion({ modules, onPreview }) {
  const [openIds, setOpenIds] = useState(() => new Set([modules[0]?.id]));

  function toggle(id) {
    setOpenIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className="divide-y divide-text/10">
      {modules.map((m) => {
        const open = openIds.has(m.id);
        return (
          <div key={m.id}>
            <button
              type="button"
              onClick={() => toggle(m.id)}
              aria-expanded={open}
              className="flex w-full items-center justify-between gap-4 py-4 text-left"
            >
              <span className="font-display text-sm font-semibold text-text">{m.title}</span>
              <span className="flex shrink-0 items-center gap-3 text-xs text-text/50">
                {m.lessons.length} lessons
                <ChevronDownIcon className={`transition-transform duration-200 ease-out ${open ? "rotate-180" : ""}`} />
              </span>
            </button>
            <div
              className="overflow-hidden transition-[max-height,opacity] duration-250 ease-out"
              style={{ maxHeight: open ? `${m.lessons.length * 60 + 20}px` : "0px", opacity: open ? 1 : 0 }}
            >
              <ul className="pb-4">
                {m.lessons.map((l) => {
                  const Icon = LESSON_ICONS[l.type] ?? FileTextIcon;
                  return (
                    <li key={l.id} className="flex items-center gap-3 rounded-xl px-2 py-2.5 text-sm hover:bg-bg">
                      <Icon className="shrink-0 text-text/40" />
                      <span className="min-w-0 flex-1 truncate text-text/80">{l.title}</span>
                      {l.preview && (
                        <button
                          type="button"
                          onClick={() => onPreview(l)}
                          className="shrink-0 text-xs font-semibold text-primary hover:underline"
                        >
                          Preview
                        </button>
                      )}
                      <span className="w-14 shrink-0 text-right text-xs text-text/40">{l.duration}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RatingBar({ star, count, total }) {
  const pct = total ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 text-xs text-text/60">
      <span className="w-3">{star}</span>
      <StarIcon className="h-3 w-3 fill-current text-primary" />
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-text/10">
        <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
      </div>
      <span className="w-8 text-right">{pct}%</span>
    </div>
  );
}

export default function CourseDetails() {
  const [searchParams] = useSearchParams();
  const { courseId: routeCourseId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();

  const courseId = routeCourseId || searchParams.get("course") || "c1";
  const course = getCourseById(courseId);

  const [couponInput, setCouponInput] = useState("");
  const [couponNote, setCouponNote] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [reviewSort, setReviewSort] = useState("helpful");

  const sortedReviews = useMemo(() => {
    if (!course) return [];
    const copy = [...course.reviews];
    if (reviewSort === "newest") return copy.sort((a, b) => (a.date < b.date ? 1 : -1));
    if (reviewSort === "highest") return copy.sort((a, b) => b.rating - a.rating);
    // "helpful" (default): featured first, matches the mock's own order otherwise
    return copy.sort((a, b) => Number(b.featured) - Number(a.featured));
  }, [course, reviewSort]);

  if (!course) {
    return (
      <div className="mx-auto max-w-3xl px-6 py-16 text-center">
        <h1 className="font-display text-xl font-semibold text-text">Course not found</h1>
        <p className="mt-2 text-sm text-text/60">This course doesn't exist or is no longer listed.</p>
        <Button fullWidth={false} className="mt-6" onClick={() => navigate("/explore")}>
          Back to Explore
        </Button>
      </div>
    );
  }

  const educator = getEducatorById(course.educatorId);
  // Item 5 fix: a logged-out visitor must never be treated as enrolled,
  // regardless of the mock data's course.enrolled flag (some Popular
  // Courses on the landing page hardcode enrolled: true in catalogMock.js).
  const isEnrolled = !!user && (course.enrolled || isStudentCourseEnrolled(course.id, user));
  const related = getRelatedCourses(course);
  const courseAttendance = ATTENDANCE_SESSIONS.filter((session) => session.courseId === course.id);
  const isArchived = course.status === "archived";
  const isWishlisted = wishlist.isWishlisted(course.id);
  const totalReviews = Object.values(course.ratingBreakdown).reduce((a, b) => a + b, 0);
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}/student/course/${course.id}`;

  // Bug fix: this page mounts at BOTH the public "/course/:id" route and
  // the protected "/student/course/:id" route (see src/public/routes.jsx
  // and src/portals/student/routes.jsx) — hardcoding "/student/course/"
  // here sent a logged-out visitor's "back to course" destination
  // (threaded through /login -> /register) to the WRONG (protected) path
  // when they'd actually arrived via the public one, e.g. /course/c5.
  // Use the actual current path instead so it always matches where the
  // person really is.
  const currentCoursePath = `${location.pathname}${location.search}`;
  // Related-course cards (below) link to a DIFFERENT course's own details
  // page — mirror whichever route family (public vs student-portal) the
  // visitor is currently in, same reasoning as currentCoursePath above.
  const isStudentContext = location.pathname.startsWith("/student/");
  const relatedCoursePath = (id) => (isStudentContext ? `/student/course/${id}` : `/course/${id}`);

  function requireAuth(redirectPath, action) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(redirectPath)}`);
      return;
    }
    action();
  }

  function handleToggleWishlist() {
    requireAuth(currentCoursePath, () => {
      const nowSaved = !isWishlisted;
      wishlist.toggle(course);
      showToast(nowSaved ? "Added to wishlist" : "Removed from wishlist");
    });
  }

  function handleEnroll() {
    requireAuth(currentCoursePath, () => {
      navigate("/student/checkout", {
        state: { courseId: course.id, couponCode: couponInput || undefined },
      });
    });
  }

  function handlePreview(lesson) {
    navigate(`/student/resourceviewer?lesson=${lesson.id}&preview=1`);
  }

  function handleApplyCouponHint() {
    if (!couponInput.trim()) return;
    // Deliberately NOT computing a discount here — Sec 5.10's rule is that
    // price is always server-computed. This just carries the typed code
    // forward to Checkout, where getCheckoutSummary() actually validates
    // it and returns the real (or rejected) discount.
    setCouponNote(`"${couponInput.trim().toUpperCase()}" will be applied at checkout.`);
  }

  function handleCopyLink() {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    showToast("Course link copied to clipboard");
    setShareOpen(false);
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
      <button
        type="button"
        onClick={() => navigate(-1)}
        className="mb-4 flex items-center gap-1.5 text-sm font-medium text-text/60 transition-colors duration-150 hover:text-text"
      >
        <ChevronLeftIcon /> Back
      </button>

      {isArchived && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl bg-warning/15 px-5 py-4 text-sm text-text">
          <AlertTriangleIcon className="shrink-0 text-warning" />
          This course is archived and no longer accepting new enrollments. Existing students keep access.
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main column */}
        <div className="lg:col-span-2">
          {/* Hero */}
          <div className="relative overflow-hidden rounded-3xl bg-white">
            <SectionShapes variant="hero" />
            <div className="relative aspect-[16/8] w-full overflow-hidden">
              <img
                src={course.image}
                alt={course.title}
                onError={(e) => imgFallback(e, course.title, 960, 480)}
                className="h-full w-full object-cover"
              />
              <div className="absolute right-4 top-4 flex gap-2">
                <button
                  type="button"
                  onClick={handleToggleWishlist}
                  aria-pressed={isWishlisted}
                  aria-label={isWishlisted ? "Remove from wishlist" : "Save to wishlist"}
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white transition-transform duration-150 hover:scale-110"
                >
                  <HeartIcon filled={isWishlisted} />
                </button>
                <button
                  type="button"
                  onClick={() => setShareOpen(true)}
                  aria-label="Share course"
                  className="flex h-10 w-10 items-center justify-center rounded-full bg-black/30 text-white transition-transform duration-150 hover:scale-110"
                >
                  <ShareIcon />
                </button>
              </div>
            </div>
            <div className="p-6 sm:p-8">
              <h1 className="font-display text-2xl font-bold text-text sm:text-3xl">{course.title}</h1>
              <p className="mt-2 text-sm text-text/70">{course.description}</p>
              <div className="mt-5 space-y-4">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text/45">Instructor</p>
                  <button
                    type="button"
                    onClick={() => navigate(`/educator?educator=${course.educatorId}`)}
                    className="mt-1 flex items-center gap-1.5 text-sm font-semibold text-primary hover:underline"
                  >
                    {course.subtitle} <AwardIcon className="h-3.5 w-3.5 text-success" />
                  </button>
                </div>
                <div className="grid gap-3 border-y border-text/10 py-3 sm:grid-cols-3">
                  <div className="flex items-center gap-2">
                    <StarIcon className="h-4 w-4 shrink-0 fill-current text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-text">{course.rating} / 5</p>
                      <p className="text-xs text-text/50">{course.reviewCount} reviews</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{course.enrolledCount.toLocaleString()}</p>
                    <p className="text-xs text-text/50">students enrolled</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text">{course.level}</p>
                    <p className="text-xs text-text/50">course level</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-text/55">
                  <span>{course.duration} total learning time</span>
                  <span>{course.language} instruction</span>
                  <span>Updated {formatUpdated(course.lastUpdated)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* What you'll learn */}
          <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-text">What You'll Learn</h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {course.whatYouLearn.map((item) => (
                <div key={item} className="flex items-start gap-2 text-sm text-text/75">
                  <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                  {item}
                </div>
              ))}
            </div>
          </div>

          {/* Requirements */}
          <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8">
            <h2 className="font-display text-lg font-semibold text-text">Requirements</h2>
            <ul className="mt-3 list-disc space-y-1.5 pl-5 text-sm text-text/75">
              {course.requirements.map((r) => (
                <li key={r}>{r}</li>
              ))}
            </ul>
          </div>

          {/* Curriculum */}
          <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-display text-lg font-semibold text-text">Curriculum</h2>
              <span className="text-xs text-text/50">
                {course.curriculum.reduce((n, m) => n + m.lessons.length, 0)} lessons · {course.duration}
              </span>
            </div>
            <CurriculumAccordion modules={course.curriculum} onPreview={handlePreview} />
          </div>

          {courseAttendance.length > 0 && (
            <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8">
              <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                <div>
                  <h2 className="font-display text-lg font-semibold text-text">Live class attendance</h2>
                  <p className="mt-1 text-sm text-text/55">Attendance recorded from your participation in this course.</p>
                </div>
                <button type="button" onClick={() => navigate(`/student/attendance?course=${course.id}`)} className="text-sm font-semibold text-primary hover:underline">View all</button>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {courseAttendance.map((session) => (
                  <AttendanceCard
                    key={session.id}
                    session={session}
                    onOpen={(item) => item.recordingId
                      ? navigate(`/student/recordings?session=${item.sessionId}`)
                      : navigate(`/student/attendance?course=${course.id}`)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Instructor */}
          {educator && (
            <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8">
              <div className="mb-5 flex items-center justify-between gap-3">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-text/45">Your instructor</p>
                  <h2 className="mt-1 font-display text-lg font-semibold text-text">Meet {educator.name}</h2>
                </div>
                <AwardIcon className="h-5 w-5 shrink-0 text-success" />
              </div>
              <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
                <img src={imageForEducator(educator)} alt={educator.name} className="h-24 w-24 shrink-0 rounded-2xl object-cover sm:h-28 sm:w-28" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-display text-xl font-semibold text-text">{educator.name}</span>
                  </div>
                  <p className="mt-1 text-sm font-medium text-text/65">{educator.headline}</p>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-text/70">{educator.bio}</p>

                  <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <div className="rounded-xl bg-bg px-3 py-2.5">
                      <p className="font-display text-base font-semibold text-text">{educator.rating} ★</p>
                      <p className="mt-0.5 text-[11px] text-text/50">{educator.reviewCount} reviews</p>
                    </div>
                    <div className="rounded-xl bg-bg px-3 py-2.5">
                      <p className="font-display text-base font-semibold text-text">{educator.studentsCount.toLocaleString()}</p>
                      <p className="mt-0.5 text-[11px] text-text/50">students taught</p>
                    </div>
                    <div className="rounded-xl bg-bg px-3 py-2.5">
                      <p className="font-display text-base font-semibold text-text">{educator.experienceYears}+ yrs</p>
                      <p className="mt-0.5 text-[11px] text-text/50">teaching experience</p>
                    </div>
                    <div className="rounded-xl bg-bg px-3 py-2.5">
                      <p className="font-display text-base font-semibold text-text">{educator.city.split(",")[0]}</p>
                      <p className="mt-0.5 text-[11px] text-text/50">based in</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 border-t border-text/10 pt-4 sm:grid-cols-2">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text/45">Credentials</p>
                      <ul className="mt-2 space-y-1.5 text-sm text-text/70">
                        {educator.qualifications.map((qualification) => (
                          <li key={qualification} className="flex gap-2">
                            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                            <span>{qualification}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-text/45">Expertise & languages</p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {educator.subjects.map((subject) => (
                          <span key={subject} className="rounded-full bg-blush px-2.5 py-1 text-xs font-medium text-primary">{subject}</span>
                        ))}
                        {educator.languages.map((language) => (
                          <span key={language} className="rounded-full border border-text/10 px-2.5 py-1 text-xs text-text/60">{language}</span>
                        ))}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate(`/educator?educator=${educator.id}`)}
                    className="mt-5 text-sm font-semibold text-primary hover:underline"
                  >
                    View full profile →
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Reviews */}
          <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8">
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-display text-lg font-semibold text-text">Reviews</h2>
              <select
                value={reviewSort}
                onChange={(e) => setReviewSort(e.target.value)}
                className="rounded-full border border-text/15 bg-bg px-3 py-1.5 text-xs font-medium text-text outline-none focus:border-primary"
              >
                <option value="helpful">Most helpful</option>
                <option value="newest">Newest</option>
                <option value="highest">Highest rated</option>
              </select>
            </div>
            <div className="mb-6 flex flex-col gap-6 sm:flex-row sm:items-center">
              <div className="flex shrink-0 flex-col items-center rounded-2xl bg-blush px-8 py-5">
                <span className="font-display text-3xl font-bold text-text">{course.rating}</span>
                <span className="mt-1 flex items-center gap-0.5">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <StarIcon key={i} className={`h-3.5 w-3.5 ${i < Math.round(course.rating) ? "fill-current text-primary" : "text-text/20"}`} />
                  ))}
                </span>
                <span className="mt-1 text-xs text-text/50">{course.reviewCount} reviews</span>
              </div>
              <div className="flex-1 space-y-1.5">
                {[5, 4, 3, 2, 1].map((star) => (
                  <RatingBar key={star} star={star} count={course.ratingBreakdown[star] ?? 0} total={totalReviews} />
                ))}
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {sortedReviews.map((r) => (
                <div key={r.id} className={`rounded-2xl p-4 ${r.featured ? "bg-blush ring-1 ring-primary/20" : "bg-bg"}`}>
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-sm font-semibold text-text">{r.name}</span>
                    <span className="flex items-center gap-1 text-xs font-medium text-text/60">
                      <StarIcon className="h-3.5 w-3.5 fill-current text-primary" /> {r.rating}
                    </span>
                  </div>
                  {r.featured && (
                    <span className="mb-1 inline-block text-[10px] font-semibold uppercase tracking-wide text-primary">Featured review</span>
                  )}
                  <p className="text-sm text-text/70">{r.text}</p>
                  <p className="mt-1 text-xs text-text/40">{r.date}</p>
                </div>
              ))}
            </div>
          </div>

          {/* FAQ */}
          <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8">
            <h2 className="mb-2 font-display text-lg font-semibold text-text">Frequently Asked Questions</h2>
            <Accordion items={course.faqs} />
          </div>

          {/* Related courses */}
          {related.length > 0 && (
            <div className="mt-8">
              <h2 className="mb-4 font-display text-lg font-semibold text-text">Keep the Momentum Going</h2>
              <div className="flex gap-5 overflow-x-auto pb-2">
                {related.map((c, i) => {
                  // Same login-gated enrolled check as isEnrolled above —
                  // a logged-out visitor is never treated as enrolled here
                  // either, regardless of catalogMock.js's course.enrolled.
                  const relatedEnrolled = !!user && (c.enrolled || isStudentCourseEnrolled(c.id, user));
                  return (
                    <ColorBlockCard
                      key={c.id}
                      rotationIndex={i}
                      image={c.image}
                      title={c.title}
                      subtitle={c.subtitle}
                      description={c.description}
                      price={c.price}
                      originalPrice={c.originalPrice}
                      rating={c.rating}
                      showWishlist
                      wishlisted={wishlist.isWishlisted(c.id)}
                      onToggleWishlist={() =>
                        requireAuth(relatedCoursePath(c.id), () => {
                          const nowSaved = !wishlist.isWishlisted(c.id);
                          wishlist.toggle(c);
                          showToast(nowSaved ? "Added to wishlist" : "Removed from wishlist");
                        })
                      }
                      actionLabel={relatedEnrolled ? (c.courseType === "Live" ? "View Schedule" : "Go to Course") : "Enroll"}
                      onAction={() =>
                        relatedEnrolled
                          ? navigate(c.courseType === "Live" ? `/student/live-course?course=${c.id}` : `/student/courseplayer?course=${c.id}`)
                          : requireAuth(relatedCoursePath(c.id), () =>
                              navigate("/student/checkout", { state: { courseId: c.id } })
                            )
                      }
                      onClick={() => navigate(relatedCoursePath(c.id))}
                    />
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky enrollment card — desktop only, per design.md's "calmer,
            more functional" guidance for transactional surfaces even
            though this specific card sits on a bold Discovery page. */}
        <aside className="lg:col-span-1">
          <div className="relative rounded-3xl bg-white p-6 lg:sticky lg:top-6">
          <SectionShapes variant="cta" />
            <div className="flex items-baseline gap-2">
              <span className="font-display text-3xl font-bold text-text">
                {course.price === 0 ? "Free" : `₹${course.price}`}
              </span>
              {course.originalPrice > course.price && (
                <span className="text-sm text-text/40 line-through">₹{course.originalPrice}</span>
              )}
            </div>
            {course.originalPrice > course.price && (
              <p className="mt-1 text-xs font-semibold text-success">
                {Math.round(((course.originalPrice - course.price) / course.originalPrice) * 100)}% off right now
              </p>
            )}

            {isEnrolled ? (
              <Button className="mt-5" onClick={() => navigate(course.courseType === "Live" ? `/student/live-course?course=${course.id}` : `/student/courseplayer?course=${course.id}`)}>
                {course.courseType === "Live" ? "View Class Schedule" : "Go to Course"}
              </Button>
            ) : isArchived ? (
              <Button className="mt-5" disabled>
                Enrollment Closed
              </Button>
            ) : (
              <Button className="mt-5" onClick={handleEnroll}>
                Enroll Now
              </Button>
            )}
            <Button fullWidth className="mt-3" variant="secondary" onClick={handleToggleWishlist}>
              <HeartIcon filled={isWishlisted} className="h-4 w-4" />
              {isWishlisted ? "Saved to Wishlist" : "Add to Wishlist"}
            </Button>

            {!isArchived && (
              <div className="mt-5 border-t border-text/10 pt-5">
                <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-text/50">
                  Have a coupon?
                </label>
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value)}
                    placeholder="Enter code"
                    className="w-full min-w-0 rounded-full border border-text/15 bg-bg px-4 py-2 text-sm text-text outline-none focus:border-primary"
                  />
                  <Button fullWidth={false} variant="secondary" onClick={handleApplyCouponHint}>
                    Apply
                  </Button>
                </div>
                {couponNote && <p className="mt-2 text-xs text-text/50">{couponNote}</p>}
                <p className="mt-1 text-[11px] text-text/40">
                  The actual discount is validated and calculated securely at checkout.
                </p>
              </div>
            )}

          </div>
        </aside>
      </div>

      <Modal open={shareOpen} onClose={() => setShareOpen(false)} title="Share this course">
        <p className="mb-3 text-sm text-text/60">Anyone with this link can view this course's details page.</p>
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
