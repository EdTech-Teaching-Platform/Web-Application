// CoursePerformanceComparison — Analytics hub Part 2: a sortable course
// table with a 2-3-course comparison mode. Reuses courseComparisonRows()
// (analyticsData.js) so every figure matches Course Management's own
// Analytics tab and Earnings' per-course breakdown exactly.
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import Chip from "../../../components/ui/Chip";
import TrendChart from "./TrendChart";
import { StarIcon, ChevronDownIcon, SearchIcon, UsersIcon } from "../../../components/ui/icons";
import { courseComparisonRows, formatUsd } from "../data/analyticsData";

const COLUMNS = [
  { key: "title", label: "Course" },
  { key: "enrollments", label: "Enrollments" },
  { key: "completionRate", label: "Completion" },
  { key: "avgRating", label: "Rating" },
  { key: "revenue", label: "Revenue" },
];

function SortHeader({ col, sort, setSort }) {
  const active = sort.key === col.key;
  return (
    <button
      type="button"
      onClick={() => setSort((s) => ({ key: col.key, dir: s.key === col.key && s.dir === "desc" ? "asc" : "desc" }))}
      className={`flex items-center gap-1 text-left text-xs font-semibold uppercase tracking-wide ${active ? "text-primary" : "text-muted"}`}
    >
      {col.label}
      <ChevronDownIcon className={`h-3 w-3 transition-transform duration-150 ${active && sort.dir === "asc" ? "rotate-180" : ""} ${active ? "opacity-100" : "opacity-30"}`} />
    </button>
  );
}

function CourseRow({ row, selected, onToggle, onOpen, canSelect }) {
  return (
    <div className="grid grid-cols-[auto_1.6fr_0.8fr_0.9fr_0.8fr_0.9fr_1fr] items-center gap-3 border-b border-text/[0.06] px-2 py-3 last:border-0">
      <input
        type="checkbox"
        checked={selected}
        disabled={!selected && !canSelect}
        onChange={() => onToggle(row.id)}
        className="h-4 w-4 rounded border-text/25 text-primary focus:ring-primary/40 disabled:opacity-30"
        aria-label={`Select ${row.title} for comparison`}
      />
      <button type="button" onClick={() => onOpen(row.id)} className="min-w-0 truncate text-left text-sm font-semibold text-text hover:text-primary">
        {row.title}
      </button>
      <span className="text-sm text-muted">{row.enrollments}</span>
      <span className={`text-sm font-medium ${row.completionRate >= 60 ? "text-success" : row.completionRate >= 30 ? "text-warning" : "text-danger"}`}>
        {row.completionRate}%
      </span>
      <span className="flex items-center gap-1 text-sm text-muted">
        <StarIcon className="h-3.5 w-3.5 text-warning" />
        {row.avgRating ? row.avgRating.toFixed(1) : "—"}
      </span>
      <span className="text-sm font-semibold text-text">{formatUsd(row.revenue)}</span>
      <div className="h-9 w-24">
        <TrendChart data={row.sparkline} size="sm" className="text-primary" />
      </div>
    </div>
  );
}

function ComparisonBlock({ rows }) {
  if (rows.length < 2) {
    return (
      <div className="rounded-2xl border border-dashed border-text/15 bg-bg p-6 text-center text-sm text-muted">
        Select 2–3 courses above to compare them side by side.
      </div>
    );
  }
  const metrics = [
    { key: "enrollments", label: "Enrollments", fmt: (v) => v },
    { key: "completionRate", label: "Completion rate", fmt: (v) => `${v}%` },
    { key: "avgRating", label: "Avg. rating", fmt: (v) => (v ? v.toFixed(1) : "—") },
    { key: "revenue", label: "Revenue", fmt: formatUsd },
  ];
  return (
    <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
      <h3 className="text-base font-semibold text-text">Side-by-side comparison</h3>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[480px] border-collapse text-sm">
          <thead>
            <tr>
              <th className="py-2 pr-4 text-left text-xs font-semibold uppercase tracking-wide text-muted">Metric</th>
              {rows.map((r) => (
                <th key={r.id} className="px-3 py-2 text-left text-xs font-semibold text-text">{r.title}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {metrics.map((m) => (
              <tr key={m.key} className="border-t border-text/[0.06]">
                <td className="py-2.5 pr-4 text-muted">{m.label}</td>
                {rows.map((r) => (
                  <td key={r.id} className="px-3 py-2.5 font-semibold text-text">{m.fmt(r[m.key])}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function CoursePerformanceComparison({ courses }) {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState({ key: "revenue", dir: "desc" });
  const [selected, setSelected] = useState([]);

  const rows = useMemo(() => courseComparisonRows(courses), [courses]);

  const filtered = useMemo(() => {
    let list = rows;
    if (statusFilter !== "all") list = list.filter((r) => r.status === statusFilter);
    if (search.trim()) list = list.filter((r) => r.title.toLowerCase().includes(search.trim().toLowerCase()));
    return [...list].sort((a, b) => {
      const dir = sort.dir === "asc" ? 1 : -1;
      const av = a[sort.key];
      const bv = b[sort.key];
      if (typeof av === "string") return av.localeCompare(bv) * dir;
      return (av - bv) * dir;
    });
  }, [rows, statusFilter, search, sort]);

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 3 ? prev : [...prev, id]));
  }

  function openCourse(id) {
    navigate(`/teacher/coursemanagement/${id}?tab=analytics`);
  }

  const selectedRows = rows.filter((r) => selected.includes(r.id));

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-3xl bg-white px-8 py-16 text-center shadow-soft">
        <UsersIcon className="h-8 w-8 text-text/20" />
        <h3 className="mt-3 text-base font-semibold text-text">No published courses to compare yet</h3>
        <p className="mt-1.5 max-w-sm text-sm text-muted">Once you publish a course and it gets its first students, it'll show up here.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <section className="rounded-3xl bg-white p-5 sm:p-6 shadow-soft">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            {["all", "published", "archived"].map((s) => (
              <Chip key={s} active={statusFilter === s} onClick={() => setStatusFilter(s)} className="px-3.5 py-1.5 text-xs capitalize">
                {s === "all" ? "All" : s}
              </Chip>
            ))}
          </div>
          <div className="relative w-full sm:max-w-xs">
            <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search courses…"
              className="w-full rounded-full border border-text/10 bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-muted outline-none focus:border-primary/40"
            />
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <div className="min-w-[720px]">
            <div className="grid grid-cols-[auto_1.6fr_0.8fr_0.9fr_0.8fr_0.9fr_1fr] items-center gap-3 border-b border-text/[0.08] px-2 pb-2">
              <span />
              {COLUMNS.map((c) => (
                <SortHeader key={c.key} col={c} sort={sort} setSort={setSort} />
              ))}
              <span className="text-xs font-semibold uppercase tracking-wide text-muted">Trend</span>
            </div>
            {filtered.length === 0 ? (
              <p className="py-10 text-center text-sm text-muted">No courses match these filters</p>
            ) : (
              filtered.map((row) => (
                <CourseRow key={row.id} row={row} selected={selected.includes(row.id)} onToggle={toggleSelect} onOpen={openCourse} canSelect={selected.length < 3} />
              ))
            )}
          </div>
        </div>

        {selected.length > 0 && (
          <div className="mt-3 flex items-center justify-between rounded-xl bg-primary/[0.06] px-4 py-2.5 text-xs font-medium text-primary">
            {selected.length} of 3 selected for comparison
            <Button variant="secondary" fullWidth={false} className="px-3 py-1.5 text-xs" onClick={() => setSelected([])}>
              Clear
            </Button>
          </div>
        )}
      </section>

      <ComparisonBlock rows={selectedRows} />
    </div>
  );
}
