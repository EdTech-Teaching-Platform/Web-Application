import StudentRosterCard from "./StudentRosterCard";
import EmptyState from "../../../components/ui/EmptyState";
import { ChevronDownIcon, DownloadIcon, UsersIcon } from "../../../components/ui/icons";

// One collapsible "By Course" section: course header (title + summary +
// per-course Export) over the same StudentRosterCard grid/list the flat
// view uses. Cards receive a per-course view of each student
// (enrollmentView), but profile actions are mapped back to the
// real multi-course entry via `source` so they behave exactly as in the
// flat roster.
export default function StudentCourseGroup({
  group,
  expanded,
  onToggle,
  displayMode,
  selected,
  onToggleSelect,
  onViewProfile,
  onExport,
}) {
  const { course, total, avgProgress, atRiskCount, items } = group;
  const panelId = `course-group-${course.id}`;
  const filteredOut = total > 0 && items.length === 0;

  return (
    <section className="rounded-3xl bg-surface shadow-soft">
      <div className="flex items-center gap-2 p-3 sm:p-4">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          aria-controls={panelId}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-2 py-1.5 text-left transition-colors hover:bg-bg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/[0.07] text-primary">
            <ChevronDownIcon className={`h-4 w-4 transition-transform duration-300 ease-out motion-reduce:transition-none ${expanded ? "rotate-0" : "-rotate-90"}`} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-base font-bold text-text">{course.title}</span>
            <span className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted">
              <span>
                {total} student{total === 1 ? "" : "s"}
              </span>
              {total > 0 && <span>Avg. progress {avgProgress}%</span>}
              {total > 0 && (
                <span className={atRiskCount > 0 ? "font-semibold text-danger" : ""}>
                  {atRiskCount} at risk
                </span>
              )}
              {total > 0 && items.length !== total && <span>{items.length} shown</span>}
            </span>
          </span>
        </button>
        <button
          type="button"
          onClick={() => onExport(course.id)}
          aria-label={`Export ${course.title} students`}
          title="Export this course"
          className="flex shrink-0 items-center gap-1.5 rounded-full px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/[0.07]"
        >
          <DownloadIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Export</span>
        </button>
      </div>

      <div
        id={panelId}
        role="region"
        aria-label={`${course.title} students`}
        aria-hidden={!expanded}
        className={`grid transition-[grid-template-rows,opacity,visibility] duration-300 ease-out motion-reduce:transition-none ${
          expanded ? "visible grid-rows-[1fr] opacity-100" : "invisible grid-rows-[0fr] opacity-0"
        }`}
      >
        <div className="min-h-0 overflow-hidden">
          <div className="px-3 pb-4 sm:px-4">
            {total === 0 ? (
              <EmptyState icon={UsersIcon} heading="No students in this course yet" message="Once someone enrolls, they'll show up here." className="bg-bg py-8 shadow-none" />
            ) : filteredOut ? (
              <p className="rounded-2xl bg-bg px-4 py-6 text-center text-sm text-muted">No students match these filters.</p>
            ) : displayMode === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {items.map((view) => (
                  <StudentRosterCard
                    key={view.key}
                    entry={view}
                    viewMode="grid"
                    selected={selected.includes(view.key)}
                    onToggleSelect={onToggleSelect}
                    onViewProfile={(v) => onViewProfile(v.source || v)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {items.map((view) => (
                  <StudentRosterCard
                    key={view.key}
                    entry={view}
                    viewMode="list"
                    selected={selected.includes(view.key)}
                    onToggleSelect={onToggleSelect}
                    onViewProfile={(v) => onViewProfile(v.source || v)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
