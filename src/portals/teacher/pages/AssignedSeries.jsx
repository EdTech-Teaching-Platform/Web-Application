// Assigned to me — every test series an admin has assigned to this educator,
// with deadlines, builder progress and the action each one needs next.
// Gated by TestSeriesGuard (routes.jsx). Educators can't delete assigned
// series: they can request a deadline extension or decline with a reason.
import { useMemo, useState } from "react";
import { NavLink } from "react-router-dom";
import { useTestSeries } from "../../../context/TestSeriesContext";
import AssignedSeriesCard from "../components/AssignedSeriesCard";
import { ExtensionRequestModal, DeclineAssignmentModal } from "../components/AssignedSeriesActions";
import { isOverdue } from "../components/TestSeriesStatus";
import StatCard from "../../../components/ui/StatCard";
import Select from "../../../components/ui/Select";
import Button from "../../../components/ui/Button";
import EmptyState from "../../../components/ui/EmptyState";
import { QuizIcon, FlagIcon, PencilIcon, CheckIcon, AlertTriangleIcon, SearchIcon, ArrowLeftIcon } from "../../../components/ui/icons";
import { TS_SUBJECTS } from "../data/testSeriesData";
import { daysUntil, effectiveBuildDeadline } from "../data/testSeriesDeadlines";

const TODO = ["assigned", "drafting", "ready"];
const STATUS_FILTERS = [
  ["todo", "To work on"],
  ["all", "All statuses"],
  ["assigned", "Not started"],
  ["drafting", "In progress"],
  ["ready", "Under review"],
  ["published", "Published"],
  ["declined", "Declined"],
];
const DEADLINE_FILTERS = [
  ["all", "Any deadline"],
  ["overdue", "Overdue"],
  ["week", "Due this week"],
  ["month", "Due this month"],
];
const SORTS = [
  ["deadline", "Deadline (overdue first)"],
  ["assigned", "Recently assigned"],
  ["progress", "Least progress first"],
];

const selectCls = "w-full rounded-full border border-text/12 bg-white py-2.5 pl-4 pr-10 text-sm text-text";

function matchesDeadline(series, f) {
  if (f === "all") return true;
  const d = daysUntil(effectiveBuildDeadline(series));
  if (d === null) return false;
  if (f === "overdue") return isOverdue(series);
  if (f === "week") return d >= 0 && d <= 7;
  return d >= 0 && d <= 30;
}

export default function AssignedSeries() {
  const { series, currentTeacher, requestExtension, withdrawExtension, declineAssignment } = useTestSeries();
  const [status, setStatus] = useState("todo");
  const [deadline, setDeadline] = useState("all");
  const [subject, setSubject] = useState("all");
  const [sort, setSort] = useState("deadline");
  const [query, setQuery] = useState("");
  const [extFor, setExtFor] = useState(null);
  const [declineFor, setDeclineFor] = useState(null);

  const mine = useMemo(() => series.filter((s) => s.teacherId === currentTeacher?.id && s.origin === "assigned"), [series, currentTeacher]);
  const active = mine.filter((s) => !s.declined);
  const counts = {
    assigned: active.length,
    progress: active.filter((s) => s.status === "drafting").length,
    awaiting: active.filter((s) => s.status === "ready").length,
    overdue: active.filter(isOverdue).length,
  };

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = mine.filter((s) => {
      if (status === "declined" ? !s.declined : s.declined) return false;
      if (status === "todo" ? !TODO.includes(s.status) : status !== "all" && status !== "declined" && s.status !== status) return false;
      if (!matchesDeadline(s, deadline)) return false;
      if (subject !== "all" && !(s.assignment.taxonomy?.subjects || s.subjects).includes(subject)) return false;
      if (q && !`${s.title}`.toLowerCase().includes(q)) return false;
      return true;
    });
    const needs = (s) => (["assigned", "drafting", "ready"].includes(s.status) ? 0 : 1);
    return list.sort((a, b) => {
      if (sort === "assigned") return b.assignment.assignedOn.localeCompare(a.assignment.assignedOn);
      if (sort === "progress") return needs(a) - needs(b) || a.builderProgress - b.builderProgress;
      const da = daysUntil(effectiveBuildDeadline(a));
      const db = daysUntil(effectiveBuildDeadline(b));
      return needs(a) - needs(b) || (da ?? 9999) - (db ?? 9999);
    });
  }, [mine, status, deadline, subject, sort, query]);

  const filtered = status !== "todo" || deadline !== "all" || subject !== "all" || query.trim() !== "";
  function reset() {
    setStatus("todo");
    setDeadline("all");
    setSubject("all");
    setQuery("");
  }

  return (
    <div className="pb-16">
      <div className="border-b border-text/[0.07] pb-6">
        <NavLink to="/teacher/testseries" className="mb-3 inline-flex items-center gap-1.5 text-sm font-semibold text-muted transition-colors hover:text-text">
          <ArrowLeftIcon className="h-4 w-4" />
          All test series
        </NavLink>
        <div className="eyebrow mb-1.5">Test Series</div>
        <h1 className="text-2xl font-bold tracking-tight text-text sm:text-3xl">Assigned to me</h1>
        <p className="mt-1.5 text-sm text-muted">Every series an admin has assigned for you to build, with deadlines. Finished and published ones move to Test Series.</p>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={FlagIcon} tone="maroon" label="Assigned" value={counts.assigned} />
        <StatCard icon={PencilIcon} tone="blue" label="In progress" value={counts.progress} />
        <StatCard icon={CheckIcon} tone="sage" label="Under review" value={counts.awaiting} />
        <StatCard icon={AlertTriangleIcon} tone="pink" label="Overdue" value={counts.overdue} />
      </div>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_1.2fr]">
        <label className="relative block sm:col-span-2 lg:col-span-1">
          <span className="sr-only">Search assigned series</span>
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by title"
            className="w-full rounded-full border border-text/12 bg-white py-2.5 pl-10 pr-4 text-sm text-text outline-none placeholder:text-muted/80 focus:border-primary focus:ring-2 focus:ring-primary/15"
          />
        </label>
        <Select wrapperClassName="block w-full" aria-label="Filter by status" className={selectCls} value={status} onChange={(e) => setStatus(e.target.value)}>
          {STATUS_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select wrapperClassName="block w-full" aria-label="Filter by deadline" className={selectCls} value={deadline} onChange={(e) => setDeadline(e.target.value)}>
          {DEADLINE_FILTERS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
        <Select wrapperClassName="block w-full" aria-label="Filter by subject" className={selectCls} value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="all">All subjects</option>
          {TS_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
        <Select wrapperClassName="block w-full" aria-label="Sort" className={selectCls} value={sort} onChange={(e) => setSort(e.target.value)}>
          {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </Select>
      </div>

      <div className="mt-6">
        {mine.length === 0 ? (
          <EmptyState icon={QuizIcon} heading="Nothing has been assigned to you" message="When an admin assigns you a test series to build, it will show up here with its brief and deadline." action={<NavLink to="/teacher/testseries/new" className="inline-flex rounded-full bg-primary px-6 py-3 text-sm font-semibold text-white shadow-soft">Create your own series</NavLink>} />
        ) : rows.length === 0 ? (
          <EmptyState icon={QuizIcon} heading={filtered ? "No assigned series match" : "You're all caught up"} message={filtered ? "Try clearing a filter or searching for something else." : "Nothing is waiting on you. Choose All statuses to see series you've already published."} action={filtered ? <Button variant="secondary" fullWidth={false} className="px-5 py-2" onClick={reset}>Clear filters</Button> : null} />
        ) : (
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {rows.map((s) => (
              <AssignedSeriesCard
                key={s.id}
                series={s}
                onRequestExtension={() => setExtFor(s)}
                onWithdrawExtension={() => withdrawExtension(s.id)}
                onDecline={() => setDeclineFor(s)}
              />
            ))}
          </div>
        )}
      </div>

      <ExtensionRequestModal key={extFor?.id || "ext"} open={Boolean(extFor)} series={extFor} onClose={() => setExtFor(null)} onSubmit={(p) => requestExtension(extFor.id, p)} />
      <DeclineAssignmentModal key={declineFor?.id || "dec"} open={Boolean(declineFor)} series={declineFor} onClose={() => setDeclineFor(null)} onConfirm={(reason) => declineAssignment(declineFor.id, reason)} />
    </div>
  );
}
