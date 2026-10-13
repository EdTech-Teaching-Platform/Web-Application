import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import Chip from "../../../components/ui/Chip";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import StudentProgressDrawer from "./StudentProgressDrawer";
import { isAtRisk } from "../data/teacherCourses";
import { relativeDate } from "./CoursePortfolioCard";
import {
  SearchIcon,
  CertificateIcon,
  MegaphoneIcon,
  ChevronRightIcon,
  DownloadFileIcon,
  AlertTriangleIcon,
} from "../../../components/ui/icons";

const PAGE_SIZE = 6;

// Maps a student's completionStatus onto the shared StatusBadge's status
// tokens (never a locally-styled variant) so this reads the same as every
// other lifecycle/status badge in the app.
const STATUS_META = {
  completed: { label: "Completed", status: "success" },
  "in-progress": { label: "In Progress", status: "warning" },
  "not-started": { label: "Not Started", status: "neutral" },
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "in-progress", label: "In Progress" },
  { key: "completed", label: "Completed" },
  { key: "not-started", label: "Not Started" },
  { key: "at-risk", label: "At Risk" },
];

function StudentStatusBadge({ status }) {
  const meta = STATUS_META[status] ?? STATUS_META["not-started"];
  return (
    <StatusBadge status={meta.status} size="sm" showIcon={false}>
      {meta.label}
    </StatusBadge>
  );
}

function Toast({ message }) {
  if (!message) return null;
  return (
    <div className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-text px-4 py-2.5 text-sm font-medium text-white shadow-lg">
      {message}
    </div>
  );
}

export default function ManagementStudentsTab({ course }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  // Deep-linked from Student Management's cross-course roster (a course
  // chip on a student card/profile routes here with ?student=<name>) so
  // landing on this tab already scopes to that one student instead of
  // showing the full unfiltered list.
  const [search, setSearch] = useState(() => searchParams.get("student") || "");
  const [filter, setFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState([]);
  const [detailStudent, setDetailStudent] = useState(null);
  const [toast, setToast] = useState("");

  function flash(message) {
    setToast(message);
    setTimeout(() => setToast(""), 2400);
  }

  const filtered = useMemo(() => {
    let list = course.students;
    if (filter === "at-risk") list = list.filter(isAtRisk);
    else if (filter !== "all") list = list.filter((s) => s.completionStatus === filter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [course.students, filter, search]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allPagedSelected = paged.length > 0 && paged.every((s) => selected.includes(s.id));

  function toggleAll() {
    if (allPagedSelected) setSelected((prev) => prev.filter((id) => !paged.some((s) => s.id === id)));
    else setSelected((prev) => [...new Set([...prev, ...paged.map((s) => s.id)])]);
  }
  function toggleOne(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function addToAnnouncement() {
    const studentIds = filtered.filter((s) => selected.includes(s.id)).map((s) => s.name.trim().toLowerCase());
    navigate("/teacher/messaging", { state: { composePrefill: { studentIds, source: "course-students" } } });
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {FILTERS.map((f) => (
            <Chip
              key={f.key}
              active={filter === f.key}
              onClick={() => {
                setFilter(f.key);
                setPage(1);
              }}
              className="px-3.5 py-1.5 text-xs"
            >
              {f.label}
            </Chip>
          ))}
        </div>
        <div className="relative w-full sm:max-w-[220px]">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search students…"
            className="w-full rounded-full border border-text/10 bg-white py-2.5 pl-10 pr-4 text-sm text-text placeholder:text-muted outline-none focus:border-primary/40"
          />
        </div>
      </div>

      {selected.length > 0 && (
        <div className="flex items-center justify-between rounded-xl bg-primary/[0.06] px-4 py-2.5">
          <span className="text-sm font-medium text-primary">{selected.length} selected</span>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              fullWidth={false}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
              onClick={addToAnnouncement}
            >
              <MegaphoneIcon className="h-3.5 w-3.5" />
              Add to group announcement
            </Button>
            <Button
              variant="secondary"
              fullWidth={false}
              className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs"
              onClick={() => flash(`Exported ${selected.length} student${selected.length === 1 ? "" : "s"} to CSV.`)}
            >
              <DownloadFileIcon className="h-3.5 w-3.5" />
              Export List
            </Button>
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="rounded-3xl bg-white px-6 py-14 text-center shadow-soft">
          <p className="text-sm font-medium text-muted">No students match this view.</p>
        </div>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-3xl bg-white sm:block shadow-soft">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-text/[0.07] text-xs font-semibold uppercase tracking-wide text-muted">
                  <th className="w-10 py-3 pl-4">
                    <input type="checkbox" checked={allPagedSelected} onChange={toggleAll} className="h-4 w-4 accent-primary" />
                  </th>
                  <th className="py-3">Student</th>
                  <th className="py-3">Enrolled</th>
                  <th className="py-3">Progress</th>
                  <th className="py-3">Last Active</th>
                  <th className="py-3">Status</th>
                  <th className="py-3">Certificate</th>
                  <th className="py-3 pr-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-text/[0.06]">
                {paged.map((s) => (
                  <tr key={s.id} className={isAtRisk(s) ? "bg-danger/[0.03]" : ""}>
                    <td className="py-3 pl-4">
                      <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleOne(s.id)} className="h-4 w-4 accent-primary" />
                    </td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                          {s.name.split(" ").map((p) => p[0]).slice(0, 2).join("")}
                        </span>
                        <span className="flex items-center gap-1.5 text-sm font-medium text-text">
                          {s.name}
                          {isAtRisk(s) && <AlertTriangleIcon className="h-3.5 w-3.5 text-danger" title="At risk — inactive 14+ days" />}
                        </span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-sm text-muted">{s.enrolledAt}</td>
                    <td className="py-3 pr-3">
                      <div className="flex items-center gap-2">
                        <div className="h-1.5 w-20 overflow-hidden rounded-full bg-bg">
                          <div className="h-full rounded-full bg-primary" style={{ width: `${s.progress}%` }} />
                        </div>
                        <span className="text-xs font-medium text-muted">{s.progress}%</span>
                      </div>
                    </td>
                    <td className="py-3 pr-3 text-sm text-muted">{relativeDate(s.lastActive)}</td>
                    <td className="py-3 pr-3">
                      <StudentStatusBadge status={s.completionStatus} />
                    </td>
                    <td className="py-3 pr-3">
                      {s.certificateIssued ? (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
                          <CertificateIcon className="h-3.5 w-3.5" /> Yes
                        </span>
                      ) : (
                        <span className="text-xs text-muted">No</span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => setDetailStudent(s)}
                          className="rounded-full px-2.5 py-1.5 text-xs font-semibold text-primary hover:bg-primary/[0.06]"
                        >
                          View Progress
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile stacked cards */}
          <div className="flex flex-col gap-3 sm:hidden">
            {paged.map((s) => (
              <div key={s.id} className="rounded-3xl bg-white p-4 shadow-soft">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <input type="checkbox" checked={selected.includes(s.id)} onChange={() => toggleOne(s.id)} className="h-4 w-4 accent-primary" />
                    <span className="text-sm font-semibold text-text">{s.name}</span>
                  </div>
                  <StudentStatusBadge status={s.completionStatus} />
                </div>
                <div className="mt-3 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-bg">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${s.progress}%` }} />
                  </div>
                  <span className="text-xs font-medium text-muted">{s.progress}%</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-xs text-muted">
                  <span>Enrolled {s.enrolledAt}</span>
                  <span>Active {relativeDate(s.lastActive)}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 border-t border-text/[0.06] pt-3">
                  <Button variant="secondary" fullWidth={false} className="flex-1 py-1.5 text-xs" onClick={() => setDetailStudent(s)}>
                    View Progress
                  </Button>
                </div>
              </div>
            ))}
          </div>

          {pageCount > 1 && (
            <div className="flex items-center justify-between text-sm text-muted">
              <span>
                Page {page} of {pageCount} · {filtered.length} students
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={page === 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded-full border border-text/15 px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-30"
                >
                  Previous
                </button>
                <button
                  type="button"
                  disabled={page === pageCount}
                  onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                  className="flex items-center gap-1 rounded-full border border-text/15 px-3 py-1.5 text-xs font-semibold text-text disabled:opacity-30"
                >
                  Next
                  <ChevronRightIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          )}
        </>
      )}

      <StudentProgressDrawer student={detailStudent} course={course} onClose={() => setDetailStudent(null)} />

      <Toast message={toast} />
    </div>
  );
}
