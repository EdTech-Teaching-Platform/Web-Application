import { CertificateIcon } from "../../../components/ui/icons";

function stripHtml(html = "") {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

// GradeSummaryCard — the one compact "graded submission" format reused
// wherever a grade needs to surface after the Grading panel closes: the
// Grading queue's "Recently graded" list and a student's own progress
// detail in the Students tab both render this exact shape, so a score
// never gets a second, slightly different presentation somewhere else.
export default function GradeSummaryCard({ title, score, maxScore, feedback, gradedAt, gradedBy }) {
  const excerpt = stripHtml(feedback);
  const pct = maxScore ? Math.round((score / maxScore) * 100) : null;

  return (
    <div className="flex flex-col gap-2 rounded-2xl bg-white p-3.5 shadow-soft">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {title && <p className="truncate text-sm font-medium text-text">{title}</p>}
          {gradedAt && (
            <p className="mt-0.5 text-xs text-muted">
              Graded {gradedAt}
              {gradedBy ? ` · by ${gradedBy}` : ""}
            </p>
          )}
        </div>
        <span
          className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
            pct === null ? "bg-text/[0.06] text-muted" : pct >= 70 ? "bg-success/12 text-success" : pct >= 40 ? "bg-warning/12 text-warning" : "bg-danger/12 text-danger"
          }`}
        >
          <CertificateIcon className="h-3 w-3" />
          {score}
          {maxScore ? `/${maxScore}` : ""}
        </span>
      </div>
      {excerpt && <p className="line-clamp-2 text-xs text-muted">{excerpt}</p>}
    </div>
  );
}
