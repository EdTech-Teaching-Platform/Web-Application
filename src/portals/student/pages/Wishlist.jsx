// Wishlist
// Jira: Day 3 — Wishlist
// Doc reference: Sec 5.3 ("Wishlist — Save/remove a course from the course
// details page — Expected outcome: saved list visible from the student
// dashboard.") Surfaced here as its own page (linked from the Student
// sidebar) rather than only a Dashboard section, since it needs its own
// sort/empty-state/price-changed behavior that wouldn't fit a small
// Dashboard widget.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useWishlist } from "../../../hooks/useWishlist";
import { useToast } from "../../../hooks/useToast";
import ToastStack from "../../../components/ui/Toast";
import ColorBlockCard from "../../../components/ui/ColorBlockCard";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import { HeartIcon } from "../../../components/ui/icons";
import { imageForCategory } from "../../../utils/stockImages";
import { getCourseById } from "../../../data/catalogMock";

const SORTS = [
  { id: "recent", label: "Recently Added" },
  { id: "price-asc", label: "Price: Low to High" },
  { id: "price-desc", label: "Price: High to Low" },
];

export default function Wishlist() {
  const navigate = useNavigate();
  const wishlist = useWishlist();
  const { toasts, showToast, dismiss } = useToast();
  const [sort, setSort] = useState("recent");

  const items = useMemo(() => {
    const withCourse = wishlist.entries
      .map((entry) => ({ entry, course: getCourseById(entry.id) }))
      .filter((row) => row.course);

    const sorted = [...withCourse];
    if (sort === "price-asc") sorted.sort((a, b) => a.course.price - b.course.price);
    else if (sort === "price-desc") sorted.sort((a, b) => b.course.price - a.course.price);
    else sorted.sort((a, b) => b.entry.addedAt - a.entry.addedAt);

    return sorted;
  }, [wishlist.entries, sort]);

  function handleRemove(course) {
    wishlist.remove(course.id);
    showToast(`Removed "${course.title}" from wishlist`);
  }

  function handleEnroll(course) {
    navigate(`/student/checkout?course=${course.id}`);
  }

  return (
    <div className="mx-auto max-w-[1240px] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-text">My Wishlist</h1>
          <p className="mt-1 text-sm text-text/60">{items.length} course{items.length === 1 ? "" : "s"} saved</p>
        </div>
        {items.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {SORTS.map((s) => (
              <Chip key={s.id} active={sort === s.id} onClick={() => setSort(s.id)}>
                {s.label}
              </Chip>
            ))}
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white py-20 text-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-blush text-primary">
            <HeartIcon className="h-7 w-7" />
          </span>
          <div>
            <h2 className="font-display text-lg font-semibold text-text">Your wishlist is empty</h2>
            <p className="mt-1 text-sm text-text/60">Save courses you're interested in to find them here later.</p>
          </div>
          <Button fullWidth={false} onClick={() => navigate("/student/explore")}>
            Explore Courses
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {items.map(({ entry, course }, i) => {
            const priceDropped = entry.savedPrice != null && course.price < entry.savedPrice;
            return (
              <div key={course.id} className="mx-auto flex w-full max-w-[280px] min-w-0 flex-col">
                <ColorBlockCard
                  rotationIndex={i}
                  image={course.image ?? imageForCategory(course.category)}
                  title={course.title}
                  subtitle={course.subtitle}
                  description={course.description}
                  meta={`${course.level} · ${course.duration}`}
                  price={course.price}
                  originalPrice={course.originalPrice}
                  rating={course.rating}
                  showWishlist
                  wishlisted
                  onToggleWishlist={() => handleRemove(course)}
                  compact
                  fullWidth
                  className="flex-1"
                  onClick={() => navigate(`/student/course/${course.id}`)}
                />
                {priceDropped && (
                  <p className="mt-2 text-xs font-semibold text-success">
                    Price dropped since you saved this (was ₹{entry.savedPrice})
                  </p>
                )}
                <div className="mt-3 grid w-full grid-cols-[minmax(0,1fr)_auto] gap-2">
                  <Button fullWidth className="min-w-0 px-3 text-xs" onClick={() => handleEnroll(course)}>
                    Enroll Now
                  </Button>
                  <Button
                    variant="secondary"
                    fullWidth={false}
                    onClick={() => handleRemove(course)}
                    className="shrink-0 !px-3 text-xs whitespace-nowrap"
                  >
                    Remove
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <ToastStack toasts={toasts} onDismiss={dismiss} />
    </div>
  );
}
