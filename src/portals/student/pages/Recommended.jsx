// Full "Recommended for You" page — the real destination for the
// Dashboard's "Recommended for You" → View all link (previously that
// link just sent students to the generic Explore catalog, which isn't
// personalized). Two sections, same idea as Coursera/Udemy's own
// "Recommended" screens: a personalized set up top, then a second row of
// courses related to that set for further browsing.
import { useNavigate } from "react-router-dom";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import BackButton from "../../../components/common/BackButton";
import { imageForCategory } from "../../../utils/stockImages";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import ToastStack from "../../../components/ui/Toast";
import { RECOMMENDED, RELATED_COURSES } from "../data/recommendedMock";
import { getCourseById } from "../../../data/catalogMock";
import { useAuth } from "../../../hooks/useAuth";
import { isStudentCourseEnrolled } from "../data/studentLocalState";

function CourseGrid({ courses, wishlist, showToast, navigate }) {
  const { user } = useAuth();
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {courses.map((c, i) => {
        const enrolled = getCourseById(c.id)?.enrolled === true || isStudentCourseEnrolled(c.id, user);
        return (
        <ColorBlockCard
          key={c.id}
          rotationIndex={i}
          image={imageForCategory(c.category)}
          badge={c.category}
          title={c.title}
          subtitle={c.subtitle}
          description={c.description}
          price={c.price}
          originalPrice={c.originalPrice}
          rating={c.rating}
          actionLabel={enrolled ? "Enrolled" : "Enroll"}
          actionDisabled={enrolled}
          onAction={() => navigate(enrolled ? `/student/courseplayer?course=${c.id}` : `/student/course/${c.id}`)}
          compact
          fullWidth
          showWishlist
          wishlisted={wishlist.isWishlisted(c.id)}
          onToggleWishlist={() => {
            const nowSaved = !wishlist.isWishlisted(c.id);
            wishlist.toggle(c);
            showToast(nowSaved ? "Added to wishlist" : "Removed from wishlist");
          }}
          onClick={() => navigate(`/student/course/${c.id}`)}
        />
        );
      })}
    </div>
  );
}

export default function Recommended() {
  const navigate = useNavigate();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();

  return (
    <div className="mx-auto max-w-[1320px] px-4 py-7 sm:px-7 lg:px-10">
      <BackButton fallback="/student/dashboard" className="mb-4" />

      <div className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-primary">For you</div>
      <h1 className="font-display text-2xl font-bold tracking-tight text-[#17324d] sm:text-3xl">
        Recommended for You
      </h1>
      <p className="mt-2 max-w-2xl text-sm text-text/60">
        Picked based on your enrolled courses, progress, and interests.
      </p>

      <section className="mt-6">
        <CourseGrid courses={RECOMMENDED} wishlist={wishlist} showToast={showToast} navigate={navigate} />
      </section>

      <section className="mt-10">
        <div className="mb-4">
          <h2 className="font-display text-lg font-bold text-[#17324d]">You might also like</h2>
          <p className="mt-1 text-xs text-text/50">Related courses worth exploring next.</p>
        </div>
        <CourseGrid courses={RELATED_COURSES} wishlist={wishlist} showToast={showToast} navigate={navigate} />
      </section>

      <div className="mt-10 flex justify-center">
        <button
          type="button"
          onClick={() => navigate("/student/explore")}
          className="text-sm font-semibold text-primary hover:underline"
        >
          Browse the full course catalog →
        </button>
      </div>

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
