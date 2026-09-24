import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import BackButton from "../../../components/common/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge";
import { RECORDINGS } from "../data/sessionMock";

const STATUS = {
  Available: "success",
  Processing: "warning",
  Expired: "danger",
};

export default function Recordings() {
  const navigate = useNavigate();
  const [courseFilter, setCourseFilter] = useState("all");
  const recordings = useMemo(
    () => RECORDINGS.filter((recording) => courseFilter === "all" || recording.courseId === courseFilter),
    [courseFilter]
  );

  function openRecording(recording) {
    if (recording.status !== "Available" || recording.access !== "authorized") return;
    navigate(`/student/courseplayer?course=${recording.courseId}&lesson=${recording.lessonId}&recording=${recording.id}`);
  }

  return (
    <div className="px-4 py-8 sm:px-6 lg:px-10">
      <BackButton fallback="/student/live-classes" className="mb-4" />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Post-session learning</p><h1 className="mt-2 font-display text-3xl font-bold text-text">Recordings</h1><p className="mt-2 text-sm text-text/60">View-only recordings from live sessions you were authorized to attend.</p></div>
        <select value={courseFilter} onChange={(event) => setCourseFilter(event.target.value)} className="rounded-full border border-text/10 bg-white px-4 py-2 text-sm text-text outline-none focus:ring-2 focus:ring-primary">
          <option value="all">All courses</option><option value="c1">Complete Python Bootcamp</option><option value="c2">Algebra Foundations</option>
        </select>
      </div>
      <div className="mt-6 space-y-2">
        {recordings.map((recording) => {
          const canOpen = recording.status === "Available" && recording.access === "authorized";
          return <div key={recording.id} className="flex flex-col gap-4 rounded-xl border border-text/10 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0"><div className="flex flex-wrap items-center gap-3"><h2 className="font-display font-semibold text-text">{recording.title}</h2><StatusBadge status={STATUS[recording.status]}>{recording.status}</StatusBadge></div><p className="mt-1 text-sm text-text/55">{recording.educator} · {recording.date} · {recording.duration}</p>{recording.status === "Processing" && <p className="mt-2 text-xs text-warning">The recording is being prepared and will appear here when ready.</p>}{recording.status === "Expired" && <p className="mt-2 text-xs text-danger">This recording has passed its access period.</p>}{recording.access === "unauthorized" && <p className="mt-2 text-xs text-danger">You are not authorized to access this classroom recording.</p>}</div>
            <Button fullWidth={false} disabled={!canOpen} onClick={() => openRecording(recording)}>{canOpen ? "Watch recording" : "Unavailable"}</Button>
          </div>;
        })}
      </div>
    </div>
  );
}
