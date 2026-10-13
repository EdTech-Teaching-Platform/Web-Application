// My courses list + management overview
// Jira: Day 7 — My courses list + management overview
// Doc reference: Sec 5.4
//
// The educator's course portfolio: a scannable-at-a-glance grid/list of
// everything they've built, reading from the same TeacherCoursesContext
// the Course Builder and Course Management Overview read/write, so a
// status change or edit made anywhere shows up here immediately.
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTeacherCourses } from "../context/TeacherCoursesContext";
import StatCard from "../../../components/ui/StatCard";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import { CoursePortfolioCard, CoursePortfolioRow } from "../components/CoursePortfolioCard";
import {
  BookIcon,
  CheckIcon,
  ClockIcon,
  UsersIcon,
  StarIcon,
  PencilIcon,
  SearchIcon,
  GridIcon,
  RowsIcon,
  PlusIcon,
  SparkleIcon,
} from "../../../components/ui/icons";
import Select from "../../../components/ui/Select";
import SegmentedControl from "../../../components/ui/SegmentedControl";
import BundlesView from "../components/BundlesView";

const FILTERS = [
  { key: "all", label: "All" },
  { key: "published", label: "Published" },
  { key: "draft", label: "Draft" },
  { key: "pending_review", label: "Pending Review" },
  { key: "changes_requested", label: "Changes Requested" },
  { key: "archived", label: "Archived" },
];

const SORTS = [
  { key: "newest", label: "Newest" },
  { key: "oldest", label: "Oldest" },
  { key: "students", label: "Most Students" },
  { key: "rated", label: "Highest Rated" },
  { key: "alpha", label: "Alphabetical" },
];

function sortCourses(courses, sort) {
  const list = [...courses];
  switch (sort) {
    case "oldest":
      return list.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    case "students":
      return list.sort((a, b) => b.students.length - a.students.length);
    case "rated":
      return list.sort((a, b) => (b.rating || 0) - (a.rating || 0) || b.ratingCount - a.ratingCount);
    case "alpha":
      return list.sort((a, b) => a.title.localeCompare(b.title));
    case "newest":
    default:
      return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-20 text-center shadow-soft">
      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/[0.08] text-primary">
        <SparkleIcon />
      </span>
      <h3 className="mt-4 text-lg font-semibold text-text">You haven't created a course yet</h3>
      <p className="mt-1.5 max-w-sm text-sm text-muted">
        Once you publish your first course, it'll show up here with everything you need to manage it — students,
        curriculum, grading and reviews, all in one place.
      </p>
      <NavLink to="/teacher/coursebuilder" className="mt-6">
        <Button variant="primary" fullWidth={false} className="flex items-center gap-2 px-6">
          <PlusIcon className="h-4 w-4" />
          Create Your First Course
        </Button>
      </NavLink>
    </div>
  );
}

function NoResults({ onClear }) {
  return (
    <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
      <span className="flex h-12 w-12 items-center justify-center rounded-full bg-text/[0.06] text-muted">
        <SearchIcon className="h-5 w-5" />
      </span>
      <h3 className="mt-3 text-base font-semibold text-text">No courses match your filters</h3>
      <p className="mt-1 text-sm text-muted">Try a different search term or clear your filters.</p>
      <Button variant="secondary" fullWidth={false} className="mt-5 px-5" onClick={onClear}>
        Clear filters
      </Button>
    </div>
  );
}

export default function MyCourses() {
  const { courses } = useTeacherCourses();
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState("newest");
  const [view, setView] = useState("grid");
  const [section, setSection] = useState("Courses");

  const counts = useMemo(() => {
    const c = { all: courses.length, published: 0, draft: 0, pending_review: 0, changes_requested: 0, archived: 0 };
    courses.forEach((course) => {
      c[course.status] = (c[course.status] || 0) + 1;
    });
    return c;
  }, [courses]);

  const aggregate = useMemo(() => {
    const totalStudents = courses.reduce((s, c) => s + c.students.length, 0);
    const ratedCourses = courses.filter((c) => c.ratingCount > 0);
    const weightedSum = ratedCourses.reduce((s, c) => s + c.rating * c.ratingCount, 0);
    const weightedCount = ratedCourses.reduce((s, c) => s + c.ratingCount, 0);
    const avgRating = weightedCount ? (weightedSum / weightedCount).toFixed(1) : "—";
    return { totalStudents, avgRating };
  }, [courses]);

  const filtered = useMemo(() => {
    let list = filter === "all" ? courses : courses.filter((c) => c.status === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((c) => c.title.toLowerCase().includes(q));
    }
    return sortCourses(list, sort);
  }, [courses, filter, search, sort]);

  const hasAnyCourses = courses.length > 0;

  return (
    <div className="pb-16">
      {/* Header */}
      <div className="flex flex-col gap-4 border-b border-text/[0.07] pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="eyebrow mb-1.5">Your catalog</div>
          <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">My Courses</h1>
          <p className="mt-1.5 text-sm text-muted">Your course portfolio — manage, track and grow every course in one place.</p>
        </div>
        <NavLink to="/teacher/coursebuilder">
          <Button variant="primary" fullWidth={false} className="flex items-center gap-2 px-5">
            <PlusIcon className="h-4 w-4" />
            New Course
          </Button>
        </NavLink>
      </div>

      {/* Summary strip */}
      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard icon={BookIcon} tone="sage" label="Total Courses" value={counts.all} trend={{ direction: "up", label: `${counts.draft} in draft` }} />
        <StatCard icon={CheckIcon} tone="sage" label="Published" value={counts.published} />
        <StatCard icon={PencilIcon} tone="lavender" label="Draft" value={counts.draft} />
        <StatCard icon={ClockIcon} tone="orange" label="Pending Review" value={counts.pending_review} />
        <StatCard
          icon={UsersIcon} tone="blue"
          label="Total Enrolled Students"
          value={aggregate.totalStudents.toLocaleString()}
          trend={{ direction: "up", label: "+128 this month" }}
        />
        <StatCard icon={StarIcon} tone="orange" label="Average Rating" value={aggregate.avgRating} />
      </div>

      <div className="mt-8">
        <SegmentedControl options={["Courses", "Bundles"]} value={section} onChange={setSection} />
      </div>

      {section === "Bundles" ? (
        <div className="mt-6">
          <BundlesView />
        </div>
      ) : !hasAnyCourses ? (
        <div className="mt-8">
          <EmptyState />
        </div>
      ) : (
        <>
          {/* View controls */}
          <div className="mt-6 flex flex-col gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {FILTERS.map((f) => (
                <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} className="px-4 py-1.5 text-xs">
                  {f.label}
                  <span className={`ml-1.5 ${filter === f.key ? "text-white/70" : "text-muted"}`}>{counts[f.key] || 0}</span>
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
                  placeholder="Search by course title…"
                  className="w-full rounded-full border border-text/10 bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-muted outline-none transition-colors focus:border-primary/40"
                />
              </div>

              <div className="flex items-center gap-3">
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

                <div className="flex items-center gap-1 rounded-full bg-text/[0.05] p-1">
                  <button
                    type="button"
                    aria-pressed={view === "grid"}
                    aria-label="Grid view"
                    onClick={() => setView("grid")}
                    className={`rounded-full p-2 transition-all duration-200 ${view === "grid" ? "bg-primary text-white" : "text-muted hover:text-text"} hover:-translate-y-0.5 hover:shadow-soft`}
                  >
                    <GridIcon className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    aria-pressed={view === "list"}
                    aria-label="List view"
                    onClick={() => setView("list")}
                    className={`rounded-full p-2 transition-all duration-200 ${view === "list" ? "bg-primary text-white" : "text-muted hover:text-text"} hover:-translate-y-0.5 hover:shadow-soft`}
                  >
                    <RowsIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Results */}
          <div className="mt-6">
            {filtered.length === 0 ? (
              <NoResults
                onClear={() => {
                  setFilter("all");
                  setSearch("");
                }}
              />
            ) : view === "grid" ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {filtered.map((course, i) => (
                  <CoursePortfolioCard key={course.id} course={course} rotation={i} />
                ))}
              </div>
            ) : (
              <div className="rounded-3xl bg-white p-2 shadow-soft">
                <div className="hidden grid-cols-[minmax(0,2.4fr)_repeat(4,minmax(0,0.8fr))_auto] gap-3 px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-muted sm:grid sm:gap-4">
                  <span>Course</span>
                  <span>Students</span>
                  <span>Rating</span>
                  <span>Lessons</span>
                  <span>Updated</span>
                  <span />
                </div>
                <div className="flex flex-col divide-y divide-text/[0.06]">
                  {filtered.map((course) => (
                    <CoursePortfolioRow key={course.id} course={course} />
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
