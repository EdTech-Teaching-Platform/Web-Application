// Test Series — teacher dashboard (landing for /teacher/testseries).
// Lists only the CURRENT teacher's series from TestSeriesContext: both the
// ones an admin assigned and the educator's own, course-wise or standalone.
// Gated by TestSeriesGuard (see routes.jsx) so it never renders without access.
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import TestSeriesCard from "../components/TestSeriesCard";
import StatCard from "../../../components/ui/StatCard";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import EmptyState from "../../../components/ui/EmptyState";
import { PlusIcon, QuizIcon, CheckIcon, UsersIcon, AssignmentIcon, FlagIcon, SearchIcon } from "../../../components/ui/icons";
import { isLive } from "../data/testSeriesData";

const STATUS_FILTERS = [
  { key: "all", label: "All", test: () => true },
  { key: "assigned", label: "Not started", test: (s) => s.status === "assigned" },
  { key: "drafting", label: "Drafting", test: (s) => s.status === "drafting" },
  { key: "ready", label: "Ready for review", test: (s) => s.status === "ready" },
  { key: "published", label: "Published", test: (s) => s.status === "published" },
  { key: "final", label: "Final published", test: (s) => s.status === "final" },
  { key: "archived", label: "Archived", test: (s) => s.status === "archived" },
];
const TYPE_FILTERS = [
  { key: "all", label: "All types", test: () => true },
  { key: "assigned", label: "Assigned", test: (s) => s.origin === "assigned" },
  { key: "own", label: "Own", test: (s) => s.origin === "own" },
  { key: "course", label: "Course-wise", test: (s) => s.scope === "course" },
  { key: "standalone", label: "Standalone", test: (s) => s.scope === "standalone" },
];

export default function TestSeries() {
  const navigate = useNavigate();
  const { series, submissions, currentTeacher, assignedActionCount, transitionSeries, deleteSeries, duplicateSeries } = useTestSeries();
  const { courses } = useTeacherCourses();
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [query, setQuery] = useState("");
  const [toDelete, setToDelete] = useState(null);

  const mine = useMemo(() => series.filter((s) => s.teacherId === currentTeacher?.id && !s.declined), [series, currentTeacher]);
  const courseTitle = (id) => courses.find((c) => c.id === id)?.title;
  const statusTest = STATUS_FILTERS.find((f) => f.key === status).test;
  const typeTest = TYPE_FILTERS.find((f) => f.key === type).test;
  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mine.filter((s) => statusTest(s) && typeTest(s) && (!q || s.title.toLowerCase().includes(q)));
  }, [mine, statusTest, typeTest, query]);
  const mineIds = useMemo(() => new Set(mine.map((s) => s.id)), [mine]);
  const pendingGrading = submissions.filter((s) => mineIds.has(s.seriesId) && s.status !== "graded").length;
  const totalEnrolled = mine.reduce((sum, s) => sum + s.enrollments, 0);
  const filtering = status !== "all" || type !== "all" || query.trim() !== "";

  const createButton = (
    <Button fullWidth={false} className="px-6" onClick={() => navigate("/teacher/testseries/new")}>
      <PlusIcon className="h-4 w-4" />
      New test series
    </Button>
  );

  return (
    <div className="pb-16">
      <div className="flex flex-col gap-4 border-b border-text/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Create</div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Test Series</h1>
          <p className="mt-1.5 text-sm text-muted">Build series an admin assigned to you and your own, tied to a course or standalone.</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <NavLink to="/teacher/testseries/assigned" className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-surface px-5 py-3 text-sm font-semibold text-text transition-all duration-150 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-card">
            <FlagIcon className="h-4 w-4" />
            Assigned to me
            {assignedActionCount > 0 && <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-danger px-1.5 text-[10px] font-bold text-white">{assignedActionCount}</span>}
          </NavLink>
          {createButton}
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={QuizIcon} tone="lavender" label="Total series" value={mine.length} />
        <StatCard icon={CheckIcon} tone="sage" label="Live for students" value={mine.filter(isLive).length} />
        <StatCard icon={UsersIcon} tone="blue" label="Total enrollments" value={totalEnrolled.toLocaleString()} />
        <StatCard
          icon={AssignmentIcon}
          tone="orange"
          label="Answers to grade"
          value={pendingGrading}
          action={
            <NavLink to="/teacher/grading" className="text-xs font-semibold text-primary hover:underline">
              Open grading queue
            </NavLink>
          }
        />
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <Chip key={f.key} active={status === f.key} onClick={() => setStatus(f.key)} className="px-4 py-1.5 text-xs">
              {f.label}
              <span className="ml-1.5 opacity-70">{mine.filter(f.test).length}</span>
            </Chip>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter by type">
          {TYPE_FILTERS.map((f) => (
            <Chip key={f.key} active={type === f.key} onClick={() => setType(f.key)} className="px-4 py-1.5 text-xs">
              {f.label}
              <span className="ml-1.5 opacity-70">{mine.filter(f.test).length}</span>
            </Chip>
          ))}
          <label className="relative ml-auto block w-full sm:w-64">
            <span className="sr-only">Search test series</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title" className="w-full rounded-full border border-text/12 bg-surface py-2 pl-10 pr-4 text-sm text-text outline-none placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/15" />
          </label>
        </div>
      </div>

      <div className="mt-5">
        {mine.length === 0 ? (
          <EmptyState icon={QuizIcon} heading="No test series yet" message="Create your first series: choose how to build it, group tests into sections, add questions and publish when you're ready." action={createButton} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={QuizIcon}
            heading="No series match"
            message="Nothing matches these filters right now."
            action={filtering ? <Button variant="secondary" fullWidth={false} className="px-5 py-2" onClick={() => { setStatus("all"); setType("all"); setQuery(""); }}>Clear filters</Button> : null}
          />
        ) : (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">
            {visible.map((s) => (
              <TestSeriesCard
                key={s.id}
                series={s}
                courseTitle={courseTitle(s.courseId)}
                onArchiveToggle={() => transitionSeries(s.id, s.status === "archived" ? "drafting" : "archived")}
                onDuplicate={() => {
                  const id = duplicateSeries(s.id);
                  if (id) navigate(`/teacher/testseries/${id}`);
                }}
                onDelete={() => setToDelete(s)}
              />
            ))}
          </div>
        )}
      </div>

      <Modal
        open={Boolean(toDelete)}
        onClose={() => setToDelete(null)}
        title={toDelete && isLive(toDelete) ? "Delete a live test series?" : "Delete test series?"}
        footer={
          <>
            <Button
              fullWidth={false}
              className="!bg-danger px-6"
              onClick={() => {
                deleteSeries(toDelete.id);
                setToDelete(null);
              }}
            >
              Delete
            </Button>
            <Button variant="secondary" fullWidth={false} className="px-6" onClick={() => setToDelete(null)}>
              Cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-muted">
          "{toDelete?.title || "Untitled test series"}" and all its tests and questions will be permanently removed.
          {toDelete && isLive(toDelete) ? " It is live, so students will lose access." : ""}
          {toDelete?.scope === "course" && courseTitle(toDelete.courseId) ? ` It will also disappear from the ${courseTitle(toDelete.courseId)} course page.` : ""}
        </p>
      </Modal>
    </div>
  );
}
