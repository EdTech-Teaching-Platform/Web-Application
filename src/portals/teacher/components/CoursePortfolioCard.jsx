import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CourseStatusBadge from "./CourseStatusBadge";
import CourseQuickActionsMenu from "./CourseQuickActionsMenu";
import Modal from "../../../components/ui/Modal";
import Button from "../../../components/ui/Button";
import { courseMonthlyRevenue, daysAgo } from "../data/teacherCourses";
import { formatMoney } from "../../../utils/formatMoney";
import { StarIcon, UsersIcon, BookIcon, ClockIcon, FlagIcon, EyeIcon, WalletIcon } from "../../../components/ui/icons";

const ROTATION_CLASSES = ["bg-pastel-orange", "bg-pastel-blue", "bg-pastel-sage", "bg-pastel-lavender"];

export function totalLessonCount(course) {
  return course.modules.reduce((s, m) => s + m.lessons.length, 0);
}

export function relativeDate(dateStr) {
  const d = daysAgo(dateStr);
  if (d === 0) return "Today";
  if (d === 1) return "Yesterday";
  if (d < 7) return `${d}d ago`;
  if (d < 30) return `${Math.round(d / 7)}w ago`;
  return `${Math.round(d / 30)}mo ago`;
}

function AdminFeedbackQuickView({ course }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setOpen(true);
        }}
        className="flex w-full items-center gap-2 rounded-xl bg-danger/10 px-3 py-2 text-left text-xs font-medium text-danger transition-colors duration-150 hover:bg-danger/15"
      >
        <FlagIcon className="h-3.5 w-3.5 shrink-0" />
        <span className="flex-1 truncate">Admin feedback available</span>
        <EyeIcon className="h-3.5 w-3.5 shrink-0" />
      </button>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Feedback from our review team"
        footer={
          <Button variant="secondary" fullWidth={false} onClick={() => setOpen(false)}>
            Close
          </Button>
        }
      >
        <p className="text-sm text-muted">"{course.adminFeedback}"</p>
      </Modal>
    </>
  );
}

function CardCallouts({ course, compact = false }) {
  if (course.status === "pending_review") {
    return (
      <div className="flex items-center gap-2 rounded-xl bg-warning/10 px-3 py-2 text-xs font-medium text-warning">
        <ClockIcon className="h-3.5 w-3.5 shrink-0" />
        Frozen — under admin review
      </div>
    );
  }
  if (course.status === "changes_requested" && course.adminFeedback) {
    return <AdminFeedbackQuickView course={course} />;
  }
  if (course.status === "published") {
    const revenue = courseMonthlyRevenue(course);
    return (
      <div className={`flex items-center gap-2 rounded-xl bg-success/10 px-3 py-2 text-xs font-semibold text-success ${compact ? "" : ""}`}>
        <WalletIcon className="h-3.5 w-3.5 shrink-0" />
        {formatMoney(revenue, course.currency)} this month
      </div>
    );
  }
  return null;
}

function RatingLabel({ course }) {
  return (
    <span className="flex items-center gap-1">
      <StarIcon className="h-3.5 w-3.5 text-warning" />
      {course.ratingCount ? course.rating.toFixed(1) : "—"}
    </span>
  );
}

// CoursePortfolioCard — the grid-view course card for My Courses. Mirrors
// ColorBlockCard's exact visuals (same rotation tokens, radius, hover lift)
// but is its own component rather than a wrapped ColorBlockCard: this card
// hosts real interactive controls inside it (the quick-actions kebab menu,
// the admin-feedback quick-view button) which can't safely nest inside
// ColorBlockCard's own <button> wrapper — a button-in-button is invalid
// HTML. So the whole-card click target here is a div with role="button"
// instead, and every inner control stops propagation.
export function CoursePortfolioCard({ course, rotation }) {
  const navigate = useNavigate();
  const blockClass = ROTATION_CLASSES[rotation % ROTATION_CLASSES.length];

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/teacher/coursemanagement/${course.id}`)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(`/teacher/coursemanagement/${course.id}`)}
      className="group flex w-full flex-col overflow-hidden rounded-3xl bg-white text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-12px_rgba(26,26,26,0.2)] shadow-soft"
    >
      <div className={`relative h-24 w-full ${blockClass}`}>
        <div className="absolute right-3 top-3 flex items-center gap-1.5">
          <CourseStatusBadge status={course.status} />
          <span className="rounded-full bg-white/70 backdrop-blur">
            <CourseQuickActionsMenu course={course} />
          </span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-3 p-6">
        <div>
          <div className="eyebrow-muted">{course.category}</div>
          <h3 className="mt-1 line-clamp-2 text-lg font-bold leading-snug text-text">{course.title}</h3>
          <p className="mt-1 line-clamp-1 text-xs text-muted">{course.subtitle}</p>
        </div>

        <div className="mt-auto grid grid-cols-4 gap-2 border-t border-text/[0.07] pt-3 text-sm">
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Students</span>
            <span className="flex items-center gap-1 font-semibold text-text">
              <UsersIcon className="h-3.5 w-3.5 text-muted" />
              {course.students.length}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Rating</span>
            <span className="font-semibold text-text">
              <RatingLabel course={course} />
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Lessons</span>
            <span className="flex items-center gap-1 font-semibold text-text">
              <BookIcon className="h-3.5 w-3.5 text-muted" />
              {totalLessonCount(course)}
            </span>
          </div>
          <div className="flex flex-col">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted">Updated</span>
            <span className="font-semibold text-text">{relativeDate(course.updatedAt)}</span>
          </div>
        </div>

        <CardCallouts course={course} />
      </div>
    </div>
  );
}

// CoursePortfolioRow — the same information, list/table view: denser,
// row-based, same status badge and quick-action menu as the card.
export function CoursePortfolioRow({ course }) {
  const navigate = useNavigate();
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => navigate(`/teacher/coursemanagement/${course.id}`)}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && navigate(`/teacher/coursemanagement/${course.id}`)}
      className="grid w-full grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,0.8fr))_auto] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors duration-150 hover:bg-bg sm:gap-4"
    >
      <div className="flex min-w-0 items-center gap-3">
        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${ROTATION_CLASSES[0]} text-xs font-bold text-muted`}>
          {(course.title || "?").slice(0, 1)}
        </span>
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold text-text">{course.title}</div>
          <div className="truncate text-xs text-muted">{course.category}</div>
        </div>
      </div>

      <div className="hidden text-sm text-muted sm:block">
        <span className="flex items-center gap-1">
          <UsersIcon className="h-3.5 w-3.5 text-muted" />
          {course.students.length}
        </span>
      </div>
      <div className="hidden text-sm text-muted sm:block">
        <RatingLabel course={course} />
      </div>
      <div className="hidden text-sm text-muted sm:block">{totalLessonCount(course)} lessons</div>
      <div className="hidden text-sm text-muted sm:block">{relativeDate(course.updatedAt)}</div>

      <div className="flex shrink-0 items-center gap-2" onClick={(e) => e.stopPropagation()}>
        <CourseStatusBadge status={course.status} className="hidden md:inline-flex" />
        <CourseQuickActionsMenu course={course} />
      </div>
    </div>
  );
}
