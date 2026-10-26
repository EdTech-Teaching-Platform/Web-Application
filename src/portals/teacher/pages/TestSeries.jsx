// Test Series — teacher dashboard (landing for /teacher/testseries).
// Shows the CURRENT teacher's PUBLISHED series from TestSeriesContext (live,
// whether an admin assigned them or the educator built them).
// Series still being worked on live under "Assigned to me" (admin-assigned) or
// the "My drafts" filter (the educator's own unpublished series).
// Gated by TestSeriesGuard (see routes.jsx) so it never renders without access.
import { useMemo, useState } from "react";
import { NavLink, useNavigate } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import TestSeriesCard from "../components/TestSeriesCard";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import EmptyState from "../../../components/ui/EmptyState";
import { PlusIcon, QuizIcon, CheckIcon, UsersIcon, AssignmentIcon, FlagIcon, SearchIcon } from "../../../components/ui/icons";
import { isLive } from "../data/testSeriesData";

const STATUS_FILTERS = [
  { key: "published", label: "Published", test: (s) => isLive(s) },
  { key: "review", label: "Under review", test: (s) => s.status === "ready" },
  { key: "drafts", label: "My drafts", test: (s) => s.origin === "own" && !isLive(s) && s.status !== "ready" },
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
  const [status, setStatus] = useState("published");
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
  const filtering = status !== "published" || type !== "all" || query.trim() !== "";
  const liveCount = mine.filter(isLive).length;

  const createButton = (
    <Button fullWidth={false} className="px-6" onClick={() => navigate("/teacher/testseries/new")}>
      <PlusIcon className="h-4 w-4" />
      New test series
    </Button>
  );

  const renderCard = (s) => (
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
  );
  const pill = (active) =>
    `inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
      active ? "bg-(--lp-ink) text-white" : "bg-white text-(--lp-muted) ring-1 ring-(--lp-line) hover:bg-(--lp-blue-tint) hover:text-(--lp-ink)"
    }`;
  const SectionHead = ({ title, hint, count }) => (
    <div className="mb-4 flex items-end justify-between gap-3 first:mt-0">
      <div>
        <h2 className="font-(family-name:--lp-font) text-xl font-bold tracking-tight text-(--lp-ink)">{title}</h2>
        <p className="mt-0.5 text-xs text-(--lp-muted)">{hint}</p>
      </div>
      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-(--lp-ink) ring-1 ring-(--lp-line)">{count}</span>
    </div>
  );

  return (
    <div className="pb-16">
      {/* Hero */}
      <div className="relative flex flex-col gap-5 overflow-hidden rounded-[2rem] bg-(--lp-ink) px-6 py-7 text-white shadow-[0_24px_50px_-28px_rgba(15,17,21,0.6)] sm:flex-row sm:items-end sm:justify-between sm:px-8">
        <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-16 h-56 w-56 rounded-full bg-(--lp-blue)/40 blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -bottom-20 right-1/3 h-40 w-40 rounded-full bg-(--lp-yellow)/25 blur-2xl" />
        <div className="relative">
          <span className="inline-flex rounded-full bg-(--lp-yellow) px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-(--lp-ink)">Create</span>
          <h1 className="mt-3 font-(family-name:--lp-font) text-3xl font-bold tracking-tight sm:text-4xl">Test Series</h1>
          <p className="mt-1.5 max-w-md text-sm text-white/70">Everything you have published, live for students. Series you still have to build are under Assigned to me.</p>
        </div>
        <div className="relative flex flex-wrap items-center gap-3">
          <NavLink to="/teacher/testseries/assigned" className="inline-flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/20">
            <FlagIcon className="h-4 w-4" />
            Assigned to me
            {assignedActionCount > 0 && <span className="flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-(--lp-yellow) px-1.5 text-[10px] font-bold text-(--lp-ink)">{assignedActionCount}</span>}
          </NavLink>
          <NavLink to="/teacher/testseries/new" className="inline-flex items-center gap-2 rounded-full bg-(--lp-yellow) px-5 py-2.5 text-sm font-bold text-(--lp-ink) transition-transform hover:-translate-y-0.5">
            <PlusIcon className="h-4 w-4" />
            New test series
          </NavLink>
        </div>
      </div>

      {/* Slim stat strip */}
      <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-[1.5rem] bg-(--lp-line) ring-1 ring-(--lp-line) lg:grid-cols-4">
        {[
          { icon: CheckIcon, label: "Published", value: liveCount },
          { icon: FlagIcon, label: "Assigned to do", value: assignedActionCount, to: "/teacher/testseries/assigned" },
          { icon: UsersIcon, label: "Enrollments", value: totalEnrolled.toLocaleString() },
          { icon: AssignmentIcon, label: "To grade", value: pendingGrading, to: "/teacher/grading" },
        ].map(({ icon: Icon, label, value, to }) => {
          const inner = (
            <>
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-(--lp-blue-tint) text-(--lp-blue-deep)"><Icon className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block font-(family-name:--lp-font) text-2xl font-bold leading-none text-(--lp-ink)">{value}</span>
                <span className="mt-1 block truncate text-[11px] font-semibold uppercase tracking-wide text-(--lp-muted)">{label}</span>
              </span>
            </>
          );
          return to ? (
            <NavLink key={label} to={to} className="flex items-center gap-3 bg-white px-5 py-4 transition-colors hover:bg-(--lp-blue-tint)">{inner}</NavLink>
          ) : (
            <div key={label} className="flex items-center gap-3 bg-white px-5 py-4">{inner}</div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="mt-6 flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:flex-1" role="group" aria-label="Filter by status">
          {STATUS_FILTERS.map((f) => (
            <button key={f.key} type="button" onClick={() => setStatus(f.key)} className={pill(status === f.key)}>
              {f.label}
              <span className="opacity-60">{mine.filter(f.test).length}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Filter by type" className="rounded-full border-0 bg-white py-2 pl-4 pr-8 text-xs font-semibold text-(--lp-ink) ring-1 ring-(--lp-line) outline-none focus:ring-2 focus:ring-(--lp-blue)">
            {TYPE_FILTERS.map((f) => (
              <option key={f.key} value={f.key}>{f.label} ({mine.filter(f.test).length})</option>
            ))}
          </select>
          <label className="relative block min-w-0 flex-1 lg:w-60 lg:flex-none">
            <span className="sr-only">Search test series</span>
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-(--lp-muted)" />
            <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search by title" className="w-full rounded-full border-0 bg-white py-2 pl-10 pr-4 text-sm text-(--lp-ink) outline-none ring-1 ring-(--lp-line) placeholder:text-(--lp-muted)/80 focus:ring-2 focus:ring-(--lp-blue)" />
          </label>
        </div>
      </div>

      <div className="mt-6">
        {mine.length === 0 ? (
          <EmptyState icon={QuizIcon} heading="No test series yet" message="Create your first series: choose how to build it, group tests into sections, add questions and publish when you're ready." action={createButton} />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={QuizIcon}
            heading={filtering ? "No series match" : status === "review" ? "Nothing under review" : "Nothing published yet"}
            message={filtering ? "Nothing matches these filters right now." : status === "review" ? "When you submit a series for review it waits here until the admin approves it." : "Series approved by the admin will show up here. Finish an assigned series from Assigned to me, or build your own."}
            action={
              filtering ? (
                <Button variant="secondary" fullWidth={false} className="px-5 py-2" onClick={() => { setStatus("published"); setType("all"); setQuery(""); }}>Clear filters</Button>
              ) : (
                <NavLink to="/teacher/testseries/assigned" className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft">Go to Assigned to me</NavLink>
              )
            }
          />
        ) : (
          <section>
            <SectionHead
              title={status === "drafts" ? "Your drafts" : status === "review" ? "Under review" : "Published series"}
              hint={status === "drafts" ? "Series you started yourself and haven't submitted yet." : status === "review" ? "Submitted and waiting for the admin to approve. They go live as soon as they're approved." : "Live for students. Open one to view results and enrollments."}
              count={visible.length}
            />
            <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-3">{visible.map(renderCard)}</div>
          </section>
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
