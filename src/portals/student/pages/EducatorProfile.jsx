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
// Auth-gated actions (Book Session, Message, Follow) redirect to /login
// using the CURRENT url (see requireAuth below) rather than a hardcoded
// path, so this works correctly from either route.
import { useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import ListRow from "../../../components/ui/ListRow";
import StatusBadge from "../../../components/ui/StatusBadge";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import ToastStack from "../../../components/ui/Toast";
import { useAuth } from "../../../hooks/useAuth";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import {
  getEducatorById,
  getCoursesByEducator,
  getSessionsForEducator,
  imageForEducator,
} from "../../../data/catalogMock";
import {
  StarIcon,
  UsersIcon,
  AwardIcon,
  MapPinIcon,
  ShareIcon,
  ChatIcon,
  BellIcon,
  ChevronLeftIcon,
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
  const { user } = useAuth();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();

  const educatorId = searchParams.get("educator") ?? "ed1";
  const educator = getEducatorById(educatorId);

  const [bioExpanded, setBioExpanded] = useState(false);
  const [following, setFollowing] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

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
  const sessions = getSessionsForEducator(educator.id);
  const bioIsLong = educator.bio.length > 160;
  const currentPath =
    typeof window !== "undefined" ? `${window.location.pathname}${window.location.search}` : `/educator?educator=${educator.id}`;
  const shareUrl = `${typeof window !== "undefined" ? window.location.origin : ""}${currentPath}`;

  function requireAuth(action) {
    if (!user) {
      navigate(`/login?redirect=${encodeURIComponent(currentPath)}`);
      return;
    }
    action();
  }

  function handleBookSession(session) {
    if (session.seatsLeft === 0) return;
    requireAuth(() => navigate(`/student/booksession?session=${session.id}`));
  }

  function handleMessage() {
    requireAuth(() => navigate(`/student/messages?with=${educator.id}`));
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
      <div className="flex flex-col gap-6 rounded-3xl bg-white p-6 sm:flex-row sm:items-start sm:p-8">
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
            <Button fullWidth={false} onClick={() => sessions[0] && handleBookSession(sessions[0])}>
              Book a Session
            </Button>
            <Button fullWidth={false} variant="secondary" onClick={handleMessage}>
              <ChatIcon className="h-4 w-4" /> Message
            </Button>
            <Button
              fullWidth={false}
              variant="secondary"
              onClick={() => requireAuth(() => setFollowing((f) => !f))}
            >
              <BellIcon className="h-4 w-4" /> {following ? "Following" : "Follow / Notify me"}
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
      <div className="mt-8 rounded-3xl bg-white p-6 sm:p-8">
        <h2 className="font-display text-lg font-semibold text-text">About</h2>
        <p className={`mt-2 text-sm text-text/70 ${bioExpanded ? "" : "line-clamp-2"}`}>{educator.bio}</p>
        {bioIsLong && (
          <button
            type="button"
            onClick={() => setBioExpanded((v) => !v)}
            className="mt-2 text-sm font-semibold text-primary hover:underline"
          >
            {bioExpanded ? "Show less" : "Read more"}
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

        <div className="mt-6">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-text/50">Subjects & Expertise</h3>
          <div className="mt-2 flex flex-wrap gap-2">
            {educator.subjects.map((s) => (
              <span key={s} className="rounded-full border border-primary/30 bg-bg px-3 py-1 text-xs font-medium text-primary">
                {s}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Courses */}
      {courses.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 font-display text-lg font-semibold text-text">Courses by {educator.name.split(" ")[0]}</h2>
          <div className="flex gap-5 overflow-x-auto pb-2">
            {courses.map((course, i) => (
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
                showWishlist
                wishlisted={wishlist.isWishlisted(course.id)}
                onToggleWishlist={() =>
                  requireAuth(() => {
                    const nowSaved = !wishlist.isWishlisted(course.id);
                    wishlist.toggle(course);
                    showToast(nowSaved ? "Added to wishlist" : "Removed from wishlist");
                  })
                }
                onClick={() => navigate(`/course/${course.id}`)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Upcoming live sessions */}
      <div className="mt-8">
        <h2 className="mb-4 font-display text-lg font-semibold text-text">Upcoming Live Sessions</h2>
        {sessions.length === 0 ? (
          <p className="text-sm text-text/50">No upcoming sessions right now — check back soon.</p>
        ) : (
          <div className="space-y-3">
            {sessions.map((s) => (
              <ListRow
                key={s.id}
                title={s.title}
                subtitle={`${s.date} · ${s.time} · ${s.duration}`}
                meta={
                  <div className="flex items-center gap-3">
                    <span className="font-semibold text-text">₹{s.price}</span>
                    {s.seatsLeft === 0 ? (
                      <StatusBadge status="danger">Full</StatusBadge>
                    ) : (
                      <StatusBadge status="success">{s.seatsLeft} seats left</StatusBadge>
                    )}
                  </div>
                }
                trailing={
                  <Button fullWidth={false} onClick={() => handleBookSession(s)} disabled={s.seatsLeft === 0}>
                    Book Session
                  </Button>
                }
              />
            ))}
          </div>
        )}
      </div>

      {/* Reviews */}
      <div className="mt-8 mb-4">
        <h2 className="mb-4 font-display text-lg font-semibold text-text">
          Student Reviews <span className="text-text/40">({educator.reviewCount})</span>
        </h2>
        <div className="mb-5 flex items-center gap-3 rounded-2xl bg-blush px-5 py-4">
          <StarIcon className="h-6 w-6 fill-current text-primary" />
          <span className="font-display text-2xl font-bold text-text">{educator.rating}</span>
          <span className="text-sm text-text/60">average rating across {educator.reviewCount} reviews</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {getCoursesByEducator(educator.id)[0]?.reviews.slice(0, 4).map((r) => (
            <div key={r.id} className="rounded-2xl bg-blush p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-semibold text-text">{r.name}</span>
                <span className="flex items-center gap-1 text-xs font-medium text-text/60">
                  <StarIcon className="h-3.5 w-3.5 fill-current text-primary" /> {r.rating}
                </span>
              </div>
              <p className="text-sm text-text/70">{r.text}</p>
            </div>
          )) ?? <p className="text-sm text-text/50">No reviews yet.</p>}
        </div>
      </div>

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
