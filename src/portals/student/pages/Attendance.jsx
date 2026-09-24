import { useNavigate, useSearchParams } from "react-router-dom";
import AttendanceCard from "../components/AttendanceCard";
import Button from "../../../components/ui/Button";
import BackButton from "../../../components/common/BackButton";
import { ATTENDANCE_SESSIONS } from "../data/sessionMock";

export default function Attendance() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const courseId = searchParams.get("course");
  const sessions = ATTENDANCE_SESSIONS.filter((session) => !courseId || session.courseId === courseId);
  const attended = sessions.filter((session) => session.attended).length;
  const percentage = sessions.length ? Math.round((sessions.reduce((sum, session) => sum + session.percentage, 0) / sessions.length)) : 0;

  return (
    <div className="mx-auto max-w-[1180px] px-4 py-8 sm:px-6 lg:px-10">
      <BackButton fallback="/student/live-classes" className="mb-4" />
      <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-text/45">Live learning history</p><h1 className="mt-2 font-display text-3xl font-bold text-text">Attendance</h1><p className="mt-2 text-sm text-text/60">Attendance is recorded from session participation events and cannot be edited manually.</p></div><Button fullWidth={false} variant="secondary" onClick={() => navigate("/student/recordings")}>View recordings</Button></div>
      <div className="mt-7 grid gap-4 sm:grid-cols-3"><div className="rounded-2xl bg-primary p-5 text-white"><p className="text-sm text-white/70">Attendance percentage</p><p className="mt-2 font-display text-3xl font-bold text-white">{percentage}%</p></div><div className="rounded-2xl bg-rotation-1 p-5"><p className="text-sm text-text/65">Sessions attended</p><p className="mt-2 font-display text-3xl font-bold text-text">{attended}/{sessions.length}</p></div><div className="rounded-2xl bg-rotation-3 p-5"><p className="text-sm text-text/65">Missed sessions</p><p className="mt-2 font-display text-3xl font-bold text-text">{sessions.filter((session) => !session.attended).length}</p></div></div>
      <div className="mt-7 grid gap-4 md:grid-cols-2">{sessions.map((session) => <AttendanceCard key={session.id} session={session} onOpen={(item) => item.recordingId ? navigate(`/student/recordings?session=${item.sessionId}`) : navigate(`/student/liveclassrating?session=${item.sessionId}`)} />)}</div>
    </div>
  );
}
