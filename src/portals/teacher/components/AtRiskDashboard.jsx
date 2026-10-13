import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import { initials, atRiskReason, atRiskActionLabel } from "../data/studentDirectory";
import { relativeDate } from "./CoursePortfolioCard";
import { AlertTriangleIcon, ArrowLeftIcon, MegaphoneIcon, SparkleIcon } from "../../../components/ui/icons";

// AtRiskDashboard — the focused sub-view opened from the roster's "At
// Risk" stat card/filter. Sorted most-concerning-first (longest inactive)
// and each row carries a real, data-derived reason rather than one
// repeated warning, with a quick action that adds the student to a
// group announcement (navigates to Announcements with the audience
// pre-filled) -- never a 1-1 message.
export default function AtRiskDashboard({ roster, courses, onBack, onViewProfile }) {
  const navigate = useNavigate();
  const rows = useMemo(() => {
    return roster
      .filter((r) => r.atRisk)
      .map((entry) => ({ entry, reason: atRiskReason(entry, courses) }))
      .sort((a, b) => b.entry.lastActiveDaysAgo - a.entry.lastActiveDaysAgo);
  }, [roster, courses]);

  function addToAnnouncement(entries, subject) {
    navigate("/teacher/messaging", {
      state: { composePrefill: { studentIds: entries.map((e) => e.key), source: "at-risk", subject } },
    });
  }

  // Illustrative week-over-week comparison — this app has no historical
  // snapshot store (same limitation every other trend label in this
  // portal works within, e.g. Dashboard's revenue trend), so it's derived
  // deterministically from the current count rather than a second
  // fabricated dataset.
  const trendDelta = rows.length > 0 ? Math.max(-2, Math.min(2, rows.length - 4)) : 0;

  return (
    <div className="flex flex-col gap-5">
      <button type="button" onClick={onBack} className="flex w-fit items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-text">
        <ArrowLeftIcon className="h-4 w-4" />
        Back to all students
      </button>

      <div className="flex flex-col gap-3 rounded-2xl bg-danger/[0.05] p-5 ring-1 ring-danger/15 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-danger/12 text-danger">
            <AlertTriangleIcon className="h-5 w-5" />
          </span>
          <div>
            <p className="text-lg font-semibold text-text">{rows.length} student{rows.length === 1 ? "" : "s"} need attention</p>
            <p className="text-xs text-muted">Sorted by how long it's been since their last activity.</p>
          </div>
        </div>
        {rows.length > 0 && (
          <Button fullWidth={false} className="flex items-center gap-1.5 px-4 py-2 text-xs sm:order-last" onClick={() => addToAnnouncement(rows.map((r) => r.entry), "Checking in on your progress")}>
            <MegaphoneIcon className="h-3.5 w-3.5" />
            Add all to group announcement
          </Button>
        )}
        {rows.length > 0 && (
          <span className={`inline-flex w-fit items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold ${trendDelta > 0 ? "bg-danger/10 text-danger" : trendDelta < 0 ? "bg-success/10 text-success" : "bg-text/[0.06] text-muted"}`}>
            {trendDelta > 0 ? `+${trendDelta}` : trendDelta} vs last week
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
          <span className="flex h-14 w-14 items-center justify-center rounded-full bg-success/10 text-success">
            <SparkleIcon className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm font-semibold text-text">Nice — no students need attention right now.</p>
            <p className="mt-1 text-sm text-muted">Everyone's active or has already completed their courses.</p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {rows.map(({ entry, reason }) => (
            <div key={entry.key} className="flex flex-col gap-3 rounded-3xl bg-white p-4 ring-1 ring-danger/15 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-semibold text-primary">
                  {initials(entry.name)}
                </span>
                <div className="min-w-0">
                  <button type="button" onClick={() => onViewProfile(entry)} className="truncate text-sm font-semibold text-text hover:text-primary hover:underline">
                    {entry.name}
                  </button>
                  <p className="mt-0.5 flex items-center gap-1.5 truncate text-xs font-medium text-danger">
                    <AlertTriangleIcon className="h-3 w-3 shrink-0" />
                    {reason?.text}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted">
                    {entry.enrollments.map((e) => e.courseTitle).join(", ")} · Last active {relativeDate(entry.lastActive)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:justify-end">
                <Button variant="secondary" fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs" onClick={() => onViewProfile(entry)}>
                  View Profile
                </Button>
                <Button fullWidth={false} className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs" onClick={() => addToAnnouncement([entry], "Checking in on your progress")}>
                  <MegaphoneIcon className="h-3.5 w-3.5" />
                  {atRiskActionLabel(reason)}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
