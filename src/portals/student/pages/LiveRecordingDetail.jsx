import { useSearchParams } from "react-router-dom";
import BackButton from "../../../components/common/BackButton";
import StatusBadge from "../../../components/ui/StatusBadge";
import { getCourseById } from "../../../data/catalogMock";
import { RECORDINGS } from "../data/sessionMock";

export default function LiveRecordingDetail() {
  const [searchParams] = useSearchParams();
  const recording = RECORDINGS.find((item) => item.id === searchParams.get("recording"));
  const course = recording ? getCourseById(recording.courseId) : null;
  const canAccess = recording?.status === "Available" && recording.access === "authorized";

  if (!recording || !course || course.courseType !== "Live") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10 sm:px-6">
        <BackButton fallback="/student/recordings" className="mb-4" />
        <div className="rounded-2xl border border-text/10 bg-white p-8 text-center">
          <h1 className="font-display text-2xl font-bold text-text">Live session recording not found</h1>
          <p className="mt-2 text-sm text-text/60">This replay is not part of the live-session archive.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-10">
      <BackButton fallback="/student/recordings" className="mb-5" />
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/70">Live class archive</p>
      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold text-text">{recording.title}</h1>
          <p className="mt-2 text-sm text-text/60">{course.title} · hosted by {recording.educator}</p>
        </div>
        <StatusBadge status={recording.status === "Available" ? "success" : recording.status === "Processing" ? "warning" : "danger"}>{recording.status}</StatusBadge>
      </div>

      <section className="mt-6 overflow-hidden rounded-2xl border border-text/10 bg-white shadow-sm">
        <div className="flex aspect-video items-center justify-center bg-[#2b1714] p-6 text-center text-white">
          <div>
            <p className="font-display text-xl font-semibold">Live session replay</p>
            <p className="mt-2 max-w-lg text-sm leading-6 text-white/70">
              {canAccess
                ? "This sample session has no replay video attached yet. Live session replays are kept here, separately from prerecorded courses."
                : recording.status === "Processing"
                  ? "This live session replay is still being prepared."
                  : recording.access === "unauthorized"
                    ? "Your account is not authorized to view this session replay."
                    : "The access period for this session replay has ended."}
            </p>
          </div>
        </div>
        <dl className="grid gap-4 p-5 text-sm sm:grid-cols-3">
          <div><dt className="text-xs uppercase tracking-wide text-text/45">Educator</dt><dd className="mt-1 font-semibold text-text">{recording.educator}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-text/45">Session date</dt><dd className="mt-1 font-semibold text-text">{recording.date}</dd></div>
          <div><dt className="text-xs uppercase tracking-wide text-text/45">Duration</dt><dd className="mt-1 font-semibold text-text">{recording.duration}</dd></div>
        </dl>
      </section>
    </div>
  );
}
