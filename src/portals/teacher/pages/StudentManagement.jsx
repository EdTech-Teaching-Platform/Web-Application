// Student Management — a portfolio-wide view of every student this
// educator has across all their courses, distinct from the per-course
// Students tab inside Course Management Overview (which stays the
// single-course view). Built from the exact same course/student records
// TeacherCoursesContext already holds and the exact same booking slots
// TeacherAvailabilityContext already holds — nothing here is a separate
// hardcoded roster.
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import { useTeacherAvailability } from "../context/TeacherAvailabilityContext";
import StatCard from "../../../components/ui/StatCard";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import Modal from "../../../components/ui/Modal";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import StudentRosterCard from "../components/StudentRosterCard";
import StudentCourseGroup from "../components/StudentCourseGroup";
import StudentExportPanel from "../components/StudentExportPanel";
import StudentProfileSheet from "../components/StudentProfileSheet";
import AtRiskDashboard from "../components/AtRiskDashboard";
import {
  buildRoster,
  rosterStats,
} from "../data/studentDirectory";
import { buildCourseGroups } from "../data/studentCourseGroups";
import {
  SearchIcon,
  UsersIcon,
  SparkleIcon,
  AlertTriangleIcon,
  TrendingUpIcon,
  GridIcon,
  RowsIcon,
  ChevronDownIcon,
  DownloadFileIcon,
  DownloadIcon,
  BookIcon,
} from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";

const STATUS_FILTERS = [
  { key: "all", label: "All" },
  { key: "active", label: "Active" },
  { key: "at-risk", label: "At Risk" },
  { key: "completed", label: "Completed" },
  { key: "not-started", label: "Not Started" },
];

const SORTS = [
  { key: "recent", label: "Recently Active" },
  { key: "name", label: "Name (A–Z)" },
  { key: "courses", label: "Most Courses Enrolled" },
  { key: "progress-asc", label: "Progress (Low to High)" },
  { key: "progress-desc", label: "Progress (High to Low)" },
  { key: "enrolled", label: "Enrollment Date" },
];

function matchesStatusFilter(entry, key) {
  if (key === "all") return true;
  if (key === "active") return entry.enrollments.some((e) => e.completionStatus === "in-progress");
  if (key === "at-risk") return entry.atRisk;
  if (key === "completed") return entry.enrollments.some((e) => e.completionStatus === "completed");
  if (key === "not-started") return entry.enrollments.every((e) => e.completionStatus === "not-started");
  return true;
}

function sortRoster(list, sortKey) {
  const sorted = [...list];
  switch (sortKey) {
    case "name":
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case "courses":
      return sorted.sort((a, b) => b.courseCount - a.courseCount || a.name.localeCompare(b.name));
    case "progress-asc":
      return sorted.sort((a, b) => a.overallProgress - b.overallProgress);
    case "progress-desc":
      return sorted.sort((a, b) => b.overallProgress - a.overallProgress);
    case "enrolled":
      return sorted.sort((a, b) => a.enrolledAt.localeCompare(b.enrolledAt));
    case "recent":
    default:
      return sorted.sort((a, b) => b.lastActive.localeCompare(a.lastActive));
  }
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">{message}</div>
  );
}

// Seeded once (never re-randomized on re-render) so the "one student with
// existing private notes" requirement is genuinely populated on first
// load — keyed by the same lowercased-name key buildRoster uses, so it
// survives the per-course random id regeneration this mock data does on
// every provider mount.
const SEED_NOTES = {
  "mei lin":
    "<p>Responds really well to visual examples — walk through diagrams before written explanations. Double-check her dark-mode token values before the next assignment; she mentioned she hasn't tested them yet.</p>",
};

function CourseFilterDropdown({ courses, selectedIds, onToggle, onClear }) {
  const [open, setOpen] = useState(false);
  const eligible = courses.filter((c) => c.students.length > 0);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
          selectedIds.length > 0 ? "border-primary bg-primary/[0.06] text-primary" : "border-text/15 bg-white text-muted hover:border-primary/30"
        }`}
      >
        <BookIcon className="h-3.5 w-3.5" />
        {selectedIds.length > 0 ? `${selectedIds.length} course${selectedIds.length === 1 ? "" : "s"}` : "All courses"}
        <ChevronDownIcon className="h-3.5 w-3.5" />
      </button>
      {open && (
        <>
          <button type="button" aria-label="Close" onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
          <div className="absolute left-0 top-full z-20 mt-2 flex w-64 flex-col gap-1 rounded-2xl bg-white p-2 shadow-lg">
            {eligible.map((c) => (
              <label key={c.id} className="flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-text hover:bg-bg">
                <input type="checkbox" checked={selectedIds.includes(c.id)} onChange={() => onToggle(c.id)} className="h-4 w-4 accent-primary" />
                <span className="truncate">{c.title}</span>
              </label>
            ))}
            {selectedIds.length > 0 && (
              <button type="button" onClick={onClear} className="mt-1 rounded-lg px-2.5 py-1.5 text-left text-xs font-semibold text-primary hover:bg-primary/[0.06]">
                Clear filter
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default function StudentManagement() {
  const navigate = useNavigate();
  const { courses } = useTeacherCourses();
  const { slots, sessionTypes, scheduleCall } = useTeacherAvailability();
  const [searchParams] = useSearchParams();

  const roster = useMemo(() => buildRoster(courses), [courses]);
  const stats = useMemo(() => rosterStats(roster), [roster]);

  const [view, setView] = useState(searchParams.get("view") === "at-risk" ? "at-risk" : "roster");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilterIds, setCourseFilterIds] = useState([]);
  const [sort, setSort] = useState("recent");
  const [displayMode, setDisplayMode] = useState("grid");
  const [selected, setSelected] = useState([]);
  const [profileEntry, setProfileEntry] = useState(null);
  const [toast, setToast] = useState("");
  // "By Course" view + export panel. Collapsed state lives here (not in the
  // section) so it survives switching between view modes.
  const [viewBy, setViewBy] = useState("all");
  const [collapsedCourses, setCollapsedCourses] = useState({});
  const [exportOpen, setExportOpen] = useState(false);
  const [exportCourseId, setExportCourseId] = useState(null);
  const [exportScope, setExportScope] = useState(null);

  const [notes, setNotes] = useState(SEED_NOTES);
  const [noteSaveStatus, setNoteSaveStatus] = useState("saved");
  const [noteSavedAt, setNoteSavedAt] = useState("");
  const noteTimer = useRef(null);
  const isFirstNoteRender = useRef(true);

  useEffect(() => {
    if (isFirstNoteRender.current) {
      isFirstNoteRender.current = false;
      return;
    }
    setNoteSaveStatus("saving");
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(() => {
      setNoteSaveStatus("saved");
      setNoteSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
    }, 900);
    return () => clearTimeout(noteTimer.current);
  }, [notes]);

  function flash(message) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2600);
  }

  const filtered = useMemo(() => {
    let list = roster;
    if (statusFilter !== "all") list = list.filter((e) => matchesStatusFilter(e, statusFilter));
    if (courseFilterIds.length > 0) list = list.filter((e) => e.enrollments.some((enr) => courseFilterIds.includes(enr.courseId)));
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((e) => e.name.toLowerCase().includes(q));
    }
    return sortRoster(list, sort);
  }, [roster, statusFilter, courseFilterIds, search, sort]);

  // By Course: the same search / status chip / sort / course filter,
  // applied per course on each enrollment.
  const courseGroups = useMemo(
    () => buildCourseGroups(roster, courses, { courseFilterIds, statusFilter, search, sortFn: (items) => sortRoster(items, sort) }),
    [roster, courses, courseFilterIds, statusFilter, search, sort]
  );

  function openExport(courseId = null, scope = null) {
    setExportCourseId(courseId);
    setExportScope(scope);
    setExportOpen(true);
  }

  function toggleCourseFilter(id) {
    setCourseFilterIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelect(key) {
    setSelected((prev) => (prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]));
  }

  const selectedEntries = useMemo(() => roster.filter((r) => selected.includes(r.key)), [roster, selected]);

  if (view === "at-risk") {
    return (
      <div className="pb-16">
        <AtRiskDashboard
          roster={roster}
          courses={courses}
          onBack={() => setView("roster")}
          onViewProfile={setProfileEntry}
        />
        <StudentProfileSheet
          entry={profileEntry}
          courses={courses}
          slots={slots}
          note={profileEntry ? notes[profileEntry.key] || "" : ""}
          noteSaveStatus={noteSaveStatus}
          noteSavedAt={noteSavedAt}
          onNoteChange={(html) => profileEntry && setNotes((prev) => ({ ...prev, [profileEntry.key]: html }))}
          onClose={() => setProfileEntry(null)}
        />
      </div>
    );
  }

  return (
    <div className="pb-16">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Your learners</div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Student Management</h1>
          <p className="mt-1 text-sm text-muted">Every student across every course you teach, in one place.</p>
        </div>
        <Button variant="secondary" fullWidth={false} className="flex items-center gap-2 self-start px-5 py-2.5 sm:self-auto" onClick={() => openExport(null)}>
          <DownloadIcon className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <button type="button" onClick={() => setStatusFilter("all")} className="text-left">
          <StatCard icon={UsersIcon} tone="blue" label="Total Unique Students" value={stats.total} />
        </button>
        <button type="button" onClick={() => setStatusFilter("active")} className="text-left">
          <StatCard icon={SparkleIcon} tone="lavender" label="Active This Week" value={stats.activeThisWeek} ring={stats.total ? Math.round((stats.activeThisWeek / stats.total) * 100) : 0} />
        </button>
        <button type="button" onClick={() => setView("at-risk")} className="text-left">
          <StatCard icon={AlertTriangleIcon} tone="pink" label="At Risk" value={stats.atRisk} />
        </button>
        <StatCard
          icon={TrendingUpIcon} tone="sage"
          label="New This Month"
          value={stats.newThisMonth}
          trend={{ direction: "up", label: "New enrollments" }}
        />
      </div>

      {/* View controls */}
      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-[260px]">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search students…"
              className="w-full rounded-full border border-text/10 bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-muted outline-none focus:border-primary/40"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <CourseFilterDropdown courses={courses} selectedIds={courseFilterIds} onToggle={toggleCourseFilter} onClear={() => setCourseFilterIds([])} />

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

            <SegmentedControl options={["All Students", "By Course"]} value={viewBy === "course" ? "By Course" : "All Students"} onChange={(v) => setViewBy(v === "By Course" ? "course" : "all")} />

            <div className="flex items-center gap-1 rounded-full bg-text/[0.05] p-1">
              <button
                type="button"
                aria-pressed={displayMode === "grid"}
                aria-label="Grid view"
                onClick={() => setDisplayMode("grid")}
                className={`rounded-full p-2 transition-all duration-200 ${displayMode === "grid" ? "bg-primary text-white" : "text-muted hover:text-text"} hover:-translate-y-0.5 hover:shadow-soft`}
              >
                <GridIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                aria-pressed={displayMode === "list"}
                aria-label="List view"
                onClick={() => setDisplayMode("list")}
                className={`rounded-full p-2 transition-all duration-200 ${displayMode === "list" ? "bg-primary text-white" : "text-muted hover:text-text"} hover:-translate-y-0.5 hover:shadow-soft`}
              >
                <RowsIcon className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.key} active={statusFilter === f.key} onClick={() => setStatusFilter(f.key)} className="px-3.5 py-1.5 text-xs">
              {f.label}
            </Chip>
          ))}
        </div>
      </div>

      {selected.length > 0 && (
        <div className="mt-4 flex items-center justify-between rounded-xl bg-primary/[0.06] px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{selected.length} selected</span>
          <div className="flex items-center gap-2">
            <Button variant="tertiary" fullWidth={false} className="px-3.5 py-1.5 text-xs" onClick={() => setSelected([])}>
              Clear selection
            </Button>
            <Button
              variant="secondary"
              fullWidth={false}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
              onClick={() => openExport(null, "selection")}
            >
              <DownloadFileIcon className="h-3.5 w-3.5" />
              Export List
            </Button>
          </div>
        </div>
      )}

      {/* Roster */}
      <div className="mt-5">
        {viewBy === "course" ? (
          courseGroups.length === 0 ? (
            <EmptyState icon={BookIcon} heading="No courses to show" message="Create a course and its students will be grouped here." />
          ) : (
            <div className="flex flex-col gap-4">
              {courseGroups.map((group) => (
                <StudentCourseGroup
                  key={group.course.id}
                  group={group}
                  expanded={!collapsedCourses[group.course.id]}
                  onToggle={() => setCollapsedCourses((prev) => ({ ...prev, [group.course.id]: !prev[group.course.id] }))}
                  displayMode={displayMode}
                  selected={selected}
                  onToggleSelect={toggleSelect}
                  onViewProfile={setProfileEntry}
                  onExport={openExport}
                />
              ))}
            </div>
          )
        ) : filtered.length === 0 ? (
          roster.length === 0 ? (
            <EmptyState
              icon={UsersIcon}
              heading="No students yet"
              message="Once students enroll in your courses, they'll appear here."
              action={
                <Button fullWidth={false} className="px-6" onClick={() => navigate("/teacher/mycourses")}>
                  Go to My Courses
                </Button>
              }
            />
          ) : (
            <EmptyState icon={UsersIcon} heading="No students match this view" message="Try adjusting your filters." />
          )
        ) : displayMode === "grid" ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((entry) => (
              <StudentRosterCard
                key={entry.key}
                entry={entry}
                viewMode="grid"
                selected={selected.includes(entry.key)}
                onToggleSelect={toggleSelect}
                onViewProfile={setProfileEntry}
              />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {filtered.map((entry) => (
              <StudentRosterCard
                key={entry.key}
                entry={entry}
                viewMode="list"
                selected={selected.includes(entry.key)}
                onToggleSelect={toggleSelect}
                onViewProfile={setProfileEntry}
              />
            ))}
          </div>
        )}
      </div>

      <StudentProfileSheet
        entry={profileEntry}
        courses={courses}
        slots={slots}
        note={profileEntry ? notes[profileEntry.key] || "" : ""}
        noteSaveStatus={noteSaveStatus}
        noteSavedAt={noteSavedAt}
        onNoteChange={(html) => profileEntry && setNotes((prev) => ({ ...prev, [profileEntry.key]: html }))}
        onClose={() => setProfileEntry(null)}
      />

      <StudentExportPanel
        open={exportOpen}
        onClose={() => setExportOpen(false)}
        roster={roster}
        courses={courses}
        filteredEntries={filtered}
        filteredGroups={courseGroups}
        byCourseView={viewBy === "course"}
        initialCourseId={exportCourseId}
        initialScope={exportScope}
        selectionEntries={selectedEntries}
        onSuccess={(filename) => flash(`${filename} downloaded`)}
      />

      <Toast message={toast} />
    </div>
  );
}
