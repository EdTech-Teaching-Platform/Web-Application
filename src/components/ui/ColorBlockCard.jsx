import { StarIcon, HeartIcon } from "./icons";
import { imgFallback } from "../../utils/stockImages";

// ColorBlockCard — design.md Section 4: the ONE card component for
// course/educator/instructor content everywhere in the product (Student
// Continue Learning + Recommended, Landing Featured Courses/Educators +
// Popular Courses/Top Instructors, Explore results, Wishlist, Course
// Details "related courses"). Never fork a parallel "EducatorCard"/
// "CourseCard"/"InstructorCard" — only the meta row content changes.
//
// Rotation order is fixed 1->2->3->4->1... across whatever grid/row it's
// rendered in — pass `rotationIndex` (0-based) from the caller's map index,
// don't let this component pick its own color.
const ROTATION_CLASSES = [
  "bg-rotation-1",
  "bg-rotation-2",
  "bg-rotation-3",
  "bg-rotation-4",
];

export function rotationClassFor(index) {
  return ROTATION_CLASSES[index % ROTATION_CLASSES.length];
}

export default function ColorBlockCard({
  rotationIndex: _rotationIndex = 0,
  image,
  illustration: Illustration,
  badge, // small overlay pill on the image (course category eyebrow / "TOP RATED INSTRUCTOR" tag)
  title,
  subtitle,
  progress, // 0-100 — when present, renders the progress-bar + Resume meta row
  price, // when present (and progress is not), renders the price/rating meta row
  originalPrice, // when higher than price, shows a struck-through original + price
  rating,
  reviewCount, // shown as "(128)" next to rating
  actionLabel, // e.g. "Enroll" / "View Profile" — bottom pill button, independent of the whole-card onClick
  onAction,
  onClick,
  onResume,
  // Wishlist heart toggle — icon button per design.md's icon-button spec
  // (no visible container besides the translucent backdrop already used
  // for the category badge). Opt-in via `showWishlist` so cards that
  // aren't course cards (e.g. instructor cards with no price/save concept)
  // don't render it.
  showWishlist = false,
  wishlisted = false,
  onToggleWishlist,
  // Grid consumers (Explore/Wishlist/Recommended grids) need the card to
  // fill its grid cell instead of the default fixed 224px card width used
  // in horizontal-scroll rows (Continue Learning, Certificates). This is a
  // real prop rather than a `className="w-full"` override because
  // Tailwind's generated stylesheet orders same-property utilities by its
  // own internal scale, not by where a class appears in the JSX string —
  // "w-full" isn't guaranteed to win over the default "w-56" that way (the
  // same class of bug already hit once on Button's "inverse" variant).
  fullWidth = false,
  compact = true,
  size = "compact",
  resumeLabel = "Resume",
  meta,
  description,
  className = "",
}) {
  return (
    <div
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(e) => {
        if (onClick && (e.key === "Enter" || e.key === " ")) onClick(e);
      }}
      className={`group mx-auto flex ${
        size === "feature" ? "w-[360px] max-w-[360px]" : size === "sm" ? "w-[190px] max-w-[190px] shrink-0" : fullWidth ? "w-full max-w-[280px]" : "w-[280px] shrink-0"
      } ${compact ? (size === "feature" ? "h-[390px]" : size === "sm" ? "h-[268px]" : "h-[340px]") : ""} flex-col overflow-hidden rounded-xl border border-text/10 bg-white shadow-[0_1px_2px_rgb(26_26_26/0.04)] transition-[transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgb(26_26_26/0.08)] ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      <div className={`relative w-full overflow-hidden ${compact ? "aspect-[16/9]" : "aspect-[4/3]"}`}>
        {image ? (
          <img
            src={image}
            alt=""
            onError={(e) => imgFallback(e, title ?? "card", 480, 360)}
            className="h-full w-full object-cover object-bottom"
          />
        ) : Illustration ? (
          <Illustration className="h-full w-full text-white" aria-hidden="true" />
        ) : (
          <div className="h-full w-full bg-black/10" aria-hidden="true" />
        )}
        {badge && (
          <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-primary">
            {badge}
          </span>
        )}
        {showWishlist && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleWishlist?.();
            }}
            aria-pressed={wishlisted}
            aria-label={wishlisted ? "Remove from wishlist" : "Save to wishlist"}
            className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-primary transition-transform duration-150 ease-out hover:scale-110"
          >
            <HeartIcon filled={wishlisted} />
          </button>
        )}
      </div>

      <div className={`flex flex-1 flex-col gap-2 ${size === "sm" ? "p-2.5" : compact ? "p-3" : "p-4"}`}>
        {/* min-h reserves 2 full lines regardless of actual title length, so a
            one-line title never leaves this card shorter than a two-line
            neighbor in the same grid row (Wishlist/Explore/Recommended). */}
        <h3 className={`line-clamp-2 font-display ${size === "sm" ? "text-[13px]" : "text-[15px]"} font-semibold leading-snug text-text ${compact ? (size === "sm" ? "min-h-[2.1rem]" : "min-h-[2.5rem]") : "min-h-[3rem]"}`}>
          {title}
        </h3>
        {subtitle && <p className="line-clamp-1 text-xs text-text/60">{subtitle}</p>}

        {meta && <p className="line-clamp-1 text-[11px] text-text/50">{meta}</p>}
        {description && size !== "sm" && <p className="line-clamp-2 text-[11px] leading-4 text-text/55">{description}</p>}
        {typeof progress === "number" ? (
          <div className="mt-auto flex items-center gap-2 pt-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-text/10">
              <div
                className="h-full rounded-full bg-primary"
                style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
              />
            </div>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onResume?.();
              }}
              className="shrink-0 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-white"
            >
              {resumeLabel}
            </button>
          </div>
        ) : (
          <div className="mt-auto flex flex-col gap-2 pt-2">
            {(price !== undefined || rating !== undefined) && (
              <div className="flex items-center justify-between text-sm font-semibold text-text">
                {price !== undefined && (
                  <span className="flex items-baseline gap-1.5">
                    <span>{price === 0 ? "Free" : `₹${price}`}</span>
                    {typeof originalPrice === "number" && originalPrice > price && (
                      <span className="text-xs font-normal text-text/45 line-through">
                        ₹{originalPrice}
                      </span>
                    )}
                  </span>
                )}
                {rating !== undefined && (
                  <span className="flex items-center gap-1 text-xs font-medium text-text/70">
                    <StarIcon className="h-3.5 w-3.5 fill-current text-primary" />
                    {rating}
                    {reviewCount !== undefined && (
                      <span className="font-normal text-text/45">({reviewCount})</span>
                    )}
                  </span>
                )}
              </div>
            )}
            {actionLabel && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onAction?.();
                }}
                className="w-full rounded-lg bg-primary px-3 py-2 text-xs font-semibold text-white transition-colors duration-150 hover:bg-primary/90"
              >
                {actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
