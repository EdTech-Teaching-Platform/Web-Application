import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import Button from "../../../components/ui/Button";
import StatusBadge from "../../../components/ui/StatusBadge";
import { CheckCircleIcon, ClockIcon } from "../../../components/ui/icons";
import { getCourseById } from "../../../data/catalogMock";
import { useAuth } from "../../../hooks/useAuth";
import { getStudentEnrolledCourseIds } from "../data/studentLocalState";
import { ATTENDANCE_SESSIONS } from "../data/sessionMock";
import SectionShapes from "../../../components/common/SectionShapes";

function sessionDate(date) {
  const parsed = new Date(date);
  return Number.isNaN(parsed.getTime()) ? date : parsed.toLocaleDateString("en-IN", { dateStyle: "medium" });
}

export default function LearningHistory() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const userId = user?.identifier || user?.id || "guest";
  const enrolledIds = useMemo(() => new Set(getStudentEnrolledCourseIds(userId)), [userId]);
  const sessions = useMemo(
    () => ATTENDANCE_SESSIONS
      .filter((session) => enrolledIds.has(session.courseId))
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [enrolledIds]
  );
  const attendedCount = sessions.filter((session) => session.attended).length;
  const missedCount = sessions.length - attendedCount;

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-primary/70">Your live learning, organized</p>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-text sm:text-4xl">Learning History</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-text/55">Review the live classes you attended or missed, and catch up with available recordings.</p>
        </div>
        <Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/recordings")}>All live class replays</Button>
      </header>

      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {[[sessions.length, "Live classes"], [attendedCount, "Attended"], [missedCount, "Missed"]].map(([value, label]) => (
          <div key={label} className="rounded-2xl border border-text/10 bg-white p-4">
            <strong className="font-display text-2xl text-text">{value}</strong>
            <p className="mt-1 text-xs text-text/45">{label}</p>
          </div>
        ))}
      </section>

      <section className="relative mt-6 overflow-hidden rounded-2xl border border-text/10 bg-white p-5 sm:p-6">
        <SectionShapes variant="why" />
        <div className="relative">
          <p className="text-xs font-bold uppercase tracking-[0.15em] text-primary/70">Past sessions</p>
          <h2 className="mt-1 font-display text-xl font-bold text-text">Live class history</h2>
          {sessions.length ? (
            <div className="mt-4 divide-y divide-text/10">
              {sessions.map((session) => {
                const courseTitle = getCourseById(session.courseId)?.title || "Live class";
                return (
                  <article key={session.id} className="flex flex-col gap-3 py-4 first:pt-1 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${session.attended ? "bg-[#e7f1ef] text-[#28756f]" : "bg-[#fdf3ef] text-primary"}`}>
                        {session.attended ? <CheckCircleIcon className="h-5 w-5" /> : <ClockIcon className="h-5 w-5" />}
                      </span>
                      <div className="min-w-0">
                        <p className="text-[11px] font-semibold text-text/45">{courseTitle} · {sessionDate(session.date)}</p>
                        <h3 className="mt-1 truncate font-display text-sm font-bold text-text">{session.topic}</h3>
                        <p className="text-xs text-text/45">{session.educator} · {session.duration}</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 border-t border-text/5 pt-3 sm:border-0 sm:pt-0">
                      <StatusBadge status={session.attended ? "success" : "warning"}>{session.attended ? "Attended" : "Missed"}</StatusBadge>
                      {session.recordingId ? (
                        <Button fullWidth={false} variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => navigate(`/student/recordings?session=${session.sessionId}`)}>
                          Watch recording →
                        </Button>
                      ) : (
                        <span className="text-xs text-text/40">No recording available</span>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : (
            <div className="mt-4 rounded-xl border border-dashed border-text/15 bg-[#fcfbfa] px-5 py-10 text-center">
              <ClockIcon className="mx-auto h-8 w-8 text-text/30" />
              <h3 className="mt-3 font-display text-lg font-bold text-text">No live class history yet</h3>
              <p className="mt-1 text-sm text-text/50">Your attended and missed live sessions will appear here.</p>
              <Button fullWidth={false} className="mt-4" onClick={() => navigate("/student/live-classes")}>Explore live classes</Button>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
