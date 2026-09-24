import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useActivityLog } from "../hooks/useActivityLog";
import { useLearningStats, formatHoursMinutes } from "../hooks/useLearningStats";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import {
  ClockIcon,
  FlameIcon,
  CheckIcon,
  PlayIcon,
  FileTextIcon,
  DownloadIcon,
  SearchIcon,
  ChevronRightIcon,
  CheckCircleIcon,
  RefreshIcon,
  AlertTriangleIcon,
} from "../../../components/ui/icons";

const FILTERS = [
  { id: "all", label: "All" },
  { id: "video", label: "Videos" },
  { id: "pdf", label: "PDFs" },
  { id: "text", label: "Text" },
  { id: "completed", label: "Completed" },
];

function groupActivitiesByDate(activities) {
  const groups = {
    today: [],
    yesterday: [],
    earlier: [],
  };

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;

  activities.forEach((act) => {
    const actTime = act.createdAt || Date.now();
    if (actTime >= todayStart) {
      groups.today.push(act);
    } else if (actTime >= yesterdayStart) {
      groups.yesterday.push(act);
    } else {
      groups.earlier.push(act);
    }
  });

  return groups;
}

function formatTime(ts) {
  try {
    return new Date(ts).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

export default function LearningHistory() {
  const navigate = useNavigate();
  const { entries } = useActivityLog();
  const stats = useLearningStats();

  const [activeFilter, setActiveFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  // Apply filters and search
  const filteredActivities = useMemo(() => {
    let list = entries;

    if (activeFilter === "video") {
      list = list.filter((a) => a.lessonType === "video" || a.activityType === "watched");
    } else if (activeFilter === "pdf") {
      list = list.filter((a) => a.lessonType === "resource" || a.lessonType === "pdf" || a.activityType === "viewed");
    } else if (activeFilter === "text") {
      list = list.filter((a) => a.lessonType === "article" || a.lessonType === "text" || a.activityType === "read");
    } else if (activeFilter === "completed") {
      list = list.filter((a) => a.activityType === "completed" || a.percent === 100);
    }

    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(
        (a) =>
          (a.courseTitle && a.courseTitle.toLowerCase().includes(q)) ||
          (a.lessonTitle && a.lessonTitle.toLowerCase().includes(q)) ||
          (a.moduleTitle && a.moduleTitle.toLowerCase().includes(q))
      );
    }

    return list;
  }, [entries, activeFilter, query]);

  const grouped = useMemo(() => groupActivitiesByDate(filteredActivities), [filteredActivities]);

  function handleContinue(activity) {
    const targetCourse = activity.courseId || "c1";
    const targetLesson = activity.lessonId || "l1";
    navigate(`/student/courseplayer?course=${targetCourse}&lesson=${targetLesson}`);
  }

  function handleRetry() {
    setError(false);
    setLoading(true);
    setTimeout(() => setLoading(false), 400);
  }

  if (error) {
    return (
      <div className="mx-auto max-w-[1600px] px-4 py-16 text-center">
        <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-full bg-danger/10 text-danger">
          <AlertTriangleIcon className="h-7 w-7" />
        </div>
        <h2 className="font-display text-xl font-bold text-text">Unable to load your learning activity</h2>
        <p className="mt-1 text-sm text-text/60">There was an issue retrieving your history log. Please try again.</p>
        <div className="mt-6">
          <Button fullWidth={false} onClick={handleRetry}>
            <RefreshIcon className="mr-1.5 h-4 w-4" /> Try Again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1600px] px-4 py-8 sm:px-6 lg:px-10">
      {/* Page Title & Stats Overview */}
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold tracking-tight text-text sm:text-3xl">
          Learning History
        </h1>
        <p className="mt-1 text-sm text-text/60">
          Review your learning sessions, completed milestones, and seamlessly resume where you left off.
        </p>

        {/* Quick Stats Bar */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-text/10 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-text/50">
              <ClockIcon className="h-4 w-4 text-primary" />
              <span className="text-xs font-semibold uppercase tracking-wider">Total Time</span>
            </div>
            <p className="mt-2 font-display text-xl font-bold text-text sm:text-2xl">
              {formatHoursMinutes(stats.totalSeconds)}
            </p>
          </div>

          <div className="rounded-2xl border border-text/10 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-text/50">
              <FlameIcon className="h-4 w-4 text-warning" />
              <span className="text-xs font-semibold uppercase tracking-wider">Streak</span>
            </div>
            <p className="mt-2 font-display text-xl font-bold text-text sm:text-2xl">
              {stats.streakDays} Days
            </p>
          </div>

          <div className="rounded-2xl border border-text/10 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-text/50">
              <CheckCircleIcon className="h-4 w-4 text-success" />
              <span className="text-xs font-semibold uppercase tracking-wider">Completed</span>
            </div>
            <p className="mt-2 font-display text-xl font-bold text-text sm:text-2xl">
              {stats.lessonsCompleted} Lessons
            </p>
          </div>

          <div className="rounded-2xl border border-text/10 bg-white p-4 shadow-xs">
            <div className="flex items-center gap-2 text-text/50">
              <ClockIcon className="h-4 w-4 text-rotation-3" />
              <span className="text-xs font-semibold uppercase tracking-wider">This Week</span>
            </div>
            <p className="mt-2 font-display text-xl font-bold text-text sm:text-2xl">
              {formatHoursMinutes(stats.thisWeekSeconds)}
            </p>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setActiveFilter(f.id)}
              className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-colors duration-150 ${
                activeFilter === f.id
                  ? "bg-primary text-white shadow-xs"
                  : "border border-primary/20 bg-white text-primary hover:bg-primary/5"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative max-w-xs flex-1">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text/40" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search history..."
            className="w-full rounded-full border border-text/10 bg-white py-2 pl-10 pr-4 text-xs text-text placeholder:text-text/35 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* Layout Grid: History List + Recent Activity Timeline */}
      <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
        {/* Main History Feed */}
        <div className="space-y-6">
          {loading ? (
            <div className="space-y-3">
              <div className="h-20 animate-pulse rounded-2xl bg-text/5" />
              <div className="h-20 animate-pulse rounded-2xl bg-text/5" />
              <div className="h-20 animate-pulse rounded-2xl bg-text/5" />
            </div>
          ) : filteredActivities.length === 0 ? (
            /* Empty State */
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-text/15 bg-white p-12 text-center">
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
                <ClockIcon className="h-7 w-7" />
              </div>
              <h3 className="font-display text-lg font-bold text-text">No learning activity yet</h3>
              <p className="mt-1 max-w-sm text-sm text-text/60">
                Start watching lessons or taking notes in your courses to track your activity here.
              </p>
              <div className="mt-6">
                <Button fullWidth={false} onClick={() => navigate("/student/explore")}>
                  Explore Courses
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* Group: Today */}
              {grouped.today.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-primary">
                      Today
                    </span>
                    <div className="h-px flex-1 bg-text/10" />
                  </div>
                  <div className="space-y-3">
                    {grouped.today.map((act) => (
                      <ActivityCard key={act.id} activity={act} onContinue={handleContinue} />
                    ))}
                  </div>
                </div>
              )}

              {/* Group: Yesterday */}
              {grouped.yesterday.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-text/50">
                      Yesterday
                    </span>
                    <div className="h-px flex-1 bg-text/10" />
                  </div>
                  <div className="space-y-3">
                    {grouped.yesterday.map((act) => (
                      <ActivityCard key={act.id} activity={act} onContinue={handleContinue} />
                    ))}
                  </div>
                </div>
              )}

              {/* Group: Earlier */}
              {grouped.earlier.length > 0 && (
                <div>
                  <div className="mb-3 flex items-center gap-2">
                    <span className="font-display text-xs font-bold uppercase tracking-wider text-text/50">
                      Earlier This Week
                    </span>
                    <div className="h-px flex-1 bg-text/10" />
                  </div>
                  <div className="space-y-3">
                    {grouped.earlier.map((act) => (
                      <ActivityCard key={act.id} activity={act} onContinue={handleContinue} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Sidebar: Recent Activity Timeline (Spec Section 6) */}
        <div className="space-y-6">
          <div className="rounded-3xl border border-text/10 bg-white p-5 shadow-xs">
            <h3 className="font-display text-sm font-bold uppercase tracking-wider text-text">
              Recent Activity Timeline
            </h3>
            <p className="mt-0.5 text-xs text-text/50">Chronological learning actions</p>

            <div className="mt-5 space-y-6">
              {/* TODAY Timeline block */}
              {grouped.today.length > 0 && (
                <div>
                  <p className="mb-3 font-display text-[11px] font-bold uppercase tracking-wider text-primary">
                    Today
                  </p>
                  <ul className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-primary/20">
                    {grouped.today.slice(0, 4).map((item) => (
                      <li key={item.id} className="relative text-xs">
                        <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-primary" />
                        <span className="font-semibold text-text">
                          {item.activityType === "completed" ? "✓ Completed " : item.activityType === "watched" ? "▶ Watched " : "📝 Added note to "}
                        </span>
                        <span className="text-text/70">&ldquo;{item.lessonTitle || "Lesson"}&rdquo;</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* YESTERDAY Timeline block */}
              {grouped.yesterday.length > 0 && (
                <div>
                  <p className="mb-3 font-display text-[11px] font-bold uppercase tracking-wider text-text/50">
                    Yesterday
                  </p>
                  <ul className="relative space-y-3 pl-4 before:absolute before:left-1 before:top-2 before:bottom-2 before:w-0.5 before:bg-text/15">
                    {grouped.yesterday.slice(0, 4).map((item) => (
                      <li key={item.id} className="relative text-xs">
                        <span className="absolute -left-[19px] top-1 h-2 w-2 rounded-full bg-text/40" />
                        <span className="font-semibold text-text">
                          {item.activityType === "completed" ? "✓ Completed " : item.activityType === "watched" ? "▶ Watched " : "📝 Added note to "}
                        </span>
                        <span className="text-text/70">&ldquo;{item.lessonTitle || "Lesson"}&rdquo;</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Activity Card Component
function ActivityCard({ activity, onContinue }) {
  const isComplete = activity.activityType === "completed" || activity.percent === 100;
  const isVideo = activity.lessonType === "video" || activity.activityType === "watched";
  const isResource = activity.lessonType === "resource" || activity.activityType === "viewed";
  const isNote = activity.activityType === "note";

  return (
    <div className="flex flex-col justify-between gap-3 rounded-2xl border border-text/10 bg-white p-4 shadow-xs transition-all hover:border-primary/30 sm:flex-row sm:items-center">
      <div className="flex items-start gap-3.5 min-w-0 flex-1">
        {/* Type Icon Badge */}
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
            isComplete
              ? "bg-success/10 text-success"
              : isVideo
              ? "bg-primary/10 text-primary"
              : isNote
              ? "bg-warning/10 text-warning"
              : "bg-rotation-3/15 text-rotation-3"
          }`}
        >
          {isComplete ? (
            <CheckIcon className="h-5 w-5" />
          ) : isVideo ? (
            <PlayIcon className="h-4 w-4" />
          ) : isResource ? (
            <DownloadIcon className="h-5 w-5" />
          ) : (
            <FileTextIcon className="h-5 w-5" />
          )}
        </div>

        {/* Content details */}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-bg px-2 py-0.5 text-[11px] font-semibold text-text/70">
              {activity.courseTitle || "Course"}
            </span>
            <span className="text-xs text-text/40">·</span>
            <span className="text-xs text-text/50">{formatTime(activity.createdAt)}</span>
          </div>

          <p className="mt-0.5 font-display text-sm font-bold text-text truncate">
            {activity.lessonTitle || "Lesson"}
          </p>

          <p className="text-xs text-text/50 truncate">
            {activity.moduleTitle || "Module"}
          </p>
        </div>
      </div>

      {/* Progress Badge and Action */}
      <div className="flex items-center justify-between gap-4 border-t border-text/5 pt-2 sm:border-0 sm:pt-0">
        <div className="shrink-0 text-left sm:text-right">
          {isComplete ? (
            <StatusBadge status="success">✓ Completed</StatusBadge>
          ) : activity.percent ? (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {Math.round(activity.percent)}% watched
            </span>
          ) : (
            <StatusBadge status="warning">In Progress</StatusBadge>
          )}
        </div>

        <Button
          variant="secondary"
          fullWidth={false}
          onClick={() => onContinue(activity)}
          className="!py-1.5 !px-3 text-xs"
        >
          Continue <ChevronRightIcon className="ml-1 h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
