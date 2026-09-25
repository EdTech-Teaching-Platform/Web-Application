import ColorBlockCard from "../ui/ColorBlockCard";

// Horizontal-scroll row of course cards — same ColorBlockCard used
// everywhere else (design.md: never fork a parallel CourseCard), just
// laid out in a scrollable row instead of a grid so a discovery section
// doesn't have to be a tall grid to show several courses (per the Explore
// redesign spec: "use horizontal course carousels ... instead of making
// every section extremely tall"). Shared by Explore, Live Classes and
// Recorded Classes rather than re-implemented per page.
export default function CourseCarousel({
  courses,
  wishlist,
  onToggleWishlist,
  onCourseClick,
  onAction,
  actionLabel = "View Course",
  metaFor,
  badgeFor,
}) {
  if (!courses.length) {
    return <p className="text-sm text-text/55">Nothing to show here yet.</p>;
  }

  return (
    <div className="flex gap-4 overflow-x-auto pb-2">
      {courses.map((course, index) => (
        <ColorBlockCard
          key={course.id}
          className="!mx-0"
          rotationIndex={index}
          image={course.image}
          badge={badgeFor ? badgeFor(course, index) : undefined}
          title={course.title}
          subtitle={course.subtitle}
          meta={metaFor ? metaFor(course, index) : `${course.category} · ${course.level}`}
          price={course.price}
          originalPrice={course.originalPrice}
          rating={course.rating}
          reviewCount={course.reviewCount}
          actionLabel={actionLabel}
          onAction={() => (onAction ? onAction(course) : onCourseClick?.(course))}
          showWishlist={!!wishlist}
          wishlisted={wishlist ? wishlist.isWishlisted(course.id) : false}
          onToggleWishlist={() => onToggleWishlist?.(course)}
          onClick={() => onCourseClick?.(course)}
        />
      ))}
    </div>
  );
}
