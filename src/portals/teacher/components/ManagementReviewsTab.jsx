import { useMemo, useState } from "react";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { starDistribution } from "../data/teacherCourses";
import Button from "../../../components/ui/Button";
import { StarIcon, ReplyIcon, SendIcon } from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";
import EmptyState from "../../../components/ui/EmptyState";

const SORTS = [
  { key: "recent", label: "Most Recent" },
  { key: "highest", label: "Highest Rated" },
  { key: "lowest", label: "Lowest Rated" },
  { key: "text", label: "With Text Only" },
];

function sortReviews(reviews, sort) {
  const list = [...reviews];
  switch (sort) {
    case "highest":
      return list.sort((a, b) => b.rating - a.rating);
    case "lowest":
      return list.sort((a, b) => a.rating - b.rating);
    case "text":
      return list.filter((r) => (r.text || "").trim().length > 0);
    case "recent":
    default:
      return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  }
}

function ReviewReply({ courseId, review }) {
  const { replyToReview } = useTeacherCourses();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState("");

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
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-primary hover:opacity-70"
      >
        <ReplyIcon className="h-3.5 w-3.5" />
        Reply
      </button>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2">
      <textarea
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder="Write a reply this student will see…"
        rows={2}
        className="w-full rounded-xl border border-text/15 bg-bg px-3.5 py-2.5 text-sm text-text outline-none focus:border-primary/40"
      />
      <div className="flex items-center gap-2">
        <Button
          variant="primary"
          fullWidth={false}
          disabled={!draft.trim()}
          className="flex items-center gap-1.5 px-4 py-1.5 text-xs"
          onClick={() => replyToReview(courseId, review.id, draft.trim())}
        >
          <SendIcon className="h-3.5 w-3.5" />
          Send
        </Button>
        <Button variant="secondary" fullWidth={false} className="px-4 py-1.5 text-xs" onClick={() => setOpen(false)}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

export default function ManagementReviewsTab({ course }) {
  const [sort, setSort] = useState("recent");
  const distribution = starDistribution(course);
  const sorted = useMemo(() => sortReviews(course.reviews, sort), [course.reviews, sort]);

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex flex-col items-start gap-6 sm:flex-row">
          <div className="shrink-0 text-center">
            <div className="text-4xl font-bold text-text">{course.ratingCount ? course.rating.toFixed(1) : "—"}</div>
            <div className="mt-1 flex items-center justify-center gap-0.5 text-warning">
              {[1, 2, 3, 4, 5].map((s) => (
                <StarIcon key={s} className={`h-4 w-4 ${s <= Math.round(course.rating) ? "" : "opacity-25"}`} />
              ))}
            </div>
            <div className="mt-1 text-xs text-muted">{course.ratingCount} reviews</div>
          </div>
          <div className="flex flex-1 flex-col gap-1.5">
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
      </section>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-text">All reviews</h2>
        <Select
          value={sort}
          onChange={(e) => setSort(e.target.value)}
          className="rounded-full border border-text/15 bg-white px-4 py-2 pr-8 text-xs font-medium text-text outline-none focus:border-primary/40"
        >
          {SORTS.map((s) => (
            <option key={s.key} value={s.key}>
              {s.label}
            </option>
          ))}
        </Select>
      </div>

      {sorted.length === 0 ? (
        <EmptyState icon={StarIcon} heading="No reviews yet" message="Reviews from your students will show up here." />
      ) : (
        <div className="flex flex-col gap-3">
          {sorted.map((r) => (
            <div key={r.id} className="rounded-3xl bg-white p-4 sm:p-5 shadow-soft">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                    {r.studentName.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-text">{r.studentName}</p>
                    <div className="mt-0.5 flex items-center gap-1 text-warning">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <StarIcon key={s} className={`h-3 w-3 ${s <= r.rating ? "" : "opacity-25"}`} />
                      ))}
                    </div>
                  </div>
                </div>
                <span className="shrink-0 text-xs text-muted">{r.date}</span>
              </div>
              <p className="mt-3 text-sm text-muted">{r.text}</p>
              <ReviewReply courseId={course.id} review={r} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
