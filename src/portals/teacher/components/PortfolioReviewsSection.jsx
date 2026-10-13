import { useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { useOnClickOutside } from "../hooks/useOnClickOutside";
import { daysAgo } from "../data/teacherCourses";
import StatCard from "../../../components/ui/StatCard";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import {
  StarIcon,
  MessageIcon,
  ReplyIcon,
  SendIcon,
  SearchIcon,
  ChevronDownIcon,
  CheckIcon,
  FlagIcon,
  ClockIcon,
} from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

const RATING_FILTERS = [
  { key: "all", label: "All" },
  { key: "5", label: "5★" },
  { key: "4", label: "4★" },
  { key: "3", label: "3★" },
  { key: "2", label: "2★" },
  { key: "1", label: "1★" },
];

const REPLY_FILTERS = [
  { key: "all", label: "All" },
  { key: "replied", label: "Replied" },
  { key: "awaiting", label: "Awaiting Reply" },
];

const SORTS = [
  { key: "recent", label: "Most Recent" },
  { key: "highest", label: "Highest Rated" },
  { key: "lowest", label: "Lowest Rated" },
  { key: "text", label: "With Text Only" },
  { key: "awaiting", label: "Awaiting Reply First" },
];

const REPORT_REASONS = ["Spam or fake", "Off-topic / not about the course", "Inappropriate language", "Other"];

function StarRow({ rating, size = "h-3.5 w-3.5" }) {
  return (
    <div className="flex items-center gap-0.5 text-warning">
      {[1, 2, 3, 4, 5].map((s) => (
        <StarIcon key={s} className={`${size} ${s <= Math.round(rating) ? "" : "opacity-25"}`} />
      ))}
    </div>
  );
}

function CourseMultiSelect({ courses, selected, onChange }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false));
  const allSelected = selected.length === 0;

  function toggle(id) {
    onChange(selected.includes(id) ? selected.filter((c) => c !== id) : [...selected, id]);
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-text/15 bg-white px-4 py-2.5 text-sm font-medium text-text"
      >
        {allSelected ? "All Courses" : `${selected.length} course${selected.length === 1 ? "" : "s"}`}
        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute left-0 top-full z-20 mt-1.5 w-64 overflow-hidden rounded-2xl bg-white py-1.5 shadow-lg">
          <button
            type="button"
            onClick={() => onChange([])}
            className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-text hover:bg-bg"
          >
            <span className={`flex h-4 w-4 items-center justify-center rounded border ${allSelected ? "border-primary bg-primary text-white" : "border-text/25"}`}>
              {allSelected && <CheckIcon className="h-3 w-3" />}
            </span>
            All Courses
          </button>
          <div className="my-1 border-t border-text/[0.06]" />
          {courses.map((c) => {
            const checked = selected.includes(c.id);
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => toggle(c.id)}
                className="flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-sm text-text hover:bg-bg"
              >
                <span className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border ${checked ? "border-primary bg-primary text-white" : "border-text/25"}`}>
                  {checked && <CheckIcon className="h-3 w-3" />}
                </span>
                <span className="truncate">{c.title}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ReportMenu({ onReport }) {
  const [open, setOpen] = useState(false);
  const [reported, setReported] = useState(false);
  const ref = useRef(null);
  useOnClickOutside(ref, () => setOpen(false));

  if (reported) {
    return <span className="text-xs font-medium text-muted">Reported</span>;
  }

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Report review"
        className="rounded-full p-1.5 text-muted transition-colors duration-150 hover:bg-danger/10 hover:text-danger"
      >
        <FlagIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1 w-56 overflow-hidden rounded-2xl bg-white py-1 shadow-lg">
          <p className="px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted">Report this review</p>
          {REPORT_REASONS.map((reason) => (
            <button
              key={reason}
              type="button"
              onClick={() => {
                setOpen(false);
                setReported(true);
                onReport?.(reason);
              }}
              className="flex w-full items-center px-3.5 py-2 text-left text-sm text-text hover:bg-bg"
            >
              {reason}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function ReplyBlock({ courseId, review, replyToReview }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");
  const LIMIT = 400;

  if (review.reply) {
    return (
      <div className="mt-3 rounded-xl bg-primary/[0.05] px-3.5 py-2.5 text-sm text-muted">
        <span className="mb-0.5 block text-xs font-semibold text-primary">Your reply</span>
        {review.reply}
      </div>
    );
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-70">
        <ReplyIcon className="h-3.5 w-3.5" />
        Reply
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-1.5 motion-safe:animate-[rise-in_0.25s_ease-out_both]">
      <textarea
        autoFocus
        maxLength={LIMIT}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a reply this student will see…"
        rows={2}
        className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary/40"
      />
      <div className="flex items-center justify-between">
        <span className="text-[11px] text-muted">{draft.length}/{LIMIT}</span>
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            fullWidth={false}
            disabled={!draft.trim()}
            className="flex items-center gap-1.5 px-4 py-1.5 text-xs"
            onClick={() => {
              replyToReview(courseId, review.id, draft.trim());
              setOpen(false);
            }}
          >
            <SendIcon className="h-3.5 w-3.5" />
            Post
          </Button>
          <Button variant="secondary" fullWidth={false} className="px-4 py-1.5 text-xs" onClick={() => setOpen(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}

function ReviewCard({ review, replyToReview }) {
  const navigate = useNavigate();
  return (
    <div className="rounded-3xl bg-white p-4 sm:p-5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
            {review.studentName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
          </span>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="text-sm font-semibold text-text">{review.studentName}</p>
              {review.verified && (
                <span className="flex items-center gap-0.5 rounded-full bg-success/12 px-1.5 py-0.5 text-[10px] font-semibold text-success" title="Verified enrollment">
                  <CheckIcon className="h-2.5 w-2.5" />
                  Verified
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-2">
              <StarRow rating={review.rating} />
              <span className="text-xs text-muted">{review.date}</span>
            </div>
          </div>
        </div>
        <ReportMenu />
      </div>

      <p className="mt-3 text-sm text-muted">{review.text}</p>

      <button
        type="button"
        onClick={() => navigate(`/teacher/coursemanagement/${review.courseId}`)}
        className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-bg px-3 py-1 text-xs font-semibold text-muted transition-colors duration-150 hover:bg-primary/[0.08] hover:text-primary"
      >
        {review.courseTitle}
      </button>

      <ReplyBlock courseId={review.courseId} review={review} replyToReview={replyToReview} />
    </div>
  );
}

function sortReviews(reviews, sort) {
  const list = [...reviews];
  switch (sort) {
    case "highest":
      return list.sort((a, b) => b.rating - a.rating);
    case "lowest":
      return list.sort((a, b) => a.rating - b.rating);
    case "text":
      return list.filter((r) => (r.text || "").trim().length > 0);
    case "awaiting":
      return list.sort((a, b) => Number(Boolean(a.reply)) - Number(Boolean(b.reply)));
    case "recent":
    default:
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

export default function PortfolioReviewsSection() {
  const { courses, replyToReview } = useTeacherCourses();
  const [courseFilter, setCourseFilter] = useState([]);
  const [ratingFilter, setRatingFilter] = useState("all");
  const [replyFilter, setReplyFilter] = useState("all");
  const [sort, setSort] = useState("recent");
  const [search, setSearch] = useState("");

  const allReviews = useMemo(
    () =>
      courses.flatMap((c) =>
        c.reviews.map((r) => ({ ...r, courseId: c.id, courseTitle: c.title }))
      ),
    [courses]
  );

  const stats = useMemo(() => {
    const total = allReviews.length;
    const avg = total ? allReviews.reduce((s, r) => s + r.rating, 0) / total : 0;
    const thisMonth = allReviews.filter((r) => daysAgo(r.date) <= 30).length;
    const replied = allReviews.filter((r) => r.reply).length;
    const responseRate = total ? Math.round((replied / total) * 100) : 0;
    const awaiting = total - replied;
    return { total, avg, thisMonth, responseRate, awaiting };
  }, [allReviews]);

  const distribution = useMemo(() => {
    const counts = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
    allReviews.forEach((r) => {
      counts[Math.round(r.rating)] = (counts[Math.round(r.rating)] || 0) + 1;
    });
    return [5, 4, 3, 2, 1].map((star) => ({
      star,
      count: counts[star] || 0,
      pct: stats.total ? Math.round(((counts[star] || 0) / stats.total) * 100) : 0,
    }));
  }, [allReviews, stats.total]);

  const filtered = useMemo(() => {
    let list = allReviews;
    if (courseFilter.length > 0) list = list.filter((r) => courseFilter.includes(r.courseId));
    if (ratingFilter !== "all") list = list.filter((r) => Math.round(r.rating) === Number(ratingFilter));
    if (replyFilter === "replied") list = list.filter((r) => r.reply);
    if (replyFilter === "awaiting") list = list.filter((r) => !r.reply);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((r) => r.text.toLowerCase().includes(q) || r.studentName.toLowerCase().includes(q));
    }
    return sortReviews(list, sort);
  }, [allReviews, courseFilter, ratingFilter, replyFilter, search, sort]);

  const hasAnyReviews = allReviews.length > 0;

  function clearFilters() {
    setCourseFilter([]);
    setRatingFilter("all");
    setReplyFilter("all");
    setSearch("");
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div className="rounded-3xl bg-white p-5 shadow-soft">
          <div className="flex items-center justify-between">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/12 text-warning">
              <StarIcon />
            </span>
          </div>
          <div className="mt-4 flex items-baseline gap-2">
            <span className="text-2xl font-semibold tracking-tight text-text">{stats.total ? stats.avg.toFixed(1) : "—"}</span>
            <StarRow rating={stats.avg} size="h-3 w-3" />
          </div>
          <div className="mt-1 text-sm text-muted">Overall Average Rating</div>
        </div>
        <StatCard icon={MessageIcon} tone="blue" label="Total Reviews" value={stats.total} />
        <StatCard icon={ClockIcon} tone="orange" label="Reviews This Month" value={stats.thisMonth} trend={stats.thisMonth > 0 ? { direction: "up", label: `+${stats.thisMonth}` } : undefined} />
        <StatCard icon={CheckIcon} tone="sage" label="Response Rate" value={`${stats.responseRate}%`} ring={stats.responseRate} />
      </div>

      {/* Distribution */}
      {hasAnyReviews && (
        <div className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
          <h2 className="mb-4 text-base font-bold text-text">Rating distribution across all courses</h2>
          <div className="flex flex-col gap-1.5">
            {distribution.map((d) => (
              <div key={d.star} className="flex items-center gap-2 text-xs">
                <span className="w-8 shrink-0 text-muted">{d.star}★</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-warning transition-all duration-300" style={{ width: `${d.pct}%` }} />
                </div>
                <span className="w-8 shrink-0 text-right text-muted">{d.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {!hasAnyReviews ? (
        <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-20 text-center shadow-soft">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
            <StarIcon />
          </span>
          <h3 className="mt-4 text-lg font-semibold text-text">No reviews yet</h3>
          <p className="mt-1.5 max-w-sm text-sm text-muted">
            Reviews appear here once students complete a course and leave feedback — across every course you've published.
          </p>
        </div>
      ) : (
        <>
          {/* Filters */}
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <CourseMultiSelect courses={courses} selected={courseFilter} onChange={setCourseFilter} />
              {RATING_FILTERS.map((f) => (
                <Chip key={f.key} active={ratingFilter === f.key} onClick={() => setRatingFilter(f.key)} className="px-3.5 py-1.5 text-xs">
                  {f.label}
                </Chip>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {REPLY_FILTERS.map((f) => (
                <Chip key={f.key} active={replyFilter === f.key} onClick={() => setReplyFilter(f.key)} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs">
                  {f.label}
                  {f.key === "awaiting" && stats.awaiting > 0 && (
                    <span className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${replyFilter === "awaiting" ? "bg-white/25 text-white" : "bg-danger/15 text-danger"}`}>
                      {stats.awaiting}
                    </span>
                  )}
                </Chip>
              ))}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-xs">
                <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search review text or student…"
                  className="w-full rounded-full border border-text/10 bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-muted outline-none focus:border-primary/40"
                />
              </div>
              <Select
                value={sort}
                onChange={(e) => setSort(e.target.value)}
                className="rounded-full border border-text/15 bg-white px-4 py-2.5 pr-9 text-sm font-medium text-text outline-none focus:border-primary/40"
              >
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>
                    Sort: {s.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
              <SearchIcon className="h-6 w-6 text-text/20" />
              <h3 className="mt-3 text-base font-semibold text-text">No reviews match these filters</h3>
              <Button variant="secondary" fullWidth={false} className="mt-5 px-5" onClick={clearFilters}>
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {filtered.map((r) => (
                <ReviewCard key={r.id} review={r} replyToReview={replyToReview} />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
