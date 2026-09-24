import StatusBadge from "../../../components/ui/StatusBadge";

export default function AttendanceCard({ session, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.(session)}
      className="w-full rounded-2xl bg-white p-5 text-left transition-transform duration-150 hover:-translate-y-0.5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-display font-semibold text-text">{session.topic}</p>
          <p className="mt-1 text-sm text-text/55">{session.educator}</p>
        </div>
        <StatusBadge status={session.attended ? "success" : "danger"}>
          {session.attended ? "Attended" : "Missed"}
        </StatusBadge>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
        <div><p className="text-text/45">Date</p><p className="mt-1 font-medium text-text">{session.date}</p></div>
        <div><p className="text-text/45">Duration</p><p className="mt-1 font-medium text-text">{session.duration}</p></div>
        <div><p className="text-text/45">Attendance</p><p className="mt-1 font-medium text-text">{session.percentage}%</p></div>
      </div>
      <p className="mt-4 text-xs font-semibold text-primary">
        {session.recordingId ? "Open session recording →" : "View session details →"}
      </p>
    </button>
  );
}
